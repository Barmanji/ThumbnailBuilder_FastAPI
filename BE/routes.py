import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File # bare min
from pydantic import BaseModel
from sqlmodel import Session

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

@router.post("/upload-headshot")
async def upload_headshot(file: UploadFile = File(...)):
    """Upload a headshot image to ImageKit and return the URL."""
    content  = await file.read()

    image_url = upload_image(
        file_bytes=content,
        file_name=file.filename or "headshot.png",
        folder="headshots",
        content_type=file.content_type or "image/png",
    )

    return {"url": image_url}

# Dep injection
@router.post("/job", response_model=CreateJobResponse)
async def create_job(request: CreateJobRequest, session: Session = Depends(get_session)):
    if request.num_thumbnails < 1 or request.num_thumbnails > 3:
        raise HTTPException(status_code=400, detail="num_thumbnails must be between 1 and 3.")

    job = Job(
        prompt=request.prompt,
        num_thumbnails=request.num_thumbnails,
        headshot_url=request.headshot_url,
    )
    session.add(job)

    styles = STYLE_ORDER[:request.num_thumbnails]
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

# @router.get("/job/{job_id}", response_model=list[ThumbnailResponse])
