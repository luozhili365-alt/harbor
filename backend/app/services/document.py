import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional, BinaryIO
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListResponse
from app.services.storage import StorageService


class DocumentService:
    def __init__(self, db: AsyncSession, storage: StorageService):
        self.db = db
        self.storage = storage

    async def list_documents(
        self, case_id: Optional[str] = None, doc_type: Optional[str] = None,
        cursor: Optional[str] = None, limit: int = 20,
    ) -> DocumentListResponse:
        query = select(Document).where(Document.deleted_at.is_(None))

        if case_id:
            query = query.where(Document.case_id == case_id)
        if doc_type:
            query = query.where(Document.doc_type == doc_type)

        query = query.order_by(Document.created_at.desc()).limit(limit + 1)
        result = await self.db.execute(query)
        docs = result.scalars().all()

        has_more = len(docs) > limit
        items = docs[:limit]
        next_cursor = items[-1].id if has_more else None

        count_query = select(func.count()).select_from(Document).where(Document.deleted_at.is_(None))
        if case_id:
            count_query = count_query.where(Document.case_id == case_id)
        total = (await self.db.execute(count_query)).scalar() or 0

        return DocumentListResponse(
            items=[DocumentResponse.model_validate(d) for d in items],
            total=total,
            cursor=next_cursor,
        )

    async def get_document(self, doc_id: str) -> Document | None:
        result = await self.db.execute(
            select(Document).where(Document.id == doc_id, Document.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def upload_document(
        self, file: BinaryIO, original_name: str, mime_type: str,
        case_id: Optional[str] = None, doc_type: str = "OTHER",
        source: str = "MANUAL_UPLOAD", user_id: Optional[str] = None,
    ) -> Document:
        # Read file content and compute hash
        content = file.read()
        sha256_hash = hashlib.sha256(content).hexdigest()
        size_bytes = len(content)

        # Check for duplicate
        existing = await self.db.execute(
            select(Document).where(
                Document.sha256_hash == sha256_hash,
                Document.case_id == case_id,
                Document.deleted_at.is_(None),
            )
        )
        dup = existing.scalar_one_or_none()
        if dup:
            return dup  # Return existing document instead of duplicating

        # Generate storage filename
        ext = original_name.rsplit(".", 1)[-1] if "." in original_name else ""
        storage_filename = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())
        storage_path = f"documents/{datetime.now(timezone.utc).strftime('%Y/%m')}/{storage_filename}"

        # Upload to MinIO
        await self.storage.upload(storage_path, content, mime_type)

        # Create DB record
        doc = Document(
            case_id=case_id,
            filename=storage_filename,
            original_name=original_name,
            storage_path=storage_path,
            mime_type=mime_type,
            size_bytes=size_bytes,
            doc_type=doc_type,
            source=source,
            sha256_hash=sha256_hash,
            uploaded_by=user_id,
        )
        self.db.add(doc)
        await self.db.flush()
        return doc

    async def update_document(self, doc: Document, data: DocumentUpdate, user_id: str) -> Document:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if key == "is_verified" and value:
                setattr(doc, "verified_by", user_id)
                setattr(doc, "verified_at", datetime.now(timezone.utc))
            setattr(doc, key, value)
        await self.db.flush()
        return doc

    async def delete_document(self, doc: Document) -> None:
        doc.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def get_download_stream(self, doc: Document) -> tuple[BinaryIO, str, str]:
        """Returns (stream, filename, mime_type)"""
        stream = await self.storage.download(doc.storage_path)
        return stream, doc.original_name, doc.mime_type

    async def update_ocr_text(self, doc: Document, ocr_text: str, engine: str) -> None:
        doc.ocr_text = ocr_text
        doc.ocr_status = "DONE"
        doc.ocr_engine = engine
        await self.db.flush()

    async def update_extracted_data(self, doc: Document, data: dict, confidences: dict) -> None:
        doc.extracted_data = data
        doc.extraction_confidences = confidences
        await self.db.flush()
