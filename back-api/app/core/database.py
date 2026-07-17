import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

if os.path.exists("/app/storage"):
    STORAGE_DIR = "/app/storage"
else:
    # Compute root directory when running locally
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    STORAGE_DIR = os.path.join(BASE_DIR, ".storage")

os.makedirs(STORAGE_DIR, exist_ok=True)
SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(STORAGE_DIR, 'users.db')}"

# check_same_thread=False is needed only for SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
