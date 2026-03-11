import pandas as pd
import io
import bleach
import pytz
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import datetime, date, timezone, time
from typing import List, Optional, Union
from fastapi.responses import StreamingResponse
from ..database import get_db
from ..sql_app import models
from ..enums import UserRole, EstadoIncidencia
from ..dependencies import get_current_analista, require_role
from ..services.incidencia_service import IncidenciaService
from ..schemas.models import (
    Incidencia, IncidenciaCreate, IncidenciaUpdate, IncidenciaSimple,
    IncidenciaEstadoUpdate, ActualizacionIncidencia, ActualizacionIncidenciaBase,
    IncidenciaExportFilters
)

router = APIRouter(
    tags=["Incidencias"]
)

@router.post("/incidencias/", response_model=Incidencia, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Incidencia")
async def create_incidencia(
    incidencia_data: IncidenciaCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    datos_limpios = incidencia_data.model_dump()
    lob_ids = datos_limpios.pop("lob_ids", [])
    
    if datos_limpios.get("fecha_apertura") is None:
        datos_limpios["fecha_apertura"] = datetime.now(timezone.utc)
        
    db_incidencia = models.Incidencia(**datos_limpios,
                                    creador_id=current_analista.id,
                                    asignado_a_id=current_analista.id,
                                    estado=EstadoIncidencia.EN_PROGRESO)

    if lob_ids:
        lobs_result = await db.execute(select(models.Lob).filter(models.Lob.id.in_(lob_ids)))
        db_incidencia.lobs = lobs_result.scalars().all()

    db.add(db_incidencia)
    await db.commit()
    await db.refresh(db_incidencia)

    return await IncidenciaService.get_incidencias_detalle(db, db_incidencia.id)

@router.get("/incidencias/", response_model=List[IncidenciaSimple], summary="Obtener lista de Incidencias")
async def get_incidencias(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.Incidencia).options(
        selectinload(models.Incidencia.campana),
        selectinload(models.Incidencia.lobs),
        selectinload(models.Incidencia.creador),
        selectinload(models.Incidencia.asignado_a),
        selectinload(models.Incidencia.cerrado_por)
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
            lobs_result = await db.execute(select(models.Lob).filter(models.Lob.id.in_(lob_ids)))
            db_incidencia.lobs = lobs_result.scalars().all()
        else:
            db_incidencia.lobs = []

    historial_comentarios = []
    tz_argentina = pytz.timezone("America/Argentina/Tucuman")

    for key, value in update_dict.items():
        old_value = getattr(db_incidencia, key)
        if old_value != value:
            if isinstance(value, datetime):
                if old_value:
                    old_value_aware = old_value.astimezone(pytz.utc) if old_value.tzinfo is None else old_value
                    old_value_str = old_value_aware.astimezone(tz_argentina).strftime('%d/%m/%Y %H:%M')
                else:
                    old_value_str = "N/A"
                
                new_value_str = value.astimezone(tz_argentina).strftime('%d/%m/%Y %H:%M')
                historial_comentarios.append(f"Campo '{key}' cambiado de '{old_value_str}' a '{new_value_str}'.")

            elif key == "asignado_a_id":
                old_analyst_name = db_incidencia.asignado_a.nombre if db_incidencia.asignado_a else "Nadie"
                new_analyst = await db.get(models.Analista, value) if value else None
                new_analyst_name = new_analyst.nombre if new_analyst else "Nadie"
                historial_comentarios.append(f"Campo 'Asignado a' cambiado de '{old_analyst_name}' a '{new_analyst_name}'.")

            else:
                historial_comentarios.append(f"Campo '{key}' cambiado de '{old_value}' a '{value}'.")
            
            setattr(db_incidencia, key, value)
    
    if historial_comentarios:
        comentario_texto = "Incidencia actualizada por " + current_analista.nombre + ":\n- " + "\n- ".join(historial_comentarios)
        nueva_actualizacion = models.ActualizacionIncidencia(
            comentario=comentario_texto,
            incidencia_id=incidencia_id,
            autor_id=current_analista.id,
            fecha_actualizacion=datetime.now(timezone.utc)
        )
        db.add(nueva_actualizacion)

    await db.commit()
    return await IncidenciaService.get_incidencias_detalle(db, incidencia_id)

@router.get("/incidencias/filtradas/", response_model=List[IncidenciaSimple], summary="[Portal de Control] Obtener incidencias con filtros avanzados")
async def get_incidencias_filtradas(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA])),
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    campana_id: Optional[int] = None,
    estado: Optional[Union[List[str], str]] = Query(default=None), 
    asignado_a_id: Optional[int] = None
):
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
        estados_finales = []
        lista_temporal = []
        if isinstance(estado, str):
            if ',' in estado:
                lista_temporal = estado.split(',')
            else:
                lista_temporal = [estado]
        else:
            lista_temporal = estado

        for e_str in lista_temporal:
            try:
                e_clean = e_str.strip()
                for estado_enum in EstadoIncidencia:
                    if estado_enum.value == e_clean:
                        estados_finales.append(estado_enum)
                        break
            except ValueError:
                continue
        
        if estados_finales:
            query = query.filter(models.Incidencia.estado.in_(estados_finales))

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
    comentario_limpio = bleach.clean(actualizacion_data.comentario)
    db_actualizacion = models.ActualizacionIncidencia(
        comentario=comentario_limpio,
        incidencia_id=incidencia_id,
        autor_id=current_analista.id,
        fecha_actualizacion=datetime.now(timezone.utc)
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
    comentario_cambio_estado = f"El estado de la incidencia cambió de '{estado_anterior}' a '{update_data.estado.value}'."
    actualizacion_estado = models.ActualizacionIncidencia(
        comentario=comentario_cambio_estado,
        incidencia_id=incidencia_id,
        autor_id=current_analista.id,
        fecha_actualizacion=datetime.now(timezone.utc)
    )
    db.add(actualizacion_estado)

    db_incidencia.estado = update_data.estado

    if update_data.estado == EstadoIncidencia.CERRADA:
        db_incidencia.fecha_cierre = update_data.fecha_cierre or datetime.now(timezone.utc)
        db_incidencia.asignado_a_id = None
        db_incidencia.cerrado_por_id = current_analista.id
        
        if update_data.comentario_cierre:
            texto_comentario_cierre = f"Comentario de Cierre: {update_data.comentario_cierre}"
            actualizacion_cierre = models.ActualizacionIncidencia(
                comentario=texto_comentario_cierre,
                incidencia_id=incidencia_id,
                autor_id=current_analista.id,
                fecha_actualizacion=datetime.now(timezone.utc)
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al guardar el cambio de estado: {e}"
        )
    
    return await IncidenciaService.get_incidencias_detalle(db, incidencia_id)

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
    
    db_incidencia.asignado_a_id = current_analista.id
    await db.commit()
    return await IncidenciaService.get_incidencias_detalle(db, incidencia_id)

@router.get("/incidencias/mis-incidencias", response_model=List[IncidenciaSimple], summary="Obtener incidencias asignadas al analista actual")
async def get_mis_incidencias(
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    query = select(models.Incidencia).options(
        selectinload(models.Incidencia.campana),
        selectinload(models.Incidencia.lobs),
        selectinload(models.Incidencia.creador),
        selectinload(models.Incidencia.asignado_a),
        selectinload(models.Incidencia.cerrado_por)
    ).filter(models.Incidencia.asignado_a_id == current_analista.id).order_by(models.Incidencia.fecha_apertura.desc())

    result = await db.execute(query)
    return result.scalars().unique().all()

@router.get("/incidencias/{incidencia_id}", response_model=Incidencia, summary="Obtener detalles de una Incidencia")
async def get_incidencia_detalle(
    incidencia_id: int,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    return await IncidenciaService.get_incidencias_detalle(db, incidencia_id)

@router.post("/incidencias/exportar/", summary="Exporta incidencias filtradas a Excel")
async def exportar_incidencias(
    filtros: IncidenciaExportFilters,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.ANALISTA]))
):
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

    datos_para_excel = []
    for inc in incidencias:
        comentario_cierre = "N/A"
        if inc.estado == EstadoIncidencia.CERRADA:
            for act in sorted(inc.actualizaciones, key=lambda x: x.fecha_actualizacion, reverse=True):
                if "Comentario de Cierre: " in act.comentario:
                    comentario_cierre = act.comentario.split("Comentario de Cierre: ")[1]
                    break

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
            "Fecha Apertura": inc.fecha_apertura.strftime("%d-%m-%Y %H:%M") if inc.fecha_apertura else "N/A",
            "Fecha Cierre": inc.fecha_cierre.strftime("%d-%m-%Y %H:%M") if inc.fecha_cierre else "N/A",
            "Comentario de Cierre": comentario_cierre
        })
    
    df = pd.DataFrame(datos_para_excel)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Incidencias')
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="Reporte_Incidencias_{date.today().isoformat()}.xlsx"'
    }
    
    return StreamingResponse(output, headers=headers, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
