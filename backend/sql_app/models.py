# backend/sql_app/models.py

from sqlalchemy import (Column, Integer, String, Boolean, DateTime, ForeignKey,
                        Enum as SQLEnum, Date, Time, Text, Float, Table, func)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
from ..enums import (UserRole, ProgresoTarea, TipoIncidencia, EstadoIncidencia,
                     TipoSolicitudHHEE, EstadoSolicitudHHEE, GravedadIncidencia)

Base = declarative_base()

# --- TABLAS DE ASOCIACIÓN ---

incidencias_lobs = Table('incidencias_lobs', Base.metadata,
    Column('incidencia_id', Integer, ForeignKey('incidencias.id'), primary_key=True),
    Column('lob_id', Integer, ForeignKey('lobs.id'), primary_key=True)
)

analistas_campanas = Table('analistas_campanas', Base.metadata,
    Column('analista_id', Integer, ForeignKey('analistas.id'), primary_key=True),
    Column('campana_id', Integer, ForeignKey('campanas.id'), primary_key=True)
)

# ==============================================================================
# NUEVOS MODELOS FASE 2: GESTIÓN DE FUERZA LABORAL (WFM) Y PLANIFICACIÓN
# ==============================================================================

class Equipo(Base):
    """
    Representa una entidad operativa o país (Ej: 'Operaciones Chile', 'Operaciones Argentina').
    Sirve para segregar la vista y los reportes.
    """
    __tablename__ = "equipos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False) # Ej: "Chile", "Argentina"
    codigo_pais = Column(String, nullable=True)          # Ej: "CL", "AR"

    # Relaciones
    analistas = relationship("Analista", back_populates="equipo")
    clusters = relationship("Cluster", back_populates="equipo")


class Cluster(Base):
    """
    Agrupa campañas por color o línea de negocio (Ej: 'Retail (Azul)', 'Telco (Rosa)').
    Es la entidad que se asigna en el calendario de planificación.
    """
    __tablename__ = "clusters"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)        # Ej: "Retail", "Soporte"
    color_hex = Column(String, default="#6c757d")  # Color para el calendario (Ej: #0d6efd)

    equipo_id = Column(Integer, ForeignKey("equipos.id"), nullable=True)

    # Relaciones
    equipo = relationship("Equipo", back_populates="clusters")
    campanas = relationship("Campana", back_populates="cluster")
    planificaciones = relationship("PlanificacionDiaria", back_populates="cluster")


class ConceptoTurno(Base):
    """
    Catálogo de tipos de turno o ausencias (Ej: TURNO, OFF, VAC, LIC).
    Define cómo se comporta la calculadora de asistencia.
    """
    __tablename__ = "conceptos_turno"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String, unique=True, index=True) # Ej: "TURNO", "VAC", "OFF"
    nombre = Column(String, nullable=False)          # Ej: "Turno Operativo", "Vacaciones"

    es_laborable = Column(Boolean, default=True)      # ¿Se espera que trabaje? (OFF=False)
    requiere_asistencia = Column(Boolean, default=True) # ¿Debe marcar asistencia? (VAC=False)

    # Relaciones
    planificaciones = relationship("PlanificacionDiaria", back_populates="concepto")


class PlanificacionDiaria(Base):
    """
    La 'celda del Excel'. Define qué debe hacer un analista un día específico.
    """
    __tablename__ = "planificacion_diaria"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, nullable=False, index=True) # 2026-01-05

    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=True) # El color del día
    concepto_id = Column(Integer, ForeignKey("conceptos_turno.id"), nullable=False) # TURNO, OFF, etc.

    # Horario Planificado (Tipos Time para cálculos)
    hora_inicio = Column(Time, nullable=True) # 09:00:00
    hora_fin = Column(Time, nullable=True)    # 18:00:00

    es_extra = Column(Boolean, default=False) # Si es un turno HHEE en día libre
    nota = Column(String, nullable=True)      # Para el asterisco "*" o comentarios breves

    # Auditoría
    creado_por_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)

    # Relaciones
    analista = relationship("Analista", foreign_keys=[analista_id], back_populates="planificaciones")
    cluster = relationship("Cluster", back_populates="planificaciones")
    concepto = relationship("ConceptoTurno", back_populates="planificaciones")
    creado_por = relationship("Analista", foreign_keys=[creado_por_id])


