import asyncio
import logging

from sqlmodel import Session, select

from database import engine
from models import Job, Thumbnail
from services.openai_service import generate_thumbnail
from services.imagekit_service import upload_image

logger = logging.getLogger(__name__)

STYLES = {
    "bold_dramatic": (
        "Create a bold, dramatic YouTube thumbnail with high contrast, "
        "cinematic lighting, dark moody background, and powerful composition. "
        "The person's face should be prominent with a dramatic expression."
    ),
    "clean_minimal": (
        "Create a clean, minimal YouTube thumbnail with bright lighting, "
        "white/light background, modern professional aesthetic, plenty of "
        "whitespace, and sharp clean composition. The person should look "
        "approachable and professional."
    ),
    "vibrant_energetic": (
        "Create a vibrant, energetic YouTube thumbnail with colorful "
        "gradients, "
        "dynamic angles, eye-catching pop-art style colors, and energetic "
        "composition. The person should have an excited or engaging "
        "expression."
    ),
}

STYLE_ORDER = ["bold_dramatic", "clean_minimal", "vibrant_energetic"]

# UI copy for the style picker, kept next to the prompts so the two cannot drift.
STYLE_DETAILS: dict[str, dict[str, str]] = {
    "bold_dramatic": {
        "label": "Bold & dramatic",
        "description": "High contrast, cinematic lighting, dark moody background, powerful composition.",
    },
    "clean_minimal": {
        "label": "Clean & minimal",
        "description": "Bright lighting, light background, plenty of whitespace, sharp professional look.",
    },
    "vibrant_energetic": {
        "label": "Vibrant & energetic",
        "description": "Colorful gradients, dynamic angles, pop-art colors, excited expression.",
    },
}



async def generate_single_thumbnail(thumbnail_id: str, prompt: str, headshot_url: str | None) -> None:
    """Generate one thumbnail, upload it, and persist the result."""
    with Session(engine) as session:
        thumb = session.get(Thumbnail, thumbnail_id)
        if thumb is None:
            logger.error(f"Thumbnail {thumbnail_id} not found.")
            return
        thumb.status = "generating"
        style_name = thumb.style_name
        job_id = thumb.job_id
        session.add(thumb)
        session.commit()

    try:
        style_prompt = STYLES.get(style_name, STYLES["bold_dramatic"])
        image_bytes = await generate_thumbnail(prompt, style_prompt, headshot_url)

        image_url = upload_image(
            file_bytes=image_bytes,
            file_name=f"{thumbnail_id}.png",
            folder=f"thumbnails/{job_id}",
        )

        with Session(engine) as session:
            thumb = session.get(Thumbnail, thumbnail_id)
            if thumb is None:
                logger.error(f"Thumbnail {thumbnail_id} disappeared before save.")
                return
            thumb.imagekit_url = image_url
            thumb.status = "uploaded"
            thumb.error_message = None
            session.add(thumb)
            session.commit()

        logger.info(f"Thumbnail {thumbnail_id} generated and uploaded successfully.")
    except Exception as e:
        logger.error(f"Error generating thumbnail {thumbnail_id}: {e}")
        with Session(engine) as session:
            thumb = session.get(Thumbnail, thumbnail_id)
            if thumb is None:
                return
            thumb.status = "error"
            thumb.error_message = str(e)[:500]
            session.add(thumb)
            session.commit()


async def process_job(job_id: str) -> None:
    """Run all thumbnail workers for a job, then mark the job complete or failed."""
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if job is None:
            logger.error(f"Job {job_id} not found.")
            return
        job.status = "processing"
        prompt = job.prompt
        headshot_url = job.headshot_url or ""
        session.add(job)
        session.commit()

        thumbnails = session.exec(
            select(Thumbnail).where(Thumbnail.job_id == job_id)
        ).all()
        thumbnail_ids = [t.id for t in thumbnails]

    tasks = [
        generate_single_thumbnail(tid, prompt, headshot_url)
        for tid in thumbnail_ids
    ]
    _ = await asyncio.gather(*tasks, return_exceptions=True)
    refresh_job_status(job_id)


def refresh_job_status(job_id: str) -> None:
    """Derive the job status from the statuses of its thumbnails."""
    with Session(engine) as session:
        thumbnails = session.exec(
            select(Thumbnail).where(Thumbnail.job_id == job_id)
        ).all()

        job = session.get(Job, job_id)
        if job is None:
            return

        if any(t.status in ("pending", "generating") for t in thumbnails):
            job.status = "processing"
        elif thumbnails and all(t.status == "error" for t in thumbnails):
            job.status = "failed"
        else:
            job.status = "completed"

        session.add(job)
        session.commit()


async def regenerate_thumbnail(job_id: str, thumbnail_id: str) -> None:
    """Re-run a single style, usually after the model returned an error."""
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if job is None:
            logger.error("Job %s not found for retry.", job_id)
            return
        prompt = job.prompt
        headshot_url = job.headshot_url or ""
        job.status = "processing"
        session.add(job)
        session.commit()

    await generate_single_thumbnail(thumbnail_id, prompt, headshot_url)
    refresh_job_status(job_id)

