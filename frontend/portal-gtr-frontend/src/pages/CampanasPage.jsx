// src/pages/CampanasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth'; // Importa useAuth

function CampanasPage() {
  const [campanas, setCampanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Función para obtener las campañas
  const fetchCampanas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios.");
        }
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
  }, [authToken]); // Vuelve a ejecutar cuando el token cambie

  // Efecto para cargar las campañas al montar el componente o cuando el token cambia
  useEffect(() => {
    if (authToken) {
      fetchCampanas();
    } else {
      setLoading(false);
      setError("Necesita iniciar sesión para ver las campañas.");
    }
  }, [authToken, fetchCampanas]);

  // Función para manejar la eliminación de una campaña
  const handleEliminarCampana = async (campanaId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta campaña? Esta acción es irreversible.')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado para eliminar campañas. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para eliminar campañas.");
        }
        throw new Error(`Error al eliminar campaña: ${response.statusText}`);
      }

      alert('Campaña eliminada con éxito.');
      fetchCampanas(); // Recargar la lista de campañas
    } catch (err) {
      console.error("Error al eliminar campaña:", err);
      setError(err.message || "No se pudo eliminar la campaña.");
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando campañas...</span>
        </div>
        <p>Cargando lista de campañas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        {!authToken && (
          <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
        )}
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Lista de Campañas</h2>
      {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
        <Link to="/campanas/crear" className="btn btn-primary mb-3">
          Crear Nueva Campaña
        </Link>
      )}
      
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Fecha Inicio</th>
              <th>Fecha Fin</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {campanas.map((campana) => (
              <tr key={campana.id}>
                <td>{campana.id}</td>
                <td>{campana.nombre}</td>
                <td>{campana.descripcion || 'N/A'}</td>
                <td>{new Date(campana.fecha_inicio).toLocaleDateString()}</td>
                <td>{campana.fecha_fin ? new Date(campana.fecha_fin).toLocaleDateString() : 'N/A'}</td>
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
