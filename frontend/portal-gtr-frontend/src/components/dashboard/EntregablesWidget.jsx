// RUTA: src/components/dashboard/EntregablesWidget.jsx
import React, { useState, useEffect } from 'react';
import { Card, Badge, ListGroup, Spinner, ProgressBar } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../../api';

function EntregablesWidget({ role }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const isSupervisor = role === 'SUPERVISOR' || role === 'RESPONSABLE';

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/resumen-pendientes`);
                if (res.ok) setData(await res.json());
            } catch (err) {
                console.error("Error fetching entregables summary", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, []);

    if (loading) return (
        <Card className="shadow-sm border-0 h-100">
            <Card.Body className="d-flex justify-content-center align-items-center">
                <Spinner animation="border" size="sm" variant="primary" />
            </Card.Body>
        </Card>
    );

    if (!data) return null;

    const total = data.total || 0;
    const progress = total === 0 ? 0 : Math.round((data.en_progreso / total) * 100);

    return (
        <Card className="shadow-sm border-0 h-100 overflow-hidden">
            <Card.Header className="bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                <span className="fw-bold text-dark">
                    {isSupervisor ? '📊 Estado Global Entregables' : '📋 Mis Entregables Pendientes'}
                </span>
                <Badge bg={total > 0 ? (isSupervisor ? 'primary' : 'warning') : 'success'} pill>
                    {total} {total === 1 ? 'tarea' : 'tareas'}
                </Badge>
            </Card.Header>
            <Card.Body className="pt-0">
                {total > 0 ? (
                    <>
                        <div className="mb-3">
                            <div className="d-flex justify-content-between small mb-1">
                                <span className="text-muted">Progreso actual ({data.en_progreso}/{total})</span>
                                <span className="fw-bold">{progress}%</span>
                            </div>
                            <ProgressBar now={progress} variant="info" style={{height: '6px'}} className="rounded-pill shadow-sm" />
                        </div>

                        <ListGroup variant="flush">
                            {data.recientes.map(item => (
                                <ListGroup.Item 
                                    key={item.id} 
                                    action 
                                    onClick={() => navigate(`/backoffice/entregables/${item.id}`)}
                                    className="px-0 py-2 border-0 d-flex justify-content-between align-items-center"
                                    style={{fontSize: '0.85rem'}}
                                >
                                    <div className="text-truncate me-2">
                                        <div className="fw-semibold text-dark text-truncate">{item.titulo}</div>
                                        <small className="text-muted">{item.campana_nombre}</small>
                                    </div>
                                    <Badge bg={item.estado === 'EN_PROGRESO' ? 'warning' : 'secondary'} className="fw-normal" style={{fontSize: '0.65rem'}}>
                                        {item.estado === 'EN_PROGRESO' ? '⚡' : '📋'}
                                    </Badge>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                        <div className="text-center mt-2">
                            <small className="text-primary fw-bold" style={{cursor: 'pointer'}} onClick={() => navigate('/backoffice/kanban')}>
                                Ver tablero completo →
                            </small>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-4">
                        <div className="fs-3 mb-2">🎉</div>
                        <p className="text-muted small mb-0">No hay tareas pendientes por ahora.</p>
                    </div>
                )}
            </Card.Body>
        </Card>
    );
}

export default EntregablesWidget;
