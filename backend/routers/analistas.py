from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from ..database import get_db
from ..sql_app import models
from ..enums import UserRole
from ..dependencies import get_current_analista, require_role
from ..services.analista_service import AnalistaService
from ..schemas.models import (
    Analista, AnalistaCreate, AnalistaSimple, AnalistaBase, PasswordUpdate, AnalistaListado,
    AnalistaConCampanas
)
from ..security import get_password_hash

router = APIRouter(
    prefix="/analistas",
    tags=["Analistas"]
)

@router.post("/", response_model=Analista, status_code=status.HTTP_201_CREATED, summary="Crear un nuevo Analista (Protegido por Supervisor/Responsable)")
async def crear_analista(
    analista: AnalistaCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    existing_analista_by_email = await AnalistaService.get_analista_by_email(db, analista.email)
    if existing_analista_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado.")
    
    result_bms = await db.execute(select(models.Analista).filter(models.Analista.bms_id == analista.bms_id))
    existing_analista_by_bms = result_bms.scalars().first()
    if existing_analista_by_bms:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El BMS ID ya existe.")

    analista_data = analista.model_dump()
    if "rut" in analista_data and not analista_data["rut"]:
        analista_data["rut"] = None
        
    hashed_password = get_password_hash(analista_data.pop("password"))
    db_analista = models.Analista(**analista_data, hashed_password=hashed_password)
    
    db.add(db_analista)
    try:
        await db.commit()
        await db.refresh(db_analista)
        
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == db_analista.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
                selectinload(models.Analista.incidencias_creadas).options(
                    selectinload(models.Incidencia.campana),
                    selectinload(models.Incidencia.lobs),
                    selectinload(models.Incidencia.creador),
                    selectinload(models.Incidencia.asignado_a)
                ),
                selectinload(models.Analista.incidencias_asignadas).options(
                    selectinload(models.Incidencia.campana),
                    selectinload(models.Incidencia.lobs),
                    selectinload(models.Incidencia.creador),
                    selectinload(models.Incidencia.asignado_a)
                ),
                selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
                selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante),
                selectinload(models.Analista.planificaciones)
            )
        )
        analista_to_return = result.scalars().first()
        if not analista_to_return:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la creación.")
        
        return analista_to_return
    except Exception as e:
        await db.rollback()
        if 'UniqueViolationError' in str(e) and 'analistas_rut_key' in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El RUT ingresado ya existe.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al crear analista: {e}"
        )

@router.get("/", response_model=List[AnalistaListado], summary="Obtener todos los Analistas Activos para la tabla principal")
async def obtener_analistas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    query = select(models.Analista).where(models.Analista.esta_activo == True).order_by(models.Analista.nombre)
    result = await db.execute(query)
    analistas = result.scalars().all()
    return analistas

@router.get("/listado-simple/", response_model=List[AnalistaSimple], summary="Obtener una lista simple de analistas para selectores")
async def obtener_analistas_simple(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA]))
):
    query = select(models.Analista).where(
        models.Analista.esta_activo == True,
        models.Analista.role != UserRole.SUPERVISOR_OPERACIONES
    ).order_by(models.Analista.nombre)
    
    result = await db.execute(query)
    analistas = result.scalars().all()
    return analistas

@router.get("/con-campanas/", response_model=List[AnalistaConCampanas], summary="Obtener todos los Analistas con sus campañas para la página de asignación")
async def obtener_analistas_con_campanas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    query = select(models.Analista).options(
        selectinload(models.Analista.campanas_asignadas)
    ).where(models.Analista.esta_activo == True).order_by(models.Analista.nombre)
    
    result = await db.execute(query)
    analistas = result.scalars().unique().all()
    return analistas

