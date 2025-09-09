# /backend/routers/hhee_router.py

from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from services import geovictoria_service
from datetime import datetime, date
from typing import List, Optional

from database import get_db
from dependencies import get_current_analista
from sql_app import models
from pydantic import BaseModel

from dependencies import require_role
from enums import UserRole, TipoSolicitudHHEE, EstadoSolicitudHHEE
from enum import Enum

from schemas.models import DashboardHHEEMetricas, MetricasPorEmpleado, MetricasPorCampana, MetricasPendientesHHEE, SolicitudHHEECreate, SolicitudHHEE, SolicitudHHEEDecision, SolicitudHHEELote

from utils import decimal_to_hhmm, formatear_rut

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

router = APIRouter(
    tags=["Portal HHEE"]
)

@router.post("/consultar-empleado")
async def consultar_empleado(
    consulta: ConsultaHHEE,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
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
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
):
    mensajes_respuesta = []

    for validacion in request_body.validaciones:
        rut_formateado = formatear_rut(validacion.rut_con_formato)
        query_existentes = select(models.ValidacionHHEE).filter_by(
        rut=rut_formateado,
        fecha_hhee=validacion.fecha
        )
        result_existentes = await db.execute(query_existentes)
        registros_existentes = result_existentes.scalars().all()

        pendiente_record = next((r for r in registros_existentes if r.estado == 'Pendiente por Corrección'), None)

        # --- NUEVA LÓGICA PARA CANCELAR UN PENDIENTE ---
        hhee_aprobadas_total = validacion.hhee_aprobadas_inicio + validacion.hhee_aprobadas_fin + validacion.hhee_aprobadas_descanso
        if not validacion.turno_es_incorrecto and hhee_aprobadas_total == 0 and pendiente_record:
            await db.delete(pendiente_record)
            mensajes_respuesta.append(f"Día {validacion.fecha}: se canceló el estado 'Pendiente'.")
            continue # Pasamos al siguiente día
        # --- FIN DE LA NUEVA LÓGICA ---

        if validacion.turno_es_incorrecto:
            # ... (la lógica para marcar como pendiente se queda igual) ...
            for registro in registros_existentes:
                await db.delete(registro)
            datos_para_bd = {
                "rut": rut_formateado,
                "nombre_apellido": bleach.clean(validacion.nombre_apellido), # Limpiamos
                "campaña": bleach.clean(validacion.campaña) if validacion.campaña else None, # Limpiamos
                "fecha_hhee": validacion.fecha,
                "estado": "Pendiente por Corrección",
                "notas": bleach.clean(validacion.nota) if validacion.nota else None, # Limpiamos la nota
                "supervisor_carga": current_user.email,
                "tipo_hhee": "General"
            }
            db.add(models.ValidacionHHEE(**datos_para_bd))
            mensajes_respuesta.append(f"Día {validacion.fecha}: marcado como 'Pendiente'.")
            continue

        # ... (el resto de la lógica de guardado se queda igual que antes) ...
        base_datos_bd = {
        "rut": rut_formateado,
        "nombre_apellido": bleach.clean(validacion.nombre_apellido), # Limpiamos
        "campaña": bleach.clean(validacion.campaña) if validacion.campaña else None, # Limpiamos
        "fecha_hhee": validacion.fecha,
        "supervisor_carga": current_user.email,
        "estado": "Validado",
        "notas": None # En este caso las notas siempre son nulas, no hace falta limpiar
    }
        hhee_a_procesar = {
            "Antes de Turno": validacion.hhee_aprobadas_inicio,
            "Después de Turno": validacion.hhee_aprobadas_fin,
            "Día de Descanso": validacion.hhee_aprobadas_descanso
        }
        pendiente_reutilizado = False
        for tipo, aprobadas in hhee_a_procesar.items():
            if aprobadas > 0:
                datos_completos = {**base_datos_bd, "tipo_hhee": tipo, "cantidad_hhee_aprobadas": aprobadas}
                if pendiente_record and not pendiente_reutilizado:
                    for key, value in datos_completos.items():
                        setattr(pendiente_record, key, value)
                    mensajes_respuesta.append(f"Día {validacion.fecha} ({tipo}): re-validado.")
                    pendiente_reutilizado = True
                else:
                    # ... (lógica de crear nuevo registro) ...
                    db.add(models.ValidacionHHEE(**datos_completos))
                    mensajes_respuesta.append(f"Día {validacion.fecha} ({tipo}): guardado.")

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar en la base de datos: {e}")

    mensaje_final = " | ".join(mensajes_respuesta) if mensajes_respuesta else "No se realizaron cambios."
    return {"mensaje": f"Proceso finalizado. Resumen: {mensaje_final}"}



