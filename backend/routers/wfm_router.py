# backend/routers/wfm_router.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from datetime import date

from ..database import get_db
from ..sql_app import models
from ..schemas import models as schemas
from ..dependencies import get_current_analista, require_role
from ..enums import UserRole
from ..services.wfm_service import WFMService

router = APIRouter(
    prefix="/wfm",
    tags=["WFM - Planificación y Turnos"]
)

# --- ENDPOINTS DE CONFIGURACIÓN (Dropdowns) ---

@router.get("/equipos", response_model=List[schemas.Equipo])
async def get_equipos(db: AsyncSession = Depends(get_db)):
    return await WFMService.get_equipos(db)

@router.get("/clusters", response_model=List[schemas.Cluster])
async def get_clusters(db: AsyncSession = Depends(get_db)):
    return await WFMService.get_clusters(db)

@router.get("/conceptos", response_model=List[schemas.ConceptoTurno])
async def get_conceptos(db: AsyncSession = Depends(get_db)):
    return await WFMService.get_conceptos(db)

@router.get("/analistas", response_model=List[schemas.AnalistaSimple])
async def get_analistas_wfm(
    equipo_id: int = Query(None),
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    # Nota: Esta lógica es simple pero se podría mover al servicio si crece.
    from sqlalchemy.future import select
    query = select(models.Analista)

    if active_only:
        query = query.where(models.Analista.esta_activo == True)
    query = query.where(models.Analista.role.in_([UserRole.ANALISTA, UserRole.RESPONSABLE]))
    if equipo_id:
        query = query.where(models.Analista.equipo_id == equipo_id)

    query = query.order_by(models.Analista.apellido, models.Analista.nombre)

    result = await db.execute(query)
    return result.scalars().all()

# --- ENDPOINT PRINCIPAL: LA MALLA DE TURNOS ---

@router.get("/planificacion", response_model=List[schemas.Planificacion])
async def get_malla_turnos(
    fecha_inicio: date,
    fecha_fin: date,
    equipo_id: int = Query(None, description="Filtrar por equipo (país)"),
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los turnos planificados entre dos fechas.
    Ideal para dibujar el calendario visual.
    """
    return await WFMService.get_planificacion(db, fecha_inicio, fecha_fin, equipo_id)

# --- GUARDAR/EDITAR TURNO ---

@router.post("/planificacion", response_model=schemas.Planificacion)
async def upsert_turno(
    turno: schemas.PlanificacionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
):
    """
    Crea o actualiza un turno para un analista en una fecha específica.
    """
    return await WFMService.upsert_turno(db, turno, current_user.id)

@router.post("/planificacion/bulk")
async def bulk_upsert_planificaciones(
    planificaciones: List[schemas.PlanificacionCreate],
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
):
    """
    Crea o actualiza múltiples turnos en una sola transacción.
    """
    return await WFMService.bulk_upsert_planificaciones(db, planificaciones, current_user.id)

@router.delete("/planificacion", status_code=204)
async def delete_turno(
    analista_id: int = Query(..., description="ID del analista"),
    fecha: date = Query(..., description="Fecha del turno a borrar (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
):
    """
    Elimina una planificación específica.
    """
    from sqlalchemy.future import select
    query = select(models.PlanificacionDiaria).where(
        models.PlanificacionDiaria.analista_id == analista_id,
        models.PlanificacionDiaria.fecha == fecha
    )
    result = await db.execute(query)
    turno_db = result.scalars().first()

    if turno_db:
        await db.delete(turno_db)
        await db.commit()

    return None
