import os
import redis.asyncio as redis
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from enums import UserRole
from datetime import timedelta
from sqlalchemy.orm import selectinload
from contextlib import asynccontextmanager

# --- IMPORTS CENTRALIZADOS ---
from database import get_db, engine
from sql_app import models
from schemas.models import Analista, AnalistaCreate, CampanaSimple
from schemas.auth_schemas import Token, TokenData
from security import verify_password, get_password_hash, create_access_token, decode_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from sql_app.crud import get_analista_by_email

# --- IMPORTAMOS NUESTROS ROUTERS Y DEPENDENCIAS ---
from routers import gtr_router, hhee_router
from dependencies import get_current_analista, require_role

# --- 1. DEFINICIÓN DE LA FUNCIÓN LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Código que se ejecuta ANTES de que la aplicación inicie ---
    print("--- Iniciando aplicación y conectando a Redis... ---")
    redis_url = os.getenv("REDIS_URL", "redis://localhost")
    try:
        redis_connection = redis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        await FastAPILimiter.init(redis_connection)
        print("Conectado a Redis y limitador inicializado.")
    except Exception as e:
        print(f"No se pudo conectar a Redis: {e}")
    
    yield  # La aplicación se ejecuta aquí
    
    # --- Código que se ejecuta DESPUÉS de que la aplicación termine ---
    print("--- Aplicación finalizada. ---")

# --- 2. CREACIÓN Y CONFIGURACIÓN DE LA APP (USANDO LA FUNCIÓN YA DEFINIDA) ---
app = FastAPI(
    title="Portal Unificado API",
    description="API para los portales GTR y HHEE.",
    lifespan=lifespan
)

origins = [
    "http://localhost", "http://localhost:3000",
    "http://127.0.0.1:5174", "http://localhost:5174",
    "http://127.0.0.1:5173", "http://localhost:5173",
    "http://127.0.0.1:8000", "https://portal-gtr.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(gtr_router.router, prefix="/gtr")
app.include_router(hhee_router.router, prefix="/hhee")

@app.post(
    "/token",
    response_model=Token,
    summary="Obtener Token de Acceso (Login)",
    # 👇 AÑADIMOS LA DEPENDENCIA DEL LIMITADOR AQUÍ 👇
    dependencies=[Depends(RateLimiter(times=5, minutes=1))]
)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """
    Permite a un analista iniciar sesión y obtener un token JWT.
    """
    print("\n--- INTENTO DE LOGIN ---")
    print(f"Username recibido: {form_data.username}")

    analista = await get_analista_by_email(form_data.username, db)

    if not analista:
        print("❌ ERROR: No se encontró un analista con ese email.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    print(f"✅ Analista encontrado: {analista.email}")
    print(f"Hashed password de la DB: {analista.hashed_password}")

    is_password_correct = verify_password(form_data.password, analista.hashed_password)
    print(f"Resultado de verify_password: {is_password_correct}")

    if not is_password_correct:
        print("❌ ERROR: La contraseña es incorrecta.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not analista.esta_activo:
        print("❌ ERROR: El usuario está inactivo.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo. Contacte al administrador."
        )

    print("✅ Contraseña correcta. Creando token...")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": analista.email, "role": analista.role.value},
        expires_delta=access_token_expires
    )
    print("--- LOGIN EXITOSO ---\n")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=Analista, summary="Obtener información del Analista actual")
async def read_users_me(current_analista: models.Analista = Depends(get_current_analista)):
    """
    Obtiene la información del analista actual.
    Construye la respuesta Pydantic manualmente para evitar errores de carga asíncrona.
    """
    # La dependencia 'get_current_analista' ya nos da el objeto de la base de datos
    # con las 'campanas_asignadas' cargadas.

    # Ahora, en lugar de devolverlo directamente, lo usamos para construir un objeto Pydantic limpio.
    analista_response = Analista(
        id=current_analista.id,
        nombre=current_analista.nombre,
        apellido=current_analista.apellido,
        email=current_analista.email,
        bms_id=current_analista.bms_id,
        role=current_analista.role,
        esta_activo=current_analista.esta_activo,
        fecha_creacion=current_analista.fecha_creacion,
        
        # Convertimos la lista de objetos de BD a una lista de objetos Pydantic
        campanas_asignadas=[CampanaSimple.model_validate(c) for c in current_analista.campanas_asignadas],
        
        # Dejamos las otras listas vacías porque no las cargamos en get_current_analista para ser eficientes
        tareas=[],
        avisos_creados=[],
        acuses_recibo_avisos=[],
        tareas_generadas_por_avisos=[],
        incidencias_creadas=[],
        incidencias_asignadas=[]
    )
        
    return analista_response
