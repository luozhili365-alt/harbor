import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, BigInteger, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cases.id"), nullable=True, index=True)

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    doc_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(30), nullable=False)  # EMAIL_ATTACHMENT | MANUAL_UPLOAD | SYSTEM_GENERATED | CUSTOMS_DOWNLOAD

    # AI extracted data
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    extraction_confidences: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # OCR
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_status: Mapped[str] = mapped_column(String(20), default="PENDING")
    ocr_engine: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # File hashing for dedup
    sha256_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    uploaded_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Document {self.original_name} ({self.doc_type})>"
