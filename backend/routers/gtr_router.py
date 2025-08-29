# /backend/routers/gtr_router.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_
from datetime import date, datetime, timedelta
from typing import List, Optional, Union
from datetime import datetime, date, time
from sqlalchemy import func

# --- Imports de la aplicación ---
from database import get_db
from sql_app import models
from enums import UserRole, ProgresoTarea, EstadoIncidencia
from dependencies import get_current_analista, require_role # <-- Apuntando al lugar correcto

# --- IMPORTS COMPLETOS DE SCHEMAS PARA GTR ---
from schemas.models import (
    Analista, AnalistaCreate, AnalistaSimple, AnalistaBase, PasswordUpdate,
    Campana, CampanaBase, CampanaSimple,
    Tarea, TareaBase, TareaSimple, TareaListOutput, TareaUpdate,
    ChecklistItem, ChecklistItemBase, ChecklistItemSimple, ChecklistItemUpdate,
    HistorialEstadoTarea,
    ComentarioTarea, ComentarioTareaCreate,
    Aviso, AvisoBase, AvisoListOutput, AvisoSimple,
    AcuseReciboAviso, AcuseReciboCreate, AcuseReciboAvisoSimple,

    BitacoraEntry, BitacoraEntryBase, BitacoraEntryUpdate,
    ComentarioGeneralBitacora, ComentarioGeneralBitacoraCreate,
    Incidencia, IncidenciaCreate, IncidenciaSimple, IncidenciaEstadoUpdate,
    ActualizacionIncidencia, ActualizacionIncidenciaBase,
    DashboardStatsAnalista, DashboardStatsSupervisor,
    TareaGeneradaPorAviso, TareaGeneradaPorAvisoUpdate, TareaGeneradaPorAvisoBase
)
from security import get_password_hash # El endpoint crear_analista la necesita


# --- Creación del Router ---
router = APIRouter(
    tags=["Portal GTR"] # Etiqueta para agrupar en la documentación
)


@router.get("/campanas/tareas_disponibles/", response_model=List[TareaListOutput], summary="Obtener Tareas de Campaña sin Asignar (Protegido)")
async def obtener_tareas_disponibles(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene las tareas de las campañas a las que el analista está asignado,
    pero que aún no tienen un analista asignado (analista_id es NULL).
    """
    # Obtener los IDs de las campañas asignadas al analista actual
    assigned_campaign_ids = [c.id for c in current_analista.campanas_asignadas]

    if not assigned_campaign_ids:
        return [] # Si no tiene campañas, no hay tareas disponibles

    query = select(models.Tarea).options(
        selectinload(models.Tarea.analista),
        selectinload(models.Tarea.campana)
    ).where(
        models.Tarea.campana_id.in_(assigned_campaign_ids),
        models.Tarea.analista_id.is_(None) # La condición clave: tareas sin analista
    )

    tareas = await db.execute(query)
    return tareas.scalars().unique().all()


# --- Endpoints para Analistas (Protegidos) ---

@router.post("/analistas/", response_model=Analista, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Analista (Protegido por Supervisor/Responsable)")
async def crear_analista(
    analista: AnalistaCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea un nuevo analista en el sistema y lo guarda en la base de datos.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    existing_analista_by_email = await get_analista_by_email(analista.email, db)
    if existing_analista_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado.")
    
    result_bms = await db.execute(select(models.Analista).filter(models.Analista.bms_id == analista.bms_id))
    existing_analista_by_bms = result_bms.scalars().first()
    if existing_analista_by_bms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")

    hashed_password = get_password_hash(analista.password)
    db_analista = models.Analista(
        nombre=analista.nombre,
        apellido=analista.apellido,
        email=analista.email,
        bms_id=analista.bms_id,
        hashed_password=hashed_password,
        role=analista.role.value
    )
    db.add(db_analista)
    try:
        await db.commit()
        await db.refresh(db_analista)
        # Recargar el analista con todas las relaciones para la respuesta
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == db_analista.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos),
                selectinload(models.Analista.incidencias_creadas),
                selectinload(models.Analista.incidencias_asignadas)
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la creación.")
        
        return analista_to_return
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear analista: {e}"
        )

@router.get("/analistas/", response_model=List[Analista], summary="Obtener todos los Analistas Activos")
async def obtener_analistas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    query = select(models.Analista).where(models.Analista.esta_activo == True).options(
        # CORRECCIÓN: Añadimos la carga ansiosa completa
        selectinload(models.Analista.campanas_asignadas),
        selectinload(models.Analista.tareas),
        selectinload(models.Analista.avisos_creados),
        selectinload(models.Analista.acuses_recibo_avisos),
        selectinload(models.Analista.tareas_generadas_por_avisos),
        selectinload(models.Analista.incidencias_creadas),
        selectinload(models.Analista.incidencias_asignadas),
        

    )
    result = await db.execute(query)
    analistas = result.scalars().unique().all()
    return analistas


@router.get("/analistas/{analista_id}", response_model=Analista, summary="Obtener Analista por ID")
async def obtener_analista_por_id(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id, models.Analista.esta_activo == True)
        .options(
            # CORRECCIÓN: Añadimos la carga ansiosa completa aquí también
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.avisos_creados).selectinload(models.Aviso.campana),
            selectinload(models.Analista.acuses_recibo_avisos).selectinload(models.AcuseReciboAviso.aviso),
            selectinload(models.Analista.tareas_generadas_por_avisos).selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.Analista.incidencias_creadas).selectinload(models.Incidencia.campana),
            selectinload(models.Analista.incidencias_asignadas)
        )
    )
    analista = result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado o inactivo.")
    
    if current_analista.role == UserRole.ANALISTA.value and current_analista.id != analista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este perfil de analista.")

    return analista


@router.get("/analistas/todos/", response_model=List[Analista], summary="Obtener todos los Analistas (activos e inactivos) (Protegido por Supervisor)")
async def get_all_analistas(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Obtiene una lista de todos los analistas, incluyendo inactivos si `include_inactive` es True.
    Requiere autenticación y rol de SUPERVISOR.
    """
    query = select(models.Analista).options(
        selectinload(models.Analista.campanas_asignadas),
        selectinload(models.Analista.tareas),
        selectinload(models.Analista.avisos_creados),
        selectinload(models.Analista.acuses_recibo_avisos),
        selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
    )
    if not include_inactive:
        query = query.where(models.Analista.esta_activo == True)
    result = await db.execute(query)
    analistas = result.scalars().unique().all()
    return analistas


@router.put("/analistas/{analista_id}", response_model=Analista, summary="Actualizar un Analista existente (Protegido por Supervisor/Responsable)")
async def actualizar_analista(
    analista_id: int,
    analista_update: AnalistaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Actualiza la información de un analista existente.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    Los analistas solo pueden actualizar su propio perfil.
    """
    db_analista_result = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_existente = db_analista_result.scalars().first()

    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado")

    if current_analista.role == UserRole.RESPONSABLE.value and analista_existente.role != UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede editar perfiles de Analistas normales.")
    
    if current_analista.role == UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Los analistas no pueden usar este endpoint para actualizar su perfil.")


    analista_data = analista_update.model_dump(exclude_unset=True)
    for key, value in analista_data.items():
        if key == "hashed_password":
            continue
        if key == "role":
            setattr(analista_existente, key, value.value)
        else:
            setattr(analista_existente, key, value)

    try:
        await db.commit()
        await db.refresh(analista_existente)
        # Recargar el analista con todas las relaciones para la respuesta
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_existente.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos),
                selectinload(models.Analista.incidencias_creadas),
                selectinload(models.Analista.incidencias_asignadas)
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la actualización.")
        
        return analista_to_return
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar analista: {e}"
        )

@router.put("/analistas/{analista_id}/password", response_model=Analista, summary="Actualizar contraseña de un Analista (Protegido)")
async def update_analista_password(
    analista_id: int,
    password_update: PasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Actualiza la contraseña de un analista.
    Un analista puede actualizar su propia contraseña.
    Un Responsable puede actualizar la contraseña de un Analista normal.
    Un Supervisor puede actualizar cualquier contraseña.
    """
    db_analista_result = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_a_actualizar = db_analista_result.scalars().first()

    if analista_a_actualizar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    if current_analista.role == UserRole.ANALISTA.value and current_analista.id != analista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar esta contraseña.")
    
    if current_analista.role == UserRole.RESPONSABLE.value and analista_a_actualizar.role != UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede actualizar la contraseña de Analistas normales.")
    
    hashed_password = get_password_hash(password_update.new_password)
    analista_a_actualizar.hashed_password = hashed_password

    try:
        await db.commit()
        await db.refresh(analista_a_actualizar)
        # Recargar el analista con todas las relaciones para la respuesta
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_a_actualizar.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos),
                selectinload(models.Analista.incidencias_creadas),
                selectinload(models.Analista.incidencias_asignadas)
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la actualización de contraseña.")
        return analista_to_return
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar contraseña: {e}"
        )


@router.delete("/analistas/{analista_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desactivar un Analista (Protegido por Supervisor)")
async def desactivar_analista(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Desactiva (soft delete) un analista existente en la base de datos.
    El analista no se elimina físicamente, solo se marca como inactivo.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_analista = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_a_desactivar = db_analista.scalar_one_or_none()

    if analista_a_desactivar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    if analista_a_desactivar.id == current_analista.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes desactivarte a ti mismo.")

    analista_a_desactivar.esta_activo = False
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al desactivar analista: {e}"
        )
    await db.refresh(analista_a_desactivar)

    return

# --- Endpoints para Asignación de Campañas a Analistas ---

