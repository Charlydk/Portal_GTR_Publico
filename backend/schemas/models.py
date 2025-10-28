# schemas/models.py
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date, time
from typing import List, Optional
from ..enums import UserRole, ProgresoTarea, TipoIncidencia, EstadoIncidencia, TipoSolicitudHHEE, EstadoSolicitudHHEE, GravedadIncidencia

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
    lobs_nombres: Optional[List[str]] = None

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
    fecha: Optional[date] = None
    hora: time
    comentario: Optional[str] = None
    lob_id: Optional[int] = None

class BitacoraEntryUpdate(BaseModel):
    fecha: Optional[date] = None
    hora: Optional[time] = None
    comentario: Optional[str] = None
    lob_id: Optional[int] = None

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
    gravedad: GravedadIncidencia
    campana_id: int
    lob_ids: Optional[List[int]] = []
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

class AnalistaListado(BaseModel):
    id: int
    nombre: str
    apellido: str
    email: EmailStr
    bms_id: int
    rut: Optional[str] = None
    role: UserRole
    esta_activo: bool

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

class LobBase(BaseModel):
    nombre: str

class LobCreate(LobBase):
    pass

class Lob(LobBase):
    id: int
    campana_id: int

    class Config:
        from_attributes = True

class BitacoraEntry(BitacoraEntryBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    fecha_ultima_actualizacion: Optional[datetime] = None
    autor: AnalistaSimple
    campana: "CampanaSimple"
    lob: Optional[Lob] = None
    class Config:
        from_attributes = True

# --- Schemas para Incidencias ---
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
    gravedad: Optional[GravedadIncidencia] = 'MEDIA'
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    creador: AnalistaSimple
    cerrado_por: Optional[AnalistaSimple] = None
    asignado_a: Optional[AnalistaSimple] = None
    campana: "CampanaSimple"
    lobs: List[Lob] = []
    ultimo_comentario: Optional[str] = None
    class Config:
        from_attributes = True

class Incidencia(BaseModel):
    id: int
    titulo: str
    descripcion_inicial: str
    herramienta_afectada: Optional[str] = None
    indicador_afectado: Optional[str] = None
    tipo: TipoIncidencia
    gravedad: GravedadIncidencia
    estado: EstadoIncidencia
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    creador: AnalistaSimple
    cerrado_por: Optional[AnalistaSimple] = None
    asignado_a: Optional[AnalistaSimple] = None
    campana: "CampanaSimple"
    lobs: List[Lob] = []
    ultimo_comentario: Optional[str] = None 
    actualizaciones: List[ActualizacionIncidencia] = []
    class Config:
        from_attributes = True

class IncidenciaUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion_inicial: Optional[str] = None
    herramienta_afectada: Optional[str] = None
    indicador_afectado: Optional[str] = None
    tipo: Optional[TipoIncidencia] = None
    gravedad: Optional[GravedadIncidencia] = None
    campana_id: Optional[int] = None
    asignado_a_id: Optional[int] = None
    lob_ids: Optional[List[int]] = []
    fecha_apertura: Optional[datetime] = None

class IncidenciaExportFilters(BaseModel):
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    campana_id: Optional[int] = None
    estado: Optional[EstadoIncidencia] = None
    asignado_a_id: Optional[int] = None


# --- Actualización de relaciones en schemas existentes ---

class Campana(CampanaBase):
    id: int
    fecha_creacion: datetime
    lobs: List[Lob] = []
    analistas_asignados: List[AnalistaSimple] = []
    
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
        
class PlantillaChecklistItemBase(BaseModel):
    descripcion: str

class PlantillaChecklistItemCreate(PlantillaChecklistItemBase):
    pass

class PlantillaChecklistItem(PlantillaChecklistItemBase):
    id: int
    orden: int
    campana_id: int

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

class AnalistaConCampanas(BaseModel):
    id: int
    nombre: str
    apellido: str
    email: EmailStr
    bms_id: int
    role: UserRole
    campanas_asignadas: List[CampanaSimple] = []

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
class BitacoraExportFilters(BaseModel):
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    campana_id: Optional[int] = None
    autor_id: Optional[int] = None
    lob_id: Optional[int] = None


# --- SCHEMAS OPTIMIZADOS PARA WIDGETS DEL DASHBOARD ---

class WidgetAnalista(BaseModel):
    nombre: str
    apellido: str
    class Config:
        from_attributes = True

class WidgetCampana(BaseModel):
    nombre: str
    class Config:
        from_attributes = True

class DashboardIncidenciaWidget(BaseModel):
    id: int
    titulo: str
    estado: EstadoIncidencia
    gravedad: Optional[GravedadIncidencia] = 'MEDIA'
    campana: WidgetCampana
    asignado_a: Optional[WidgetAnalista] = None
    ultimo_comentario: Optional[str] = None # Campo para el último comentario
    
    class Config:
        from_attributes = True



# --- Forward References Update ---
Campana.model_rebuild()
Analista.model_rebuild()

class DashboardStatsAnalista(BaseModel):
    incidencias_sin_asignar: int
    mis_incidencias_asignadas: int
    incidencias_del_dia: List[IncidenciaSimple] = []
    total_incidencias_activas: int
    incidencias_cerradas_hoy: int

class DashboardStatsSupervisor(BaseModel):
    total_incidencias_activas: int
    incidencias_sin_asignar: int
    incidencias_cerradas_hoy: int

# --- Esquema para LOB ---
# Define qué campos de un LOB quieres mostrar en la respuesta.

class Lob(LobBase):
    id: int

    class Config:
        from_attributes = True # Permite que Pydantic lea los datos desde el modelo ORM