# ==============================================================================
# MODELOS EXISTENTES (ACTUALIZADOS)
# ==============================================================================

class Analista(Base):
    __tablename__ = "analistas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    apellido = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    bms_id = Column(Integer, nullable=True)
    rut = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole, native_enum=False, create_type=False), default=UserRole.ANALISTA)
    esta_activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    equipo_id = Column(Integer, ForeignKey("equipos.id"), nullable=True)
    equipo = relationship("Equipo", back_populates="analistas")

    # Relaciones existentes
    campanas_asignadas = relationship("Campana", secondary=analistas_campanas, back_populates="analistas_asignados")
    tareas = relationship("Tarea", back_populates="analista", foreign_keys="[Tarea.analista_id]")
    incidencias_creadas = relationship("Incidencia", back_populates="creador", foreign_keys="[Incidencia.creador_id]")
    incidencias_asignadas = relationship("Incidencia", back_populates="asignado_a", foreign_keys="[Incidencia.asignado_a_id]")
    avisos_creados = relationship("Aviso", back_populates="creador")
    comentarios_bitacora = relationship("ComentarioGeneralBitacora", back_populates="autor")
    acuses_recibo_avisos = relationship("AcuseReciboAviso", back_populates="analista")
    tareas_generadas_por_avisos = relationship("TareaGeneradaPorAviso", back_populates="analista")
    sesiones = relationship("SesionCampana", back_populates="analista")
    validaciones_hhee = relationship("ValidacionHHEE", back_populates="analista", foreign_keys="[ValidacionHHEE.analista_id]")
    solicitudes_realizadas = relationship("SolicitudHHEE", back_populates="solicitante", foreign_keys="[SolicitudHHEE.analista_id]")
    solicitudes_gestionadas = relationship("SolicitudHHEE", back_populates="supervisor", foreign_keys="[SolicitudHHEE.supervisor_id]")

    # --- NUEVA RELACIÓN: PLANIFICACIÓN ---
    planificaciones = relationship("PlanificacionDiaria", back_populates="analista", foreign_keys="[PlanificacionDiaria.analista_id]")


class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, index=True, nullable=False)
    descripcion = Column(String, nullable=True)
    hora_inicio_operacion = Column(Time, nullable=True)
    hora_fin_operacion = Column(Time, nullable=True)

    # Nuevos campos de horario extendido
    fecha_inicio = Column(DateTime(timezone=True), nullable=True)
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    hora_inicio_semana = Column(Time, nullable=True)
    hora_fin_semana = Column(Time, nullable=True)
    hora_inicio_sabado = Column(Time, nullable=True)
    hora_fin_sabado = Column(Time, nullable=True)
    hora_inicio_domingo = Column(Time, nullable=True)
    hora_fin_domingo = Column(Time, nullable=True)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    plantilla_defecto_id = Column(Integer, ForeignKey("plantillas_checklist.id"), nullable=True)
    plantilla_defecto = relationship("PlantillaChecklist", back_populates="campanas_asociadas")

    # --- NUEVO CAMPO: CLUSTER ---
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=True)
    cluster = relationship("Cluster", back_populates="campanas")

    # Relaciones existentes
    analistas_asignados = relationship("Analista", secondary=analistas_campanas, back_populates="campanas_asignadas")
    tareas = relationship("Tarea", back_populates="campana")
    incidencias = relationship("Incidencia", back_populates="campana")
    avisos = relationship("Aviso", back_populates="campana")
    lobs = relationship("Lob", back_populates="campana", cascade="all, delete-orphan")
    comentarios_generales = relationship("ComentarioGeneralBitacora", back_populates="campana", cascade="all, delete-orphan")
    sesiones = relationship("SesionCampana", back_populates="campana")
    bitacora_entries = relationship("BitacoraEntry", back_populates="campana", cascade="all, delete-orphan")
    plantilla_items = relationship("ItemPlantillaChecklist", back_populates="campana", cascade="all, delete-orphan")

