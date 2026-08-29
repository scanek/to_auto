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
            ("engine", "VARCHAR(100)"),
            ("current_engine_hours", "FLOAT DEFAULT 0.0"),
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

async def init_db():
    async with engine.begin() as conn:
        # 1. Create tables if they don't exist
        await conn.run_sync(Base.metadata.create_all)
        # 2. Automatically apply SQLite migrations for existing DB volumes
        if "sqlite" in settings.DATABASE_URL:
            await auto_migrate_sqlite(conn)
