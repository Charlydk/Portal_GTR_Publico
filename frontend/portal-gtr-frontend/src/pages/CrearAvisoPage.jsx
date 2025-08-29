// src/pages/CrearAvisoPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

function CrearAvisoPage() {
  const navigate = useNavigate();

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Crear Nuevo Aviso</h2>
      <div className="alert alert-info" role="alert">
        Este es un componente de marcador de posición para Crear Aviso.
        Aquí irá la lógica para el formulario de creación de avisos.
      </div>
      <button onClick={() => navigate(-1)} className="btn btn-secondary mt-3">Volver</button>
    </div>
  );
}

export default CrearAvisoPage;
