from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from sqlmodel import Field, Relationship, SQLModel


def _uuid() -> str:  # uuid4 keeps identifiers unguessable
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """Local mirror of a Clerk user, plus the credits they have left."""

    id: str = Field(primary_key=True)  # Clerk user id, "user_..."
    email: str = Field(default="", index=True)
    name: Optional[str] = Field(default=None)
    image_url: Optional[str] = Field(default=None)
    credits: int = Field(default=3, ge=0)
    created_at: datetime = Field(default_factory=_now)

    jobs: List["Job"] = Relationship(back_populates="user")


class Thumbnail(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    job_id: str = Field(foreign_key="job.id", index=True)
    style_name: str = Field(default="")
    status: str = Field(default="pending")
    error_message: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=_now)
    imagekit_url: Optional[str] = Field(default=None)
    job: Optional["Job"] = Relationship(back_populates="thumbnails")


class Job(SQLModel, table=True):
    id: str = Field(default_factory=_uuid, primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    prompt: str = Field(default="")
    num_thumbnails: int = Field(default=1, ge=1, le=3)
    headshot_url: Optional[str] = Field(default="")
    status: str = Field(default="pending")
    created_at: datetime = Field(default_factory=_now)

    user: Optional["User"] = Relationship(back_populates="jobs")
    thumbnails: List["Thumbnail"] = Relationship(back_populates="job")
