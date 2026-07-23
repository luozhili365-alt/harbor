from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "Harbor"
    app_env: str = "development"
    debug: bool = True
    log_level: str = "DEBUG"
    cors_origins: str = "http://localhost:3000"

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "harbor"
    db_password: str = "harbor_dev"
    db_name: str = "harbor"

    # Allow overriding via full DATABASE_URL env var (Render provides this)
    database_url_full: str = ""

    @property
    def database_url(self) -> str:
        if self.database_url_full:
            u = self.database_url_full
            if u.startswith("postgres://"):
                u = u.replace("postgres://", "postgresql+asyncpg://", 1)
            elif u.startswith("postgresql://"):
                u = u.replace("postgresql://", "postgresql+asyncpg://", 1)
            return u
        return f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def database_url_sync(self) -> str:
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "harbor_minio"
    minio_secret_key: str = "harbor_minio_dev"
    minio_bucket: str = "harbor-documents"
    minio_secure: bool = False

    # JWT
    jwt_secret_key: str = "change-this-to-a-random-secret-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # AI
    anthropic_api_key: Optional[str] = None
    ai_enabled: bool = False
    ai_model: str = "claude-sonnet-4-20250514"

    # Email
    email_enabled: bool = False
    imap_host: Optional[str] = None
    imap_port: int = 993
    imap_user: Optional[str] = None
    imap_password: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

    # OCR
    ocr_engine: str = "paddleocr"
    tesseract_lang: str = "chi_sim+eng"

    model_config = {"env_file": "../.env", "case_sensitive": False}


settings = Settings()
