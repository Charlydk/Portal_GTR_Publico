# enums.py
from enum import Enum

class UserRole(str, Enum):
    ANALISTA = "ANALISTA"
    SUPERVISOR = "SUPERVISOR"
    RESPONSABLE = "RESPONSABLE"
    SUPERVISOR_OPERACIONES = "SUPERVISOR_OPERACIONES"

class ProgresoTarea(str, Enum):
    PENDIENTE = "PENDIENTE"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    CANCELADA = "CANCELADA"

class TipoIncidencia(str, Enum):
    TECNICA = "TECNICA"
    OPERATIVA = "OPERATIVA"
    HUMANA = "HUMANA"
    OTRO = "OTRO"

class EstadoIncidencia(str, Enum):
    ABIERTA = "ABIERTA"
    EN_PROGRESO = "EN_PROGRESO"
    CERRADA = "CERRADA"
    
class TipoSolicitudHHEE(str, Enum):
    ANTES_TURNO = "ANTES_TURNO"
    DESPUES_TURNO = "DESPUES_TURNO"
    DIA_DESCANSO = "DIA_DESCANSO"

class EstadoSolicitudHHEE(str, Enum):
    PENDIENTE = "PENDIENTE"
    APROBADA = "APROBADA"
    RECHAZADA = "RECHAZADA"
    
class GravedadIncidencia(str, Enum):
    BAJA = "BAJA"
    MEDIA = "MEDIA"
    ALTA = "ALTA"