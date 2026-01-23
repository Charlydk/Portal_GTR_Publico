# sql_app/models.py
from sqlalchemy import (Column, Integer, String, Boolean, DateTime, ForeignKey, 
                        Enum as SQLEnum, Enum, Date, Time, Text, Float, Date, DateTime, TIMESTAMP, text)
from sqlalchemy.orm import relationship
from ..database import Base
from sqlalchemy import Table
from sqlalchemy.sql import func
from datetime import datetime, timezone
from ..enums import UserRole, ProgresoTarea, TipoIncidencia, EstadoIncidencia, TipoSolicitudHHEE, EstadoSolicitudHHEE, GravedadIncidencia

import sqlalchemy as sa

incidencias_lobs = Table('incidencias_lobs', Base.metadata,
    Column('incidencia_id', Integer, ForeignKey('incidencias.id'), primary_key=True),
    Column('lob_id', Integer, ForeignKey('lobs.id'), primary_key=True)
)

# --- Tabla de Asociación ---
analistas_campanas = Table(
    'analistas_campanas',
    Base.metadata,
    Column('analista_id', Integer, ForeignKey('analistas.id'), primary_key=True),
    Column('campana_id', Integer, ForeignKey('campanas.id'), primary_key=True)
)

# --- Modelos de la Aplicación ---

class Analista(Base):
    __tablename__ = "analistas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    apellido = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    bms_id = Column(Integer, unique=True, nullable=False)
    rut = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.ANALISTA)
    esta_activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    campanas_asignadas = relationship("Campana", secondary=analistas_campanas, back_populates="analistas_asignados")
    tareas = relationship("Tarea", back_populates="analista")
    avisos_creados = relationship("Aviso", back_populates="creador")
    acuses_recibo_avisos = relationship("AcuseReciboAviso", back_populates="analista")
    tareas_generadas_por_avisos = relationship("TareaGeneradaPorAviso", back_populates="analista_asignado")
    comentarios_generales_bitacora = relationship("ComentarioGeneralBitacora", back_populates="autor")
    incidencias_creadas = relationship("Incidencia", back_populates="creador", foreign_keys='Incidencia.creador_id')
    actualizaciones_incidencia_hechas = relationship("ActualizacionIncidencia", back_populates="autor")
    incidencias_asignadas = relationship("Incidencia", back_populates="asignado_a", foreign_keys='Incidencia.asignado_a_id')
    comentarios_tarea = relationship("ComentarioTarea", back_populates="autor")
    solicitudes_realizadas = relationship("SolicitudHHEE", back_populates="solicitante", foreign_keys="[SolicitudHHEE.analista_id]")
    solicitudes_gestionadas = relationship("SolicitudHHEE", back_populates="supervisor", foreign_keys="[SolicitudHHEE.supervisor_id]")
    sesiones = relationship("SesionCampana", back_populates="analista")

class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_inicio = Column(DateTime(timezone=True), nullable=True)
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    hora_inicio_semana = Column(Time, nullable=True)
    hora_fin_semana = Column(Time, nullable=True)
    hora_inicio_sabado = Column(Time, nullable=True)
    hora_fin_sabado = Column(Time, nullable=True)
    hora_inicio_domingo = Column(Time, nullable=True)
    hora_fin_domingo = Column(Time, nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    plantilla_defecto_id = Column(Integer, ForeignKey("plantillas_checklist.id"), nullable=True)
    lobs = relationship("LOB", back_populates="campana", cascade="all, delete-orphan")
    analistas_asignados = relationship("Analista", secondary=analistas_campanas, back_populates="campanas_asignadas")
    tareas = relationship("Tarea", back_populates="campana", cascade="all, delete-orphan")
    avisos = relationship("Aviso", back_populates="campana", cascade="all, delete-orphan")
    sesiones = relationship("SesionCampana", back_populates="campana")
    bitacora_entries = relationship("BitacoraEntry", back_populates="campana", cascade="all, delete-orphan")
    comentarios_generales = relationship("ComentarioGeneralBitacora", back_populates="campana", cascade="all, delete-orphan")
    incidencias = relationship("Incidencia", back_populates="campana", cascade="all, delete-orphan")
    plantilla_checklist = relationship("PlantillaChecklistItem", back_populates="campana", cascade="all, delete-orphan")
    plantilla_defecto = relationship("PlantillaChecklist")
    

class LOB(Base):
    __tablename__ = "lobs"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    
    # --- RELACIÓN CORREGIDA ---
    campana = relationship("Campana", back_populates="lobs")
    
    incidencias = relationship("Incidencia", secondary=incidencias_lobs, back_populates="lobs")

class Tarea(Base):
    __tablename__ = "tareas"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=False)
    progreso = Column(SQLEnum(ProgresoTarea), nullable=False, default=ProgresoTarea.PENDIENTE)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_finalizacion = Column(DateTime(timezone=True), nullable=True)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)
    
    analista = relationship("Analista", back_populates="tareas")
    campana = relationship("Campana", back_populates="tareas")
    checklist_items = relationship("ChecklistItem", back_populates="tarea", cascade="all, delete-orphan")
    historial_estados = relationship("HistorialEstadoTarea", back_populates="tarea_campana_rel", cascade="all, delete-orphan")
    comentarios = relationship("ComentarioTarea", back_populates="tarea", cascade="all, delete-orphan")
    es_generada_automaticamente = Column(Boolean, default=False)


