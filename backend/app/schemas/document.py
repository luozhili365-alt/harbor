from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentBase(BaseModel):
    case_id: Optional[str] = None
    doc_type: str = Field(..., description="INVOICE | PACKING_LIST | BILL_OF_LADING | CERT_OF_ORIGIN | CUSTOMS_DECLARATION | PERMIT | LICENSE | CONTRACT | CORRESPONDENCE | OTHER")
    source: str = Field(default="MANUAL_UPLOAD", description="EMAIL_ATTACHMENT | MANUAL_UPLOAD | SYSTEM_GENERATED | CUSTOMS_DOWNLOAD")


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    case_id: Optional[str] = None
    doc_type: Optional[str] = None
    is_verified: Optional[bool] = None
    extracted_data: Optional[dict] = None
    extraction_confidences: Optional[dict] = None


class DocumentResponse(BaseModel):
    id: str
    case_id: Optional[str] = None
    filename: str
    original_name: str
    storage_path: str
    mime_type: str
    size_bytes: Optional[int] = None
    doc_type: str
    source: str
    extracted_data: Optional[dict] = None
    extraction_confidences: Optional[dict] = None
    is_verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    ocr_text: Optional[str] = None
    ocr_status: str
    ocr_engine: Optional[str] = None
    sha256_hash: Optional[str] = None
    uploaded_by: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    cursor: Optional[str] = None
