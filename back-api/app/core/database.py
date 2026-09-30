import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

if os.path.exists("/app/storage"):
    STORAGE_DIR = "/app/storage"
else:
    # Compute root directory when running locally
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    STORAGE_DIR = os.path.join(BASE_DIR, ".storage")

os.makedirs(STORAGE_DIR, exist_ok=True)
SQLALCHEMY_DATABASE_URL = f"sqlite+aiosqlite:///{os.path.join(STORAGE_DIR, 'users.db')}"

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with SessionLocal() as db:
        yield db
