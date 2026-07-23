from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.schemas.auth import LoginRequest, TokenResponse


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, email: str, password: str) -> User | None:
        import uuid
        result = await self.db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            return None
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=email.split("@")[0],
            password_hash=hash_password(password),
            role="broker",
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def login(self, request: LoginRequest) -> TokenResponse | None:
        result = await self.db.execute(
            select(User).where(User.email == request.email, User.is_active == True)
        )
        user = result.scalar_one_or_none()
        if not user or not verify_password(request.password, user.password_hash):
            return None

        # Update last login
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()

        access_token = create_access_token(data={"sub": user.id, "role": user.role})
        refresh_token = create_refresh_token(data={"sub": user.id})
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def refresh(self, refresh_token: str) -> TokenResponse | None:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None

        user_id = payload.get("sub")
        result = await self.db.execute(
            select(User).where(User.id == user_id, User.is_active == True)
        )
        user = result.scalar_one_or_none()
        if not user:
            return None

        access_token = create_access_token(data={"sub": user.id, "role": user.role})
        new_refresh_token = create_refresh_token(data={"sub": user.id})
        return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)

    async def get_me(self, user: User) -> dict:
        from app.schemas.auth import UserResponse
        return UserResponse.model_validate(user).model_dump()

    async def change_password(self, user: User, current_password: str, new_password: str) -> bool:
        if not verify_password(current_password, user.password_hash):
            return False
        user.password_hash = hash_password(new_password)
        await self.db.flush()
        return True
