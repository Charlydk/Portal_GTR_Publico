# /backend/dependencies.py

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from .database import get_db
from .sql_app import models
from .enums import UserRole
from .schemas.auth_schemas import TokenData
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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

    result = await db.execute(
        select(models.Analista).options(
            # 1. Campañas y Relaciones Base
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.equipo), # Nueva relación Fase 2
            
            # 2. Tareas
            selectinload(models.Analista.tareas).options(
                selectinload(models.Tarea.campana),
                selectinload(models.Tarea.checklist_items)
            ),
            
            # 3. Incidencias (SOLO ASIGNADAS, no creadas)
            selectinload(models.Analista.incidencias_asignadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs)
            ),
            
            # 4. Avisos y Notificaciones
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos).selectinload(models.AcuseReciboAviso.aviso),
            selectinload(models.Analista.tareas_generadas_por_avisos).selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            
            # 5. Bitácora y Sesiones
            selectinload(models.Analista.comentarios_bitacora),
            selectinload(models.Analista.sesiones),
            
            # 6. HHEE (Horas Extras)
            selectinload(models.Analista.validaciones_hhee),
            selectinload(models.Analista.solicitudes_hhee),

            # 7. Planificación (Fase 2)
            selectinload(models.Analista.planificaciones).selectinload(models.PlanificacionDiaria.cluster)
        ).filter(models.Analista.email == token_data.email)
    )
    
    analista = result.scalars().first()
    if analista is None:
        raise credentials_exception
    return analista

def require_role(required_roles: List[UserRole], use_simple_auth: bool = False):
    dependency = get_current_analista_simple if use_simple_auth else get_current_analista

    async def role_checker(current_analista: models.Analista = Depends(dependency)):
        # 👇 Verifica que esta lógica sea correcta
        if current_analista.role.value not in [r.value for r in required_roles]:
            print(f"🚫 Acceso denegado. Rol usuario: {current_analista.role.value}, Requeridos: {[r.value for r in required_roles]}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción."
            )
        return current_analista
    return role_checker

async def get_current_analista_simple(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> models.Analista:
    """
    Versión ligera de autenticación. Solo carga datos básicos del usuario.
    Ideal para HHEE donde no necesitamos saber las incidencias o tareas del usuario.
    """
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

    # Consulta SIMPLE sin 'options' ni 'selectinload' pesados
    result = await db.execute(select(models.Analista).filter(models.Analista.email == token_data.email))
    analista = result.scalars().first()
    
    if analista is None:
        raise credentials_exception
    return analista

# 👇 MODIFICAR ESTA FUNCIÓN PARA ACEPTAR LA VERSIÓN SIMPLE
def require_role(required_roles: List[UserRole], use_simple_auth: bool = False):
    # Seleccionamos qué dependencia usar según el flag
    dependency = get_current_analista_simple if use_simple_auth else get_current_analista

    def role_checker(current_analista: models.Analista = Depends(dependency)):
        if current_analista.role.value not in [r.value for r in required_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción."
            )
        return current_analista
    return role_checker