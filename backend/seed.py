"""
Seed script: Creates an admin user and sample data for development.
Run with: python seed.py
"""
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings
from app.models.user import User
from app.models.client import Client
from app.models.case import Case, CaseItem
from app.core.security import hash_password


async def seed():
    engine = create_async_engine(settings.database_url, echo=False)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_maker() as db:
        # Check if already seeded
        from sqlalchemy import select, func
        result = await db.execute(select(func.count()).select_from(User))
        if (result.scalar() or 0) > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # Create admin user
        admin = User(
            name="管理员",
            email="admin@harbor.com",
            password_hash=hash_password("admin123"),
            role="admin",
            is_active=True,
        )
        db.add(admin)

        # Create broker user
        broker = User(
            name="张三",
            email="broker@harbor.com",
            password_hash=hash_password("broker123"),
            role="broker",
            is_active=True,
        )
        db.add(broker)
        await db.flush()

        # Create sample clients
        clients_data = [
            {
                "company_name": "索尼电子(深圳)有限公司",
                "company_name_en": "Sony Electronics (Shenzhen) Co., Ltd.",
                "contact_person": "李经理",
                "contact_phone": "13800138001",
                "contact_email": "lmg@sony.com.cn",
                "customs_code": "4403940001",
                "customs_grade": "高级认证",
            },
            {
                "company_name": "三菱电机(上海)有限公司",
                "company_name_en": "Mitsubishi Electric (Shanghai) Co., Ltd.",
                "contact_person": "王总监",
                "contact_phone": "13800138002",
                "contact_email": "wang@mitsubishi.com.cn",
                "customs_code": "3112940002",
                "customs_grade": "一般认证",
            },
            {
                "company_name": "东芝电子元器件(广州)有限公司",
                "company_name_en": "Toshiba Electronic Components (Guangzhou) Co., Ltd.",
                "contact_person": "陈经理",
                "contact_phone": "13800138003",
                "contact_email": "chen@toshiba.com.cn",
                "customs_code": "4401940003",
            },
        ]

        client_ids = []
        for cd in clients_data:
            client = Client(**cd)
            db.add(client)
            await db.flush()
            client_ids.append(client.id)

        # Create sample cases
        now = datetime.now(timezone.utc)

        cases_data = [
            {
                "case_no": "CB-2026-0001",
                "client_id": client_ids[0],
                "assigned_to": broker.id,
                "type": "IMPORT",
                "status": "UNDER_REVIEW",
                "supervision_mode": "一般贸易",
                "transaction_method": "CIF",
                "transport_mode": "海运",
                "port_of_entry": "深圳海关",
                "country_of_origin": "日本",
                "declared_currency": "USD",
                "declared_value": 85000.00,
                "bill_of_lading": "SZX20260715001",
                "vessel_name": "EVER FORTUNE",
                "voyage_number": "V.123E",
                "estimated_arrival": now + timedelta(days=7),
                "priority": "HIGH",
                "deadline_date": now + timedelta(days=2),
                "created_by": broker.id,
                "submitted_at": now - timedelta(days=3),
            },
            {
                "case_no": "CB-2026-0002",
                "client_id": client_ids[1],
                "assigned_to": broker.id,
                "type": "IMPORT",
                "status": "DOCUMENTS_COLLECTING",
                "supervision_mode": "一般贸易",
                "transaction_method": "FOB",
                "transport_mode": "海运",
                "port_of_entry": "上海海关",
                "country_of_origin": "日本",
                "declared_currency": "JPY",
                "declared_value": 15000000.00,
                "bill_of_lading": "SHA20260720002",
                "vessel_name": "MOL ENDOWMENT",
                "voyage_number": "V.045W",
                "estimated_arrival": now + timedelta(days=14),
                "priority": "NORMAL",
                "deadline_date": now + timedelta(days=10),
                "created_by": broker.id,
            },
            {
                "case_no": "CB-2026-0003",
                "client_id": client_ids[2],
                "assigned_to": admin.id,
                "type": "EXPORT",
                "status": "READY",
                "supervision_mode": "一般贸易",
                "transaction_method": "FOB",
                "transport_mode": "海运",
                "port_of_departure": "广州海关",
                "country_of_destination": "日本",
                "declared_currency": "USD",
                "declared_value": 42000.00,
                "bill_of_lading": "GZ20260710003",
                "vessel_name": "COSCO SHIPPING",
                "voyage_number": "V.078E",
                "priority": "URGENT",
                "deadline_date": now + timedelta(days=1),
                "created_by": broker.id,
            },
        ]

        for i, cd in enumerate(cases_data):
            case = Case(**cd)
            db.add(case)
            await db.flush()

            # Add sample items
            if i == 0:
                items = [
                    CaseItem(
                        case_id=case.id,
                        sequence_no=1,
                        product_name="音响扬声器单元",
                        product_name_en="Speaker Driver Unit SP-500",
                        brand="Sony",
                        model="SP-500",
                        hs_code="8518.2900.00",
                        hs_code_confidence=0.92,
                        quantity=1000,
                        unit="个",
                        unit_price=50.00,
                        total_price=50000.00,
                        currency="USD",
                        duty_rate=10.0,
                        vat_rate=13.0,
                        country_of_origin="日本",
                    ),
                    CaseItem(
                        case_id=case.id,
                        sequence_no=2,
                        product_name="音频放大器模块",
                        product_name_en="Audio Amplifier Module PA-200",
                        brand="Sony",
                        model="PA-200",
                        hs_code="8518.4000.00",
                        hs_code_confidence=0.88,
                        quantity=500,
                        unit="个",
                        unit_price=70.00,
                        total_price=35000.00,
                        currency="USD",
                        duty_rate=10.0,
                        vat_rate=13.0,
                        country_of_origin="日本",
                    ),
                ]
                for item in items:
                    db.add(item)

        await db.commit()
        print("✅ Seed complete!")
        print("")
        print("Login credentials:")
        print("  Admin:  admin@harbor.com / admin123")
        print("  Broker: broker@harbor.com / broker123")
        print("")
        print(f"Created: 2 users, {len(client_ids)} clients, {len(cases_data)} cases")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
