"""Application settings, read from environment variables with sane local defaults."""
import os


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./zoom_clone.db")
    # Public URL of the Next.js frontend, used to build shareable invite links.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    # Comma-separated list of allowed CORS origins.
    CORS_ORIGINS: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
    ]
    # The assignment assumes a single, always-logged-in default user.
    DEFAULT_USER_ID: int = 1


settings = Settings()