@router.get("/pendientes", summary="Consulta todos los registros pendientes de HHEE")
async def consultar_pendientes(
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
):
    query = select(models.ValidacionHHEE).filter(
        models.ValidacionHHEE.estado == 'Pendiente por Corrección',
        models.ValidacionHHEE.supervisor_carga == current_user.email
    ).order_by(models.ValidacionHHEE.nombre_apellido.asc(), models.ValidacionHHEE.fecha_hhee.asc())
    
    result = await db.execute(query)
    pendientes = result.scalars().all()

    if not pendientes:
        return {"datos_periodo": [], "nombre_agente": "Múltiples Agentes con Pendientes"}

    ruts_limpios_unicos = list({p.rut.strip().replace('-', '').replace('.', '').upper() for p in pendientes})
    fecha_min = min(p.fecha_hhee for p in pendientes)
    fecha_max = max(p.fecha_hhee for p in pendientes)
    fecha_inicio_dt = datetime.combine(fecha_min, datetime.min.time())
    fecha_fin_dt = datetime.combine(fecha_max, datetime.max.time())

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

    resultados_enriquecidos = []
    for p in pendientes:
        rut_limpio = p.rut.strip().replace('-', '').replace('.', '').upper()
        fecha_str = p.fecha_hhee.strftime('%Y-%m-%d')
        datos_dia_gv = lookup_data.get((rut_limpio, fecha_str), {})
        
        logica_negocio = geovictoria_service.aplicar_logica_de_negocio(datos_dia_gv)
        
        datos_dia_completo = {
            **datos_dia_gv, **logica_negocio,
            "nombre_apellido": p.nombre_apellido, "rut_con_formato": p.rut,
            "fecha": fecha_str, "estado_final": 'Pendiente por Corrección',
            "notas": p.notas, "hhee_aprobadas_inicio": 0,
            "hhee_aprobadas_fin": 0, "hhee_aprobadas_descanso": 0,
        }
        
        resultados_enriquecidos.append(datos_dia_completo)

    return {
        "datos_periodo": resultados_enriquecidos,
        "nombre_agente": "Múltiples Agentes con Pendientes"
    }


@router.post("/exportar", summary="Exporta validaciones de HHEE a un archivo Excel")
async def exportar_hhee_a_excel(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
):
    try:
        base_query = select(models.ValidacionHHEE).filter(
            models.ValidacionHHEE.estado == 'Validado',
            models.ValidacionHHEE.fecha_hhee.between(request.fecha_inicio, request.fecha_fin)
        )

        if current_user.role == UserRole.SUPERVISOR_OPERACIONES:
            query = base_query.filter(models.ValidacionHHEE.supervisor_carga == current_user.email)
        else:
            query = base_query

        query = query.order_by(models.ValidacionHHEE.rut, models.ValidacionHHEE.fecha_hhee)
        
        result = await db.execute(query)
        validaciones = result.scalars().all()

        if not validaciones:
            raise HTTPException(status_code=404, detail="No se encontraron HHEE validadas para los filtros seleccionados.")

        if request.formato == ExportFormat.RRHH:
            # ... (Esta parte no cambia)
            permiso_map = {"Antes de Turno": 10, "Después de Turno": 5, "Día de Descanso": 10}
            datos_para_excel = [{
                "Cod Funcionario": v.rut, "Nombre": v.nombre_apellido,
                "Num Permiso": permiso_map.get(v.tipo_hhee, ''),
                "Fecha Inicio": v.fecha_hhee.strftime('%d/%m/%Y'),
                "Fecha Fin": v.fecha_hhee.strftime('%d/%m/%Y'),
                "Cant Horas": decimal_to_hhmm(v.cantidad_hhee_aprobadas)
            } for v in validaciones]
        
        elif request.formato == ExportFormat.OPERACIONES:
            ruts_unicos = list({v.rut.replace('.', '').replace('-', '') for v in validaciones})
            token_gv = await geovictoria_service.obtener_token_geovictoria()
            if not token_gv: raise HTTPException(status_code=503, detail="No se pudo conectar con GeoVictoria.")

            fecha_inicio_dt = datetime.combine(request.fecha_inicio, datetime.min.time())
            fecha_fin_dt = datetime.combine(request.fecha_fin, datetime.max.time())
            datos_gv = await geovictoria_service.obtener_datos_completos_periodo(token_gv, ruts_unicos, fecha_inicio_dt, fecha_fin_dt)
            
            # --- INICIO DE LA CORRECCIÓN CLAVE ---
            # 1. El diccionario ahora guarda las horas de 'antes' y 'después' por separado
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
                
                # 2. Asignamos la hora correcta según el tipo de HHEE de la fila
                horas_rrhh_especificas = 0
                if v.tipo_hhee == "Antes de Turno":
                    horas_rrhh_especificas = horas_rrhh_dict.get("antes", 0)
                elif v.tipo_hhee == "Después de Turno":
                    horas_rrhh_especificas = horas_rrhh_dict.get("despues", 0)
                elif v.tipo_hhee == "Día de Descanso":
                    # Para descanso, sí sumamos ambas
                    horas_rrhh_especificas = horas_rrhh_dict.get("antes", 0) + horas_rrhh_dict.get("despues", 0)

                datos_para_excel.append({
                    "ID": v.id,
                    "RUT": v.rut,
                    "Nombre Completo": v.nombre_apellido,
                    "Campaña": v.campaña,
                    "Fecha HHEE": v.fecha_hhee.strftime('%d-%m-%Y'),
                    "Tipo HHEE": v.tipo_hhee,
                    "Horas Aprobadas (Operaciones)": decimal_to_hhmm(v.cantidad_hhee_aprobadas),
                    "Horas Aprobadas (RRHH)": decimal_to_hhmm(horas_rrhh_especificas), # Usamos el valor específico
                    "Estado": v.estado,
                    "Validado Por": v.supervisor_carga,
                    "Fecha de Carga": v.fecha_carga.strftime('%d-%m-%Y %H:%M') if v.fecha_carga else None
                })
            # --- FIN DE LA CORRECCIÓN CLAVE ---

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
        raise HTTPException(status_code=500, detail=f"Ocurrió un error inesperado: {e}")
    

