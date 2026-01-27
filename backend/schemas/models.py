# schemas/models.py
from pydantic import BaseModel, EmailStr, Field, field_validator
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
    hora_inicio_operacion: Optional[time] = None
    hora_fin_operacion: Optional[time] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    lobs_nombres: Optional[List[str]] = None
    hora_inicio_semana: Optional[time] = None
    hora_fin_semana: Optional[time] = None
    hora_inicio_sabado: Optional[time] = None
    hora_fin_sabado: Optional[time] = None
    hora_inicio_domingo: Optional[time] = None
    hora_fin_domingo: Optional[time] = None

class CampanaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    hora_inicio_operacion: Optional[time] = None
    hora_fin_operacion: Optional[time] = None
    
class TareaBase(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha_vencimiento: Optional[datetime] = None
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

    @field_validator('analista_id', 'campana_id', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v

class ChecklistItemBase(BaseModel):
    descripcion: str
    completado: Optional[bool] = False
    tarea_id: int
    hora_sugerida: Optional[time] = None

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
    hora: time
    campana_id: int
    lob_id: Optional[int] = None
    comentario: Optional[str] = None

    # Campos para Incidencias
    es_incidencia: Optional[bool] = False
    incidencia_id: Optional[int] = None
    tipo_incidencia: Optional[str] = None
    comentario_incidencia: Optional[str] = None

class BitacoraEntryCreate(BitacoraEntryBase):
    pass

class BitacoraEntryUpdate(BaseModel):
    fecha: Optional[date] = None
    hora: Optional[time] = None
    comentario: Optional[str] = None
    lob_id: Optional[int] = None

class ComentarioGeneralBitacoraCreate(BaseModel):
    contenido: str

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
    changed_by: int
    tarea_id: Optional[int] = None

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
    fecha_creacion: Optional[datetime] = None
    autor: AnalistaSimple
    class Config:
        from_attributes = True
# ===================================================================

class ComentarioGeneralBitacora(BaseModel):
    id: int
    contenido: str
    fecha_creacion: Optional[datetime] = None
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
    fecha_vencimiento: Optional[datetime] = None
    class Config:
        from_attributes = True

class ChecklistItemSimple(BaseModel):
    id: int
    descripcion: str
    completado: bool
    fecha_completado: Optional[datetime] = None
    hora_sugerida: Optional[time] = None
    class Config:
        from_attributes = True

class HistorialEstadoTareaSimple(BaseModel):
    id: int
    old_progreso: Optional[ProgresoTarea]
    new_progreso: ProgresoTarea
    timestamp: Optional[datetime] = None
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
    fecha_acuse: Optional[datetime] = None
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
    esta_activo: bool = True

class LobCreate(LobBase):
    pass

class Lob(LobBase):
    id: int
    campana_id: int

    class Config:
        from_attributes = True

class BitacoraEntry(BitacoraEntryBase):
    id: int
    fecha: date
    autor_id: int

    # Relaciones anidadas (Opcionales para evitar recursión infinita)
    campana: Optional['CampanaSimple'] = None
    autor: Optional['AnalistaSimple'] = None
    lob: Optional['Lob'] = None

    # Configuración para que Pydantic lea modelos de SQLAlchemy
    class Config:
        from_attributes = True

# Alias para compatibilidad si algún código viejo usa 'Simple'
BitacoraEntrySimple = BitacoraEntry

# --- Schemas para Incidencias ---
class ActualizacionIncidencia(ActualizacionIncidenciaBase):
    id: int
    fecha_actualizacion: Optional[datetime] = None
    autor: AnalistaSimple
    class Config:
        from_attributes = True

class IncidenciaSimple(BaseModel):
    id: int
    titulo: str
    estado: EstadoIncidencia
    tipo: TipoIncidencia
    gravedad: Optional[GravedadIncidencia] = 'MEDIA'
    fecha_apertura: Optional[datetime] = None
    fecha_cierre: Optional[datetime] = None
    creador: Optional[AnalistaSimple] = None
    cerrado_por: Optional[AnalistaSimple] = None
    asignado_a: Optional[AnalistaSimple] = None
    campana: Optional["CampanaSimple"] = None
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
    fecha_apertura: Optional[datetime] = None
    fecha_cierre: Optional[datetime] = None
    creador: Optional[AnalistaSimple] = None
    cerrado_por: Optional[AnalistaSimple] = None
    asignado_a: Optional[AnalistaSimple] = None
    campana: Optional["CampanaSimple"] = None
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

    @field_validator('campana_id', 'asignado_a_id', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v

class IncidenciaExportFilters(BaseModel):
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    campana_id: Optional[int] = None
    estado: Optional[EstadoIncidencia] = None
    asignado_a_id: Optional[int] = None

    @field_validator('campana_id', 'asignado_a_id', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v


# --- Actualización de relaciones en schemas existentes ---

class Campana(CampanaBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    lobs: List[Lob] = []
    analistas_asignados: List[AnalistaSimple] = []
    
    class Config:
        from_attributes = True

class Tarea(TareaBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    es_generada_automaticamente: bool = False
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
    fecha_vencimiento: Optional[datetime] = None
    es_generada_automaticamente: bool = False
    analista: Optional[AnalistaSimple] = None
    campana: Optional[CampanaSimple] = None
    checklist_items: List[ChecklistItemSimple] = []
    class Config:
        from_attributes = True  # Para Pydantic V2

class ChecklistItem(ChecklistItemBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    tarea: TareaSimple
    class Config:
        from_attributes = True
        
class PlantillaChecklistItemBase(BaseModel):
    descripcion: str
    hora_sugerida: Optional[time] = None
    lunes: bool = True
    martes: bool = True
    miercoles: bool = True
    jueves: bool = True
    viernes: bool = True
    sabado: bool = True
    domingo: bool = True

class PlantillaChecklistItemCreate(PlantillaChecklistItemBase):
    pass

class PlantillaChecklistItem(PlantillaChecklistItemBase):
    id: int
    orden: int
    campana_id: Optional[int] = None
    plantilla_id: Optional[int] = None

    class Config:
        from_attributes = True

# Esquema para recibir la petición de entrada
class CheckInCreate(BaseModel):
    campana_id: int

# Esquema para responder (mostrando detalles de la campaña)
class SesionActiva(BaseModel):
    id: int
    fecha_inicio: Optional[datetime] = None
    campana: Campana
    campana_id: int
    
    class Config:
        from_attributes = True

class SesionCampanaSchema(BaseModel):
    id: int
    analista_id: int
    campana_id: int
    fecha_inicio: Optional[datetime] = None
    active: bool = True
    
    class Config:
        from_attributes = True


class Aviso(AvisoBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    creador: "AnalistaSimple"
    campana: Optional["CampanaSimple"] = None
    acuses_recibo: List["AcuseReciboAvisoSimple"] = []
    tareas_generadas: List["TareaGeneradaPorAvisoSimple"] = []
    class Config:
        from_attributes = True

class AcuseReciboAviso(AcuseReciboCreate):
    id: int
    fecha_acuse: Optional[datetime] = None
    analista: "AnalistaSimple"
    aviso: "AvisoSimple"
    class Config:
        from_attributes = True

class HistorialEstadoTarea(HistorialEstadoTareaBase):
    id: int
    timestamp: Optional[datetime] = None
    changed_by_analista: AnalistaSimple
    class Config:
        from_attributes = True

class TareaGeneradaPorAviso(TareaGeneradaPorAvisoBase):
    id: int
    fecha_generacion: Optional[datetime] = None
    fecha_finalizacion: Optional[datetime] = None
    analista_asignado: AnalistaSimple
    aviso_origen: Optional[AvisoSimple] = None
    historial_estados: List[HistorialEstadoTareaSimple] = []
    class Config:
        from_attributes = True

class Analista(AnalistaBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    campanas_asignadas: List[CampanaSimple] = []
    tareas: List[TareaSimple] = []
    avisos_creados: List[AvisoSimple] = []
    acuses_recibo_avisos: List[AcuseReciboAvisoSimple] = []
    tareas_generadas_por_avisos: List[TareaGeneradaPorAvisoSimple] = []
    incidencias_creadas: List[IncidenciaSimple] = []
    incidencias_asignadas: List[IncidenciaSimple] = []
    solicitudes_realizadas: List["SolicitudHHEE"] = []
    solicitudes_gestionadas: List["SolicitudHHEE"] = []

    # Campos para retrocompatibilidad y WFM
    solicitudes_hhee: List["SolicitudHHEE"] = []
    planificaciones: List["Planificacion"] = []

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
    total_solicitudes_pendientes: int = 0
    total_horas_aprobadas_solicitud: float = 0
    total_horas_rechazadas_solicitud: float = 0

    empleado_top: Optional[MetricasPorEmpleado] = None # Lo dejo opcional por compatibilidad, pero por ahora no lo voy a usar en el frontend
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
    fecha_solicitud: Optional[datetime] = None
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

    @field_validator('campana_id', 'autor_id', 'lob_id', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v


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

class CoberturaCampana(BaseModel):
    campana_id: int
    nombre_campana: str
    estado: str  # "CUBIERTA", "DESCUBIERTA", "CERRADA", "SIN_HORARIO"
    analistas_activos: int
    hora_inicio_hoy: Optional[time] = None
    hora_fin_hoy: Optional[time] = None
    nombres_analistas: List[str] = []


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



# ==========================================
# SCHEMAS WFM (Planificación)
# ==========================================

# --- EQUIPOS ---
class EquipoBase(BaseModel):
    nombre: str
    codigo_pais: Optional[str] = None

class Equipo(EquipoBase):
    id: int
    class Config:
        from_attributes = True

# --- CLUSTERS (Grupos/Colores) ---
class ClusterBase(BaseModel):
    nombre: str
    color_hex: str = "#6c757d"
    equipo_id: Optional[int] = None

class Cluster(ClusterBase):
    id: int
    class Config:
        from_attributes = True

# --- CONCEPTOS DE TURNO (Turno, Off, Vacaciones) ---
class ConceptoTurnoBase(BaseModel):
    codigo: str
    nombre: str
    es_laborable: bool = True
    requiere_asistencia: bool = True

class ConceptoTurno(ConceptoTurnoBase):
    id: int
    class Config:
        from_attributes = True

# --- PLANIFICACIÓN DIARIA (La celda del Excel) ---
class PlanificacionBase(BaseModel):
    fecha: date
    analista_id: int
    concepto_id: int
    cluster_id: Optional[int] = None
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    es_extra: bool = False
    nota: Optional[str] = None

class PlanificacionCreate(PlanificacionBase):
    pass

class Planificacion(PlanificacionBase):
    id: int
    # Relaciones para mostrar nombres en el frontend
    concepto: Optional[ConceptoTurno] = None
    cluster: Optional[Cluster] = None
    analista: Optional[AnalistaSimple] = None # Usamos el Simple para no hacer ciclo infinito

    class Config:
        from_attributes = True
# --- Forward References Update ---
Campana.model_rebuild()
Analista.model_rebuild()
