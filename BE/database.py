from sqlmodel import SQLModel, create_engine, Session

from config import DATABASE_URL, SQL_ECHO
import models  # noqa: F401  (registers tables on SQLModel.metadata)

# SQLite needs check_same_thread disabled because FastAPI may touch the
# connection from worker threads. Other databases get no special arguments.
_connect_args = (
    {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(DATABASE_URL, echo=SQL_ECHO, connect_args=_connect_args)


def create_table():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
