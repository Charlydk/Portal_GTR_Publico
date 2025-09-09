// src/pages/hhee/MisSolicitudesHHEEPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Card, Spinner, Alert, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';
import FormularioSolicitudHHEE from '../../components/hhee/FormularioSolicitudHHEE';
import HistorialSolicitudesHHEE from '../../components/hhee/HistorialSolicitudesHHEE';
import { decimalToHHMM } from '../../utils/timeUtils';

const getPeriodoActual = () => {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    const fechaFin = new Date(anioActual, mesActual, 25);
    const fechaInicio = new Date(anioActual, mesActual - 1, 26);
    const aISO = (fecha) => fecha.toISOString().split('T')[0];
    return { inicio: aISO(fechaInicio), fin: aISO(fechaFin) };
};

function MisSolicitudesHHEEPage() {
    const { authToken } = useAuth();
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitStatus, setSubmitStatus] = useState({ loading: false, error: null, success: null });
    const [fechas, setFechas] = useState(getPeriodoActual());
    const [error, setError] = useState(null);

    // --- NUEVA FUNCIÓN PARA MANEJAR EL SELECTOR DE PERÍODO ---
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
            // Si selecciona "Personalizado" o algo más, no hacemos nada
            return;
        }
        setFechas(nuevasFechas);
    };
    // -------------------------------------------------------------

    const fetchMisSolicitudes = useCallback(async () => {
        if (!authToken || !fechas.inicio || !fechas.fin) return;
        
        const url = `${API_BASE_URL}/hhee/solicitudes/mis-solicitudes/?fecha_inicio=${fechas.inicio}&fecha_fin=${fechas.fin}`;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${authToken}` } });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'No se pudo cargar el historial de solicitudes.');
            }
            const data = await response.json();
            setSolicitudes(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, fechas]);

    useEffect(() => {
        fetchMisSolicitudes();
    }, [fetchMisSolicitudes]);

    const totales = useMemo(() => {
        return solicitudes.reduce((acc, sol) => {
            const gv = sol.datos_geovictoria || {};
            const horasRRHH = (gv.hhee_autorizadas_antes_gv || 0) + (gv.hhee_autorizadas_despues_gv || 0);
            acc.solicitadas += sol.horas_solicitadas;
            if (sol.estado === 'APROBADA') {
                acc.aprobadas += sol.horas_aprobadas;
            }
            acc.rrhh += horasRRHH;
            return acc;
        }, { solicitadas: 0, aprobadas: 0, rrhh: 0 });
    }, [solicitudes]);

    const handleCreateSolicitud = async (formData) => {
        setSubmitStatus({ loading: true, error: null, success: null });
        try {
            const response = await fetch(`${API_BASE_URL}/hhee/solicitudes/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify(formData),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al enviar la solicitud.');
            }
            setSubmitStatus({ loading: false, error: null, success: '¡Solicitud enviada con éxito!' });
            fetchMisSolicitudes();
            return true;
        } catch (err) {
            setSubmitStatus({ loading: false, error: err.message, success: null });
            return false;
        }
    };

    return (
        <Container className="py-5">
            <Card className="shadow-lg mb-4">
                <Card.Header as="h2" className="text-center bg-info text-white">Mis Solicitudes de Horas Extras</Card.Header>
                <Card.Body>
                    <Card.Title>Registrar Horas Extras Realizadas</Card.Title>
                    <FormularioSolicitudHHEE onSubmit={handleCreateSolicitud} loading={submitStatus.loading} error={submitStatus.error} success={submitStatus.success} />
                </Card.Body>
            </Card>

            <Card className="shadow-lg">
                <Card.Body>
                    <Card.Title>Mi Historial</Card.Title>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form>
                        {/* --- SECCIÓN DE FILTROS MODIFICADA --- */}
                        <Row className="align-items-end g-3 mb-3">
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>Período Rápido</Form.Label>
                                    <Form.Select defaultValue="actual" onChange={(e) => handlePeriodoChange(e.target.value)}>
                                        <option value="actual">Periodo Actual</option>
                                        <option value="anterior">Periodo Anterior</option>
                                        <option value="">Personalizado</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={3}><Form.Group><Form.Label>Fecha Inicio</Form.Label><Form.Control type="date" value={fechas.inicio} onChange={e => setFechas(f => ({...f, inicio: e.target.value}))} /></Form.Group></Col>
                            <Col md={3}><Form.Group><Form.Label>Fecha Fin</Form.Label><Form.Control type="date" value={fechas.fin} onChange={e => setFechas(f => ({...f, fin: e.target.value}))} /></Form.Group></Col>
                            <Col md={3}><Button className="w-100" onClick={fetchMisSolicitudes}>Consultar</Button></Col>
                        </Row>
                        {/* ------------------------------------ */}
                    </Form>
                    <div className="mb-3 text-center">
                        <span className="me-3">Solicitadas: <Badge bg="primary">{decimalToHHMM(totales.solicitadas)}</Badge></span>
                        <span className="me-3">Aprobadas: <Badge bg="success">{decimalToHHMM(totales.aprobadas)}</Badge></span>
                        <span>Cargadas RRHH: <Badge bg="dark">{decimalToHHMM(totales.rrhh)}</Badge></span>
                    </div>
                    {loading ? <div className="text-center"><Spinner /></div> : <HistorialSolicitudesHHEE solicitudes={solicitudes} />}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default MisSolicitudesHHEEPage;