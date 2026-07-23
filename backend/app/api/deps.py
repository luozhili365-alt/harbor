from typing import Optional
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.security import decode_token
from app.models.user import User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current user from JWT, or return first active user as default."""
    if credentials:
        token = credentials.credentials
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")
            if user_id:
                result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
                user = result.scalar_one_or_none()
                if user:
                    return user

    # No valid token → return first active user as default
    result = await db.execute(select(User).where(User.is_active == True).limit(1))
    user = result.scalar_one_or_none()
    if user:
        return user

    # No users at all → create a default user that can be changed later
    import uuid, os
    from app.core.security import hash_password
    pwd = os.environ.get("DEFAULT_ADMIN_PASSWORD", str(uuid.uuid4()))
    user = User(
        id=str(uuid.uuid4()),
        name="默认管理员",
        email="admin@harbor.local",
        password_hash=hash_password(pwd),
        role="admin",
    )
    db.add(user)
    await db.flush()
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user