@router.post("/analistas/{analista_id}/campanas/{campana_id}", response_model=Analista, status_code=status.HTTP_200_OK, summary="Asignar Campana a Analista (Protegido)")
async def asignar_campana_a_analista(
    analista_id: int,
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Asigna una campaña a un analista.
    Requiere autenticación.
    Un Analista solo puede asignarse a sí mismo.
    Un Supervisor o Responsable pueden asignar campañas a cualquier analista.
    """
    if current_analista.role == UserRole.ANALISTA.value:
        if analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Analista solo puede asignarse campañas a sí mismo.")

    analista_result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos),
            selectinload(models.Analista.incidencias_creadas),
            selectinload(models.Analista.incidencias_asignadas)
        )
    )
    analista = analista_result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana = campana_result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if (current_analista.role == UserRole.RESPONSABLE.value and 
        analista.role != UserRole.ANALISTA.value and 
        analista_id != current_analista.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede asignar campañas a analistas de rol ANALISTA o a sí mismo.")


    if campana in analista.campanas_asignadas:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La campana ya está asignada a este analista.")

    analista.campanas_asignadas.append(campana)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al asignar campana: {e}"
        )
    await db.refresh(analista)
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista.id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
        )
    )
    analista_to_return = result.scalars().first()
    if not analista_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la desasignación.")
    return analista_to_return

@router.delete("/analistas/{analista_id}/campanas/{campana_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desasignar Campana de Analista (Protegido)")
async def desasignar_campana_de_analista(
    analista_id: int,
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Desasigna una campaña de un analista.
    Requiere autenticación.
    Un Analista solo puede desasignarse a sí mismo.
    Un Supervisor o Responsable pueden desasignar campañas de cualquier analista.
    """
    if current_analista.role == UserRole.ANALISTA.value:
        if analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Analista solo puede desasignarse campañas a sí mismo.")

    analista_result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
        )
    )
    analista = analista_result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana = campana_result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if (current_analista.role == UserRole.RESPONSABLE.value and 
        analista.role != UserRole.ANALISTA.value and 
        analista_id != current_analista.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede desasignar campañas de analistas de rol ANALISTA o a sí mismo.")

    if campana not in analista.campanas_asignadas:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La campana no está asignada a este analista.")

    analista.campanas_asignadas.remove(campana)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al desasignar campana: {e}"
        )
    await db.refresh(analista)
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista.id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas),
            selectinload(models.Analista.avisos_creados),
            selectinload(models.Analista.acuses_recibo_avisos),
            selectinload(models.Analista.tareas_generadas_por_avisos) # NUEVO
        )
    )
    analista_to_return = result.scalars().first()
    if not analista_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la desasignación.")
    return analista_to_return

# --- Endpoints para Campañas (Protegidos) ---

@router.post("/campanas/", response_model=Campana, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Campaña (Protegido por Supervisor/Responsable)")
async def crear_campana(
    campana: CampanaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    db_campana = models.Campana(**campana.model_dump())
    db.add(db_campana)
    try:
        await db.commit()
        await db.refresh(db_campana)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear campaña: {e}"
        )

    result = await db.execute(
        select(models.Campana)
        .filter(models.Campana.id == db_campana.id)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            # CORRECCIÓN: Usar el nuevo nombre de la relación
            selectinload(models.Campana.comentarios_generales).selectinload(models.ComentarioGeneralBitacora.autor),
            selectinload(models.Campana.incidencias)
        )
    )
    campana_to_return = result.scalars().first()
    if not campana_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la campaña después de la creación.")
    return campana_to_return


@router.get("/campanas/", response_model=List[Campana], summary="Obtener todas las Campañas (Protegido)")
async def obtener_campanas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(
        select(models.Campana)
        .options(
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            # CORRECCIÓN: Usar el nuevo nombre de la relación y cargar el autor del comentario
            selectinload(models.Campana.comentarios_generales).selectinload(models.ComentarioGeneralBitacora.autor),
            selectinload(models.Campana.incidencias)
        )
    )
    campanas = result.scalars().all()
    unique_campanas = {c.id: c for c in campanas}.values()
    return list(unique_campanas)


@router.get("/campanas/{campana_id}", response_model=Campana, summary="Obtener Campana por ID (Protegido)")
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
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            # CORRECCIÓN: Usar el nuevo nombre de la relación
            selectinload(models.Campana.comentarios_generales).selectinload(models.ComentarioGeneralBitacora.autor),
            selectinload(models.Campana.incidencias).selectinload(models.Incidencia.creador)
        )
    )
    campana = result.scalars().first()
    if not campana:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")
    
    return campana

@router.put("/campanas/{campana_id}", response_model=Campana, summary="Actualizar una Campaña existente (Protegido por Supervisor/Responsable)")
async def actualizar_campana(
    campana_id: int,
    campana_update: CampanaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    db_campana_result = await db.execute(select(models.Campana).where(models.Campana.id == campana_id))
    campana_existente = db_campana_result.scalars().first()

    if campana_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada")

    campana_data = campana_update.model_dump(exclude_unset=True)
    for key, value in campana_data.items():
        setattr(campana_existente, key, value)

    try:
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
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.tareas),
            selectinload(models.Campana.avisos),
            selectinload(models.Campana.bitacora_entries),
            # CORRECCIÓN: Usar el nuevo nombre de la relación
            selectinload(models.Campana.comentarios_generales).selectinload(models.ComentarioGeneralBitacora.autor),
            selectinload(models.Campana.incidencias)
        )
    )
    updated_campana = updated_campana_result.scalars().first()
    if not updated_campana:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la campaña después de la actualización.")
    
    return updated_campana


