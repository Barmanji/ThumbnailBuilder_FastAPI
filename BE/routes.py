import asyncio
import json
import logging
import secrets
import time
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlalchemy.engine import CursorResult
from sqlmodel import Session, col, select

from auth import get_current_user
from config import MAX_HEADSHOT_BYTES, MAX_STYLES_PER_JOB
from database import engine, get_session
from models import Job, Thumbnail, User
from services.generator import (
    STYLE_DETAILS,
    STYLE_ORDER,
    process_job,
    regenerate_thumbnail,
)
from services.imagekit_service import get_variants, upload_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# Hold background task refs so they aren't garbage-collected mid-run
_background_tasks: set[asyncio.Task[None]] = set()

# EventSource cannot send an Authorization header, so the client exchanges its
# session for a short-lived ticket instead. Multi-use within its TTL so that a
# browser reconnect does not 401, and scoped to one user and one job.
TICKET_TTL_SECONDS = 60
_stream_tickets: dict[str, tuple[str, str, float]] = {}


def _issue_ticket(user_id: str, job_id: str) -> str:
    now = time.monotonic()
    for key, (_, _, expires_at) in list(_stream_tickets.items()):
        if expires_at < now:
            _stream_tickets.pop(key, None)

    ticket = secrets.token_urlsafe(32)
    _stream_tickets[ticket] = (user_id, job_id, now + TICKET_TTL_SECONDS)
    return ticket


def _ticket_owner(ticket: str, job_id: str) -> str | None:
    entry = _stream_tickets.get(ticket)
    if entry is None:
        return None

    user_id, ticket_job_id, expires_at = entry
    if expires_at < time.monotonic() or ticket_job_id != job_id:
        _stream_tickets.pop(ticket, None)
        return None

    return user_id


# --------------------------------------------------------------------------
# Request / response schemas
# --------------------------------------------------------------------------


class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: str | None = None
    image_url: str | None = None
    credits: int
    created_at: datetime


class StyleInfoResponse(BaseModel):
    name: str
    label: str
    description: str


class CreateJobRequest(BaseModel):
    prompt: str = Field(min_length=10, max_length=600)
    styles: list[str] = Field(
        default_factory=lambda: STYLE_ORDER[:1],
        min_length=1,
        max_length=MAX_STYLES_PER_JOB,
    )
    headshot_url: str | None = None


class CreateJobResponse(BaseModel):
    job_id: str


class ThumbnailResponse(BaseModel):
    id: str
    style_name: str
    status: str
    imagekit_url: str | None = None
    error_message: str | None = None
    variants: dict[str, str] | None = None


class JobResponse(BaseModel):
    id: str
    prompt: str
    num_thumbnails: int
    headshot_url: str | None = None
    status: str
    created_at: datetime
    thumbnails: list[ThumbnailResponse] = []


class JobSummaryResponse(BaseModel):
    id: str
    prompt: str
    status: str
    num_thumbnails: int
    created_at: datetime
    cover_url: str | None = None


class StreamTicketResponse(BaseModel):
    ticket: str
    expires_in: int


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _owned_job(job_id: str, user: User, session: Session) -> Job:
    job = session.get(Job, job_id)
    # 404 rather than 403 so the API does not confirm that someone else's job exists.
    if job is None or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


def _spend_credit(user: User, session: Session) -> None:
    """Atomic decrement: two tabs cannot both spend the last credit."""
    result = session.execute(
        update(User)
        .where(col(User.id) == user.id, col(User.credits) > 0)
        .values(credits=col(User.credits) - 1)
    )
    if not isinstance(result, CursorResult) or result.rowcount == 0:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "NO_CREDITS",
                "message": "You have used all of your free generations.",
            },
        )


