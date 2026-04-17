import React, { useState, useEffect } from 'react';
import { Card, Table, Form, Row, Col, Badge, Button, Spinner } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../../api';

const HistoricoReporteriaWidget = () => {
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filtros, setFiltros] = useState({
        desde: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        hasta: new Date().toISOString().split('T')[0]
    });

    const cargarHistorico = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/api/reporteria/historico?desde=${filtros.desde}&hasta=${filtros.hasta}`);
            if (res.ok) setHistorico(await res.json());
        } catch (e) {
            console.error("Error cargando historico:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarHistorico();
    }, []);

    return (
        <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white border-0 pt-3 pb-0">
                <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-muted mb-0">📜 AUDITORÍA DE REPORTERÍA</h6>
                    <Badge bg="secondary" pill>{historico.length}</Badge>
                </div>
            </Card.Header>
            <Card.Body>
                <Row className="g-2 mb-3">
                    <Col md={5}>
                        <Form.Control 
                            size="sm" 
                            type="date" 
                            value={filtros.desde} 
                            onChange={(e) => setFiltros({...filtros, desde: e.target.value})}
                        />
                    </Col>
                    <Col md={5}>
                        <Form.Control 
                            size="sm" 
                            type="date" 
                            value={filtros.hasta} 
                            onChange={(e) => setFiltros({...filtros, hasta: e.target.value})}
                        />
                    </Col>
                    <Col md={2}>
                        <Button variant="primary" size="sm" className="w-100" onClick={cargarHistorico} disabled={loading}>
                            {loading ? <Spinner animation="border" size="sm" /> : '🔍'}
                        </Button>
                    </Col>
                </Row>

                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <Table hover responsive size="sm" className="align-middle small">
                        <thead className="bg-light sticky-top">
                            <tr>
                                <th>Fecha/Hora</th>
                                <th>Reporte</th>
                                <th>Analista</th>
                                <th>Estado / Comentario</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historico.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-4 text-muted">No se encontraron reportes en este rango.</td></tr>
                            ) : (
                                historico.map((h) => (
                                    <tr key={h.id}>
                                        <td className="text-muted" style={{fontSize: '0.7rem'}}>
                                            {new Date(h.actualizada_en).toLocaleString('es-AR', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td>
                                            <div className="fw-bold">{h.nombre}</div>
                                            <Badge bg="info" style={{fontSize: '0.6rem'}}>{h.categoria}</Badge>
                                        </td>
                                        <td>
                                            {h.analista ? (
                                                <Badge bg="light" text="dark" className="border fw-normal">
                                                    👤 {h.analista.nombre} {h.analista.apellido}
                                                </Badge>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <div className="mb-1">
                                                {h.estado === 'COMPLETADO' ? (
                                                    <Badge bg="success" style={{fontSize: '0.65rem'}}>✅ Completado</Badge>
                                                ) : h.estado === 'EN_PROCESO' ? (
                                                    <Badge bg="info" style={{fontSize: '0.65rem'}}>⏳ En Proceso</Badge>
                                                ) : (
                                                    <Badge bg="danger" style={{fontSize: '0.65rem'}}>🚨 Pendiente / Vencida</Badge>
                                                )}
                                            </div>
                                            <div className="text-truncate text-muted" style={{maxWidth: '200px', fontSize: '0.8rem'}} title={h.comentario_final}>
                                                {h.comentario_final || '(sin comentario)'}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
};

export default HistoricoReporteriaWidget;
