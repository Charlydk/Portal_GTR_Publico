// RUTA: src/pages/CampanasPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GTR_API_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';

function CampanasPage() {
  const [campanas, setCampanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); 

  const fetchCampanas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`${GTR_API_URL}/campanas/`);
      if (!response.ok) {
        if (response.status === 401) throw new Error("No autorizado. Por favor, inicie sesión.");
        if (response.status === 403) throw new Error("Acceso denegado.");
        throw new Error(`Error al cargar campañas: ${response.statusText}`);
      }
      const data = await response.json();
      setCampanas(data);
    } catch (err) {
      console.error("Error al obtener campañas:", err);
      setError(err.message || "No se pudo cargar la lista de campañas.");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchCampanas();
    } else {
      setLoading(false);
      setError("Necesita iniciar sesión para ver las campañas.");
    }
  }, [authToken, fetchCampanas]);

  const handleEliminarCampana = async (campanaId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta campaña? Esta acción es irreversible.')) {
      return;
    }
    try {
      const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${campanaId}`);
      if (!response.ok) {
        throw new Error("Error al eliminar campaña.");
      }
      alert('Campaña eliminada con éxito.');
      fetchCampanas(); 
    } catch (err) {
      console.error("Error al eliminar campaña:", err);
      setError(err.message || "No se pudo eliminar la campaña.");
    }
  };

  if (loading) return <div className="container mt-4 text-center"><div className="spinner-border text-primary" role="status"></div></div>;

  if (error) return <div className="container mt-4"><div className="alert alert-danger">{error}</div></div>;

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Lista de Campañas</h2>
      {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
        <Link to="/campanas/crear" className="btn btn-primary mb-3">
          Crear Nueva Campaña
        </Link>
      )}
      
      <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Horario Operativo</th> {/* NUEVA COLUMNA */}
              <th>Fecha Fin Contrato</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {campanas.map((campana) => (
              <tr key={campana.id}>
                <td>{campana.id}</td>
                <td className="fw-bold">{campana.nombre}</td>
                
                {/* --- NUEVA CELDA DE HORARIO --- */}
                <td>
                    {campana.hora_inicio_operacion ? (
                        <span className="badge bg-secondary">
                            🕒 {campana.hora_inicio_operacion.substring(0, 5)} - {campana.hora_fin_operacion ? campana.hora_fin_operacion.substring(0, 5) : '??'}
                        </span>
                    ) : (
                        <span className="text-muted small">Sin definir</span>
                    )}
                </td>
                
                <td>{campana.fecha_fin ? new Date(campana.fecha_fin).toLocaleDateString() : 'Indefinido'}</td>
                
                <td>
                  <Link to={`/campanas/${campana.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
                  {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                    <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                  )}
                  {user && user.role === 'SUPERVISOR' && (
                    <button
                      onClick={() => handleEliminarCampana(campana.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CampanasPage;