import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Email(Base):
    __tablename__ = "emails"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    thread_id: Mapped[str | None] = mapped_column(Text, nullable=True, index=True)

    from_addr: Mapped[str] = mapped_column(String(500), nullable=False)
    from_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    to_addrs: Mapped[list] = mapped_column(ARRAY(String), nullable=False)
    cc_addrs: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)

    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)

    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # INBOUND | OUTBOUND

    has_attachments: Mapped[bool] = mapped_column(Boolean, default=False)
    attachment_ids: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)

    # AI classification
    ai_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_priority: Mapped[str | None] = mapped_column(String(10), nullable=True)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_action_needed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    ai_suggested_case_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(String(20), default="UNREAD", index=True)
    linked_case_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("cases.id"), nullable=True, index=True
    )
    linked_manually: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    forwarded_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Email from={self.from_addr} subject={self.subject[:50] if self.subject else ''}>"
