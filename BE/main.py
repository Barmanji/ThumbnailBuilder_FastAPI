from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_table
from routes import router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    create_table()  # Ensure tables are created at startup
    yield


app = FastAPI(title="Youtube Thumbnail Generator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Adjust this in production for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
