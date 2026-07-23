from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EmailUpdate(BaseModel):
    status: Optional[str] = None
    linked_case_id: Optional[str] = None
    linked_manually: Optional[bool] = None
    notes: Optional[str] = None


class ComposeEmailRequest(BaseModel):
    to_addrs: list[str]
    cc_addrs: Optional[list[str]] = None
    subject: str
    body_text: str
    body_html: Optional[str] = None
    case_id: Optional[str] = None


class ReplyEmailRequest(BaseModel):
    body_text: str
    body_html: Optional[str] = None
    cc_addrs: Optional[list[str]] = None


class EmailResponse(BaseModel):
    id: str
    message_id: Optional[str] = None
    thread_id: Optional[str] = None
    from_addr: str
    from_name: Optional[str] = None
    to_addrs: list[str]
    cc_addrs: Optional[list[str]] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    snippet: Optional[str] = None
    direction: str
    has_attachments: bool
    attachment_ids: Optional[list[str]] = None
    ai_processed: bool
    ai_category: Optional[str] = None
    ai_priority: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_action_needed: Optional[bool] = None
    ai_suggested_case_id: Optional[str] = None
    status: str
    linked_case_id: Optional[str] = None
    linked_manually: Optional[bool] = None
    forwarded_by: Optional[str] = None
    notes: Optional[str] = None
    received_at: datetime
    ingested_at: datetime

    model_config = {"from_attributes": True}


class EmailListResponse(BaseModel):
    items: list[EmailResponse]
    total: int
    unread_count: int = 0
    cursor: Optional[str] = None
