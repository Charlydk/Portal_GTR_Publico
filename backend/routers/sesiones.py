import pytz
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from typing import List
from ..database import get_db
from ..sql_app import models
from ..enums import UserRole
from ..dependencies import get_current_analista, require_role
from ..schemas.models import (
    SesionActiva, CheckInCreate, CoberturaCampana
)

router = APIRouter(
    prefix="/sesiones",
    tags=["Sesiones"]
)

@router.post("/check-in", response_model=SesionActiva, summary="Iniciar gestión en una campaña")
async def check_in_campana(
    datos: CheckInCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    # Usamos UTC para todo el manejo de base de datos
    ahora_utc = datetime.now(timezone.utc)
    hoy_inicio_utc = ahora_utc.replace(hour=0, minute=0, second=0, microsecond=0)

    # --- FASE 1: LIMPIEZA DE ZOMBIS ---
    q_zombis = select(models.SesionCampana).filter(
        models.SesionCampana.analista_id == current_analista.id,
        models.SesionCampana.fecha_fin.is_(None),
        models.SesionCampana.fecha_inicio < hoy_inicio_utc
    )
    result_zombis = await db.execute(q_zombis)
    sesiones_zombis = result_zombis.scalars().all()

    if sesiones_zombis:
        for zombi in sesiones_zombis:
            fin_dia_zombi = zombi.fecha_inicio.replace(hour=23, minute=59, second=59)
            zombi.fecha_fin = fin_dia_zombi
            db.add(zombi)
        await db.commit()

    # --- FASE 2: VERIFICACIÓN ESPECÍFICA ---
    query_target = select(models.SesionCampana).filter(
        models.SesionCampana.analista_id == current_analista.id,
        models.SesionCampana.campana_id == datos.campana_id,
        models.SesionCampana.fecha_fin.is_(None)
    )
    result_target = await db.execute(query_target)
    sesion_existente = result_target.scalars().first()

    if sesion_existente:
        result_full = await db.execute(
            select(models.SesionCampana).options(
                selectinload(models.SesionCampana.campana).options(
                    selectinload(models.Campana.lobs),
                    selectinload(models.Campana.analistas_asignados)
                )
            ).filter(models.SesionCampana.id == sesion_existente.id)
        )
        return result_full.scalars().first()

    # --- FASE 3: CREACIÓN DE NUEVA SESIÓN ---
    nueva_sesion = models.SesionCampana(
        analista_id=current_analista.id,
        campana_id=datos.campana_id,
        fecha_inicio=datetime.now(timezone.utc)
    )
    db.add(nueva_sesion)
    await db.commit()
    await db.refresh(nueva_sesion) 
    
    # --- FASE 4: GENERACIÓN DE RUTINA (Lógica Colaborativa) ---
    q_tarea_existente = select(models.Tarea).filter(
        models.Tarea.campana_id == datos.campana_id,
        models.Tarea.es_generada_automaticamente == True,
        models.Tarea.fecha_creacion >= hoy_inicio_utc
    )
    result_tarea = await db.execute(q_tarea_existente)
    tarea_compartida = result_tarea.scalars().first()

    if not tarea_compartida:
        tz_argentina = pytz.timezone("America/Argentina/Tucuman")
        ahora_arg = datetime.now(tz_argentina)
        dia_semana_int = ahora_arg.weekday()

        mapa_dias = {
            0: models.ItemPlantillaChecklist.lunes,
            1: models.ItemPlantillaChecklist.martes,
            2: models.ItemPlantillaChecklist.miercoles,
            3: models.ItemPlantillaChecklist.jueves,
            4: models.ItemPlantillaChecklist.viernes,
            5: models.ItemPlantillaChecklist.sabado,
            6: models.ItemPlantillaChecklist.domingo
        }
        columna_dia_hoy = mapa_dias[dia_semana_int]

        q_items_plantilla = select(models.ItemPlantillaChecklist).filter(
            models.ItemPlantillaChecklist.campana_id == datos.campana_id,
            columna_dia_hoy == True
        )
        res_items = await db.execute(q_items_plantilla)
        items_plantilla = res_items.scalars().all()

        vencimiento_utc = ahora_arg.replace(hour=23, minute=59, second=59).astimezone(timezone.utc)

        nueva_tarea = models.Tarea(
            titulo=f"Rutina GTR - {ahora_arg.strftime('%d/%m')}",
            descripcion=f"Checklist automático generado para la campaña.",
            es_generada_automaticamente=True,
            campana_id=datos.campana_id,
            analista_id=None, # Rutina compartida
            fecha_creacion=ahora_utc,
            fecha_vencimiento=vencimiento_utc
        )
        db.add(nueva_tarea)
        await db.commit()
        await db.refresh(nueva_tarea)

        for item in items_plantilla:
            checklist_item = models.ChecklistItem(
                tarea_id=nueva_tarea.id,
                descripcion=item.descripcion,
                hora_sugerida=item.hora_sugerida,
                completado=False
            )
            db.add(checklist_item)
        
        await db.commit()

    result_full = await db.execute(
        select(models.SesionCampana).options(
            selectinload(models.SesionCampana.campana).options(
                selectinload(models.Campana.lobs),
                selectinload(models.Campana.analistas_asignados)
            )
        ).filter(models.SesionCampana.id == nueva_sesion.id)
    )
    return result_full.scalars().first()

@router.post("/check-out", summary="Dejar de gestionar una campaña")
async def check_out_campana(
    datos: CheckInCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.SesionCampana).filter(
        models.SesionCampana.analista_id == current_analista.id,
        models.SesionCampana.campana_id == datos.campana_id,
        models.SesionCampana.fecha_fin.is_(None)
    )
    result = await db.execute(query)
    sesion = result.scalars().first()

    if not sesion:
        raise HTTPException(status_code=404, detail="No tienes una sesión activa en esta campaña.")

    sesion.fecha_fin = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": "Sesión finalizada correctamente", "campana_id": datos.campana_id}

@router.get("/cobertura", response_model=List[CoberturaCampana], summary="Radar de Cobertura (Con Nombres y Horarios)")
async def obtener_cobertura_operativa(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA]))
):
    tz_argentina = pytz.timezone("America/Argentina/Tucuman")
    ahora_arg = datetime.now(tz_argentina)
    inicio_dia_hoy = ahora_arg.replace(hour=0, minute=0, second=0, microsecond=0)
    hora_actual = ahora_arg.time()
    dia_semana = ahora_arg.weekday() 

    query = select(models.Campana).options(
        selectinload(models.Campana.sesiones).selectinload(models.SesionCampana.analista)
    )
    result = await db.execute(query)
    campanas = result.scalars().all()
    
    reporte_cobertura = []

    for campana in campanas:
        sesiones_activas = []
        for s in campana.sesiones:
            if s.fecha_fin is not None:
                continue
            if s.fecha_inicio.tzinfo is None:
                inicio_local = pytz.utc.localize(s.fecha_inicio).astimezone(tz_argentina)
            else:
                inicio_local = s.fecha_inicio.astimezone(tz_argentina)
            if inicio_local >= inicio_dia_hoy:
                sesiones_activas.append(s)
        
        analistas_online = len(sesiones_activas)
        lista_nombres = [f"{s.analista.nombre} {s.analista.apellido}" for s in sesiones_activas if s.analista]

        inicio = None
        fin = None
        
        if dia_semana == 5:
            inicio = campana.hora_inicio_sabado
            fin = campana.hora_fin_sabado
        elif dia_semana == 6:
            inicio = campana.hora_inicio_domingo
            fin = campana.hora_fin_domingo
        else:
            inicio = campana.hora_inicio_semana
            fin = campana.hora_fin_semana
        
        estado = "DESCONOCIDO"

        if not inicio or not fin:
            estado = "CUBIERTA" if analistas_online > 0 else "CERRADA"
        else:
            esta_operativa = False
            if inicio <= fin:
                esta_operativa = inicio <= hora_actual <= fin
            else:
                esta_operativa = hora_actual >= inicio or hora_actual <= fin
            
            if not esta_operativa:
                estado = "CERRADA"
            else:
                estado = "CUBIERTA" if analistas_online > 0 else "DESCUBIERTA"

        reporte_cobertura.append(CoberturaCampana(
            campana_id=campana.id,
            nombre_campana=campana.nombre,
            estado=estado,
            analistas_activos=analistas_online,
            hora_inicio_hoy=inicio,
            hora_fin_hoy=fin,
            nombres_analistas=lista_nombres
        ))

    return reporte_cobertura

@router.get("/activas", response_model=List[SesionActiva], summary="Ver mis campañas activas (con limpieza automática)")
async def obtener_mis_sesiones_activas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    inicio_dia_hoy_utc = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

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
    sesiones_abiertas = result.scalars().all()
    
    sesiones_validas = []
    hubo_cierre_automatico = False

    for sesion in sesiones_abiertas:
        if sesion.fecha_inicio.tzinfo is None:
            inicio_sesion_utc = sesion.fecha_inicio.replace(tzinfo=timezone.utc)
        else:
            inicio_sesion_utc = sesion.fecha_inicio.astimezone(timezone.utc)

        if inicio_sesion_utc < inicio_dia_hoy_utc:
            sesion.fecha_fin = datetime.now(timezone.utc)
            hubo_cierre_automatico = True
        else:
            sesiones_validas.append(sesion)

    if hubo_cierre_automatico:
        await db.commit()

    return sesiones_validas
