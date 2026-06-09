from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .env import Settings

settings = Settings()
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    pool_size=50,
    max_overflow=100,
    pool_timeout=30,
    pool_pre_ping=True,
)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
