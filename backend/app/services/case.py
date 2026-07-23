from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from app.models.case import Case, CaseItem
from app.models.client import Client
from app.models.user import User
from app.models.activity import ActivityLog
from app.schemas.case import (
    CaseCreate, CaseUpdate, CaseStatusUpdate, CaseResponse, CaseListResponse,
    CaseItemCreate, CaseItemUpdate, CaseItemResponse,
    VALID_STATUS_TRANSITIONS,
)


class CaseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_case_no(self) -> str:
        year = datetime.now(timezone.utc).strftime("%Y")
        result = await self.db.execute(
            select(func.count()).select_from(Case).where(
                Case.case_no.like(f"CB-{year}-%")
            )
        )
        count = (result.scalar() or 0) + 1
        return f"CB-{year}-{count:04d}"

    async def _log_activity(
        self, case_id: str, user_id: Optional[str], activity_type: str,
        title: Optional[str] = None, content: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        log = ActivityLog(
            case_id=case_id,
            user_id=user_id,
            activity_type=activity_type,
            title=title,
            content=content,
            metadata=metadata,
        )
        self.db.add(log)

    async def list_cases(
        self,
        q: Optional[str] = None,
        status: Optional[str] = None,
        client_id: Optional[str] = None,
        assigned_to: Optional[str] = None,
        type: Optional[str] = None,
        priority: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> CaseListResponse:
        query = select(Case).where(Case.deleted_at.is_(None))

        if q:
            query = query.where(
                or_(
                    Case.case_no.ilike(f"%{q}%"),
                    Case.bill_of_lading.ilike(f"%{q}%"),
                    Case.declaration_number.ilike(f"%{q}%"),
                )
            )
        if status:
            query = query.where(Case.status == status)
        if client_id:
            query = query.where(Case.client_id == client_id)
        if assigned_to:
            query = query.where(Case.assigned_to == assigned_to)
        if type:
            query = query.where(Case.type == type)
        if priority:
            query = query.where(Case.priority == priority)

        # Cursor pagination
        if cursor:
            if sort_order == "desc":
                query = query.where(Case.id < cursor)
            else:
                query = query.where(Case.id > cursor)

        # Sort
        sort_col = getattr(Case, sort_by, Case.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_col.desc())
        else:
            query = query.order_by(sort_col.asc())

        query = query.options(selectinload(Case.items), selectinload(Case.client)).limit(limit + 1)
        result = await self.db.execute(query)
        cases = result.unique().scalars().all()

        has_more = len(cases) > limit
        items = cases[:limit]
        next_cursor = items[-1].id if has_more else None

        # Total count
        count_query = select(func.count()).select_from(Case).where(Case.deleted_at.is_(None))
        if status:
            count_query = count_query.where(Case.status == status)
        if client_id:
            count_query = count_query.where(Case.client_id == client_id)
        total = (await self.db.execute(count_query)).scalar() or 0

        return CaseListResponse(
            items=[CaseResponse.model_validate(c) for c in items],
            total=total,
            cursor=next_cursor,
        )

    async def get_case(self, case_id: str) -> Case | None:
        result = await self.db.execute(
            select(Case)
            .where(Case.id == case_id, Case.deleted_at.is_(None))
            .options(selectinload(Case.items), selectinload(Case.client))
        )
        return result.unique().scalar_one_or_none()

    async def create_case(self, data: CaseCreate, user_id: str) -> Case:
        case_no = await self._generate_case_no()
        case = Case(case_no=case_no, created_by=user_id, **data.model_dump())
        self.db.add(case)
        await self.db.flush()

        await self._log_activity(
            case_id=case.id,
            user_id=user_id,
            activity_type="CASE_CREATED",
            title=f"创建案件 {case_no}",
        )
        return case

    async def update_case(self, case: Case, data: CaseUpdate, user_id: str) -> Case:
        update_data = data.model_dump(exclude_unset=True)
        changes = []
        for key, value in update_data.items():
            old_value = getattr(case, key, None)
            if old_value != value:
                changes.append({"field": key, "from": str(old_value), "to": str(value)})
            setattr(case, key, value)
        case.updated_at = datetime.now(timezone.utc)
        await self.db.flush()

        if changes:
            await self._log_activity(
                case_id=case.id,
                user_id=user_id,
                activity_type="CASE_UPDATED",
                title=f"更新案件信息",
                metadata={"changes": changes},
            )
        return case

    async def update_status(self, case: Case, data: CaseStatusUpdate, user_id: str) -> Case:
        new_status = data.status

        # Validate transition
        allowed = VALID_STATUS_TRANSITIONS.get(case.status, [])
        if new_status not in allowed:
            raise ValueError(f"Cannot transition from {case.status} to {new_status}. Allowed: {allowed}")

        old_status = case.status
        case.status = new_status
        case.updated_at = datetime.now(timezone.utc)

        # Set timestamp based on new status
        if new_status == "SUBMITTED":
            case.submitted_at = datetime.now(timezone.utc)
        elif new_status == "CLEARED":
            case.cleared_at = datetime.now(timezone.utc)
        elif new_status == "CLOSED":
            case.closed_at = datetime.now(timezone.utc)

        await self.db.flush()

        await self._log_activity(
            case_id=case.id,
            user_id=user_id,
            activity_type="STATUS_CHANGED",
            title=f"状态变更: {old_status} → {new_status}",
            content=data.note,
            metadata={"from": old_status, "to": new_status},
        )
        return case

    async def delete_case(self, case: Case, user_id: str) -> None:
        case.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self._log_activity(
            case_id=case.id,
            user_id=user_id,
            activity_type="CASE_DELETED",
            title=f"删除案件",
        )

    # --- Case Items ---

    async def add_item(self, case_id: str, data: CaseItemCreate) -> CaseItem:
        item = CaseItem(case_id=case_id, **data.model_dump())
        self.db.add(item)
        await self.db.flush()
        return item

    async def update_item(self, item: CaseItem, data: CaseItemUpdate) -> CaseItem:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item, key, value)
        await self.db.flush()
        return item

    async def delete_item(self, item: CaseItem) -> None:
        await self.db.delete(item)
        await self.db.flush()

    async def get_item(self, item_id: str) -> CaseItem | None:
        result = await self.db.execute(select(CaseItem).where(CaseItem.id == item_id))
        return result.scalar_one_or_none()

    # --- Activity Log ---

    async def get_timeline(
        self, case_id: str, cursor: Optional[str] = None, limit: int = 50
    ) -> list[dict]:
        query = (
            select(ActivityLog)
            .where(ActivityLog.case_id == case_id)
            .order_by(ActivityLog.created_at.desc())
        )
        if cursor:
            query = query.where(ActivityLog.id < cursor)
        query = query.limit(limit + 1)

        result = await self.db.execute(query)
        logs = result.scalars().all()

        from app.schemas.activity import ActivityLogResponse
        return [ActivityLogResponse.model_validate(log).model_dump() for log in logs[:limit]]
