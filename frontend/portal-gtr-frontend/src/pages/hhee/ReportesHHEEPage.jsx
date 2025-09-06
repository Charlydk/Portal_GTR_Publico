import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';

function ReportesHHEEPage() {
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { authToken, user } = useAuth();

    // --- INICIO DE LA NUEVA LÓGICA ---
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
    // --- FIN DE LA NUEVA LÓGICA ---

    const handleExportar = async (formato) => {
        if (!fechaInicio || !fechaFin) {
            setError("Por favor, seleccione una fecha de inicio y de fin.");
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/exportar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
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
                                <div className="d-grid gap-2 mt-3">
                                    {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                                        <Button variant="success" onClick={() => handleExportar('RRHH')} disabled={loading}>
                                            {loading ? <Spinner size="sm" /> : 'Exportar para RRHH (Formato ADP)'}
                                        </Button>
                                    )}
                                    <Button variant="info" onClick={() => handleExportar('OPERACIONES')} disabled={loading}>
                                        {loading ? <Spinner size="sm" /> : 'Exportar para Control de Operaciones'}
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default ReportesHHEEPage;