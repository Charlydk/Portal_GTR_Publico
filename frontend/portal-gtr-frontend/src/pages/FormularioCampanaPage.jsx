// src/pages/FormularioCampanaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Form, Button, Alert, Spinner, Card } from 'react-bootstrap';

function FormularioCampanaPage() {
  const { id } = useParams(); // Para el caso de edición
  const navigate = useNavigate();
  const { authToken, user } = useAuth();
  const isEditing = !!id; // Determina si estamos editando o creando

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Función para formatear fechas a YYYY-MM-DD para input type="date"
  const formatDateForInput = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toISOString().split('T')[0];
  };

  // Cargar datos de la campaña si estamos editando
  const fetchCampana = useCallback(async () => {
    if (!isEditing || !authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Error al cargar la campaña: ${response.statusText}`);
      }
      const data = await response.json();
      setNombre(data.nombre);
      setDescripcion(data.descripcion || '');
      setFechaInicio(formatDateForInput(data.fecha_inicio));
      setFechaFin(formatDateForInput(data.fecha_fin));
    } catch (err) {
      console.error("Error al obtener campaña:", err);
      setError(err.message || "No se pudo cargar la campaña.");
    } finally {
      setLoading(false);
    }
  }, [id, isEditing, authToken]);

  useEffect(() => {
    fetchCampana();
  }, [fetchCampana]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!user || !authToken) {
      setError("Necesita iniciar sesión para realizar esta acción.");
      setSubmitting(false);
      return;
    }

    const campanaData = {
      nombre,
      descripcion: descripcion || null, // Asegura que sea null si está vacío
      fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : null,
      fecha_fin: fechaFin ? new Date(fechaFin).toISOString() : null,
    };

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_BASE_URL}/campanas/${id}` : `${API_BASE_URL}/campanas/`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(campanaData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} la campaña: ${response.statusText}`);
      }

      const result = await response.json();
      setSuccess(`Campaña ${isEditing ? 'actualizada' : 'creada'} con éxito!`);

      // ¡CORRECCIÓN CLAVE AQUÍ!
      // Redirigir a la página de detalles de la campaña recién creada/actualizada
      setTimeout(() => {
        navigate(`/campanas/${result.id}`); // Usamos result.id para la redirección
      }, 1500);

    } catch (err) {
      console.error(`Error al ${isEditing ? 'actualizar' : 'crear'} campaña:`, err);
      setError(err.message || `Hubo un error al ${isEditing ? 'actualizar' : 'crear'} la campaña.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando datos de la campaña...</p>
      </Container>
    );
  }

  // Permisos de rol para crear/editar campañas
  const canManageCampaigns = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');

  if (!canManageCampaigns) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Acceso Denegado</Alert.Heading>
          <p>No tienes los permisos necesarios para {isEditing ? 'editar' : 'crear'} campañas.</p>
          <Button onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="shadow-lg p-4">
        <h2 className="text-center mb-4 text-primary">
          {isEditing ? 'Editar Campaña' : 'Crear Nueva Campaña'}
        </h2>

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="nombre">Nombre de la Campaña:</Form.Label>
            <Form.Control
              type="text"
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              disabled={submitting}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label htmlFor="descripcion">Descripción:</Form.Label>
            <Form.Control
              as="textarea"
              id="descripcion"
              rows="3"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={submitting}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label htmlFor="fechaInicio">Fecha de Inicio:</Form.Label>
            <Form.Control
              type="date"
              id="fechaInicio"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              disabled={submitting}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label htmlFor="fechaFin">Fecha de Fin:</Form.Label>
            <Form.Control
              type="date"
              id="fechaFin"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              disabled={submitting}
            />
          </Form.Group>

          <div className="d-grid gap-2 mt-4">
            <Button
              variant="primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                  {' '}
                  {isEditing ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                isEditing ? 'Actualizar Campaña' : 'Crear Campaña'
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/campanas')}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </Form>
      </Card>
    </Container>
  );
}

export default FormularioCampanaPage;
