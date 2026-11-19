import os

from dotenv import load_dotenv


load_dotenv()


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

IMAGEKIT_PRIVATE_KEY = os.getenv("IMAGEKIT_PRIVATE_KEY", "")
IMAGEKIT_PUBLIC_KEY = os.getenv("IMAGEKIT_PUBLIC_KEY", "")
IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "")

# Clerk (server-side only). The publishable key never reaches this process.
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_AUTHORIZED_PARTIES = _csv(os.getenv("CLERK_AUTHORIZED_PARTIES", ""))

CORS_ORIGINS = _csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

# Product rules
FREE_CREDITS = int(os.getenv("FREE_CREDITS", "3"))
MAX_STYLES_PER_JOB = 3
MAX_HEADSHOT_BYTES = 5 * 1024 * 1024

# Default is a local SQLite file; point DATABASE_URL at a mounted volume in
# production so the data survives restarts.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./thumbnailbuilder.db")
SQL_ECHO = os.getenv("SQL_ECHO", "0").lower() in {"1", "true", "yes"}
