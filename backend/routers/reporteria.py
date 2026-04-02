from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timezone, date
from typing import List

from ..database import get_db
from ..sql_app import models
from ..schemas.models import BolsaTareasReporteriaSimple

router = APIRouter(
    prefix="/reporteria",
    tags=["Reportería Backoffice"]
)

from sqlalchemy.orm import selectinload
from ..dependencies import get_current_analista, require_role
from ..schemas.models import (
    BolsaTareasReporteriaSimple, 
    BolsaTareasReporteriaDetalle,
    CatalogoTarea, 
    CatalogoTareaCreate,
    UserRole
)

@router.get("/bolsa", response_model=List[BolsaTareasReporteriaSimple], summary="Ver bolsa de reportería diaria")
async def obtener_bolsa_diaria(
    db: AsyncSession = Depends(get_db)
):
    query = select(models.BolsaTareasReporteria).filter(
        models.BolsaTareasReporteria.estado.in_(["PENDIENTE", "EN_PROCESO"])
    ).order_by(models.BolsaTareasReporteria.fecha_tarea.asc(), models.BolsaTareasReporteria.estado.desc())
    
    result = await db.execute(query)
    tareas = result.scalars().all()
    return tareas

@router.get("/historico", response_model=List[BolsaTareasReporteriaDetalle])
async def obtener_historico_reporteria(
    desde: date,
    hasta: date,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    query = select(models.BolsaTareasReporteria).options(
        selectinload(models.BolsaTareasReporteria.analista)
    ).filter(
        models.BolsaTareasReporteria.fecha_tarea >= desde,
        models.BolsaTareasReporteria.fecha_tarea <= hasta,
        models.BolsaTareasReporteria.estado == "COMPLETADO"
    ).order_by(models.BolsaTareasReporteria.actualizada_en.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

# --- CRUD CATÁLOGO ---

@router.post("/catalogo", response_model=CatalogoTarea)
async def crear_tarea_catalogo(
    datos: CatalogoTareaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    nueva = models.CatalogoTareasReporteria(**datos.dict())
    db.add(nueva)
    await db.commit()
    await db.refresh(nueva)
    return nueva

@router.get("/catalogo", response_model=List[CatalogoTarea])
async def listar_catalogo(
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    res = await db.execute(select(models.CatalogoTareasReporteria).order_by(models.CatalogoTareasReporteria.categoria, models.CatalogoTareasReporteria.nombre))
    return res.scalars().all()

@router.put("/catalogo/{id}", response_model=CatalogoTarea)
async def editar_tarea_catalogo(
    id: int,
    datos: CatalogoTareaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    res = await db.execute(select(models.CatalogoTareasReporteria).filter(models.CatalogoTareasReporteria.id == id))
    item = res.scalars().first()
    if not item: raise HTTPException(status_code=404)
    
    for key, val in datos.dict().items():
        setattr(item, key, val)
        
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/catalogo/{id}")
async def eliminar_tarea_catalogo(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    res = await db.execute(select(models.CatalogoTareasReporteria).filter(models.CatalogoTareasReporteria.id == id))
    item = res.scalars().first()
    if not item: raise HTTPException(status_code=404)
    
    await db.delete(item)
    await db.commit()
    return {"message": "Eliminado"}
