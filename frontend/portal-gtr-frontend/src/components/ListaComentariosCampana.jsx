// src/components/ListaComentariosCampana.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function ListaComentariosCampana({ comentarios, onDeleteComentario }) {
  if (!comentarios || comentarios.length === 0) {
    return <p className="mt-3 text-muted">No hay comentarios para esta campaña.</p>;
  }

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
    <div className="list-group">
      {comentarios.map((comentario) => (
        <div key={comentario.id} className="list-group-item list-group-item-action flex-column align-items-start">
          <div className="d-flex w-100 justify-content-between">
            {/* Aquí asumimos que el objeto 'analista' viene anidado en el comentario.
                Si no es así, necesitaríamos cargar el analista por su ID.
                Por ahora, usamos analista_id y puedes mostrar el nombre si lo cargas. */}
            <h5 className="mb-1">Comentario de Analista ID: {comentario.analista_id}</h5> 
            <small className="text-muted">{formatDateTime(comentario.fecha_creacion)}</small>
          </div>
          <p className="mb-1">{comentario.contenido}</p>
          <div className="d-flex justify-content-end">
            {/* Botón de eliminar comentario */}
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onDeleteComentario(comentario.id)}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ListaComentariosCampana;
