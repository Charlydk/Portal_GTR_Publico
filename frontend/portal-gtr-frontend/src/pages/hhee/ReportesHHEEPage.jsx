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
    const [success, setSuccess] = useState(null);
    const { authToken, user } = useAuth();
    
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

    const handleExportar = async (formato) => {
        if (!fechaInicio || !fechaFin) {
            setError("Por favor, seleccione una fecha de inicio y de fin.");
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/exportar`, {
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
    
    const handleConfirmarEnvio = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setShowConfirmModal(false);
        
        try {
            const response = await fetch(`${API_BASE_URL}/hhee/marcar-como-reportado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al confirmar el envío.');
            }
            const result = await response.json();
            setSuccess(result.detail);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isGtrAdmin = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');
    const isOpsSupervisor = user && user.role === 'SUPERVISOR_OPERACIONES';

    return (
        <Container className="py-5">
            <Row className="justify-content-center">
                <Col md={8}>
                    <Card className="shadow-lg">
                        <Card.Header as="h2" className="text-center bg-primary text-white">Panel de Exportación de HHEE</Card.Header>
                        <Card.Body className="p-4">
                            <Card.Title>Seleccionar Rango de Fechas</Card.Title>
                            {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
                            {success && <Alert variant="success" className="mt-3">{success}</Alert>}
                            
                            <Form>
                                <Row className="align-items-end g-3">
                                    <Col md={4}>
                                        <Form.Group controlId="select-periodo" className="mb-3">
                                            <Form.Label>Período Rápido</Form.Label>
                                            <Form.Select onChange={(e) => handlePeriodoChange(e.target.value)}>
                                                <option value="">Seleccionar...</option>
                                                <option value="actual">Periodo actual</option>
                                                <option value="anterior">Periodo anterior (-1)</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}><Form.Group controlId="fecha-inicio" className="mb-3"><Form.Label>Fecha de Inicio</Form.Label><Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required /></Form.Group></Col>
                                    <Col md={4}><Form.Group controlId="fecha-fin" className="mb-3"><Form.Label>Fecha de Fin</Form.Label><Form.Control type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required /></Form.Group></Col>
                                </Row>
                                <div className="d-grid gap-2 mt-4">
                                    {(isGtrAdmin || isOpsSupervisor) && (
                                        <Button variant="info" onClick={() => handleExportar('OPERACIONES')} disabled={loading}>
                                            {loading ? <Spinner size="sm" /> : 'Exportar para Control (Operaciones)'}
                                        </Button>
                                    )}
                                    {isGtrAdmin && (
                                        <>
                                            <Button variant="success" onClick={() => handleExportar('RRHH')} disabled={loading}>
                                                {loading ? <Spinner size="sm" /> : '1. Descargar Reporte RRHH (Vista Previa)'}
                                            </Button>
                                            <Button variant="danger" onClick={() => setShowConfirmModal(true)} disabled={loading}>
                                                {loading ? <Spinner size="sm" /> : '2. Confirmar Envío del Período a RRHH'}
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
                    <Modal.Title>⚠️ Confirmación Final de Envío</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Estás a punto de **confirmar el envío** del período del <strong>{fechaInicio}</strong> al <strong>{fechaFin}</strong>.</p>
                    <p>Esta acción marcará todos los registros de HHEE de este período como **"Enviados"** y no se podrán volver a incluir en futuros reportes para RRHH.</p>
                    <p className="fw-bold">Asegúrate de haber descargado y enviado el archivo a ADP antes de continuar. ¿Estás seguro?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Cancelar</Button>
                    <Button variant="danger" onClick={handleConfirmarEnvio} disabled={loading}>
                        {loading ? <Spinner size="sm" /> : 'Sí, Confirmar Envío'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default ReportesHHEEPage;