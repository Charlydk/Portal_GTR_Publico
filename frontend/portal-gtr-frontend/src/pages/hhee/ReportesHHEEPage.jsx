// src/pages/hhee/ReportesHHEEPage.jsx
import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Row, Col, Modal } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';


function ReportesHHEEPage() {
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { authToken, user } = useAuth();
    
    // --- NUEVO: Estado para el modal de confirmación ---
    const [showConfirmModal, setShowConfirmModal] = useState(false);

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

    const handleExportar = async (formato, marcarComoReportado = false) => {
        if (!fechaInicio || !fechaFin) {
            setError("Por favor, seleccione una fecha de inicio y de fin.");
            return;
        }
        setLoading(true);
        setError(null);
        setShowConfirmModal(false); // Cerramos el modal

        // --- CAMBIO: Decidimos a qué endpoint llamar ---
        const endpoint = marcarComoReportado ? '/hhee/exportar-y-marcar-rrhh' : '/hhee/exportar';

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ fecha_inicio: fechaInicio, fecha_fin: fechaFin, formato: formato }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "No se pudo generar el reporte.");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_hhee_${formato}_${fechaInicio}_a_${fechaFin}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA DE ROLES PARA LOS BOTONES ---
    const isGtrAdmin = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');
    const isOpsSupervisor = user && user.role === 'SUPERVISOR_OPERACIONES';

    return (
        <Container className="py-5">
            <Row className="justify-content-center">
                <Col md={8}>
                    <Card className="shadow-lg">
                        <Card.Header as="h2" className="text-center bg-primary text-white">
                            Panel de Exportación de HHEE
                        </Card.Header>
                        <Card.Body className="p-4">
                            <Card.Title>Seleccionar Rango de Fechas</Card.Title>
                            <Card.Text className="text-muted mb-4">
                                Seleccioná el período para el cual querés generar el reporte de Horas Extras validadas.
                            </Card.Text>
                            
                            {error && <Alert variant="danger">{error}</Alert>}

                            <Form>
                                <Row className="align-items-end">
                                    {/* --- NUEVO SELECTOR DE PERÍODO --- */}
                                    <Col md={4}>
                                        <Form.Group controlId="select-periodo" className="mb-3">
                                            <Form.Label>Período Rápido</Form.Label>
                                            <Form.Select onChange={(e) => handlePeriodoChange(e.target.value)}>
                                                <option value="">Seleccionar...</option>
                                                <option value="actual">Período actual</option>
                                                <option value="anterior">Período anterior (-1)</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    {/* --- FIN DEL NUEVO SELECTOR --- */}
                                    <Col md={4}><Form.Group controlId="fecha-inicio" className="mb-3"><Form.Label>Fecha de Inicio</Form.Label><Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required /></Form.Group></Col>
                                    <Col md={4}><Form.Group controlId="fecha-fin" className="mb-3"><Form.Label>Fecha de Fin</Form.Label><Form.Control type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required /></Form.Group></Col>
                                </Row>
                                <div className="d-grid gap-2 mt-4">
                                    {/* Botón de Operaciones: visible para todos los roles con acceso */}
                                    {(isGtrAdmin || isOpsSupervisor) && (
                                        <Button variant="info" onClick={() => handleExportar('OPERACIONES')} disabled={loading}>
                                            {loading ? <Spinner size="sm" /> : 'Exportar para Control (Operaciones)'}
                                        </Button>
                                    )}
                                    {/* Botones de RRHH: solo para GTR */}
                                    {isGtrAdmin && (
                                        <>
                                            <Button variant="success" onClick={() => handleExportar('RRHH')} disabled={loading}>
                                                {loading ? <Spinner size="sm" /> : 'Descargar Reporte RRHH (Vista Previa)'}
                                            </Button>
                                            <Button variant="danger" onClick={() => setShowConfirmModal(true)} disabled={loading}>
                                                {loading ? <Spinner size="sm" /> : 'Marcar como Enviado y Descargar para RRHH'}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
                                    <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>⚠️ Confirmación Final</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Estás a punto de generar el reporte final para RRHH.</p>
                    <p>Esta acción marcará todos los registros de HHEE incluidos en este reporte como **"Enviados"** y no volverán a aparecer en futuras exportaciones para RRHH.</p>
                    <p className="fw-bold">¿Estás seguro de que deseas continuar?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Cancelar</Button>
                    <Button variant="danger" onClick={() => handleExportar('RRHH', true)}>
                        Sí, Marcar y Descargar
                    </Button>
                </Modal.Footer>
            </Modal>

        </Container>
    );
}

export default ReportesHHEEPage;