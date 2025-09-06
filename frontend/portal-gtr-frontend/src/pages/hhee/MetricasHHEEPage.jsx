import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Row, Col, Table, Badge } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';
import { decimalToHHMM } from '../../utils/timeUtils';

// Pequeño componente para las tarjetas de KPIs
const KpiCard = ({ title, value, variant = 'primary' }) => (
    <Card className={`bg-${variant} text-white text-center shadow-sm h-100`}>
        <Card.Body>
            <Card.Title as="h3">{value}</Card.Title>
            <Card.Text className="mb-0">{title}</Card.Text>
        </Card.Body>
    </Card>
);

function MetricasHHEEPage() {
    const { authToken } = useAuth();
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [metricas, setMetricas] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handlePeriodoChange = (seleccion) => {
        let fechaInicio, fechaFin;
        const hoy = new Date();
        switch (seleccion) {
            case 'actual':
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), 25);
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 26);
                break;
            case 'anterior':
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 25);
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 26);
                break;
            default:
                setFechaInicio(''); setFechaFin(''); return;
        }
        setFechaInicio(formatDate(fechaInicio));
        setFechaFin(formatDate(fechaFin));
    };
    
    const fetchMetricas = async (e) => {
        if (e) e.preventDefault();
        if (!fechaInicio || !fechaFin) {
            setError("Por favor, seleccione un rango de fechas.");
            return;
        }
        setLoading(true);
        setError(null);
        setMetricas(null);

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/metricas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ fecha_inicio: fechaInicio, fecha_fin: fechaFin, formato: "OPERACIONES" }), // formato es requerido
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "No se pudieron cargar las métricas.");
            }
            
            const data = await response.json();
            setMetricas(data);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="py-4">
            <h1 className="mb-4">Dashboard de Métricas HHEE</h1>
            <Card className="shadow-sm mb-4">
                <Card.Body>
                    <Form onSubmit={fetchMetricas}>
                        <Row className="align-items-end g-3">
                            <Col md={3}><Form.Group><Form.Label>Período Rápido</Form.Label><Form.Select onChange={(e) => handlePeriodoChange(e.target.value)}><option value="">Seleccionar...</option><option value="actual">Período actual</option><option value="anterior">Período anterior</option></Form.Select></Form.Group></Col>
                            <Col md={3}><Form.Group><Form.Label>Fecha de Inicio</Form.Label><Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required /></Form.Group></Col>
                            <Col md={3}><Form.Group><Form.Label>Fecha de Fin</Form.Label><Form.Control type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required /></Form.Group></Col>
                            <Col md={3}><Button variant="primary" type="submit" className="w-100" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Consultar Métricas'}</Button></Col>
                        </Row>
                    </Form>
                </Card.Body>
            </Card>

            {error && <Alert variant="danger">{error}</Alert>}

            {metricas && (
                <>
                    {/* --- KPIs ACTUALIZADOS --- */}
                    <Row className="g-4 mb-4">
                        <Col md={3}><KpiCard title="Total HHEE Declaradas (OP)" value={decimalToHHMM(metricas.total_hhee_declaradas)} variant="success" /></Col>
                        <Col md={3}><KpiCard title="Total HHEE Aprobadas (RRHH)" value={decimalToHHMM(metricas.total_hhee_aprobadas_rrhh)} variant="primary" /></Col>
                        <Col md={6}><KpiCard title="Empleado con más HHEE Declaradas" value={metricas.empleado_top ? `${metricas.empleado_top.nombre_empleado} (${decimalToHHMM(metricas.empleado_top.total_horas_declaradas)})` : 'N/A'} variant="info" /></Col>
                    </Row>

                    <Row className="g-4">
                        <Col lg={6}>
                            <Card className="shadow-sm">
                                <Card.Header as="h5">Desglose por Empleado</Card.Header>
                                <Table hover responsive>
                                    <thead><tr><th>Empleado</th><th>Declaradas (OP)</th><th>Aprobadas (RRHH)</th></tr></thead>
                                    <tbody>
                                        {metricas.desglose_por_empleado.map((emp) => (
                                            <tr key={emp.rut}>
                                                <td>{emp.nombre_empleado}</td>
                                                <td><strong>{decimalToHHMM(emp.total_horas_declaradas)}</strong></td>
                                                <td><Badge bg="primary">{decimalToHHMM(emp.total_horas_rrhh)}</Badge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </Card>
                        </Col>
                        <Col lg={6}>
                            <Card className="shadow-sm">
                                <Card.Header as="h5">Top 10 Campañas con más HHEE</Card.Header>
                                <Table hover responsive>
                                    <thead><tr><th>Campaña</th><th>Declaradas (OP)</th><th>Aprobadas (RRHH)</th></tr></thead>
                                    <tbody>
                                        {metricas.desglose_por_campana.slice(0, 10).map((camp) => (
                                            <tr key={camp.nombre_campana}>
                                                <td>{camp.nombre_campana}</td>
                                                <td><strong>{decimalToHHMM(camp.total_horas_declaradas)}</strong></td>
                                                <td><Badge bg="primary">{decimalToHHMM(camp.total_horas_rrhh)}</Badge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
        </Container>
    );
}

export default MetricasHHEEPage;