@router.delete("/campanas/{campana_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Campaña (Protegido por Supervisor)")
async def eliminar_campana(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina una campaña existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
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


# --- Endpoints para Tareas (Protegidos) ---

@router.post("/tareas/", response_model=Tarea, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Tarea (Protegido)")
async def crear_tarea(
    tarea: TareaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Crea una nueva tarea.
    - Supervisor/Responsable: Pueden crear tareas asignadas o sin asignar (estas últimas deben tener campaña).
    - Analista: Solo puede crear tareas para sí mismo y en campañas a las que esté asignado.
    """
    current_analista_id = current_analista.id
    current_analista_role_value = current_analista.role.value # Usamos .value para la comparación de strings

    # --- VALIDACIÓN DE EXISTENCIA (MODIFICADA PARA SER OPCIONAL) ---
    # 1. Si se proporciona un analista, verificar que existe.
    if tarea.analista_id:
        analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == tarea.analista_id))
        if not analista_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analista con ID {tarea.analista_id} no encontrado.")

    # 2. Si se proporciona una campaña, verificar que existe.
    if tarea.campana_id:
        campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == tarea.campana_id))
        if not campana_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaña con ID {tarea.campana_id} no encontrada.")

    # --- LÓGICA DE PERMISOS (FUSIONADA) ---
    # 3. Mantenemos tu lógica original para el rol ANALISTA
    if current_analista_role_value == UserRole.ANALISTA.value:
        # Un analista DEBE asignarse la tarea a sí mismo
        if not tarea.analista_id or tarea.analista_id != current_analista_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Analista solo puede crear tareas para sí mismo.")
        
        # Si la tarea tiene campana_id, el analista debe estar asignado a esa campaña (TU LÓGICA ORIGINAL)
        if tarea.campana_id:
            is_assigned_to_campaign_result = await db.execute(
                select(models.analistas_campanas.c.campana_id)
                .where(models.analistas_campanas.c.analista_id == current_analista_id)
                .where(models.analistas_campanas.c.campana_id == tarea.campana_id)
            )
            if not is_assigned_to_campaign_result.scalars().first():
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para crear tareas en esta campaña. No estás asignado a ella.")
    
    # 4. Agregamos la nueva regla para SUPERVISOR/RESPONSABLE
    elif current_analista_role_value in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        # Si crean una tarea sin analista, DEBE tener una campaña.
        if not tarea.analista_id and not tarea.campana_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Una tarea sin analista asignado debe estar asociada a una campaña.")

    # --- El resto de la función se mantiene igual que la tuya ---
    tarea_data_dict = tarea.model_dump()
    
    db_tarea = models.Tarea(**tarea_data_dict)
    db.add(db_tarea)
    
    try:
        await db.commit()
        await db.refresh(db_tarea)
        new_tarea_id = db_tarea.id
        new_tarea_progreso = db_tarea.progreso
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error inesperado al crear tarea: {e}")

    # Registrar el estado inicial de la tarea
    historial_entry = models.HistorialEstadoTarea(
        old_progreso=None,
        new_progreso=new_tarea_progreso,
        changed_by_analista_id=current_analista_id,
        tarea_campana_id=new_tarea_id
    )
    db.add(historial_entry)
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al registrar el historial de la tarea: {e}")

    result = await db.execute(
        select(models.Tarea)
        .options(
            selectinload(models.Tarea.analista),
            selectinload(models.Tarea.campana),
            selectinload(models.Tarea.checklist_items),
            selectinload(models.Tarea.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista),
            selectinload(models.Tarea.comentarios).selectinload(models.ComentarioTarea.autor)

        )
        .filter(models.Tarea.id == new_tarea_id)
    )
    tarea_to_return = result.scalars().first()
    if not tarea_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la tarea después de la creación.")
    
    return tarea_to_return


@router.get("/tareas/", response_model=List[TareaListOutput], summary="Obtener Tareas (con filtros opcionales) (Protegido)")
async def obtener_tareas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista),
    analista_id: Optional[int] = None,
    campana_id: Optional[int] = None,
    estado: Optional[ProgresoTarea] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None
):
    """
    Obtiene todas las tareas, o filtra por analista y/o campaña.
    Requiere autenticación.
    Un analista normal solo ve sus propias tareas.
    """
    query = select(models.Tarea).options(
        selectinload(models.Tarea.analista),
        selectinload(models.Tarea.campana)
    )

    if current_analista.role == UserRole.ANALISTA.value:
        query = query.where(models.Tarea.analista_id == current_analista.id)
    elif analista_id is not None:
        if analista_id == 0:  # Señal para tareas sin asignar
            query = query.where(models.Tarea.analista_id.is_(None))
        else:
            query = query.where(models.Tarea.analista_id == analista_id)

    if campana_id is not None:
        if campana_id == 0:  # Señal para tareas sin campaña
            query = query.where(models.Tarea.campana_id.is_(None))
        else:
            query = query.where(models.Tarea.campana_id == campana_id)
    if estado:
        query = query.where(models.Tarea.progreso == estado)
    if fecha_desde:
        query = query.where(models.Tarea.fecha_vencimiento >= fecha_desde)
    if fecha_hasta:
        # Añadimos un día para que la fecha 'hasta' sea inclusiva
        query = query.where(models.Tarea.fecha_vencimiento < (fecha_hasta + timedelta(days=1)))
    # --- FIN DE CAMBIOS ---
   

    tareas = await db.execute(query)
    return tareas.scalars().unique().all()


@router.get("/tareas/{tarea_id}", response_model=Tarea, summary="Obtener Tarea por ID (Protegido)")
async def obtener_tarea_por_id(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene una tarea específica por su ID.
    Construye la respuesta manualmente para evitar errores de carga asíncrona.
    """
    # Paso 1: Obtener el objeto Tarea principal de la base de datos.
    result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    tarea_db = result.scalars().first()
    
    if not tarea_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    
    # Paso 2: Verificar los permisos.
    if current_analista.role.value == UserRole.ANALISTA.value:
        if tarea_db.analista_id is not None and tarea_db.analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta tarea.")

    # Paso 3: Cargar todas las relaciones necesarias en consultas separadas.
    analista, campana = None, None
    if tarea_db.analista_id:
        analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == tarea_db.analista_id))
        analista = analista_result.scalars().first()
    if tarea_db.campana_id:
        campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == tarea_db.campana_id))
        campana = campana_result.scalars().first()
    
    historial_result = await db.execute(
        select(models.HistorialEstadoTarea)
        .filter(models.HistorialEstadoTarea.tarea_campana_id == tarea_id)
        .options(selectinload(models.HistorialEstadoTarea.changed_by_analista)) # Eager load del analista en el historial
    )
    historial = historial_result.scalars().all()

    checklist_result = await db.execute(
        select(models.ChecklistItem).filter(models.ChecklistItem.tarea_id == tarea_id)
    )
    checklist_items = checklist_result.scalars().all()
    
    comentarios_result = await db.execute(
        select(models.ComentarioTarea)
        .filter(models.ComentarioTarea.tarea_id == tarea_id)
        .options(selectinload(models.ComentarioTarea.autor)) # Cargar el autor de cada comentario
        .order_by(models.ComentarioTarea.fecha_creacion.desc()) # Ordenar por más reciente
    )
    comentarios = comentarios_result.scalars().all()

    # Paso 4: Construir el objeto de respuesta Pydantic manualmente.
    tarea_response = Tarea(
        id=tarea_db.id,
        titulo=tarea_db.titulo,
        descripcion=tarea_db.descripcion,
        fecha_vencimiento=tarea_db.fecha_vencimiento,
        progreso=tarea_db.progreso,
        analista_id=tarea_db.analista_id,
        campana_id=tarea_db.campana_id,
        fecha_finalizacion=tarea_db.fecha_finalizacion,
        fecha_creacion=tarea_db.fecha_creacion,
        analista=AnalistaSimple.model_validate(analista) if analista else None,
        campana=CampanaSimple.model_validate(campana) if campana else None,
        # Usamos model_validate para convertir los objetos SQLAlchemy a Pydantic
        checklist_items=[ChecklistItemSimple.model_validate(item) for item in checklist_items],
        historial_estados=[HistorialEstadoTarea.model_validate(h) for h in historial],
        comentarios=[ComentarioTarea.model_validate(c) for c in comentarios]
    )

    return tarea_response


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

    # --- LÓGICA DE ACTUALIZACIÓN MEJORADA ---
    if current_analista.role.value == UserRole.ANALISTA.value:
        # Un analista solo puede modificar tareas que le pertenecen o que están sin asignar.
        if tarea_existente.analista_id is not None and tarea_existente.analista_id != current_analista.id:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes modificar una tarea que no es tuya.")
        
        # Iteramos sobre los datos que se quieren actualizar
        for key, value in update_data.items():
            if key == "analista_id":
                # Un analista puede:
                # 1. Asignarse una tarea (value == su propio id)
                # 2. Liberar una tarea (value is None)
                if value is None or value == current_analista_id:
                    tarea_existente.analista_id = value
                else:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un analista no puede asignar tareas a otros.")
            
            elif key in ["progreso", "descripcion"]:
                 setattr(tarea_existente, key, value)
            
            else:
                 # Si un analista intenta modificar otro campo, lanzamos un error.
                 raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"No tienes permiso para modificar el campo '{key}'.")


    elif current_analista.role.value in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        # Supervisor/Responsable pueden modificar cualquier campo.
        for key, value in update_data.items():
            if key == "fecha_vencimiento" and value is not None:
                setattr(tarea_existente, key, value.replace(tzinfo=None))
            else:
                setattr(tarea_existente, key, value)
    
    # --- FIN DE LA LÓGICA DE ACTUALIZACIÓN ---
    
    # El resto de la función (historial, commit y construcción de respuesta) sigue igual.
    if "progreso" in update_data and tarea_existente.progreso != old_progreso:
        historial_entry = models.HistorialEstadoTarea(
            old_progreso=old_progreso,
            new_progreso=tarea_existente.progreso,
            changed_by_analista_id=current_analista_id,
            tarea_campana_id=tarea_existente.id
        )
        db.add(historial_entry)

        if tarea_existente.progreso in [ProgresoTarea.COMPLETADA, ProgresoTarea.CANCELADA]:
            tarea_existente.fecha_finalizacion = datetime.utcnow().replace(tzinfo=None)
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
    
    # Usamos el patrón de carga manual para evitar el error MissingGreenlet
    analista, campana = None, None
    if tarea_existente.analista_id:
        analista = await db.get(models.Analista, tarea_existente.analista_id)
    if tarea_existente.campana_id:
        campana = await db.get(models.Campana, tarea_existente.campana_id)
    
    historial_result = await db.execute(
        select(models.HistorialEstadoTarea)
        .filter(models.HistorialEstadoTarea.tarea_campana_id == tarea_id)
        .options(selectinload(models.HistorialEstadoTarea.changed_by_analista))
    )
    historial = historial_result.scalars().all()

    checklist_result = await db.execute(
        select(models.ChecklistItem).filter(models.ChecklistItem.tarea_id == tarea_id)
    )
    checklist_items = checklist_result.scalars().all()
    
    comentarios_result = await db.execute(
        select(models.ComentarioTarea)
        .filter(models.ComentarioTarea.tarea_id == tarea_id)
        .options(selectinload(models.ComentarioTarea.autor))
        .order_by(models.ComentarioTarea.fecha_creacion.desc())
    )
    comentarios = comentarios_result.scalars().all()

    tarea_response = Tarea(
        id=tarea_existente.id,
        titulo=tarea_existente.titulo,
        descripcion=tarea_existente.descripcion,
        fecha_vencimiento=tarea_existente.fecha_vencimiento,
        progreso=tarea_existente.progreso,
        analista_id=tarea_existente.analista_id,
        campana_id=tarea_existente.campana_id,
        fecha_finalizacion=tarea_existente.fecha_finalizacion,
        fecha_creacion=tarea_existente.fecha_creacion,
        analista=AnalistaSimple.model_validate(analista) if analista else None,
        campana=CampanaSimple.model_validate(campana) if campana else None,
        checklist_items=[ChecklistItemSimple.model_validate(item) for item in checklist_items],
        historial_estados=[HistorialEstadoTarea.model_validate(h) for h in historial],
        comentarios=[ComentarioTarea.model_validate(c) for c in comentarios]
    )
    return tarea_response

