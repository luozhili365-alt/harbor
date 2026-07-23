from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, text
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.case import Case
from app.models.client import Client
from app.models.document import Document
from app.models.email import Email

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def unified_search(
    q: str = Query(..., min_length=1),
    scope: str = Query("all", description="all | cases | clients | documents | emails"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unified full-text search across all entities."""
    results = {"cases": [], "clients": [], "documents": [], "emails": []}

    if scope in ("all", "cases"):
        case_query = (
            select(Case)
            .where(
                Case.deleted_at.is_(None),
                or_(
                    Case.case_no.ilike(f"%{q}%"),
                    Case.bill_of_lading.ilike(f"%{q}%"),
                    Case.declaration_number.ilike(f"%{q}%"),
                    Case.internal_notes.ilike(f"%{q}%"),
                ),
            )
            .order_by(Case.updated_at.desc())
            .limit(limit)
        )
        case_result = await db.execute(case_query)
        results["cases"] = [
            {
                "id": c.id, "case_no": c.case_no, "status": c.status,
                "type": c.type, "bill_of_lading": c.bill_of_lading,
                "client_name": None,  # Would need join
            }
            for c in case_result.scalars().all()
        ]

    if scope in ("all", "clients"):
        client_query = (
            select(Client)
            .where(
                Client.deleted_at.is_(None),
                or_(
                    Client.company_name.ilike(f"%{q}%"),
                    Client.company_name_en.ilike(f"%{q}%"),
                    Client.contact_person.ilike(f"%{q}%"),
                    Client.customs_code.ilike(f"%{q}%"),
                ),
            )
            .limit(limit)
        )
        client_result = await db.execute(client_query)
        results["clients"] = [
            {"id": c.id, "company_name": c.company_name, "contact_person": c.contact_person}
            for c in client_result.scalars().all()
        ]

    if scope in ("all", "documents"):
        doc_query = (
            select(Document)
            .where(
                Document.deleted_at.is_(None),
                or_(
                    Document.original_name.ilike(f"%{q}%"),
                    Document.ocr_text.ilike(f"%{q}%"),
                ),
            )
            .order_by(Document.created_at.desc())
            .limit(limit)
        )
        doc_result = await db.execute(doc_query)
        results["documents"] = [
            {"id": d.id, "original_name": d.original_name, "doc_type": d.doc_type, "case_id": d.case_id}
            for d in doc_result.scalars().all()
        ]

    if scope in ("all", "emails"):
        email_query = (
            select(Email)
            .where(
                or_(
                    Email.subject.ilike(f"%{q}%"),
                    Email.body_text.ilike(f"%{q}%"),
                    Email.from_addr.ilike(f"%{q}%"),
                    Email.from_name.ilike(f"%{q}%"),
                ),
            )
            .order_by(Email.received_at.desc())
            .limit(limit)
        )
        email_result = await db.execute(email_query)
        results["emails"] = [
            {"id": e.id, "subject": e.subject, "from_addr": e.from_addr,
             "from_name": e.from_name, "received_at": e.received_at.isoformat() if e.received_at else None}
            for e in email_result.scalars().all()
        ]

    return results
