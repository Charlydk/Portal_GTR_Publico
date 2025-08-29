# sql_app/models.py
from sqlalchemy import (Column, Integer, String, Boolean, DateTime, ForeignKey, 
                        Enum as SQLEnum, Date, Time, Text, Float, Date, DateTime)
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Table
from sqlalchemy.sql import func
from datetime import datetime, timezone

from enums import UserRole, ProgresoTarea, TipoIncidencia, EstadoIncidencia

Base = declarative_base()

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



class Campana(Base):
    __tablename__ = "campanas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)
    fecha_inicio = Column(DateTime(timezone=True), nullable=True)
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    analistas_asignados = relationship("Analista", secondary=analistas_campanas, back_populates="campanas_asignadas")
    tareas = relationship("Tarea", back_populates="campana", cascade="all, delete-orphan")
    avisos = relationship("Aviso", back_populates="campana", cascade="all, delete-orphan")
    bitacora_entries = relationship("BitacoraEntry", back_populates="campana", cascade="all, delete-orphan")
    comentarios_generales = relationship("ComentarioGeneralBitacora", back_populates="campana", cascade="all, delete-orphan")
    incidencias = relationship("Incidencia", back_populates="campana", cascade="all, delete-orphan")

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


class ChecklistItem(Base):
    __tablename__ = "checklist_items"
    id = Column(Integer, primary_key=True, index=True)
    descripcion = Column(String, nullable=False)
    completado = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    tarea_id = Column(Integer, ForeignKey("tareas.id"), nullable=False)
    tarea = relationship("Tarea", back_populates="checklist_items")

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
    fecha_creacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_ultima_actualizacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    
    campana = relationship("Campana", back_populates="bitacora_entries")

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
    estado = Column(SQLEnum(EstadoIncidencia), nullable=False, default=EstadoIncidencia.ABIERTA)
    fecha_apertura = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_cierre = Column(DateTime(timezone=True), nullable=True)
    asignado_a_id = Column(Integer, ForeignKey("analistas.id"), nullable=True)
    creador_id = Column(Integer, ForeignKey("analistas.id"), nullable=False)
    campana_id = Column(Integer, ForeignKey("campanas.id"), nullable=False)
    
    creador = relationship("Analista", back_populates="incidencias_creadas", foreign_keys=[creador_id])
    asignado_a = relationship("Analista", back_populates="incidencias_asignadas", foreign_keys=[asignado_a_id])
    campana = relationship("Campana", back_populates="incidencias")
    actualizaciones = relationship("ActualizacionIncidencia", back_populates="incidencia", cascade="all, delete-orphan")

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