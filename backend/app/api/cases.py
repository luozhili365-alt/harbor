from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.case import (
    CaseCreate, CaseUpdate, CaseStatusUpdate,
    CaseResponse, CaseListResponse, CaseSummaryResponse,
    CaseItemCreate, CaseItemUpdate, CaseItemResponse,
    VALID_STATUS_TRANSITIONS,
)
from app.schemas.activity import ActivityLogListResponse, ActivityLogResponse
from app.services.case import CaseService

router = APIRouter(prefix="/cases", tags=["cases"])


@router.get("/", response_model=CaseListResponse)
async def list_cases(
    q: str | None = Query(None),
    status: str | None = Query(None),
    client_id: str | None = Query(None),
    assigned_to: str | None = Query(None),
    type: str | None = Query(None),
    priority: str | None = Query(None),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    return await service.list_cases(
        q=q, status=status, client_id=client_id, assigned_to=assigned_to,
        type=type, priority=priority, cursor=cursor, limit=limit,
        sort_by=sort_by, sort_order=sort_order,
    )


@router.post("/", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    data: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    return await service.create_case(data, current_user.id)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    case = await service.get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件不存在")
    return case


@router.put("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: str,
    data: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    case = await service.get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件不存在")
    return await service.update_case(case, data, current_user.id)


@router.put("/{case_id}/status", response_model=CaseResponse)
async def update_case_status(
    case_id: str,
    data: CaseStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    case = await service.get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件不存在")

    try:
        return await service.update_status(case, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    case = await service.get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件不存在")
    await service.delete_case(case, current_user.id)


# --- Timeline ---

@router.get("/{case_id}/timeline")
async def get_case_timeline(
    case_id: str,
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    case = await service.get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件不存在")
    return {"items": await service.get_timeline(case_id, cursor=cursor, limit=limit)}


# --- Case Items ---

@router.post("/{case_id}/items", response_model=CaseItemResponse, status_code=status.HTTP_201_CREATED)
async def add_case_item(
    case_id: str,
    data: CaseItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    case = await service.get_case(case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="案件不存在")
    return await service.add_item(case_id, data)


@router.put("/{case_id}/items/{item_id}", response_model=CaseItemResponse)
async def update_case_item(
    case_id: str,
    item_id: str,
    data: CaseItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    item = await service.get_item(item_id)
    if not item or str(item.case_id) != case_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品项不存在")
    return await service.update_item(item, data)


@router.delete("/{case_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case_item(
    case_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = CaseService(db)
    item = await service.get_item(item_id)
    if not item or str(item.case_id) != case_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品项不存在")
    await service.delete_item(item)
