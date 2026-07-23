from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
from app.services.task import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    case_id: str | None = Query(None),
    assigned_to: str | None = Query(None),
    status: str | None = Query(None),
    cursor: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TaskService(db)
    return await service.list_tasks(
        case_id=case_id, assigned_to=assigned_to, status=status,
        cursor=cursor, limit=limit,
    )


@router.get("/suggestions")
async def get_suggestions(db: AsyncSession = Depends(get_db)):
    """AI-powered task suggestions from emails, cases, and documents."""
    from app.services.task import TaskService
    service = TaskService(db)
    suggestions = await service.get_suggestions()
    return {"suggestions": suggestions}


@router.get("/due-soon")
async def get_due_soon(
    hours: int = Query(48, ge=1, le=720),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TaskService(db)
    tasks = await service.get_due_soon(hours=hours, limit=limit)
    return {"items": [TaskResponse.model_validate(t).model_dump() for t in tasks]}


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TaskService(db)
    return await service.create_task(data, current_user.id)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TaskService(db)
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TaskService(db)
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return await service.update_task(task, data)


@router.put("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TaskService(db)
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return await service.complete_task(task, current_user.id)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TaskService(db)
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    await service.delete_task(task)
