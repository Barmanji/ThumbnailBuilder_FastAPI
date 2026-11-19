from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from database import create_table
from routes import router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    create_table()  # dev convenience; migrations take over at deploy time
    yield


app = FastAPI(title="YouTube Thumbnail Generator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    # Port 8080 is what FE/vite.config.ts proxies /api to.
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)
