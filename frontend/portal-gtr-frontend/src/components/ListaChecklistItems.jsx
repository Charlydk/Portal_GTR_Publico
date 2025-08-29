// src/components/ListaChecklistItems.jsx

import React from 'react';
import { Link } from 'react-router-dom';

// Este componente recibe los ítems de checklist y las funciones de manejo
function ListaChecklistItems({ checklistItems, onDeleteItem }) {
  if (!checklistItems || checklistItems.length === 0) {
    return <p className="mt-3 text-muted">No hay ítems de checklist para esta tarea.</p>;
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
    <div className="table-responsive">
      <table className="table table-striped table-sm">
        <thead>
          <tr>
            <th>ID</th>
            <th>Descripción</th>
            <th>Completado</th>
            <th>Fecha Creación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {checklistItems.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.descripcion}</td>
              <td>{item.completado ? 'Sí' : 'No'}</td>
              <td>{formatDateTime(item.fecha_creacion)}</td>
              <td>
                {/* Link para editar el ítem de checklist */}
                <Link to={`/tareas/${item.tarea_id}/checklist-items/editar/${item.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                {/* Botón de eliminar (opcional, si lo implementas en el futuro) */}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onDeleteItem(item.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListaChecklistItems;
