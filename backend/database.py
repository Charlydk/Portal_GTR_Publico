import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# --- LÍNEA DE VERIFICACIÓN ---
print("--- [CONFIGURACIÓN PRO] Iniciando DB optimizada para concurrencia ---")
# -----------------------------

if not DATABASE_URL:
    raise ValueError("La variable de entorno DATABASE_URL no está configurada.")

# --- CONFIGURACIÓN DE CONEXIÓN ---
# Si usas el puerto 6543 (Transaction Pooler), debemos desactivar prepared statements.
engine_kwargs = {
    "echo": False,
    "pool_timeout": 30,
    "pool_recycle": 1800,
    "pool_pre_ping": True
}

if ":6543" in DATABASE_URL:
    # Necesario para Supabase Transaction Pooler (PgBouncer/Supavisor)
    from sqlalchemy.pool import NullPool
    engine_kwargs["poolclass"] = NullPool
    engine_kwargs["prepared_statement_cache_size"] = 0
else:
    # Configuración para conexión directa o Session Pooler
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 20

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()