def _job_response(job: Job, session: Session) -> JobResponse:
    thumbnails = session.exec(
        select(Thumbnail).where(Thumbnail.job_id == job.id)
    ).all()

    order = {name: index for index, name in enumerate(STYLE_ORDER)}
    ordered = sorted(thumbnails, key=lambda thumb: order.get(thumb.style_name, len(order)))

    return JobResponse(
        id=job.id,
        prompt=job.prompt,
        num_thumbnails=job.num_thumbnails,
        headshot_url=job.headshot_url,
        status=job.status,
        created_at=job.created_at,
        thumbnails=[
            ThumbnailResponse(
                id=thumb.id,
                style_name=thumb.style_name,
                status=thumb.status,
                imagekit_url=thumb.imagekit_url,
                error_message=thumb.error_message,
                variants=(
                    get_variants(thumb.imagekit_url) if thumb.imagekit_url else None
                ),
            )
            for thumb in ordered
        ],
    )


def _schedule(task: asyncio.Task[None]) -> None:
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/me", response_model=UserProfileResponse)
def read_me(user: User = Depends(get_current_user)) -> UserProfileResponse:
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        image_url=user.image_url,
        credits=user.credits,
        created_at=user.created_at,
    )


@router.get("/styles", response_model=list[StyleInfoResponse])
def list_styles() -> list[StyleInfoResponse]:
    return [
        StyleInfoResponse(
            name=name,
            label=STYLE_DETAILS[name]["label"],
            description=STYLE_DETAILS[name]["description"],
        )
        for name in STYLE_ORDER
    ]


@router.post("/upload-headshot")
async def upload_headshot(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> dict[str, str | None]:
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > MAX_HEADSHOT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Headshots must be 5 MB or smaller.",
        )

    content_type = file.content_type or "image/png"
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only image uploads are supported.",
        )

    image_url = await asyncio.to_thread(
        upload_image,
        file_bytes=content,
        file_name=file.filename or "headshot.png",
        folder=f"headshots/{user.id}",
        content_type=content_type,
    )

    if not image_url:
        raise HTTPException(status_code=502, detail="The image host rejected the upload.")

    return {"url": image_url}


@router.post("/jobs", response_model=CreateJobResponse, status_code=201)
async def create_job(
    request: CreateJobRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CreateJobResponse:
    styles = list(dict.fromkeys(request.styles))
    if len(styles) != len(request.styles):
        raise HTTPException(status_code=400, detail="Styles must be unique.")

    unknown = [style for style in styles if style not in STYLE_ORDER]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown styles: {', '.join(unknown)}.",
        )

    _spend_credit(user, session)

    job = Job(
        user_id=user.id,
        prompt=request.prompt.strip(),
        num_thumbnails=len(styles),
        headshot_url=request.headshot_url,
    )
    session.add(job)

    for style in styles:
        session.add(Thumbnail(job_id=job.id, style_name=style))

    session.commit()

    _schedule(asyncio.create_task(process_job(job.id)))

    return CreateJobResponse(job_id=job.id)


