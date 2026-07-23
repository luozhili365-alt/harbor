from pydantic import BaseModel
from typing import Optional, Any


class PaginationParams(BaseModel):
    cursor: Optional[str] = None
    limit: int = 20


class SearchParams(PaginationParams):
    q: Optional[str] = None
    status: Optional[str] = None
    sort_by: str = "created_at"
    sort_order: str = "desc"


class DashboardStats(BaseModel):
    active_cases: int
    unread_emails: int
    pending_tasks: int
    completed_this_month: int
    overdue_tasks: int
    cases_by_status: dict[str, int]
