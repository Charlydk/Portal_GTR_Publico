// src/components/ListaAnalistas.jsx

import React from 'react'; // No necesitamos useState, useEffect, etc. aquí
import { Link } from 'react-router-dom';

// Este componente ahora recibe 'analistas' y 'onDelete' como props
function ListaAnalistas({ analistas, onDelete }) { 
  return (
    <table className="table table-striped table-hover">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Apellido</th>
          <th>Email</th>
          <th>ID BMS</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {analistas.map((analista) => (
          <tr key={analista.id}>
            <td>{analista.id}</td>
            <td>{analista.nombre}</td>
            <td>{analista.apellido}</td>
            <td>{analista.email}</td>
            <td>{analista.bms_id}</td>
            <td>
              <Link to={`/analistas/${analista.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
              <Link to={`/analistas/editar/${analista.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(analista.id)} // Usamos la prop onDelete
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

export default ListaAnalistas;