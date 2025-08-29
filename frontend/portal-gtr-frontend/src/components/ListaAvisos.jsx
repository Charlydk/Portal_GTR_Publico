// src/components/ListaAvisos.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function ListaAvisos({ avisos, onDelete }) {
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
    <table className="table table-striped table-hover">
      <thead>
        <tr>
          <th>ID</th>
          <th>Título</th>
          <th>Contenido</th>
          <th>Fecha Vencimiento</th>
          <th>Creador</th>
          <th>Campaña</th>
          <th>Fecha Creación</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {avisos.map((aviso) => (
          <tr key={aviso.id}>
            <td>{aviso.id}</td>
            <td>{aviso.titulo}</td>
            <td>{aviso.contenido.substring(0, 50)}...</td>
            <td>{formatDateTime(aviso.fecha_vencimiento)}</td>
            <td>{aviso.creador ? `${aviso.creador.nombre} ${aviso.creador.apellido}` : `ID: ${aviso.creador_id}`}</td>
            <td>{aviso.campana ? aviso.campana.nombre : 'N/A'}</td>
            <td>{formatDateTime(aviso.fecha_creacion)}</td>
            <td>
                <Link to={`/avisos/${aviso.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
                <Link to={`/avisos/editar/${aviso.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                <button
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(aviso.id)}
                >
                Eliminar
                </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ListaAvisos;
