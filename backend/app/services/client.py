from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, ClientListResponse


class ClientService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_clients(
        self, q: Optional[str] = None, cursor: Optional[str] = None, limit: int = 20
    ) -> ClientListResponse:
        query = select(Client).where(Client.deleted_at.is_(None))

        if q:
            query = query.where(
                or_(
                    Client.company_name.ilike(f"%{q}%"),
                    Client.company_name_en.ilike(f"%{q}%"),
                    Client.contact_person.ilike(f"%{q}%"),
                    Client.customs_code.ilike(f"%{q}%"),
                )
            )

        if cursor:
            query = query.where(Client.id > cursor)

        query = query.order_by(Client.company_name.asc()).limit(limit + 1)
        result = await self.db.execute(query)
        clients = result.scalars().all()

        has_more = len(clients) > limit
        items = clients[:limit]
        next_cursor = items[-1].id if has_more else None

        # Get total count
        count_query = select(func.count()).select_from(Client).where(Client.deleted_at.is_(None))
        if q:
            count_query = count_query.where(
                or_(
                    Client.company_name.ilike(f"%{q}%"),
                    Client.contact_person.ilike(f"%{q}%"),
                )
            )
        total = (await self.db.execute(count_query)).scalar() or 0

        return ClientListResponse(
            items=[ClientResponse.model_validate(c) for c in items],
            total=total,
            cursor=next_cursor,
        )

    async def get_client(self, client_id: str) -> Client | None:
        result = await self.db.execute(
            select(Client).where(Client.id == client_id, Client.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def create_client(self, data: ClientCreate) -> Client:
        client = Client(**data.model_dump())
        self.db.add(client)
        await self.db.flush()
        return client

    async def update_client(self, client: Client, data: ClientUpdate) -> Client:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(client, key, value)
        client.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return client

    async def delete_client(self, client: Client) -> None:
        client.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()
