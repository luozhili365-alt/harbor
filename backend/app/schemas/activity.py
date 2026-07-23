from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ActivityLogCreate(BaseModel):
    case_id: str
    activity_type: str
    title: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[dict] = None


class ActivityLogResponse(BaseModel):
    id: str
    case_id: str
    user_id: Optional[str] = None
    activity_type: str
    title: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityLogListResponse(BaseModel):
    items: list[ActivityLogResponse]
    total: int
    cursor: Optional[str] = None
