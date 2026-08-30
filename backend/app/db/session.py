from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def auto_migrate_sqlite(conn):
    """
    Automatically adds missing columns to existing SQLite tables if schema was updated.
    """
    # Columns to check and add
    column_migrations = {
        "vehicles": [
            ("user_id", "INTEGER REFERENCES users(id)"),
            ("is_public", "BOOLEAN DEFAULT 0"),
            ("engine", "VARCHAR(100)"),
            ("current_engine_hours", "FLOAT DEFAULT 0.0"),
            ("purchase_date", "DATETIME"),
            ("oil_spec", "VARCHAR(200)"),
        ],
        "service_records": [
            ("to_tag", "VARCHAR(50)"),
            ("engine_hours", "FLOAT"),
            ("store", "VARCHAR(100)"),
            ("url", "VARCHAR(500)"),
        ],
        "service_items": [
            ("brand", "VARCHAR(100)"),
            ("unit", "VARCHAR(20) DEFAULT 'шт'"),
            ("store", "VARCHAR(100)"),
            ("url", "VARCHAR(500)"),
        ],
        "maintenance_plans": [
            ("tracker_id", "VARCHAR(50)"),
            ("category", "VARCHAR(50) DEFAULT 'Обслуживание'"),
            ("brand", "VARCHAR(100)"),
            ("spec", "VARCHAR(200)"),
            ("article", "VARCHAR(100)"),
            ("icon", "VARCHAR(50) DEFAULT 'droplet'"),
            ("interval_hours", "FLOAT"),
            ("last_service_hours", "FLOAT DEFAULT 0.0"),
            ("notify_before_hours", "FLOAT DEFAULT 30.0"),
        ],
        "document_notes": [
            ("company", "VARCHAR(100)"),
            ("price", "FLOAT DEFAULT 0.0"),
            ("mileage", "FLOAT"),
            ("engine_hours", "FLOAT"),
            ("is_active", "BOOLEAN DEFAULT 1"),
        ],
        "tyre_sets": [
            ("purchase_date", "DATETIME"),
            ("dot_code", "VARCHAR(50)"),
            ("has_separate_rims", "BOOLEAN DEFAULT 0"),
            ("rims_brand_model", "VARCHAR(100)"),
            ("rims_size", "VARCHAR(50)"),
            ("rims_purchase_date", "DATETIME"),
            ("rims_price", "FLOAT DEFAULT 0.0"),
            ("tpms_sensors", "VARCHAR(100)"),
        ]
    }

    for table_name, columns in column_migrations.items():
        # Check existing columns
        res = await conn.execute(text(f"PRAGMA table_info({table_name})"))
        rows = res.fetchall()
        if not rows:
            continue
        existing_cols = {row[1] for row in rows}

        for col_name, col_type in columns:
            if col_name not in existing_cols:
                try:
                    await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                except Exception as e:
                    print(f"Migration note for {table_name}.{col_name}: {e}")

async def heal_service_records_totals():
    """
    Synchronizes cost_parts and total_cost for any existing records in the database.
    Also creates line items for records that had URLs/stores/parts costs without items.
    """
    from app.models.service import ServiceRecord, ServiceItem
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        try:
            res = await session.execute(
                select(ServiceRecord).options(selectinload(ServiceRecord.items))
            )
            records = res.scalars().all()
            changed = False
            for r in records:
                if not r.items and (r.url or (r.cost_parts and r.cost_parts > 0)):
                    item_name = r.title if r.title else "Расходники / Детали"
                    price = r.cost_parts if (r.cost_parts and r.cost_parts > 0) else (r.total_cost or 0.0)
                    new_item = ServiceItem(
                        service_record_id=r.id,
                        name=item_name,
                        store=r.store,
                        url=r.url,
                        quantity=1.0,
                        unit_price=price,
                        total_price=price,
                        category="part",
                        unit="шт"
                    )
                    session.add(new_item)
                    if not r.cost_parts or r.cost_parts == 0.0:
                        r.cost_parts = price
                    if not r.total_cost or r.total_cost < price:
                        r.total_cost = price
                    changed = True
                elif r.items:
                    items_parts = sum(
                        (it.total_price if it.total_price is not None and it.total_price > 0 else (it.quantity * it.unit_price))
                        for it in r.items if it.category != "labor"
                    )
                    items_labor = sum(
                        (it.total_price if it.total_price is not None and it.total_price > 0 else (it.quantity * it.unit_price))
                        for it in r.items if it.category == "labor"
                    )
                    if items_parts > 0 and (not r.cost_parts or r.cost_parts == 0.0 or r.cost_parts < items_parts):
                        r.cost_parts = items_parts
                        changed = True
                    if items_labor > 0 and (not r.cost_labor or r.cost_labor == 0.0):
                        r.cost_labor = items_labor
                        changed = True
                    
                    calc_total = (r.cost_parts or 0.0) + (r.cost_labor or 0.0)
                    if calc_total > 0 and (not r.total_cost or r.total_cost < calc_total):
                        r.total_cost = calc_total
                        changed = True
            if changed:
                await session.commit()
        except Exception as e:
            print(f"Service records healing note: {e}")

async def init_db():
    async with engine.begin() as conn:
        # 1. Create tables if they don't exist
        await conn.run_sync(Base.metadata.create_all)
        # 2. Automatically apply SQLite migrations for existing DB volumes
        if "sqlite" in settings.DATABASE_URL:
            await auto_migrate_sqlite(conn)
    # 3. Heal any existing service records costs
    await heal_service_records_totals()
