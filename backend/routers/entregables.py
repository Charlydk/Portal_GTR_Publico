from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from ..database import get_db
from ..schemas.models import (
    Entregable, EntregableCreate, EntregableUpdate, EntregableDetalle,
    EntregableItemCreate, EntregableItemUpdate, EntregableItem,
    EntregableComentarioCreate, EntregableComentario
)
from ..sql_app import models
from ..dependencies import get_current_analista, require_role
from ..enums import UserRole, EstadoEntregable

router = APIRouter(tags=["Entregables"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _puede_editar_campos_core(user: models.Analista, entregable: models.Entregable) -> bool:
    """Regla de propiedad: Supervisor siempre edita; analista solo si es creador y no está bloqueado."""
    if user.role in (UserRole.SUPERVISOR, UserRole.RESPONSABLE):
        return True
    if entregable.es_bloqueado:
        return False
    return entregable.creador_id == user.id


def _puede_gestionar_items_y_comentarios(user: models.Analista, entregable: models.Entregable) -> bool:
    """El asignado también puede agregar sub-tareas y comentarios aunque no sea el creador."""
    if _puede_editar_campos_core(user, entregable):
        return True
    return entregable.asignado_a_id == user.id


async def _get_entregable_detalle(db: AsyncSession, entregable_id: int) -> models.Entregable:
    result = await db.execute(
        select(models.Entregable).options(
            selectinload(models.Entregable.campana),
            selectinload(models.Entregable.asignado_a),
            selectinload(models.Entregable.creador),
            selectinload(models.Entregable.items).selectinload(models.EntregableItem.completado_por),
            selectinload(models.Entregable.comentarios).selectinload(models.EntregableComentario.autor),
        ).filter(models.Entregable.id == entregable_id)
    )
    return result.scalars().first()



async def _add_log(db: AsyncSession, entregable_id: int, autor_id: int, mensaje: str):
    log = models.EntregableComentario(
        entregable_id=entregable_id,
        autor_id=autor_id,
        contenido=mensaje,
        es_automatico=True,
        fecha_creacion=datetime.now(timezone.utc),
    )
    db.add(log)


# ─── CRUD Entregable ─────────────────────────────────────────────────────────

@router.get("/entregables/", response_model=List[Entregable])
async def get_entregables(
    campana_id: Optional[int] = None,
    asignado_a_id: Optional[int] = None,
    historico: bool = False,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.Entregable).options(
        selectinload(models.Entregable.campana),
        selectinload(models.Entregable.asignado_a),
        selectinload(models.Entregable.creador),
    )
    
    if campana_id:
        query = query.filter(models.Entregable.campana_id == campana_id)
    if asignado_a_id:
        query = query.filter(models.Entregable.asignado_a_id == asignado_a_id)
    
    # Si no se pide el histórico, filtramos completados de hace más de 15 días
    if not historico:
        desde = datetime.now(timezone.utc) - timedelta(days=15)
        query = query.filter(
            or_(
                models.Entregable.estado != EstadoEntregable.COMPLETADO,
                models.Entregable.fecha_completado >= desde,
                models.Entregable.fecha_completado == None
            )
        )
        
    result = await db.execute(query.order_by(models.Entregable.id.desc()))
    return result.scalars().unique().all()


@router.get("/entregables/{entregable_id}", response_model=EntregableDetalle)
async def get_entregable(
    entregable_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    item = await _get_entregable_detalle(db, entregable_id)
    if not item:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
    return item


@router.post("/entregables/", response_model=EntregableDetalle, status_code=status.HTTP_201_CREATED)
async def create_entregable(
    data: EntregableCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    db_item = models.Entregable(
        **data.model_dump(exclude_unset=True),
        creador_id=current_analista.id,
        fecha_creacion=datetime.now(timezone.utc),
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return await _get_entregable_detalle(db, db_item.id)


@router.put("/entregables/{entregable_id}", response_model=EntregableDetalle)
async def update_entregable(
    entregable_id: int,
    update_data: EntregableUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(select(models.Entregable).filter(models.Entregable.id == entregable_id))
    db_entregable = result.scalars().first()
    if not db_entregable:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")

    update_dict = update_data.model_dump(exclude_unset=True)
    can_edit_core = _puede_editar_campos_core(current_analista, db_entregable)

    # Campos core protegidos para analistas que no son dueños
    CORE_FIELDS = {"titulo", "descripcion", "fecha_limite", "campana_id", "asignado_a_id"}
    if not can_edit_core:
        for campo in CORE_FIELDS:
            if campo in update_dict:
                new_val = update_dict[campo]
                old_val = getattr(db_entregable, campo)
                if new_val != old_val:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"No tenés permiso para editar el campo '{campo}' en esta tarea."
                    )

    logs = []

    # Audit trail automático
    if "estado" in update_dict and update_dict["estado"] != db_entregable.estado.value:
        old = db_entregable.estado.value
        new = update_dict["estado"]
        logs.append(f"Estado cambiado de **{old}** a **{new}**.")
        if new == EstadoEntregable.COMPLETADO:
            db_entregable.fecha_completado = datetime.now(timezone.utc)
        else:
            db_entregable.fecha_completado = None

    if "asignado_a_id" in update_dict and update_dict["asignado_a_id"] != db_entregable.asignado_a_id:
        old_id = db_entregable.asignado_a_id
        new_id = update_dict["asignado_a_id"]
        old_name = "(sin asignar)"
        new_name = "(sin asignar)"
        if old_id:
            r = await db.get(models.Analista, old_id)
            if r:
                old_name = f"{r.nombre} {r.apellido}"
        if new_id:
            r = await db.get(models.Analista, new_id)
            if r:
                new_name = f"{r.nombre} {r.apellido}"
        logs.append(f"Asignado reasignado: **{old_name}** → **{new_name}**.")

    for key, value in update_dict.items():
        setattr(db_entregable, key, value)

    for msg in logs:
        await _add_log(db, entregable_id, current_analista.id, msg)

    await db.commit()
    return await _get_entregable_detalle(db, entregable_id)


@router.post("/entregables/{entregable_id}/tomar-control", response_model=EntregableDetalle)
async def tomar_control(
    entregable_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """Solo Supervisores. Bloquea el entregable para que el creador no pueda editarlo."""
    result = await db.execute(select(models.Entregable).filter(models.Entregable.id == entregable_id))
    db_entregable = result.scalars().first()
    if not db_entregable:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
    if db_entregable.es_bloqueado:
        raise HTTPException(status_code=400, detail="El entregable ya está bajo control del equipo supervisor.")

    db_entregable.es_bloqueado = True
    db_entregable.creador_id = current_analista.id  # El supervisor toma la autoría
    await _add_log(
        db, entregable_id, current_analista.id,
        f"{current_analista.nombre} tomó control del entregable. El analista ya no puede editar los campos principales."
    )
    await db.commit()
    return await _get_entregable_detalle(db, entregable_id)


@router.delete("/entregables/{entregable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entregable(
    entregable_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(select(models.Entregable).filter(models.Entregable.id == entregable_id))
    db_entregable = result.scalars().first()
    if not db_entregable:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
    if not _puede_editar_campos_core(current_analista, db_entregable):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tenés permiso para eliminar este entregable.")
    await db.delete(db_entregable)
    await db.commit()


# ─── Items (Checklist interno) ────────────────────────────────────────────────

@router.post("/entregables/{entregable_id}/items", response_model=EntregableItem, status_code=201)
async def add_item(
    entregable_id: int,
    data: EntregableItemCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(select(models.Entregable).filter(models.Entregable.id == entregable_id))
    db_entregable = result.scalars().first()
    if not db_entregable:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
    if not _puede_gestionar_items_y_comentarios(current_analista, db_entregable):
        raise HTTPException(status_code=403, detail="Solo el creador, el asignado o un supervisor puede añadir tareas internas.")
    db_item = models.EntregableItem(entregable_id=entregable_id, **data.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


@router.put("/entregables/{entregable_id}/items/{item_id}", response_model=EntregableItem)
async def toggle_item(
    entregable_id: int,
    item_id: int,
    data: EntregableItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(
        select(models.EntregableItem)
        .options(selectinload(models.EntregableItem.completado_por))
        .filter(models.EntregableItem.id == item_id, models.EntregableItem.entregable_id == entregable_id)
    )
    db_item = result.scalars().first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    db_item.completado = data.completado
    db_item.completado_por_id = current_analista.id if data.completado else None
    await db.commit()
    await db.refresh(db_item)
    result2 = await db.execute(
        select(models.EntregableItem)
        .options(selectinload(models.EntregableItem.completado_por))
        .filter(models.EntregableItem.id == item_id)
    )
    return result2.scalars().first()


@router.delete("/entregables/{entregable_id}/items/{item_id}", status_code=204)
async def delete_item(
    entregable_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(select(models.Entregable).filter(models.Entregable.id == entregable_id))
    db_entregable = result.scalars().first()
    if not db_entregable or not _puede_gestionar_items_y_comentarios(current_analista, db_entregable):
        raise HTTPException(status_code=403, detail="No tenés permiso para gestionar tareas internas de este entregable.")
    result2 = await db.execute(select(models.EntregableItem).filter(models.EntregableItem.id == item_id))
    db_item = result2.scalars().first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    await db.delete(db_item)
    await db.commit()


# ─── Comentarios ─────────────────────────────────────────────────────────────

@router.post("/entregables/{entregable_id}/comentarios", response_model=EntregableComentario, status_code=201)
async def add_comentario(
    entregable_id: int,
    data: EntregableComentarioCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    db_comment = models.EntregableComentario(
        entregable_id=entregable_id,
        autor_id=current_analista.id,
        contenido=data.contenido,
        es_automatico=False,
        fecha_creacion=datetime.now(timezone.utc),
    )
    db.add(db_comment)
    await db.commit()
    await db.refresh(db_comment)
    result = await db.execute(
        select(models.EntregableComentario)
        .options(selectinload(models.EntregableComentario.autor))
        .filter(models.EntregableComentario.id == db_comment.id)
    )
    return result.scalars().first()
