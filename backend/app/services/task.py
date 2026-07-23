from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse

CASCADE_MILESTONES = [
    (30, "30天前"),
    (14, "两周前"),
    (7, "一周前"),
    (3, "三天前"),
    (1, "一天前"),
]


class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_cascade(self, parent_title: str, due_date: datetime, priority: str,
                          user_id: str, case_id: Optional[str] = None) -> list[Task]:
        """Auto-generate cascade milestone reminders before a deadline."""
        now = datetime.now(timezone.utc)
        cascades = []

        for days_before, label in CASCADE_MILESTONES:
            cascade_date = due_date - timedelta(days=days_before)
            if cascade_date <= now:
                continue  # don't create past reminders

            task = Task(
                id=str(uuid.uuid4()),
                title=f"{label}提醒: {parent_title}",
                description=f"原始截止日期: {due_date.strftime('%Y-%m-%d')}，距离截止还有 {days_before} 天",
                task_type="CASCADE",
                priority=priority,
                status="PENDING",
                due_date=cascade_date,
                created_by=user_id,
                case_id=case_id,
            )
            self.db.add(task)
            cascades.append(task)

        return cascades

    async def list_tasks(
        self,
        case_id: Optional[str] = None,
        assigned_to: Optional[str] = None,
        status: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> TaskListResponse:
        query = select(Task).where(Task.deleted_at.is_(None))

        if case_id:
            query = query.where(Task.case_id == case_id)
        if assigned_to:
            query = query.where(Task.assigned_to == assigned_to)
        if status:
            query = query.where(Task.status == status)

        query = query.order_by(Task.due_date.asc()).limit(limit + 1)
        result = await self.db.execute(query)
        tasks = result.scalars().all()

        has_more = len(tasks) > limit
        items = tasks[:limit]
        next_cursor = items[-1].id if has_more else None

        # Overdue count
        now = datetime.now(timezone.utc)
        overdue_query = (
            select(func.count()).select_from(Task)
            .where(
                Task.deleted_at.is_(None),
                Task.status == "PENDING",
                Task.due_date < now,
            )
        )
        overdue_count = (await self.db.execute(overdue_query)).scalar() or 0

        count_query = select(func.count()).select_from(Task).where(Task.deleted_at.is_(None))
        if status:
            count_query = count_query.where(Task.status == status)
        total = (await self.db.execute(count_query)).scalar() or 0

        return TaskListResponse(
            items=[TaskResponse.model_validate(t) for t in items],
            total=total,
            overdue_count=overdue_count,
            cursor=next_cursor,
        )

    async def get_due_soon(self, hours: int = 48, limit: int = 20) -> list[Task]:
        now = datetime.now(timezone.utc)
        future = datetime.now(timezone.utc)
        # Add hours using a simple workaround
        from datetime import timedelta
        future = now + timedelta(hours=hours)

        result = await self.db.execute(
            select(Task)
            .where(
                Task.deleted_at.is_(None),
                Task.status == "PENDING",
                Task.due_date >= now,
                Task.due_date <= future,
            )
            .order_by(Task.due_date.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_task(self, task_id: str) -> Task | None:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create_task(self, data: TaskCreate, user_id: str) -> Task:
        task = Task(created_by=user_id, **data.model_dump())
        self.db.add(task)
        await self.db.flush()

        # Auto-cascade: generate milestone reminders for far-future tasks
        if task.due_date:
            days_until = (task.due_date - datetime.now(timezone.utc)).days
            if days_until >= 3:
                self._generate_cascade(
                    parent_title=task.title,
                    due_date=task.due_date,
                    priority=task.priority or "MEDIUM",
                    user_id=user_id,
                    case_id=task.case_id,
                )
                await self.db.flush()

        return task

    async def update_task(self, task: Task, data: TaskUpdate) -> Task:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(task, key, value)
        await self.db.flush()
        return task

    async def complete_task(self, task: Task, user_id: str) -> Task:
        task.status = "COMPLETED"
        task.completed_by = user_id
        task.completed_at = datetime.now(timezone.utc)
        await self.db.flush()
        return task

    async def delete_task(self, task: Task) -> None:
        task.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()
