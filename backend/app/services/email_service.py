from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from app.models.email import Email
from app.schemas.email import EmailUpdate, EmailResponse, EmailListResponse


class EmailService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_emails(
        self,
        status: Optional[str] = None,
        case_id: Optional[str] = None,
        ai_category: Optional[str] = None,
        direction: str = "INBOUND",
        q: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> EmailListResponse:
        query = select(Email).where(Email.direction == direction)

        if status:
            query = query.where(Email.status == status)
        if case_id:
            query = query.where(Email.linked_case_id == case_id)
        if ai_category:
            query = query.where(Email.ai_category == ai_category)
        if q:
            query = query.where(
                or_(
                    Email.subject.ilike(f"%{q}%"),
                    Email.body_text.ilike(f"%{q}%"),
                    Email.from_addr.ilike(f"%{q}%"),
                    Email.from_name.ilike(f"%{q}%"),
                )
            )

        query = query.order_by(Email.received_at.desc()).limit(limit + 1)
        result = await self.db.execute(query)
        emails = result.scalars().all()

        has_more = len(emails) > limit
        items = emails[:limit]
        next_cursor = items[-1].id if has_more else None

        # Unread count
        unread_query = select(func.count()).select_from(Email).where(
            Email.direction == direction, Email.status == "UNREAD"
        )
        unread_count = (await self.db.execute(unread_query)).scalar() or 0

        count_query = select(func.count()).select_from(Email).where(Email.direction == direction)
        if status:
            count_query = count_query.where(Email.status == status)
        total = (await self.db.execute(count_query)).scalar() or 0

        return EmailListResponse(
            items=[EmailResponse.model_validate(e) for e in items],
            total=total,
            unread_count=unread_count,
            cursor=next_cursor,
        )

    async def get_email(self, email_id: str) -> Email | None:
        result = await self.db.execute(select(Email).where(Email.id == email_id))
        email = result.scalar_one_or_none()
        if email and email.status == "UNREAD":
            email.status = "READ"
            await self.db.flush()
        return email

    async def update_email(self, email: Email, data: EmailUpdate) -> Email:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(email, key, value)
        await self.db.flush()
        return email

    async def link_to_case(self, email: Email, case_id: str, manual: bool = True) -> Email:
        email.linked_case_id = case_id
        email.linked_manually = manual
        email.status = "ACTIONED"
        await self.db.flush()
        return email

    async def unlink_from_case(self, email: Email) -> Email:
        email.linked_case_id = None
        email.linked_manually = None
        await self.db.flush()
        return email

    async def get_thread(self, thread_id: str) -> list[Email]:
        result = await self.db.execute(
            select(Email)
            .where(Email.thread_id == thread_id)
            .order_by(Email.received_at.asc())
        )
        return list(result.scalars().all())

    async def ingest_email(self, email_data: dict) -> Email:
        """Create an email record from IMAP ingestion"""
        email = Email(
            direction="INBOUND",
            status="UNREAD",
            **email_data,
        )
        self.db.add(email)
        await self.db.flush()
        return email
