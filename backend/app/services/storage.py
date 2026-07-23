from io import BytesIO
from typing import BinaryIO

try:
    from minio import Minio
    from minio.error import S3Error
    HAS_MINIO = True
except ImportError:
    HAS_MINIO = False


class StorageService:
    def __init__(self):
        self.client = None
        self.bucket = "harbor-documents"
        if HAS_MINIO:
            from app.config import settings
            self.client = Minio(
                endpoint=settings.minio_endpoint,
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key,
                secure=settings.minio_secure,
            )
            self.bucket = settings.minio_bucket
            self._ensure_bucket()

    def _ensure_bucket(self):
        if not self.client:
            return
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except Exception:
            pass

    async def upload(self, path: str, content: bytes, mime_type: str) -> None:
        if not self.client:
            raise RuntimeError("File storage is not configured")
        self.client.put_object(bucket_name=self.bucket, object_name=path, data=BytesIO(content), length=len(content), content_type=mime_type)

    async def download(self, path: str) -> BinaryIO:
        if not self.client:
            raise RuntimeError("File storage is not configured")
        response = self.client.get_object(bucket_name=self.bucket, object_name=path)
        return BytesIO(response.read())

    async def delete(self, path: str) -> None:
        if not self.client:
            return
        self.client.remove_object(bucket_name=self.bucket, object_name=path)

    async def get_presigned_url(self, path: str, expires: int = 3600) -> str:
        if not self.client:
            return ""
        return self.client.presigned_get_object(bucket_name=self.bucket, object_name=path, expires=expires)