@router.post("/metricas", response_model=DashboardHHEEMetricas, summary="Obtener métricas para el dashboard de HHEE")
async def get_hhee_metricas(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
):
    base_query = select(models.ValidacionHHEE).filter(
        models.ValidacionHHEE.estado == 'Validado',
        models.ValidacionHHEE.fecha_hhee.between(request.fecha_inicio, request.fecha_fin)
    )
    if current_user.role == UserRole.SUPERVISOR_OPERACIONES:
        query = base_query.filter(models.ValidacionHHEE.supervisor_carga == current_user.email)
    else:
        query = base_query
    
    result = await db.execute(query)
    validaciones = result.scalars().all()

    # --- INICIO DE LA LÓGICA MEJORADA ---
    # Si no hay datos, devolvemos un objeto vacío
    if not validaciones:
        return DashboardHHEEMetricas(total_hhee_declaradas=0.0, total_hhee_aprobadas_rrhh=0.0, empleado_top=None, desglose_por_empleado=[], desglose_por_campana=[])

    # Consultamos a GeoVictoria para obtener los datos de RRHH
    ruts_unicos = list({v.rut.replace('.', '').replace('-', '') for v in validaciones})
    token_gv = await geovictoria_service.obtener_token_geovictoria()
    if not token_gv: raise HTTPException(status_code=503, detail="No se pudo conectar con GeoVictoria.")
    
    fecha_inicio_dt = datetime.combine(request.fecha_inicio, datetime.min.time())
    fecha_fin_dt = datetime.combine(request.fecha_fin, datetime.max.time())
    datos_gv = await geovictoria_service.obtener_datos_completos_periodo(token_gv, ruts_unicos, fecha_inicio_dt, fecha_fin_dt)
    
    rrhh_lookup = {}
    for dia in datos_gv:
        key = (dia['rut_limpio'], dia['fecha'])
        rrhh_lookup[key] = (dia.get('hhee_autorizadas_antes_gv', 0) or 0) + (dia.get('hhee_autorizadas_despues_gv', 0) or 0)
    
    # 1. Calcular totales
    total_declaradas = sum(v.cantidad_hhee_aprobadas for v in validaciones)
    total_rrhh = sum(rrhh_lookup.values())

    # 2. Desglose por empleado
    desglose_empleado = {}
    for v in validaciones:
        rut_limpio = v.rut.replace('.', '').replace('-', '')
        fecha_str = v.fecha_hhee.strftime('%Y-%m-%d')
        horas_rrhh_dia = rrhh_lookup.get((rut_limpio, fecha_str), 0)

        if v.rut not in desglose_empleado:
            desglose_empleado[v.rut] = {"nombre": v.nombre_apellido, "declaradas": 0.0, "rrhh": 0.0}
        
        desglose_empleado[v.rut]["declaradas"] += v.cantidad_hhee_aprobadas
        desglose_empleado[v.rut]["rrhh"] += horas_rrhh_dia
    
    lista_empleados = [
        MetricasPorEmpleado(rut=rut, nombre_empleado=data["nombre"], total_horas_declaradas=data["declaradas"], total_horas_rrhh=data["rrhh"])
        for rut, data in desglose_empleado.items()
    ]
    lista_empleados.sort(key=lambda x: x.total_horas_declaradas, reverse=True)

    # 3. Desglose por campaña
    desglose_campana = {}
    for v in validaciones:
        rut_limpio = v.rut.replace('.', '').replace('-', '')
        fecha_str = v.fecha_hhee.strftime('%Y-%m-%d')
        horas_rrhh_dia = rrhh_lookup.get((rut_limpio, fecha_str), 0)
        campana = v.campaña or "Sin Campaña"

        if campana not in desglose_campana:
            desglose_campana[campana] = {"declaradas": 0.0, "rrhh": 0.0}
        
        desglose_campana[campana]["declaradas"] += v.cantidad_hhee_aprobadas
        desglose_campana[campana]["rrhh"] += horas_rrhh_dia

    lista_campanas = [
        MetricasPorCampana(nombre_campana=nombre, total_horas_declaradas=data["declaradas"], total_horas_rrhh=data["rrhh"])
        for nombre, data in desglose_campana.items()
    ]
    lista_campanas.sort(key=lambda x: x.total_horas_declaradas, reverse=True)

    empleado_top = lista_empleados[0] if lista_empleados else None

    return DashboardHHEEMetricas(
        total_hhee_declaradas=total_declaradas,
        total_hhee_aprobadas_rrhh=total_rrhh,
        empleado_top=empleado_top,
        desglose_por_empleado=lista_empleados,
        desglose_por_campana=lista_campanas
    )
    
