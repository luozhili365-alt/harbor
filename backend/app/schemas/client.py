from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ClientBase(BaseModel):
    company_name: str = Field(..., max_length=200)
    company_name_en: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_wechat: Optional[str] = None
    usc_code: Optional[str] = None
    customs_code: Optional[str] = None
    customs_grade: Optional[str] = None
    tax_id: Optional[str] = None
    address: Optional[str] = None
    billing_email: Optional[str] = None
    service_fee_standard: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    company_name: Optional[str] = None
    company_name_en: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_wechat: Optional[str] = None
    usc_code: Optional[str] = None
    customs_code: Optional[str] = None
    customs_grade: Optional[str] = None
    tax_id: Optional[str] = None
    address: Optional[str] = None
    billing_email: Optional[str] = None
    service_fee_standard: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


class ClientResponse(ClientBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientListResponse(BaseModel):
    items: list[ClientResponse]
    total: int
    cursor: Optional[str] = None