@router.delete("/tareas/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Tarea (Protegido por Supervisor)")
async def eliminar_tarea(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina una tarea existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_tarea = await db.execute(select(models.Tarea).where(models.Tarea.id == tarea_id))
    tarea_a_eliminar = db_tarea.scalar_one_or_none()

    if tarea_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada")

    try:
        await db.delete(tarea_a_eliminar)
        # Opcional: Eliminar los historial_estados relacionados si no se hace en cascada a nivel de DB
        # await db.execute(delete(models.HistorialEstadoTarea).where(models.HistorialEstadoTarea.tarea_campana_id == tarea_id))
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
    """
    Crea un nuevo comentario para una tarea específica.
    """
    # Primero, verificamos que la tarea existe
    tarea_result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    db_tarea = tarea_result.scalars().first()
    if not db_tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")

    # (Opcional pero recomendado) Verificar permisos: El usuario puede ver la tarea?
    if current_analista.role == UserRole.ANALISTA.value:
        if db_tarea.analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para comentar en esta tarea.")

    # Creamos el objeto del comentario
    db_comentario = models.ComentarioTarea(
        texto=comentario.texto,
        tarea_id=tarea_id,
        autor_id=current_analista.id
    )
    db.add(db_comentario)
    await db.commit()
    await db.refresh(db_comentario)

    # Recargamos el comentario con la relación del autor para la respuesta
    result = await db.execute(
        select(models.ComentarioTarea)
        .options(selectinload(models.ComentarioTarea.autor))
        .filter(models.ComentarioTarea.id == db_comentario.id)
    )
    return result.scalars().first()

# --- Endpoints para checklist tareas (Protegidos) ---

@router.post("/checklist_items/", response_model=ChecklistItem, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo ChecklistItem (Protegido)")
async def crear_checklist_item(
    item: ChecklistItemBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Crea un nuevo elemento de checklist asociado a una tarea.
    - Un Analista puede crear ítems para tareas a las que está asignado o que están libres en sus campañas.
    - Un Supervisor o Responsable pueden crear ítems para cualquier tarea.
    """
    tarea_existente_result = await db.execute(
        select(models.Tarea)
        .filter(models.Tarea.id == item.tarea_id)
    )
    tarea_existente = tarea_existente_result.scalars().first()
    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada para asociar el ChecklistItem")

    # --- CAMBIO CLAVE: Nueva lógica de permisos para analistas ---
    if current_analista.role == UserRole.ANALISTA.value:
        is_assigned_to_task = tarea_existente.analista_id == current_analista.id
        
        is_task_in_assigned_campaign = False
        # Si la tarea no está asignada y pertenece a una campaña...
        if tarea_existente.analista_id is None and tarea_existente.campana_id is not None:
            # Verificamos si la campaña de la tarea está en la lista de campañas del analista
            assigned_campaign_ids = [c.id for c in current_analista.campanas_asignadas]
            if tarea_existente.campana_id in assigned_campaign_ids:
                is_task_in_assigned_campaign = True

        # El analista puede crear el item SOLO si está asignado a la tarea
        # O si la tarea está libre en una de sus campañas.
        if not is_assigned_to_task and not is_task_in_assigned_campaign:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para crear ítems de checklist para esta tarea.")
    
    # Si es Supervisor o Responsable, no hay restricciones adicionales.

    db_item = models.ChecklistItem(**item.model_dump())
    db.add(db_item)
    try:
        await db.commit()
        await db.refresh(db_item)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear checklist item: {e}"
        )
    
    result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == db_item.id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item_to_return = result.scalars().first()
    if not item_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el checklist item después de la creación.")
    return item_to_return

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
    
    if current_analista.role == UserRole.ANALISTA.value:
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
    
    if current_analista.role == UserRole.ANALISTA.value:
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
    Actualiza la información de un elemento de checklist existente.
    Requiere autenticación.
    Un Analista solo puede cambiar el estado 'completado' de los ítems de sus propias tareas.
    Un Supervisor o Responsable pueden actualizar cualquier campo de cualquier ítem.
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

    if current_analista.role == UserRole.ANALISTA.value:
        if item_existente.tarea.analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar este ítem de checklist. Solo puedes actualizar ítems de tus propias tareas.")
        
        if "completado" in update_data:
            item_existente.completado = update_data["completado"]
        else:
            pass # Si el analista intenta actualizar otra cosa, simplemente no se hace
            
    elif current_analista.role in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        if "tarea_id" in update_data and update_data["tarea_id"] != item_existente.tarea_id:
            nueva_tarea_existente_result = await db.execute(select(models.Tarea).where(models.Tarea.id == update_data["tarea_id"]))
            if nueva_tarea_existente_result.scalars().first() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nueva Tarea no encontrada para reasignar el ChecklistItem")
            item_existente.tarea_id = update_data["tarea_id"]
        
        if "descripcion" in update_data:
            item_existente.descripcion = update_data["descripcion"]
        
        if "completado" in update_data:
            item_existente.completado = update_data["completado"]
    
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar ítems de checklist con tu rol actual.")

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar checklist item: {e}"
        )
    await db.refresh(item_existente)
    result = await db.execute(
        select(models.ChecklistItem)
        .filter(models.ChecklistItem.id == item_existente.id)
        .options(selectinload(models.ChecklistItem.tarea))
    )
    item_to_return = result.scalars().first()
    if not item_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el checklist item después de la actualización.")
    return item_to_return

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



# --- Endpoints para Avisos (Protegidos) ---

@router.post("/avisos/", response_model=Aviso, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Aviso (Protegido por Supervisor/Responsable)")
async def crear_aviso(
    aviso: AvisoBase, # AvisoBase ahora incluye requiere_tarea y fecha_vencimiento_tarea
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea un nuevo aviso.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    Ahora puede especificar si el aviso requiere una tarea y su fecha de vencimiento.
    """
    creador_result = await db.execute(select(models.Analista).filter(models.Analista.id == aviso.creador_id))
    if creador_result.scalars().first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista creador no encontrado.")

    if aviso.campana_id:
        campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == aviso.campana_id))
        if campana_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña asociada no encontrada.")

    # Validar que si requiere_tarea es True, fecha_vencimiento_tarea no sea nula
    if aviso.requiere_tarea and aviso.fecha_vencimiento_tarea is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Si 'requiere_tarea' es True, 'fecha_vencimiento_tarea' no puede ser nula."
        )
    
    # Asegurarse de que las fechas en el aviso sean timezone-naive
    aviso_data = aviso.model_dump()
    if aviso_data.get("fecha_vencimiento") is not None:
        aviso_data["fecha_vencimiento"] = aviso_data["fecha_vencimiento"].replace(tzinfo=None)
    if aviso_data.get("fecha_vencimiento_tarea") is not None:
        aviso_data["fecha_vencimiento_tarea"] = aviso_data["fecha_vencimiento_tarea"].replace(tzinfo=None)

    db_aviso = models.Aviso(**aviso_data)
    db.add(db_aviso)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear aviso: {e}"
        )
    await db.refresh(db_aviso)

    result = await db.execute(
        select(models.Aviso)
        .filter(models.Aviso.id == db_aviso.id)
        .options(
            selectinload(models.Aviso.creador),
            selectinload(models.Aviso.campana),
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista),
            selectinload(models.Aviso.tareas_generadas) # NUEVO: Cargar tareas generadas
        )
    )
    aviso_to_return = result.scalars().first()
    if not aviso_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el aviso después de la creación.")
    return aviso_to_return

@router.get("/avisos/", response_model=List[AvisoListOutput], summary="Obtener Avisos (con filtros opcionales) (Protegido)")
async def obtener_avisos(
    db: AsyncSession = Depends(get_db),
    creador_id: Optional[int] = None,
    campana_id: Optional[int] = None,
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los avisos, o filtra por ID del creador (analista) y/o ID de campaña.
    Requiere autenticación. Un analista normal solo ve avisos creados por él o asociados a sus campañas,
    o avisos que no tienen campaña asociada (generales).
    """
    query = select(models.Aviso).options(
        selectinload(models.Aviso.creador),
        selectinload(models.Aviso.campana)
    )

    if current_analista.role == UserRole.ANALISTA.value:
        # Un analista puede ver:
        # 1. Avisos creados por él
        # 2. Avisos sin campaña asociada (generales)
        # 3. Avisos asociados a campañas a las que está asignado
        query = query.filter(
            (models.Aviso.creador_id == current_analista.id) |
            (models.Aviso.campana_id.is_(None)) | # AHORA INCLUYE AVISOS GENERALES
            (models.Aviso.campana_id.in_(
                select(models.analistas_campanas.c.campana_id).where(models.analistas_campanas.c.analista_id == current_analista.id)
            ))
        )
    else: # Supervisores y Responsables ven todos los avisos
        if creador_id:
            query = query.where(models.Aviso.creador_id == creador_id)
        if campana_id:
            query = query.where(models.Aviso.campana_id == campana_id)

    avisos = await db.execute(query)
    return avisos.scalars().unique().all()


@router.get("/avisos/{aviso_id}", response_model=Aviso, summary="Obtener Aviso por ID (Protegido)")
async def obtener_aviso_por_id(
    aviso_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene un aviso específico por su ID.
    Requiere autenticación. Un analista normal solo ve avisos que él creó o asociados a sus campañas,
    o avisos que no tienen campaña asociada (generales).
    """
    result = await db.execute(
        select(models.Aviso)
        .filter(models.Aviso.id == aviso_id)
        .options(
            selectinload(models.Aviso.creador),
            selectinload(models.Aviso.campana),
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista),
            selectinload(models.Aviso.tareas_generadas) # NUEVO: Cargar tareas generadas
        )
    )
    aviso = result.scalars().first()
    if not aviso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")
    
    if current_analista.role == UserRole.ANALISTA.value:
        is_creator = aviso.creador_id == current_analista.id
        is_general_aviso = aviso.campana_id is None # NUEVO: Verificar si es un aviso general
        is_assigned_to_campaign = False
        if aviso.campana_id:
            assigned_campaigns_result = await db.execute(
                select(models.analistas_campanas.c.campana_id)
                .where(models.analistas_campanas.c.analista_id == current_analista.id)
            )
            assigned_campaign_ids = [c_id for (c_id,) in assigned_campaigns_result.all()]
            is_assigned_to_campaign = aviso.campana_id in assigned_campaign_ids
        
        if not is_creator and not is_general_aviso and not is_assigned_to_campaign:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este aviso.")

    return aviso

