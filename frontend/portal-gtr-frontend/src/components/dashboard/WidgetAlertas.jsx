// RUTA: src/components/dashboard/WidgetAlertas.jsx

import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Badge, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../../api';

const WidgetAlertas = () => {
    const [alertas, setAlertas] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchAlertas = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/gtr/dashboard/alertas-operativas`);
            if (response.ok) {
                const data = await response.json();
                setAlertas(data);
            }
        } catch (error) {
            console.error("Error cargando alertas:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlertas();
        const interval = setInterval(fetchAlertas, 30000); 
        return () => clearInterval(interval);
    }, []);

    // --- CÁLCULO DE CONTADORES ACTUALIZADO ---
    const countVencidas = alertas.filter(a => a.tipo === 'VENCIDA').length;
    const countAtencion = alertas.filter(a => a.tipo === 'ATENCION').length;
    const countEnHorario = alertas.filter(a => a.tipo === 'EN_HORARIO').length;
    const countProximas = alertas.filter(a => a.tipo === 'PROXIMA').length;
    const countTotal = alertas.length;

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
                        <span style={{ fontSize: '2rem' }}>✨</span>
                    </div>
                    <h6 className="fw-bold text-success mb-1">Todo al día</h6>
                    <p className="text-muted small text-center mb-0">Sin pendientes urgentes.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="shadow border-0 h-100" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <Card.Header className="bg-white border-0 pt-3 px-3 pb-2 d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-dark">⚡ Actividad</h6>
                <div className="d-flex gap-1">
                    {/* Badges de Contadores */}
                    {countVencidas > 0 && (
                        <OverlayTrigger overlay={<Tooltip>Vencidas</Tooltip>}>
                            <Badge bg="danger" pill className="d-flex align-items-center justify-content-center" style={{width:'25px', height:'25px'}}>{countVencidas}</Badge>
                        </OverlayTrigger>
                    )}
                    {countAtencion > 0 && (
                        <OverlayTrigger overlay={<Tooltip>Atención</Tooltip>}>
                            <Badge bg="warning" text="dark" pill className="d-flex align-items-center justify-content-center" style={{width:'25px', height:'25px'}}>{countAtencion}</Badge>
                        </OverlayTrigger>
                    )}
                    {countEnHorario > 0 && (
                        <OverlayTrigger overlay={<Tooltip>En Horario</Tooltip>}>
                            <Badge bg="primary" pill className="d-flex align-items-center justify-content-center" style={{width:'25px', height:'25px'}}>{countEnHorario}</Badge>
                        </OverlayTrigger>
                    )}
                    <OverlayTrigger overlay={<Tooltip>Total</Tooltip>}>
                        <Badge bg="light" text="dark" pill className="d-flex align-items-center justify-content-center border" style={{width:'25px', height:'25px'}}>{countTotal}</Badge>
                    </OverlayTrigger>
                </div>
            </Card.Header>

            <Card.Body className="p-0" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <ListGroup variant="flush">
                    {alertas.map((alerta) => {
                        // --- CONFIGURACIÓN VISUAL NUEVA ---
                        let colorBorder = '#212529'; // Negro (Próxima)
                        let bgItem = '#f8f9fa';
                        let icon = <i className="bi bi-clock text-dark fs-5"></i>;
                        let tooltipText = "Próxima";

                        if (alerta.tipo === 'VENCIDA') {
                            colorBorder = '#dc3545'; // Rojo
                            bgItem = '#fff5f5';
                            icon = <i className="bi bi-exclamation-octagon-fill text-danger fs-5"></i>;
                            tooltipText = "Vencida (> 30 min)";
                        } else if (alerta.tipo === 'ATENCION') {
                            colorBorder = '#ffc107'; // Amarillo
                            bgItem = '#fffbf0';
                            icon = <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>;
                            tooltipText = "Atención (15-30 min)";
                        } else if (alerta.tipo === 'EN_HORARIO') {
                            colorBorder = '#0d6efd'; // Azul
                            bgItem = '#f0f7ff';
                            icon = <i className="bi bi-check-circle-fill text-primary fs-5"></i>;
                            tooltipText = "En Horario (0-15 min)";
                        }

                        return (
                            <ListGroup.Item 
                                key={alerta.id} 
                                className="d-flex align-items-center py-2 px-3 border-bottom-0"
                                onClick={() => navigate(`/tareas/${alerta.tarea_id}`)}
                                style={{ 
                                    cursor: 'pointer', 
                                    borderLeft: `4px solid ${colorBorder}`,
                                    backgroundColor: bgItem,
                                    marginBottom: '1px'
                                }}
                            >
                                <div className="text-center me-2" style={{ minWidth: '40px' }}>
                                    <small className="fw-bold d-block text-dark" style={{fontSize:'0.85rem'}}>
                                        {alerta.hora}
                                    </small>
                                </div>
                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                    <div className="mb-1">
                                        <Badge bg="light" text="dark" className="border fw-normal" style={{fontSize:'0.65rem'}}>
                                            {alerta.campana_nombre.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <div className="fw-semibold text-dark lh-sm" style={{fontSize:'0.85rem', wordBreak: 'break-word'}}>
                                        {alerta.descripcion.replace(/^\[.*?\]\s*/, '')}
                                    </div>
                                </div>
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

export default WidgetAlertas;