@router.get("/metricas-pendientes", response_model=MetricasPendientesHHEE, summary="Obtener métricas de HHEE pendientes de validación")
async def get_hhee_metricas_pendientes(
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
):
    """
    Calcula y devuelve un resumen de HHEE en estado 'Pendiente por Corrección',
    desglosado por el motivo de la nota.
    """
    base_query = select(models.ValidacionHHEE).filter(
        models.ValidacionHHEE.estado == 'Pendiente por Corrección'
    )

    # Si el usuario es Supervisor de Operaciones, filtramos solo los pendientes que él mismo marcó.
    if current_user.role == UserRole.SUPERVISOR_OPERACIONES:
        query = base_query.filter(models.ValidacionHHEE.supervisor_carga == current_user.email)
    else:
        # Supervisor y Responsable ven todos los pendientes.
        query = base_query
    
    result = await db.execute(query)
    pendientes = result.scalars().all()

    # Hacemos el conteo en Python
    total_pendientes = len(pendientes)
    cambio_turno_count = 0
    correccion_marcas_count = 0

    for p in pendientes:
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
    current_user: models.Analista = Depends(require_role([UserRole.ANALISTA]))
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
                    status_code=status.HTTP_409_CONFLICT, # 409 es el código HTTP para "Conflicto"
                    detail=f"Ya tienes una solicitud en estado '{sol.estado.value}' para esta fecha y tipo. No puedes crear otra."
                )
   

    # Si pasamos la validación, creamos la nueva solicitud (el código que ya teníamos)
    nueva_solicitud = models.SolicitudHHEE(
        **solicitud_data.model_dump(),
        analista_id=current_user.id,
        estado=EstadoSolicitudHHEE.PENDIENTE
    )
    db.add(nueva_solicitud)
    await db.commit()
    await db.refresh(nueva_solicitud)
    
    result = await db.execute(
        select(models.SolicitudHHEE)
        .options(selectinload(models.SolicitudHHEE.solicitante))
        .filter(models.SolicitudHHEE.id == nueva_solicitud.id)
    )
    return result.scalars().first()


@router.get("/solicitudes/mis-solicitudes/", response_model=List[SolicitudHHEE], summary="[Analista] Ver mi historial de solicitudes de HHEE")
async def obtener_mis_solicitudes(
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.ANALISTA]))
):
    """
    Devuelve el historial de todas las solicitudes de HHEE para el analista actual.
    """
    query = select(models.SolicitudHHEE).options(
        selectinload(models.SolicitudHHEE.solicitante),
        selectinload(models.SolicitudHHEE.supervisor)
    ).filter(models.SolicitudHHEE.analista_id == current_user.id).order_by(models.SolicitudHHEE.fecha_solicitud.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/solicitudes/pendientes/", summary="[Supervisor] Ver solicitudes pendientes por rango de fecha con datos de GV")
async def obtener_solicitudes_pendientes(
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES])),
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
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
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
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
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
    
    # 4. Procesamos los datos y devolvemos todo junto
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
    current_user: models.Analista = Depends(require_role([UserRole.SUPERVISOR, UserRole.RESPONSABLE, UserRole.SUPERVISOR_OPERACIONES]))
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