# ==============================================================================
# RESTO DE MODELOS (SIN CAMBIOS ESTRUCTURALES IMPORTANTES)
# ==============================================================================

class Lob(Base):
    __tablename__ = "lobs"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"))
    campana = relationship("Campana", back_populates="lobs")
    incidencias = relationship("Incidencia", secondary=incidencias_lobs, back_populates="lobs")

class PlantillaChecklist(Base):
    __tablename__ = "plantillas_checklist"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    prioridad = Column(String, default="MEDIA")
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    campanas_asociadas = relationship("Campana", back_populates="plantilla_defecto")

class ItemPlantillaChecklist(Base):
    __tablename__ = "plantillas_checklist_items"
    id = Column(Integer, primary_key=True, index=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)
    descripcion = Column(String, nullable=False)
    hora_sugerida = Column(Time, nullable=True)
    orden = Column(Integer, default=0)

    # Días de la semana
    lunes = Column(Boolean, default=True)
    martes = Column(Boolean, default=True)
    miercoles = Column(Boolean, default=True)
    jueves = Column(Boolean, default=True)
    viernes = Column(Boolean, default=True)
    sabado = Column(Boolean, default=True)
    domingo = Column(Boolean, default=True)

    campana = relationship("Campana", back_populates="plantilla_items")

class SesionCampana(Base):
    __tablename__ = "sesiones_campana"
    id = Column(Integer, primary_key=True, index=True)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    fecha_inicio = Column(DateTime(timezone=True), server_default=func.now())
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    adherencia = Column(String, default="EN_TURNO")
    analista = relationship("Analista", back_populates="sesiones")
    campana = relationship("Campana", back_populates="sesiones")

class Tarea(Base):
    __tablename__ = "tareas"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    descripcion = Column(String)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    progreso = Column(SQLEnum(ProgresoTarea, native_enum=False, create_type=False), default=ProgresoTarea.PENDIENTE)
    es_generada_automaticamente = Column(Boolean, default=False)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)
    aviso_origen_id = Column(Integer, ForeignKey("avisos.id"), nullable=True)
    
    analista = relationship("Analista", back_populates="tareas")
    campana = relationship("Campana", back_populates="tareas")
    checklist_items = relationship("ChecklistItem", back_populates="tarea", cascade="all, delete-orphan")
    aviso_origen = relationship("Aviso", back_populates="tareas_generadas")
    comentarios = relationship("ComentarioTarea", back_populates="tarea", cascade="all, delete-orphan")
    historial_estados = relationship("HistorialEstadoTarea", back_populates="tarea", cascade="all, delete-orphan")

class ComentarioTarea(Base):
    __tablename__ = "comentarios_tarea"
    id = Column(Integer, primary_key=True, index=True)
    tarea_id = Column(Integer, ForeignKey("tareas.id"))
    autor_id = Column(Integer, ForeignKey("analistas.id"))
    texto = Column(Text, nullable=False) # Antes 'contenido', unificado con schema
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    tarea = relationship("Tarea", back_populates="comentarios")
    autor = relationship("Analista")

