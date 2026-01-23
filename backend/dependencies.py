# /backend/dependencies.py

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from .database import get_db
from .sql_app import models
from .enums import UserRole
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def _get_authenticated_email(token: str) -> str:
    """
    Función interna para validar el token y extraer el email.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        if payload is None:
            raise credentials_exception
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        return email
    except Exception:
        raise credentials_exception

async def get_current_analista(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> models.Analista:
    """
    Versión ligera de autenticación (por defecto).
    Solo carga los datos básicos del usuario sin relaciones pesadas.
    """
    email = await _get_authenticated_email(token)
    result = await db.execute(
        select(models.Analista).filter(models.Analista.email == email)
    )
    analista = result.scalars().first()

    if analista is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return analista

async def get_current_analista_full(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> models.Analista:
    """
    Versión completa de autenticación.
    Carga todas las relaciones necesarias para el perfil completo.
    """
    email = await _get_authenticated_email(token)
    result = await db.execute(
        select(models.Analista).filter(models.Analista.email == email)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.acuses_recibo_avisos).selectinload(models.AcuseReciboAviso.aviso),
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.avisos_creados).selectinload(models.Aviso.campana),
            selectinload(models.Analista.tareas_generadas_por_avisos).selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.Analista.incidencias_creadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs)
            ),
            selectinload(models.Analista.incidencias_asignadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs)
            ),
            selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
            selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante)
        )
    )
    
    analista = result.scalars().first()
    if analista is None:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return analista

def require_role(required_roles: List[UserRole], use_simple_auth: bool = True):
    """
    Validador de roles. Por defecto usa la dependencia ligera.
    """
    dependency = get_current_analista if use_simple_auth else get_current_analista_full

    async def role_checker(current_analista: models.Analista = Depends(dependency)):
        if current_analista.role.value not in [r.value for r in required_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción."
            )
        return current_analista
    return role_checker
