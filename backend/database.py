import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# --- LÍNEA DE VERIFICACIÓN ---
print("--- [CONFIGURACIÓN PRO] Iniciando DB optimizada para concurrencia ---")
# -----------------------------

if not DATABASE_URL:
    raise ValueError("La variable de entorno DATABASE_URL no está configurada.")

# --- CONFIGURACIÓN DE CONEXIÓN ---
# Detectamos si estamos usando el Transaction Pooler de Supabase (puerto 6543)
if ":6543" in DATABASE_URL:
    # MODO TRANSACTION POOLER (SUPABASE)
    # Para asyncpg con PgBouncer/Supavisor, DEBEMOS desactivar prepared statements.
    # Usamos NullPool para delegar el pooling completamente a Supabase/PgBouncer.
    engine = create_async_engine(
        DATABASE_URL,
        poolclass=NullPool,
        connect_args={
            "statement_cache_size": 0
        }
    )
else:
    # MODO CONEXIÓN DIRECTA O SESSION POOLER
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True
    )

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
