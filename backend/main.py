from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from enums import UserRole
from datetime import timedelta
from sqlalchemy.orm import selectinload



# --- IMPORTS CENTRALIZADOS ---
from database import get_db, engine
from sql_app import models
from schemas.models import Analista, AnalistaCreate, CampanaSimple
from schemas.auth_schemas import Token, TokenData
from security import verify_password, get_password_hash, create_access_token, decode_access_token, ACCESS_TOKEN_EXPIRE_MINUTES


# --- IMPORTAMOS NUESTROS ROUTERS Y DEPENDENCIAS ---
from routers import gtr_router, hhee_router
from dependencies import get_current_analista, require_role

# --- CREACIÓN Y CONFIGURACIÓN DE LA APP ---
app = FastAPI(
    title="Portal Unificado API",
    description="API para los portales GTR y HHEE."
)

origins = [
    "http://localhost", "http://localhost:3000",
    "http://127.0.0.1:5173", "http://localhost:5173",
    "http://127.0.0.1:8000", "https://portal-gtr.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- INCLUSIÓN DE ROUTERS ---
app.include_router(gtr_router.router)
app.include_router(hhee_router.router)


# --- DEPENDENCIAS Y ENDPOINTS GLOBALES (AUTENTICACIÓN) ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.on_event("startup")
async def startup_event():
    # Descomenta estas líneas UNA SOLA VEZ para crear la tabla
    #async with engine.begin() as conn:
    #    await conn.run_sync(models.Base.metadata.create_all)
    print("Base de datos y tablas verificadas/creadas.")

async def get_analista_by_email(email: str, db: AsyncSession) -> Optional[models.Analista]:
    result = await db.execute(select(models.Analista).filter(models.Analista.email == email))
    return result.scalars().first()

async def get_current_analista(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> models.Analista:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        if payload is None: raise credentials_exception
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
        token_data = TokenData(email=email)
    except Exception:
        raise credentials_exception

    # --- CONSULTA SIMPLIFICADA ---
    # Cargamos solo al analista y sus campañas asignadas.
    # El resto de la información (tareas, avisos, etc.) se cargará
    # específicamente en los endpoints que la necesiten.
    result = await db.execute(
        select(models.Analista).filter(models.Analista.email == token_data.email)
        .options(selectinload(models.Analista.campanas_asignadas))
    )
    analista = result.scalars().first()
    # --- FIN DE LA SIMPLIFICACIÓN ---

    if analista is None:
        raise credentials_exception

    return analista

def require_role(required_roles: List[UserRole]):
    def role_checker(current_analista: models.Analista = Depends(get_current_analista)):
        if current_analista.role.value not in [r.value for r in required_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción."
            )
        return current_analista
    return role_checker

@app.post("/register/", response_model=Analista, status_code=status.HTTP_201_CREATED, summary="Registrar un nuevo Analista")
async def register_analista(analista: AnalistaCreate, db: AsyncSession = Depends(get_db)):
    # (Tu endpoint de registro completo va aquí)
    # (El código que ya tenías para esta función es correcto)
    existing_analista_by_email = await get_analista_by_email(analista.email, db)
    if existing_analista_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado.")
    result_bms = await db.execute(select(models.Analista).filter(models.Analista.bms_id == analista.bms_id))
    if result_bms.scalars().first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")
    hashed_password = get_password_hash(analista.password)
    db_analista = models.Analista(
        nombre=analista.nombre, apellido=analista.apellido, email=analista.email,
        bms_id=analista.bms_id, role=analista.role.value, hashed_password=hashed_password
    )
    db.add(db_analista)
    await db.commit()
    await db.refresh(db_analista)
    return db_analista

@app.post("/token", response_model=Token, summary="Obtener Token de Acceso (Login)")
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



@app.put("/reset-password/{email}", summary="[TEMPORAL] Resetear la contraseña de un usuario")
async def reset_password(email: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint de utilidad para resetear la contraseña de un usuario a 'nuevacontraseña'.
    ¡Eliminar en producción!
    """
    analista = await get_analista_by_email(email, db)
    if not analista:
        raise HTTPException(status_code=404, detail="Analista no encontrado")

    # La nueva contraseña será "nuevacontraseña"
    new_hashed_password = get_password_hash("nuevacontraseña")

    analista.hashed_password = new_hashed_password
    await db.commit()

    return {"mensaje": f"La contraseña para {email} ha sido reseteada a: nuevacontraseña"}