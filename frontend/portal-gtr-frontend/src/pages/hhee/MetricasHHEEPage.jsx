import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Row, Col, Table, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { API_BASE_URL, fetchWithAuth } from '../../api';
import { decimalToHHMM } from '../../utils/timeUtils';
import { useAuth } from '../../hooks/useAuth'; //

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
    const { user } = useAuth(); // Obtenemos el usuario
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
        if (!fechaInicio || !fechaFin) { setError("Por favor, seleccione un rango de fechas."); return; }
        // Validación de 31 días
        const dInicio = new Date(fechaInicio);
        const dFin = new Date(fechaFin);
        const diffDays = Math.ceil(Math.abs(dFin - dInicio) / (1000 * 60 * 60 * 24));
        if (diffDays > 31) { setError("El rango de fechas no puede ser mayor a 31 días."); return; }

        setLoading(true); setError(null); setMetricas(null); setMetricasPendientes(null);
        try {
            const pendientesUrl = `${API_BASE_URL}/hhee/metricas-pendientes/?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
            const [metricasRes, pendientesRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/hhee/metricas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
                }),
                fetchWithAuth(pendientesUrl, {})
            ]);
            
            if (!metricasRes.ok) { const d = await metricasRes.json(); throw new Error(d.detail); }
            if (!pendientesRes.ok) { const d = await pendientesRes.json(); throw new Error(d.detail); }
            
            setMetricas(await metricasRes.json());
            setMetricasPendientes(await pendientesRes.json());
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    // Determinamos el perfil
    const isOpsSupervisor = user?.role === 'SUPERVISOR_OPERACIONES';
    const isAdminGTR = user?.role === 'SUPERVISOR' || user?.role === 'RESPONSABLE';

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

            {/* Ahora toda la sección de resultados (incluyendo pendientes) solo se muestra si hay métricas */}
            {metricas && metricasPendientes && (
                <>
                    {/* 1. SECCIÓN PENDIENTES (GLOBAL para GTR, PERSONAL para OP) */}
                    <h5 className="mb-3 text-secondary">Validación Manual (Portal de Carga)</h5>
                    <Row className="g-4 mb-4">
                        <Col md={4}>
                            {/* Si es OPS, el link no hace nada especial, si es GTR va a pendientes globales */}
                            <KpiCard 
                                title="Total Pendientes (Ir a Gestionar)" 
                                value={metricasPendientes.total_pendientes} 
                                variant={metricasPendientes.total_pendientes > 0 ? 'danger' : 'success'}
                                linkTo={`/hhee/portal?view=pendientes`} 
                                clickable={true}
                            />
                        </Col>
                        <Col md={4}><KpiCard title="Por Cambio de Turno" value={metricasPendientes.por_cambio_turno} variant="secondary" /></Col>
                        <Col md={4}><KpiCard title="Por Corrección de Marcas" value={metricasPendientes.por_correccion_marcas} variant="secondary" /></Col>
                    </Row>

                    {/* 2. CONTROL GENERAL (SOLICITUDES) - SOLO GTR ADMIN */}
                    {isAdminGTR && (
                        <>
                            <h5 className="mb-3 text-secondary">Control General (Flujo de Solicitudes)</h5>
                            <Row className="g-4 mb-4">
                                <Col md={4}>
                                    <KpiCard title="Solicitudes Pendientes" value={metricas.total_solicitudes_pendientes} variant={metricas.total_solicitudes_pendientes > 0 ? 'warning' : 'success'} />
                                </Col>
                                <Col md={4}>
                                    <KpiCard title="Total Aprobado (Solic.)" value={decimalToHHMM(metricas.total_horas_aprobadas_solicitud)} variant="success" />
                                </Col>
                                <Col md={4}>
                                    <KpiCard title="Total Rechazado (Solic.)" value={decimalToHHMM(metricas.total_horas_rechazadas_solicitud)} variant="danger" />
                                </Col>
                            </Row>
                        </>
                    )}

                    {/* 3. COMPARATIVA OP vs RRHH (PARA TODOS) */}
                    <h5 className="mb-3 text-secondary">Consolidado Operaciones vs. RRHH</h5>
                    <Row className="g-4 mb-4">
                        <Col md={6}><KpiCard title="Total HHEE Declaradas (OP)" value={decimalToHHMM(metricas.total_hhee_declaradas)} variant="dark" /></Col>
                        <Col md={6}><KpiCard title="Total HHEE Aprobadas (RRHH)" value={decimalToHHMM(metricas.total_hhee_aprobadas_rrhh)} variant="primary" /></Col>
                    </Row>

                    {/* 4. TABLAS DETALLADAS */}
                    <Row className="g-4">
                        {/* TABLA DE CAMPAÑAS (Visible para todos) */}
                        <Col lg={isOpsSupervisor ? 6 : 12}>
                            <Card className="shadow-sm h-100">
                                <Card.Header as="h5">Desglose por Campaña</Card.Header>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    <Table hover responsive size="sm" className="mb-0">
                                        <thead style={{position: 'sticky', top: 0, background: 'white'}}>
                                            <tr><th>Campaña</th><th className="text-end">Declaradas</th><th className="text-end">RRHH</th></tr>
                                        </thead>
                                        <tbody>
                                            {metricas.desglose_por_campana.map((camp) => (
                                                <tr key={camp.nombre_campana}>
                                                    <td>{camp.nombre_campana}</td>
                                                    <td className="text-end"><strong>{decimalToHHMM(camp.total_horas_declaradas)}</strong></td>
                                                    <td className="text-end"><Badge bg="primary">{decimalToHHMM(camp.total_horas_rrhh)}</Badge></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </Card>
                        </Col>

                        {/* TABLA DE EMPLEADOS (Solo para OPS SUPERVISOR) */}
                        {isOpsSupervisor && (
                            <Col lg={6}>
                                <Card className="shadow-sm h-100">
                                    <Card.Header as="h5">Mis Agentes</Card.Header>
                                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        <Table hover responsive size="sm" className="mb-0">
                                            <thead style={{position: 'sticky', top: 0, background: 'white'}}>
                                                <tr><th>Empleado</th><th className="text-end">Declaradas</th><th className="text-end">RRHH</th></tr>
                                            </thead>
                                            <tbody>
                                                {metricas.desglose_por_empleado.map((emp) => (
                                                    <tr key={emp.rut}>
                                                        <td>
                                                            {/* Enlace Clickable para ir al Portal de Carga */}
                                                            <Link to={`/hhee/portal?rut=${emp.rut}`} title="Ver en Portal de Carga">
                                                                {emp.nombre_empleado}
                                                            </Link>
                                                        </td>
                                                        <td className="text-end"><strong>{decimalToHHMM(emp.total_horas_declaradas)}</strong></td>
                                                        <td className="text-end"><Badge bg="primary">{decimalToHHMM(emp.total_horas_rrhh)}</Badge></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Card>
                            </Col>
                        )}
                    </Row>
                </>
            )}
        </Container>
    );
}

export default MetricasHHEEPage;