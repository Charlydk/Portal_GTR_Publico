// src/components/ListaCampanas.jsx

import React from 'react';
import { Link } from 'react-router-dom';

// Este componente ahora recibe solo 'campanas' como prop
function ListaCampanas({ campanas }) {
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
    <table className="table table-striped table-hover">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Descripción</th>
          <th>Fecha de Inicio</th>
          <th>Fecha de Fin</th>
          <th>Fecha de Creación</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {campanas.map((campana) => (
          <tr key={campana.id}>
            <td>{campana.id}</td>
            <td>{campana.nombre}</td>
            <td>{campana.descripcion || 'N/A'}</td>
            <td>{formatDateTime(campana.fecha_inicio)}</td>
            <td>{formatDateTime(campana.fecha_fin)}</td>
            <td>{formatDateTime(campana.fecha_creacion)}</td>
            <td>
              <Link to={`/campanas/${campana.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
              <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning btn-sm">Editar</Link>
              {/* NOTA: El botón de "Eliminar" ha sido ELIMINADO de este componente */}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ListaCampanas;
