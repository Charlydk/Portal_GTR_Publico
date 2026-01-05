# backend/routers/wfm_router.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import date

from ..database import get_db
from ..sql_app import models
from ..schemas import models as schemas # Importamos los esquemas nuevos
from ..dependencies import get_current_analista, require_role
from ..enums import UserRole

router = APIRouter(
    prefix="/wfm",
    tags=["WFM - Planificación y Turnos"]
)

# --- ENDPOINTS DE CONFIGURACIÓN (Dropdowns) ---

@router.get("/equipos", response_model=List[schemas.Equipo])
async def get_equipos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Equipo))
    return result.scalars().all()

@router.get("/clusters", response_model=List[schemas.Cluster])
async def get_clusters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Cluster))
    return result.scalars().all()

@router.get("/conceptos", response_model=List[schemas.ConceptoTurno])
async def get_conceptos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ConceptoTurno))
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
    query = (
        select(models.PlanificacionDiaria)
        .options(
            selectinload(models.PlanificacionDiaria.analista),
            selectinload(models.PlanificacionDiaria.concepto),
            selectinload(models.PlanificacionDiaria.cluster)
        )
        .where(
            models.PlanificacionDiaria.fecha >= fecha_inicio,
            models.PlanificacionDiaria.fecha <= fecha_fin
        )
    )

    # Si nos pasan un equipo, filtramos los analistas de ese equipo
    if equipo_id:
        query = query.join(models.Analista).where(models.Analista.equipo_id == equipo_id)

    result = await db.execute(query)
    return result.scalars().all()

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
    # 1. Buscar si ya existe
    query = select(models.PlanificacionDiaria).where(
        models.PlanificacionDiaria.analista_id == turno.analista_id,
        models.PlanificacionDiaria.fecha == turno.fecha
    )
    result = await db.execute(query)
    db_turno = result.scalars().first()

    if db_turno:
        # ACTUALIZAR
        for key, value in turno.model_dump().items():
            setattr(db_turno, key, value)
    else:
        # CREAR
        db_turno = models.PlanificacionDiaria(**turno.model_dump())
        # Auditoría
        db_turno.creado_por_id = current_user.id
        db.add(db_turno)

    await db.commit()
    await db.refresh(db_turno)
    
    # Recargar relaciones para devolver el objeto completo
    query_refresh = select(models.PlanificacionDiaria).options(
        selectinload(models.PlanificacionDiaria.analista),
        selectinload(models.PlanificacionDiaria.concepto),
        selectinload(models.PlanificacionDiaria.cluster)
    ).where(models.PlanificacionDiaria.id == db_turno.id)
    
    final_result = await db.execute(query_refresh)
    return final_result.scalars().first()