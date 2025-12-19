# /backend/routers/gtr_router.py

import pandas as pd
import io
import bleach
import pytz
import traceback
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from ..schemas.models import Campana, AnalistaConCampanas
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Union
from datetime import datetime, date, time
from sqlalchemy import func, and_
from sqlalchemy import case, text, select, delete, update
from ..database import get_db
from ..sql_app import models
from ..enums import UserRole, ProgresoTarea, EstadoIncidencia, GravedadIncidencia
from ..dependencies import get_current_analista, require_role
from ..sql_app.crud import get_analista_by_email
from fastapi.responses import StreamingResponse
from ..sql_app import crud

# --- IMPORTS COMPLETOS DE SCHEMAS PARA GTR ---
from ..schemas.models import (
    Analista, AnalistaCreate, AnalistaSimple, AnalistaBase, PasswordUpdate, AnalistaListado,
    Campana, CampanaBase, CampanaSimple,
    Tarea, TareaBase, TareaSimple, TareaListOutput, TareaUpdate,
    ChecklistItem, ChecklistItemBase, ChecklistItemSimple, ChecklistItemUpdate,
    PlantillaChecklistItem, PlantillaChecklistItemCreate,
    HistorialEstadoTarea,
    ComentarioTarea, ComentarioTareaCreate,
    Aviso, AvisoBase, AvisoListOutput, AvisoSimple,
    AcuseReciboAviso, AcuseReciboCreate, AcuseReciboAvisoSimple,
    BitacoraEntry, BitacoraEntryBase, BitacoraEntryUpdate, Lob,
    ComentarioGeneralBitacora, ComentarioGeneralBitacoraCreate, BitacoraExportFilters,
    Incidencia, IncidenciaCreate, IncidenciaSimple, IncidenciaEstadoUpdate,IncidenciaUpdate, IncidenciaExportFilters,
    ActualizacionIncidencia, ActualizacionIncidenciaBase,
    DashboardStatsAnalista, DashboardStatsSupervisor,
    TareaGeneradaPorAviso, TareaGeneradaPorAvisoUpdate, TareaGeneradaPorAvisoBase,
    DashboardIncidenciaWidget, WidgetAnalista, WidgetCampana,
    CheckInCreate,
    SesionActiva
)
from ..security import get_password_hash # El endpoint crear_analista la necesita


# --- Creación del Router ---
router = APIRouter(
    tags=["Portal GTR"] # Etiqueta para agrupar en la documentación
)


