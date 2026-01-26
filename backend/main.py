import os
from dotenv import load_dotenv
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)
import redis.asyncio as redis
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .enums import UserRole
from datetime import timedelta
from sqlalchemy.orm import selectinload
from contextlib import asynccontextmanager

# --- IMPORTS CENTRALIZADOS ---
from .database import get_db, engine
from .sql_app import models
from .schemas.models import Analista, AnalistaCreate, CampanaSimple
from .schemas.auth_schemas import Token, TokenData
from .security import verify_password, get_password_hash, create_access_token, decode_access_token, create_refresh_token, ACCESS_TOKEN_EXPIRE_MINUTES
from .sql_app.crud import get_analista_by_email

# --- IMPORTAMOS NUESTROS ROUTERS Y DEPENDENCIAS ---
from .routers import gtr_router, hhee_router, wfm_router
from .dependencies import get_current_analista, get_current_analista_full, require_role, get_current_analista_with_campaigns

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

# --- ENDPOINT DE PRUEBA AQUÍ ---
@app.get("/ping")
async def ping_pong():
    return {"ping": "pong"}
# -----------------------------------------

# En producción (Render), esto redirigirá automáticamente todo el tráfico HTTP a HTTPS.
if os.getenv("RENDER"): # Solo se activa en el entorno de Render
    app.add_middleware(HTTPSRedirectMiddleware)


origins = [
    "http://localhost", "http://localhost:3000",
    "http://127.0.0.1:5174", "http://localhost:5174",
    "http://127.0.0.1:5173", "http://localhost:5173",
    "http://127.0.0.1:8000", "https://portal-gtr.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Permite los orígenes en la lista
    allow_credentials=True,      # Permite cookies y encabezados de autorización
    allow_methods=["*"],         # Permite todos los métodos (GET, POST, PUT, etc.)
    allow_headers=["*"],         # Permite todos los encabezados
)

# --- CONFIGURACIÓN DE SEGURIDAD PARA ROUTERS ---
# SUPERVISOR_OPERACIONES solo puede acceder a HHEE.
gtr_wfm_restriction = [Depends(require_role([UserRole.ANALISTA, UserRole.SUPERVISOR, UserRole.RESPONSABLE]))]

app.include_router(gtr_router.router, prefix="/gtr", dependencies=gtr_wfm_restriction)
app.include_router(hhee_router.router, prefix="/hhee")
app.include_router(wfm_router.router, dependencies=gtr_wfm_restriction)


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "ok"}

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
    print("--- 1. Endpoint /token recibido. Buscando analista en la BD... ---")

 
    analista = await get_analista_by_email(form_data.username, db)

    print("--- 2. Analista encontrado. Verificando contraseña... ---")

    
    if not analista:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    is_password_correct = verify_password(form_data.password, analista.hashed_password)

    if not is_password_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not analista.esta_activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo. Contacte al administrador."
        )
    token_data = {"sub": analista.email, "role": analista.role.value}
    
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data) # <-- Creamos el refresh token
    
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token, # <-- Lo devolvemos
        "token_type": "bearer"
    }

@app.post("/refresh", response_model=Token, summary="Refrescar el Token de Acceso")
async def refresh_access_token(
    refresh_token: str = Header(..., alias="Authorization"), 
    db: AsyncSession = Depends(get_db)
):
    if not refresh_token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de token inválido")

    token = refresh_token.split(" ")[1]
    
    payload = decode_access_token(token) # Usamos la misma función de decodificación
    if not payload:
        raise HTTPException(status_code=401, detail="Refresh token inválido o expirado")
        
    email = payload.get("sub")
    analista = await get_analista_by_email(email, db)
    if not analista or not analista.esta_activo:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
        
    # Si todo es correcto, creamos un NUEVO access token y un NUEVO refresh token
    new_token_data = {"sub": analista.email, "role": analista.role.value}
    new_access_token = create_access_token(data=new_token_data)
    new_refresh_token = create_refresh_token(data=new_token_data)
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@app.get("/users/me/", response_model=Analista, summary="Obtener información del Analista actual")
async def read_users_me(current_analista: models.Analista = Depends(get_current_analista_with_campaigns)):
    """
    Obtiene la información básica del analista actual con sus campañas.
    Construye la respuesta manualmente para asegurar que no haya errores de carga perezosa.
    """
    return Analista(
        id=current_analista.id,
        nombre=current_analista.nombre,
        apellido=current_analista.apellido,
        email=current_analista.email,
        bms_id=current_analista.bms_id,
        role=current_analista.role,
        esta_activo=current_analista.esta_activo,
        fecha_creacion=current_analista.fecha_creacion,
        campanas_asignadas=[CampanaSimple.model_validate(c) for c in current_analista.campanas_asignadas],
        # Listas vacías por defecto para evitar MissingGreenlet
        tareas=[], avisos_creados=[], acuses_recibo_avisos=[],
        tareas_generadas_por_avisos=[], incidencias_creadas=[], incidencias_asignadas=[],
        solicitudes_hhee=[], planificaciones=[]
    )
