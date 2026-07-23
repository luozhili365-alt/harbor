import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, INTERVAL
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cases.id"), nullable=True, index=True)
    assigned_to: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)

    task_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    priority: Mapped[str] = mapped_column(String(10), default="NORMAL")
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True)

    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    reminder_before: Mapped[str | None] = mapped_column(Text, nullable=True)  # PostgreSQL INTERVAL stored as text
    reminded_at: Mapped[list | None] = mapped_column(ARRAY(DateTime(timezone=True)), nullable=True)

    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence_rule: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    completed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Task {self.title[:50]} ({self.status})>"
