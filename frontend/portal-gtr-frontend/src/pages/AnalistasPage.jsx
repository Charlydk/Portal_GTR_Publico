// src/pages/AnalistasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
function AnalistasPage() {
  const [analistas, setAnalistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // ¡NUEVO! Obtiene authToken y user del contexto

  // Función para obtener los analistas
  const fetchAnalistas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/analistas/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        // Manejo de errores más específico para 401/403
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios.");
        }
        throw new Error(`Error al cargar analistas: ${response.statusText}`);
      }
      const data = await response.json();
      setAnalistas(data);
    } catch (err) {
      console.error("Error al obtener analistas:", err);
      setError(err.message || "No se pudo cargar la lista de analistas.");
    } finally {
      setLoading(false);
    }
  }, [authToken]); // Vuelve a ejecutar cuando el token cambie

  // Efecto para cargar los analistas al montar el componente o cuando el token cambia
  useEffect(() => {
    // Solo intenta cargar analistas si hay un token disponible
    if (authToken) {
      fetchAnalistas();
    } else {
      // Si no hay token, y no estamos cargando (ej. al inicio), mostramos un mensaje
      setLoading(false);
      setError("Necesita iniciar sesión para ver los analistas.");
    }
  }, [authToken, fetchAnalistas]);

  // Función para manejar la desactivación de un analista
  const handleDesactivarAnalista = async (analistaId) => {
    if (!window.confirm('¿Está seguro de que desea desactivar este analista?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/analistas/${analistaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado para desactivar analistas. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para desactivar analistas.");
        }
        throw new Error(`Error al desactivar analista: ${response.statusText}`);
      }

      alert('Analista desactivado con éxito.');
      fetchAnalistas(); // Recargar la lista de analistas
    } catch (err) {
      console.error("Error al desactivar analista:", err);
      setError(err.message || "No se pudo desactivar el analista.");
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando analistas...</span>
        </div>
        <p>Cargando lista de analistas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        {/* Aquí puedes añadir un botón para ir al login si el error es 401 */}
        {!authToken && (
          <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
        )}
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Lista de Analistas</h2>
      {/* Solo permite crear analistas si el usuario actual es Supervisor o Responsable */}
      {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
        <Link to="/analistas/crear" className="btn btn-primary mb-3">
          Crear Nuevo Analista
        </Link>
      )}
      
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Email</th>
              <th>BMS ID</th>
              <th>Rol</th>
              <th>Activo</th>
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
                <td>{analista.role}</td>
                <td>{analista.esta_activo ? 'Sí' : 'No'}</td>
                <td>
                  <Link to={`/analistas/${analista.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
                  {/* Solo permite editar si el usuario actual es Supervisor o Responsable */}
                  {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                    <Link to={`/analistas/editar/${analista.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                  )}
                  {/* Solo permite desactivar si el usuario actual es Supervisor */}
                  {user && user.role === 'SUPERVISOR' && analista.esta_activo && (
                    <button
                      onClick={() => handleDesactivarAnalista(analista.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Desactivar
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

export default AnalistasPage;
