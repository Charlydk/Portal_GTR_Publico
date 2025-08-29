// src/components/DetalleAnalista.jsx

import React from 'react';
import { Link } from 'react-router-dom';

function DetalleAnalista({ analista }) {
  // Verificación básica por si la prop analista es nula
  if (!analista) {
    return <p className="container mt-4">No hay datos de analista para mostrar.</p>;
  }

  return (
    <div className="container mt-4">
      <h3>Detalles del Analista: {analista.nombre} {analista.apellido}</h3>
      <hr />
      <p><strong>ID:</strong> {analista.id}</p>
      <p><strong>Nombre Completo:</strong> {analista.nombre} {analista.apellido}</p>
      <p><strong>Email:</strong> {analista.email}</p>
      <p><strong>ID BMS:</strong> {analista.bms_id}</p>
      {/* Puedes agregar más campos si tu modelo de analista los tiene */}

      <div className="mt-4">
        <Link to="/analistas" className="btn btn-secondary me-2">Volver a la lista de Analistas</Link>
        <Link to={`/analistas/editar/${analista.id}`} className="btn btn-warning">Editar Analista</Link>
      </div>
    </div>
  );
}

export default DetalleAnalista;