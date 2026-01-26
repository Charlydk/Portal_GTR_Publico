# /backend/routers/hhee_router.py

import asyncio
from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, update, or_
from sqlalchemy.orm import selectinload
from ..services import geovictoria_service
from datetime import datetime, date
from typing import List, Optional

from ..database import get_db
from ..dependencies import get_current_analista
from ..sql_app import models
from pydantic import BaseModel

from ..dependencies import require_role
from ..enums import UserRole, TipoSolicitudHHEE, EstadoSolicitudHHEE
from enum import Enum

from ..schemas.models import DashboardHHEEMetricas, MetricasPorEmpleado, MetricasPorCampana, MetricasPendientesHHEE, SolicitudHHEECreate, SolicitudHHEE, SolicitudHHEEDecision, SolicitudHHEELote

from ..utils import decimal_to_hhmm, formatear_rut, get_current_hhee_period

import bleach
import pandas as pd
import io


# --- MODELOS PARA LA EXPORTACIÓN ---
class ExportFormat(str, Enum):
    RRHH = "RRHH"
    OPERACIONES = "OPERACIONES"

class ExportRequest(BaseModel):
    fecha_inicio: date
    fecha_fin: date
    formato: ExportFormat


class ConsultaHHEE(BaseModel):
    rut: str
    fecha_inicio: date
    fecha_fin: date
    
class ValidacionDia(BaseModel):
    # Datos que necesitamos para identificar el día
    rut_con_formato: str
    fecha: date
    nombre_apellido: str
    campaña: Optional[str] = None

    # Datos de la validación del usuario
    hhee_aprobadas_inicio: float = 0
    hhee_aprobadas_fin: float = 0
    hhee_aprobadas_descanso: float = 0
    turno_es_incorrecto: bool = False
    nota: Optional[str] = None

    # Datos de referencia de GeoVictoria
    inicio_turno_teorico: Optional[str] = None
    fin_turno_teorico: Optional[str] = None
    marca_real_inicio: Optional[str] = None
    marca_real_fin: Optional[str] = None
    hhee_inicio_calculadas: Optional[float] = None
    hhee_fin_calculadas: Optional[float] = None
    cantidad_hhee_calculadas: Optional[float] = None

class CargarHHEERequest(BaseModel):
    validaciones: List[ValidacionDia]
    
class ConfirmacionPorIDs(BaseModel):
    ids_a_marcar: List[int]

router = APIRouter(
    tags=["Portal HHEE"]
)

