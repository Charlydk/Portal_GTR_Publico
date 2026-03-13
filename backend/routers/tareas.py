from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from datetime import datetime, date, timedelta, time, timezone
from typing import List, Optional
from ..database import get_db
from ..sql_app import models
from ..enums import UserRole, ProgresoTarea
from ..dependencies import get_current_analista, require_role
from ..services.tarea_service import TareaService
from ..schemas.models import (
    Tarea, TareaUpdate, ComentarioTarea, ComentarioTareaCreate,
    HistorialEstadoTarea, TareaListOutput,
    ChecklistItem, ChecklistItemBase, ChecklistItemUpdate,
    PlantillaChecklistItem, PlantillaChecklistItemCreate
)

router = APIRouter(
    tags=["Tareas"]
)

@router.get("/tareas/", response_model=List[Tarea], summary="Listar tareas pendientes globales")
async def obtener_tareas(
    skip: int = 0,
    limit: int = 100,
    estado: Optional[ProgresoTarea] = None,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    return await TareaService.get_tareas_globales(db, skip, limit, estado)

@router.get("/tareas/{tarea_id}", response_model=Tarea, summary="Obtener Tarea por ID (Protegido)")
async def obtener_tarea_por_id(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    tarea_db = await TareaService.get_tarea_detalle(db, tarea_id)
    
    if not tarea_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    
    if current_analista.role == UserRole.ANALISTA:
        es_dueno = tarea_db.analista_id == current_analista.id
        tiene_acceso_colaborativo = False
        if tarea_db.es_generada_automaticamente and tarea_db.campana_id:
            session_q = select(models.SesionCampana).filter(
                models.SesionCampana.analista_id == current_analista.id,
                models.SesionCampana.campana_id == tarea_db.campana_id,
                models.SesionCampana.fecha_fin.is_(None)
            )
            session_res = await db.execute(session_q)
            if session_res.scalars().first():
                tiene_acceso_colaborativo = True

        if not es_dueno and not tiene_acceso_colaborativo:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta tarea.")

    return tarea_db

@router.put("/tareas/{tarea_id}", response_model=Tarea, summary="Actualizar una Tarea existente (Protegido)")
async def actualizar_tarea(
    tarea_id: int,
    tarea_update: TareaUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    current_analista_id = current_analista.id

    db_tarea_result = await db.execute(
        select(models.Tarea).filter(models.Tarea.id == tarea_id)
    )
    tarea_existente = db_tarea_result.scalars().first()

    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    update_data = tarea_update.model_dump(exclude_unset=True)
    old_progreso = tarea_existente.progreso

    if current_analista.role.value == UserRole.ANALISTA.value:
        if tarea_existente.analista_id is not None and tarea_existente.analista_id != current_analista.id:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes modificar una tarea que no es tuya.")
        
        for key, value in update_data.items():
            if key == "analista_id":
                if value is None or value == current_analista_id:
                    tarea_existente.analista_id = value
                else:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un analista no puede asignar tareas a otros.")
            elif key in ["progreso", "descripcion"]:
                 setattr(tarea_existente, key, value)
            else:
                 raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"No tienes permiso para modificar el campo '{key}'.")

    elif current_analista.role.value in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        for key, value in update_data.items():
            setattr(tarea_existente, key, value)
    
    if "progreso" in update_data and tarea_existente.progreso != old_progreso:
        historial_entry = models.HistorialEstadoTarea(
            old_progreso=old_progreso,
            new_progreso=tarea_existente.progreso,
            changed_by=current_analista_id,
            tarea_id=tarea_existente.id
        )
        db.add(historial_entry)

        if tarea_existente.progreso in [ProgresoTarea.COMPLETADA, ProgresoTarea.CANCELADA]:
            tarea_existente.fecha_finalizacion = datetime.now(timezone.utc)
        elif old_progreso in [ProgresoTarea.COMPLETADA, ProgresoTarea.CANCELADA] and \
             tarea_existente.progreso in [ProgresoTarea.PENDIENTE, ProgresoTarea.EN_PROGRESO]:
            tarea_existente.fecha_finalizacion = None
    
    try:
        await db.commit()
        await db.refresh(tarea_existente)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar tarea: {e}"
        )
    
    return await TareaService.get_tarea_detalle(db, tarea_id)

@router.delete("/tareas/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Tarea (Protegido por Supervisor)")
async def eliminar_tarea(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    db_tarea = await db.execute(select(models.Tarea).where(models.Tarea.id == tarea_id))
    tarea_a_eliminar = db_tarea.scalar_one_or_none()

    if tarea_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    try:
        await db.delete(tarea_a_eliminar)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar tarea: {e}"
        )
    return

@router.post("/tareas/{tarea_id}/comentarios", response_model=ComentarioTarea, status_code=status.HTTP_201_CREATED, summary="Añadir un nuevo comentario a una Tarea")
async def crear_comentario_tarea(
    tarea_id: int,
    comentario: ComentarioTareaCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    tarea_result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    db_tarea = tarea_result.scalars().first()
    if not db_tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        es_dueno = db_tarea.analista_id == current_analista.id
        tiene_acceso_colaborativo = False
        if db_tarea.es_generada_automaticamente and db_tarea.campana_id:
            session_q = select(models.SesionCampana).filter(
                models.SesionCampana.analista_id == current_analista.id,
                models.SesionCampana.campana_id == db_tarea.campana_id,
                models.SesionCampana.fecha_fin.is_(None)
            )
            session_res = await db.execute(session_q)
            if session_res.scalars().first():
                tiene_acceso_colaborativo = True

        if not es_dueno and not tiene_acceso_colaborativo:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para comentar en esta tarea.")

    db_comentario = models.ComentarioTarea(
        texto=comentario.texto,
        tarea_id=tarea_id,
        autor_id=current_analista.id
    )
    db.add(db_comentario)
    
    try:
        await db.commit()
        await db.refresh(db_comentario)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar el comentario: {e}")

    result = await db.execute(
        select(models.ComentarioTarea)
        .options(selectinload(models.ComentarioTarea.autor))
        .filter(models.ComentarioTarea.id == db_comentario.id)
    )
    return result.scalars().first()

@router.get("/tareas/{tarea_id}/historial_estados", response_model=List[HistorialEstadoTarea], summary="Obtener Historial de Estados de una Tarea (Protegido)")
async def get_tarea_historial_estados(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    tarea_result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    if not tarea_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    
    result = await db.execute(
        select(models.HistorialEstadoTarea)
        .options(selectinload(models.HistorialEstadoTarea.changed_by_analista))
        .filter(models.HistorialEstadoTarea.tarea_id == tarea_id)
        .order_by(models.HistorialEstadoTarea.changed_at.desc())
    )
    return result.scalars().all()

@router.get("/tareas/listado", response_model=List[TareaListOutput], summary="Obtener lista de tareas (Propias + Campaña Activa)")
async def get_tareas_listado(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    return await TareaService.get_tareas_analista(db, current_analista)

# --- Endpoints para checklist tareas (Protegidos) ---

@router.post("/checklist_items/", response_model=ChecklistItem, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo ChecklistItem (Protegido)")
async def crear_checklist_item(
    item: ChecklistItemBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Crea un nuevo elemento de checklist.
    Permite creación colaborativa si hay sesión activa en la campaña de la tarea.
    """
    tarea_existente_result = await db.execute(select(models.Tarea).filter(models.Tarea.id == item.tarea_id))
    tarea_existente = tarea_existente_result.scalars().first()

    if tarea_existente is None:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if current_analista.role == UserRole.ANALISTA:
        es_dueno = tarea_existente.analista_id == current_analista.id

        tiene_acceso_colaborativo = False
        if tarea_existente.es_generada_automaticamente and tarea_existente.campana_id:
            # Verificamos sesión activa
            session_q = select(models.SesionCampana).filter(
                models.SesionCampana.analista_id == current_analista.id,
                models.SesionCampana.campana_id == tarea_existente.campana_id,
                models.SesionCampana.fecha_fin.is_(None)
            )
            session_res = await db.execute(session_q)
            if session_res.scalars().first():
                tiene_acceso_colaborativo = True

        if not es_dueno and not tiene_acceso_colaborativo:
            raise HTTPException(status_code=403, detail="No tienes permiso para crear ítems en esta tarea.")

    db_item = models.ChecklistItem(**item.model_dump())
    db.add(db_item)
    try:
        await db.commit()
        await db.refresh(db_item)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error: {e}")

    result = await db.execute(select(models.ChecklistItem).filter(models.ChecklistItem.id == db_item.id).options(selectinload(models.ChecklistItem.tarea)))
    return result.scalars().first()

@router.get("/checklist_items/{item_id}", response_model=ChecklistItem, summary="Obtener ChecklistItem por ID (Protegido)")
async def obtener_checklist_item_por_id(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene un ítem de checklist específico por su ID.
    Requiere autenticación. Un analista normal solo ve ítems de sus propias tareas.
    """
    result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == item_id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado.")

    if current_analista.role == UserRole.ANALISTA:
        tarea_result = await db.execute(
            select(models.Tarea)
            .filter(models.Tarea.id == item.tarea_id, models.Tarea.analista_id == current_analista.id)
        )
        if not tarea_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este ChecklistItem.")

    return item


@router.get("/checklist_items/", response_model=List[ChecklistItem], summary="Obtener ChecklistItems (con filtro opcional por tarea) (Protegido)")
async def obtener_checklist_items(
    db: AsyncSession = Depends(get_db),
    tarea_id: Optional[int] = None,
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los elementos de checklist, o filtra por ID de tarea.
    Requiere autenticación. Un analista normal solo ve ítems de sus propias tareas.
    """
    query = select(models.ChecklistItem).options(selectinload(models.ChecklistItem.tarea))

    if current_analista.role == UserRole.ANALISTA:
        query = query.join(models.Tarea).where(models.Tarea.analista_id == current_analista.id)
        if tarea_id:
            query = query.where(models.ChecklistItem.tarea_id == tarea_id)
    else:
        if tarea_id:
            query = query.where(models.ChecklistItem.tarea_id == tarea_id)

    items = await db.execute(query)
    return items.scalars().all()

@router.put("/checklist_items/{item_id}", response_model=ChecklistItem, summary="Actualizar un ChecklistItem existente (Protegido)")
async def actualizar_checklist_item(
    item_id: int,
    item_update: ChecklistItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Actualiza un ítem de checklist. Permite acción colaborativa si hay sesión activa.
    """
    db_item_result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == item_id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item_existente = db_item_result.scalars().first()

    if item_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado")

    update_data = item_update.model_dump(exclude_unset=True)

    if current_analista.role == UserRole.ANALISTA:
        # Validación de permisos COLABORATIVA
        es_dueno = item_existente.tarea.analista_id == current_analista.id

        tiene_acceso_colaborativo = False
        if item_existente.tarea.es_generada_automaticamente and item_existente.tarea.campana_id:
            session_q = select(models.SesionCampana).filter(
                models.SesionCampana.analista_id == current_analista.id,
                models.SesionCampana.campana_id == item_existente.tarea.campana_id,
                models.SesionCampana.fecha_fin.is_(None)
            )
            session_res = await db.execute(session_q)
            if session_res.scalars().first():
                tiene_acceso_colaborativo = True

        if not es_dueno and not tiene_acceso_colaborativo:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para editar este ítem (requiere ser dueño o sesión activa).")

        # Lógica de actualización (Auditoría)
        if "completado" in update_data:
            nuevo_estado = update_data["completado"]

            if nuevo_estado and not item_existente.completado:
                # MARCAR: Guardamos fecha y QUIÉN lo hizo
                item_existente.fecha_completado = datetime.now(timezone.utc)
                item_existente.realizado_por_id = current_analista.id

            elif not nuevo_estado:
                # DESMARCAR: Limpiamos fecha y autor
                item_existente.fecha_completado = None
                item_existente.realizado_por_id = None

            item_existente.completado = nuevo_estado

    elif current_analista.role in [UserRole.SUPERVISOR, UserRole.RESPONSABLE]:
        if "descripcion" in update_data:
            item_existente.descripcion = update_data["descripcion"]

        if "completado" in update_data:
            item_existente.completado = update_data["completado"]

    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rol sin permisos.")

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar: {e}")

    await db.refresh(item_existente)
    result = await db.execute(
        select(models.ChecklistItem).filter(models.ChecklistItem.id == item_existente.id).options(selectinload(models.ChecklistItem.tarea))
    )
    return result.scalars().first()

@router.delete("/checklist_items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un ChecklistItem (Protegido por Supervisor)")
async def eliminar_checklist_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina un elemento de checklist existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_item_result = await db.execute(select(models.ChecklistItem).where(models.ChecklistItem.id == item_id))
    item_a_eliminar = db_item_result.scalars().first()

    if item_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ChecklistItem no encontrado")

    try:
        await db.delete(item_a_eliminar)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar checklist item: {e}"
        )
    return

@router.post("/campanas/{campana_id}/plantilla", response_model=PlantillaChecklistItem, status_code=status.HTTP_201_CREATED, summary="Añadir un ítem a la plantilla de una campaña")
async def add_item_to_plantilla(
    campana_id: int,
    item_data: PlantillaChecklistItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    campana = await db.get(models.Campana, campana_id)
    if not campana:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")

    nuevo_item = models.ItemPlantillaChecklist(
        campana_id=campana_id,
        descripcion=item_data.descripcion,
        hora_sugerida=item_data.hora_sugerida,
        lunes=item_data.lunes,
        martes=item_data.martes,
        miercoles=item_data.miercoles,
        jueves=item_data.jueves,
        viernes=item_data.viernes,
        sabado=item_data.sabado,
        domingo=item_data.domingo
    )

    db.add(nuevo_item)
    await db.commit()
    await db.refresh(nuevo_item)
    return nuevo_item

@router.get("/campanas/{campana_id}/plantilla", response_model=List[PlantillaChecklistItem], summary="Obtener la plantilla de checklist de una campaña")
async def obtener_plantilla_de_campana(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(select(models.ItemPlantillaChecklist).where(models.ItemPlantillaChecklist.campana_id == campana_id))
    return result.scalars().all()

@router.delete("/plantilla-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un ítem de una plantilla")
async def delete_item_de_plantilla(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    result = await db.execute(select(models.ItemPlantillaChecklist).filter(models.ItemPlantillaChecklist.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ítem de plantilla no encontrado.")
    
    await db.delete(item)
    await db.commit()
    return
