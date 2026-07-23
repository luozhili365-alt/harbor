from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TaskBase(BaseModel):
    case_id: Optional[str] = None
    assigned_to: Optional[str] = None
    task_type: str = Field(..., description="DEADLINE | FOLLOW_UP | DOC_REQUEST | CUSTOMS_QUERY | REVIEW | PAYMENT | GENERAL")
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    priority: str = "NORMAL"
    due_date: datetime
    reminder_before: Optional[str] = None
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    case_id: Optional[str] = None
    assigned_to: Optional[str] = None
    task_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    reminder_before: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_rule: Optional[str] = None


class TaskResponse(TaskBase):
    id: str
    status: str
    reminded_at: Optional[list[datetime]] = None
    created_by: Optional[str] = None
    completed_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    overdue_count: int = 0
    cursor: Optional[str] = None