class HistorialEstadoTarea(Base):
    __tablename__ = "historial_estado_tarea"
    id = Column(Integer, primary_key=True, index=True)
    tarea_id = Column(Integer, ForeignKey("tareas.id"))
    old_progreso = Column(String)
    new_progreso = Column(String)
    changed_by = Column(Integer, ForeignKey("analistas.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    tarea = relationship("Tarea", back_populates="historial_estados")
    changed_by_analista = relationship("Analista")

class ChecklistItem(Base):
    __tablename__ = "checklist_items"
    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String)
    completado = Column(Boolean, default=False)
    tarea_id = Column(Integer, ForeignKey("tareas.id"))
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    hora_sugerida = Column(Time, nullable=True)
    tarea = relationship("Tarea", back_populates="checklist_items")

class Aviso(Base):
    __tablename__ = "avisos"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    contenido = Column(String)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    creador_id = Column(Integer, ForeignKey("analistas.id"))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)
    requiere_tarea = Column(Boolean, default=False)
    fecha_vencimiento_tarea = Column(DateTime(timezone=True), nullable=True)
    creador = relationship("Analista", back_populates="avisos_creados")
    campana = relationship("Campana", back_populates="avisos")
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="aviso", cascade="all, delete-orphan")
    tareas_generadas = relationship("Tarea", back_populates="aviso_origen")

class AcuseReciboAviso(Base):
    __tablename__ = "acuses_recibo_aviso"
    id = Column(Integer, primary_key=True, index=True)
    aviso_id = Column(Integer, ForeignKey("avisos.id"))
    analista_id = Column(Integer, ForeignKey("analistas.id"))
    fecha_acuse = Column(DateTime(timezone=True), server_default=func.now())
    
    aviso = relationship("Aviso", back_populates="acuses_recibo")

    analista = relationship("Analista", back_populates="acuses_recibo_avisos")

class TareaGeneradaPorAviso(Base):
    __tablename__ = "tareas_generadas_por_aviso"
    id = Column(Integer, primary_key=True, index=True)
    aviso_id = Column(Integer, ForeignKey("avisos.id"))
    analista_id = Column(Integer, ForeignKey("analistas.id"))
    tarea_id = Column(Integer, ForeignKey("tareas.id"))
    fecha_generacion = Column(DateTime(timezone=True), server_default=func.now())
    analista = relationship("Analista", back_populates="tareas_generadas_por_avisos")
    aviso_origen = relationship("Aviso")
    tarea = relationship("Tarea")

