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

engine = create_async_engine(
    DATABASE_URL,
    # 1. APAGAR ECHO: En producción esto debe ser False para que sea más rápido
    echo=False, 
    
    # 2. AUMENTAR POOL: Ideal para ~50 usuarios concurrentes
    # Mantiene 20 conexiones siempre listas para usar.
    pool_size=20,             
    
    # 3. OVERFLOW: Permite abrir hasta 20 más en momentos de "pico" (ej: entrada de turno)
    # Total máximo teórico: 40 conexiones simultáneas reales.
    max_overflow=20,         
    
    pool_timeout=30,         # Tiempo de espera antes de dar error (30s es correcto)
    pool_recycle=1800,       # Recicla cada 30 min (correcto para Supabase)
    pool_pre_ping=True       # Mantiene la salud de la conexión (vital en la nube)
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