@router.put("/avisos/{aviso_id}", response_model=Aviso, summary="Actualizar un Aviso existente (Protegido por Supervisor/Responsable)")
async def actualizar_aviso(
    aviso_id: int,
    aviso_update: AvisoBase, # AvisoBase ahora incluye requiere_tarea y fecha_vencimiento_tarea
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Actualiza la información de un aviso existente.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    db_aviso_result = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_existente = db_aviso_result.scalars().first()

    if aviso_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    # Validar que si requiere_tarea es True, fecha_vencimiento_tarea no sea nula
    # Esto se aplica si se está intentando cambiar requiere_tarea a True o si ya es True
    if aviso_update.requiere_tarea and aviso_update.fecha_vencimiento_tarea is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Si 'requiere_tarea' es True, 'fecha_vencimiento_tarea' no puede ser nula."
        )

    if aviso_update.creador_id is not None and aviso_update.creador_id != aviso_existente.creador_id:
        nuevo_creador_result = await db.execute(select(models.Analista).where(models.Analista.id == aviso_update.creador_id))
        if nuevo_creador_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nuevo Analista creador no encontrado para reasignar el Aviso.")
        aviso_existente.creador_id = aviso_update.creador_id

    if aviso_update.campana_id is not None and aviso_update.campana_id != aviso_existente.campana_id:
        nueva_campana_result = await db.execute(select(models.Campana).where(models.Campana.id == aviso_update.campana_id))
        if nueva_campana_result.scalars().first() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nueva Campaña no encontrada para reasignar el Aviso.")
        aviso_existente.campana_id = aviso_update.campana_id
    elif aviso_update.campana_id is None and aviso_existente.campana_id is not None:
        aviso_existente.campana_id = None

    aviso_data = aviso_update.model_dump(exclude_unset=True)
    # Asegurarse de que las fechas en el aviso sean timezone-naive al actualizar
    if "fecha_vencimiento" in aviso_data and aviso_data["fecha_vencimiento"] is not None:
        aviso_data["fecha_vencimiento"] = aviso_data["fecha_vencimiento"].replace(tzinfo=None)
    if "fecha_vencimiento_tarea" in aviso_data and aviso_data["fecha_vencimiento_tarea"] is not None:
        aviso_data["fecha_vencimiento_tarea"] = aviso_data["fecha_vencimiento_tarea"].replace(tzinfo=None)

    for key, value in aviso_data.items():
        if key not in ['creador_id', 'campana_id']:
            setattr(aviso_existente, key, value)

    try:
        await db.commit()
        await db.refresh(aviso_existente)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar aviso: {e}"
        )
    
    updated_aviso_result = await db.execute(
        select(models.Aviso)
        .options(
            selectinload(models.Aviso.creador),
            selectinload(models.Aviso.campana),
            selectinload(models.Aviso.acuses_recibo).selectinload(models.AcuseReciboAviso.analista),
            selectinload(models.Aviso.tareas_generadas) # NUEVO: Cargar tareas generadas
        )
        .filter(models.Aviso.id == aviso_id)
    )
    updated_aviso = updated_aviso_result.scalars().first()
    if not updated_aviso:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el aviso después de la actualización.")
    
    return updated_aviso


@router.delete("/avisos/{aviso_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un Aviso (Protegido por Supervisor)")
async def eliminar_aviso(
    aviso_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina un aviso existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_aviso_result = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_a_eliminar = db_aviso_result.scalars().first()

    if aviso_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    try:
        await db.delete(aviso_a_eliminar)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar aviso: {e}"
        )
    return


# --- Endpoints para Acuses de Recibo de Avisos (Protegidos) ---

@router.post("/avisos/{aviso_id}/acuse_recibo", response_model=AcuseReciboAviso, status_code=status.HTTP_201_CREATED, summary="Registrar acuse de recibo para un Aviso (Protegido)")
async def registrar_acuse_recibo(
    aviso_id: int,
    acuse_data: AcuseReciboCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Registra que un analista ha visto y acusado un aviso específico.
    Requiere autenticación. Un analista solo puede acusar recibo para sí mismo.
    Si el aviso requiere una tarea, se genera una nueva tarea para el analista.
    """
    # Guardar el ID del analista actual antes de cualquier commit que pueda expirarlo
    current_analista_id = current_analista.id

    analista_id = acuse_data.analista_id

    if current_analista.role == UserRole.ANALISTA.value and analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para registrar un acuse de recibo para otro analista.")

    analista_result = await db.execute(select(models.Analista).filter(models.Analista.id == analista_id))
    analista_existente = analista_result.scalars().first()
    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")

    # Cargar el aviso con la relación tareas_generadas para verificar si ya existe una tarea
    aviso_result = await db.execute(
        select(models.Aviso)
        .options(selectinload(models.Aviso.creador), selectinload(models.Aviso.campana), selectinload(models.Aviso.tareas_generadas)) # NUEVO
        .where(models.Aviso.id == aviso_id)
    )
    aviso_existente = aviso_result.scalars().first()
    if aviso_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")

    existing_acuse_result = await db.execute(
        select(models.AcuseReciboAviso)
        .where(models.AcuseReciboAviso.aviso_id == aviso_id)
        .where(models.AcuseReciboAviso.analista_id == analista_id)
    )
    if existing_acuse_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este analista ya ha acusado este aviso.")

    db_acuse = models.AcuseReciboAviso(aviso_id=aviso_id, analista_id=analista_id)
    db.add(db_acuse)

    # --- Lógica para generar tarea si el aviso lo requiere ---
    if aviso_existente.requiere_tarea:
        # Verificar si ya existe una tarea generada por este aviso para este analista
        existing_generated_task_result = await db.execute(
            select(models.TareaGeneradaPorAviso)
            .filter(
                models.TareaGeneradaPorAviso.aviso_origen_id == aviso_id,
                models.TareaGeneradaPorAviso.analista_asignado_id == analista_id
            )
        )
        if not existing_generated_task_result.scalars().first(): # Si no existe, crearla
            new_generated_task = models.TareaGeneradaPorAviso(
                titulo=f"Tarea de Aviso: {aviso_existente.titulo}",
                descripcion=f"Realizar la acción solicitada en el aviso: {aviso_existente.contenido}",
                # CORRECCIÓN: Asegurarse de que fecha_vencimiento_tarea sea timezone-naive
                fecha_vencimiento=aviso_existente.fecha_vencimiento_tarea.replace(tzinfo=None) if aviso_existente.fecha_vencimiento_tarea else None,
                progreso=ProgresoTarea.PENDIENTE.value,
                analista_asignado_id=analista_id,
                aviso_origen_id=aviso_id
            )
            db.add(new_generated_task)
            print(f"Tarea generada para analista {analista_id} por aviso {aviso_id}") # Para depuración
            
            # Registrar el estado inicial de la tarea generada
            historial_entry = models.HistorialEstadoTarea(
                new_progreso=new_generated_task.progreso,
                changed_by_analista_id=current_analista_id, # El analista que acusa recibo es quien "crea" la tarea generada
                tarea_generada_id=new_generated_task.id # El ID de la tarea generada aún no está disponible aquí
            )
            db.add(historial_entry)

        else:
            print(f"Tarea ya existe para analista {analista_id} por aviso {aviso_id}. No se crea duplicado.") # Para depuración


    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al registrar acuse de recibo o generar tarea: {e}"
        )
    await db.refresh(db_acuse)

    result = await db.execute(
        select(models.AcuseReciboAviso)
        .options(
            selectinload(models.AcuseReciboAviso.analista),
            selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.creador),
            selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.campana)
        )
        .filter(models.AcuseReciboAviso.id == db_acuse.id)
    )
    acuse_to_return = result.scalars().first()
    if not acuse_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el acuse de recibo después de la creación.")
    
    return acuse_to_return

@router.get("/avisos/{aviso_id}/acuses_recibo", response_model=List[AcuseReciboAviso], summary="Obtener acuses de recibo para un Aviso (Protegido)")
async def obtener_acuses_recibo_por_aviso(
    aviso_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los acuses de recibo para un aviso específico.
    Requiere autenticación.
    """
    aviso_result = await db.execute(select(models.Aviso).where(models.Aviso.id == aviso_id))
    aviso_existente = aviso_result.scalars().first()
    if aviso_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso no encontrado.")
    
    # Un analista solo puede ver los acuses de recibo de avisos que él creó, o avisos generales, o avisos de sus campañas
    if current_analista.role == UserRole.ANALISTA.value:
        is_creator = aviso_existente.creador_id == current_analista.id
        is_general_aviso = aviso_existente.campana_id is None
        is_assigned_to_campaign = False
        if aviso_existente.campana_id:
            assigned_campaigns_result = await db.execute(
                select(models.analistas_campanas.c.campana_id)
                .where(models.analistas_campanas.c.analista_id == current_analista.id)
            )
            assigned_campaign_ids = [c_id for (c_id,) in assigned_campaigns_result.all()]
            is_assigned_to_campaign = aviso_existente.campana_id in assigned_campaign_ids
        
        if not is_creator and not is_general_aviso and not is_assigned_to_campaign:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver los acuses de recibo de este aviso.")


    query = select(models.AcuseReciboAviso).options(
        selectinload(models.AcuseReciboAviso.analista),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.creador),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.campana)
    ).where(models.AcuseReciboAviso.aviso_id == aviso_id)

    acuses = await db.execute(query)
    return acuses.scalars().unique().all()

