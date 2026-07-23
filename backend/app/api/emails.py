from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.email import EmailUpdate, EmailResponse, EmailListResponse
from app.services.email_service import EmailService

router = APIRouter(prefix="/emails", tags=["emails"])


@router.get("/", response_model=EmailListResponse)
async def list_emails(
    status: str | None = Query(None),
    case_id: str | None = Query(None),
    ai_category: str | None = Query(None),
    direction: str = Query("INBOUND"),
    q: str | None = Query(None),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EmailService(db)
    return await service.list_emails(
        status=status, case_id=case_id, ai_category=ai_category,
        direction=direction, q=q, cursor=cursor, limit=limit,
    )


@router.get("/{email_id}", response_model=EmailResponse)
async def get_email(
    email_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EmailService(db)
    email = await service.get_email(email_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邮件不存在")
    return email


@router.put("/{email_id}", response_model=EmailResponse)
async def update_email(
    email_id: str,
    data: EmailUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EmailService(db)
    email = await service.get_email(email_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邮件不存在")
    return await service.update_email(email, data)


@router.post("/{email_id}/link-case", response_model=EmailResponse)
async def link_email_to_case(
    email_id: str,
    case_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EmailService(db)
    email = await service.get_email(email_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邮件不存在")
    return await service.link_to_case(email, case_id, manual=True)


@router.post("/{email_id}/unlink", response_model=EmailResponse)
async def unlink_email(
    email_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EmailService(db)
    email = await service.get_email(email_id)
    if not email:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="邮件不存在")
    return await service.unlink_from_case(email)


@router.get("/thread/{thread_id}")
async def get_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = EmailService(db)
    emails = await service.get_thread(thread_id)
    return {"items": [EmailResponse.model_validate(e).model_dump() for e in emails]}
