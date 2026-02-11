import pytz
from datetime import datetime, timezone, time, date
from fastapi import Request

DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires"

def get_client_timezone(request: Request) -> str:
    """
    Extrae la zona horaria del encabezado X-Timezone.
    Si no está presente o no es válida, devuelve la zona horaria por defecto.
    """
    tz_name = request.headers.get("X-Timezone", DEFAULT_TIMEZONE)
    try:
        pytz.timezone(tz_name)
        return tz_name
    except pytz.UnknownTimeZoneError:
        return DEFAULT_TIMEZONE

def get_now_local(tz_name: str) -> datetime:
    """
    Devuelve la fecha y hora actual consciente de la zona horaria especificada.
    """
    tz = pytz.timezone(tz_name)
    return datetime.now(tz)

def get_today_range_utc(tz_name: str):
    """
    Devuelve el inicio y fin del día actual para la zona horaria dada,
    convertidos a UTC conscientes.
    """
    tz = pytz.timezone(tz_name)
    now_local = datetime.now(tz)

    start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = now_local.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Convertir a UTC
    start_utc = start_local.astimezone(pytz.utc)
    end_utc = end_local.astimezone(pytz.utc)

    return start_utc, end_utc

def decimal_to_hhmm(decimal_hours):
    """Convierte un número decimal de horas a formato HH:MM."""
    if decimal_hours is None or not isinstance(decimal_hours, (int, float)):
        return "00:00"
    hours = int(decimal_hours)
    minutes = int(round((decimal_hours - hours) * 60))
    return f"{hours:02d}:{minutes:02d}"

def formatear_rut(rut: str) -> str:
    """Limpia y formatea un RUT al formato XXXXXXXX-K."""
    if not isinstance(rut, str):
        return ""
    # 1. Quitar puntos y guiones
    rut_limpio = rut.replace('.', '').replace('-', '')
    # 2. Convertir a mayúsculas por si la 'k' está en minúscula
    rut_limpio = rut_limpio.upper()
    # 3. Separar el cuerpo del dígito verificador
    cuerpo = rut_limpio[:-1]
    dv = rut_limpio[-1]
    # 4. Devolver en el formato estándar
    return f"{cuerpo}-{dv}"

def get_current_hhee_period():
    """
    Calcula el periodo actual de HHEE (26 del mes anterior al 25 del mes actual).
    Si hoy es >= 26, el periodo termina el 25 del mes siguiente.
    """
    today = date.today()
    if today.day >= 26:
        start = date(today.year, today.month, 26)
        if today.month == 12:
            end = date(today.year + 1, 1, 25)
        else:
            end = date(today.year, today.month + 1, 25)
    else:
        if today.month == 1:
            start = date(today.year - 1, 12, 26)
        else:
            start = date(today.year, today.month - 1, 26)
        end = date(today.year, today.month, 25)
    return start, end
