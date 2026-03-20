// RUTA: src/components/dashboard/WidgetAlertasSupervisor.jsx

import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Badge, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../../api';

const WidgetAlertasSupervisor = () => {
    const [alertas, setAlertas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const navigate = useNavigate();

    const fetchAlertas = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/gtr/dashboard/alertas-supervisor`);
            if (response.ok) {
                const data = await response.json();
                setAlertas(data);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Error cargando alertas supervisor:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlertas();
        const interval = setInterval(fetchAlertas, 30000);
        return () => clearInterval(interval);
    }, []);

    const countCritico = alertas.filter(a => a.tipo === 'CRITICO').length;
    const countEnCurso = alertas.filter(a => a.tipo === 'EN_CURSO' || a.tipo === 'ATENCION').length;

    if (loading) {
        return (
            <Card className="shadow-sm border-0 h-100 d-flex justify-content-center align-items-center" style={{ minHeight: '150px' }}>
                <Spinner animation="grow" variant="primary" size="sm" />
            </Card>
        );
    }

    if (alertas.length === 0) {
        return (
            <Card className="shadow-sm border-0 h-100 overflow-hidden" style={{ minHeight: '180px', borderRadius: '12px' }}>
                <div className="h-100 d-flex flex-column justify-content-center align-items-center bg-white p-4">
                    <div className="mb-2 d-flex justify-content-center align-items-center rounded-circle bg-success bg-opacity-10" style={{ width: '60px', height: '60px' }}>
                        <span style={{ fontSize: '2rem' }}>✅</span>
                    </div>
                    <h6 className="fw-bold text-success mb-1">Operación al día</h6>
                    <p className="text-muted small text-center mb-0">Sin alertas pendientes en ninguna campaña.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="shadow border-0 h-100" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <Card.Header className="bg-white border-0 pt-3 px-3 pb-2 d-flex justify-content-between align-items-center">
                <div>
                    <h6 className="mb-0 fw-bold text-dark">📡 Pulso Operacional</h6>
                    {lastUpdated && (
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                            Act. {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </small>
                    )}
                </div>
                <div className="d-flex gap-1">
                    <OverlayTrigger overlay={<Tooltip>Ítems vencidos</Tooltip>}>
                        <Badge bg="danger" pill className="d-flex align-items-center justify-content-center" style={{ width: '25px', height: '25px' }}>
                            {countCritico}
                        </Badge>
                    </OverlayTrigger>
                    <OverlayTrigger overlay={<Tooltip>En horario / Próximos</Tooltip>}>
                        <Badge bg="primary" pill className="d-flex align-items-center justify-content-center" style={{ width: '25px', height: '25px' }}>
                            {countEnCurso}
                        </Badge>
                    </OverlayTrigger>
                </div>
            </Card.Header>

            <Card.Body className="p-0" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                <ListGroup variant="flush">
                    {alertas.map((alerta) => {
                        let colorBorder = '#ffc107';
                        let bgItem = '#fffbf0';
                        let icon = <i className="bi bi-hourglass-split text-warning fs-5"></i>;
                        let tooltipText = "Atención (Próximo)";

                        if (alerta.tipo === 'CRITICO') {
                            colorBorder = '#dc3545';
                            bgItem = '#fff5f5';
                            icon = <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>;
                            tooltipText = "Vencido";
                        } else if (alerta.tipo === 'EN_CURSO') {
                            colorBorder = '#0d6efd';
                            bgItem = '#f0f7ff';
                            icon = <i className="bi bi-rocket-takeoff-fill text-primary fs-5"></i>;
                            tooltipText = "En Horario";
                        }

                        return (
                            <ListGroup.Item
                                key={`${alerta.tarea_id}-${alerta.id}`}
                                className="d-flex align-items-center py-2 px-3 border-bottom-0"
                                onClick={() => navigate(`/tareas/${alerta.tarea_id}`)}
                                style={{
                                    cursor: 'pointer',
                                    borderLeft: `4px solid ${colorBorder}`,
                                    backgroundColor: bgItem,
                                    marginBottom: '1px',
                                    transition: 'filter 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                            >
                                {/* HORA */}
                                <div className="text-center me-2" style={{ minWidth: '40px' }}>
                                    <small className="fw-bold d-block text-dark" style={{ fontSize: '0.85rem' }}>
                                        {alerta.hora}
                                    </small>
                                </div>

                                {/* DETALLE */}
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <div className="mb-1">
                                        <Badge bg="light" text="dark" className="border fw-normal" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                                            {alerta.campana_nombre.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <div className="fw-semibold text-dark lh-sm" style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>
                                        {alerta.descripcion.replace(/^\[.*?\]\s*/, '')}
                                    </div>
                                </div>

                                {/* ÍCONO ESTADO (solo monitoreo, sin botón de check) */}
                                <div className="ms-2 d-flex align-items-center">
                                    <OverlayTrigger placement="left" overlay={<Tooltip>{tooltipText}</Tooltip>}>
                                        <div className="p-1">{icon}</div>
                                    </OverlayTrigger>
                                </div>
                            </ListGroup.Item>
                        );
                    })}
                </ListGroup>
            </Card.Body>
        </Card>
    );
};

export default WidgetAlertasSupervisor;
