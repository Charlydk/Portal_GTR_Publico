// src/pages/AvisosPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GTR_API_URL } from '../api'; // <-- CAMBIO
import { useAuth } from '../hooks/useAuth';
import { Button, Spinner, Alert, Table } from 'react-bootstrap';
import { formatDateTime } from '../utils/dateFormatter';


function AvisosPage() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth();

  const fetchAvisos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${GTR_API_URL}/avisos/`, { // <-- CAMBIO
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para ver los avisos.");
        }
        throw new Error(`Error al cargar avisos: ${response.statusText}`);
      }
      const data = await response.json();
      setAvisos(data);
    } catch (err) {
      console.error("Error al obtener avisos:", err);
      setError(err.message || "No se pudo cargar la lista de avisos.");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      fetchAvisos();
    } else {
      setLoading(false);
      setError("Necesita iniciar sesión para ver los avisos.");
    }
  }, [authToken, fetchAvisos]);

  const handleEliminarAviso = async (avisoId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este aviso? Esta acción es irreversible.')) {
      return;
    }
    try {
      const response = await fetch(`${GTR_API_URL}/avisos/${avisoId}`, { // <-- CAMBIO
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error al eliminar aviso: ${response.statusText}`);
      }

      alert('Aviso eliminado con éxito.');
      fetchAvisos();
    } catch (err) {
      console.error("Error al eliminar aviso:", err);
      alert(err.message || "No se pudo eliminar el aviso.");
    }
  };

  /*const formatDateTime = (apiDateString) => {
    if (!apiDateString) return 'N/A';
    const date = new Date(apiDateString + 'Z');
    if (isNaN(date.getTime())) return 'Fecha inválida';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  };*/

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando avisos...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Lista de Avisos</h2>
      {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
        <Link to="/avisos/crear" className="btn btn-primary mb-3">
          Crear Nuevo Aviso
        </Link>
      )}
      
      <div className="table-responsive">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Creador</th>
              <th>Campaña</th>
              <th>Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {avisos.map((aviso) => (
              <tr key={aviso.id}>
                <td>{aviso.id}</td>
                <td>{aviso.titulo}</td>
                <td>{aviso.creador ? `${aviso.creador.nombre} ${aviso.creador.apellido}` : 'N/A'}</td>
                <td>{aviso.campana ? aviso.campana.nombre : 'General'}</td>
                <td>{formatDateTime(aviso.fecha_vencimiento)}</td>
                <td>
                  <Link to={`/avisos/${aviso.id}`} className="btn btn-info btn-sm me-2">Ver</Link>
                  {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                    <Link to={`/avisos/editar/${aviso.id}`} className="btn btn-warning btn-sm me-2">Editar</Link>
                  )}
                  {user && user.role === 'SUPERVISOR' && (
                    <Button
                      onClick={() => handleEliminarAviso(aviso.id)}
                      variant="danger"
                      size="sm"
                    >
                      Eliminar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export default AvisosPage;