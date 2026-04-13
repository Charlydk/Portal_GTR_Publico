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
    current_user: models.Analista = Depends(require_role([UserRole.ANALISTA, UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
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
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    await db.delete(item)
    await db.commit()
    return {"message": "Eliminado"}


@router.post("/sync", summary="Sincronizar bolsa de hoy con el catálogo")
async def sincronizar_bolsa_hoy(
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Fuerza la creación de items en la bolsa de hoy para plantillas ACTIVAS 
    que aún no estén presentes en la bolsa.
    """
    hoy = datetime.now(timezone.utc).date()
    dia_semana = hoy.weekday()
    dias_mapeo = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
    campo_dia = dias_mapeo[dia_semana]

    # 1. Obtener nombres de tareas ya existentes hoy para evitar duplicados
    q_existentes = select(models.BolsaTareasReporteria.nombre).filter(
        models.BolsaTareasReporteria.fecha_tarea == hoy
    )
    res_e = await db.execute(q_existentes)
    nombres_existentes = set(res_e.scalars().all())

    # 2. Buscar plantillas activas para hoy
    q_plantillas = select(models.CatalogoTareasReporteria).filter(
        models.CatalogoTareasReporteria.activa == True,
        getattr(models.CatalogoTareasReporteria, campo_dia) == True
    )
    res_p = await db.execute(q_plantillas)
    plantillas = res_p.scalars().all()

    nuevos_creados = 0
    for p in plantillas:
        if p.nombre not in nombres_existentes:
            nueva_tarea = models.BolsaTareasReporteria(
                categoria=p.categoria,
                nombre=p.nombre,
                descripcion=p.descripcion or f"Generado manualmente desde {p.nombre}",
                hora_vencimiento=p.hora_vencimiento,
                estado="PENDIENTE",
                fecha_tarea=hoy
            )
            db.add(nueva_tarea)
            nuevos_creados += 1
    
    if nuevos_creados > 0:
        await db.commit()
    
    return {"message": f"Sincronización completada. Se añadieron {nuevos_creados} tareas nuevas.", "nuevos": nuevos_creados}


@router.put("/bolsa/{id}/tomar", response_model=BolsaTareasReporteriaSimple, summary="Tomar una tarea de la bolsa")
async def tomar_tarea_bolsa(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(get_current_analista)
):
    """Permite a un analista asignarse una tarea PENDIENTE de la bolsa."""
    res = await db.execute(select(models.BolsaTareasReporteria).filter(models.BolsaTareasReporteria.id == id))
    tarea = res.scalars().first()
    
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    if tarea.estado != "PENDIENTE":
        raise HTTPException(status_code=409, detail="Esta tarea ya fue tomada o completada")
    
    tarea.analista_id = current_user.id
    tarea.estado = "EN_PROCESO"
    tarea.actualizada_en = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(tarea)
    return tarea
