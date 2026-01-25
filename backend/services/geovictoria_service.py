# /backend/services/geovictoria_service.py
import asyncio
import httpx
import os
import pandas as pd
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional


GEOVICTORIA_USER = os.getenv("GEOVICTORIA_USER")
GEOVICTORIA_PASSWORD = os.getenv("GEOVICTORIA_PASSWORD")
GEOVICTORIA_LOGIN_URL = "https://customerapi.geovictoria.com/api/v1/Login"
GEOVICTORIA_ATTENDANCE_URL = "https://customerapi.geovictoria.com/api/v1/AttendanceBook"
GEOVICTORIA_CONSOLIDATED_URL = "https://customerapi.geovictoria.com/api/v1/Consolidated"


async def obtener_token_geovictoria():
    if not GEOVICTORIA_USER or not GEOVICTORIA_PASSWORD:
        print("ERROR: Faltan las credenciales de GeoVictoria en las variables de entorno.")
        return None

    payload = {"User": GEOVICTORIA_USER, "Password": GEOVICTORIA_PASSWORD}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(GEOVICTORIA_LOGIN_URL, json=payload)
            response.raise_for_status()
            return response.json().get("token")
    except httpx.RequestError as exc:
        print(f"Error de conexión al obtener token de GeoVictoria: {exc}")
        return None
    
def hhmm_to_decimal(time_str):
    if not time_str or not isinstance(time_str, str) or ':' not in time_str: return 0
    parts = time_str.split(':')
    try:
        return int(parts[0]) + (int(parts[1]) / 60)
    except (ValueError, IndexError):
        return 0
    


async def obtener_datos_completos_periodo(token: str, ruts_limpios: list[str], fecha_inicio_dt: datetime, fecha_fin_dt: datetime):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    CHUNK_SIZE = 40 # Aumentamos el tamaño del lote para reducir llamadas
    RETRY_COUNT = 3
    RETRY_DELAY = 1
    
    # --- FUNCIÓN AUXILIAR INTERNA PARA REALIZAR CONSULTAS EN LOTES ---
    async def ejecutar_consulta_lotes(lista_ruts):
        resultados_lote = []
        async with httpx.AsyncClient(timeout=60.0) as client: # Un solo cliente para todos los lotes
            for i in range(0, len(lista_ruts), CHUNK_SIZE):
                lote_actual = lista_ruts[i:i + CHUNK_SIZE]
                payload = {
                    "StartDate": fecha_inicio_dt.strftime("%Y%m%d%H%M%S"),
                    "EndDate": fecha_fin_dt.strftime("%Y%m%d%H%M%S"),
                    "UserIds": ",".join(lote_actual)
                }

                for attempt in range(RETRY_COUNT):
                    try:
                        response = await client.post(GEOVICTORIA_ATTENDANCE_URL, json=payload, headers=headers)
                        response.raise_for_status()
                        respuesta_lote = response.json()
                        if respuesta_lote.get("Users"):
                            resultados_lote.extend(respuesta_lote["Users"])
                        # print(f"Lote de {len(lote_actual)} RUTs procesado con éxito.")
                        break 
                    except Exception as e:
                        print(f"Error en lote, intento {attempt + 1}/{RETRY_COUNT}: {e}")
                        if attempt < RETRY_COUNT - 1:
                            await asyncio.sleep(RETRY_DELAY)
                        else:
                            print(f"FALLO FINAL para el lote de {len(lote_actual)} RUTs.")
        return resultados_lote

    # --- 1. PRIMERA CONSULTA MASIVA ---
    todos_los_usuarios_gv = await ejecutar_consulta_lotes(ruts_limpios)

    # --- 2. BLOQUE DE VERIFICACIÓN Y RECUPERACIÓN ---
    ruts_recibidos = {str(usuario.get('Identifier')).strip().replace('.', '').replace('-', '').upper() for usuario in todos_los_usuarios_gv if usuario.get('Identifier')}
    ruts_solicitados = set(ruts_limpios)
    ruts_faltantes = list(ruts_solicitados - ruts_recibidos)

    if ruts_faltantes:
        print(f"ADVERTENCIA: Faltaron {len(ruts_faltantes)} RUTs. Iniciando recuperación.")
        print(f"RUTs faltantes para recuperar: {ruts_faltantes}")
        usuarios_recuperados = await ejecutar_consulta_lotes(ruts_faltantes)
        if usuarios_recuperados:
            todos_los_usuarios_gv.extend(usuarios_recuperados)
            print(f"Se recuperaron datos para {len(usuarios_recuperados)} empleados.")

    # --- 3. PROCESAMIENTO FINAL CON LÓGICA DE LIMPIEZA DEFENSIVA ---
    if not todos_los_usuarios_gv:
        return []
    
    dias_procesados_total = []
    
    for usuario in todos_los_usuarios_gv:
        rut_usuario_raw = usuario.get('Identifier')

        # --- INICIO DEL CÓDIGO DEFENSIVO ---
        if not rut_usuario_raw or not isinstance(rut_usuario_raw, str):
            print(f"ADVERTENCIA: Se recibió un registro de GeoVictoria sin un 'Identifier' válido. Omitiendo. Datos: {usuario}")
            continue
        
        rut_usuario = str(rut_usuario_raw).strip().replace('.', '').replace('-', '').upper()
        # --- FIN DEL CÓDIGO DEFENSIVO ---

        intervalos = usuario.get("PlannedInterval", []) or []
        for intervalo_diario in intervalos:
            fecha_str = intervalo_diario.get("Date", "")
            if not fecha_str: continue
            
            fecha_dt = datetime.strptime(fecha_str, '%Y%m%d%H%M%S')
            fecha_actual_str = fecha_dt.strftime('%Y-%m-%d')
            marcas = sorted([p for p in intervalo_diario.get("Punches", []) or [] if p.get("Date")], key=lambda x: x['Date'])
            entradas, salidas = [], []
            if marcas:
                marcas_dt = [pd.to_datetime(p['Date'], format='%Y%m%d%H%M%S') for p in marcas]
                entradas.append(min(marcas_dt))
                if len(marcas_dt) > 1: salidas.append(max(marcas_dt))
            
            turno = (intervalo_diario.get("Shifts", []) or [{}])[0]
            permisos_del_dia = [p.get("TimeOffTypeDescription") for p in intervalo_diario.get("TimeOffs", []) or [] if p.get("TimeOffTypeDescription")]
            
            datos_dia = {
                "fecha": fecha_actual_str,
                "nombre_apellido": f"{usuario.get('Name', '')} {usuario.get('LastName', '')}".strip(),
                "rut_limpio": rut_usuario,
                "rut": rut_usuario,
                "campaña": usuario.get('GroupDescription'),
                "inicio_turno_teorico": turno.get('StartTime'), "fin_turno_teorico": turno.get('ExitTime'),
                "marca_real_inicio": min(entradas).strftime('%H:%M') if entradas else None,
                "marca_real_fin": max(salidas).strftime('%H:%M') if salidas else None,
                "hhee_autorizadas_antes_gv": hhmm_to_decimal(intervalo_diario.get("AuthorizedOvertimeBefore")),
                "hhee_autorizadas_despues_gv": hhmm_to_decimal(intervalo_diario.get("AuthorizedOvertimeAfter")),
                "permisos": permisos_del_dia
            }
            dias_procesados_total.append(datos_dia)
            
    return dias_procesados_total

    