@router.post("/consultar-empleado")
async def consultar_empleado(
    consulta: ConsultaHHEE,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    token = await geovictoria_service.obtener_token_geovictoria()
    if not token:
        raise HTTPException(status_code=503, detail="No se pudo comunicar con el servicio externo (GeoVictoria).")

    rut_limpio_api = consulta.rut.replace('-', '').replace('.', '').upper()
    fecha_inicio_dt = datetime.combine(consulta.fecha_inicio, datetime.min.time())
    fecha_fin_dt = datetime.combine(consulta.fecha_fin, datetime.max.time())

    datos_gv = await geovictoria_service.obtener_datos_completos_periodo(
        token, [rut_limpio_api], fecha_inicio_dt, fecha_fin_dt
    )

    if not datos_gv:
        raise HTTPException(status_code=404, detail="No se encontraron datos en GeoVictoria para el RUT y período seleccionados.")

    query_guardados = select(models.ValidacionHHEE).filter(
        models.ValidacionHHEE.rut == consulta.rut,
        models.ValidacionHHEE.fecha_hhee.between(consulta.fecha_inicio, consulta.fecha_fin)
    )
    result_guardados = await db.execute(query_guardados)
    validaciones_guardadas = result_guardados.scalars().all()

    datos_guardados_por_fecha = {}
    for v in validaciones_guardadas:
        fecha_str = v.fecha_hhee.strftime('%Y-%m-%d')
        if fecha_str not in datos_guardados_por_fecha:
            datos_guardados_por_fecha[fecha_str] = []
        datos_guardados_por_fecha[fecha_str].append(v)

    resultados_finales = []
    for datos_dia_gv in datos_gv:
        logica_negocio = geovictoria_service.aplicar_logica_de_negocio(datos_dia_gv)
        datos_dia_completo = {**datos_dia_gv, **logica_negocio}
        fecha = datos_dia_completo['fecha']

        registros_del_dia = datos_guardados_por_fecha.get(fecha, [])

        # Inicializamos los campos que vendrán de la BD
        datos_dia_completo['estado_final'] = 'No Guardado'
        datos_dia_completo['notas'] = ''
        datos_dia_completo['hhee_aprobadas_inicio'] = 0
        datos_dia_completo['hhee_aprobadas_fin'] = 0
        datos_dia_completo['hhee_aprobadas_descanso'] = 0

        if registros_del_dia:
            # Si hay CUALQUIER registro pendiente para el día, el estado general es pendiente
            registro_pendiente = next((r for r in registros_del_dia if r.estado == 'Pendiente por Corrección'), None)
            if registro_pendiente:
                datos_dia_completo['estado_final'] = 'Pendiente por Corrección'
                datos_dia_completo['notas'] = registro_pendiente.notas
            else:
                # Si no hay pendientes, es Validado y sumamos las horas aprobadas
                datos_dia_completo['estado_final'] = 'Validado'
                for registro in registros_del_dia:
                    if registro.tipo_hhee == 'Antes de Turno':
                        datos_dia_completo['hhee_aprobadas_inicio'] = registro.cantidad_hhee_aprobadas
                    elif registro.tipo_hhee == 'Después de Turno':
                        datos_dia_completo['hhee_aprobadas_fin'] = registro.cantidad_hhee_aprobadas
                    elif registro.tipo_hhee == 'Día de Descanso':
                        datos_dia_completo['hhee_aprobadas_descanso'] = registro.cantidad_hhee_aprobadas

        resultados_finales.append(datos_dia_completo)

    nombre_agente = resultados_finales[0].get('nombre_apellido', 'No encontrado')

    return {"datos_periodo": resultados_finales, "nombre_agente": nombre_agente}
    
@router.post("/cargar-hhee", summary="Guarda o actualiza las validaciones de HHEE")
async def cargar_horas_extras(
    request_body: CargarHHEERequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    # 1. CAMBIO: Renombramos la lista para mayor claridad
    resumen_operaciones = []

    for validacion in request_body.validaciones:
        rut_formateado = formatear_rut(validacion.rut_con_formato)

        query_existentes = select(models.ValidacionHHEE).filter_by(
            rut=rut_formateado,
            fecha_hhee=validacion.fecha
        )
        result_existentes = await db.execute(query_existentes)
        registros_del_dia = result_existentes.scalars().all()

        registros_validados = {r.tipo_hhee: r for r in registros_del_dia if r.estado == 'Validado'}
        pendiente_record = next((r for r in registros_del_dia if r.estado == 'Pendiente por Corrección'), None)

        # --- Lógica para corregir un 'Pendiente' mal marcado ---
        total_horas_enviadas = (
            validacion.hhee_aprobadas_inicio +
            validacion.hhee_aprobadas_fin +
            validacion.hhee_aprobadas_descanso
        )
        if pendiente_record and not validacion.turno_es_incorrecto and total_horas_enviadas == 0:
            await db.delete(pendiente_record)
            # 2. CAMBIO: Usamos la nueva estructura de objeto
            resumen_operaciones.append({
                "fecha": validacion.fecha.isoformat(),
                "rut": validacion.rut_con_formato,
                "accion": "Marca 'Pendiente' eliminada."
            })
            continue

        if validacion.turno_es_incorrecto:
            if pendiente_record:
                if pendiente_record.notas != validacion.nota:
                    pendiente_record.notas = bleach.clean(validacion.nota) if validacion.nota else None
                    resumen_operaciones.append({"fecha": validacion.fecha.isoformat(), "rut": validacion.rut_con_formato, "accion": "Nota de pendiente actualizada."})
            else:
                for reg in registros_validados.values():
                    await db.delete(reg)

                db.add(models.ValidacionHHEE(
                    rut=rut_formateado, nombre_apellido=validacion.nombre_apellido, campaña=validacion.campaña,
                    fecha_hhee=validacion.fecha, estado="Pendiente por Corrección", notas=validacion.nota,
                    supervisor_carga=current_user.email, tipo_hhee="General"
                ))
                resumen_operaciones.append({"fecha": validacion.fecha.isoformat(), "rut": validacion.rut_con_formato, "accion": f"Marcado como 'Pendiente': {validacion.nota}"})
            continue

        base_datos_bd = {
            "rut": rut_formateado, "nombre_apellido": validacion.nombre_apellido, "campaña": validacion.campaña,
            "fecha_hhee": validacion.fecha, "supervisor_carga": current_user.email, "estado": "Validado"
        }

        hhee_a_procesar = {
            "Antes de Turno": validacion.hhee_aprobadas_inicio,
            "Después de Turno": validacion.hhee_aprobadas_fin,
            "Día de Descanso": validacion.hhee_aprobadas_descanso
        }

        pendiente_actualizado_en_este_ciclo = False
        for tipo, aprobadas in hhee_a_procesar.items():
            registro_existente = registros_validados.get(tipo)

            if registro_existente and registro_existente.cantidad_hhee_aprobadas > 0:
                resumen_operaciones.append({"fecha": validacion.fecha.isoformat(), "rut": validacion.rut_con_formato, "accion": f"({tipo}): Ya validado, sin cambios."})
                continue

            if aprobadas > 0:
                if pendiente_record and not pendiente_actualizado_en_este_ciclo:
                    pendiente_record.estado = "Validado"
                    pendiente_record.tipo_hhee = tipo
                    pendiente_record.cantidad_hhee_aprobadas = aprobadas
                    pendiente_record.notas = None
                    resumen_operaciones.append({
                        "fecha": validacion.fecha.isoformat(),
                        "rut": validacion.rut_con_formato,
                        # --- CAMBIO AQUÍ ---
                        "accion": f"Re-validado desde pendiente ({tipo}): {decimal_to_hhmm(aprobadas)} hs."
                    })
                    pendiente_actualizado_en_este_ciclo = True
                else:
                    nueva_validacion = models.ValidacionHHEE(**base_datos_bd, tipo_hhee=tipo, cantidad_hhee_aprobadas=aprobadas)
                    db.add(nueva_validacion)
                    resumen_operaciones.append({
                        "fecha": validacion.fecha.isoformat(),
                        "rut": validacion.rut_con_formato,
                        # --- Y CAMBIO AQUÍ ---
                        "accion": f"Nuevo registro ({tipo}): {decimal_to_hhmm(aprobadas)} hs."
                    })

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar en la base de datos: {e}")

    # 3. CAMBIO: Devolvemos un objeto con el resumen detallado
    return {
        "mensaje": "Proceso finalizado con éxito.",
        "resumen_detallado": resumen_operaciones
    }

@router.get("/pendientes", summary="Consulta registros pendientes de HHEE (con filtro opcional de fecha)")
async def consultar_pendientes(
    fecha_inicio: Optional[date] = Query(None),
    fecha_fin: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    # 1. Consulta Base (Igual que antes)
    base_query = select(models.ValidacionHHEE).filter(
        models.ValidacionHHEE.estado == 'Pendiente por Corrección'
    )

    if current_user.role == UserRole.SUPERVISOR_OPERACIONES:
        query = base_query.filter(models.ValidacionHHEE.supervisor_carga == current_user.email)
    else:
        query = base_query

    # Si no se pasan fechas, traemos solo el periodo actual para todos
    filtro_inicio, filtro_fin = fecha_inicio, fecha_fin
    if not filtro_inicio or not filtro_fin:
        filtro_inicio, filtro_fin = get_current_hhee_period()

    if filtro_inicio and filtro_fin:
        query = query.filter(models.ValidacionHHEE.fecha_hhee.between(filtro_inicio, filtro_fin))
    
    query = query.order_by(models.ValidacionHHEE.nombre_apellido.asc(), models.ValidacionHHEE.fecha_hhee.asc())
    
    result = await db.execute(query)
    pendientes = result.scalars().all()

    if not pendientes:
        return {"datos_periodo": [], "nombre_agente": "Múltiples Agentes con Pendientes"}

    # --- CAMBIO CLAVE AQUÍ ---
    # Solo consultamos GeoVictoria si:
    # A) Es un Supervisor de Operaciones (necesita el detalle para corregir).
    # B) O si se ha filtrado por un rango de fechas específico (asumimos que quiere ver detalle).
    # Si es un Supervisor GTR viendo el global histórico, NO consultamos GV.
    
    debe_consultar_gv = (current_user.role == UserRole.SUPERVISOR_OPERACIONES) or (fecha_inicio and fecha_fin)

    lookup_data = {}
    
    if debe_consultar_gv:
        ruts_limpios_unicos = list({p.rut.strip().replace('-', '').replace('.', '').upper() for p in pendientes})
        
        if filtro_inicio and filtro_fin:
            start_date = filtro_inicio
            end_date = filtro_fin
        else:
            start_date = min(p.fecha_hhee for p in pendientes)
            end_date = max(p.fecha_hhee for p in pendientes)

        fecha_inicio_dt = datetime.combine(start_date, datetime.min.time())
        fecha_fin_dt = datetime.combine(end_date, datetime.max.time())

        token = await geovictoria_service.obtener_token_geovictoria()
        datos_completos_gv = []
        if token:
            try:
                datos_completos_gv = await geovictoria_service.obtener_datos_completos_periodo(
                    token, ruts_limpios_unicos, fecha_inicio_dt, fecha_fin_dt
                )
            except Exception as e:
                print(f"ADVERTENCIA: Falló la consulta masiva a GV: {e}")

        lookup_data = {
            (d.get('rut_limpio'), d.get('fecha')): d for d in datos_completos_gv
        }

    # Construimos la respuesta
    resultados_enriquecidos = []
    for p in pendientes:
        rut_limpio = p.rut.strip().replace('-', '').replace('.', '').upper()
        fecha_str = p.fecha_hhee.strftime('%Y-%m-%d')
        
        # Si no consultamos GV, lookup_data estará vacío y usará valores por defecto (00:00)
        datos_dia_gv = lookup_data.get((rut_limpio, fecha_str), {})
        
        # Si hay datos de GV, calculamos lógica de negocio. Si no, devolvemos básicos.
        if datos_dia_gv:
            logica_negocio = geovictoria_service.aplicar_logica_de_negocio(datos_dia_gv)
            datos_combinados = {**datos_dia_gv, **logica_negocio}
        else:
            # Datos mínimos para visualización sin GV
            datos_combinados = {
                "rut_limpio": rut_limpio,
                "rut": p.rut,
                "campaña": p.campaña,
                "inicio_turno_teorico": p.turno_teorico_inicio or "N/A", # Recuperamos de BD si existe
                "fin_turno_teorico": p.turno_teorico_fin or "N/A",
                "marca_real_inicio": p.marca_real_inicio or "N/A",
                "marca_real_fin": p.marca_real_fin or "N/A",
                "hhee_inicio_calculadas": 0,
                "hhee_fin_calculadas": 0,
                "cantidad_hhee_calculadas": 0,
                "hhee_autorizadas_antes_gv": 0,
                "hhee_autorizadas_despues_gv": 0
            }
        
        datos_dia_completo = {
            **datos_combinados,
            "nombre_apellido": p.nombre_apellido,
            "rut_con_formato": p.rut,
            "fecha": fecha_str, 
            "estado_final": 'Pendiente por Corrección',
            "notas": p.notas,
            "hhee_aprobadas_inicio": 0,
            "hhee_aprobadas_fin": 0, 
            "hhee_aprobadas_descanso": 0,
        }
        
        resultados_enriquecidos.append(datos_dia_completo)

    return {
        "datos_periodo": resultados_enriquecidos,
        "nombre_agente": "Múltiples Agentes con Pendientes"
    }

@router.post("/exportar", summary="Exporta validaciones de HHEE a un archivo Excel (Solo Lectura)")
async def exportar_hhee_a_excel(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    try:
        # Consulta base para obtener registros validados en el rango de fechas
        base_query = select(models.ValidacionHHEE).filter(
            models.ValidacionHHEE.estado == 'Validado',
            models.ValidacionHHEE.fecha_hhee.between(request.fecha_inicio, request.fecha_fin)
        )

        # Filtro adicional si el usuario es Supervisor de Operaciones
        if current_user.role == UserRole.SUPERVISOR_OPERACIONES:
            query = base_query.filter(models.ValidacionHHEE.supervisor_carga == current_user.email)
        else:
            query = base_query

        # Si el formato es para RRHH, solo mostramos los que aún no han sido reportados
        if request.formato == ExportFormat.RRHH:
            query = query.filter(models.ValidacionHHEE.reportado_a_rrhh == False)

        result = await db.execute(query.order_by(models.ValidacionHHEE.rut, models.ValidacionHHEE.fecha_hhee))
        validaciones = result.scalars().all()

        if not validaciones:
            raise HTTPException(status_code=404, detail="No se encontraron HHEE para los filtros seleccionados.")

        # Lógica para generar el formato de Operaciones
        if request.formato == ExportFormat.OPERACIONES:
            ruts_unicos = list({v.rut.replace('.', '').replace('-', '') for v in validaciones})
            token_gv = await geovictoria_service.obtener_token_geovictoria()
            if not token_gv: raise HTTPException(status_code=503, detail="No se pudo conectar con GeoVictoria.")

            fecha_inicio_dt = datetime.combine(request.fecha_inicio, datetime.min.time())
            fecha_fin_dt = datetime.combine(request.fecha_fin, datetime.max.time())
            datos_gv = await geovictoria_service.obtener_datos_completos_periodo(token_gv, ruts_unicos, fecha_inicio_dt, fecha_fin_dt)
            
            rrhh_lookup = {}
            for dia in datos_gv:
                key = (dia['rut_limpio'], dia['fecha'])
                rrhh_lookup[key] = {
                    "antes": dia.get('hhee_autorizadas_antes_gv', 0) or 0,
                    "despues": dia.get('hhee_autorizadas_despues_gv', 0) or 0
                }
            
            datos_para_excel = []
            for v in validaciones:
                rut_limpio_actual = v.rut.replace('.', '').replace('-', '')
                fecha_actual_str = v.fecha_hhee.strftime('%Y-%m-%d')
                horas_rrhh_dict = rrhh_lookup.get((rut_limpio_actual, fecha_actual_str), {"antes": 0, "despues": 0})
                
                horas_rrhh_especificas = 0
                if v.tipo_hhee == "Antes de Turno":
                    horas_rrhh_especificas = horas_rrhh_dict.get("antes", 0)
                elif v.tipo_hhee == "Después de Turno":
                    horas_rrhh_especificas = horas_rrhh_dict.get("despues", 0)
                elif v.tipo_hhee == "Día de Descanso":
                    horas_rrhh_especificas = horas_rrhh_dict.get("antes", 0) + horas_rrhh_dict.get("despues", 0)

                datos_para_excel.append({
                    "ID": v.id, "RUT": v.rut, "Nombre Completo": v.nombre_apellido, "Campaña": v.campaña,
                    "Fecha HHEE": v.fecha_hhee.strftime('%d-%m-%Y'), "Tipo HHEE": v.tipo_hhee,
                    "Horas Aprobadas (Operaciones)": decimal_to_hhmm(v.cantidad_hhee_aprobadas),
                    "Horas Aprobadas (RRHH)": decimal_to_hhmm(horas_rrhh_especificas),
                    "Estado": v.estado, "Validado Por": v.supervisor_carga,
                    "Fecha de Carga": v.fecha_carga.strftime('%d-%m-%Y %H:%M') if v.fecha_carga else None
                })
        
        # Lógica para generar el formato de RRHH
        elif request.formato == ExportFormat.RRHH:
            permiso_map = {"Antes de Turno": 10, "Después de Turno": 5, "Día de Descanso": 10}
            datos_para_excel = [{
                "Cod Funcionario": v.rut, "Nombre": v.nombre_apellido,
                "Num Permiso": permiso_map.get(v.tipo_hhee, ''),
                "Fecha Inicio": v.fecha_hhee.strftime('%d/%m/%Y'),
                "Fecha Fin": v.fecha_hhee.strftime('%d/%m/%Y'),
                "Cant Horas": decimal_to_hhmm(v.cantidad_hhee_aprobadas)
            } for v in validaciones]

        # Creación y envío del archivo Excel
        df = pd.DataFrame(datos_para_excel)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name=f'Reporte {request.formato.value}')
        output.seek(0)

        headers = {'Content-Disposition': f'attachment; filename="reporte_hhee_{request.formato.value}_{request.fecha_inicio}_a_{request.fecha_fin}.xlsx"'}
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        # Usamos rollback por seguridad, aunque esta función ya no escribe en la BD
        await db.rollback() 
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado al generar el reporte: {e}")

class MetricasRequest(BaseModel):
    fecha_inicio: date
    fecha_fin: date

@router.post("/metricas", response_model=DashboardHHEEMetricas, summary="Obtiene métricas clave del módulo HHEE")
async def get_hhee_metricas(
    request: MetricasRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    fecha_inicio = request.fecha_inicio
    fecha_fin = request.fecha_fin

    # --- 1. CONSULTA DE VALIDACIONES (CARGA MANUAL) ---
    base_query = select(models.ValidacionHHEE).filter(
        models.ValidacionHHEE.estado == 'Validado',
        models.ValidacionHHEE.fecha_hhee.between(fecha_inicio, fecha_fin)
    )

    if current_user.role == UserRole.SUPERVISOR_OPERACIONES:
        # Filtro personal para Ops: solo ven lo que ellos cargaron
        query = base_query.filter(models.ValidacionHHEE.supervisor_carga == current_user.email)
    else:
        # Global para Supervisores GTR y Responsables: ven todo
        query = base_query
    
    result = await db.execute(query)
    validaciones_periodo = result.scalars().all()

    # --- 2. CONSULTA DE SOLICITUDES (NUEVO FLUJO) ---
    solicitudes_pendientes = 0
    horas_aprobadas_sol = 0
    horas_rechazadas_sol = 0

    # Los Supervisores de Operaciones NO ven el control general de solicitudes
    if current_user.role != UserRole.SUPERVISOR_OPERACIONES:
        query_solicitudes = select(models.SolicitudHHEE).filter(
            models.SolicitudHHEE.fecha_hhee.between(fecha_inicio, fecha_fin)
        )
        result_sol = await db.execute(query_solicitudes)
        solicitudes_periodo = result_sol.scalars().all()

        for sol in solicitudes_periodo:
            if sol.estado == EstadoSolicitudHHEE.PENDIENTE:
                solicitudes_pendientes += 1
            elif sol.estado == EstadoSolicitudHHEE.APROBADA:
                horas_aprobadas_sol += (sol.horas_aprobadas or 0)
            elif sol.estado == EstadoSolicitudHHEE.RECHAZADA:
                horas_rechazadas_sol += (sol.horas_solicitadas or 0)

    # --- 3. CONSULTA A GEOVICTORIA (API ANTIGUA / SEGURA) ---
    ruts_unicos = {v.rut.replace('-', '').replace('.', '').upper() for v in validaciones_periodo if v.rut}
    datos_gv_lista = []
    
    if ruts_unicos:
        token = await geovictoria_service.obtener_token_geovictoria()
        if token:
            fecha_inicio_dt = datetime.combine(fecha_inicio, datetime.min.time())
            fecha_fin_dt = datetime.combine(fecha_fin, datetime.max.time())
            
            try:
                # Usamos SOLO la función antigua que sabemos que funciona
                datos_gv_lista = await geovictoria_service.obtener_datos_completos_periodo(
                    token, list(ruts_unicos), fecha_inicio_dt, fecha_fin_dt
                )
            except Exception as e:
                print(f"Error consultando GeoVictoria (API Antigua): {e}")
                # El flujo continúa, pero sin datos de GV (todo RRHH será 0)

    # Creamos un mapa para buscar rápidamente los datos por RUT y Fecha
    mapa_datos_gv = {(item['rut_limpio'], item['fecha']): item for item in datos_gv_lista}

    # --- 4. PROCESAMIENTO Y CÁLCULOS ---
    total_declaradas = 0
    total_rrhh = 0 # Acumulador global para el total de RRHH
    
    desglose_empleado = {}
    desglose_campana = {}

    for v in validaciones_periodo:
        rut_limpio = v.rut.replace('-', '').replace('.', '').upper() if v.rut else None
        fecha_str = v.fecha_hhee.strftime('%Y-%m-%d')
        
        # Obtenemos los datos de GeoVictoria para ese día específico
        gv_dia = mapa_datos_gv.get((rut_limpio, fecha_str), {})
        
        # Calculamos horas RRHH según el tipo específico validado
        horas_rrhh_dia = 0
        if v.tipo_hhee == 'Antes de Turno':
            horas_rrhh_dia = gv_dia.get('hhee_autorizadas_antes_gv', 0) or 0
        elif v.tipo_hhee == 'Después de Turno':
            horas_rrhh_dia = gv_dia.get('hhee_autorizadas_despues_gv', 0) or 0
        elif v.tipo_hhee == 'Día de Descanso':
            horas_rrhh_dia = (gv_dia.get('hhee_autorizadas_antes_gv', 0) or 0) + (gv_dia.get('hhee_autorizadas_despues_gv', 0) or 0)
        
        # --- ACUMULADORES GLOBALES ---
        total_declaradas += v.cantidad_hhee_aprobadas
        total_rrhh += horas_rrhh_dia

        # --- DESGLOSE POR EMPLEADO ---
        if v.rut not in desglose_empleado:
            desglose_empleado[v.rut] = {
                "nombre": v.nombre_apellido,
                "declaradas": 0, 
                "rrhh": 0
            }
        desglose_empleado[v.rut]["declaradas"] += v.cantidad_hhee_aprobadas
        desglose_empleado[v.rut]["rrhh"] += horas_rrhh_dia

        # --- DESGLOSE POR CAMPAÑA ---
        campana_nombre = v.campaña or "Sin Campaña"
        if campana_nombre not in desglose_campana:
            desglose_campana[campana_nombre] = {"declaradas": 0, "rrhh": 0}
        
        desglose_campana[campana_nombre]["declaradas"] += v.cantidad_hhee_aprobadas
        desglose_campana[campana_nombre]["rrhh"] += horas_rrhh_dia

    # --- 5. ORDENAMIENTO Y RESPUESTA ---
    desglose_por_empleado_lista = sorted(
        [
            MetricasPorEmpleado(
                nombre_empleado=val["nombre"],
                rut=rut,
                total_horas_declaradas=val["declaradas"],
                total_horas_rrhh=val["rrhh"]
            ) for rut, val in desglose_empleado.items()
        ],
        key=lambda x: x.total_horas_declaradas, reverse=True
    )
    
    desglose_por_campana_lista = sorted(
        [
            MetricasPorCampana(
                nombre_campana=campana, 
                total_horas_declaradas=val["declaradas"], 
                total_horas_rrhh=val["rrhh"]
            ) for campana, val in desglose_campana.items()
        ],
        key=lambda x: x.total_horas_declaradas, reverse=True
    )
    
    return DashboardHHEEMetricas(
        total_hhee_declaradas=total_declaradas,
        total_hhee_aprobadas_rrhh=total_rrhh,
        
        # Nuevas Métricas de Control
        total_solicitudes_pendientes=solicitudes_pendientes,
        total_horas_aprobadas_solicitud=horas_aprobadas_sol,
        total_horas_rechazadas_solicitud=horas_rechazadas_sol,
        
        empleado_top=None, # Ya no lo usamos en el frontend
        desglose_por_empleado=desglose_por_empleado_lista,
        desglose_por_campana=desglose_por_campana_lista
    )
    
@router.get("/metricas-pendientes", response_model=MetricasPendientesHHEE, summary="Obtener métricas de HHEE pendientes de validación")
async def get_hhee_metricas_pendientes(
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio del período a consultar"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin del período a consultar"),
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    """
    Calcula y devuelve un resumen de HHEE en estado 'Pendiente por Corrección',
    filtrado por un rango de fechas.
    OPTIMIZADO: Solo consulta la BD local, no llama a GeoVictoria.
    """

    # 1. Filtramos en la BD Local por estado y fecha
    base_query = select(models.ValidacionHHEE).filter(
        models.ValidacionHHEE.estado == 'Pendiente por Corrección'
    )

    if fecha_inicio and fecha_fin:
        base_query = base_query.filter(
            models.ValidacionHHEE.fecha_hhee.between(fecha_inicio, fecha_fin)
        )

    # 2. Filtro de Rol
    if current_user.role == UserRole.SUPERVISOR_OPERACIONES:
        query = base_query.filter(models.ValidacionHHEE.supervisor_carga == current_user.email)
    else:
        query = base_query # Global para GTR
    
    result = await db.execute(query)
    pendientes = result.scalars().all()

    # 3. Conteo en memoria (Rápido y sin API externa)
    total_pendientes = len(pendientes)
    cambio_turno_count = 0
    correccion_marcas_count = 0

    for p in pendientes:
        # Usamos el campo 'notas' que ya guardaste en la BD
        if p.notas == "Pendiente de cambio de turno":
            cambio_turno_count += 1
        elif p.notas == "Pendiente de corrección de marcas":
            correccion_marcas_count += 1
            
    return MetricasPendientesHHEE(
        total_pendientes=total_pendientes,
        por_cambio_turno=cambio_turno_count,
        por_correccion_marcas=correccion_marcas_count
    )

# ===================================================================
# === NENDPOINTS PARA EL FLUJO DE SOLICITUD DE HHEE ===
# ===================================================================

@router.post("/solicitudes/", response_model=SolicitudHHEE, status_code=status.HTTP_201_CREATED, summary="[Analista] Crear una nueva solicitud de HHEE")
async def crear_solicitud_hhee(
    solicitud_data: SolicitudHHEECreate,
    db: AsyncSession = Depends(get_db),
    # 👇 AQUÍ ESTÁ EL CAMBIO: Agregamos use_simple_auth=True
    current_user: models.Analista = Depends(require_role([UserRole.ANALISTA], use_simple_auth=True))
):
    """
    Permite a un analista crear una nueva solicitud de horas extras,
    validando que no exista una activa para la misma fecha y tipo.
    """
    
    # 1. Buscamos si ya existen solicitudes para el mismo analista, fecha y tipo.
    query_existente = select(models.SolicitudHHEE).filter(
        models.SolicitudHHEE.analista_id == current_user.id,
        models.SolicitudHHEE.fecha_hhee == solicitud_data.fecha_hhee,
        models.SolicitudHHEE.tipo == solicitud_data.tipo
    )
    result_existente = await db.execute(query_existente)
    solicitudes_existentes = result_existente.scalars().all()

    # 2. Revisamos las solicitudes existentes para ver si alguna está activa.
    if solicitudes_existentes:
        for sol in solicitudes_existentes:
            if sol.estado in [EstadoSolicitudHHEE.PENDIENTE, EstadoSolicitudHHEE.APROBADA]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, 
                    detail=f"Ya tienes una solicitud en estado '{sol.estado.value}' para esta fecha y tipo. No puedes crear otra."
                )

    # Si pasamos la validación, creamos la nueva solicitud
    nueva_solicitud = models.SolicitudHHEE(
        **solicitud_data.model_dump(),
        analista_id=current_user.id,
        estado=EstadoSolicitudHHEE.PENDIENTE
    )
    db.add(nueva_solicitud)
    await db.commit()
    await db.refresh(nueva_solicitud)
    
    # Recargamos para devolver el objeto completo con relaciones
    result = await db.execute(
        select(models.SolicitudHHEE)
        .options(selectinload(models.SolicitudHHEE.solicitante))
        .filter(models.SolicitudHHEE.id == nueva_solicitud.id)
    )
    return result.scalars().first()


@router.get("/solicitudes/mis-solicitudes/", summary="[Analista] Ver mi historial de solicitudes de HHEE")
async def obtener_mis_solicitudes(
    db: AsyncSession = Depends(get_db),
    # 👇 CAMBIO AQUÍ: Agregamos use_simple_auth=True
    current_user: models.Analista = Depends(require_role([UserRole.ANALISTA], use_simple_auth=True)),
    fecha_inicio: date = Query(..., description="Fecha de inicio del período a consultar"),
    fecha_fin: date = Query(..., description="Fecha de fin del período a consultar")
):
    """
    Devuelve el historial de solicitudes de HHEE para el analista actual.
    """
    # 1. Filtramos las solicitudes por analista y por rango de fecha (esto estaba bien)
    query = select(models.SolicitudHHEE).options(
        selectinload(models.SolicitudHHEE.solicitante),
        selectinload(models.SolicitudHHEE.supervisor)
    ).filter(
        models.SolicitudHHEE.analista_id == current_user.id,
        models.SolicitudHHEE.fecha_hhee.between(fecha_inicio, fecha_fin)
    ).order_by(models.SolicitudHHEE.fecha_solicitud.desc())
    
    result = await db.execute(query)
    solicitudes = result.scalars().all()

    if not solicitudes:
        return []

    # --- INICIO DE LA LÓGICA CORREGIDA (añadida) ---
    # 2. Hacemos una única llamada a GeoVictoria para el rango de fechas solicitado
    rut_analista = getattr(current_user, 'rut', None)
    datos_gv_lista = []
    if rut_analista:
        rut_limpio = rut_analista.replace('-', '').replace('.', '').upper()
        fecha_inicio_dt = datetime.combine(fecha_inicio, datetime.min.time())
        fecha_fin_dt = datetime.combine(fecha_fin, datetime.max.time())
        
        token = await geovictoria_service.obtener_token_geovictoria()
        if token:
            datos_gv_lista = await geovictoria_service.obtener_datos_completos_periodo(
                token, [rut_limpio], fecha_inicio_dt, fecha_fin_dt
            )

    # Creamos un mapa para buscar los datos de GV fácilmente
    mapa_datos_gv = {item['fecha']: item for item in datos_gv_lista}

    # 3. Unimos los datos de las solicitudes con los de GeoVictoria
    respuesta_enriquecida = []
    for sol in solicitudes:
        fecha_str_solicitud = sol.fecha_hhee.strftime('%Y-%m-%d')
        datos_gv_del_dia = mapa_datos_gv.get(fecha_str_solicitud, {})
        
        solicitud_dict = SolicitudHHEE.model_validate(sol).model_dump()
        solicitud_dict['datos_geovictoria'] = datos_gv_del_dia
        respuesta_enriquecida.append(solicitud_dict)

    return respuesta_enriquecida
    # --- FIN DE LA LÓGICA CORREGIDA ---


@router.get("/solicitudes/pendientes/", summary="[Supervisor] Ver solicitudes pendientes por rango de fecha con datos de GV")
async def obtener_solicitudes_pendientes(
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True)),
    fecha_inicio: date = Query(..., description="Fecha de inicio del período a consultar"),
    fecha_fin: date = Query(..., description="Fecha de fin del período a consultar")
):
    """
    Devuelve una lista de solicitudes PENDIENTES dentro de un rango de fechas,
    enriquecidas con los datos de marcación de GeoVictoria.
    """
    query = select(models.SolicitudHHEE).options(
        selectinload(models.SolicitudHHEE.solicitante)
    ).filter(
        models.SolicitudHHEE.estado == EstadoSolicitudHHEE.PENDIENTE,
        models.SolicitudHHEE.fecha_hhee.between(fecha_inicio, fecha_fin)
    ).order_by(models.SolicitudHHEE.analista_id, models.SolicitudHHEE.fecha_hhee)

    result = await db.execute(query)
    solicitudes = result.scalars().all()

    if not solicitudes:
        return []

    ruts_unicos = {sol.solicitante.rut.replace('-', '').replace('.', '').upper() for sol in solicitudes if hasattr(sol.solicitante, 'rut') and sol.solicitante.rut}
    
    fecha_inicio_dt = datetime.combine(fecha_inicio, datetime.min.time())
    fecha_fin_dt = datetime.combine(fecha_fin, datetime.max.time())
    
    datos_gv_lista = []
    if ruts_unicos:
        token = await geovictoria_service.obtener_token_geovictoria()
        if token:
            datos_gv_lista = await geovictoria_service.obtener_datos_completos_periodo(
                token, list(ruts_unicos), fecha_inicio_dt, fecha_fin_dt
            )
    
    # --- INICIO DE LA CORRECCIÓN CLAVE ---
    # Procesamos los datos de GeoVictoria para añadir nuestro cálculo
    datos_gv_procesados = []
    for dia in datos_gv_lista:
        logica = geovictoria_service.aplicar_logica_de_negocio(dia)
        datos_gv_procesados.append({**dia, **logica})
    
    # Creamos el mapa con los datos ya procesados
    mapa_datos_gv = {
        (item['rut_limpio'], item['fecha']): item for item in datos_gv_procesados
    }
    # --- FIN DE LA CORRECCIÓN CLAVE ---
    
    respuesta_enriquecida = []
    for sol in solicitudes:
        rut_limpio_solicitud = sol.solicitante.rut.replace('-', '').replace('.', '').upper() if hasattr(sol.solicitante, 'rut') and sol.solicitante.rut else None
        fecha_str_solicitud = sol.fecha_hhee.strftime('%Y-%m-%d')
        
        datos_gv_del_dia = mapa_datos_gv.get((rut_limpio_solicitud, fecha_str_solicitud), {})
        
        solicitud_dict = SolicitudHHEE.model_validate(sol).model_dump()
        solicitud_dict['datos_geovictoria'] = datos_gv_del_dia
        respuesta_enriquecida.append(solicitud_dict)

    return respuesta_enriquecida


@router.post("/solicitudes/{solicitud_id}/procesar/", response_model=SolicitudHHEE, summary="[Supervisor] Aprobar o Rechazar una solicitud")
async def procesar_solicitud(
    solicitud_id: int,
    decision: SolicitudHHEEDecision,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    """
    Permite a un supervisor aprobar (y ajustar) o rechazar una solicitud.
    Si se aprueba, crea una entrada en la tabla `ValidacionHHEE` para que fluya a los reportes.
    """
    result = await db.execute(
        select(models.SolicitudHHEE)
        .options(
            selectinload(models.SolicitudHHEE.solicitante)
            .selectinload(models.Analista.campanas_asignadas) 
        )
        .filter(models.SolicitudHHEE.id == solicitud_id)
    )
    solicitud = result.scalars().first()

    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if solicitud.estado != EstadoSolicitudHHEE.PENDIENTE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta solicitud ya ha sido procesada.")

    # Actualizamos la solicitud con la decisión
    solicitud.estado = decision.estado
    solicitud.supervisor_id = current_user.id
    solicitud.fecha_decision = datetime.utcnow()
    solicitud.comentario_supervisor = decision.comentario_supervisor
    solicitud.horas_aprobadas = decision.horas_aprobadas

    # --- LÓGICA CLAVE DE INTEGRACIÓN ---
    # Si la solicitud es APROBADA y tiene horas, la insertamos en la tabla de validaciones
    # para que sea considerada en los reportes de RRHH y Operaciones.
    if solicitud.estado == EstadoSolicitudHHEE.APROBADA and solicitud.horas_aprobadas > 0:
        
        # Mapeamos el tipo de solicitud al tipo de validación existente
        tipo_validacion_map = {
            TipoSolicitudHHEE.ANTES_TURNO: "Antes de Turno",
            TipoSolicitudHHEE.DESPUES_TURNO: "Después de Turno",
            TipoSolicitudHHEE.DIA_DESCANSO: "Día de Descanso",
        }
        tipo_hhee_validacion = tipo_validacion_map.get(solicitud.tipo)

        if tipo_hhee_validacion:
            # Necesitamos el RUT y nombre del solicitante
            rut_formateado = formatear_rut(solicitud.solicitante.rut) if hasattr(solicitud.solicitante, 'rut') else ""
            nombre_completo = f"{solicitud.solicitante.nombre} {solicitud.solicitante.apellido}"

            nueva_validacion = models.ValidacionHHEE(
                rut=rut_formateado,
                nombre_apellido=nombre_completo,
                campaña=solicitud.solicitante.campanas_asignadas[0].nombre if solicitud.solicitante.campanas_asignadas else "General",
                fecha_hhee=solicitud.fecha_hhee,
                tipo_hhee=tipo_hhee_validacion,
                cantidad_hhee_aprobadas=solicitud.horas_aprobadas,
                estado="Validado",
                supervisor_carga=current_user.email,
                notas=f"Aprobado desde solicitud #{solicitud.id}"
            )
            db.add(nueva_validacion)

    await db.commit()
    await db.refresh(solicitud)
    return solicitud

@router.get("/solicitudes/{solicitud_id}/detalle-validacion/", summary="[Supervisor] Obtener detalle de una solicitud + datos de GeoVictoria")
async def obtener_detalle_solicitud_para_validacion(
    solicitud_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    """
    Obtiene los datos de una solicitud específica y los enriquece
    con la información de marcación de GeoVictoria para ese día y analista.
    """
    # 1. Obtenemos la solicitud de nuestra base de datos
    result = await db.execute(
        select(models.SolicitudHHEE)
        .options(selectinload(models.SolicitudHHEE.solicitante))
        .filter(models.SolicitudHHEE.id == solicitud_id)
    )
    solicitud = result.scalars().first()
    if not solicitud:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    # 2. Obtenemos el RUT y la fecha para consultar el servicio externo
    rut_analista = getattr(solicitud.solicitante, 'rut', None)
    if not rut_analista:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El analista solicitante no tiene un RUT configurado.")
    
    rut_limpio = rut_analista.replace('-', '').replace('.', '').upper()
    fecha_dt = datetime.combine(solicitud.fecha_hhee, datetime.min.time())

    # 3. Consultamos a GeoVictoria
    token = await geovictoria_service.obtener_token_geovictoria()
    if not token:
        raise HTTPException(status_code=503, detail="No se pudo comunicar con GeoVictoria.")
    
    datos_gv = await geovictoria_service.obtener_datos_completos_periodo(token, [rut_limpio], fecha_dt, fecha_dt)
    
    # 4. Procesamos los datos and devolvemos todo junto
    datos_dia_gv = {}
    if datos_gv:
        logica_negocio = geovictoria_service.aplicar_logica_de_negocio(datos_gv[0])
        datos_dia_gv = {**datos_gv[0], **logica_negocio}

    return {
        "solicitud": SolicitudHHEE.model_validate(solicitud).model_dump(),
        "datos_geovictoria": datos_dia_gv
    }
    

@router.post("/solicitudes/procesar-lote/", status_code=status.HTTP_200_OK, summary="[Supervisor] Procesar un lote de solicitudes de HHEE")
async def procesar_solicitudes_lote(
    lote_data: SolicitudHHEELote,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    solicitud_ids = [d.solicitud_id for d in lote_data.decisiones]
    if not solicitud_ids:
        return {"detail": "No se proporcionaron decisiones para procesar."}

    try:
        # 1. Obtenemos todas las solicitudes para tener los datos originales
        query = select(models.SolicitudHHEE).options(
            selectinload(models.SolicitudHHEE.solicitante)
            .selectinload(models.Analista.campanas_asignadas)
        ).filter(models.SolicitudHHEE.id.in_(solicitud_ids))
        
        result = await db.execute(query)
        solicitudes_a_procesar = result.scalars().all()
        solicitudes_map = {s.id: s for s in solicitudes_a_procesar}

        # 2. Obtenemos los datos de GeoVictoria para estas solicitudes para verificar los máximos
        ruts_unicos = {s.solicitante.rut.replace('-', '').replace('.', '').upper() for s in solicitudes_a_procesar if hasattr(s.solicitante, 'rut') and s.solicitante.rut}
        if ruts_unicos:
            fecha_min = min(s.fecha_hhee for s in solicitudes_a_procesar)
            fecha_max = max(s.fecha_hhee for s in solicitudes_a_procesar)
            fecha_inicio_dt = datetime.combine(fecha_min, datetime.min.time())
            fecha_fin_dt = datetime.combine(fecha_max, datetime.max.time())
            token = await geovictoria_service.obtener_token_geovictoria()
            datos_gv_lista = await geovictoria_service.obtener_datos_completos_periodo(token, list(ruts_unicos), fecha_inicio_dt, fecha_fin_dt) if token else []
            
            datos_gv_procesados = [{**dia, **geovictoria_service.aplicar_logica_de_negocio(dia)} for dia in datos_gv_lista]
            mapa_datos_gv = {(item['rut_limpio'], item['fecha']): item for item in datos_gv_procesados}
        else:
            mapa_datos_gv = {}

        # 3. Iteramos sobre las decisiones y VALIDAMOS antes de guardar
        for decision in lote_data.decisiones:
            solicitud = solicitudes_map.get(decision.solicitud_id)
            if not solicitud or solicitud.estado != EstadoSolicitudHHEE.PENDIENTE:
                continue

            # Validamos que las horas aprobadas no excedan el máximo calculado desde GeoVictoria
            rut_limpio = solicitud.solicitante.rut.replace('-', '').replace('.', '').upper() if hasattr(solicitud.solicitante, 'rut') and solicitud.solicitante.rut else None
            fecha_str = solicitud.fecha_hhee.strftime('%Y-%m-%d')
            gv_data = mapa_datos_gv.get((rut_limpio, fecha_str), {})
            
            max_calculado = 0
            if solicitud.tipo == TipoSolicitudHHEE.ANTES_TURNO:
                max_calculado = gv_data.get('hhee_inicio_calculadas', 0)
            elif solicitud.tipo == TipoSolicitudHHEE.DESPUES_TURNO:
                max_calculado = gv_data.get('hhee_fin_calculadas', 0)
            else: # DIA_DESCANSO
                max_calculado = gv_data.get('cantidad_hhee_calculadas', 0)

            if decision.horas_aprobadas > max_calculado:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Para la solicitud #{solicitud.id}, no se pueden aprobar {decision.horas_aprobadas} horas. El máximo calculado es {max_calculado:.2f}."
                )
           

            # Actualizamos la solicitud con los datos de la decisión
            solicitud.estado = decision.estado
            solicitud.horas_aprobadas = decision.horas_aprobadas
            solicitud.comentario_supervisor = decision.comentario_supervisor
            solicitud.supervisor_id = current_user.id
            solicitud.fecha_decision = datetime.utcnow()

            # Si se aprueba, creamos la entrada en la tabla de validaciones
            if solicitud.estado == EstadoSolicitudHHEE.APROBADA and solicitud.horas_aprobadas > 0:
                tipo_validacion_map = {
                    TipoSolicitudHHEE.ANTES_TURNO: "Antes de Turno",
                    TipoSolicitudHHEE.DESPUES_TURNO: "Después de Turno",
                    TipoSolicitudHHEE.DIA_DESCANSO: "Día de Descanso",
                }
                tipo_hhee_validacion = tipo_validacion_map.get(solicitud.tipo)
                
                if tipo_hhee_validacion:
                    nueva_validacion = models.ValidacionHHEE(
                        rut=formatear_rut(solicitud.solicitante.rut) if hasattr(solicitud.solicitante, 'rut') else "",
                        nombre_apellido=f"{solicitud.solicitante.nombre} {solicitud.solicitante.apellido}",
                        campaña=solicitud.solicitante.campanas_asignadas[0].nombre if solicitud.solicitante.campanas_asignadas else "General",
                        fecha_hhee=solicitud.fecha_hhee,
                        tipo_hhee=tipo_hhee_validacion,
                        cantidad_hhee_aprobadas=solicitud.horas_aprobadas,
                        estado="Validado",
                        supervisor_carga=current_user.email,
                        notas=f"Aprobado desde solicitud #{solicitud.id}. Comentario: {decision.comentario_supervisor or ''}".strip()
                    )
                    db.add(nueva_validacion)

        await db.commit()

    except Exception as e:
        await db.rollback()
        # Si el error ya es una HTTPException, lo relanzamos. Si no, lo envolvemos.
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ocurrió un error al procesar el lote: {e}")

    return {"detail": f"{len(lote_data.decisiones)} decisiones procesadas con éxito."}


@router.get("/solicitudes/historial/", summary="[Supervisor] Ver historial de solicitudes procesadas")
async def obtener_historial_solicitudes(
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True)),
    fecha_inicio: date = Query(..., description="Fecha de inicio del período a consultar"),
    fecha_fin: date = Query(..., description="Fecha de fin del período a consultar")
):
    """
    Devuelve un historial de solicitudes de HHEE que ya han sido APROBADAS o RECHAZADAS
    dentro de un rango de fechas, enriquecido con datos de GeoVictoria.
    """
    # 1. Buscamos solicitudes que NO estén pendientes en el rango de fechas
    query = select(models.SolicitudHHEE).options(
        selectinload(models.SolicitudHHEE.solicitante),
        selectinload(models.SolicitudHHEE.supervisor) # Incluimos quién tomó la decisión
    ).filter(
        models.SolicitudHHEE.estado.in_([EstadoSolicitudHHEE.APROBADA, EstadoSolicitudHHEE.RECHAZADA]),
        models.SolicitudHHEE.fecha_hhee.between(fecha_inicio, fecha_fin)
    ).order_by(models.SolicitudHHEE.fecha_decision.desc())

    result = await db.execute(query)
    solicitudes = result.scalars().all()

    if not solicitudes:
        return []

    # 2. La lógica para enriquecer con datos de GeoVictoria es la misma que ya usamos
    ruts_unicos = {sol.solicitante.rut.replace('-', '').replace('.', '').upper() for sol in solicitudes if hasattr(sol.solicitante, 'rut') and sol.solicitante.rut}
    
    fecha_inicio_dt = datetime.combine(fecha_inicio, datetime.min.time())
    fecha_fin_dt = datetime.combine(fecha_fin, datetime.max.time())
    
    datos_gv_lista = []
    if ruts_unicos:
        token = await geovictoria_service.obtener_token_geovictoria()
        if token:
            datos_gv_lista = await geovictoria_service.obtener_datos_completos_periodo(
                token, list(ruts_unicos), fecha_inicio_dt, fecha_fin_dt
            )

    datos_gv_procesados = [{**dia, **geovictoria_service.aplicar_logica_de_negocio(dia)} for dia in datos_gv_lista]
    mapa_datos_gv = {(item['rut_limpio'], item['fecha']): item for item in datos_gv_procesados}
    
    # 3. Unimos los datos para la respuesta
    respuesta_enriquecida = []
    for sol in solicitudes:
        rut_limpio_solicitud = sol.solicitante.rut.replace('-', '').replace('.', '').upper() if hasattr(sol.solicitante, 'rut') and sol.solicitante.rut else None
        fecha_str_solicitud = sol.fecha_hhee.strftime('%Y-%m-%d')
        datos_gv_del_dia = mapa_datos_gv.get((rut_limpio_solicitud, fecha_str_solicitud), {})
        
        solicitud_dict = SolicitudHHEE.model_validate(sol).model_dump()
        solicitud_dict['datos_geovictoria'] = datos_gv_del_dia
        respuesta_enriquecida.append(solicitud_dict)

    return respuesta_enriquecida


@router.post("/exportar-y-marcar-rrhh", summary="[GTR] Exporta para RRHH y marca registros como enviados")
async def exportar_y_marcar_rrhh(
    request: ExportRequest, # Reutilizamos el mismo modelo de solicitud
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    """
    Genera el reporte para RRHH (formato ADP), marca los registros
    como 'reportado_a_rrhh = true' y guarda quién y cuándo lo hizo.
    Esta es una acción final y solo para roles GTR.
    """
    try:
        # 1. Buscamos los registros que cumplen las condiciones (igual que antes)
        query = select(models.ValidacionHHEE).filter(
            models.ValidacionHHEE.estado == 'Validado',
            models.ValidacionHHEE.fecha_hhee.between(request.fecha_inicio, request.fecha_fin),
            models.ValidacionHHEE.reportado_a_rrhh == False
        ).order_by(models.ValidacionHHEE.rut, models.ValidacionHHEE.fecha_hhee)
        
        result = await db.execute(query)
        validaciones = result.scalars().all()

        if not validaciones:
            raise HTTPException(status_code=404, detail="No se encontraron HHEE nuevas para reportar a RRHH en el período seleccionado.")

        # 2. Generamos los datos para el Excel (lógica sin cambios)
        permiso_map = {"Antes de Turno": 10, "Después de Turno": 5, "Día de Descanso": 10}
        datos_para_excel = [{
            "Cod Funcionario": v.rut, "Nombre": v.nombre_apellido,
            "Num Permiso": permiso_map.get(v.tipo_hhee, ''),
            "Fecha Inicio": v.fecha_hhee.strftime('%d/%m/%Y'),
            "Fecha Fin": v.fecha_hhee.strftime('%d/%m/%Y'),
            "Cant Horas": decimal_to_hhmm(v.cantidad_hhee_aprobadas)
        } for v in validaciones]

        df = pd.DataFrame(datos_para_excel)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Reporte RRHH')
        output.seek(0)
        
        # 3. Actualizamos la bandera y los nuevos campos en la base de datos
        ids_a_actualizar = [v.id for v in validaciones]
        if ids_a_actualizar:
            update_stmt = update(models.ValidacionHHEE).where(
                models.ValidacionHHEE.id.in_(ids_a_actualizar)
            ).values(
                reportado_a_rrhh=True,
                reportado_por_id=current_user.id,
                fecha_reportado=func.now() # La base de datos pone la hora actual
            )
            await db.execute(update_stmt)
            await db.commit()

        # 4. Devolvemos el archivo Excel al usuario
        headers = {'Content-Disposition': f'attachment; filename="REPORTE_FINAL_RRHH_{request.fecha_inicio}_a_{request.fecha_fin}.xlsx"'}
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado: {e}")
    
class ConfirmacionEnvio(BaseModel):
    fecha_inicio: date
    fecha_fin: date

@router.post("/marcar-como-reportado", status_code=status.HTTP_200_OK, summary="[GTR] Marca una lista de HHEE por ID como reportadas a RRHH")
async def marcar_rrhh_como_reportado(
    confirmacion: ConfirmacionPorIDs, # <-- Usamos el nuevo modelo
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    """
    Marca una lista específica de registros (por ID) como 'reportado_a_rrhh = true'.
    """
    if not confirmacion.ids_a_marcar:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se proporcionaron IDs para marcar.")

    try:
        update_stmt = update(models.ValidacionHHEE).where(
            models.ValidacionHHEE.id.in_(confirmacion.ids_a_marcar) # <-- Actualizamos por ID
        ).values(
            reportado_a_rrhh=True,
            reportado_por_id=current_user.id,
            fecha_reportado=func.now()
        )
        result = await db.execute(update_stmt)
        await db.commit()
        
        return {"detail": f"{result.rowcount} registros han sido marcados como enviados a RRHH."}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ocurrió un error al marcar los registros: {e}")

@router.get("/ids-pendientes-rrhh", response_model=List[int], summary="[GTR] Obtiene los IDs de HHEE pendientes para RRHH en un rango")
async def obtener_ids_pendientes_rrhh(
    fecha_inicio: date = Query(...),
    fecha_fin: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES], use_simple_auth=True))
):
    """
    Devuelve una lista de IDs de validaciones que están pendientes de ser reportadas a RRHH
    dentro de un rango de fechas específico.
    """
    query = select(models.ValidacionHHEE.id).filter(
        models.ValidacionHHEE.estado == 'Validado',
        models.ValidacionHHEE.fecha_hhee.between(fecha_inicio, fecha_fin),
        models.ValidacionHHEE.reportado_a_rrhh == False
    )
    result = await db.execute(query)
    return result.scalars().all()
