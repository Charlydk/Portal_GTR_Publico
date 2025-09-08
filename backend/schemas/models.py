# schemas/models.py
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date, time
from typing import List, Optional
from enums import UserRole, ProgresoTarea, TipoIncidencia, EstadoIncidencia, TipoSolicitudHHEE, EstadoSolicitudHHEE

# --- Schemas Base (para creación y actualización) ---

class AnalistaBase(BaseModel):
    nombre: str
    apellido: str
    email: EmailStr
    bms_id: int
    rut: Optional[str] = None
    role: UserRole
    esta_activo: Optional[bool] = True

class AnalistaCreate(AnalistaBase):
    password: str = Field(..., min_length=6)

class PasswordUpdate(BaseModel):
    new_password: str = Field(..., min_length=6)

class CampanaBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None

class TareaBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha_vencimiento: datetime
    progreso: ProgresoTarea
    analista_id: Optional[int] = None
    campana_id: Optional[int] = None

class TareaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
    progreso: Optional[ProgresoTarea] = None
    analista_id: Optional[int] = None
    campana_id: Optional[int] = None

class ChecklistItemBase(BaseModel):
    descripcion: str
    completado: Optional[bool] = False
    tarea_id: int

class ChecklistItemUpdate(BaseModel):
    descripcion: Optional[str] = None
    completado: Optional[bool] = None
    tarea_id: Optional[int] = None

class AvisoBase(BaseModel):
    titulo: str
    contenido: str
    fecha_vencimiento: Optional[datetime] = None
    creador_id: int
    campana_id: Optional[int] = None
    requiere_tarea: Optional[bool] = False
    fecha_vencimiento_tarea: Optional[datetime] = None

class AcuseReciboCreate(BaseModel):
    analista_id: int

class BitacoraEntryBase(BaseModel):
    campana_id: int
    fecha: date
    hora: time
    comentario: Optional[str] = None

class BitacoraEntryUpdate(BaseModel):
    fecha: Optional[date] = None
    hora: Optional[time] = None
    comentario: Optional[str] = None

class ComentarioGeneralBitacoraCreate(BaseModel):
    comentario: str

class TareaGeneradaPorAvisoBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
    progreso: ProgresoTarea = ProgresoTarea.PENDIENTE
    analista_asignado_id: int
    aviso_origen_id: Optional[int] = None

class TareaGeneradaPorAvisoUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
    progreso: Optional[ProgresoTarea] = None
    analista_asignado_id: Optional[int] = None

class HistorialEstadoTareaBase(BaseModel):
    old_progreso: Optional[ProgresoTarea] = None
    new_progreso: ProgresoTarea
    changed_by_analista_id: int
    tarea_campana_id: Optional[int] = None
    tarea_generada_id: Optional[int] = None

class ActualizacionIncidenciaBase(BaseModel):
    comentario: str

class IncidenciaCreate(BaseModel):
    titulo: str
    descripcion_inicial: str
    herramienta_afectada: Optional[str] = None
    indicador_afectado: Optional[str] = None
    tipo: TipoIncidencia
    campana_id: int
    fecha_apertura: Optional[datetime] = None

class IncidenciaEstadoUpdate(BaseModel):
    estado: EstadoIncidencia
    fecha_cierre: Optional[datetime] = None
    comentario_cierre: Optional[str] = None

# --- Schemas de Respuesta (para devolver datos desde la API) ---

class AnalistaSimple(BaseModel):
    id: int
    nombre: str
    apellido: str
    email: EmailStr
    role: UserRole
    class Config:
        from_attributes = True

# ===================================================================
# IMPORTANTE: Los schemas de ComentarioTarea AHORA ESTÁN AQUÍ,
#             ANTES de la definición del schema 'Tarea'.
# ===================================================================
class ComentarioTareaBase(BaseModel):
    texto: str

class ComentarioTareaCreate(ComentarioTareaBase):
    pass

class ComentarioTarea(ComentarioTareaBase):
    id: int
    fecha_creacion: datetime
    autor: AnalistaSimple
    class Config:
        from_attributes = True
# ===================================================================

class ComentarioGeneralBitacora(BaseModel):
    id: int
    comentario: str
    fecha_creacion: datetime
    autor: AnalistaSimple
    class Config:
        from_attributes = True

class CampanaSimple(BaseModel):
    id: int
    nombre: str
    class Config:
        from_attributes = True