@router.get("/jobs", response_model=list[JobSummaryResponse])
def list_jobs(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[JobSummaryResponse]:
    jobs = session.exec(
        select(Job)
        .where(Job.user_id == user.id)
        .order_by(col(Job.created_at).desc())
        .limit(50)
    ).all()

    if not jobs:
        return []

    job_ids = [job.id for job in jobs]
    thumbnails = session.exec(
        select(Thumbnail).where(col(Thumbnail.job_id).in_(job_ids))
    ).all()

    covers: dict[str, str] = {}
    for thumb in thumbnails:
        if thumb.imagekit_url and thumb.job_id not in covers:
            covers[thumb.job_id] = thumb.imagekit_url

    return [
        JobSummaryResponse(
            id=job.id,
            prompt=job.prompt,
            status=job.status,
            num_thumbnails=job.num_thumbnails,
            created_at=job.created_at,
            cover_url=covers.get(job.id),
        )
        for job in jobs
    ]


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> JobResponse:
    job = _owned_job(job_id, user, session)
    return _job_response(job, session)


@router.post("/jobs/{job_id}/stream-ticket", response_model=StreamTicketResponse)
def create_stream_ticket(
    job_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamTicketResponse:
    job = _owned_job(job_id, user, session)
    return StreamTicketResponse(
        ticket=_issue_ticket(user.id, job.id),
        expires_in=TICKET_TTL_SECONDS,
    )


@router.post(
    "/jobs/{job_id}/thumbnails/{thumbnail_id}/retry",
    response_model=JobResponse,
)
async def retry_thumbnail(
    job_id: str,
    thumbnail_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> JobResponse:
    job = _owned_job(job_id, user, session)
    thumbnail = session.get(Thumbnail, thumbnail_id)

    if thumbnail is None or thumbnail.job_id != job.id:
        raise HTTPException(status_code=404, detail="Thumbnail not found.")
    if thumbnail.status in ("pending", "generating"):
        raise HTTPException(status_code=409, detail="That style is still generating.")

    thumbnail.status = "pending"
    thumbnail.error_message = None
    thumbnail.imagekit_url = None
    job.status = "processing"

    session.add(thumbnail)
    session.add(job)
    session.commit()
    session.refresh(job)

    _schedule(asyncio.create_task(regenerate_thumbnail(job.id, thumbnail.id)))

    return _job_response(job, session)


@router.get("/jobs/{job_id}/stream")
async def stream_job(
    job_id: str,
    ticket: str = Query(default=""),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """Stream job updates via Server-Sent Events.

    Authenticated with the short-lived ticket from /stream-ticket, because
    EventSource cannot send headers.
    """
    user_id = _ticket_owner(ticket, job_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired stream ticket.",
        )

    job = session.get(Job, job_id)
    if job is None or job.user_id != user_id:
        raise HTTPException(status_code=404, detail="Job not found.")

    async def event_generator():
        sent_thumbnails: set[str] = set()
        ticks = 0

        # Flush headers immediately so the browser fires onopen.
        yield ": connected\n\n"

        while True:
            with Session(engine) as db:
                current_job = db.get(Job, job_id)
                if current_job is None:
                    yield f"event: error\ndata: {json.dumps({'error': 'Job not found'})}\n\n"
                    return

                thumbnails = db.exec(
                    select(Thumbnail).where(Thumbnail.job_id == job_id)
                ).all()

                if not thumbnails:
                    yield f"event: error\ndata: {json.dumps({'error': 'Job has no thumbnails'})}\n\n"
                    return

                for thumb in thumbnails:
                    if thumb.id in sent_thumbnails:
                        continue

                    if thumb.status == "uploaded":
                        variants = (
                            get_variants(thumb.imagekit_url)
                            if thumb.imagekit_url
                            else None
                        )
                        data = json.dumps(
                            {
                                "thumbnail_id": thumb.id,
                                "style_name": thumb.style_name,
                                "imagekit_url": thumb.imagekit_url,
                                "variants": variants,
                            }
                        )
                        yield f"event: thumbnail_ready\ndata: {data}\n\n"
                        sent_thumbnails.add(thumb.id)
                    elif thumb.status == "error":
                        data = json.dumps(
                            {
                                "thumbnail_id": thumb.id,
                                "style_name": thumb.style_name,
                                "error": thumb.error_message,
                            }
                        )
                        yield f"event: thumbnail_failed\ndata: {data}\n\n"
                        sent_thumbnails.add(thumb.id)

                settled = all(
                    thumb.status in ("uploaded", "error") for thumb in thumbnails
                )
                if settled and len(sent_thumbnails) == len(thumbnails):
                    data = json.dumps(
                        {"job_id": current_job.id, "status": current_job.status}
                    )
                    yield f"event: job_completed\ndata: {data}\n\n"
                    return

            ticks += 1
            if ticks % 8 == 0:
                # Keeps proxies from closing an idle stream (~12s).
                yield ": ping\n\n"

            await asyncio.sleep(1.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
