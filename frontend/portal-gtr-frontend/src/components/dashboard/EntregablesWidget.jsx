// RUTA: src/components/dashboard/EntregablesWidget.jsx
import React, { useState, useEffect } from 'react';
import { Card, Badge, ListGroup, Spinner, ProgressBar, Button } from 'react-bootstrap';
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
                    <div className="d-flex flex-column h-100 justify-content-center mt-3">
                        <div className="mb-4">
                            <div className="d-flex justify-content-between small mb-1">
                                <span className="text-muted">Progreso actual ({data.en_progreso}/{total})</span>
                                <span className="fw-bold">{progress}%</span>
                            </div>
                            <ProgressBar now={progress} variant="info" style={{height: '10px'}} className="rounded-pill shadow-sm" />
                        </div>
                        <div className="text-center mt-auto">
                            <Button variant="outline-primary" size="sm" className="fw-bold px-4 rounded-pill" onClick={() => navigate('/backoffice/kanban')}>
                                Ver Tablero Completo ➡
                            </Button>
                        </div>
                    </div>
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
