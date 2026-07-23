from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.document import DocumentUpdate, DocumentResponse, DocumentListResponse
from app.services.document import DocumentService
from app.services.storage import StorageService

router = APIRouter(prefix="/documents", tags=["documents"])


def get_storage() -> StorageService:
    return StorageService()


def get_document_service(
    db: AsyncSession = Depends(get_db),
    storage: StorageService = Depends(get_storage),
) -> DocumentService:
    return DocumentService(db, storage)


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    case_id: str | None = Query(None),
    doc_type: str | None = Query(None),
    cursor: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    service: DocumentService = Depends(get_document_service),
    current_user: User = Depends(get_current_user),
):
    return await service.list_documents(case_id=case_id, doc_type=doc_type, cursor=cursor, limit=limit)


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    case_id: str | None = Form(None),
    doc_type: str = Form("OTHER"),
    service: DocumentService = Depends(get_document_service),
    current_user: User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件名为空")

    return await service.upload_document(
        file=file.file,
        original_name=file.filename,
        mime_type=file.content_type or "application/octet-stream",
        case_id=case_id,
        doc_type=doc_type,
        source="MANUAL_UPLOAD",
        user_id=current_user.id,
    )


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: str,
    service: DocumentService = Depends(get_document_service),
    current_user: User = Depends(get_current_user),
):
    doc = await service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    return doc


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: str,
    service: DocumentService = Depends(get_document_service),
    current_user: User = Depends(get_current_user),
):
    doc = await service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    stream, filename, mime_type = await service.get_download_stream(doc)
    return StreamingResponse(
        stream,
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{doc_id}/preview")
async def preview_document(
    doc_id: str,
    service: DocumentService = Depends(get_document_service),
    current_user: User = Depends(get_current_user),
):
    doc = await service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    storage = StorageService()
    url = await storage.get_presigned_url(doc.storage_path, expires=3600)
    return {"url": url, "mime_type": doc.mime_type, "original_name": doc.original_name}


@router.put("/{doc_id}", response_model=DocumentResponse)
async def update_document(
    doc_id: str,
    data: DocumentUpdate,
    service: DocumentService = Depends(get_document_service),
    current_user: User = Depends(get_current_user),
):
    doc = await service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    return await service.update_document(doc, data, current_user.id)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: str,
    service: DocumentService = Depends(get_document_service),
    current_user: User = Depends(get_current_user),
):
    doc = await service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    await service.delete_document(doc)
