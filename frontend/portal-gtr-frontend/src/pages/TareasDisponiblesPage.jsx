// RUTA: src/pages/TareasDisponiblesPage.jsx

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
                // Traemos todas las tareas
                const response = await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/`);
                if (!response.ok) throw new Error("Error cargando tareas");
                const data = await response.json();

                // 1. FILTRO: Solo mis tareas (pero incluimos las COMPLETADAS)
                let misTareas = data.filter(t => t.analista_id === user.id);
                
                // 2. ORDEN: Pendientes primero, Completadas al final
                misTareas.sort((a, b) => {
                    if (a.progreso === 'COMPLETADA' && b.progreso !== 'COMPLETADA') return 1;
                    if (a.progreso !== 'COMPLETADA' && b.progreso === 'COMPLETADA') return -1;
                    return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
                });
                
                setTareas(misTareas);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user) cargarMisTareas();
    }, [user]);

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
                    <h2 className="mb-1">📋 Mis Rutinas</h2>
                    <p className="text-muted">Gestión de actividades diarias.</p>
                </div>
                <Button variant="outline-secondary" onClick={() => window.location.reload()}>🔄 Actualizar</Button>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            {tareas.length === 0 ? (
                <div className="text-center py-5 bg-light rounded border border-dashed">
                    <h4 className="text-muted">No tienes tareas asignadas</h4>
                    <p>Haz <b>Check-in</b> en una campaña desde el Dashboard para generar tu rutina diaria.</p>
                    <Button variant="primary" onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
                </div>
            ) : (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {tareas.map(tarea => {
                        const progreso = calcularProgreso(tarea.checklist_items);
                        const esCompletada = tarea.progreso === 'COMPLETADA';
                        
                        // Diseño visual según estado
                        const borderClass = esCompletada ? 'border-success' : 'border-0';
                        const bgHeader = esCompletada ? 'bg-success text-white' : 'bg-white';
                        const badgeBg = esCompletada ? 'light' : 'primary';
                        const badgeText = esCompletada ? 'text-dark' : '';

                        return (
                            <Col key={tarea.id}>
                                <Card 
                                    className={`h-100 shadow-sm hover-shadow ${borderClass}`} 
                                    style={{ transition: '0.3s', opacity: esCompletada ? 0.85 : 1 }}
                                >
                                    <Card.Header className={`${bgHeader} border-bottom-0 d-flex justify-content-between align-items-center pt-3`}>
                                        <Badge bg={badgeBg} className={badgeText}>{tarea.campana?.nombre || 'General'}</Badge>
                                        <small className={esCompletada ? 'text-white-50' : 'text-muted'}>
                                            {esCompletada ? 'Finalizada' : `Vence: ${new Date(tarea.fecha_vencimiento).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                                        </small>
                                    </Card.Header>
                                    <Card.Body>
                                        <Card.Title className="h5 mb-3">
                                            {tarea.titulo} {esCompletada && '✅'}
                                        </Card.Title>
                                        
                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between small mb-1">
                                                <span>Progreso</span>
                                                <span className="fw-bold">{progreso}%</span>
                                            </div>
                                            <ProgressBar 
                                                now={progreso} 
                                                variant={esCompletada ? 'success' : 'primary'} 
                                                style={{ height: '8px' }} 
                                            />
                                        </div>

                                        <div className="d-grid">
                                            <Button 
                                                variant={esCompletada ? "outline-success" : "primary"} 
                                                onClick={() => navigate(`/tareas/${tarea.id}`)}
                                            >
                                                {esCompletada ? '👁️ Ver / Retomar' : (progreso === 0 ? '🚀 Comenzar' : '▶️ Continuar')}
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