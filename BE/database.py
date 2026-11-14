from sqlmodel import SQLModel, create_engine, Session
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False}) # fastapi uses check_same_thread=False for sqlite, but it's not recommended for production use. Use a proper database like PostgreSQL or MySQL in production.

def create_table():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