class TareaSimple(BaseModel):
    id: int
    titulo: str
    progreso: ProgresoTarea
    fecha_vencimiento: datetime
    class Config:
        from_attributes = True

class ChecklistItemSimple(BaseModel):
    id: int
    descripcion: str
    completado: bool
    class Config:
        from_attributes = True

class HistorialEstadoTareaSimple(BaseModel):
    id: int
    old_progreso: Optional[ProgresoTarea]
    new_progreso: ProgresoTarea
    timestamp: datetime
    changed_by_analista: AnalistaSimple
    class Config:
        from_attributes = True

class AvisoSimple(BaseModel):
    id: int
    titulo: str
    fecha_vencimiento: Optional[datetime] = None
    class Config:
        from_attributes = True

class AcuseReciboAvisoSimple(BaseModel):
    id: int
    fecha_acuse: datetime
    analista: AnalistaSimple
    class Config:
        from_attributes = True

class TareaGeneradaPorAvisoSimple(BaseModel):
    id: int
    titulo: str
    progreso: ProgresoTarea
    fecha_vencimiento: Optional[datetime] = None
    class Config:
        from_attributes = True

class BitacoraEntry(BitacoraEntryBase):
    id: int
    fecha_creacion: datetime
    fecha_ultima_actualizacion: datetime
    autor: AnalistaSimple
    campana: "CampanaSimple"
    class Config:
        from_attributes = True

class ActualizacionIncidencia(ActualizacionIncidenciaBase):
    id: int
    fecha_actualizacion: datetime
    autor: AnalistaSimple
    class Config:
        from_attributes = True

class IncidenciaSimple(BaseModel):
    id: int
    titulo: str
    estado: EstadoIncidencia
    tipo: TipoIncidencia
    fecha_apertura: datetime
    asignado_a: Optional[AnalistaSimple] = None
    campana: "CampanaSimple"
    class Config:
        from_attributes = True

class Incidencia(BaseModel):
    id: int
    titulo: str
    descripcion_inicial: str
    herramienta_afectada: Optional[str] = None
    indicador_afectado: Optional[str] = None
    tipo: TipoIncidencia
    estado: EstadoIncidencia
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    creador: AnalistaSimple
    asignado_a: Optional[AnalistaSimple] = None
    campana: "CampanaSimple"
    actualizaciones: List[ActualizacionIncidencia] = []
    class Config:
        from_attributes = True

# --- Actualización de relaciones en schemas existentes ---

class Campana(CampanaBase):
    id: int
    fecha_creacion: datetime
    analistas_asignados: List[AnalistaSimple] = []
    comentarios_generales: List["ComentarioGeneralBitacora"] = []
    incidencias: List[IncidenciaSimple] = []
    class Config:
        from_attributes = True

class Tarea(TareaBase):
    id: int
    fecha_creacion: datetime
    fecha_finalizacion: Optional[datetime] = None
    analista: Optional[AnalistaSimple] = None
    campana: Optional[CampanaSimple] = None
    checklist_items: List[ChecklistItemSimple] = []
    historial_estados: List[HistorialEstadoTareaSimple] = []
    comentarios: List[ComentarioTarea] = []
    class Config:
        from_attributes = True

class TareaListOutput(BaseModel):
    id: int
    titulo: str
    progreso: ProgresoTarea
    fecha_vencimiento: datetime
    analista: Optional[AnalistaSimple] = None
    campana: Optional[CampanaSimple] = None
    class Config:
        from_attributes = True

class ChecklistItem(ChecklistItemBase):
    id: int
    fecha_creacion: datetime
    tarea: TareaSimple
    class Config:
        from_attributes = True

class Aviso(AvisoBase):
    id: int
    fecha_creacion: datetime
    creador: "AnalistaSimple"
    campana: Optional["CampanaSimple"] = None
    acuses_recibo: List["AcuseReciboAvisoSimple"] = []
    tareas_generadas: List["TareaGeneradaPorAvisoSimple"] = []
    class Config:
        from_attributes = True

class AcuseReciboAviso(AcuseReciboCreate):
    id: int
    fecha_acuse: datetime
    analista: "AnalistaSimple"
    aviso: "AvisoSimple"
    class Config:
        from_attributes = True

