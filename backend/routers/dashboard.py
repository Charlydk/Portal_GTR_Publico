import pytz
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_
from datetime import datetime, date, time
from typing import List, Optional, Union
from ..database import get_db
from ..sql_app import models
from ..enums import UserRole, EstadoIncidencia, ProgresoTarea
from ..dependencies import get_current_analista, require_role
from ..schemas.models import (
    DashboardStatsAnalista, DashboardStatsSupervisor, DashboardIncidenciaWidget, Tarea
)

router = APIRouter(
    tags=["Dashboard y Monitor"]
)

@router.get("/dashboard/stats", response_model=Union[DashboardStatsAnalista, DashboardStatsSupervisor], summary="Obtener estadísticas para el Dashboard según el rol del usuario")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    today_start_utc = datetime.now(pytz.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end_utc = datetime.now(pytz.utc).replace(hour=23, minute=59, second=59, microsecond=999999)

    try:
        query_activas = select(func.count(models.Incidencia.id)).filter(
            models.Incidencia.estado.in_([EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO])
        )
        res_activas = await db.execute(query_activas)
        total_activas = res_activas.scalar_one()

        if current_analista.role in [UserRole.SUPERVISOR, UserRole.RESPONSABLE]:
            unassigned_query = select(func.count(models.Incidencia.id)).filter(
                models.Incidencia.estado == EstadoIncidencia.ABIERTA,
                models.Incidencia.asignado_a_id.is_(None)
            )
            unassigned_count = (await db.execute(unassigned_query)).scalar_one()

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
            unassigned_query = select(func.count(models.Incidencia.id)).filter(
                models.Incidencia.estado == EstadoIncidencia.ABIERTA,
                models.Incidencia.asignado_a_id.is_(None)
            )
            unassigned_count = (await db.execute(unassigned_query)).scalar_one()

            my_assigned_query = select(func.count(models.Incidencia.id)).filter(
                models.Incidencia.asignado_a_id == current_analista.id,
                models.Incidencia.estado == EstadoIncidencia.EN_PROGRESO
            )
            my_assigned_count = (await db.execute(my_assigned_query)).scalar_one()

            closed_today_query = select(func.count(models.Incidencia.id)).filter(
                models.Incidencia.estado == EstadoIncidencia.CERRADA,
                models.Incidencia.cerrado_por_id == current_analista.id,
                models.Incidencia.fecha_cierre.between(today_start_utc, today_end_utc)
            )
            closed_today_count = (await db.execute(closed_today_query)).scalar_one()

            incidencias_query = select(models.Incidencia).options(
                selectinload(models.Incidencia.campana),
                selectinload(models.Incidencia.asignado_a),
                selectinload(models.Incidencia.lobs),
                selectinload(models.Incidencia.creador),
                selectinload(models.Incidencia.cerrado_por)
            ).filter(
                or_(
                    models.Incidencia.asignado_a_id == current_analista.id,
                    models.Incidencia.asignado_a_id.is_(None)
                ),
                models.Incidencia.estado != EstadoIncidencia.CERRADA
            ).order_by(models.Incidencia.fecha_apertura.desc())
            incidencias_result = await db.execute(incidencias_query)
            incidencias_list = incidencias_result.scalars().unique().all()

            return DashboardStatsAnalista(
                total_incidencias_activas=total_activas,
                incidencias_sin_asignar=unassigned_count,
                mis_incidencias_asignadas=my_assigned_count,
                incidencias_cerradas_hoy=closed_today_count,
                incidencias_del_dia=incidencias_list
            )
    except Exception as e:
        print(f"Error cargando estadísticas del dashboard: {e}")
        if current_analista.role in [UserRole.SUPERVISOR, UserRole.RESPONSABLE]:
            return DashboardStatsSupervisor(total_incidencias_activas=0, incidencias_sin_asignar=0, incidencias_cerradas_hoy=0)
        else:
            return DashboardStatsAnalista(
                total_incidencias_activas=0,
                incidencias_sin_asignar=0,
                mis_incidencias_asignadas=0,
                incidencias_cerradas_hoy=0,
                incidencias_del_dia=[]
            )
    
    raise HTTPException(status_code=403, detail="Rol de usuario no tiene un dashboard GTR definido.")

@router.get("/dashboard/alertas-operativas", summary="Obtener alertas de tareas vencidas o próximas")
async def get_alertas_operativas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    tz_argentina = pytz.timezone("America/Argentina/Tucuman")
    ahora_arg = datetime.now(tz_argentina)
    
    q_sesiones = select(models.SesionCampana).filter(
        models.SesionCampana.analista_id == current_analista.id,
        models.SesionCampana.fecha_fin.is_(None)
    )
    res_sesiones = await db.execute(q_sesiones)
    sesiones = res_sesiones.scalars().all()

    if not sesiones:
        return [] 

    ids_campanas_activas = [s.campana_id for s in sesiones]
    inicio_dia = ahora_arg.replace(hour=0, minute=0, second=0, microsecond=0)
    
    q_tareas = select(models.Tarea).options(
        selectinload(models.Tarea.campana)
    ).filter(
        models.Tarea.campana_id.in_(ids_campanas_activas),
        models.Tarea.es_generada_automaticamente == True,
        models.Tarea.fecha_creacion >= inicio_dia.astimezone(pytz.utc)
    )
    res_tareas = await db.execute(q_tareas)
    tareas = res_tareas.scalars().all()

    if not tareas:
        return []

    alertas = []
    dummy_date = datetime(2000, 1, 1)
    dt_actual = dummy_date.replace(hour=ahora_arg.hour, minute=ahora_arg.minute)

    for tarea in tareas:
        q_items = select(models.ChecklistItem).filter(
            models.ChecklistItem.tarea_id == tarea.id,
            models.ChecklistItem.completado == False,
            models.ChecklistItem.hora_sugerida.is_not(None)
        )
        
        res_items = await db.execute(q_items)
        items = res_items.scalars().all()

        for item in items:
            hora_item = item.hora_sugerida
            dt_item = dummy_date.replace(hour=hora_item.hour, minute=hora_item.minute)
            diferencia_minutos = (dt_actual - dt_item).total_seconds() / 60
            
            estado = None
            if diferencia_minutos > 15:
                estado = "CRITICO" 
            elif 0 <= diferencia_minutos <= 15:
                estado = "EN_CURSO"
            elif -45 <= diferencia_minutos < 0:
                estado = "ATENCION"
            
            if estado:
                alertas.append({
                    "id": item.id,
                    "descripcion": item.descripcion,
                    "hora": hora_item.strftime("%H:%M"),
                    "tipo": estado,
                    "tarea_id": tarea.id,
                    "campana_nombre": tarea.campana.nombre
                })
    
    return alertas

@router.get("/monitor/tareas", response_model=List[Tarea], summary="Monitor de Cumplimiento (Limpio)")
async def get_tareas_monitor(
    fecha: Optional[date] = None,
    campana_id: Optional[int] = None,
    estado: Optional[ProgresoTarea] = None,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    if not fecha:
        fecha = datetime.now().date()
        
    inicio_dia = datetime.combine(fecha, time.min)
    fin_dia = datetime.combine(fecha, time.max)

    query = select(models.Tarea).options(
        selectinload(models.Tarea.campana),
        selectinload(models.Tarea.analista),
        selectinload(models.Tarea.checklist_items), 
        selectinload(models.Tarea.historial_estados).selectinload(models.HistorialEstadoTarea.changed_by_analista),
        selectinload(models.Tarea.comentarios).selectinload(models.ComentarioTarea.autor)
    )

    query = query.filter(models.Tarea.fecha_creacion >= inicio_dia)
    query = query.filter(models.Tarea.fecha_creacion <= fin_dia)

    if campana_id:
        query = query.filter(models.Tarea.campana_id == campana_id)

    if estado:
        query = query.filter(models.Tarea.progreso == estado)

    query = query.order_by(models.Tarea.fecha_creacion.desc())

    result = await db.execute(query)
    return result.scalars().unique().all()

@router.get("/incidencias/activas/recientes", response_model=List[DashboardIncidenciaWidget], summary="Obtener todas las incidencias activas (Optimizado)")
async def get_recientes_incidencias_activas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.ANALISTA, UserRole.SUPERVISOR, UserRole.RESPONSABLE]))
):
    latest_update_subq = select(
        models.ActualizacionIncidencia.incidencia_id,
        func.max(models.ActualizacionIncidencia.id).label('max_id')
    ).group_by(models.ActualizacionIncidencia.incidencia_id).subquery()

    latest_comment_q = select(
        models.ActualizacionIncidencia.incidencia_id,
        models.ActualizacionIncidencia.comentario
    ).join(
        latest_update_subq,
        models.ActualizacionIncidencia.id == latest_update_subq.c.max_id
    ).subquery()

    query = select(
        models.Incidencia,
        latest_comment_q.c.comentario.label('ultimo_comentario')
    ).outerjoin(
        latest_comment_q,
        models.Incidencia.id == latest_comment_q.c.incidencia_id
    ).options(
        selectinload(models.Incidencia.campana),
        selectinload(models.Incidencia.asignado_a)
    ).filter(
        models.Incidencia.estado.in_([EstadoIncidencia.ABIERTA, EstadoIncidencia.EN_PROGRESO])
    ).order_by(models.Incidencia.fecha_apertura.desc())

    result = await db.execute(query)
    incidencias_con_comentarios = result.all()
    
    response = []
    for inc, ultimo_comentario in incidencias_con_comentarios:
        response.append(DashboardIncidenciaWidget(
            id=inc.id,
            titulo=inc.titulo,
            estado=inc.estado,
            gravedad=inc.gravedad,
            campana=inc.campana,
            asignado_a=inc.asignado_a,
            ultimo_comentario=ultimo_comentario or "Sin actualizaciones"
        ))
    
    return response
