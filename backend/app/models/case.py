import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Text, Numeric, Float, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False, index=True)
    assigned_to: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)

    # Declaration basics
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # IMPORT | EXPORT
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT", index=True)

    # China customs specific
    supervision_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    transaction_method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    transport_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    port_of_entry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    port_of_departure: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country_of_origin: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country_of_destination: Mapped[str | None] = mapped_column(String(100), nullable=True)
    trade_country: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Financial
    declared_currency: Mapped[str] = mapped_column(String(3), default="USD")
    declared_value: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    freight_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    insurance_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    duties_estimated: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    vat_estimated: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    consumption_tax: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    duties_paid: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    vat_paid: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    # Shipping
    bill_of_lading: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    vessel_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    voyage_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    container_numbers: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    estimated_arrival: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_arrival: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Case metadata
    priority: Mapped[str] = mapped_column(String(10), default="NORMAL")
    declaration_number: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    ai_risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_risk_factors: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)

    # Timestamps
    deadline_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    # Relationships
    items: Mapped[list["CaseItem"]] = relationship("CaseItem", back_populates="case", lazy="selectin",
                                                     order_by="CaseItem.sequence_no")
    client: Mapped["Client"] = relationship("Client", lazy="selectin", foreign_keys=[client_id])

    def __repr__(self) -> str:
        return f"<Case {self.case_no} ({self.status})>"


class CaseItem(Base):
    __tablename__ = "case_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)

    # Product info
    product_name: Mapped[str] = mapped_column(String(500), nullable=False)
    product_name_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(200), nullable=True)
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    specification: Mapped[str | None] = mapped_column(Text, nullable=True)

    # HS Classification
    hs_code: Mapped[str | None] = mapped_column(String(13), nullable=True, index=True)
    hs_code_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    declaration_elements: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Quantities
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(15, 4), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(15, 4), nullable=True)
    total_price: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Tax rates
    duty_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    vat_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), default=Decimal("13.0"))
    consumption_tax_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)

    # Origin
    country_of_origin: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Special requirements
    requires_permit: Mapped[bool] = mapped_column(Boolean, default=False)
    permit_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    requires_ciq: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    case: Mapped["Case"] = relationship("Case", back_populates="items")

    def __repr__(self) -> str:
        return f"<CaseItem #{self.sequence_no} {self.product_name[:30]}>"
