// RUTA: src/components/dashboard/CoberturaWidget.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Badge, Spinner, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { useNavigate } from 'react-router-dom';

const CoberturaWidget = ({ refreshTrigger }) => {
    const [cobertura, setCobertura] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchCobertura = useCallback(async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/cobertura`);
            if (response.ok) {
                const data = await response.json();
                setCobertura(data);
                setError(null);
            }
        } catch (err) {
            console.error(err);
            setError("Error al cargar radar.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCobertura();
        const interval = setInterval(fetchCobertura, 60000); 
        return () => clearInterval(interval);
    }, [fetchCobertura]);

    useEffect(() => {
        if (refreshTrigger > 0) {
            setLoading(true);
            fetchCobertura();
        }
    }, [refreshTrigger, fetchCobertura]);

    if (loading && cobertura.length === 0) return <Spinner animation="border" size="sm" />;
    if (error) return <Alert variant="warning" className="small py-1 mb-2">{error}</Alert>;
    if (cobertura.length === 0) return <Alert variant="info" className="small">Sin datos.</Alert>;

    const descubiertas = cobertura.filter(c => c.estado === 'DESCUBIERTA');
    const resto = cobertura.filter(c => c.estado !== 'DESCUBIERTA');
    const ordenadas = [...descubiertas, ...resto];

    return (
        <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-white border-bottom-0 pt-3 pb-2 d-flex justify-content-between">
                <h5 className="mb-0 fw-bold text-dark">📡 Radar de Cobertura</h5>
                {descubiertas.length > 0 && <Badge bg="danger" className="animate__animated animate__pulse animate__infinite">⚠️ {descubiertas.length} Sin Cubrir</Badge>}
            </Card.Header>
            <Card.Body className="pt-0">
                <Row className="g-2">
                    {ordenadas.map((item) => {
                        let borderClass = "border-secondary", bgClass = "bg-light", icon = "🌙", statusText = "Cerrada", textClass = "text-muted", opacity = "0.7";

                        if (item.estado === 'CUBIERTA') {
                            borderClass = "border-success"; bgClass = "bg-success bg-opacity-10"; icon = "✅"; statusText = "Operativa"; textClass = "text-success"; opacity = "1";
                        } else if (item.estado === 'DESCUBIERTA') {
                            borderClass = "border-danger"; bgClass = "bg-danger text-white"; icon = "🚨"; statusText = "SIN PERSONAL"; textClass = "text-white"; opacity = "1";
                        }

                        // USAMOS LAS VARIABLES NUEVAS DE HORA
                        const horaInicio = item.hora_inicio_hoy ? item.hora_inicio_hoy.substring(0, 5) : '--:--';
                        const horaFin = item.hora_fin_hoy ? item.hora_fin_hoy.substring(0, 5) : '--:--';

                        // CONFIGURACIÓN DEL TOOLTIP CON NOMBRES
                        const renderTooltip = (props) => (
                            <Tooltip id={`tooltip-${item.campana_id}`} {...props}>
                                {item.nombres_analistas && item.nombres_analistas.length > 0 ? (
                                    <div className="text-start">
                                        <strong>Conectados:</strong>
                                        <ul className="list-unstyled mb-0 ps-1" style={{fontSize: '0.85rem'}}>
                                            {item.nombres_analistas.map((nombre, idx) => (
                                                <li key={idx}>• {nombre}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : ("Sin analistas")}
                            </Tooltip>
                        );

                        return (
                            <Col xs={12} sm={6} md={4} lg={3} key={item.campana_id}>
                                <div 
                                    className={`p-2 border rounded position-relative ${bgClass} ${borderClass}`}
                                    style={{ transition: 'all 0.2s', opacity: opacity, cursor: 'pointer' }}
                                    onClick={() => navigate(`/campanas/${item.campana_id}`)}
                                >
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div className="text-truncate pe-1 fw-bold">{item.nombre_campana}</div>
                                        <div style={{fontSize: '1.2rem'}}>{icon}</div>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-end mt-2">
                                        <div>
                                            <span className={`d-block small fw-bold ${item.estado === 'DESCUBIERTA' ? 'text-white' : textClass}`}>{statusText}</span>
                                            <small className={item.estado === 'DESCUBIERTA' ? 'text-white-50' : 'text-muted'} style={{fontSize: '0.7rem'}}>
                                                {horaInicio} - {horaFin}
                                            </small>
                                        </div>
                                        
                                        {/* BADGE CON TOOLTIP */}
                                        {item.analistas_activos > 0 && (
                                            <OverlayTrigger placement="top" delay={{ show: 250, hide: 400 }} overlay={renderTooltip}>
                                                <Badge bg="light" text="dark" className="border shadow-sm">
                                                    👤 {item.analistas_activos}
                                                </Badge>
                                            </OverlayTrigger>
                                        )}
                                    </div>
                                </div>
                            </Col>
                        );
                    })}
                </Row>
            </Card.Body>
        </Card>
    );
};

export default CoberturaWidget;