class ChecklistItem(Base):
    __tablename__ = "checklist_items"
    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String, nullable=False)
    completado = Column(Boolean, default=False)
    hora_sugerida = Column(Time, nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_completado = Column(DateTime(timezone=True), nullable=True)
    tarea_id = Column(Integer, ForeignKey("tareas.id"), nullable=False)
    tarea = relationship("Tarea", back_populates="checklist_items")
    realizado_por_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    realizado_por = relationship("Analista")

class ComentarioGeneralBitacora(Base):
    __tablename__ = "comentarios_generales_bitacora"
    id = Column(Integer, primary_key=True, index=True)
    comentario = Column(String, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    autor_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    
    campana = relationship("Campana", back_populates="comentarios_generales")
    autor = relationship("Analista", back_populates="comentarios_generales_bitacora")

class Aviso(Base):
    __tablename__ = "avisos"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    contenido = Column(String, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    requiere_tarea = Column(Boolean, default=False)
    fecha_vencimiento_tarea = Column(DateTime(timezone=True), nullable=True)
    creador_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=True)

    creador = relationship("Analista", back_populates="avisos_creados")
    campana = relationship("Campana", back_populates="avisos")
    acuses_recibo = relationship("AcuseReciboAviso", back_populates="aviso", cascade="all, delete-orphan")
    tareas_generadas = relationship("TareaGeneradaPorAviso", back_populates="aviso_origen", cascade="all, delete-orphan")

class AcuseReciboAviso(Base):
    __tablename__ = "acuses_recibo_avisos"
    id = Column(Integer, primary_key=True, index=True)
    fecha_acuse = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    aviso_id = Column(Integer, ForeignKey("avisos.id"), nullable=False)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    
    aviso = relationship("Aviso", back_populates="acuses_recibo")
    analista = relationship("Analista", back_populates="acuses_recibo_avisos")

class BitacoraEntry(Base):
    __tablename__ = "bitacora_entries"
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, nullable=False)
    hora = Column(Time, nullable=False)
    comentario = Column(String, nullable=True)
    autor_id = Column(Integer, ForeignKey('analistas.id'), nullable=False)
    lob_id = Column(Integer, ForeignKey("lobs.id"), nullable=True)
    autor = relationship("Analista")
    fecha_creacion = Column(TIMESTAMP(timezone=True), nullable=False)
    fecha_ultima_actualizacion = Column(TIMESTAMP(timezone=True), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    campana = relationship("Campana", back_populates="bitacora_entries")
    lob = relationship("LOB")

class TareaGeneradaPorAviso(Base):
    __tablename__ = "tareas_generadas_por_avisos"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_vencimiento = Column(DateTime(timezone=True), nullable=True)
    progreso = Column(SQLEnum(ProgresoTarea), nullable=False, default=ProgresoTarea.PENDIENTE)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_finalizacion = Column(DateTime(timezone=True), nullable=True)
    analista_asignado_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    aviso_origen_id = Column(Integer, ForeignKey("avisos.id"), nullable=True)
    
    analista_asignado = relationship("Analista", back_populates="tareas_generadas_por_avisos")
    aviso_origen = relationship("Aviso", back_populates="tareas_generadas")
    historial_estados = relationship("HistorialEstadoTarea", back_populates="tarea_generada_rel", cascade="all, delete-orphan")

class HistorialEstadoTarea(Base):
    __tablename__ = "historial_estados_tarea"
    id = Column(Integer, primary_key=True, index=True)
    old_progreso = Column(SQLEnum(ProgresoTarea), nullable=True)
    new_progreso = Column(SQLEnum(ProgresoTarea), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    changed_by_analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    tarea_campana_id = Column(Integer, ForeignKey("tareas.id"), nullable=True)
    tarea_generada_id = Column(Integer, ForeignKey("tareas_generadas_por_avisos.id"), nullable=True)
    
    changed_by_analista = relationship("Analista")
    tarea_campana_rel = relationship("Tarea", back_populates="historial_estados")
    tarea_generada_rel = relationship("TareaGeneradaPorAviso", back_populates="historial_estados")

class Incidencia(Base):
    __tablename__ = "incidencias"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion_inicial = Column(Text, nullable=False)
    herramienta_afectada = Column(String, nullable=True)
    indicador_afectado = Column(String, nullable=True)
    tipo = Column(SQLEnum(TipoIncidencia, name="tipoincidencia_inc"), nullable=False)
    gravedad = Column(Enum(GravedadIncidencia, name="gravedadincidencia_enum", native_enum=False), nullable=False, default=GravedadIncidencia.MEDIA)
    estado = Column(SQLEnum(EstadoIncidencia), nullable=False, default=EstadoIncidencia.ABIERTA)
    fecha_apertura = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_cierre = Column(DateTime(timezone=True), nullable=True)
    asignado_a_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    creador_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    cerrado_por_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    cerrado_por = relationship("Analista", foreign_keys=[cerrado_por_id])
    creador = relationship("Analista", back_populates="incidencias_creadas", foreign_keys=[creador_id])
    asignado_a = relationship("Analista", back_populates="incidencias_asignadas", foreign_keys=[asignado_a_id])
    campana = relationship("Campana", back_populates="incidencias")
    actualizaciones = relationship("ActualizacionIncidencia", back_populates="incidencia", cascade="all, delete-orphan")
    lobs = relationship("LOB", secondary=incidencias_lobs, back_populates="incidencias")


class ActualizacionIncidencia(Base):
    __tablename__ = "actualizaciones_incidencia"
    id = Column(Integer, primary_key=True, index=True)
    comentario = Column(Text, nullable=False)
    fecha_actualizacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    incidencia_id = Column(Integer, ForeignKey("incidencias.id"), nullable=False)
    autor_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    
    incidencia = relationship("Incidencia", back_populates="actualizaciones")
    autor = relationship("Analista", back_populates="actualizaciones_incidencia_hechas")
    
class ComentarioTarea(Base):
    __tablename__ = "comentarios_tarea"
    id = Column(Integer, primary_key=True, index=True)
    texto = Column(Text, nullable=False)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    tarea_id = Column(Integer, ForeignKey("tareas.id"), nullable=False)
    autor_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)

    tarea = relationship("Tarea", back_populates="comentarios")
    autor = relationship("Analista", back_populates="comentarios_tarea")
    
class ValidacionHHEE(Base):
    __tablename__ = "validaciones_hhee"

    id = Column(Integer, primary_key=True, index=True)
    rut = Column(String, index=True, nullable=False)
    nombre_apellido = Column(String)
    campaña = Column(String, nullable=True)
    fecha_hhee = Column(Date, nullable=False, index=True)
    tipo_hhee = Column(String, nullable=True) # "Antes de Turno", "Después de Turno", "Día de Descanso"
    cantidad_hhee_declaradas = Column(Float, default=0.0)
    cantidad_hhee_aprobadas = Column(Float, default=0.0)
    estado = Column(String, default="No Guardado", index=True) # "Validado", "Pendiente por Corrección"
    notas = Column(String, nullable=True)
    supervisor_carga = Column(String)
    fecha_carga = Column(DateTime(timezone=True), server_default=func.now())
    # Campos de GV para referencia
    turno_teorico_inicio = Column(String, nullable=True)
    turno_teorico_fin = Column(String, nullable=True)
    marca_real_inicio = Column(String, nullable=True)
    marca_real_fin = Column(String, nullable=True)
    # campos para bandera de hhee enviadas a ADP
    reportado_a_rrhh = Column(Boolean, default=False, nullable=False, index=True)
    reportado_por_id = Column(Integer, ForeignKey('analistas.id'), nullable=True)
    fecha_reportado = Column(DateTime(timezone=True), nullable=True)
    reportado_por = relationship("Analista")
class SolicitudHHEE(Base):
    __tablename__ = 'solicitudes_hhee'

    id = Column(Integer, primary_key=True, index=True)
    
    # Datos de la solicitud
    fecha_hhee = Column(Date, nullable=False)
    tipo = Column(sa.Enum(TipoSolicitudHHEE), nullable=False)
    horas_solicitadas = Column(Float, nullable=False)
    justificacion = Column(Text, nullable=False)
    estado = Column(sa.Enum(EstadoSolicitudHHEE), nullable=False, default=EstadoSolicitudHHEE.PENDIENTE)
    fecha_solicitud = Column(DateTime(timezone=True), server_default=func.now())

    # Datos de la decisión del supervisor
    horas_aprobadas = Column(Float, nullable=True)
    comentario_supervisor = Column(Text, nullable=True)
    fecha_decision = Column(DateTime(timezone=True), nullable=True)

    # Relaciones con la tabla Analista
    analista_id = Column(Integer, ForeignKey('analistas.id'), nullable=False)
    supervisor_id = Column(Integer, ForeignKey('analistas.id'), nullable=True)

    solicitante = relationship("Analista", back_populates="solicitudes_realizadas", foreign_keys=[analista_id])
    supervisor = relationship("Analista", back_populates="solicitudes_gestionadas", foreign_keys=[supervisor_id])


# --- INICIO DE LA NUEVA SECCIÓN DE CHECKLIST DIARIO ---

class PlantillaChecklistItem(Base):
    __tablename__ = 'plantillas_checklist_items'

    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String, nullable=False)
    orden = Column(Integer, default=0) # Para ordenar los ítems en la plantilla
    hora_sugerida = Column(Time, nullable=True)
    
    campana_id = Column(Integer, ForeignKey('campanas.id'), nullable=False)
    campana = relationship("Campana", back_populates="plantilla_checklist")

    lunes = Column(Boolean, default=True)
    martes = Column(Boolean, default=True)
    miercoles = Column(Boolean, default=True)
    jueves = Column(Boolean, default=True)
    viernes = Column(Boolean, default=True)
    sabado = Column(Boolean, default=True)
    domingo = Column(Boolean, default=True)

class ChecklistDiarioItem(Base):
    __tablename__ = 'checklist_diario_items'

    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String, nullable=False) # Copiamos la descripción por si la plantilla cambia
    completado = Column(Boolean, default=False, nullable=False)
    fecha = Column(Date, nullable=False, index=True)
    
    # --- Relaciones ---
    analista_id = Column(Integer, ForeignKey('analistas.id'), nullable=False, index=True)
    analista = relationship("Analista")

    # Si el ítem viene de una plantilla, guardamos la referencia
    plantilla_item_id = Column(Integer, ForeignKey('plantillas_checklist_items.id'), nullable=True)
    plantilla_item = relationship("PlantillaChecklistItem")