@router.get("/analistas/{analista_id}/acuses_recibo_avisos", response_model=List[AcuseReciboAviso], summary="Obtener acuses de recibo dados por un Analista (Protegido)")
async def obtener_acuses_recibo_por_analista(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene todos los acuses de recibo dados por un analista específico.
    Requiere autenticación. Un analista normal solo puede ver sus propios acuses de recibo.
    """
    analista_result = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_existente = analista_result.scalars().first()
    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado.")
    
    if current_analista.role == UserRole.ANALISTA.value and analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver los acuses de recibo de otro analista.")


    query = select(models.AcuseReciboAviso).options(
        selectinload(models.AcuseReciboAviso.analista),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.creador),
        selectinload(models.AcuseReciboAviso.aviso).selectinload(models.Aviso.campana)
    ).where(models.AcuseReciboAviso.analista_id == analista_id)

    acuses = await db.execute(query)
    return acuses.scalars().unique().all()


# --- ENDPOINTS DE BITÁCORA (MODIFICADOS PARA FECHA Y TIPO DE INCIDENCIA) ---

@router.get("/campanas/{campana_id}/bitacora", response_model=List[BitacoraEntry], summary="Obtener Entradas de Bitácora por Campaña y Fecha (Protegido)")
async def get_campana_bitacora_by_date(
    campana_id: int,
    fecha: date = Query(..., description="Fecha de la bitácora en formato YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana_existente = campana_existente_result.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or campana_existente not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver la bitácora de esta campana.")

    result = await db.execute(
        select(models.BitacoraEntry)
        .options(selectinload(models.BitacoraEntry.campana))
        .filter(models.BitacoraEntry.campana_id == campana_id, models.BitacoraEntry.fecha == fecha)
        .order_by(models.BitacoraEntry.hora)
    )
    entries = result.scalars().all()
    return entries

@router.post("/bitacora_entries/", response_model=BitacoraEntry, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Entrada de Bitácora (Protegido)")
async def create_bitacora_entry(
    entry: BitacoraEntryBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    # Primero, validamos que la campaña a la que se asocia la entrada existe.
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == entry.campana_id))
    if not campana_existente_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    # (Opcional pero recomendado) Validar permisos
    if current_analista.role.value == UserRole.ANALISTA.value:
        # Verificar si el analista está asignado a la campaña
        is_assigned_result = await db.execute(
            select(models.analistas_campanas).filter_by(analista_id=current_analista.id, campana_id=entry.campana_id)
        )
        if not is_assigned_result.first():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para crear entradas de bitácora en esta campaña.")
    
    # Creamos el objeto de la base de datos con todos los datos del schema
    db_entry = models.BitacoraEntry(**entry.model_dump())
    
    db.add(db_entry)
    
    # Usamos un bloque try/except para guardar de forma segura
    try:
        await db.commit()
        await db.refresh(db_entry)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear la entrada de bitácora: {e}"
        )
    
    # Recargamos la entrada con sus relaciones para devolver una respuesta completa
    result = await db.execute(
        select(models.BitacoraEntry)
        .options(selectinload(models.BitacoraEntry.campana))
        .filter(models.BitacoraEntry.id == db_entry.id)
    )
    entry_to_return = result.scalars().first()
    if not entry_to_return:
        raise HTTPException(status_code=500, detail="No se pudo recargar la entrada de bitácora después de la creación.")
        
    return entry_to_return

@router.put("/bitacora_entries/{entry_id}", response_model=BitacoraEntry, summary="Actualizar una Entrada de Bitácora (Protegido)")
async def update_bitacora_entry(
    entry_id: int,
    entry_update: BitacoraEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    db_entry_result = await db.execute(
        select(models.BitacoraEntry)
        .filter(models.BitacoraEntry.id == entry_id)
        .options(selectinload(models.BitacoraEntry.campana))
    )
    db_entry = db_entry_result.scalars().first()
    if not db_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada de bitácora no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or db_entry.campana not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar esta entrada de bitácora.")

    update_data = entry_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_entry, field, value)
    
    db_entry.fecha_ultima_actualizacion = func.now()

    try:
        await db.commit()
        await db.refresh(db_entry)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar entrada de bitácora: {e}"
        )
    
    result = await db.execute(
        select(models.BitacoraEntry)
        .options(selectinload(models.BitacoraEntry.campana))
        .filter(models.BitacoraEntry.id == db_entry.id)
    )
    entry_to_return = result.scalars().first()
    if not entry_to_return:
        raise HTTPException(status_code=500, detail="No se pudo recargar la entrada de bitácora.")
        
    return entry_to_return


@router.delete("/bitacora_entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Entrada de Bitácora (Protegido)")
async def delete_bitacora_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    db_entry_result = await db.execute(
        select(models.BitacoraEntry)
        .filter(models.BitacoraEntry.id == entry_id)
        .options(selectinload(models.BitacoraEntry.campana))
    )
    db_entry = db_entry_result.scalars().first()
    if not db_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada de bitácora no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or db_entry.campana not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para eliminar esta entrada de bitácora.")

    await db.delete(db_entry)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar entrada de bitácora: {e}"
        )
    return


# --- NUEVOS ENDPOINTS PARA COMENTARIOS GENERALES DE BITÁCORA ---

@router.get("/campanas/{campana_id}/comentarios_generales", response_model=List[ComentarioGeneralBitacora], summary="Obtener todos los Comentarios Generales de una Campaña")
async def get_comentarios_generales_de_campana(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    campana_existente = campana_existente_result.scalars().first()
    if not campana_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    if current_analista.role == UserRole.ANALISTA.value:
        analista_with_campanas_result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == current_analista.id)
            .options(selectinload(models.Analista.campanas_asignadas))
        )
        analista_with_campanas = analista_with_campanas_result.scalars().first()
        if not analista_with_campanas or campana_existente not in analista_with_campanas.campanas_asignadas:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver los comentarios de esta campaña.")

    result = await db.execute(
        select(models.ComentarioGeneralBitacora)
        .options(selectinload(models.ComentarioGeneralBitacora.autor))
        .filter(models.ComentarioGeneralBitacora.campana_id == campana_id)
        .order_by(models.ComentarioGeneralBitacora.fecha_creacion.desc())
    )
    comentarios = result.scalars().all()
    return comentarios

@router.post("/campanas/{campana_id}/comentarios_generales", response_model=ComentarioGeneralBitacora, status_code=status.HTTP_201_CREATED, summary="Añadir un nuevo Comentario General a una Campaña")
async def create_comentario_general_para_campana(
    campana_id: int,
    comentario_data: ComentarioGeneralBitacoraCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == campana_id))
    if not campana_existente_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")

    db_comentario = models.ComentarioGeneralBitacora(
        comentario=comentario_data.comentario,
        campana_id=campana_id,
        autor_id=current_analista.id
    )
    db.add(db_comentario)
    try:
        await db.commit()
        await db.refresh(db_comentario)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al guardar el comentario: {e}"
        )

    result = await db.execute(
        select(models.ComentarioGeneralBitacora)
        .options(selectinload(models.ComentarioGeneralBitacora.autor))
        .filter(models.ComentarioGeneralBitacora.id == db_comentario.id)
    )
    comentario_to_return = result.scalars().first()
    if not comentario_to_return:
         raise HTTPException(status_code=500, detail="No se pudo recargar el comentario después de guardarlo.")

    return comentario_to_return


# --- ENDPOINT PARA OBTENER SOLO INCIDENCIAS (FILTRANDO LA BITÁCORA) ---

@router.post("/incidencias/", response_model=Incidencia, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Incidencia")
async def create_incidencia(
    incidencia_data: IncidenciaCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    campana_result = await db.execute(select(models.Campana).filter(models.Campana.id == incidencia_data.campana_id))
    if not campana_result.scalars().first():
        raise HTTPException(status_code=404, detail="Campaña no encontrada")

    # CAMBIO: Si no se provee fecha_apertura, la base de datos usará el default=func.now()
    db_incidencia = models.Incidencia(
        **incidencia_data.model_dump(),
        creador_id=current_analista.id
    )
    db.add(db_incidencia)
    await db.commit()
    await db.refresh(db_incidencia)
    
    # ... (código de recarga sin cambios)
    result = await db.execute(
        select(models.Incidencia)
        .options(
            selectinload(models.Incidencia.creador),
            selectinload(models.Incidencia.campana),
            selectinload(models.Incidencia.actualizaciones)
        )
        .filter(models.Incidencia.id == db_incidencia.id)
    )
    return result.scalars().first()

@router.get("/incidencias/", response_model=List[IncidenciaSimple], summary="Obtener lista de Incidencias")
async def get_incidencias(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.Incidencia).options(
        selectinload(models.Incidencia.campana)
    ).order_by(models.Incidencia.fecha_apertura.desc())

    # Un analista solo ve las de sus campañas, los demás ven todo
    if current_analista.role == UserRole.ANALISTA.value:
        assigned_campaign_ids = [c.id for c in current_analista.campanas_asignadas]
        query = query.filter(models.Incidencia.campana_id.in_(assigned_campaign_ids))

    result = await db.execute(query)
    return result.scalars().unique().all()

@router.get("/incidencias/{incidencia_id}", response_model=Incidencia, summary="Obtener detalles de una Incidencia")
async def get_incidencia_by_id(
    incidencia_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(
        select(models.Incidencia)
        .options(
            selectinload(models.Incidencia.creador),
            selectinload(models.Incidencia.campana),
            selectinload(models.Incidencia.actualizaciones).selectinload(models.ActualizacionIncidencia.autor),
            selectinload(models.Incidencia.asignado_a) #AGREGUE ESTO POR AQUI
        )
        .filter(models.Incidencia.id == incidencia_id)
    )
    incidencia = result.scalars().first()
    if not incidencia:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    
    # Lógica de permisos
    if current_analista.role == UserRole.ANALISTA.value:
        assigned_campaign_ids = [c.id for c in current_analista.campanas_asignadas]
        if incidencia.campana_id not in assigned_campaign_ids:
            raise HTTPException(status_code=403, detail="No tienes permiso para ver esta incidencia")

    return incidencia

@router.post("/incidencias/{incidencia_id}/actualizaciones", response_model=ActualizacionIncidencia, summary="Añadir una actualización a una Incidencia")
async def add_actualizacion_incidencia(
    incidencia_id: int,
    actualizacion_data: ActualizacionIncidenciaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    # (Aquí iría la lógica para verificar permisos si fuera necesario)
    db_actualizacion = models.ActualizacionIncidencia(
        comentario=actualizacion_data.comentario,
        incidencia_id=incidencia_id,
        autor_id=current_analista.id
    )
    db.add(db_actualizacion)
    await db.commit()
    await db.refresh(db_actualizacion)

    result = await db.execute(
        select(models.ActualizacionIncidencia)
        .options(selectinload(models.ActualizacionIncidencia.autor))
        .filter(models.ActualizacionIncidencia.id == db_actualizacion.id)
    )
    return result.scalars().first()

@router.put("/incidencias/{incidencia_id}/estado", response_model=Incidencia, summary="Cambiar el estado de una Incidencia")
async def update_incidencia_estado(
    incidencia_id: int,
    update_data: IncidenciaEstadoUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(select(models.Incidencia).filter(models.Incidencia.id == incidencia_id))
    db_incidencia = result.scalars().first()
    if not db_incidencia:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    estado_anterior = db_incidencia.estado.value
    db_incidencia.estado = update_data.estado

    if update_data.estado == EstadoIncidencia.CERRADA:
        db_incidencia.fecha_cierre = update_data.fecha_cierre or datetime.utcnow()
        # CAMBIO: Al cerrar, se desasigna
        db_incidencia.asignado_a_id = None
    elif update_data.estado == EstadoIncidencia.ABIERTA:
        db_incidencia.fecha_cierre = None
        # CAMBIO: Al reabrir, se desasigna para que quede libre
        db_incidencia.asignado_a_id = None
    
    # (El estado EN_PROGRESO ahora se maneja principalmente desde el endpoint de asignar)

    comentario_automatico = f"El estado de la incidencia cambió de '{estado_anterior}' a '{update_data.estado.value}'."
    nueva_actualizacion = models.ActualizacionIncidencia(
        comentario=comentario_automatico,
        incidencia_id=incidencia_id,
        autor_id=current_analista.id
    )
    db.add(nueva_actualizacion)

    await db.commit()
    
    return await get_incidencia_by_id(incidencia_id, db, current_analista)

@router.put("/incidencias/{incidencia_id}/asignar", response_model=Incidencia, summary="Asignar una incidencia al usuario actual")
async def asignar_incidencia_a_usuario_actual(
    incidencia_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    result = await db.execute(select(models.Incidencia).filter(models.Incidencia.id == incidencia_id))
    db_incidencia = result.scalars().first()
    if not db_incidencia:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    analista_anterior_id = db_incidencia.asignado_a_id
    
    # Asignamos la incidencia al usuario actual y la ponemos "En Progreso"
    db_incidencia.asignado_a_id = current_analista.id
    db_incidencia.estado = EstadoIncidencia.EN_PROGRESO

    # Creamos un comentario automático para el historial
    if analista_anterior_id:
        # Necesitamos obtener el nombre del analista anterior para el log
        res_anterior = await db.execute(select(models.Analista).filter(models.Analista.id == analista_anterior_id))
        analista_anterior = res_anterior.scalars().first()
        nombre_anterior = f"{analista_anterior.nombre} {analista_anterior.apellido}" if analista_anterior else f"ID {analista_anterior_id}"
        comentario = f"Incidencia reasignada de '{nombre_anterior}' a '{current_analista.nombre} {current_analista.apellido}'."
    else:
        comentario = f"Incidencia asignada a '{current_analista.nombre} {current_analista.apellido}'."

    nueva_actualizacion = models.ActualizacionIncidencia(
        comentario=comentario,
        incidencia_id=incidencia_id,
        autor_id=current_analista.id
    )
    db.add(nueva_actualizacion)

    await db.commit()
    
    # Recargamos la incidencia con todas sus relaciones para la respuesta
    return await get_incidencia_by_id(incidencia_id, db, current_analista)


# --- NUEVOS ENDPOINTS PARA TAREAS GENERADAS POR AVISOS ---

@router.post("/tareas_generadas_por_avisos/", response_model=TareaGeneradaPorAviso, status_code=status.HTTP_201_CREATED, summary="Crear una Tarea Generada por Aviso (Protegido por Supervisor/Responsable)")
async def create_tarea_generada_por_aviso(
    tarea: TareaGeneradaPorAvisoBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Crea una nueva tarea que puede ser generada por un aviso.
    Requiere autenticación y rol de SUPERVISOR o RESPONSABLE.
    """
    # Guardar el ID del analista actual antes de cualquier commit que pueda expirarlo
    current_analista_id = current_analista.id

    analista_existente_result = await db.execute(select(models.Analista).filter(models.Analista.id == tarea.analista_asignado_id))
    if not analista_existente_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista asignado no encontrado.")

    if tarea.aviso_origen_id:
        aviso_existente_result = await db.execute(select(models.Aviso).filter(models.Aviso.id == tarea.aviso_origen_id))
        if not aviso_existente_result.scalars().first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso de origen no encontrado.")

    # Asegurarse de que las fechas en la tarea generada sean timezone-naive
    tarea_data = tarea.model_dump()
    if tarea_data.get("fecha_vencimiento") is not None:
        tarea_data["fecha_vencimiento"] = tarea_data["fecha_vencimiento"].replace(tzinfo=None)

    db_tarea = models.TareaGeneradaPorAviso(**tarea_data)
    db.add(db_tarea)
    try:
        await db.commit()
        await db.refresh(db_tarea) # Refresh para obtener el ID generado y otros valores por defecto

        # Capturar el ID y el progreso como escalares después del primer commit y refresh
        new_tarea_id = db_tarea.id
        new_tarea_progreso = db_tarea.progreso

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear tarea generada por aviso: {e}"
        )
    
    # Registrar el estado inicial de la tarea generada
    historial_entry = models.HistorialEstadoTarea(
        old_progreso=None, # El primer estado no tiene un estado anterior
        new_progreso=new_tarea_progreso, # Usar la variable escalar capturada
        changed_by_analista_id=current_analista_id, # Usar la variable local
        tarea_generada_id=new_tarea_id # Usar la variable local
    )
    db.add(historial_entry)
    try:
        await db.commit() # Este commit podría expirar db_tarea nuevamente
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar el historial de la tarea generada: {e}"
        )

    # Cargar relaciones para la respuesta
    result = await db.execute(
        select(models.TareaGeneradaPorAviso)
        .filter(models.TareaGeneradaPorAviso.id == new_tarea_id) # Usar la variable escalar capturada
        .options(
            selectinload(models.TareaGeneradaPorAviso.analista_asignado),
            selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.TareaGeneradaPorAviso.historial_estados) # Cargar historial para la respuesta
        )
    )
    tarea_to_return = result.scalars().first()
    if not tarea_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar la tarea generada después de la creación.")
    return tarea_to_return