class ComentarioGeneralBitacora(Base):
    __tablename__ = "comentarios_general_bitacora"
    id = Column(Integer, primary_key=True, index=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"))
    autor_id = Column(Integer, ForeignKey("analistas.id"))
    contenido = Column(String) # Revertido a 'contenido' para compatibilidad con DB producción
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    campana = relationship("Campana", back_populates="comentarios_generales")
    autor = relationship("Analista", back_populates="comentarios_bitacora")

class BitacoraEntry(Base):
    __tablename__ = "bitacora_entries"
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, nullable=False, index=True)
    hora = Column(Time, nullable=False)
    comentario = Column(Text, nullable=True)

    autor_id = Column(Integer, ForeignKey('analistas.id'), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    lob_id = Column(Integer, ForeignKey("lobs.id"), nullable=True)
    
    # Campos para Incidencias (Retrocompatibilidad branch)
    es_incidencia = Column(Boolean, default=False)
    incidencia_id = Column(Integer, ForeignKey("incidencias.id"), nullable=True)
    tipo_incidencia = Column(String, nullable=True)
    comentario_incidencia = Column(Text, nullable=True)

    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    autor = relationship("Analista")
    campana = relationship("Campana", back_populates="bitacora_entries")
    lob = relationship("Lob")
    incidencia = relationship("Incidencia")

class Incidencia(Base):
    __tablename__ = "incidencias"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion_inicial = Column(Text)
    herramienta_afectada = Column(String, nullable=True)
    indicador_afectado = Column(String, nullable=True)
    tipo = Column(SQLEnum(TipoIncidencia, native_enum=False, create_type=False), default=TipoIncidencia.TECNICA)
    estado = Column(SQLEnum(EstadoIncidencia, native_enum=False, create_type=False), default=EstadoIncidencia.ABIERTA)
    gravedad = Column(SQLEnum(GravedadIncidencia, native_enum=False, create_type=False), default=GravedadIncidencia.MEDIA)
    fecha_apertura = Column(DateTime(timezone=True), server_default=func.now())
    fecha_cierre = Column(DateTime(timezone=True), nullable=True)
    comentario_cierre = Column(Text, nullable=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    creador_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    asignado_a_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    cerrado_por_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)

    campana = relationship("Campana", back_populates="incidencias")
    creador = relationship("Analista", foreign_keys=[creador_id], back_populates="incidencias_creadas")
    asignado_a = relationship("Analista", foreign_keys=[asignado_a_id], back_populates="incidencias_asignadas")
    cerrado_por = relationship("Analista", foreign_keys=[cerrado_por_id])
    lobs = relationship("Lob", secondary=incidencias_lobs, back_populates="incidencias")
    actualizaciones = relationship("ActualizacionIncidencia", back_populates="incidencia", cascade="all, delete-orphan")

class ActualizacionIncidencia(Base):
    __tablename__ = "actualizaciones_incidencia"
    id = Column(Integer, primary_key=True, index=True)
    incidencia_id = Column(Integer, ForeignKey("incidencias.id"), nullable=False)
    autor_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    fecha_actualizacion = Column(DateTime(timezone=True), server_default=func.now())
    comentario = Column(Text, nullable=False)
    incidencia = relationship("Incidencia", back_populates="actualizaciones")
    autor = relationship("Analista")

# --- HHEE ---
class ValidacionHHEE(Base):
    __tablename__ = "validaciones_hhee"
    id = Column(Integer, primary_key=True, index=True)
    rut = Column(String, nullable=False) # Retrocompatibilidad y constraint NOT NULL
    fecha_hhee = Column(Date, nullable=False) # Retrocompatibilidad y constraint NOT NULL

    # Campos redundantes para compatibilidad con diferentes versiones de la app
    fecha = Column(Date, nullable=False)
    rut_analista = Column(String, nullable=False)
    nombre_apellido = Column(String) # Retrocompatibilidad
    estado = Column(String) # Retrocompatibilidad
    notas = Column(String) # Retrocompatibilidad
    cantidad_hhee_aprobadas = Column(Float) # Retrocompatibilidad

    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    nombre_apellido_gv = Column(String)
    campaña = Column(String)
    tipo_hhee = Column(String)
    inicio_turno_teorico = Column(String)
    fin_turno_teorico = Column(String)
    marca_real_inicio = Column(String)
    marca_real_fin = Column(String)
    hhee_calculadas_sistema = Column(Float, default=0.0)
    hhee_aprobadas_rrhh = Column(Float, default=0.0)
    estado_validacion = Column(String, default="PENDIENTE")
    comentario_validacion = Column(String, nullable=True)
    supervisor_carga = Column(String)
    fecha_carga = Column(DateTime(timezone=True), server_default=func.now())
    reportado_a_rrhh = Column(Boolean, default=False)
    reportado_por_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    fecha_reportado = Column(DateTime(timezone=True), nullable=True)
    analista = relationship("Analista", foreign_keys=[analista_id], back_populates="validaciones_hhee")

class SolicitudHHEE(Base):
    __tablename__ = "solicitudes_hhee"
    id = Column(Integer, primary_key=True, index=True)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    fecha_solicitud = Column(DateTime(timezone=True), server_default=func.now())
    fecha_hhee = Column(Date, nullable=False)
    horas_solicitadas = Column(Float, nullable=False)
    tipo = Column(SQLEnum(TipoSolicitudHHEE, native_enum=False, create_type=False), default=TipoSolicitudHHEE.DESPUES_TURNO)
    justificacion = Column(Text, nullable=True)
    estado = Column(SQLEnum(EstadoSolicitudHHEE, native_enum=False, create_type=False), default=EstadoSolicitudHHEE.PENDIENTE)
    horas_aprobadas = Column(Float, nullable=True)
    comentario_supervisor = Column(Text, nullable=True)
    supervisor_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    fecha_decision = Column(DateTime(timezone=True), nullable=True)

    solicitante = relationship("Analista", foreign_keys=[analista_id], back_populates="solicitudes_realizadas")
    supervisor = relationship("Analista", foreign_keys=[supervisor_id], back_populates="solicitudes_gestionadas")