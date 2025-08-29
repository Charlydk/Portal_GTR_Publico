# /backend/routers/hhee_router.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from services import geovictoria_service
from datetime import datetime, date
from typing import List, Optional

from database import get_db
from dependencies import get_current_analista
from sql_app import models
from pydantic import BaseModel

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
    prefix="/hhee",
    tags=["Portal HHEE"]
)

@router.post("/consultar-empleado")
async def consultar_empleado(
    consulta: ConsultaHHEE,
    db: AsyncSession = Depends(get_db),
    current_user: models.Analista = Depends(get_current_analista)
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
    current_user: models.Analista = Depends(get_current_analista)
):
    mensajes_respuesta = []

    for validacion in request_body.validaciones:
        query_existentes = select(models.ValidacionHHEE).filter_by(
            rut=validacion.rut_con_formato, 
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
                "rut": validacion.rut_con_formato, "nombre_apellido": validacion.nombre_apellido,
                "campaña": validacion.campaña, "fecha_hhee": validacion.fecha,
                "estado": "Pendiente por Corrección", "notas": validacion.nota,
                "supervisor_carga": current_user.email, "tipo_hhee": "General"
            }
            db.add(models.ValidacionHHEE(**datos_para_bd))
            mensajes_respuesta.append(f"Día {validacion.fecha}: marcado como 'Pendiente'.")
            continue

        # ... (el resto de la lógica de guardado se queda igual que antes) ...
        base_datos_bd = {
            "rut": validacion.rut_con_formato, "nombre_apellido": validacion.nombre_apellido,
            "campaña": validacion.campaña, "fecha_hhee": validacion.fecha,
            "supervisor_carga": current_user.email, "estado": "Validado", "notas": None
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
    current_user: models.Analista = Depends(get_current_analista)
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