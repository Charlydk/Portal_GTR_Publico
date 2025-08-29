
// src/pages/TareasDisponiblesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Card, ListGroup, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

function TareasDisponiblesPage() {
    const navigate = useNavigate();
    const { authToken } = useAuth();
    const [tareas, setTareas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const formatDateTime = (utcIsoString) => {
        if (!utcIsoString) return 'N/A';
        const date = new Date(utcIsoString + 'Z');
        if (isNaN(date.getTime())) return 'Fecha inválida';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${minutes}`;
    };

    const fetchTareasDisponibles = useCallback(async () => {
        if (!authToken) {
            setLoading(false);
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/campanas/tareas_disponibles/`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) {
                throw new Error('No se pudieron cargar las tareas disponibles.');
            }
            const data = await response.json();
            setTareas(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        fetchTareasDisponibles();
    }, [fetchTareasDisponibles]);

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
    }

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center">Tareas de Campaña Disponibles</Card.Header>
                <Card.Body>
                    {tareas.length > 0 ? (
                        <ListGroup variant="flush">
                            {tareas.map(tarea => (
                                <ListGroup.Item 
                                    key={tarea.id} 
                                    action 
                                    as={Link} 
                                    to={`/tareas/${tarea.id}`}
                                    className="d-flex justify-content-between align-items-center"
                                >
                                    <div>
                                        <strong>{tarea.titulo}</strong>
                                        <br />
                                        <small className="text-muted">
                                            Campaña: {tarea.campana.nombre} | Vence: {formatDateTime(tarea.fecha_vencimiento)}
                                        </small>
                                    </div>
                                    <Badge bg="info">Ver y Asignar</Badge>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <Alert variant="success" className="text-center">
                            ¡Felicidades! No hay tareas disponibles en tus campañas asignadas.
                        </Alert>
                    )}
                </Card.Body>
                <Card.Footer className="text-end">
                    <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                        Volver al Dashboard
                    </Button>
                </Card.Footer>
            </Card>
        </Container>
    );
}

export default TareasDisponiblesPage;