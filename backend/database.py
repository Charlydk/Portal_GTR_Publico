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
    separator = "&" if "?" in DATABASE_URL else "?"
    db_url_pooler = f"{DATABASE_URL}{separator}prepared_statement_cache_size=0"

    engine = create_async_engine(
        db_url_pooler,
        poolclass=NullPool,
        connect_args={
            "statement_cache_size": 0,
            "command_timeout": 20
        }
    )
else:
    # MODO CONEXIÓN DIRECTA O SESSION POOLER
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_size=10,         # Reducido de 20 para evitar saturar el plan gratuito
        max_overflow=5,       # Reducido de 10
        pool_timeout=20,
        pool_recycle=1800,
        pool_pre_ping=True,
        connect_args={
            "command_timeout": 20 # Evita que la app quede "colgada" si la DB no responde
        }
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
