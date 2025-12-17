import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, ProgressBar, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';

const TareasDisponiblesPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tareas, setTareas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const cargarMisTareas = async () => {
            try {
                // Traemos todas las tareas (el backend ya es global)
                const response = await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/`);
                if (!response.ok) throw new Error("Error cargando tareas");
                const data = await response.json();

                // FILTRO FRONTEND: Solo mostramos las que son DE ESTE USUARIO
                const misTareas = data.filter(t => t.analista_id === user.id && t.progreso !== 'COMPLETADA');
                
                setTareas(misTareas);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user) cargarMisTareas();
    }, [user]);

    // Función auxiliar para calcular progreso
    const calcularProgreso = (items) => {
        if (!items || items.length === 0) return 0;
        const completados = items.filter(i => i.completado).length;
        return Math.round((completados / items.length) * 100);
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" variant="primary" /></Container>;

    return (
        <Container className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">📋 Mis Rutinas Activas</h2>
                    <p className="text-muted">Aquí aparecen las tareas generadas por tus Check-in.</p>
                </div>
                <Button variant="outline-secondary" onClick={() => window.location.reload()}>🔄 Actualizar</Button>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            {tareas.length === 0 ? (
                <div className="text-center py-5 bg-light rounded border border-dashed">
                    <h4 className="text-muted">No tienes tareas pendientes</h4>
                    <p>Haz <b>Check-in</b> en una campaña desde el Dashboard para generar tu rutina diaria.</p>
                    <Button variant="primary" onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
                </div>
            ) : (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {tareas.map(tarea => {
                        const progreso = calcularProgreso(tarea.checklist_items);
                        const variant = progreso === 100 ? 'success' : progreso > 50 ? 'info' : 'warning';

                        return (
                            <Col key={tarea.id}>
                                <Card className="h-100 shadow-sm border-0 hover-shadow" style={{ transition: '0.3s' }}>
                                    <Card.Header className="bg-white border-bottom-0 d-flex justify-content-between align-items-center pt-3">
                                        <Badge bg="primary">{tarea.campana?.nombre || 'General'}</Badge>
                                        <small className="text-muted">Vence: {new Date(tarea.fecha_vencimiento).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                                    </Card.Header>
                                    <Card.Body>
                                        <Card.Title className="h5 mb-3">{tarea.titulo}</Card.Title>
                                        
                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between small mb-1">
                                                <span>Progreso</span>
                                                <span className="fw-bold">{progreso}%</span>
                                            </div>
                                            <ProgressBar now={progreso} variant={variant} style={{ height: '8px' }} />
                                        </div>

                                        <div className="d-grid">
                                            <Button variant={progreso === 100 ? "success" : "primary"} onClick={() => navigate(`/tareas/${tarea.id}`)}>
                                                {progreso === 0 ? '🚀 Comenzar' : progreso === 100 ? '✅ Revisar' : '▶️ Continuar'}
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}
        </Container>
    );
};

export default TareasDisponiblesPage;