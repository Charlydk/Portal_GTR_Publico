// src/components/HistorialComentarios.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';import { Card, Form, Button, Alert, Spinner, ListGroup, Badge } from 'react-bootstrap';

const HistorialComentarios = ({ campanaId }) => {
  const { authToken } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Función para formatear la fecha y hora de manera legible
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

  // Función para obtener los comentarios del backend
  const fetchComentarios = useCallback(async () => {
    if (!authToken || !campanaId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/comentarios_generales`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'No se pudieron cargar los comentarios.');
      }
      const data = await response.json();
      setComentarios(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authToken, campanaId]);

  // useEffect para cargar los comentarios cuando el componente se monta
  useEffect(() => {
    fetchComentarios();
  }, [fetchComentarios]);

  // Manejador para enviar un nuevo comentario
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!nuevoComentario.trim()) {
      setError("El comentario no puede estar vacío.");
      return;
    }
    
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/comentarios_generales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ comentario: nuevoComentario }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al enviar el comentario.');
      }
      
      // Limpiar el campo de texto y recargar la lista de comentarios
      setNuevoComentario('');
      fetchComentarios();

    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="shadow-sm p-4 mb-4">
      <h4 className="mb-3 text-primary">Historial de Comentarios Generales</h4>
      
      {/* Formulario para añadir un nuevo comentario */}
      <Form onSubmit={handleCommentSubmit} className="mb-4">
        <Form.Group className="mb-2">
          <Form.Label htmlFor="nuevoComentario" className="visually-hidden">Nuevo Comentario</Form.Label>
          <Form.Control
            as="textarea"
            id="nuevoComentario"
            rows={3}
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
            placeholder="Escribe un nuevo comentario general para la bitácora..."
            disabled={submitting}
          />
        </Form.Group>
        <Button type="submit" variant="info" disabled={submitting}>
          {submitting ? <Spinner as="span" animation="border" size="sm" /> : 'Añadir Comentario'}
        </Button>
      </Form>

      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {/* Lista de comentarios existentes */}
      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : (
        <ListGroup variant="flush">
          {comentarios.length > 0 ? (
            comentarios.map((comentario) => (
              <ListGroup.Item key={comentario.id} className="px-0">
                <div className="d-flex w-100 justify-content-between">
                  <p className="mb-1">{comentario.comentario}</p>
                </div>
                <small className="text-muted">
                  <Badge pill bg="secondary" className="me-2">
                    {comentario.autor.nombre} {comentario.autor.apellido}
                  </Badge>
                  {formatDateTime(comentario.fecha_creacion)}
                </small>
              </ListGroup.Item>
            ))
          ) : (
            <Alert variant="info">No hay comentarios generales en esta bitácora todavía.</Alert>
          )}
        </ListGroup>
      )}
    </Card>
  );
};

export default HistorialComentarios;
