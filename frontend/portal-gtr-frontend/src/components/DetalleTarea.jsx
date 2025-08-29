// src/components/DetalleTarea.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function DetalleTarea({ tarea }) { // Este componente recibe 'tarea' como una prop
  // Una pequeña verificación por si la prop tarea aún no llegó (aunque DetalleTareaPage ya lo maneja)
  if (!tarea) {
    return <p className="container mt-4">Cargando detalles de la tarea...</p>;
  }

  return (
    <div className="container mt-4">
      <h3>Detalles de la Tarea: {tarea.titulo}</h3>
      <hr />
      <p><strong>Descripción:</strong> {tarea.descripcion}</p>
      <p>
        <strong>Fecha de Vencimiento:</strong>{' '}
        {tarea.fecha_vencimiento ? new Date(tarea.fecha_vencimiento).toLocaleDateString('es-AR') : 'N/A'}
      </p>
      <p><strong>Progreso:</strong> {tarea.progreso.replace('_', ' ')}</p>
      <p>
        <strong>Fecha de Creación:</strong>{' '}
        {new Date(tarea.fecha_creacion).toLocaleDateString('es-AR')}
      </p>

      {/*
        ¡Aquí está la corrección clave!
        Accedemos a las propiedades 'nombre', 'apellido', 'email', 'bms_id'
        dentro del objeto anidado 'tarea.analista'.
        Y a 'nombre', 'descripcion', 'fecha_inicio', 'fecha_fin'
        dentro del objeto anidado 'tarea.campana'.
        Usamos '?. ' (optional chaining) para protegernos si el objeto es nulo/undefined.
      */}
      <p>
        <strong>Analista Asignado:</strong>{' '}
        {tarea.analista ? `${tarea.analista.nombre} ${tarea.analista.apellido} (${tarea.analista.email})` : 'Desconocido'}
      </p>
      <p>
        <strong>ID BMS Analista:</strong>{' '}
        {tarea.analista?.bms_id || 'N/A'}
      </p>
      <p>
        <strong>Campaña Asociada:</strong>{' '}
        {tarea.campana ? `${tarea.campana.nombre} (${tarea.campana.descripcion || 'Sin descripción'})` : 'Desconocida'}
      </p>
      <p>
        <strong>Inicio de Campaña:</strong>{' '}
        {tarea.campana?.fecha_inicio ? new Date(tarea.campana.fecha_inicio).toLocaleDateString('es-AR') : 'N/A'}
      </p>
      <p>
        <strong>Fin de Campaña:</strong>{' '}
        {tarea.campana?.fecha_fin ? new Date(tarea.campana.fecha_fin).toLocaleDateString('es-AR') : 'N/A'}
      </p>

      {/* Botones de navegación */}
      <div className="mt-4">
        <Link to="/tareas" className="btn btn-secondary me-2">Volver a la lista</Link>
        <Link to={`/tareas/editar/${tarea.id}`} className="btn btn-warning">Editar Tarea</Link>
      </div>
    </div>
  );
}

export default DetalleTarea;