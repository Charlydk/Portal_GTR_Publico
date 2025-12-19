import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Badge, Spinner } from 'react-bootstrap';
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
            <Card.Header className="bg-white border-0 pt-3 px-3 pb-2 d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold text-dark">⚡ Actividad</h6>
                <Badge bg="danger" pill>{alertas.length}</Badge>
            </Card.Header>

            <Card.Body className="p-0">
                <ListGroup variant="flush">
                    {alertas.map((alerta) => {
                        // CONFIGURACIÓN DE COLORES SEGÚN TIPO
                        let colorBorder = '#ffc107'; // Amarillo (Default)
                        let bgItem = '#fffbf0';
                        let badgeText = '⏳ Próximo';
                        let badgeBg = 'warning';

                        if (alerta.tipo === 'CRITICO') {
                            colorBorder = '#dc3545'; // Rojo
                            bgItem = '#fff5f5';
                            badgeText = '⚠️ Vencido';
                            badgeBg = 'danger';
                        } else if (alerta.tipo === 'EN_CURSO') {
                            colorBorder = '#0d6efd'; // Azul
                            bgItem = '#f0f7ff';
                            badgeText = '🚀 En Horario';
                            badgeBg = 'primary';
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
                                {/* Hora */}
                                <div className="text-center me-3" style={{ minWidth: '45px' }}>
                                    <span className="fw-bold d-block text-dark" style={{fontSize:'1.1rem'}}>{alerta.hora}</span>
                                </div>

                                {/* Contenido */}
                                <div className="flex-grow-1 overflow-hidden">
                                    {/* Nombre de Campaña Agregado */}
                                    <Badge bg="light" text="dark" className="border mb-1" style={{fontSize:'0.65rem'}}>
                                        {alerta.campana_nombre}
                                    </Badge>
                                    
                                    <div className="text-truncate fw-semibold text-dark" style={{fontSize:'0.9rem'}}>
                                        {alerta.descripcion.replace(/^\[.*?\]\s*/, '')}
                                    </div>
                                </div>

                                {/* Badge Estado */}
                                <div className="ms-2">
                                     <Badge bg={badgeBg} className={alerta.tipo === 'ATENCION' ? 'text-dark' : ''} style={{fontSize:'0.7rem'}}>
                                        {badgeText}
                                     </Badge>
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