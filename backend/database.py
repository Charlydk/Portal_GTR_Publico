import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# --- LÍNEA DE VERIFICACIÓN ---
print("--- [VERSIÓN NUEVA DEL CÓDIGO] Iniciando configuración de base de datos ---")
# -----------------------------

if not DATABASE_URL:
    raise ValueError("La variable de entorno DATABASE_URL no está configurada.")

engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    pool_size=5,             # Número de conexiones a mantener en el pool.
    max_overflow=10,         # Conexiones extra que se pueden abrir si el pool está lleno.
    pool_timeout=30,         # Tiempo en segundos para esperar una conexión del pool.
    pool_recycle=1800,       # Recicla conexiones cada 30 minutos (1800s), antes de que Supabase las cierre.
    pool_pre_ping=True       # Verifica que la conexión esté viva antes de usarla.
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
