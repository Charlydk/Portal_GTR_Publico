// src/components/DetalleCampana.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function DetalleCampana({ campana }) {
  // Verificación básica por si la prop campana es nula
  if (!campana) {
    return <p className="container mt-4">No hay datos de campaña para mostrar.</p>;
  }

  // Función auxiliar para formatear fechas
  const formatDateTime = (apiDateString) => {
    // Si no hay fecha, devuelve N/A
    if (!apiDateString) {
        return 'N/A';
    }

    // --- LA CORRECCIÓN DEFINITIVA ---
    // Le añadimos la 'Z' al final para forzar a que JavaScript
    // interprete el string como una fecha en formato UTC universal.
    const date = new Date(apiDateString + 'Z');
    // --------------------------------

    // Verificamos si la fecha parseada es válida
    if (isNaN(date.getTime())) {
        return 'Fecha inválida';
    }

    // A partir de aquí, el resto del código funciona como se espera
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son de 0 a 11
    const year = date.getFullYear();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};

  return (
    <div className="container mt-4">
      <h3>Detalles de la Campaña: {campana.nombre}</h3>
      <hr />
      <p><strong>ID:</strong> {campana.id}</p>
      <p><strong>Nombre:</strong> {campana.nombre}</p>
      <p><strong>Descripción:</strong> {campana.descripcion || 'N/A'}</p>
      <p><strong>Fecha de Inicio:</strong> {formatDateTime(campana.fecha_inicio)}</p>
      <p><strong>Fecha de Fin:</strong> {formatDateTime(campana.fecha_fin)}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(campana.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/campanas" className="btn btn-secondary me-2">Volver a la lista de Campañas</Link>
        <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning">Editar Campaña</Link>
      </div>
    </div>
  );
}

export default DetalleCampana;
