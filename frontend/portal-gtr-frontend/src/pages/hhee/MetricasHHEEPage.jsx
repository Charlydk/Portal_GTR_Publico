import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Row, Col, Table, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { API_BASE_URL, fetchWithAuth } from '../../api';
import { decimalToHHMM } from '../../utils/timeUtils';

const KpiCard = ({ title, value, variant = 'primary', linkTo = null }) => {
    const cardContent = (
        <Card className={`bg-${variant} text-white text-center shadow-sm h-100`}>
            <Card.Body>
                <Card.Title as="h3">{value}</Card.Title>
                <Card.Text className="mb-0">{title}</Card.Text>
            </Card.Body>
        </Card>
    );
    if (linkTo) {
        return <Link to={linkTo} className="text-decoration-none h-100">{cardContent}</Link>;
    }
    return cardContent;
};

function MetricasHHEEPage() {

    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [metricas, setMetricas] = useState(null);
    const [metricasPendientes, setMetricasPendientes] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const formatDate = (date) => date.toISOString().split('T')[0];

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
        
        // --- INICIO DE LA NUEVA VALIDACIÓN ---
        if (!fechaInicio || !fechaFin) {
            setError("Por favor, seleccione un rango de fechas.");
            return;
        }

        const dInicio = new Date(fechaInicio);
        const dFin = new Date(fechaFin);
        const diffTime = Math.abs(dFin - dInicio);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 31) {
            setError("El rango de fechas no puede ser mayor a 31 días para evitar errores de consulta.");
            return;
        }
        // --- FIN DE LA NUEVA VALIDACIÓN ---

        setLoading(true); setError(null); setMetricas(null); setMetricasPendientes(null);
        try {

            // Creamos la URL para el endpoint de pendientes con las fechas
            const pendientesUrl = `${API_BASE_URL}/hhee/metricas-pendientes/?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;

            const [metricasRes, pendientesRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/hhee/metricas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
                }),
                // Usamos la nueva URL que incluye las fechas
                fetchWithAuth(pendientesUrl, {})
            ]);
            
            if (!metricasRes.ok) { const errorData = await metricasRes.json(); throw new Error(errorData.detail); }
            if (!pendientesRes.ok) { const errorData = await pendientesRes.json(); throw new Error(errorData.detail); }
            const metricasData = await metricasRes.json();
            const pendientesData = await pendientesRes.json();
            setMetricas(metricasData);
            setMetricasPendientes(pendientesData);
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    return (
        <Container className="py-4">
            <h1 className="mb-4">Dashboard de Métricas HHEE</h1>
            
            <Card className="shadow-sm mb-4">
                <Card.Body>
                    <Card.Title>Consultar Métricas por Período</Card.Title>
                    <Form onSubmit={fetchMetricas}>
                        <Row className="align-items-end g-3">
                            <Col md={3}><Form.Group><Form.Label>Período Rápido</Form.Label><Form.Select onChange={(e) => handlePeriodoChange(e.target.value)}><option value="">Seleccionar...</option><option value="actual">Actual</option><option value="anterior">Anterior</option></Form.Select></Form.Group></Col>
                            <Col md={3}><Form.Group><Form.Label>Fecha Inicio</Form.Label><Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required /></Form.Group></Col>
                            <Col md={3}><Form.Group><Form.Label>Fecha Fin</Form.Label><Form.Control type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required /></Form.Group></Col>
                            <Col md={3}><Button variant="primary" type="submit" className="w-100" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Consultar'}</Button></Col>
                        </Row>
                    </Form>
                </Card.Body>
            </Card>

            {loading && <div className='text-center mb-4'><Spinner animation="border" /></div>}
            {error && <Alert variant="danger">{error}</Alert>}

            {/* --- INICIO DE LA MODIFICACIÓN --- */}
            {/* Ahora toda la sección de resultados (incluyendo pendientes) solo se muestra si hay métricas */}
            {metricas && metricasPendientes && (
                <>
                    <Card className="shadow-sm mb-4">
                         <Card.Header as="h5" className="bg-light">Resumen de Pendientes de Validación</Card.Header>
                         <Card.Body>
                            <Row className="g-4">
                                <Col md={4}><KpiCard title="Total Pendientes" value={metricasPendientes.total_pendientes} variant={metricasPendientes.total_pendientes > 0 ? 'danger' : 'success'}  /></Col>
                                <Col md={4}><KpiCard title="Por Cambio de Turno" value={metricasPendientes.por_cambio_turno} variant={metricasPendientes.por_cambio_turno > 0 ? 'danger' : 'success'}  /></Col>
                                <Col md={4}><KpiCard title="Por Corrección de Marcas" value={metricasPendientes.por_correccion_marcas} variant={metricasPendientes.por_correccion_marcas > 0 ? 'danger' : 'success'}  /></Col>
                            </Row>
                         </Card.Body>
                    </Card>

                    <Row className="g-4 mb-4">
                        <Col md={3}><KpiCard title="Total HHEE Declaradas (OP)" value={decimalToHHMM(metricas.total_hhee_declaradas)} variant="dark" /></Col>
                        <Col md={3}><KpiCard title="Total HHEE Aprobadas (RRHH)" value={decimalToHHMM(metricas.total_hhee_aprobadas_rrhh)} variant="primary" /></Col>
                        <Col md={6}><KpiCard title="Empleado con más HHEE Declaradas" value={metricas.empleado_top ? `${metricas.empleado_top.nombre_empleado} (${decimalToHHMM(metricas.empleado_top.total_horas_declaradas)})` : 'N/A'} variant="info" /></Col>
                    </Row>
                    <Row className="g-4">
                        <Col lg={6}>
                            <Card className="shadow-sm">
                                <Card.Header as="h5">Desglose por Empleado</Card.Header>
                                <Table hover responsive>
                                    <thead><tr><th>Empleado</th><th>Declaradas (OP)</th><th>Aprobadas (RRHH)</th></tr></thead>
                                    <tbody>{metricas.desglose_por_empleado.map((emp) => (<tr key={emp.rut}><td>{emp.nombre_empleado}</td><td><strong>{decimalToHHMM(emp.total_horas_declaradas)}</strong></td><td><Badge bg="primary">{decimalToHHMM(emp.total_horas_rrhh)}</Badge></td></tr>))}</tbody>
                                </Table>
                            </Card>
                        </Col>
                        <Col lg={6}>
                            <Card className="shadow-sm">
                                <Card.Header as="h5">Top 10 Campañas con más HHEE</Card.Header>
                                <Table hover responsive>
                                    <thead><tr><th>Campaña</th><th>Declaradas (OP)</th><th>Aprobadas (RRHH)</th></tr></thead>
                                    <tbody>{metricas.desglose_por_campana.slice(0, 10).map((camp) => (<tr key={camp.nombre_campana}><td>{camp.nombre_campana}</td><td><strong>{decimalToHHMM(camp.total_horas_declaradas)}</strong></td><td><Badge bg="primary">{decimalToHHMM(camp.total_horas_rrhh)}</Badge></td></tr>))}</tbody>
                                </Table>
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
            {/* --- FIN DE LA MODIFICACIÓN --- */}
        </Container>
    );
}

export default MetricasHHEEPage;