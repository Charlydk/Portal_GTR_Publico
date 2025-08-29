// src/pages/AsignacionCampanasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, ListGroup, Button, Alert, Spinner } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth'; // Importamos useAuth para obtener el token y el rol

function AsignacionCampanasPage() {
  const [analistas, setAnalistas] = useState([]);
  const [campanas, setCampanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(''); // Para mensajes de éxito/error de operaciones

  const { authToken, user } = useAuth(); // Obtenemos el token y el usuario del contexto de autenticación

  // Función para limpiar mensajes después de un tiempo
  const clearMessage = () => {
    setTimeout(() => setMessage(''), 3000);
  };

  // Función para obtener los analistas
  const fetchAnalistas = useCallback(async () => {
    if (!authToken) return; // No intentar si no hay token

    try {
      const response = await fetch(`${API_BASE_URL}/analistas/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Error al cargar analistas: ${response.statusText}`);
      }
      const data = await response.json();
      setAnalistas(data);
    } catch (err) {
      console.error("Error fetching analysts:", err);
      setError(`Error al cargar analistas: ${err.message}`);
    }
  }, [authToken]);

  // Función para obtener las campañas
  const fetchCampanas = useCallback(async () => {
    if (!authToken) return; // No intentar si no hay token

    try {
      const response = await fetch(`${API_BASE_URL}/campanas/`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Error al cargar campañas: ${response.statusText}`);
      }
      const data = await response.json();
      setCampanas(data);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
      setError(`Error al cargar campañas: ${err.message}`);
    }
  }, [authToken]);

  // Efecto para cargar datos al montar el componente
  useEffect(() => {
    const loadData = async () => {
      if (!authToken) {
        setLoading(false);
        setError("No autorizado. Por favor, inicie sesión.");
        return;
      }
      setLoading(true);
      await fetchAnalistas();
      await fetchCampanas();
      setLoading(false);
    };
    loadData();
  }, [authToken, fetchAnalistas, fetchCampanas]); // Depende de authToken y las funciones de fetch

  // Función para asignar una campaña a un analista
  const handleAssignCampaign = async (analistaId, campanaId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/analistas/${analistaId}/campanas/${campanaId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al asignar campaña: ${response.statusText}`);
      }

      setMessage('Campaña asignada exitosamente.');
      fetchAnalistas(); // Recargar analistas para ver el cambio
    } catch (err) {
      console.error("Error assigning campaign:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      clearMessage();
    }
  };

  // Función para desasignar una campaña de un analista
  const handleUnassignCampaign = async (analistaId, campanaId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/analistas/${analistaId}/campanas/${campanaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al desasignar campaña: ${response.statusText}`);
      }

      setMessage('Campaña desasignada exitosamente.');
      fetchAnalistas(); // Recargar analistas para ver el cambio
    } catch (err) {
      console.error("Error unassigning campaign:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      clearMessage();
    }
  };

  // Restringir acceso a solo SUPERVISOR y RESPONSABLE
  if (!user || (user.role !== 'SUPERVISOR' && user.role !== 'RESPONSABLE')) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-danger-subtle">
        <Alert variant="danger" className="text-center">
          <Alert.Heading>Acceso Denegado</Alert.Heading>
          <p>No tienes los permisos necesarios para acceder a esta página.</p>
          <p>Solo usuarios con rol SUPERVISOR o RESPONSABLE pueden gestionar la asignación de campañas.</p>
          <Button variant="primary" onClick={() => window.location.href = '/dashboard'}>Ir al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando datos...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-danger-subtle">
        <Alert variant="danger" className="text-center">
          <Alert.Heading>¡Error!</Alert.Heading>
          <p>{error}</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <h1 className="text-center mb-5 text-primary">Gestión de Asignación de Campañas</h1>

      {message && (
        <Alert variant={message.startsWith('Error') ? 'danger' : 'success'} className="text-center mb-4">
          {message}
        </Alert>
      )}

      <Row>
        {/* Sección de Analistas */}
        <Col md={6} className="mb-4">
          <Card className="shadow-sm border-primary">
            <Card.Header as="h2" className="bg-primary text-white">Analistas y sus Campañas Asignadas</Card.Header>
            <Card.Body>
              {analistas.length === 0 ? (
                <p className="text-muted">No hay analistas registrados.</p>
              ) : (
                <ListGroup variant="flush">
                  {analistas.map((analista) => (
                    <ListGroup.Item key={analista.id} className="mb-3 border rounded p-3">
                      <h5>{analista.nombre} {analista.apellido} <small className="text-muted">(BMS ID: {analista.bms_id})</small></h5>
                      <p className="mb-1">Email: {analista.email}</p>
                      <p className="mb-2">Rol: <span className="fw-bold text-info">{analista.role}</span></p>
                      <h6 className="mt-3">Campañas Asignadas:</h6>
                      {analista.campanas_asignadas && analista.campanas_asignadas.length > 0 ? (
                        <ListGroup className="mt-2">
                          {analista.campanas_asignadas.map((campana) => (
                            <ListGroup.Item key={campana.id} className="d-flex justify-content-between align-items-center">
                              {campana.nombre}
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleUnassignCampaign(analista.id, campana.id)}
                              >
                                Desasignar
                              </Button>
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                      ) : (
                        <p className="text-muted fst-italic">Ninguna campaña asignada.</p>
                      )}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Sección de Asignación de Campañas */}
        <Col md={6} className="mb-4">
          <Card className="shadow-sm border-success">
            <Card.Header as="h2" className="bg-success text-white">Asignar Campañas a Analistas</Card.Header>
            <Card.Body>
              {campanas.length === 0 ? (
                <p className="text-muted">No hay campañas disponibles para asignar.</p>
              ) : (
                <ListGroup variant="flush">
                  {campanas.map((campana) => (
                    <ListGroup.Item key={campana.id} className="mb-3 border rounded p-3">
                      <h5>Campaña: {campana.nombre}</h5>
                      <p className="mb-2">Descripción: {campana.descripcion}</p>
                      <h6 className="mt-3">Asignar a Analista:</h6>
                      <div className="d-flex flex-wrap gap-2">
                        {analistas.length === 0 ? (
                          <p className="text-muted fst-italic">No hay analistas para asignar.</p>
                        ) : (
                          analistas.map((analista) => (
                            <Button
                              key={analista.id}
                              variant={analista.campanas_asignadas?.some(ac => ac.id === campana.id) ? 'secondary' : 'outline-success'}
                              onClick={() => handleAssignCampaign(analista.id, campana.id)}
                              disabled={analista.campanas_asignadas?.some(ac => ac.id === campana.id)}
                              className="mb-2"
                            >
                              {analista.nombre} {analista.apellido}
                            </Button>
                          ))
                        )}
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default AsignacionCampanasPage;