@router.get("/tareas/", response_model=List[Tarea], summary="Listar tareas pendientes globales")
async def obtener_tareas(
    skip: int = 0, 
    limit: int = 100, 
    estado: Optional[ProgresoTarea] = None, 
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Muestra las tareas de cualquier campaña con TODA su información cargada.
    Incluye una LIMPIEZA AUTOMÁTICA de tareas vencidas.
    """
    
    # --- 🧹 BARRENDERO AUTOMÁTICO ---
    # Si una tarea ya venció (fecha_vencimiento < ahora) y sigue PENDIENTE o EN_PROGRESO,
    # la cerramos automáticamente como CANCELADA para que no moleste hoy.
    now = datetime.now()
    
    # Nota: Asegúrate de que tu servidor tenga la hora correcta o usa datetime.utcnow() si guardas en UTC.
    # Aquí asumimos que fecha_vencimiento es "naive" o compatible con 'now'.
    
    query_limpieza = (
        update(models.Tarea)
        .where(
            models.Tarea.fecha_vencimiento < now,
            models.Tarea.progreso.in_([ProgresoTarea.PENDIENTE, ProgresoTarea.EN_PROGRESO])
        )
        .values(progreso=ProgresoTarea.CANCELADA)
        .execution_options(synchronize_session=False)
    )
    
    # Ejecutamos la limpieza (es muy rápida)
    await db.execute(query_limpieza)
    await db.commit()
    # -------------------------------

    # Consulta base con carga PROFUNDA de relaciones (Código original sigue aquí...)
    query = select(models.Tarea).options(
        selectinload(models.Tarea.campana),
        selectinload(models.Tarea.analista),
        selectinload(models.Tarea.checklist_items),
        selectinload(models.Tarea.historial_estados),
        selectinload(models.Tarea.comentarios)
    )

    # Filtro opcional por estado
    if estado:
        query = query.filter(models.Tarea.progreso == estado)

    # Ordenamos por vencimiento más próximo o creación
    query = query.order_by(models.Tarea.fecha_vencimiento.asc(), models.Tarea.fecha_creacion.desc())
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/campanas/listado-simple/", response_model=List[CampanaSimple], summary="Obtener una lista simple de campañas para selectores")
async def obtener_campanas_simple(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Devuelve una lista ligera de campañas (ID, nombre) ideal para poblar
    menús desplegables en el frontend sin sobrecargar la API.
    """
    query = select(models.Campana).order_by(models.Campana.nombre)
    result = await db.execute(query)
    campanas = result.scalars().all()
    return campanas

# --- Endpoints para Analistas (Protegidos) ---

@router.post("/analistas/", response_model=Analista, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Analista (Protegido por Supervisor/Responsable)")
async def crear_analista(
    analista: AnalistaCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    # ... (la validación de email y bms_id no cambia) ...
    existing_analista_by_email = await get_analista_by_email(analista.email, db)
    if existing_analista_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado.")
    
    result_bms = await db.execute(select(models.Analista).filter(models.Analista.bms_id == analista.bms_id))
    existing_analista_by_bms = result_bms.scalars().first()
    if existing_analista_by_bms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")

    # --- INICIO DE LA CORRECCIÓN ---
    # 1. Convertimos el objeto Pydantic a un diccionario
    analista_data = analista.model_dump()
    
    # 2. Si el RUT es una cadena vacía, lo convertimos a None para que la BD lo guarde como NULL
    if "rut" in analista_data and not analista_data["rut"]:
        analista_data["rut"] = None
        
    hashed_password = get_password_hash(analista_data.pop("password"))
    
    db_analista = models.Analista(**analista_data, hashed_password=hashed_password)
    # --- FIN DE LA CORRECCIÓN ---
    
    db.add(db_analista)
    try:
        await db.commit()
        await db.refresh(db_analista)
        
        # --- CORRECCIÓN PARA EL ERROR MissingGreenlet ---
        # Recargamos el analista con TODAS las relaciones necesarias
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == db_analista.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos),
                selectinload(models.Analista.incidencias_creadas).selectinload(models.Incidencia.campana),
                selectinload(models.Analista.incidencias_asignadas),
                selectinload(models.Analista.solicitudes_realizadas),
                selectinload(models.Analista.solicitudes_gestionadas)
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la creación.")
        
        return analista_to_return
    except Exception as e:
        await db.rollback()
        # Manejo de error de duplicado de RUT
        if 'UniqueViolationError' in str(e) and 'analistas_rut_key' in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El RUT ingresado ya existe.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear analista: {e}"
        )

@router.get("/analistas/", response_model=List[AnalistaListado], summary="Obtener todos los Analistas Activos para la tabla principal")
async def obtener_analistas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Devuelve una lista de analistas con los campos necesarios para la tabla principal.
    Esta consulta es simple y eficiente, no carga relaciones anidadas innecesarias.
    """
    query = select(models.Analista).where(models.Analista.esta_activo == True).order_by(models.Analista.nombre)
    
    result = await db.execute(query)
    analistas = result.scalars().all()
    
    return analistas

@router.get("/analistas/listado-simple/", response_model=List[AnalistaSimple], summary="Obtener una lista simple de analistas para selectores")
async def obtener_analistas_simple(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA]))
):
    """
    Devuelve una lista ligera de analistas (ID, nombre, apellido, email, rol)
    ideal para poblar menús desplegables en el frontend sin sobrecargar la API.
    """
    query = select(models.Analista).where(
        models.Analista.esta_activo == True,
        models.Analista.role != UserRole.SUPERVISOR_OPERACIONES
    ).order_by(models.Analista.nombre)
    
    result = await db.execute(query)
    analistas = result.scalars().all()
    return analistas

@router.get("/analistas/{analista_id}", response_model=Analista, summary="Obtener Analista por ID")
async def obtener_analista_por_id(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    # SOLUCIÓN 1: Evitamos la doble consulta si se pide el perfil propio
    if analista_id == current_analista.id:
        return current_analista

    # SOLUCIÓN 2: Consulta ultra-completa para cargar todas las relaciones anidadas necesarias
    result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id, models.Analista.esta_activo == True)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.avisos_creados).selectinload(models.Aviso.campana),
            selectinload(models.Analista.acuses_recibo_avisos).selectinload(models.AcuseReciboAviso.aviso),
            selectinload(models.Analista.tareas_generadas_por_avisos).selectinload(models.TareaGeneradaPorAviso.aviso_origen),
            
            # --- Corrección Definitiva para Incidencias ---
            selectinload(models.Analista.incidencias_creadas).options(
                selectinload(models.Incidencia.campana), 
                selectinload(models.Incidencia.lobs)
            ),
            selectinload(models.Analista.incidencias_asignadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs)
            ),
            # --- Fin de la Corrección ---

            selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
            selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante)
        )
    )
    analista = result.scalars().first()
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado o inactivo.")
    
    if current_analista.role == UserRole.ANALISTA.value and current_analista.id != analista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este perfil.")

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
    db_analista_result = await db.execute(select(models.Analista).where(models.Analista.id == analista_id))
    analista_existente = db_analista_result.scalars().first()

    if analista_existente is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado")


    if current_analista.role == UserRole.RESPONSABLE.value and analista_existente.role != UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede editar perfiles de Analistas normales.")
    
    if current_analista.role == UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Los analistas no pueden usar este endpoint para actualizar su perfil.")


    analista_data = analista_update.model_dump(exclude_unset=True)
    if "rut" in analista_data and not analista_data["rut"]:
        analista_data["rut"] = None
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
                selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
                selectinload(models.Analista.avisos_creados).selectinload(models.Aviso.campana),
                selectinload(models.Analista.acuses_recibo_avisos).selectinload(models.AcuseReciboAviso.aviso),
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

    # Lógica de permisos
    if current_analista.role == UserRole.ANALISTA.value and current_analista.id != analista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para actualizar esta contraseña.")
    
    if current_analista.role == UserRole.RESPONSABLE.value and analista_a_actualizar.role != UserRole.ANALISTA.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Responsable solo puede actualizar la contraseña de Analistas normales.")
    
    hashed_password = get_password_hash(password_update.new_password)
    analista_a_actualizar.hashed_password = hashed_password

    try:
        await db.commit()
        await db.refresh(analista_a_actualizar)
        
        # --- CORRECCIÓN AQUÍ: Consulta de recarga completa ---
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_a_actualizar.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas),
                selectinload(models.Analista.avisos_creados),
                selectinload(models.Analista.acuses_recibo_avisos),
                selectinload(models.Analista.tareas_generadas_por_avisos),
                selectinload(models.Analista.incidencias_creadas).selectinload(models.Incidencia.campana),
                selectinload(models.Analista.incidencias_asignadas),
                selectinload(models.Analista.solicitudes_realizadas),
                selectinload(models.Analista.solicitudes_gestionadas)
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
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.avisos_creados).selectinload(models.Aviso.campana),
            selectinload(models.Analista.acuses_recibo_avisos).selectinload(models.AcuseReciboAviso.aviso),
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
    analista_to_return = result.scalars().first()
    if not analista_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la asignación.")
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
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.avisos_creados).selectinload(models.Aviso.campana),
            selectinload(models.Analista.acuses_recibo_avisos).selectinload(models.AcuseReciboAviso.aviso),
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
    analista_to_return = result.scalars().first()
    if not analista_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la desasignación.")
    return analista_to_return

# --- Endpoints para Campañas (Protegidos) ---

@router.post("/campanas/", response_model=Campana, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Campaña (Protegido por Supervisor/Responsable)")
async def crear_campana(
    campana_data: CampanaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    # (La primera parte de la función se mantiene igual)
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
                db_lob = models.LOB(nombre=nombre_lob_limpio, campana_id=db_campana.id)
                db.add(db_lob)
        try:
            await db.commit()
            await db.refresh(db_campana)
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Error al crear los LOBs: {e}")


    # Recargamos la campaña con TODAS las relaciones que el schema 'Campana' espera
    result = await db.execute(
        select(models.Campana)
        .options(
            selectinload(models.Campana.lobs),
            selectinload(models.Campana.analistas_asignados),
            selectinload(models.Campana.comentarios_generales) # <-- Añadido para que coincida con el schema
        )
        .filter(models.Campana.id == db_campana.id)
    )
  
    
    campana_to_return = result.scalars().first()
    if not campana_to_return:
         raise HTTPException(status_code=500, detail="Error al recargar la campaña después de la creación.")

    return campana_to_return



@router.get("/campanas/", response_model=List[Campana], summary="Listar todas las campañas activas")
async def obtener_campanas(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Devuelve todas las campañas del sistema con sus relaciones cargadas.
    """
    # Consulta con carga explícita de relaciones para evitar MissingGreenlet
    query = select(models.Campana).options(
        selectinload(models.Campana.lobs),
        selectinload(models.Campana.analistas_asignados) # Cargamos esta relación también
    ).order_by(models.Campana.nombre.asc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    campanas = result.scalars().all()
    return campanas

@router.get("/campanas/tareas_disponibles", response_model=List[Tarea], summary="Endpoint específico para tareas disponibles")
async def obtener_tareas_disponibles_campana(
    skip: int = 0, 
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Endpoint específico para evitar conflicto con rutas dinámicas.
    Redirige a la lógica general de obtener tareas.
    """
    # Reutilizamos la misma lógica que /tareas/
    query = select(models.Tarea).options(
        selectinload(models.Tarea.campana),
        selectinload(models.Tarea.analista),
        selectinload(models.Tarea.checklist_items),
        selectinload(models.Tarea.historial_estados),
        selectinload(models.Tarea.comentarios)
    ).order_by(models.Tarea.fecha_vencimiento.asc(), models.Tarea.fecha_creacion.desc())
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

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
            selectinload(models.Campana.comentarios_generales).selectinload(models.ComentarioGeneralBitacora.autor),
            selectinload(models.Campana.incidencias).selectinload(models.Incidencia.creador),
            # --- ESTA ES LA LÍNEA CLAVE Y CORREGIDA ---
            selectinload(models.Campana.lobs)
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
    # --- INICIO DE LA LÍNEA DE DEPURACIÓN ---
    # Esta línea nos mostrará exactamente qué datos llegan desde el frontend.
    print(f"\n\n--- [DEBUG] DATOS CRUDOS RECIBIDOS POR LA API ---\n{campana_update.model_dump_json(indent=2)}\n---------------------------------------------\n\n")
    # --- FIN DE LA LÍNEA DE DEPURACIÓN ---

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
            campana_existente.lobs.clear()
            await db.flush()

            for nombre in nuevos_lobs_nombres:
                if nombre.strip():
                    nuevo_lob = models.LOB(nombre=bleach.clean(nombre.strip()), campana_id=campana_existente.id)
                    db.add(nuevo_lob)
        
        await db.commit()
        await db.refresh(campana_existente)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al actualizar campaña: {e}"
        )
    
    # Recargamos la campaña con los datos necesarios para la respuesta
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


# --- Endpoints para Tareas ---


@router.get("/tareas/", response_model=List[Tarea], summary="Listar tareas pendientes globales")
async def obtener_tareas(
    skip: int = 0, 
    limit: int = 100, 
    estado: Optional[ProgresoTarea] = None, 
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Muestra las tareas de cualquier campaña con TODA su información cargada.
    """
    # Consulta base con carga PROFUNDA de relaciones
    query = select(models.Tarea).options(
        selectinload(models.Tarea.campana),
        selectinload(models.Tarea.analista),
        selectinload(models.Tarea.checklist_items),
        selectinload(models.Tarea.historial_estados),
        selectinload(models.Tarea.comentarios)
    )

    # Filtro opcional por estado
    if estado:
        query = query.filter(models.Tarea.progreso == estado)

    # Ordenamos por vencimiento más próximo o creación
    query = query.order_by(models.Tarea.fecha_vencimiento.asc(), models.Tarea.fecha_creacion.desc())
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/tareas/{tarea_id}", response_model=Tarea, summary="Obtener Tarea por ID (Protegido)")
async def obtener_tarea_por_id(
    tarea_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Obtiene una tarea específica por su ID.
    Permite el acceso si eres el dueño O si tienes una sesión activa en la campaña (Colaborativo).
    """
    # Paso 1: Obtener el objeto Tarea
    result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    tarea_db = result.scalars().first()
    
    if not tarea_db:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")
    
    # Paso 2: Verificar los permisos (LÓGICA COLABORATIVA ACTUALIZADA)
    if current_analista.role.value == UserRole.ANALISTA.value:
        # A. ¿Soy el dueño asignado?
        es_dueno = tarea_db.analista_id == current_analista.id
        
        # B. ¿Tengo sesión activa en esta campaña? (Para tareas compartidas)
        tiene_acceso_colaborativo = False
        if tarea_db.es_generada_automaticamente and tarea_db.campana_id:
            # Consultamos si existe una sesión activa para este analista en esta campaña
            session_q = select(models.SesionCampana).filter(
                models.SesionCampana.analista_id == current_analista.id,
                models.SesionCampana.campana_id == tarea_db.campana_id,
                models.SesionCampana.fecha_fin.is_(None)
            )
            session_res = await db.execute(session_q)
            if session_res.scalars().first():
                tiene_acceso_colaborativo = True

        if not es_dueno and not tiene_acceso_colaborativo:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta tarea (ni dueño ni sesión activa).")

    # Paso 3: Cargar todas las relaciones necesarias (Igual que antes)
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

    # Paso 4: Construir respuesta
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
        es_generada_automaticamente=tarea_db.es_generada_automaticamente, # ¡Importante!
        analista=AnalistaSimple.model_validate(analista) if analista else None,
        campana=CampanaSimple.model_validate(campana) if campana else None,
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
    Permite comentarios colaborativos si hay sesión activa en la campaña.
    """
    # 1. Verificar que la tarea existe
    tarea_result = await db.execute(select(models.Tarea).filter(models.Tarea.id == tarea_id))
    db_tarea = tarea_result.scalars().first()
    if not db_tarea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarea no encontrada.")

    # 2. Verificar permisos (LÓGICA COLABORATIVA)
    if current_analista.role == UserRole.ANALISTA.value:
        # A. Soy el dueño
        es_dueno = db_tarea.analista_id == current_analista.id
        
        # B. Tengo sesión activa en la campaña
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

    # 3. Guardar el comentario
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
        raise HTTPException(status_code=500, detail=f"Error al guardar comentario: {e}")

    # 4. Recargar para devolver con datos del autor (para mostrar nombre en el chat)
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
    Crea un nuevo elemento de checklist. 
    Permite creación colaborativa si hay sesión activa en la campaña de la tarea.
    """
    tarea_existente_result = await db.execute(select(models.Tarea).filter(models.Tarea.id == item.tarea_id))
    tarea_existente = tarea_existente_result.scalars().first()
    
    if tarea_existente is None:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    if current_analista.role == UserRole.ANALISTA.value:
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

    if current_analista.role == UserRole.ANALISTA.value:
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
            
    elif current_analista.role in [UserRole.SUPERVISOR.value, UserRole.RESPONSABLE.value]:
        # (Lógica de supervisor se mantiene igual...)
        if "tarea_id" in update_data and update_data["tarea_id"] != item_existente.tarea_id:
            # ... validación de tarea ...
            pass # (Aquí iría tu lógica existente de reasignación de tarea si la usas)
        
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

@router.get("/avisos/", response_model=List[Aviso], summary="Ver tablón de anuncios global")
async def obtener_avisos(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Muestra los avisos vigentes.
    Visibilidad total.
    """
    hoy = datetime.now()
    
    # Traemos avisos que no hayan vencido (o que no tengan fecha de vencimiento)
    query = select(models.Aviso).options(
        selectinload(models.Aviso.creador),
        selectinload(models.Aviso.campana)
    ).filter(
        (models.Aviso.fecha_vencimiento >= hoy) | (models.Aviso.fecha_vencimiento == None)
    ).order_by(models.Aviso.fecha_creacion.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


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

@router.get("/analistas/con-campanas/", response_model=List[AnalistaConCampanas], summary="Obtener todos los Analistas con sus campañas para la página de asignación")
async def obtener_analistas_con_campanas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Devuelve una lista de analistas activos, incluyendo solo la relación 
    con las campañas que ya tienen asignadas. Es una consulta ligera y eficiente.
    """
    query = select(models.Analista).options(
        selectinload(models.Analista.campanas_asignadas)
    ).where(models.Analista.esta_activo == True).order_by(models.Analista.nombre)
    
    result = await db.execute(query)
    analistas = result.scalars().unique().all()
    
    return analistas


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
    
    result = await db.execute(
    select(models.BitacoraEntry)
    .options(
        # Todos los selectinload van dentro de un solo .options()
        selectinload(models.BitacoraEntry.campana),
        selectinload(models.BitacoraEntry.autor),
        selectinload(models.BitacoraEntry.lob)
    )
    .filter(
        models.BitacoraEntry.campana_id == campana_id, 
        models.BitacoraEntry.fecha == fecha
    )
    .order_by(models.BitacoraEntry.hora)
)
    entries = result.scalars().all()
    return entries

@router.get("/campanas/{campana_id}/lobs", response_model=List[Lob], summary="Obtener LOBs de una Campaña específica")
async def obtener_lobs_por_campana(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Devuelve una lista de todos los LOBs asociados a una campaña específica.
    """
    query = select(models.LOB).where(models.LOB.campana_id == campana_id)
    result = await db.execute(query)
    lobs = result.scalars().all()
    
    if not lobs:
        # No es un error si una campaña no tiene LOBs, simplemente se devuelve una lista vacía.
        return []
        
    return lobs

@router.post("/bitacora_entries/", response_model=BitacoraEntry, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Entrada de Bitácora")
async def create_bitacora_entry(
    entry: BitacoraEntryBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    # Validamos que la campaña exista
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == entry.campana_id))
    if not campana_existente_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")
    
    # 1. Definimos la zona horaria de referencia
    tucuman_tz = pytz.timezone("America/Argentina/Tucuman")
    # 2. Calculamos la fecha correcta en esa zona horaria
    fecha_correcta = datetime.now(tucuman_tz).date()

    # 3. Verificamos si ya existe una entrada para esa hora, usando la fecha correcta
    query_existente = select(models.BitacoraEntry).filter(
        models.BitacoraEntry.fecha == fecha_correcta,
        models.BitacoraEntry.hora == entry.hora,
        models.BitacoraEntry.campana_id == entry.campana_id,
        models.BitacoraEntry.lob_id == entry.lob_id
    )
    result_existente = await db.execute(query_existente)
    if result_existente.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un evento registrado en la misma franja horaria para esta campaña y LOB."
        )
    now_utc = datetime.now(pytz.utc)
    
    datos_limpios = entry.model_dump(exclude={"fecha"})
    if datos_limpios.get("comentario"):
        datos_limpios["comentario"] = bleach.clean(datos_limpios["comentario"])
    
    db_entry = models.BitacoraEntry(
        **datos_limpios,
        fecha=fecha_correcta, 
        autor_id=current_analista.id,
        # 3. Asignamos los timestamps directamente en el código
        fecha_creacion=now_utc,
        fecha_ultima_actualizacion=now_utc
    )
    
    db.add(db_entry)
    await db.commit()

    # El resto de la función para recargar y devolver la entrada se mantiene
    result = await db.execute(
        select(models.BitacoraEntry).options(
            selectinload(models.BitacoraEntry.campana), 
            selectinload(models.BitacoraEntry.autor),
            selectinload(models.BitacoraEntry.lob)
        ).filter(models.BitacoraEntry.id == db_entry.id)
    )
    return result.scalars().first()



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
        .options(
            selectinload(models.BitacoraEntry.campana),
            selectinload(models.BitacoraEntry.autor),
            selectinload(models.BitacoraEntry.lob)
        )
    )
    db_entry = db_entry_result.scalars().first()
    if not db_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada de bitácora no encontrada.")

    update_data = entry_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_entry, field, value)
    
    db_entry.fecha_ultima_actualizacion = datetime.now(pytz.utc)

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
        .options(
            selectinload(models.BitacoraEntry.campana),
            selectinload(models.BitacoraEntry.autor) # <-- Y AQUÍ TAMBIÉN
        )
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

@router.get("/bitacora/log_de_hoy/{campana_id}", response_model=List[BitacoraEntry], summary="Obtiene el log del día operativo actual (Hora de Argentina)")
async def get_log_de_hoy(
    campana_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene las entradas de la bitácora para el día operativo actual,
    definido por la zona horaria de Argentina (ART/UTC-3),
    independientemente de la ubicación del usuario o del servidor.
    """
    try:
        # 1. Establecemos la zona horaria de referencia para la operación
        tz_argentina = pytz.timezone("America/Argentina/Tucuman")

        # 2. Obtenemos el momento actual en esa zona horaria
        now_in_argentina = datetime.now(tz_argentina)

        # 3. Determinamos el inicio y el fin del "día de hoy" en Argentina
        start_of_day_local = now_in_argentina.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day_local = now_in_argentina.replace(hour=23, minute=59, second=59, microsecond=999999)

        # 4. Construimos la consulta usando el timestamp `fecha_creacion`,
        # que es la fuente de verdad del momento exacto del registro.
        # Asumimos que `fecha_creacion` está en UTC, como confirman tus datos.
        query = select(models.BitacoraEntry).options(
            selectinload(models.BitacoraEntry.autor),
            selectinload(models.BitacoraEntry.campana),
            selectinload(models.BitacoraEntry.lob)
        ).filter(
            models.BitacoraEntry.campana_id == campana_id,
            models.BitacoraEntry.fecha_creacion >= start_of_day_local,
            models.BitacoraEntry.fecha_creacion <= end_of_day_local
        ).order_by(
            models.BitacoraEntry.hora.desc()
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al calcular el log del día: {e}")



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
    datos_limpios = incidencia_data.model_dump()
    # ... (tu código para limpiar con bleach)

    lob_ids = datos_limpios.pop("lob_ids", [])
    db_incidencia = models.Incidencia(**datos_limpios,
                                    creador_id=current_analista.id,
                                    asignado_a_id=current_analista.id,
                                    estado=EstadoIncidencia.EN_PROGRESO)

    if lob_ids:
        lobs_result = await db.execute(select(models.LOB).filter(models.LOB.id.in_(lob_ids)))
        db_incidencia.lobs = lobs_result.scalars().all()

    db.add(db_incidencia)
    await db.commit()
    await db.refresh(db_incidencia)

    return await get_incidencia_by_id(db_incidencia.id, db, current_analista)

@router.get("/incidencias/", response_model=List[IncidenciaSimple], summary="Obtener lista de Incidencias")
async def get_incidencias(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.Incidencia).options(
        selectinload(models.Incidencia.campana)
    ).order_by(models.Incidencia.fecha_apertura.desc())

    
    result = await db.execute(query)
    return result.scalars().unique().all()

@router.put("/incidencias/{incidencia_id}", response_model=Incidencia, summary="Actualizar los detalles de una Incidencia")
async def update_incidencia(
    incidencia_id: int,
    update_data: IncidenciaUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA]))
):
    result = await db.execute(select(models.Incidencia).options(selectinload(models.Incidencia.lobs)).filter(models.Incidencia.id == incidencia_id))
    db_incidencia = result.scalars().first()
    if not db_incidencia:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    update_dict = update_data.model_dump(exclude_unset=True)
    campos_a_sanitizar = ['titulo', 'descripcion_inicial', 'herramienta_afectada', 'indicador_afectado']
    
    for campo in campos_a_sanitizar:
        if campo in update_dict and update_dict[campo]:
            update_dict[campo] = bleach.clean(update_dict[campo])

    if "lob_ids" in update_dict:
        lob_ids = update_dict.pop("lob_ids")
        if lob_ids:
            lobs_result = await db.execute(select(models.LOB).filter(models.LOB.id.in_(lob_ids)))
            db_incidencia.lobs = lobs_result.scalars().all()
        else:
            db_incidencia.lobs = []


    historial_comentarios = []
    tz_argentina = pytz.timezone("America/Argentina/Tucuman") # Zona horaria de referencia

    for key, value in update_dict.items():
        old_value = getattr(db_incidencia, key)
        if old_value != value:
            
            # Si el campo es una fecha, la formateamos
            if isinstance(value, datetime):
                # Aseguramos que el valor antiguo tenga zona horaria para poder convertirlo
                old_value_aware = old_value.astimezone(pytz.utc) if old_value.tzinfo is None else old_value
                
                old_value_str = old_value_aware.astimezone(tz_argentina).strftime('%d/%m/%Y %H:%M')
                new_value_str = value.astimezone(tz_argentina).strftime('%d/%m/%Y %H:%M')
                historial_comentarios.append(f"Campo '{key}' cambiado de '{old_value_str}' a '{new_value_str}'.")

            # Si es el ID del analista, buscamos su nombre
            elif key == "asignado_a_id":
                old_analyst_name = db_incidencia.asignado_a.nombre if db_incidencia.asignado_a else "Nadie"
                new_analyst = await db.get(models.Analista, value) if value else None
                new_analyst_name = new_analyst.nombre if new_analyst else "Nadie"
                historial_comentarios.append(f"Campo 'Asignado a' cambiado de '{old_analyst_name}' a '{new_analyst_name}'.")

            # Para cualquier otro tipo de campo, lo dejamos como está
            else:
                historial_comentarios.append(f"Campo '{key}' cambiado de '{old_value}' a '{value}'.")
            
            setattr(db_incidencia, key, value)
    
    if historial_comentarios:
        comentario_texto = "Incidencia actualizada por " + current_analista.nombre + ":\n- " + "\n- ".join(historial_comentarios)
        nueva_actualizacion = models.ActualizacionIncidencia(
            comentario=comentario_texto,
            incidencia_id=incidencia_id,
            autor_id=current_analista.id
        )
        db.add(nueva_actualizacion)

    await db.commit()
    return await get_incidencia_by_id(incidencia_id, db, current_analista)

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
            selectinload(models.Incidencia.asignado_a),
            selectinload(models.Incidencia.lobs),
            selectinload(models.Incidencia.cerrado_por)
        )
        .filter(models.Incidencia.id == incidencia_id)
    )
    incidencia = result.scalars().first()
    if not incidencia:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    
    return incidencia

@router.get("/incidencias/filtradas/", response_model=List[IncidenciaSimple], summary="[Portal de Control] Obtener incidencias con filtros avanzados")
async def get_incidencias_filtradas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA])),
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    campana_id: Optional[int] = None,
    estado: Optional[List[EstadoIncidencia]] = Query(default=None),
    asignado_a_id: Optional[int] = None
):
    """
    Endpoint para el portal de control de incidencias.
    Todos los roles con acceso ven la misma información.
    """
    query = select(models.Incidencia).options(
        selectinload(models.Incidencia.campana),
        selectinload(models.Incidencia.creador),
        selectinload(models.Incidencia.asignado_a),
        selectinload(models.Incidencia.cerrado_por),
        selectinload(models.Incidencia.lobs)
    ).order_by(models.Incidencia.fecha_apertura.desc())

    if fecha_inicio:
        query = query.filter(models.Incidencia.fecha_apertura >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin:
        query = query.filter(models.Incidencia.fecha_apertura <= datetime.combine(fecha_fin, time.max))
    if campana_id:
        query = query.filter(models.Incidencia.campana_id == campana_id)
    if estado:
        query = query.filter(models.Incidencia.estado.in_(estado))
    if asignado_a_id is not None:
        if asignado_a_id == 0:
            query = query.filter(models.Incidencia.asignado_a_id.is_(None))
        else:
            query = query.filter(models.Incidencia.asignado_a_id == asignado_a_id)
            
    result = await db.execute(query)
    return result.scalars().unique().all()

@router.post("/incidencias/{incidencia_id}/actualizaciones", response_model=ActualizacionIncidencia, summary="Añadir una actualización a una Incidencia")
async def add_actualizacion_incidencia(
    incidencia_id: int,
    actualizacion_data: ActualizacionIncidenciaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    # 1. Limpiamos el comentario ANTES de usarlo
    comentario_limpio = bleach.clean(actualizacion_data.comentario)

    # 2. Creamos el objeto para la base de datos con el comentario ya limpio
    db_actualizacion = models.ActualizacionIncidencia(
        comentario=comentario_limpio,
        incidencia_id=incidencia_id,
        autor_id=current_analista.id
    )
    
    # 3. Guardamos el objeto limpio en la base de datos
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
    
    # 1. Creamos la actualización del cambio de estado.
    comentario_cambio_estado = f"El estado de la incidencia cambió de '{estado_anterior}' a '{update_data.estado.value}'."
    actualizacion_estado = models.ActualizacionIncidencia(
        comentario=comentario_cambio_estado,
        incidencia_id=incidencia_id,
        autor_id=current_analista.id
    )
    db.add(actualizacion_estado)

    # 2. Aplicamos los cambios al objeto de la incidencia.
    db_incidencia.estado = update_data.estado

    if update_data.estado == EstadoIncidencia.CERRADA:
        # Usamos la función now() de la base de datos para asegurar el formato UTC correcto
        db_incidencia.fecha_cierre = update_data.fecha_cierre or func.now()
        db_incidencia.asignado_a_id = None
        # Esta es la asignación clave que estaba fallando
        db_incidencia.cerrado_por_id = current_analista.id
        
        # Si hay un comentario de cierre, creamos una SEGUNDA actualización.
        if update_data.comentario_cierre:
            texto_comentario_cierre = f"Comentario de Cierre: {update_data.comentario_cierre}"
            actualizacion_cierre = models.ActualizacionIncidencia(
                comentario=texto_comentario_cierre,
                incidencia_id=incidencia_id,
                autor_id=current_analista.id
            )
            db.add(actualizacion_cierre)

    elif update_data.estado == EstadoIncidencia.ABIERTA:
        db_incidencia.fecha_cierre = None
        db_incidencia.asignado_a_id = None
        db_incidencia.cerrado_por_id = None


    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        # Este error ahora será mucho más visible si algo falla
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al guardar el cambio de estado: {e}"
        )
    
    # Finalmente, recargamos y devolvemos la incidencia completa y actualizada
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

# --- ENDPOINTS PARA LA GESTIÓN DE PLANTILLAS DE CHECKLIST ---

@router.get("/campanas/{campana_id}/plantilla", response_model=List[PlantillaChecklistItem], summary="Obtener la plantilla de checklist de una campaña")
async def get_plantilla_por_campana(
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    result = await db.execute(
        select(models.PlantillaChecklistItem)
        .filter(models.PlantillaChecklistItem.campana_id == campana_id)
        .order_by(models.PlantillaChecklistItem.orden)
    )
    return result.scalars().all()

@router.post("/campanas/{campana_id}/plantilla", response_model=PlantillaChecklistItem, status_code=status.HTTP_201_CREATED, summary="Añadir un ítem a la plantilla de una campaña")
async def add_item_a_plantilla(
    campana_id: int,
    item_data: PlantillaChecklistItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    nuevo_item = models.PlantillaChecklistItem(
        descripcion=item_data.descripcion,
        campana_id=campana_id,
        hora_sugerida=item_data.hora_sugerida 
    )

    db.add(nuevo_item)
    await db.commit()
    await db.refresh(nuevo_item)
    return nuevo_item

@router.delete("/plantilla-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar un ítem de una plantilla")
async def delete_item_de_plantilla(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    result = await db.execute(select(models.PlantillaChecklistItem).filter(models.PlantillaChecklistItem.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ítem de plantilla no encontrado.")
    
    await db.delete(item)
    await db.commit()
    return

# --- NUEVOS ENDPOINTS PARA WIDGETS DEL DASHBOARD ---

@router.get("/incidencias/activas/recientes", response_model=List[DashboardIncidenciaWidget], summary="Obtener todas las incidencias activas (Optimizado)")
async def get_recientes_incidencias_activas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.ANALISTA, UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    """
    Devuelve una lista optimizada de TODAS las incidencias activas,
    cargando solo los datos necesarios para el widget del dashboard.
    """
    # Subconsulta para obtener la última actualización de cada incidencia
    latest_update_subq = select(
        models.ActualizacionIncidencia.incidencia_id,
        func.max(models.ActualizacionIncidencia.id).label('max_id')
    ).group_by(models.ActualizacionIncidencia.incidencia_id).subquery()

    latest_comment_q = select(
        models.ActualizacionIncidencia.incidencia_id,
        models.ActualizacionIncidencia.comentario,
        models.ActualizacionIncidencia.fecha_actualizacion
    ).join(
        latest_update_subq, models.ActualizacionIncidencia.id == latest_update_subq.c.max_id
    ).subquery()

    # Consulta principal
    query = select(
        models.Incidencia,
        latest_comment_q.c.comentario.label('ultimo_comentario_texto'),
        latest_comment_q.c.fecha_actualizacion.label('ultimo_comentario_fecha')
    ).outerjoin(
        latest_comment_q, models.Incidencia.id == latest_comment_q.c.incidencia_id
    ).options(
        selectinload(models.Incidencia.campana),
        selectinload(models.Incidencia.asignado_a)
    ).filter(
        models.Incidencia.estado.in_([EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO])
    ).order_by(
        case(
            (models.Incidencia.gravedad == GravedadIncidencia.ALTA, 1),
            (models.Incidencia.gravedad == GravedadIncidencia.MEDIA, 2),
            (models.Incidencia.gravedad == GravedadIncidencia.BAJA, 3),
            else_=4
        ),
        models.Incidencia.fecha_apertura.desc()
    )
    
    result = await db.execute(query)
    
    # Construimos la respuesta manualmente para formatear el último comentario
    response_list = []
    for inc, comentario, fecha in result.all():
        widget_item = DashboardIncidenciaWidget.model_validate(inc)
        if comentario and fecha:
            fecha_str = fecha.strftime('%d/%m %H:%M')
            widget_item.ultimo_comentario = f"({fecha_str}) {comentario}"
        response_list.append(widget_item)
        
    return response_list


@router.get("/analistas/me/incidencias_asignadas", response_model=List[IncidenciaSimple], summary="Obtener incidencias asignadas al analista actual")
async def get_mis_incidencias_asignadas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.ANALISTA]))
):
    """
    Devuelve una lista de incidencias activas asignadas al analista
    que realiza la petición.
    """
    # --- INICIO DE LA CORRECCIÓN ---
    # Añadimos los `selectinload` necesarios para que el response_model 'IncidenciaSimple'
    # tenga todos los datos que necesita (creador, cerrado_por, etc.)
    query = select(models.Incidencia).options(
        selectinload(models.Incidencia.campana),
        selectinload(models.Incidencia.lobs),
        selectinload(models.Incidencia.creador),
        selectinload(models.Incidencia.cerrado_por),
        selectinload(models.Incidencia.asignado_a)
    ).filter(
        models.Incidencia.asignado_a_id == current_analista.id,
        models.Incidencia.estado.in_([EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO])
    ).order_by(
        models.Incidencia.fecha_apertura.asc()
    )
    # --- FIN DE LA CORRECCIÓN ---
    
    result = await db.execute(query)
    return result.scalars().unique().all()

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
    # Definimos el rango de "hoy" en UTC
    today_start_utc = datetime.now(pytz.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end_utc = datetime.now(pytz.utc).replace(hour=23, minute=59, second=59, microsecond=999999)

    # Conteo de "Total Activas" (Abiertas o En Progreso)
    query_activas = select(func.count(models.Incidencia.id)).filter(
        models.Incidencia.estado.in_([EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO])
    )
    total_activas = (await db.execute(query_activas)).scalar_one()

    if current_analista.role in [UserRole.SUPERVISOR, UserRole.RESPONSABLE]:
        # Conteo de "Sin Asignar"
        unassigned_query = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.estado == EstadoIncidencia.ABIERTA,
            models.Incidencia.asignado_a_id.is_(None)
        )
        unassigned_count = (await db.execute(unassigned_query)).scalar_one()

        # Conteo de "Cerradas Hoy" (por cualquier analista)
        closed_today_query = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.estado == EstadoIncidencia.CERRADA,
            models.Incidencia.fecha_cierre.between(today_start_utc, today_end_utc)
        )
        closed_today_count = (await db.execute(closed_today_query)).scalar_one()

        return DashboardStatsSupervisor(
            total_incidencias_activas=total_activas,
            incidencias_sin_asignar=unassigned_count,
            incidencias_cerradas_hoy=closed_today_count
        )

    elif current_analista.role == UserRole.ANALISTA:
        # Definimos el rango de "hoy" en UTC para la consulta
        today_start_utc = datetime.now(pytz.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end_utc = datetime.now(pytz.utc).replace(hour=23, minute=59, second=59, microsecond=999999)

        # Conteo de "Sin Asignar" (no cambia)
        unassigned_query = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.estado == EstadoIncidencia.ABIERTA,
            models.Incidencia.asignado_a_id.is_(None)
        )
        unassigned_count = (await db.execute(unassigned_query)).scalar_one()

        # Conteo de "Mis Incidencias Asignadas" (no cambia)
        my_assigned_query = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.asignado_a_id == current_analista.id,
            models.Incidencia.estado == EstadoIncidencia.EN_PROGRESO
        )
        my_assigned_count = (await db.execute(my_assigned_query)).scalar_one()

        # --- INICIO DE LA NUEVA LÓGICA ---
        # Conteo de incidencias CERRADAS HOY por el analista actual
        closed_today_query = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.cerrado_por_id == current_analista.id,
            models.Incidencia.fecha_cierre.between(today_start_utc, today_end_utc)
        )
        closed_today_count = (await db.execute(closed_today_query)).scalar_one()
        # --- FIN DE LA NUEVA LÓGICA ---

        return DashboardStatsAnalista(
            total_incidencias_activas=total_activas,
            incidencias_sin_asignar=unassigned_count,
            mis_incidencias_asignadas=my_assigned_count,
            incidencias_cerradas_hoy=closed_today_count # <-- Devolvemos el nuevo dato
        )
    
    raise HTTPException(status_code=403, detail="Rol de usuario no tiene un dashboard GTR definido.")

@router.get("/dashboard/alertas-operativas", summary="Obtener alertas de tareas vencidas o próximas")
async def get_alertas_operativas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Semáforo Inteligente:
    - AMARILLO (Atención): Faltan 45 min o menos.
    - AZUL (En Curso): Es la hora exacta o pasaron hasta 15 min (Gracia).
    - ROJO (Crítico): Pasaron más de 15 min del horario.
    """
    
    # 1. Definir AHORA en Argentina
    tz_argentina = pytz.timezone("America/Argentina/Tucuman")
    ahora_arg = datetime.now(tz_argentina)
    
    # 2. Buscar sesión activa
    q_sesion = select(models.SesionCampana).filter(
        models.SesionCampana.analista_id == current_analista.id,
        models.SesionCampana.fecha_fin.is_(None)
    )
    res_sesion = await db.execute(q_sesion)
    sesion = res_sesion.scalars().first()

    if not sesion:
        return [] 

    # 3. Buscar la Tarea del día (Cargando la Campaña para obtener el nombre)
    inicio_dia = ahora_arg.replace(hour=0, minute=0, second=0, microsecond=0)
    
    q_tarea = select(models.Tarea).options(
        selectinload(models.Tarea.campana) # <--- CARGAMOS LA CAMPAÑA AQUÍ
    ).filter(
        models.Tarea.campana_id == sesion.campana_id,
        models.Tarea.es_generada_automaticamente == True,
        models.Tarea.fecha_creacion >= inicio_dia.astimezone(pytz.utc)
    )
    res_tarea = await db.execute(q_tarea)
    tarea = res_tarea.scalars().first()

    if not tarea:
        return []

    # 4. Traer ítems pendientes con hora
    q_items = select(models.ChecklistItem).filter(
        models.ChecklistItem.tarea_id == tarea.id,
        models.ChecklistItem.completado == False,
        models.ChecklistItem.hora_sugerida.is_not(None)
    ).order_by(models.ChecklistItem.hora_sugerida)
    
    res_items = await db.execute(q_items)
    items = res_items.scalars().all()

    alertas = []
    
    # 5. MOTOR DE REGLAS MATEMÁTICO
    # Usamos una fecha dummy para poder restar horas fácilmente
    dummy_date = datetime(2000, 1, 1)
    dt_actual = dummy_date.replace(hour=ahora_arg.hour, minute=ahora_arg.minute)

    for item in items:
        hora_item = item.hora_sugerida
        dt_item = dummy_date.replace(hour=hora_item.hour, minute=hora_item.minute)
        
        # Calculamos diferencia en minutos: (Hora Actual - Hora Tarea)
        # Positivo = Ya pasó la hora de la tarea.
        # Negativo = Aún no llega la hora.
        diferencia_minutos = (dt_actual - dt_item).total_seconds() / 60
        
        estado = None
        
        # LÓGICA DEL SEMÁFORO
        if diferencia_minutos > 15:
            estado = "CRITICO" # Rojo (+15 min tarde)
        elif 0 <= diferencia_minutos <= 15:
            estado = "EN_CURSO" # Azul (Estamos en la ventana de envío)
        elif -45 <= diferencia_minutos < 0:
            estado = "ATENCION" # Amarillo (Faltan menos de 45 min)
        
        if estado:
            alertas.append({
                "id": item.id,
                "descripcion": item.descripcion,
                "hora": hora_item.strftime("%H:%M"),
                "tipo": estado,
                "tarea_id": tarea.id,
                "campana_nombre": tarea.campana.nombre # <--- ENVIAMOS EL NOMBRE
            })

    return alertas

@router.post("/incidencias/exportar/", summary="Exporta incidencias filtradas a Excel")
async def exportar_incidencias(
    filtros: IncidenciaExportFilters,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA]))
):
    """
    Genera un archivo Excel con la lista de incidencias que coinciden con los filtros proporcionados.
    """
    query = select(models.Incidencia).options(
        selectinload(models.Incidencia.campana),
        selectinload(models.Incidencia.lobs),
        selectinload(models.Incidencia.creador),
        selectinload(models.Incidencia.asignado_a),
        selectinload(models.Incidencia.cerrado_por),
        selectinload(models.Incidencia.actualizaciones)
    ).order_by(models.Incidencia.fecha_apertura.desc())

    if filtros.fecha_inicio:
        query = query.filter(models.Incidencia.fecha_apertura >= datetime.combine(filtros.fecha_inicio, time.min))
    if filtros.fecha_fin:
        query = query.filter(models.Incidencia.fecha_apertura <= datetime.combine(filtros.fecha_fin, time.max))
    if filtros.campana_id:
        query = query.filter(models.Incidencia.campana_id == filtros.campana_id)
    if filtros.estado:
        query = query.filter(models.Incidencia.estado == filtros.estado)
    if filtros.asignado_a_id is not None:
        if filtros.asignado_a_id == 0:
            query = query.filter(models.Incidencia.asignado_a_id.is_(None))
        else:
            query = query.filter(models.Incidencia.asignado_a_id == filtros.asignado_a_id)
            
    result = await db.execute(query)
    incidencias = result.scalars().unique().all()

    if not incidencias:
        raise HTTPException(status_code=404, detail="No se encontraron incidencias con los filtros seleccionados.")

    # Preparar datos para el DataFrame de Pandas
    datos_para_excel = []
    for inc in incidencias:
        # --- CORRECCIÓN AQUÍ: "Comentario de Cierre" con mayúsculas ---
        comentario_cierre = "N/A"
        if inc.estado == EstadoIncidencia.CERRADA:
            # Buscamos en las actualizaciones la que contenga el texto clave
            for act in sorted(inc.actualizaciones, key=lambda x: x.fecha_actualizacion, reverse=True):
                if "Comentario de Cierre: " in act.comentario:
                    comentario_cierre = act.comentario.split("Comentario de Cierre: ")[1]
                    break
        # -------------------------------------------------------------

        datos_para_excel.append({
            "ID": inc.id,
            "Titulo": inc.titulo,
            "Campaña": inc.campana.nombre if inc.campana else "N/A",
            "LOBs": ", ".join([lob.nombre for lob in inc.lobs]) if inc.lobs else "N/A",
            "Gravedad": inc.gravedad.value if inc.gravedad else "N/A",
            "Estado": inc.estado.value if inc.estado else "N/A",
            "Creador": f"{inc.creador.nombre} {inc.creador.apellido}" if inc.creador else "N/A",
            "Asignado a": f"{inc.asignado_a.nombre} {inc.asignado_a.apellido}" if inc.asignado_a else "Sin Asignar",
            "Cerrado por": f"{inc.cerrado_por.nombre} {inc.cerrado_por.apellido}" if inc.cerrado_por else "N/A",
            "Fecha Apertura": inc.fecha_apertura.strftime("%d-%m-%Y %H:%M"),
            "Fecha Cierre": inc.fecha_cierre.strftime("%d-%m-%Y %H:%M") if inc.fecha_cierre else "N/A",
            "Herramienta Afectada": inc.herramienta_afectada,
            "Indicador Afectado": inc.indicador_afectado,
            "Descripción": inc.descripcion_inicial,
            "Comentario de Cierre": comentario_cierre # Usamos la variable calculada arriba
        })
    
    df = pd.DataFrame(datos_para_excel)
    
    # Crear el archivo Excel en memoria
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Incidencias')
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="Reporte_Incidencias_{date.today().isoformat()}.xlsx"'
    }
    
    return StreamingResponse(output, headers=headers, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
@router.get("/bitacora/filtrar/", response_model=List[BitacoraEntry], summary="[Portal de Control] Obtener entradas de bitácora con filtros")
async def filtrar_bitacora(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA])),
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    campana_id: Optional[int] = None,
    autor_id: Optional[int] = None
):
    query = select(models.BitacoraEntry).options(
        selectinload(models.BitacoraEntry.campana),
        selectinload(models.BitacoraEntry.autor),
        selectinload(models.BitacoraEntry.lob)
    ).order_by(models.BitacoraEntry.fecha.desc(), models.BitacoraEntry.hora.desc())

    if fecha_inicio:
        query = query.filter(models.BitacoraEntry.fecha >= fecha_inicio)
    if fecha_fin:
        query = query.filter(models.BitacoraEntry.fecha <= fecha_fin)
    if campana_id:
        query = query.filter(models.BitacoraEntry.campana_id == campana_id)
    if autor_id:
        query = query.filter(models.BitacoraEntry.autor_id == autor_id)
        
    result = await db.execute(query)
    return result.scalars().unique().all()


