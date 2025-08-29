// src/pages/FormularioChecklistItemPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Alert, Spinner, Card } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

function FormularioChecklistItemPage() {
  const { id, tareaId } = useParams();
  const navigate = useNavigate();
  const { user, authToken, loading: authLoading } = useAuth();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    descripcion: '',
    completado: false,
    tarea_id: tareaId || ''
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchInitialData = useCallback(async () => {
    if (!authToken || !user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      if (tareaId) {
        const specificTaskResponse = await fetch(`${API_BASE_URL}/tareas/${tareaId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!specificTaskResponse.ok) {
          throw new Error('No tienes permiso para crear items en esta tarea.');
        }
      }

      if (isEditing) {
        const itemResponse = await fetch(`${API_BASE_URL}/checklist_items/${id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!itemResponse.ok) throw new Error('Error al cargar el checklist item.');
        const itemData = await itemResponse.json();
        setFormData({
          descripcion: itemData.descripcion,
          completado: itemData.completado,
          tarea_id: itemData.tarea_id
        });
      }
    } catch (err) {
      console.error("Error fetching initial data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authToken, user, id, isEditing, tareaId]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchInitialData();
    }
  }, [authLoading, user, fetchInitialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...formData,
        tarea_id: parseInt(formData.tarea_id),
      };

      const url = isEditing ? `${API_BASE_URL}/checklist_items/${id}` : `${API_BASE_URL}/checklist_items/`;
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
        throw new Error(errorData.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} el item.`);
      }

      setSuccess(`Item ${isEditing ? 'actualizado' : 'creado'} con éxito!`);
      setTimeout(() => {
        navigate(`/tareas/${formData.tarea_id}`); 
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Acceso Denegado</Alert.Heading>
          <p>{error}</p>
          <Button onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="shadow-lg p-4">
        <h2 className="text-center mb-4 text-primary">{isEditing ? 'Editar Checklist Item' : 'Crear Nuevo Checklist Item'}</h2>

        {success && <Alert variant="success">{success}</Alert>}
        
        {!error && (
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="tarea_id">
                    <Form.Label>Tarea Asociada</Form.Label>
                    <Form.Control
                        type="text"
                        value={`Tarea ID: ${formData.tarea_id}`}
                        disabled
                    />
                </Form.Group>

                <Form.Group className="mb-3" controlId="descripcion">
                    <Form.Label>Descripción</Form.Label>
                    <Form.Control
                        type="text"
                        name="descripcion"
                        value={formData.descripcion}
                        onChange={handleChange}
                        required
                    />
                </Form.Group>

                {isEditing && (
                    <Form.Group className="mb-3" controlId="completado">
                        <Form.Check
                        type="checkbox"
                        label="Completado"
                        name="completado"
                        checked={formData.completado}
                        onChange={handleChange}
                        />
                    </Form.Group>
                )}

                <div className="d-grid gap-2 mt-4">
                    <Button variant="primary" type="submit" disabled={submitting}>
                    {submitting ? (
                        <>
                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                        {' '}
                        Guardando...
                        </>
                    ) : (
                        isEditing ? 'Actualizar Item' : 'Crear Item'
                    )}
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(formData.tarea_id ? `/tareas/${formData.tarea_id}` : '/tareas')} disabled={submitting}>
                    Cancelar
                    </Button>
                </div>
            </Form>
        )}
      </Card>
    </Container>
  );
}

export default FormularioChecklistItemPage;
