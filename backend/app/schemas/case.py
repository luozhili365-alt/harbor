from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


# --- Case Item Schemas ---

class CaseItemBase(BaseModel):
    sequence_no: int
    product_name: str = Field(..., max_length=500)
    product_name_en: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    specification: Optional[str] = None
    hs_code: Optional[str] = None
    hs_code_confidence: Optional[float] = None
    declaration_elements: Optional[dict] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    currency: str = "USD"
    duty_rate: Optional[Decimal] = None
    vat_rate: Optional[Decimal] = Decimal("13.0")
    consumption_tax_rate: Optional[Decimal] = None
    country_of_origin: Optional[str] = None
    requires_permit: bool = False
    permit_type: Optional[str] = None
    requires_ciq: bool = False


class CaseItemCreate(CaseItemBase):
    pass


class CaseItemUpdate(BaseModel):
    sequence_no: Optional[int] = None
    product_name: Optional[str] = None
    product_name_en: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    specification: Optional[str] = None
    hs_code: Optional[str] = None
    hs_code_confidence: Optional[float] = None
    declaration_elements: Optional[dict] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    currency: Optional[str] = None
    duty_rate: Optional[Decimal] = None
    vat_rate: Optional[Decimal] = None
    consumption_tax_rate: Optional[Decimal] = None
    country_of_origin: Optional[str] = None
    requires_permit: Optional[bool] = None
    permit_type: Optional[str] = None
    requires_ciq: Optional[bool] = None


class CaseItemResponse(CaseItemBase):
    id: str
    case_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Case Schemas ---

VALID_CASE_STATUSES = [
    "DRAFT", "DOCUMENTS_COLLECTING", "READY", "SUBMITTED",
    "UNDER_REVIEW", "QUERY_RAISED", "AMENDMENT_NEEDED",
    "INSPECTION", "CLEARED", "CLOSED", "REJECTED", "CANCELLED",
]

VALID_STATUS_TRANSITIONS = {
    "DRAFT": ["DOCUMENTS_COLLECTING", "READY", "CANCELLED"],
    "DOCUMENTS_COLLECTING": ["READY", "DRAFT", "CANCELLED"],
    "READY": ["SUBMITTED", "DRAFT", "CANCELLED"],
    "SUBMITTED": ["UNDER_REVIEW", "CANCELLED"],
    "UNDER_REVIEW": ["QUERY_RAISED", "INSPECTION", "CLEARED", "REJECTED", "CANCELLED"],
    "QUERY_RAISED": ["AMENDMENT_NEEDED", "UNDER_REVIEW", "CANCELLED"],
    "AMENDMENT_NEEDED": ["UNDER_REVIEW", "READY", "CANCELLED"],
    "INSPECTION": ["CLEARED", "QUERY_RAISED", "CANCELLED"],
    "CLEARED": ["CLOSED"],
    "CLOSED": [],
    "REJECTED": ["DRAFT", "CLOSED"],
    "CANCELLED": ["CLOSED"],
}


class CaseBase(BaseModel):
    type: str = Field(..., pattern="^(IMPORT|EXPORT)$")
    client_id: str
    assigned_to: Optional[str] = None
    supervision_mode: Optional[str] = None
    transaction_method: Optional[str] = None
    transport_mode: Optional[str] = None
    port_of_entry: Optional[str] = None
    port_of_departure: Optional[str] = None
    country_of_origin: Optional[str] = None
    country_of_destination: Optional[str] = None
    trade_country: Optional[str] = None
    declared_currency: str = "USD"
    declared_value: Optional[Decimal] = None
    freight_amount: Optional[Decimal] = None
    insurance_amount: Optional[Decimal] = None
    duties_estimated: Optional[Decimal] = None
    vat_estimated: Optional[Decimal] = None
    consumption_tax: Optional[Decimal] = None
    bill_of_lading: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    container_numbers: Optional[list[str]] = None
    estimated_arrival: Optional[datetime] = None
    priority: str = "NORMAL"
    declaration_number: Optional[str] = None
    internal_notes: Optional[str] = None
    tags: Optional[list[str]] = None
    deadline_date: Optional[datetime] = None


class CaseCreate(CaseBase):
    pass


class CaseUpdate(BaseModel):
    type: Optional[str] = None
    client_id: Optional[str] = None
    assigned_to: Optional[str] = None
    supervision_mode: Optional[str] = None
    transaction_method: Optional[str] = None
    transport_mode: Optional[str] = None
    port_of_entry: Optional[str] = None
    port_of_departure: Optional[str] = None
    country_of_origin: Optional[str] = None
    country_of_destination: Optional[str] = None
    trade_country: Optional[str] = None
    declared_currency: Optional[str] = None
    declared_value: Optional[Decimal] = None
    freight_amount: Optional[Decimal] = None
    insurance_amount: Optional[Decimal] = None
    duties_estimated: Optional[Decimal] = None
    vat_estimated: Optional[Decimal] = None
    consumption_tax: Optional[Decimal] = None
    bill_of_lading: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    container_numbers: Optional[list[str]] = None
    estimated_arrival: Optional[datetime] = None
    priority: Optional[str] = None
    declaration_number: Optional[str] = None
    internal_notes: Optional[str] = None
    tags: Optional[list[str]] = None
    deadline_date: Optional[datetime] = None


class CaseStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None


class CaseResponse(CaseBase):
    id: str
    case_no: str
    status: str
    ai_risk_score: Optional[float] = None
    ai_risk_factors: Optional[dict] = None
    duties_paid: Optional[Decimal] = None
    vat_paid: Optional[Decimal] = None
    actual_arrival: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    cleared_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    items: list[CaseItemResponse] = []

    model_config = {"from_attributes": True}


class CaseListResponse(BaseModel):
    items: list[CaseResponse]
    total: int
    cursor: Optional[str] = None


class CaseSummaryResponse(BaseModel):
    id: str
    case_no: str
    type: str
    status: str
    client_name: str
    priority: str
    bill_of_lading: Optional[str] = None
    deadline_date: Optional[datetime] = None
    assigned_to_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
