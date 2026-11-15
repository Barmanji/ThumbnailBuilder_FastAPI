import asyncio
import logging
import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File  # bare min
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session,select

from database import get_session
from models import Job, Thumbnail

from services.generator import process_job, STYLE_ORDER
from services.imagekit_service import upload_image, get_variants

logger = logging.getLogger(__name__)

# Hold background task refs so they aren't garbage-collected mid-run
_background_tasks: set[asyncio.Task[None]] = set()

# Routing obilerplate

router = APIRouter(prefix="/api")

# req res schemas


class CreateJobRequest(BaseModel):
    prompt: str
    num_thumbnails: int
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
    thumbnails: list[ThumbnailResponse] = []


@router.post("/upload-headshot")
async def upload_headshot(file: UploadFile = File(...)):
    """Upload a headshot image to ImageKit and return the URL."""
    content = await file.read()

    image_url = upload_image(
        file_bytes=content,
        file_name=file.filename or "headshot.png",
        folder="headshots",
        content_type=file.content_type or "image/png",
    )

    return {"url": image_url}


# Dep injection
@router.post("/job", response_model=CreateJobResponse)
async def create_job(
    request: CreateJobRequest, session: Session = Depends(get_session)
):
    if request.num_thumbnails < 1 or request.num_thumbnails > 3:
        raise HTTPException(
            status_code=400, detail="num_thumbnails must be between 1 and 3."
        )

    job = Job(
        prompt=request.prompt,
        num_thumbnails=request.num_thumbnails,
        headshot_url=request.headshot_url,
    )
    session.add(job)

    styles = STYLE_ORDER[: request.num_thumbnails]
    for style in styles:
        thumb = Thumbnail(
            job_id=job.id,
            style_name=style,
        )
        session.add(thumb)

    session.commit()

    # Fire and forget style gen (keep a reference so the task isn't collected)
    task = asyncio.create_task(process_job(job.id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return CreateJobResponse(job_id=job.id)


@router.get("/job/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    thumbnails = session.exec(select(Thumbnail).where(Thumbnail.job_id == job_id)).all()
    thumb_responses = []
    for thumb in thumbnails:
        variants = get_variants(thumb.imagekit_url) if thumb.imagekit_url else None
        thumb_responses.append(
            ThumbnailResponse(
                id=thumb.id,
                style_name=thumb.style_name,
                status=thumb.status,
                imagekit_url=thumb.imagekit_url,
                error_message=thumb.error_message,
                variants=variants,
            )
        )

    return JobResponse(
        id=job.id,
        prompt=job.prompt,
        num_thumbnails=job.num_thumbnails,
        headshot_url=job.headshot_url,
        status=job.status,
        thumbnails=thumb_responses,
    )


# SSE (Server-Sent Events) endpoint for streaming job updates
@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    """Stream job updates via Server-Sent Events (SSE)."""
    "Event Generator"

    async def event_generator():
        from database import engine

        sent_thumbnails: set[str] = set()
        while True:
            with Session(engine) as session:
                job = session.get(Job, job_id)
                if not job:
                    yield f"event: error\ndata: {json.dumps({'error': 'Job not found'})}\n\n"
                    return

                thumbnails = session.exec(
                    select(Thumbnail).where(Thumbnail.job_id == job_id)
                ).all()

                for thumb in thumbnails:
                    # for sent case
                    if thumb.id in sent_thumbnails:
                        continue
                    # For new and uploaded
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
                        yield f"event: thumbnail ready\ndata: {data}\n\n"
                        sent_thumbnails.add(thumb.id)
                    # Failed
                    elif thumb.status == "error":
                        data = json.dumps(
                            {
                                "thumbnail_id": thumb.id,
                                "style_name": thumb.style_name,
                                "error": thumb.error_message,
                            }
                        )
                        yield f"event: thumbnail failed\ndata: {data}\n\n"
                        sent_thumbnails.add(thumb.id)

                    all_done = all(
                        thumb.status in ("uploaded", "error") for thumb in thumbnails
                    )
                    if all_done and len(sent_thumbnails) == len(thumbnails):
                        data = json.dumps({"job_id": job.id, "status": job.status})
                        yield f"event: job completed\ndata: {data}\n\n"
                        return

            await asyncio.sleep(1.5)  # Polling interval

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