class HistorialEstadoTarea(HistorialEstadoTareaBase):
    id: int
    timestamp: datetime
    changed_by_analista: AnalistaSimple
    class Config:
        from_attributes = True

class TareaGeneradaPorAviso(TareaGeneradaPorAvisoBase):
    id: int
    fecha_creacion: datetime
    fecha_finalizacion: Optional[datetime] = None
    analista_asignado: AnalistaSimple
    aviso_origen: Optional[AvisoSimple] = None
    historial_estados: List[HistorialEstadoTareaSimple] = []
    class Config:
        from_attributes = True

class Analista(AnalistaBase):
    id: int
    fecha_creacion: datetime
    campanas_asignadas: List[CampanaSimple] = []
    tareas: List[TareaSimple] = []
    avisos_creados: List[AvisoSimple] = []
    acuses_recibo_avisos: List[AcuseReciboAvisoSimple] = []
    tareas_generadas_por_avisos: List[TareaGeneradaPorAvisoSimple] = []
    incidencias_creadas: List[IncidenciaSimple] = []
    incidencias_asignadas: List[IncidenciaSimple] = []
    solicitudes_realizadas: List["SolicitudHHEE"] = []
    solicitudes_gestionadas: List["SolicitudHHEE"] = []
    class Config:
        from_attributes = True

class AvisoListOutput(BaseModel):
    id: int
    titulo: str
    fecha_vencimiento: Optional[datetime] = None
    creador: AnalistaSimple
    campana: Optional[CampanaSimple] = None
    class Config:
        from_attributes = True   
        
# --- SCHEMAS PARA EL DASHBOARD DE MÉTRICAS HHEE ---

class MetricasPorEmpleado(BaseModel):
    nombre_empleado: str
    rut: str
    total_horas_declaradas: float 
    total_horas_rrhh: float      

class MetricasPorCampana(BaseModel):
    nombre_campana: str
    total_horas_declaradas: float
    total_horas_rrhh: float     

class DashboardHHEEMetricas(BaseModel):
    total_hhee_declaradas: float     
    total_hhee_aprobadas_rrhh: float  
    empleado_top: Optional[MetricasPorEmpleado] = None
    desglose_por_empleado: List[MetricasPorEmpleado]
    desglose_por_campana: List[MetricasPorCampana]
    
class MetricasPendientesHHEE(BaseModel):
    total_pendientes: int
    por_cambio_turno: int
    por_correccion_marcas: int
    
# --- SCHEMAS PARA SOLICITUDES DE HHEE  ---

class SolicitudHHEEBase(BaseModel):
    fecha_hhee: date
    tipo: TipoSolicitudHHEE
    horas_solicitadas: float = Field(..., gt=0, description="Las horas deben ser mayores a 0")
    justificacion: str

class SolicitudHHEECreate(SolicitudHHEEBase):
    pass

class SolicitudHHEEDecision(BaseModel):
    estado: EstadoSolicitudHHEE
    horas_aprobadas: float = Field(..., ge=0)
    comentario_supervisor: Optional[str] = None

class SolicitudHHEE(SolicitudHHEEBase):
    id: int
    estado: EstadoSolicitudHHEE
    fecha_solicitud: datetime
    solicitante: AnalistaSimple # Muestra info básica del solicitante

    # Campos de la decisión (pueden ser nulos)
    horas_aprobadas: Optional[float] = None
    comentario_supervisor: Optional[str] = None
    fecha_decision: Optional[datetime] = None
    supervisor: Optional[AnalistaSimple] = None # Muestra info de quién decidió

    class Config:
        from_attributes = True
        
# Esquema para una única decisión dentro del lote
class SolicitudHHEEProcesarItem(BaseModel):
    solicitud_id: int
    estado: EstadoSolicitudHHEE
    horas_aprobadas: float = Field(..., ge=0)
    comentario_supervisor: Optional[str] = None

# Esquema para el lote completo que enviará el frontend
class SolicitudHHEELote(BaseModel):
    decisiones: List[SolicitudHHEEProcesarItem]


# --- Forward References Update ---
Campana.model_rebuild()
Analista.model_rebuild()

class DashboardStatsAnalista(BaseModel):
    incidencias_sin_asignar: int
    mis_incidencias_asignadas: int
    incidencias_del_dia: List[IncidenciaSimple] = []

class DashboardStatsSupervisor(BaseModel):
    total_incidencias_activas: int