@router.get("/tareas_generadas_por_avisos/", response_model=List[TareaGeneradaPorAviso], summary="Obtener todas las Tareas Generadas por Avisos (Protegido)")
async def get_all_tareas_generadas_por_avisos(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista),
    analista_id: Optional[int] = None,
    aviso_origen_id: Optional[int] = None, # Mantenemos este por si es útil
    estado: Optional[ProgresoTarea] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None
):
    """
    Obtiene todas las tareas generadas por avisos, con filtros opcionales.
    Requiere autenticación.
    Un analista normal solo ve las tareas asignadas a él.
    Supervisores y Responsables pueden ver todas las tareas.
    """
    query = select(models.TareaGeneradaPorAviso).options(
        selectinload(models.TareaGeneradaPorAviso.analista_asignado),
        selectinload(models.TareaGeneradaPorAviso.aviso_origen),
        selectinload(models.TareaGeneradaPorAviso.historial_estados)
    )

    if current_analista.role == UserRole.ANALISTA.value:
            query = query.where(models.TareaGeneradaPorAviso.analista_asignado_id == current_analista.id)
    elif analista_id is not None:
        if analista_id == 0: # Las tareas generadas siempre tienen analista, pero mantenemos por consistencia
            return [] # No pueden existir tareas generadas sin analista
        else:
                query = query.where(models.TareaGeneradaPorAviso.analista_asignado_id == analista_id)
    
    

    # --- INICIO DE CAMBIOS: Aplicar nuevos filtros a la consulta ---
    if aviso_origen_id:
        query = query.where(models.TareaGeneradaPorAviso.aviso_origen_id == aviso_origen_id)
    if estado:
        query = query.where(models.TareaGeneradaPorAviso.progreso == estado)
    if fecha_desde:
        query = query.where(models.TareaGeneradaPorAviso.fecha_vencimiento >= fecha_desde)
    if fecha_hasta:
        query = query.where(models.TareaGeneradaPorAviso.fecha_vencimiento < (fecha_hasta + timedelta(days=1)))
    # --- FIN DE CAMBIOS ---
    
    
    tareas = await db.execute(query)
    return tareas.scalars().unique().all()


