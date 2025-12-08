import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Spinner, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../../api';

const CoberturaWidget = () => {
    const [cobertura, setCobertura] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCobertura = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/cobertura`);
            if (!response.ok) throw new Error("No se pudo cargar la cobertura");
            const data = await response.json();
            setCobertura(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresco cada 30 segundos para monitoreo real
    useEffect(() => {
        fetchCobertura();
        const interval = setInterval(fetchCobertura, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="text-center py-3"><Spinner size="sm" /> Cargando monitoreo...</div>;
    if (error) return <Alert variant="danger">Error monitoreo: {error}</Alert>;

    // Separamos en críticas (descubiertas) y cubiertas
    const descubiertas = cobertura.filter(c => c.cantidad_activos === 0);
    const cubiertas = cobertura.filter(c => c.cantidad_activos > 0);

    return (
        <Card className="shadow-sm h-100">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">📡 Monitor de Cobertura en Vivo</h5>
                <Badge bg="light" text="dark" className="border">
                    {cubiertas.length} Cubiertas / {descubiertas.length} Alertas
                </Badge>
            </Card.Header>
            <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
                
                {/* SECCIÓN DE ALERTAS (ROJO) */}
                {descubiertas.length > 0 && (
                    <div className="mb-4">
                        <h6 className="text-danger fw-bold mb-2">⚠️ Campañas Descubiertas (Atención)</h6>
                        <Row xs={2} md={3} className="g-2">
                            {descubiertas.map(camp => (
                                <Col key={camp.id}>
                                    <div className="p-2 border border-danger rounded bg-danger-subtle text-danger text-center fw-semibold" style={{fontSize: '0.9rem'}}>
                                        {camp.nombre}
                                    </div>
                                </Col>
                            ))}
                        </Row>
                    </div>
                )}

                {/* SECCIÓN OK (VERDE) */}
                {cubiertas.length > 0 && (
                    <div>
                        <h6 className="text-success fw-bold mb-2">✅ Campañas Cubiertas</h6>
                        <Row xs={1} md={2} className="g-2">
                            {cubiertas.map(camp => (
                                <Col key={camp.id}>
                                    <div className="p-2 border border-success rounded bg-white d-flex justify-content-between align-items-center">
                                        <span className="fw-medium text-truncate">{camp.nombre}</span>
                                        
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={
                                                <Tooltip id={`tooltip-${camp.id}`}>
                                                    {camp.analistas.map(a => <div key={a.nombre}>{a.nombre}</div>)}
                                                </Tooltip>
                                            }
                                        >
                                            <Badge bg="success" className="cursor-pointer">
                                                👤 {camp.cantidad_activos}
                                            </Badge>
                                        </OverlayTrigger>
                                    </div>
                                </Col>
                            ))}
                        </Row>
                    </div>
                )}

                {cobertura.length === 0 && <p className="text-center text-muted">No hay campañas configuradas.</p>}
            </Card.Body>
        </Card>
    );
};

export default CoberturaWidget;