def aplicar_logica_de_negocio(datos_procesados):
    """
    Calcula las HHEE de inicio, fin o descanso basado en los datos de un día.
    Esta es una traducción directa de la lógica de tu app Flask.
    """
    inicio_teorico_str = datos_procesados.get("inicio_turno_teorico")
    fin_teorico_str = datos_procesados.get("fin_turno_teorico")
    inicio_real_str = datos_procesados.get("marca_real_inicio")
    fin_real_str = datos_procesados.get("marca_real_fin")

    if not inicio_real_str or not fin_real_str:
        return { "tipo_hhee": "Sin Marcas", "hhee_inicio_calculadas": 0, "hhee_fin_calculadas": 0, "cantidad_hhee_calculadas": 0}

    # Asignamos una fecha base para poder comparar momentos en el tiempo
    fecha_base = datetime.strptime(datos_procesados.get("fecha"), '%Y-%m-%d')
    inicio_real = fecha_base.replace(hour=int(inicio_real_str[:2]), minute=int(inicio_real_str[3:]))
    fin_real = fecha_base.replace(hour=int(fin_real_str[:2]), minute=int(fin_real_str[3:]))
    
    hhee_inicio, hhee_fin = 0, 0
    tipo_hhee = ""

    es_descanso = not inicio_teorico_str or inicio_teorico_str.lower() == 'descanso' or (inicio_teorico_str == "00:00" and fin_teorico_str == "00:00")

    if es_descanso:
        tipo_hhee = "Día de Descanso"
        if fin_real < inicio_real:
            fin_real += timedelta(days=1)
        hhee_inicio = (fin_real - inicio_real).total_seconds() / 3600
    else:
        inicio_teorico = fecha_base.replace(hour=int(inicio_teorico_str[:2]), minute=int(inicio_teorico_str[3:]))
        fin_teorico = fecha_base.replace(hour=int(fin_teorico_str[:2]), minute=int(fin_teorico_str[3:]))

        if fin_teorico < inicio_teorico: # Turno nocturno
            fin_teorico += timedelta(days=1)

        if fin_real < inicio_real: # Marcas nocturnas
            fin_real += timedelta(days=1)

        # Comparamos los objetos datetime completos, no solo la hora con .time()
        if inicio_real < inicio_teorico:
            tipo_hhee += "Antes de Turno "
            hhee_inicio = (inicio_teorico - inicio_real).total_seconds() / 3600

        if fin_real > fin_teorico:
            tipo_hhee += "Después de Turno"
            hhee_fin = (fin_real - fin_teorico).total_seconds() / 3600


    hhee_calculadas_total = max(0, hhee_inicio) + max(0, hhee_fin)

    return {
        "tipo_hhee": tipo_hhee.strip(),
        "cantidad_hhee_calculadas": round(hhee_calculadas_total, 2),
        "hhee_inicio_calculadas": round(max(0, hhee_inicio), 2) if not es_descanso else 0,
        "hhee_fin_calculadas": round(max(0, hhee_fin), 2) if not es_descanso else 0
    }
