// src/components/ListaAcusesRecibo.jsx

import React from 'react';

function ListaAcusesRecibo({ acusesRecibo }) {
  if (!acusesRecibo || acusesRecibo.length === 0) {
    return <p className="mt-3 text-muted">No hay acuses de recibo para este aviso.</p>;
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
    <div className="table-responsive">
      <table className="table table-striped table-sm">
        <thead>
          <tr>
            <th>ID Acuse</th>
            <th>Analista</th>
            <th>Fecha de Acuse</th>
          </tr>
        </thead>
        <tbody>
          {acusesRecibo.map((acuse) => (
            <tr key={acuse.id}>
              <td>{acuse.id}</td>
              <td>{acuse.analista ? `${acuse.analista.nombre} ${acuse.analista.apellido}` : `ID: ${acuse.analista_id}`}</td>
              <td>{formatDateTime(acuse.fecha_acuse)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ListaAcusesRecibo;
