import bleach
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from ..database import get_db
from ..sql_app import models
from ..enums import UserRole
from ..dependencies import get_current_analista, require_role
from ..services.tarea_service import TareaService
from ..schemas.models import (
    Campana, CampanaBase, CampanaSimple, Tarea, Lob
)

router = APIRouter(
    prefix="/campanas",
    tags=["Campañas"]
)

@router.get("/listado-simple/", response_model=List[CampanaSimple], summary="Obtener una lista simple de campañas para selectores")
async def obtener_campanas_simple(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.Campana).order_by(models.Campana.nombre)
    result = await db.execute(query)
    campanas = result.scalars().all()
    return campanas

@router.post("/", response_model=Campana, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Campaña (Protegido por Supervisor/Responsable)")
async def crear_campana(
    campana_data: CampanaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    lobs_nombres = campana_data.lobs_nombres
    datos_campana_dict = campana_data.model_dump(exclude={"lobs_nombres"})
    for campo in ['nombre', 'descripcion']:
        if datos_campana_dict.get(campo):
            datos_campana_dict[campo] = bleach.clean(datos_campana_dict[campo])
    
    db_campana = models.Campana(**datos_campana_dict)
    db.add(db_campana)
    
    try:
        await db.commit()
        await db.refresh(db_campana)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear la campaña: {e}")

    if lobs_nombres:
        for nombre_lob in lobs_nombres:
            if nombre_lob:
                nombre_lob_limpio = bleach.clean(nombre_lob)
                db_lob = models.Lob(nombre=nombre_lob_limpio, campana_id=db_campana.id)
                db.add(db_lob)
        try:
            await db.commit()
            await db.refresh(db_campana)
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Error al crear los LOBs: {e}")

    result = await db.execute(
        select(models.Campana)
        .options(
            selectinload(models.Campana.lobs),
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.comentarios_generales)
        )
        .filter(models.Campana.id == db_campana.id)
    )
    
    campana_to_return = result.scalars().first()
    if not campana_to_return:
         raise HTTPException(status_code=500, detail="Error al recargar la campaña después de la creación.")

    return campana_to_return

@router.get("/", response_model=List[Campana], summary="Listar todas las campañas activas")
async def obtener_campanas(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.Campana).options(
        selectinload(models.Campana.lobs),
        selectinload(models.Campana.analistas_asignados)
    ).order_by(models.Campana.nombre.asc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    campanas = result.scalars().all()
    return campanas

@router.get("/tareas_disponibles", response_model=List[Tarea], summary="Endpoint específico para tareas disponibles")
async def obtener_tareas_disponibles_campana(
    skip: int = 0, 
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    return await TareaService.get_tareas_globales(db, skip, limit)

@router.get("/{campana_id}", response_model=Campana, summary="Obtener Campana por ID (Protegido)")
async def obtener_campana_por_id(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(
        select(models.Campana)
        .filter(models.Campana.id == campana_id)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.lobs)
        )
    )
    campana = result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")
    
    return campana

@router.put("/{campana_id}", response_model=Campana, summary="Actualizar una Campaña existente (Protegido por Supervisor/Responsable)")
async def actualizar_campana(
    campana_id: int,
    campana_update: CampanaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    try:
        result = await db.execute(
            select(models.Campana).options(selectinload(models.Campana.lobs)).filter(models.Campana.id == campana_id)
        )
        campana_existente = result.scalars().first()

        if campana_existente is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada")

        campana_data = campana_update.model_dump(exclude_unset=True)
        nuevos_lobs_nombres = campana_data.pop("lobs_nombres", None)

        for key, value in campana_data.items():
            setattr(campana_existente, key, value)

        if nuevos_lobs_nombres is not None:
            nombres_normalizados = [bleach.clean(n.strip()) for n in nuevos_lobs_nombres if n.strip()]
            lobs_dict = {lob.nombre: lob for lob in campana_existente.lobs}
            for nombre, lob in lobs_dict.items():
                if nombre in nombres_normalizados:
                    lob.esta_activo = True
                else:
                    lob.esta_activo = False

            for nombre in nombres_normalizados:
                if nombre not in lobs_dict:
                    nuevo_lob = models.Lob(nombre=nombre, campana_id=campana_existente.id, esta_activo=True)
                    db.add(nuevo_lob)
        
        await db.commit()
        await db.refresh(campana_existente)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar campaña: {e}"
        )
    
    updated_campana_result = await db.execute(
        select(models.Campana)
        .filter(models.Campana.id == campana_id)
        .options(
            selectinload(models.Campana.lobs),
            selectinload(models.Campana.analistas_asignados)
        )
    )
    updated_campana = updated_campana_result.scalars().first()
    
    return updated_campana

@router.delete("/{campana_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Campaña (Protegido por Supervisor)")
async def eliminar_campana(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    db_campana = await db.execute(select(models.Campana).where(models.Campana.id == campana_id))
    campana_a_eliminar = db_campana.scalar_one_or_none()

    if campana_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada")

    try:
        await db.delete(campana_a_eliminar)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar campaña: {e}"
        )
    return

@router.get("/{campana_id}/lobs", response_model=List[Lob], summary="Obtener LOBs de una Campaña específica")
async def obtener_lobs_por_campana(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.Lob).where(
        models.Lob.campana_id == campana_id,
        models.Lob.esta_activo == True
    )
    result = await db.execute(query)
    lobs = result.scalars().all()
    return lobs
