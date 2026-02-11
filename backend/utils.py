# backend/utils.py
import pytz
from datetime import datetime, timezone, time
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

def get_current_hhee_period():
    """
    Calcula el periodo de HHEE actual (del 26 del mes anterior al 25 del actual).
    """
    now = datetime.now(timezone.utc)
    if now.day >= 26:
        start_date = now.replace(day=26).date()
        # El fin es el 25 del mes siguiente
        if now.month == 12:
            end_date = now.replace(year=now.year + 1, month=1, day=25).date()
        else:
            end_date = now.replace(month=now.month + 1, day=25).date()
    else:
        # Estamos antes del 26, el periodo empezó el 26 del mes pasado
        if now.month == 1:
            start_date = now.replace(year=now.year - 1, month=12, day=26).date()
        else:
            start_date = now.replace(month=now.month - 1, day=26).date()
        end_date = now.replace(day=25).date()

    return start_date, end_date
