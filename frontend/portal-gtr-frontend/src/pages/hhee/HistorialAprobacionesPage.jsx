// src/pages/hhee/HistorialAprobacionesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Spinner, Alert, Form, Button, Row, Col, Table, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';
import { decimalToHHMM } from '../../utils/timeUtils';
import { formatDateTime } from '../../utils/dateFormatter';

const getPeriodoActual = () => {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    const fechaFin = new Date(anioActual, mesActual, 25);
    const fechaInicio = new Date(anioActual, mesActual - 1, 26);
    const aISO = (fecha) => fecha.toISOString().split('T')[0];
    return { inicio: aISO(fechaInicio), fin: aISO(fechaFin) };
};

function HistorialAprobacionesPage() {
    const { authToken } = useAuth();
    const [historial, setHistorial] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fechas, setFechas] = useState(getPeriodoActual());

    const fetchHistorial = useCallback(async () => {
        if (!authToken) return;
        setLoading(true);
        setError(null);
        const url = `${API_BASE_URL}/hhee/solicitudes/historial/?fecha_inicio=${fechas.inicio}&fecha_fin=${fechas.fin}`;
        try {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${authToken}` } });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'No se pudo cargar el historial.');
            }
            const data = await response.json();
            setHistorial(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, fechas]);

    useEffect(() => {
        fetchHistorial();
    }, [fetchHistorial]);

    const getStatusBadge = (estado) => {
        const variants = { APROBADA: 'success', RECHAZADA: 'danger' };
        return <Badge bg={variants[estado] || 'secondary'}>{estado}</Badge>;
    };

    return (
        <Container fluid className="py-4 px-xl-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center">Reporte de Gestiones de HHEE</Card.Header>
                <Card.Body>
                    <Form className="mb-4">
                        <Row className="align-items-end g-3">
                            <Col md={4}><Form.Group><Form.Label>Fecha Inicio</Form.Label><Form.Control type="date" value={fechas.inicio} onChange={e => setFechas(f => ({...f, inicio: e.target.value}))} /></Form.Group></Col>
                            <Col md={4}><Form.Group><Form.Label>Fecha Fin</Form.Label><Form.Control type="date" value={fechas.fin} onChange={e => setFechas(f => ({...f, fin: e.target.value}))} /></Form.Group></Col>
                            <Col md={4}><Button className="w-100" onClick={fetchHistorial} disabled={loading}>{loading ? <Spinner size="sm"/> : 'Consultar Historial'}</Button></Col>
                        </Row>
                    </Form>
                    
                    {error && <Alert variant="danger">{error}</Alert>}
                    
                    {loading ? <div className="text-center"><Spinner /></div> : (
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>Fecha Decisión</th>
                                    <th>Analista</th>
                                    <th>Fecha HHEE</th>
                                    <th>H. Solicitadas</th>
                                    <th>H. Aprobadas</th>
                                    <th>Estado Final</th>
                                    <th>Comentario</th>
                                    <th>Gestionado Por</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.length > 0 ? (
                                    historial.map(item => (
                                        <tr key={item.id}>
                                            <td>{formatDateTime(item.fecha_decision)}</td>
                                            <td>{item.solicitante.nombre} {item.solicitante.apellido}</td>
                                            <td>{new Date(item.fecha_hhee + 'T00:00:00-03:00').toLocaleDateString('es-AR')}</td>
                                            <td>{decimalToHHMM(item.horas_solicitadas)}</td>
                                            <td className="fw-bold">{decimalToHHMM(item.horas_aprobadas)}</td>
                                            <td>{getStatusBadge(item.estado)}</td>
                                            <td>{item.comentario_supervisor || '---'}</td>
                                            <td>{item.supervisor?.nombre || 'N/A'}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="8" className="text-center">No hay registros para el período seleccionado.</td></tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
                 <Card.Footer className="text-end">
                    <Link to="/aprobar-hhee" className="btn btn-secondary">
                        Volver al Panel de Aprobación
                    </Link>
                </Card.Footer>
            </Card>
        </Container>
    );
}

export default HistorialAprobacionesPage;