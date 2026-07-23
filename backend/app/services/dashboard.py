from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.case import Case
from app.models.email import Email
from app.models.task import Task
from app.schemas.common import DashboardStats


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_stats(self) -> DashboardStats:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Active cases
        closed_statuses = ["CLOSED", "CANCELLED"]
        active_cases_result = await self.db.execute(
            select(func.count()).select_from(Case).where(
                Case.deleted_at.is_(None),
                Case.status.notin_(closed_statuses),
            )
        )
        active_cases = (active_cases_result.scalar()) or 0

        # Unread emails
        unread_result = await self.db.execute(
            select(func.count()).select_from(Email).where(
                Email.direction == "INBOUND",
                Email.status == "UNREAD",
            )
        )
        unread_emails = (unread_result.scalar()) or 0

        # Pending tasks
        pending_tasks_result = await self.db.execute(
            select(func.count()).select_from(Task).where(
                Task.deleted_at.is_(None),
                Task.status == "PENDING",
            )
        )
        pending_tasks = (pending_tasks_result.scalar()) or 0

        # Completed this month
        completed_result = await self.db.execute(
            select(func.count()).select_from(Case).where(
                Case.deleted_at.is_(None),
                Case.status == "CLOSED",
                Case.closed_at >= month_start,
            )
        )
        completed_this_month = (completed_result.scalar()) or 0

        # Overdue tasks
        overdue_result = await self.db.execute(
            select(func.count()).select_from(Task).where(
                Task.deleted_at.is_(None),
                Task.status == "PENDING",
                Task.due_date < now,
            )
        )
        overdue_tasks = (overdue_result.scalar()) or 0

        # Cases by status
        status_result = await self.db.execute(
            select(Case.status, func.count())
            .where(Case.deleted_at.is_(None))
            .group_by(Case.status)
        )
        cases_by_status = {row[0]: row[1] for row in status_result.all()}

        return DashboardStats(
            active_cases=active_cases,
            unread_emails=unread_emails,
            pending_tasks=pending_tasks,
            completed_this_month=completed_this_month,
            overdue_tasks=overdue_tasks,
            cases_by_status=cases_by_status,
        )
