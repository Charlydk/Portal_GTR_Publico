// src/components/DetalleAviso.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function DetalleAviso({ aviso }) {
  // Basic check if the notice prop is null
  if (!aviso) {
    return <p className="container mt-4">No hay datos de aviso para mostrar.</p>;
  }

  // Auxiliary function to format dates
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
      <h3>Detalles del Aviso: {aviso.titulo}</h3>
      <hr />
      <p><strong>ID:</strong> {aviso.id}</p>
      <p><strong>Título:</strong> {aviso.titulo}</p>
      <p><strong>Contenido:</strong> {aviso.contenido}</p>
      <p><strong>Fecha de Vencimiento:</strong> {formatDateTime(aviso.fecha_vencimiento)}</p>
      {/* Display creator's name if available, otherwise just ID */}
      <p><strong>Creador:</strong> {aviso.creador ? `${aviso.creador.nombre} ${aviso.creador.apellido}` : `ID: ${aviso.creador_id}`}</p>
      {/* Display campaign name if available, otherwise just ID or N/A */}
      <p><strong>Campaña Asociada:</strong> {aviso.campana ? aviso.campana.nombre : 'N/A'}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(aviso.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/avisos" className="btn btn-secondary me-2">Volver a la lista de Avisos</Link>
        <Link to={`/avisos/editar/${aviso.id}`} className="btn btn-warning">Editar Aviso</Link>
      </div>
    </div>
  );
}

export default DetalleAviso;