@router.get("/{analista_id}", response_model=Analista, summary="Obtener Analista por ID")
async def obtener_analista_por_id(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    if current_analista.role == UserRole.ANALISTA and current_analista.id != analista_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este perfil.")

    analista = await AnalistaService.get_analista_full(db, analista_id)
    if not analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analista no encontrado o inactivo.")
    
    return analista

@router.get("/todos/", response_model=List[Analista], summary="Obtener todos los Analistas (activos e inactivos) (Protegido por Supervisor)")
async def get_all_analistas(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
    query = select(models.Analista).options(
        selectinload(models.Analista.campanas_asignadas),
        selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
        selectinload(models.Analista.incidencias_creadas).options(
            selectinload(models.Incidencia.campana),
            selectinload(models.Incidencia.lobs),
            selectinload(models.Incidencia.creador),
            selectinload(models.Incidencia.asignado_a)
        ),
        selectinload(models.Analista.incidencias_asignadas).options(
            selectinload(models.Incidencia.campana),
            selectinload(models.Incidencia.lobs),
            selectinload(models.Incidencia.creador),
            selectinload(models.Incidencia.asignado_a)
        ),
        selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
        selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante),
        selectinload(models.Analista.planificaciones)
    )
    if not include_inactive:
        query = query.where(models.Analista.esta_activo == True)
    result = await db.execute(query)
    analistas = result.scalars().unique().all()
    return analistas

@router.put("/{analista_id}", response_model=Analista, summary="Actualizar un Analista existente (Protegido por Supervisor/Responsable)")
async def actualizar_analista(
    analista_id: int,
    analista_update: AnalistaBase,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    db_analista_result = await db.execute(
        select(models.Analista)
        .where(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.incidencias_creadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.incidencias_asignadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
            selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante),
            selectinload(models.Analista.planificaciones)
        )
    )
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
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_existente.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
                selectinload(models.Analista.incidencias_creadas).options(
                    selectinload(models.Incidencia.campana),
                    selectinload(models.Incidencia.lobs),
                    selectinload(models.Incidencia.creador),
                    selectinload(models.Incidencia.asignado_a)
                ),
                selectinload(models.Analista.incidencias_asignadas).options(
                    selectinload(models.Incidencia.campana),
                    selectinload(models.Incidencia.lobs),
                    selectinload(models.Incidencia.creador),
                    selectinload(models.Incidencia.asignado_a)
                ),
                selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
                selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante),
                selectinload(models.Analista.planificaciones)
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

@router.put("/{analista_id}/password", response_model=Analista, summary="Actualizar contraseña de un Analista (Protegido)")
async def update_analista_password(
    analista_id: int,
    password_update: PasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    db_analista_result = await db.execute(
        select(models.Analista)
        .where(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.incidencias_creadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.incidencias_asignadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
            selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante),
            selectinload(models.Analista.planificaciones)
        )
    )
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
        result = await db.execute(
            select(models.Analista)
            .filter(models.Analista.id == analista_a_actualizar.id)
            .options(
                selectinload(models.Analista.campanas_asignadas),
                selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
                selectinload(models.Analista.incidencias_creadas).options(
                    selectinload(models.Incidencia.campana),
                    selectinload(models.Incidencia.lobs),
                    selectinload(models.Incidencia.creador),
                    selectinload(models.Incidencia.asignado_a)
                ),
                selectinload(models.Analista.incidencias_asignadas).options(
                    selectinload(models.Incidencia.campana),
                    selectinload(models.Incidencia.lobs),
                    selectinload(models.Incidencia.creador),
                    selectinload(models.Incidencia.asignado_a)
                ),
                selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
                selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante)
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

@router.delete("/{analista_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desactivar un Analista (Protegido por Supervisor)")
async def desactivar_analista(
    analista_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR]))
):
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
    return

@router.post("/{analista_id}/campanas/{campana_id}", response_model=Analista, status_code=status.HTTP_200_OK, summary="Asignar Campana a Analista (Protegido)")
async def asignar_campana_a_analista(
    analista_id: int,
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    if current_analista.role == UserRole.ANALISTA.value:
        if analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Analista solo puede asignarse campañas a sí mismo.")

    analista_result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.incidencias_creadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.incidencias_asignadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
            selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante),
            selectinload(models.Analista.planificaciones)
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
            selectinload(models.Analista.incidencias_creadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.incidencias_asignadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
            selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante),
            selectinload(models.Analista.planificaciones)
        )
    )
    analista_to_return = result.scalars().first()
    if not analista_to_return:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al recargar el analista después de la asignación.")
    return analista_to_return

@router.delete("/{analista_id}/campanas/{campana_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Desasignar Campana de Analista (Protegido)")
async def desasignar_campana_de_analista(
    analista_id: int,
    campana_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    if current_analista.role == UserRole.ANALISTA.value:
        if analista_id != current_analista.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Un Analista solo puede desasignarse campañas a sí mismo.")

    analista_result = await db.execute(
        select(models.Analista)
        .filter(models.Analista.id == analista_id)
        .options(
            selectinload(models.Analista.campanas_asignadas),
            selectinload(models.Analista.tareas).selectinload(models.Tarea.campana),
            selectinload(models.Analista.incidencias_creadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.incidencias_asignadas).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.asignado_a)
            ),
            selectinload(models.Analista.solicitudes_realizadas).selectinload(models.SolicitudHHEE.supervisor),
            selectinload(models.Analista.solicitudes_gestionadas).selectinload(models.SolicitudHHEE.solicitante),
            selectinload(models.Analista.planificaciones)
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
    return

