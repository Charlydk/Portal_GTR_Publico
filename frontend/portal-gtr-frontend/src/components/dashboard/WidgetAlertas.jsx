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

    // --- CÁLCULO DE CONTADORES ---
    const countVencidas = alertas.filter(a => a.tipo === 'CRITICO').length;
    const countEnHorario = alertas.filter(a => a.tipo === 'EN_CURSO' || a.tipo === 'ATENCION').length;
    const countTotal = alertas.length;

    if (loading) {
        return (
            <Card className="shadow-sm border-0 h-100 d-flex justify-content-center align-items-center" style={{ minHeight: '150px' }}>
                <Spinner animation="grow" variant="primary" size="sm" />
            </Card>
        );
    }

    // ESTADO ZEN (Sin alertas)
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

    // ESTADO CON ALERTAS
    return (
        <Card className="shadow border-0 h-100" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            {/* --- CABECERA CON 3 GLOBITOS --- */}
            <Card.Header className="bg-white border-0 pt-3 px-3 pb-2 d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-dark">⚡ Actividad</h6>
                <div className="d-flex gap-1">
                    {/* Vencidas */}
                    <OverlayTrigger overlay={<Tooltip>Vencidas</Tooltip>}>
                        <Badge bg="danger" pill className="d-flex align-items-center justify-content-center" style={{width:'25px', height:'25px'}}>
                            {countVencidas}
                        </Badge>
                    </OverlayTrigger>
                    
                    {/* En Horario */}
                    <OverlayTrigger overlay={<Tooltip>En Horario</Tooltip>}>
                        <Badge bg="primary" pill className="d-flex align-items-center justify-content-center" style={{width:'25px', height:'25px'}}>
                            {countEnHorario}
                        </Badge>
                    </OverlayTrigger>

                    {/* Total */}
                    <OverlayTrigger overlay={<Tooltip>Total del día</Tooltip>}>
                        <Badge bg="light" text="dark" pill className="d-flex align-items-center justify-content-center border" style={{width:'25px', height:'25px'}}>
                            {countTotal}
                        </Badge>
                    </OverlayTrigger>
                </div>
            </Card.Header>

            <Card.Body className="p-0" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <ListGroup variant="flush">
                    {alertas.map((alerta) => {
                        // CONFIGURACIÓN DE ESTILOS
                        let colorBorder = '#ffc107'; // Amarillo
                        let bgItem = '#fffbf0';
                        let icon = <i className="bi bi-hourglass-split text-warning fs-5"></i>; // Reloj arena
                        let tooltipText = "Atención (Próximo)";

                        if (alerta.tipo === 'CRITICO') {
                            colorBorder = '#dc3545'; // Rojo
                            bgItem = '#fff5f5';
                            icon = <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>; // Warning rojo
                            tooltipText = "Vencido";
                        } else if (alerta.tipo === 'EN_CURSO') {
                            colorBorder = '#0d6efd'; // Azul
                            bgItem = '#f0f7ff';
                            icon = <i className="bi bi-rocket-takeoff-fill text-primary fs-5"></i>; // Cohete azul
                            tooltipText = "En Horario";
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
                                    marginBottom: '1px',
                                    transition: 'filter 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                                onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                            >
                                {/* 1. COLUMNA HORA (Más chica) */}
                                <div className="text-center me-2" style={{ minWidth: '40px' }}>
                                    <small className="fw-bold d-block text-dark" style={{fontSize:'0.85rem'}}>
                                        {alerta.hora}
                                    </small>
                                </div>

                                {/* 2. COLUMNA CONTENIDO (Texto completo) */}
                                <div className="flex-grow-1" style={{ minWidth: 0 }}> {/* minWidth:0 habilita el wrap en flex */}
                                    {/* Nombre de Campaña */}
                                    <div className="mb-1">
                                        <Badge bg="light" text="dark" className="border fw-normal" style={{fontSize:'0.65rem', letterSpacing:'0.5px'}}>
                                            {alerta.campana_nombre.toUpperCase()}
                                        </Badge>
                                    </div>
                                    
                                    {/* Descripción completa sin cortar */}
                                    <div className="fw-semibold text-dark lh-sm" style={{fontSize:'0.85rem', wordBreak: 'break-word'}}>
                                        {alerta.descripcion.replace(/^\[.*?\]\s*/, '')}
                                    </div>
                                </div>

                                {/* 3. COLUMNA ICONO (Minimalista) */}
                                <div className="ms-2 d-flex align-items-center">
                                    <OverlayTrigger placement="left" overlay={<Tooltip>{tooltipText}</Tooltip>}>
                                        <div className="p-1">
                                            {icon}
                                        </div>
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