@router.post("/bitacora/exportar/", summary="Exporta entradas de bitácora filtradas a Excel")
async def exportar_bitacora(
    filtros: BitacoraExportFilters,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA]))
):
    query = select(models.BitacoraEntry).options(
        selectinload(models.BitacoraEntry.campana),
        selectinload(models.BitacoraEntry.autor),
        selectinload(models.BitacoraEntry.lob)
    ).order_by(models.BitacoraEntry.fecha.desc(), models.BitacoraEntry.hora.desc())

    # Lógica de filtros...
    if filtros.fecha_inicio:
        query = query.filter(models.BitacoraEntry.fecha >= filtros.fecha_inicio)
    if filtros.fecha_fin:
        query = query.filter(models.BitacoraEntry.fecha <= filtros.fecha_fin)
    if filtros.campana_id:
        query = query.filter(models.BitacoraEntry.campana_id == filtros.campana_id)
    if filtros.autor_id:
        query = query.filter(models.BitacoraEntry.autor_id == filtros.autor_id)
    if filtros.lob_id:
        query = query.filter(models.BitacoraEntry.lob_id == filtros.lob_id)
            
    result = await db.execute(query)
    # --- ¡AQUÍ ESTÁ EL CAMBIO! ---
    entradas = result.scalars().all()

    if not entradas:
        raise HTTPException(status_code=404, detail="No se encontraron eventos con los filtros seleccionados.")

    # El resto de la función para crear el Excel no cambia
    datos_para_excel = [{
        "ID": entry.id,
        "Fecha": entry.fecha.strftime("%d-%m-%Y"),
        "Hora": entry.hora.strftime("%H:%M"),
        "Campaña": entry.campana.nombre if entry.campana else "N/A",
        "LOB": entry.lob.nombre if entry.lob else "N/A",
        "Autor": f"{entry.autor.nombre} {entry.autor.apellido}" if entry.autor else "N/A",
        "Comentario": entry.comentario
    } for entry in entradas]
    
    df = pd.DataFrame(datos_para_excel)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Eventos')
    output.seek(0)
    
    headers = {'Content-Disposition': f'attachment; filename="Reporte_Eventos_{date.today().isoformat()}.xlsx"'}
    return StreamingResponse(output, headers=headers, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# -----------------------------------------------------------------------------
# 📍 SISTEMA DE CHECK-IN / SESIONES ACTIVAS (GTR DINÁMICO)
# -----------------------------------------------------------------------------

@router.post("/sesiones/check-in", response_model=SesionActiva, summary="Iniciar gestión en una campaña")
async def check_in_campana(
    datos: CheckInCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    # 1. Verificar si ya está activo (Lógica existente...)
    query = select(models.SesionCampana).filter(
        models.SesionCampana.analista_id == current_analista.id,
        models.SesionCampana.campana_id == datos.campana_id,
        models.SesionCampana.fecha_fin.is_(None)
    )
    result = await db.execute(query)
    sesion_existente = result.scalars().first()

    if sesion_existente:
        # (Lógica existente de retorno...)
        result_full = await db.execute(
            select(models.SesionCampana).options(
                selectinload(models.SesionCampana.campana).options(
                    selectinload(models.Campana.lobs),
                    selectinload(models.Campana.analistas_asignados)
                )
            ).filter(models.SesionCampana.id == sesion_existente.id)
        )
        return result_full.scalars().first()

    # 2. Crear nueva sesión (Lógica existente...)
    nueva_sesion = models.SesionCampana(
        analista_id=current_analista.id,
        campana_id=datos.campana_id
    )
    db.add(nueva_sesion)
    
    # --- 🤖 LÓGICA COLABORATIVA: RUTINA COMPARTIDA POR CAMPAÑA ---
    
    # 1. Definir "Hoy" (Inicio del día)
    hoy_inicio = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # 2. Buscar si YA existe una Rutina Automática para esta campaña HOY (sin importar el analista)
    #    NOTA: Quitamos el filtro de 'analista_id' para encontrar la de cualquiera.
    q_tarea_existente = select(models.Tarea).filter(
        models.Tarea.campana_id == datos.campana_id,
        models.Tarea.es_generada_automaticamente == True,
        models.Tarea.fecha_creacion >= hoy_inicio
    )
    result_tarea = await db.execute(q_tarea_existente)
    tarea_compartida = result_tarea.scalars().first()

    # CASO A: Ya existe la rutina (Ej: Analista A ya la creó) -> NOS UNIMOS
    if tarea_compartida:
        print(f"🔄 Check-in de {current_analista.email}: Se une a la Rutina ID {tarea_compartida.id} existente.")
        
    # CASO B: No existe (Soy el primero) -> LA CREAMOS
    else:
        # A. Buscamos ítems de la plantilla
        q_items_plantilla = select(models.PlantillaChecklistItem).filter(
            models.PlantillaChecklistItem.campana_id == datos.campana_id
        ).order_by(models.PlantillaChecklistItem.orden)
        res_items = await db.execute(q_items_plantilla)
        items_plantilla = res_items.scalars().all()

        # B. Buscamos datos de la campaña
        q_campana = select(models.Campana).filter(models.Campana.id == datos.campana_id)
        res_campana = await db.execute(q_campana)
        campana_obj = res_campana.scalars().first()

        if items_plantilla and campana_obj:
            nombre_tarea = f"Rutina Diaria - {campana_obj.nombre}"
            
            nueva_tarea = models.Tarea(
                titulo=nombre_tarea,
                descripcion=f"Rutina operativa compartida del día.",
                fecha_vencimiento=datetime.now().replace(hour=23, minute=59),
                progreso=ProgresoTarea.PENDIENTE,
                analista_id=current_analista.id, # El primero queda como "dueño" nominal
                campana_id=datos.campana_id,
                es_generada_automaticamente=True
            )
            db.add(nueva_tarea)
            await db.flush()

            for item in items_plantilla:
                texto_final = item.descripcion
                # Mantenemos la hora en el texto por ahora para referencia visual
                if item.hora_sugerida:
                    hora_str = item.hora_sugerida.strftime("%H:%M")
                    texto_final = f"[{hora_str}] {item.descripcion}"

                nuevo_item = models.ChecklistItem(
                    tarea_id=nueva_tarea.id,
                    descripcion=texto_final,
                    completado=False,
                    hora_sugerida=item.hora_sugerida # <--- ¡AQUÍ GUARDAMOS EL DATO CLAVE!
                )
                db.add(nuevo_item)
            
            print(f"✅ Rutina compartida INICIADA por: {current_analista.email}")
    # -----------------------------------------------------------

    await db.commit()
    await db.refresh(nueva_sesion)

    # 3. Devolver (Lógica existente...)
    result_final = await db.execute(
        select(models.SesionCampana).options(
            selectinload(models.SesionCampana.campana).options(
                selectinload(models.Campana.lobs),
                selectinload(models.Campana.analistas_asignados)
            )
        ).filter(models.SesionCampana.id == nueva_sesion.id)
    )
    return result_final.scalars().first()


@router.post("/sesiones/check-out", summary="Dejar de gestionar una campaña")
async def check_out_campana(
    datos: CheckInCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Cierra la sesión activa en la campaña especificada.
    """
    # Buscar la sesión activa
    query = select(models.SesionCampana).filter(
        models.SesionCampana.analista_id == current_analista.id,
        models.SesionCampana.campana_id == datos.campana_id,
        models.SesionCampana.fecha_fin.is_(None)
    )
    result = await db.execute(query)
    sesion = result.scalars().first()

    if not sesion:
        raise HTTPException(status_code=404, detail="No tienes una sesión activa en esta campaña.")

    # Cerrar sesión
    sesion.fecha_fin = datetime.now()
    await db.commit()
    
    return {"message": "Sesión finalizada correctamente", "campana_id": datos.campana_id}


@router.get("/sesiones/activas", response_model=List[SesionActiva], summary="Ver mis campañas activas")
async def obtener_mis_sesiones_activas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Devuelve la lista de campañas donde el analista está haciendo check-in actualmente.
    """
    query = select(models.SesionCampana).options(
        selectinload(models.SesionCampana.campana)
        .options(
            selectinload(models.Campana.lobs),
            selectinload(models.Campana.analistas_asignados)
        )
    ).filter(
        models.SesionCampana.analista_id == current_analista.id,
        models.SesionCampana.fecha_fin.is_(None)
    )
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/sesiones/cobertura", summary="Ver estado de cobertura de todas las campañas")
async def obtener_cobertura_campanas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    """
    Retorna un listado de todas las campañas con la lista de analistas que están activos en ellas.
    Ideal para el tablero de control del supervisor.
    """
    # 1. Traer todas las campañas
    result_campanas = await db.execute(select(models.Campana).order_by(models.Campana.nombre.asc()))
    campanas = result_campanas.scalars().all()

    # 2. Traer todas las sesiones activas actuales (donde fecha_fin es NULL)
    result_sesiones = await db.execute(
        select(models.SesionCampana)
        .options(selectinload(models.SesionCampana.analista)) # Cargar nombre del analista
        .filter(models.SesionCampana.fecha_fin.is_(None))
    )
    sesiones_activas = result_sesiones.scalars().all()

    # 3. Cruzar datos en memoria (Más rápido y simple que una query compleja de SQL para este caso)
    # Creamos un diccionario: { campana_id: [lista_de_analistas] }
    mapa_cobertura = {c.id: [] for c in campanas}
    
    for sesion in sesiones_activas:
        if sesion.campana_id in mapa_cobertura:
            mapa_cobertura[sesion.campana_id].append({
                "nombre": f"{sesion.analista.nombre} {sesion.analista.apellido}",
                "inicio": sesion.fecha_inicio
            })

    # 4. Formatear respuesta final
    reporte = []
    for c in campanas:
        analistas_activos = mapa_cobertura[c.id]
        estado = "CUBIERTA" if analistas_activos else "DESCUBIERTA"
        
        reporte.append({
            "id": c.id,
            "nombre": c.nombre,
            "estado": estado,
            "cantidad_activos": len(analistas_activos),
            "analistas": analistas_activos
        })

    return reporte