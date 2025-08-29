// src/pages/FormularioTareaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Alert, Spinner, Card } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

function FormularioTareaPage() {
  const { id } = useParams(); // Para editar una tarea existente
  const navigate = useNavigate();
  const { user, authToken, loading: authLoading } = useAuth();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fecha_vencimiento: '',
    progreso: 'PENDIENTE',
    analista_id: '',
    campana_id: ''
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [analistas, setAnalistas] = useState([]); // Para supervisores/responsables
  const [campanas, setCampanas] = useState([]); // Para todos los roles que puedan asignar a campañas

  const fetchInitialData = useCallback(async () => {
    if (!authToken || !user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      // Fetch all analysts if current user is SUPERVISOR or RESPONSABLE
      if (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') {
        const analistasResponse = await fetch(`${API_BASE_URL}/analistas/`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!analistasResponse.ok) throw new Error('Error al cargar analistas.');
        setAnalistas(await analistasResponse.json());
      } else if (user.role === 'ANALISTA') {
        // For ANALISTA, pre-fill their own ID and they can only assign to themselves
        setFormData(prev => ({ ...prev, analista_id: user.id }));
      }

      // Fetch all campaigns if current user is SUPERVISOR or RESPONSABLE
      // Or fetch only assigned campaigns if current user is ANALISTA
      let campanasUrl = `${API_BASE_URL}/campanas/`;
      if (user.role === 'ANALISTA') {
        // Fetch campaigns assigned to the current analyst
        const analistaMeResponse = await fetch(`${API_BASE_URL}/users/me/`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!analistaMeResponse.ok) throw new Error('Error al cargar campañas asignadas del analista.');
        const analistaMeData = await analistaMeResponse.json();
        setCampanas(analistaMeData.campanas_asignadas || []);
      } else {
        // Supervisors/Responsables can see all campaigns
        const campanasResponse = await fetch(campanasUrl, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!campanasResponse.ok) throw new Error('Error al cargar campañas.');
        setCampanas(await campanasResponse.json());
      }

       // If editing, fetch task data
       if (isEditing) {
        const tareaResponse = await fetch(`${API_BASE_URL}/tareas/${id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!tareaResponse.ok) throw new Error('Error al cargar la tarea.');
        const tareaData = await tareaResponse.json();

        // ## 1. CORRECCIÓN AL CARGAR FECHA PARA EDITAR ##
        // La API nos da una fecha UTC. Debemos convertirla a un string
        // de fecha local que el input "datetime-local" pueda entender.
        let localVencimientoString = '';
        if (tareaData.fecha_vencimiento) {
          const utcDate = new Date(tareaData.fecha_vencimiento);
          // Truco para obtener el formato YYYY-MM-DDTHH:mm local
          // Restamos el desfase horario para que toISOString() devuelva la hora local
          utcDate.setMinutes(utcDate.getMinutes() - utcDate.getTimezoneOffset());
          localVencimientoString = utcDate.toISOString().slice(0, 16);
        }

        setFormData({
          titulo: tareaData.titulo,
          descripcion: tareaData.descripcion || '',
          fecha_vencimiento: localVencimientoString, // Usamos el string local
          progreso: tareaData.progreso,
          // Corregimos para evitar que un valor null se convierta en 0
          analista_id: tareaData.analista_id || '',
          campana_id: tareaData.campana_id || ''
        });
      }
    } catch (err) {
      console.error("Error fetching initial data:", err);
      setError(err.message || "No se pudo cargar la información inicial.");
    } finally {
      setLoading(false);
    }
  }, [authToken, user, id, isEditing]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchInitialData();
    }
  }, [authLoading, user, fetchInitialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // ## 2. CORRECCIÓN AL ENVIAR LA FECHA ##
      // El valor de formData.fecha_vencimiento es un string de hora local.
      // Lo convertimos a un objeto Date (que el navegador interpreta como local)
      // y luego a un string ISO (formato UTC universal) para la API.
      const fechaVencimientoUTC = new Date(formData.fecha_vencimiento).toISOString();

      const payload = {
        ...formData,
        analista_id: formData.analista_id ? parseInt(formData.analista_id) : null,
        campana_id: formData.campana_id ? parseInt(formData.campana_id) : null,
        fecha_vencimiento: fechaVencimientoUTC, // Enviamos la fecha en UTC
        progreso: formData.progreso,
      };
      
      // Lógica para analistas que se auto-asignan
      if (user.role === 'ANALISTA') {
          payload.analista_id = user.id;
      }

      const url = isEditing ? `${API_BASE_URL}/tareas/${id}` : `${API_BASE_URL}/tareas/`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} la tarea.`);
      }

      setSuccess(`Tarea ${isEditing ? 'actualizada' : 'creada'} con éxito!`);
      setTimeout(() => {
        setSuccess(null);
        navigate('/tareas');
      }, 2000);
    } catch (err) {
      console.error("Error submitting form:", err);
      setError(err.message || `No se pudo ${isEditing ? 'actualizar' : 'crear'} la tarea.`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando formulario de tarea...</p>
      </Container>
    );
  }

  // Restricción de acceso para ANALISTA si intenta editar una tarea que no es suya
  // O si intenta acceder a la creación/edición sin los permisos adecuados.
  // La lógica de backend ya maneja esto, pero esto es una capa extra en el frontend.
  const canAccessForm = user && (
    user.role === 'SUPERVISOR' || 
    user.role === 'RESPONSABLE' ||
    (user.role === 'ANALISTA' && (!isEditing || (isEditing && formData.analista_id === user.id)))
  );

  if (!canAccessForm) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Acceso Denegado</Alert.Heading>
          <p>No tienes los permisos necesarios para acceder a este formulario de tarea.</p>
          <Button onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="shadow-lg p-4">
        <h2 className="text-center mb-4 text-primary">{isEditing ? 'Editar Tarea' : 'Crear Nueva Tarea'}</h2>

        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="titulo">
            <Form.Label>Título</Form.Label>
            <Form.Control
              type="text"
              name="titulo"
              value={formData.titulo}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="descripcion">
            <Form.Label>Descripción</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="fecha_vencimiento">
            <Form.Label>Fecha de Vencimiento</Form.Label>
            <Form.Control
              type="datetime-local"
              name="fecha_vencimiento"
              value={formData.fecha_vencimiento}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="progreso">
            <Form.Label>Progreso</Form.Label>
            <Form.Select
              name="progreso"
              value={formData.progreso}
              onChange={handleChange}
              required
              disabled={user.role === 'ANALISTA' && !isEditing} // Analistas solo pueden cambiar progreso al editar
            >
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="EN_PROGRESO">EN_PROGRESO</option>
              <option value="COMPLETADA">COMPLETADA</option>
              <option value="CANCELADA">CANCELADA</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3" controlId="analista_id">
            <Form.Label>Analista Asignado</Form.Label>
            <Form.Select
              name="analista_id"
              value={formData.analista_id}
              onChange={handleChange}
              // 👇 ESTA LÍNEA ES LA CLAVE: El campo solo es requerido si el usuario es un ANALISTA
              required={user.role === 'ANALISTA'}
              // El campo está deshabilitado si es un analista (ya que solo puede asignarse a sí mismo)
              disabled={user.role === 'ANALISTA'}
            >
              {/* Supervisores y Responsables ven esta opción para no asignar */}
              {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                <option value="">Sin Asignar (Tarea en Pool)</option>
              )}

              {/* Si es analista, solo se ve a sí mismo */}
              {user.role === 'ANALISTA' ? (
                <option key={user.id} value={user.id}>{user.nombre} {user.apellido}</option>
              ) : (
                // Si es supervisor/responsable, ve la lista de todos los analistas
                analistas.map(analista => (
                  <option key={analista.id} value={analista.id}>
                    {analista.nombre} {analista.apellido} ({analista.role})
                  </option>
                ))
              )}
            </Form.Select>
            {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                <Form.Text className="text-muted">
                  Si no asignas un analista, la tarea debe estar asociada a una campaña.
                </Form.Text>
            )}
          </Form.Group>

          <Form.Group className="mb-3" controlId="campana_id">
            <Form.Label>Campaña (Opcional)</Form.Label>
            <Form.Select
              name="campana_id"
              value={formData.campana_id}
              onChange={handleChange}
            >
              <option value="">Ninguna Campaña (Tarea Personal)</option>
              {campanas.map(campana => (
                <option key={campana.id} value={campana.id}>
                  {campana.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <div className="d-grid gap-2 mt-4">
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                  {' '}
                  Guardando...
                </>
              ) : (
                isEditing ? 'Actualizar Tarea' : 'Crear Tarea'
              )}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/tareas')} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </Form>
      </Card>
    </Container>
  );
}

export default FormularioTareaPage;