class PlantillaChecklist(Base):
    __tablename__ = "plantillas_checklist"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    prioridad = Column(String, default="MEDIA")
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())

    # Relación con sus items
    items = relationship("ItemPlantillaChecklist", back_populates="plantilla", cascade="all, delete-orphan")
    
    # Relación inversa con campañas (Opcional, pero útil)
    campanas_asociadas = relationship("Campana", back_populates="plantilla_defecto")

class ItemPlantillaChecklist(Base):
    __tablename__ = "items_plantilla_checklist"

    id = Column(Integer, primary_key=True, index=True)
    plantilla_id = Column(Integer, ForeignKey("plantillas_checklist.id"), nullable=False)
    texto = Column(String, nullable=False)
    orden = Column(Integer, default=0)

    # Relación con la cabecera
    plantilla = relationship("PlantillaChecklist", back_populates="items")

class SesionCampana(Base):
    __tablename__ = "sesiones_campana"

    id = Column(Integer, primary_key=True, index=True)
    analista_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    fecha_inicio = Column(DateTime(timezone=True), server_default=func.now())
    fecha_fin = Column(DateTime(timezone=True), nullable=True) # Null = Sesión Activa

    # Relaciones
    analista = relationship("Analista", back_populates="sesiones")
    campana = relationship("Campana", back_populates="sesiones")