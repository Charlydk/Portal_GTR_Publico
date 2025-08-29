// src/pages/FormularioAvisoPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Form, Button, Alert, Spinner, Card } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

function FormularioAvisoPage() {
  const { id } = useParams(); // Para saber si estamos editando (id existe) o creando
  const navigate = useNavigate();
  const { authToken, user, loading: authLoading } = useAuth(); // Obtenemos el token y el usuario logueado

  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    fecha_vencimiento: '', // Para el aviso en sí
    creador_id: '',
    campana_id: '',
    requiere_tarea: false, // NUEVO: Si el aviso requiere una tarea
    fecha_vencimiento_tarea: '', // NUEVO: Fecha de vencimiento para la tarea generada
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [analistas, setAnalistas] = useState([]);
  const [campanas, setCampanas] = useState([]);

  const isEditing = Boolean(id);

  // Función para cargar datos de analistas y campañas para los selectores
  const fetchSelectData = useCallback(async () => {
    if (!authToken) return;
    try {
      const [analistasRes, campanasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analistas/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE_URL}/campanas/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      ]);

      if (!analistasRes.ok) {
        const errorData = await analistasRes.json();
        throw new Error(errorData.detail || `Error al cargar analistas: ${analistasRes.statusText}`);
      }
      if (!campanasRes.ok) {
        const errorData = await campanasRes.json();
        throw new Error(errorData.detail || `Error al cargar campañas: ${campanasRes.statusText}`);
      }

      const analistasData = await analistasRes.json();
      const campanasData = await campanasRes.json();

      setAnalistas(analistasData);
      setCampanas(campanasData);

    } catch (err) {
      console.error("Error fetching select data:", err);
      setError(`Error al cargar datos para selectores: ${err.message}`);
    }
  }, [authToken]);

  // Función para cargar los datos del aviso si estamos editando
  const fetchAvisoData = useCallback(async () => {
    if (!id || !authToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/avisos/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar aviso: ${response.statusText}`);
      }
      const data = await response.json();
      setFormData({
        titulo: data.titulo,
        contenido: data.contenido,
        fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento).toISOString().slice(0, 16) : '',
        creador_id: data.creador_id,
        campana_id: data.campana_id || '',
        requiere_tarea: data.requiere_tarea || false, // Cargar el valor de requiere_tarea
        fecha_vencimiento_tarea: data.fecha_vencimiento_tarea ? new Date(data.fecha_vencimiento_tarea).toISOString().slice(0, 16) : '', // Cargar la fecha de vencimiento de la tarea
      });
    } catch (err) {
      console.error("Error fetching aviso data:", err);
      setError(`Error al cargar los datos del aviso: ${err.message}`);
    }
  }, [id, authToken]);

  useEffect(() => {
    const loadPageData = async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      if (!authToken) {
        setLoading(false);
        setError("No autenticado. Por favor, inicie sesión.");
        return;
      }

      await fetchSelectData(); // Cargar datos para selectores siempre

      if (isEditing) {
        await fetchAvisoData(); // Si edita, cargar datos del aviso
      } else if (user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE')) {
        // Si es creando y el usuario es Supervisor o Responsable, establecer creador_id por defecto
        setFormData(prev => ({ ...prev, creador_id: user.id }));
      }
      setLoading(false);
    };

    if (!authLoading) { // Esperar a que la autenticación termine
      loadPageData();
    }
  }, [authToken, isEditing, user, fetchSelectData, fetchAvisoData, authLoading]); // Añadir authLoading a las dependencias

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // Usamos 'loading' también para el estado de envío
    setError(null);
    setSuccessMessage(null);

    // Validaciones básicas
    if (!formData.titulo || !formData.contenido || !formData.creador_id) {
      setError("Título, contenido y creador son campos obligatorios.");
      setLoading(false);
      return;
    }

    // Validación para la tarea generada
    if (formData.requiere_tarea && !formData.fecha_vencimiento_tarea) {
      setError("Si el aviso requiere una tarea, debe especificar una fecha de vencimiento para la tarea.");
      setLoading(false);
      return;
    }

    // Preparar los datos para la API
    const payload = {
      ...formData,
      creador_id: parseInt(formData.creador_id),
      campana_id: formData.campana_id ? parseInt(formData.campana_id) : null,
      fecha_vencimiento: formData.fecha_vencimiento ? new Date(formData.fecha_vencimiento).toISOString() : null,
      // Convertir fecha_vencimiento_tarea a formato ISO si existe y requiere_tarea es true
      fecha_vencimiento_tarea: formData.requiere_tarea && formData.fecha_vencimiento_tarea ? new Date(formData.fecha_vencimiento_tarea).toISOString() : null,
    };

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_BASE_URL}/avisos/${id}` : `${API_BASE_URL}/avisos/`;

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend Error Response:", errorData); // Log detallado del error del backend
        throw new Error(errorData.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} aviso: ${response.statusText}`);
      }

      const result = await response.json();
      setSuccessMessage(`Aviso ${isEditing ? 'actualizado' : 'creado'} exitosamente.`);
      setTimeout(() => {
        navigate(`/avisos/${result.id}`); // Redirigir a la página de detalles del aviso
      }, 1500);

    } catch (err) {
      console.error("Error submitting form:", err);
      setError(err.message || `No se pudo ${isEditing ? 'actualizar' : 'crear'} el aviso.`);
    } finally {
      setLoading(false);
    }
  };

  // Determinar si el campo creador_id debe ser editable
  const isCreadorEditable = user && user.role === 'SUPERVISOR';

  // Mostrar spinner si authLoading o loading es true
  if (authLoading || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando datos del formulario...</p>
      </Container>
    );
  }

  // Mostrar error si no hay usuario o permisos adecuados
  const canManageAvisos = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');
  if (!canManageAvisos) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Acceso Denegado</Alert.Heading>
          <p>No tienes los permisos necesarios para {isEditing ? 'editar' : 'crear'} avisos.</p>
          <Button onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="shadow-sm">
        <Card.Header as="h2" className="bg-primary text-white text-center">
          {isEditing ? 'Editar Aviso' : 'Crear Nuevo Aviso'}
        </Card.Header>
        <Card.Body>
          {successMessage && <Alert variant="success">{successMessage}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formTitulo">
              <Form.Label>Título</Form.Label>
              <Form.Control
                type="text"
                name="titulo"
                value={formData.titulo}
                onChange={handleChange}
                placeholder="Ingrese el título del aviso"
                required
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formContenido">
              <Form.Label>Contenido</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                name="contenido"
                value={formData.contenido}
                onChange={handleChange}
                placeholder="Ingrese el contenido del aviso"
                required
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formFechaVencimiento">
              <Form.Label>Fecha de Vencimiento del Aviso (Opcional)</Form.Label>
              <Form.Control
                type="datetime-local"
                name="fecha_vencimiento"
                value={formData.fecha_vencimiento}
                onChange={handleChange}
                disabled={loading}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formCreadorId">
              <Form.Label>Creador</Form.Label>
              <Form.Select
                name="creador_id"
                value={formData.creador_id}
                onChange={handleChange}
                required
                disabled={loading || (!isCreadorEditable && isEditing)} 
              >
                <option value="">Seleccione un creador</option>
                {analistas.map(analista => (
                  <option key={analista.id} value={analista.id}>
                    {analista.nombre} {analista.apellido} (BMS ID: {analista.bms_id})
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {user && user.role === 'ANALISTA' && !isEditing && `Por defecto: ${user.nombre} ${user.apellido}`}
                {user && !isCreadorEditable && isEditing && `Solo un SUPERVISOR puede cambiar el creador de un aviso existente.`}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formCampanaId">
              <Form.Label>Campaña (Opcional)</Form.Label>
              <Form.Select
                name="campana_id"
                value={formData.campana_id}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Ninguna Campaña</option>
                {campanas.map(campana => (
                  <option key={campana.id} value={campana.id}>
                    {campana.nombre}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Asocie este aviso a una campaña específica.
              </Form.Text>
            </Form.Group>

            {/* NUEVOS CAMPOS PARA TAREA GENERADA */}
            <Card className="p-3 mb-3 bg-light border">
              <Form.Group controlId="requiereTarea" className="mb-3">
                <Form.Check
                  type="checkbox"
                  label="Este aviso requiere una tarea al ser acusado de recibido"
                  name="requiere_tarea" // Asegúrate de que el nombre coincida con el estado
                  checked={formData.requiere_tarea}
                  onChange={handleChange} // Usar el mismo handleChange
                  disabled={loading}
                />
              </Form.Group>

              {formData.requiere_tarea && (
                <Form.Group controlId="fechaVencimientoTarea" className="mb-3">
                  <Form.Label>Fecha de Vencimiento de la Tarea:</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    name="fecha_vencimiento_tarea" // Asegúrate de que el nombre coincida con el estado
                    value={formData.fecha_vencimiento_tarea}
                    onChange={handleChange} // Usar el mismo handleChange
                    required={formData.requiere_tarea} // Hacerlo requerido solo si requiereTarea es true
                    disabled={loading}
                  />
                  <Form.Text className="text-muted">
                    La tarea se generará con esta fecha de vencimiento cuando un analista acuse recibo de este aviso.
                  </Form.Text>
                </Form.Group>
              )}
            </Card>
            {/* FIN NUEVOS CAMPOS */}

            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    {' '}
                    {isEditing ? 'Actualizando...' : 'Creando...'}
                  </>
                ) : (
                  isEditing ? 'Actualizar Aviso' : 'Crear Aviso'
                )}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/avisos')} disabled={loading}>
                Cancelar
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default FormularioAvisoPage;