@router.get("/tareas_generadas_por_avisos/{tarea_id}", response_model=TareaGeneradaPorAviso, summary="Obtener Tarea Generada por Aviso por ID (Protegido)")
async def get_tarea_generada_por_aviso_by_id(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene una tarea generada por aviso específica por su ID.
    Requiere autenticación.
    Un analista normal solo ve las tareas asignadas a él.
    """
    result = await db.execute(
        select(models.TareaGeneradaPorAviso)
        .filter(models.TareaGeneradaPorAviso.id == tarea_id)
        .options(
            selectinload(models.TareaGeneradaPorAviso.analista_asignado),
            selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.TareaGeneradaPorAviso.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista) # Cargar historial con el analista que hizo el cambio
        )
    )
    tarea = result.scalars().first()
    if not tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea generada por aviso no encontrada.")
    
    if current_analista.role == UserRole.ANALISTA.value and tarea.analista_asignado_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta tarea.")

    return tarea


@router.put("/tareas_generadas_por_avisos/{tarea_id}", response_model=TareaGeneradaPorAviso, summary="Actualizar una Tarea Generada por Aviso (Protegido)")
async def update_tarea_generada_por_aviso(
    tarea_id: int,
    tarea_update: TareaGeneradaPorAvisoUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    current_analista_id = current_analista.id

    db_tarea_result = await db.execute(
        select(models.TareaGeneradaPorAviso)
        .filter(models.TareaGeneradaPorAviso.id == tarea_id)
        .options(
            selectinload(models.TareaGeneradaPorAviso.analista_asignado),
            selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.TareaGeneradaPorAviso.historial_estados)
        )
    )
    tarea_existente = db_tarea_result.scalars().first()

    if tarea_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea generada por aviso no encontrada.")

    update_data = tarea_update.model_dump(exclude_unset=True)
    old_progreso = tarea_existente.progreso

    # --- 👇 AQUÍ ESTÁ LA CORRECCIÓN, IGUAL QUE EN LA OTRA FUNCIÓN ---
    # Comparamos los valores de texto (.value) para ser 100% seguros
    if current_analista.role.value == UserRole.ANALISTA.value:
        if tarea_existente.analista_asignado_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo puedes actualizar tus propias tareas generadas.")
        
        # Un analista solo puede actualizar el progreso
        if "progreso" in update_data:
            tarea_existente.progreso = update_data["progreso"]
        else:
            # Si el payload no incluye 'progreso', no se permite la actualización para un Analista.
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Los analistas solo pueden actualizar el progreso de sus tareas generadas.")

    elif current_analista.role.value in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        for key, value in update_data.items():
            if key == "fecha_vencimiento" and value is not None:
                setattr(tarea_existente, key, value.replace(tzinfo=None))
            else:
                setattr(tarea_existente, key, value)
    # --- 👆 FIN DE LA CORRECCIÓN ---
    
    else:
        # Este else se activaba incorrectamente antes de la corrección
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar tareas generadas con tu rol actual.")

    if "progreso" in update_data and tarea_existente.progreso != old_progreso:
        historial_entry = models.HistorialEstadoTarea(
            old_progreso=old_progreso,
            new_progreso=tarea_existente.progreso,
            changed_by_analista_id=current_analista_id,
            tarea_generada_id=tarea_existente.id
        )
        db.add(historial_entry)

        if tarea_existente.progreso in [ProgresoTarea.COMPLETADA, ProgresoTarea.CANCELADA]:
            tarea_existente.fecha_finalizacion = datetime.utcnow().replace(tzinfo=None)
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
            detail=f"Error inesperado al actualizar tarea generada: {e}"
        )
    
    result = await db.execute(
        select(models.TareaGeneradaPorAviso)
        .filter(models.TareaGeneradaPorAviso.id == tarea_existente.id)
        .options(
            selectinload(models.TareaGeneradaPorAviso.analista_asignado),
            selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            selectinload(models.TareaGeneradaPorAviso.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista)
        )
    )
    return result.scalars().first()

@router.delete("/tareas_generadas_por_avisos/{tarea_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar una Tarea Generada por Aviso (Protegido por Supervisor)")
async def delete_tarea_generada_por_aviso(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    """
    Elimina una tarea generada por aviso existente.
    Requiere autenticación y rol de SUPERVISOR.
    """
    db_tarea_result = await db.execute(select(models.TareaGeneradaPorAviso).where(models.TareaGeneradaPorAviso.id == tarea_id))
    tarea_a_eliminar = db_tarea_result.scalars().first()

    if tarea_a_eliminar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea generada por aviso no encontrada.")

    try:
        await db.delete(tarea_a_eliminar)
        # Opcional: Eliminar los historial_estados relacionados si no se hace en cascada a nivel de DB
        # await db.execute(delete(models.HistorialEstadoTarea).where(models.HistorialEstadoTarea.tarea_generada_id == tarea_id))
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al eliminar tarea generada: {e}"
        )
    return

# NUEVO ENDPOINT: Obtener historial de estados para una tarea específica
@router.get("/tareas/{tarea_id}/historial_estados", response_model=List[HistorialEstadoTarea], summary="Obtener Historial de Estados de una Tarea (Protegido)")
async def get_tarea_historial_estados(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene el historial de cambios de estado para una tarea de campaña específica.
    Requiere autenticación. Un analista normal solo ve el historial de sus propias tareas.
    """
    tarea_existente_result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    tarea_existente = tarea_existente_result.scalars().first()
    if not tarea_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")

    # Permiso para ver el historial:
    # Supervisor/Responsable: pueden ver cualquier historial
    # Analista: solo si la tarea le pertenece
    if current_analista.role == UserRole.ANALISTA.value and tarea_existente.analista_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver el historial de esta tarea.")

    result = await db.execute(
        select(models.HistorialEstadoTarea)
        .filter(models.HistorialEstadoTarea.tarea_campana_id == tarea_id)
        .options(selectinload(models.HistorialEstadoTarea.changed_by_analista)) # Cargar el analista que hizo el cambio
        .order_by(models.HistorialEstadoTarea.timestamp) # Ordenar por fecha para ver la secuencia
    )
    historial = result.scalars().unique().all()
    return historial

# NUEVO ENDPOINT: Obtener historial de estados para una tarea generada por aviso específica
@router.get("/tareas_generadas_por_avisos/{tarea_id}/historial_estados", response_model=List[HistorialEstadoTarea], summary="Obtener Historial de Estados de una Tarea Generada por Aviso (Protegido)")
async def get_tarea_generada_historial_estados(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene el historial de cambios de estado para una tarea generada por aviso específica.
    Requiere autenticación. Un analista normal solo ve el historial de sus propias tareas.
    """
    tarea_existente_result = await db.execute(select(models.TareaGeneradaPorAviso).filter(models.TareaGeneradaPorAviso.id == tarea_id))
    tarea_existente = tarea_existente_result.scalars().first()
    if not tarea_existente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea generada por aviso no encontrada.")

    # Permiso para ver el historial:
    # Supervisor/Responsable: pueden ver cualquier historial
    # Analista: solo si la tarea le pertenece
    if current_analista.role == UserRole.ANALISTA.value and tarea_existente.analista_asignado_id != current_analista.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver el historial de esta tarea.")

    result = await db.execute(
        select(models.HistorialEstadoTarea)
        .filter(models.HistorialEstadoTarea.tarea_generada_id == tarea_id)
        .options(selectinload(models.HistorialEstadoTarea.changed_by_analista)) # Cargar el analista que hizo el cambio
        .order_by(models.HistorialEstadoTarea.timestamp) # Ordenar por fecha para ver la secuencia
    )
    historial = result.scalars().unique().all()
    return historial


# --- ENDPOINTS PARA DASHBOARD ---

@router.get(
    "/dashboard/stats", 
    response_model=Union[DashboardStatsAnalista, DashboardStatsSupervisor],
    summary="Obtener estadísticas para el Dashboard según el rol del usuario"
)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Devuelve un conjunto de estadísticas para el dashboard.
    - Para ANALISTAS: Devuelve el conteo de incidencias sin asignar, 
      las asignadas a él y la lista de incidencias activas del día en sus campañas.
    - Para SUPERVISORES: Devuelve el conteo total de incidencias activas en el sistema.
    """
    today_start = datetime.combine(date.today(), time.min)
    today_end = datetime.combine(date.today(), time.max)
    
    # Si el usuario es Supervisor o Responsable
    if current_analista.role in [UserRole.SUPERVISOR, UserRole.RESPONSABLE]:
        # Contar todas las incidencias abiertas o en progreso
        query = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.estado.in_([EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO])
        )
        result = await db.execute(query)
        total_activas = result.scalar_one()
        return DashboardStatsSupervisor(total_incidencias_activas=total_activas)

    # Si el usuario es Analista
    elif current_analista.role == UserRole.ANALISTA:
        assigned_campaign_ids = [c.id for c in current_analista.campanas_asignadas]
        
        if not assigned_campaign_ids:
             # Si no tiene campañas, devuelve ceros para evitar errores.
             return DashboardStatsAnalista(
                 incidencias_sin_asignar=0,
                 mis_incidencias_asignadas=0,
                 incidencias_del_dia=[]
             )

        # 1. Contar incidencias sin asignar en sus campañas
        unassigned_query = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.campana_id.in_(assigned_campaign_ids),
            models.Incidencia.asignado_a_id.is_(None)
        )
        unassigned_result = await db.execute(unassigned_query)
        unassigned_count = unassigned_result.scalar_one()

        # 2. Contar incidencias asignadas a él
        my_assigned_query = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.asignado_a_id == current_analista.id
        )
        my_assigned_result = await db.execute(my_assigned_query)
        my_assigned_count = my_assigned_result.scalar_one()

        # 3. Obtener lista de incidencias del día (abiertas o en progreso) en sus campañas
        daily_incidents_query = select(models.Incidencia).options(
            selectinload(models.Incidencia.campana)
        ).filter(
            models.Incidencia.campana_id.in_(assigned_campaign_ids),
            models.Incidencia.estado.in_([EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO]),
            models.Incidencia.fecha_apertura.between(today_start, today_end)
        ).order_by(models.Incidencia.fecha_apertura.desc())
        
        daily_incidents_result = await db.execute(daily_incidents_query)
        daily_incidents = daily_incidents_result.scalars().unique().all()

        return DashboardStatsAnalista(
            incidencias_sin_asignar=unassigned_count,
            mis_incidencias_asignadas=my_assigned_count,
            incidencias_del_dia=daily_incidents
        )
    
    # Por si acaso, si hay un rol no contemplado
    raise HTTPException(status_code=403, detail="Rol de usuario no tiene un dashboard definido.")
