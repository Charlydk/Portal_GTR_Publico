// src/pages/DetalleTareaGeneradaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import HistorialTarea from '../components/HistorialTarea';

function DetalleTareaGeneradaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authToken, user, loading: authLoading } = useAuth();

  const [tarea, setTarea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [historial, setHistorial] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState(null);

  const fetchTarea = useCallback(async () => {
    if (!authToken || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tareas_generadas_por_avisos/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar la tarea: ${response.statusText}`);
      }
      const data = await response.json();
      setTarea(data);
    } catch (err) {
      console.error("Error fetching tarea generada:", err);
      setError(err.message || "No se pudo cargar la tarea generada.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken, user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTarea();
    }
  }, [authLoading, user, fetchTarea]);


  const handleFetchHistorial = async () => {
    if (showHistorial) {
      setShowHistorial(false);
      return;
    }
    setLoadingHistorial(true);
    setErrorHistorial(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tareas_generadas_por_avisos/${id}/historial_estados`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "No se pudo cargar el historial.");
      }
      const data = await response.json();
      setHistorial(data);
      setShowHistorial(true);
    } catch (error) {
      setErrorHistorial(error.message);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleMarcarCompletada = async () => {
    if (!authToken || !user || !tarea) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/tareas_generadas_por_avisos/${tarea.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ progreso: 'COMPLETADA' }), // Solo actualizamos el progreso
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al marcar como completada: ${response.statusText}`);
      }

      const updatedTarea = await response.json();
      setTarea(updatedTarea); // Actualizar el estado local con la tarea modificada
      setSuccess("Tarea marcada como COMPLETADA con éxito!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error al marcar tarea como completada:", err);
      setError(err.message || "No se pudo marcar la tarea como completada.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

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

  if (authLoading || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando detalles de la tarea...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Error al cargar la tarea</Alert.Heading>
          <p>{error}</p>
          <Button onClick={() => navigate('/dashboard')}>Volver al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  if (!tarea) {
    return (
      <Container className="mt-4">
        <Alert variant="info">
          <Alert.Heading>Tarea no encontrada</Alert.Heading>
          <p>La tarea generada que buscas no existe o no tienes permiso para verla.</p>
          <Button onClick={() => navigate('/dashboard')}>Volver al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  // Permisos: Solo el analista asignado o un supervisor/responsable pueden ver/gestionar esta tarea
  const canViewTask = user && (
    user.id === tarea.analista_asignado.id || 
    user.role === 'SUPERVISOR' || 
    user.role === 'RESPONSABLE'
  );

  if (!canViewTask) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Acceso Denegado</Alert.Heading>
          <p>No tienes los permisos necesarios para ver esta tarea.</p>
          <Button onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="shadow-lg p-4">
        <h2 className="text-center mb-4 text-primary">Detalles de Tarea Generada por Aviso</h2>

        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        <Card.Body>
          <Card.Title className="mb-3">{tarea.titulo}</Card.Title>
          <Card.Text>
            <strong>Descripción:</strong> {tarea.descripcion || 'N/A'}
          </Card.Text>
          <Card.Text>
            <strong>Asignado a:</strong> {tarea.analista_asignado?.nombre} {tarea.analista_asignado?.apellido} (BMS ID: {tarea.analista_asignado?.bms_id})
          </Card.Text>
          <Card.Text>
            <strong>Estado:</strong> <Badge bg={tarea.progreso === 'PENDIENTE' ? 'danger' : 'success'}>{tarea.progreso}</Badge>
          </Card.Text>
          <Card.Text>
            <strong>Fecha de Creación:</strong> {formatDateTime(tarea.fecha_creacion)}
          </Card.Text>
          <Card.Text>
            <strong>Fecha de Vencimiento:</strong> {formatDateTime(tarea.fecha_vencimiento)}
          </Card.Text>
          {tarea.aviso_origen && (
            <Card.Text>
              <strong>Aviso de Origen:</strong> <a href={`/avisos/${tarea.aviso_origen.id}`}>{tarea.aviso_origen.titulo}</a>
            </Card.Text>
          )}

          {tarea.progreso === 'PENDIENTE' && (
            <div className="d-grid gap-2 mt-4">
              <Button
                variant="success"
                onClick={handleMarcarCompletada}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    {' '}
                    Marcando como Completada...
                  </>
                ) : (
                  'Marcar como Completada'
                )}
              </Button>
            </div>
          )}
          <div className="d-grid gap-2 mt-2">

            <Button variant="info" onClick={handleFetchHistorial} disabled={loadingHistorial}>
              {loadingHistorial ? 'Cargando...' : showHistorial ? 'Ocultar Historial' : 'Ver Historial'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/dashboard')} disabled={submitting}>
              Volver al Dashboard
            </Button>
          </div>

          {showHistorial && (
            <HistorialTarea historial={historial} isLoading={loadingHistorial} error={errorHistorial} />
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}

export default DetalleTareaGeneradaPage;
