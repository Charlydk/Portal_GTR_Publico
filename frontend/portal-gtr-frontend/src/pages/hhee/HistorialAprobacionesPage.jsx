// src/pages/hhee/HistorialAprobacionesPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

    const handlePeriodoChange = (seleccion) => {
        const hoy = new Date();
        const aISO = (fecha) => fecha.toISOString().split('T')[0];
        let nuevasFechas = {};

        if (seleccion === 'actual') {
            nuevasFechas = getPeriodoActual();
        } else if (seleccion === 'anterior') {
            const fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 25);
            const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 26);
            nuevasFechas = { inicio: aISO(fechaInicio), fin: aISO(fechaFin) };
        } else {
            return;
        }
        setFechas(nuevasFechas);
    };

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

    const totales = useMemo(() => {
        const resultado = historial.reduce((acc, item) => {
            const gv = item.datos_geovictoria || {};
            let horasRRHH = 0;
            if (item.tipo === 'ANTES_TURNO') horasRRHH = gv.hhee_autorizadas_antes_gv || 0;
            else if (item.tipo === 'DESPUES_TURNO') horasRRHH = gv.hhee_autorizadas_despues_gv || 0;
            else if (item.tipo === 'DIA_DESCANSO') horasRRHH = (gv.hhee_autorizadas_antes_gv || 0) + (gv.hhee_autorizadas_despues_gv || 0);
            
            if (item.estado === 'APROBADA') {
                acc.solicitadas_validas += item.horas_solicitadas;
                acc.aprobadas += item.horas_aprobadas;
            } else if (item.estado === 'RECHAZADA') {
                acc.rechazadas += item.horas_solicitadas;
            }
            acc.rrhh += horasRRHH;
            return acc;
        }, { solicitadas_validas: 0, aprobadas: 0, rrhh: 0, rechazadas: 0 });
        
        return resultado;
    }, [historial]);
    
    // --- MEJORA 2: Nuevo estado "CARGADO" ---
    const getStatusBadge = (item) => {
        const gv = item.datos_geovictoria || {};
        const horasRRHH = (gv.hhee_autorizadas_antes_gv || 0) + (gv.hhee_autorizadas_despues_gv || 0);

        if (item.estado === 'APROBADA' && horasRRHH > 0) {
            return <Badge bg="info">CARGADO</Badge>; // Azul para "Cargado"
        }
        const variants = { APROBADA: 'success', RECHAZADA: 'danger' };
        return <Badge bg={variants[item.estado] || 'secondary'}>{item.estado}</Badge>;
    };
    
    // --- MEJORA 1: Mapa para abreviaturas de tipo ---
    const tipoMap = {
        'ANTES_TURNO': 'A',
        'DESPUES_TURNO': 'D',
        'DIA_DESCANSO': 'OFF'
    };

    return (
        <Container fluid className="py-4 px-xl-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center">Reporte de Gestiones de HHEE</Card.Header>
                <Card.Body>
                    <Form className="mb-4">
                        <Row className="align-items-end g-3">
                            <Col md={3}><Form.Group><Form.Label>Período Rápido</Form.Label><Form.Select defaultValue="actual" onChange={(e) => handlePeriodoChange(e.target.value)}><option value="actual">Periodo Actual</option><option value="anterior">Periodo Anterior</option><option value="">Personalizado</option></Form.Select></Form.Group></Col>
                            <Col md={3}><Form.Group><Form.Label>Fecha Inicio</Form.Label><Form.Control type="date" value={fechas.inicio} onChange={e => setFechas(f => ({...f, inicio: e.target.value}))} /></Form.Group></Col>
                            <Col md={3}><Form.Group><Form.Label>Fecha Fin</Form.Label><Form.Control type="date" value={fechas.fin} onChange={e => setFechas(f => ({...f, fin: e.target.value}))} /></Form.Group></Col>
                            <Col md={3}><Button className="w-100" onClick={fetchHistorial} disabled={loading}>{loading ? <Spinner size="sm"/> : 'Consultar Historial'}</Button></Col>
                        </Row>
                    </Form>
                    
                    <Card className="mb-4 text-center">
                        <Card.Body className="p-2">
                            <span className="me-3">Solicitadas: <Badge bg="primary">{decimalToHHMM(totales.solicitadas_validas)}</Badge></span>
                            <span className="me-3">Rechazadas: <Badge bg="danger">{decimalToHHMM(totales.rechazadas)}</Badge></span>
                            <span className="me-3">Aprobadas: <Badge bg="success">{decimalToHHMM(totales.aprobadas)}</Badge></span>
                            <span>Cargadas RRHH: <Badge bg="dark">{decimalToHHMM(totales.rrhh)}</Badge></span>
                        </Card.Body>
                    </Card>

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
                                    <th>H. Cargadas (RRHH)</th>
                                    <th>Estado Final</th>
                                    <th>Comentario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.length > 0 ? (
                                    historial.map(item => {
                                        const gv = item.datos_geovictoria || {};
                                        // --- BUG FIX: Mostrar horas RRHH específicas por tipo ---
                                        let horasRRHH = 0;
                                        if (item.tipo === 'ANTES_TURNO') {
                                            horasRRHH = gv.hhee_autorizadas_antes_gv || 0;
                                        } else if (item.tipo === 'DESPUES_TURNO') {
                                            horasRRHH = gv.hhee_autorizadas_despues_gv || 0;
                                        } else if (item.tipo === 'DIA_DESCANSO') {
                                            horasRRHH = (gv.hhee_autorizadas_antes_gv || 0) + (gv.hhee_autorizadas_despues_gv || 0);
                                        }

                                        return (
                                            <tr key={item.id}>
                                                <td>{formatDateTime(item.fecha_decision)}</td>
                                                <td>{item.solicitante.nombre} {item.solicitante.apellido}</td>
                                                {/* --- MEJORA 1: Fecha con tipo abreviado --- */}
                                                <td>
                                                    {new Date(item.fecha_hhee + 'T00:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                                                    <Badge pill bg="secondary" className="ms-2">{tipoMap[item.tipo] || item.tipo}</Badge>
                                                </td>
                                                <td>{decimalToHHMM(item.horas_solicitadas)}</td>
                                                <td className="fw-bold">{decimalToHHMM(item.horas_aprobadas)}</td>
                                                <td>{decimalToHHMM(horasRRHH)}</td>
                                                <td>{getStatusBadge(item)}</td>
                                                <td>{item.comentario_supervisor || '---'}</td>
                                            </tr>
                                        );
                                    })
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