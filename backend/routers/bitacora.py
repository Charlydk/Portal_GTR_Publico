import pandas as pd
import io
import bleach
import pytz
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import date, datetime
from typing import List, Optional
from fastapi.responses import StreamingResponse
from ..database import get_db
from ..sql_app import models
from ..enums import UserRole
from ..dependencies import get_current_analista, require_role
from ..schemas.models import (
    BitacoraEntry, BitacoraEntryCreate, BitacoraEntryUpdate,
    ComentarioGeneralBitacora, ComentarioGeneralBitacoraCreate, BitacoraExportFilters, Lob
)

router = APIRouter(
    tags=["Bitácora"]
)

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

@router.post("/bitacora_entries/", response_model=BitacoraEntry, status_code=status.HTTP_201_CREATED, summary="Crear una nueva Entrada de Bitácora")
async def create_bitacora_entry(
    entry: BitacoraEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_analista: models.Analista = Depends(get_current_analista)
):
    campana_existente_result = await db.execute(select(models.Campana).filter(models.Campana.id == entry.campana_id))
    if not campana_existente_result.scalars().first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaña no encontrada.")
    
    tucuman_tz = pytz.timezone("America/Argentina/Tucuman")
    now_arg = datetime.now(tucuman_tz)
    fecha_correcta = now_arg.date()
    
    datos_limpios = entry.model_dump(exclude={"fecha", "lob_id"})
    
    if datos_limpios.get("comentario"):
        datos_limpios["comentario"] = bleach.clean(datos_limpios["comentario"])
    
    db_entry = models.BitacoraEntry(
        **datos_limpios,
        fecha=fecha_correcta, 
        autor_id=current_analista.id,
        lob_id=entry.lob_id
    )
    
    db.add(db_entry)
    await db.commit()
    await db.refresh(db_entry)

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
            selectinload(models.BitacoraEntry.autor)
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

@router.get("/bitacora/log_de_hoy/{campana_id}", summary="Obtiene el log del día operativo actual (Hora de Argentina)")
async def get_log_de_hoy(
    campana_id: int,
    db: AsyncSession = Depends(get_db)
):
    try:
        tz_argentina = pytz.timezone("America/Argentina/Buenos_Aires")
        fecha_hoy_arg = datetime.now(tz_argentina).date()

        query = (
            select(models.BitacoraEntry)
            .options(
                selectinload(models.BitacoraEntry.autor),
                selectinload(models.BitacoraEntry.lob),
                selectinload(models.BitacoraEntry.campana),
                selectinload(models.BitacoraEntry.incidencia)
            )
            .where(
                models.BitacoraEntry.campana_id == campana_id,
                models.BitacoraEntry.fecha == fecha_hoy_arg
            )
            .order_by(
                models.BitacoraEntry.hora.desc()
            )
        )
        
        result = await db.execute(query)
        return result.scalars().all()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener el log de hoy: {e}")

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
    comentarios = result.scalars().unique().all()
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
        contenido=comentario_data.contenido,
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
    entradas = result.scalars().all()

    if not entradas:
        raise HTTPException(status_code=404, detail="No se encontraron eventos con los filtros seleccionados.")

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
