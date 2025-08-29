// src/pages/EditarAvisoPage.jsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function EditarAvisoPage() {
  const { avisoId } = useParams(); // Para obtener el ID del aviso de la URL
  const navigate = useNavigate();

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Editar Aviso {avisoId ? `ID: ${avisoId}` : ''}</h2>
      <div className="alert alert-info" role="alert">
        Este es un componente de marcador de posición para Editar Aviso.
        Aquí irá la lógica para cargar y editar los detalles del aviso.
      </div>
      <button onClick={() => navigate(-1)} className="btn btn-secondary mt-3">Volver</button>
    </div>
  );
}

export default EditarAvisoPage;
