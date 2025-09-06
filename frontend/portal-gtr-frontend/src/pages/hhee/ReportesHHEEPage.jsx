import React, { useState } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';

function ReportesHHEEPage() {
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { authToken, user } = useAuth(); // <-- Obtenemos el usuario para saber su rol

    const handleExportar = async (formato) => { // <-- Ahora recibe el formato como parámetro
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
                // Enviamos el formato junto con las fechas
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
                                <Row>
                                    <Col md={6}><Form.Group controlId="fecha-inicio" className="mb-3"><Form.Label>Fecha de Inicio</Form.Label><Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required /></Form.Group></Col>
                                    <Col md={6}><Form.Group controlId="fecha-fin" className="mb-3"><Form.Label>Fecha de Fin</Form.Label><Form.Control type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required /></Form.Group></Col>
                                </Row>
                                <div className="d-grid gap-2 mt-3">
                                    {/* --- BOTONES CONDICIONALES POR ROL --- */}
                                    {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                                        <Button variant="success" onClick={() => handleExportar('RRHH')} disabled={loading}>
                                            {loading ? <Spinner size="sm" /> : 'Exportar para RRHH (Formato ADP)'}
                                        </Button>
                                    )}
                                    
                                    <Button variant="info" onClick={() => handleExportar('OPERACIONES')} disabled={loading}>
                                        {loading ? <Spinner size="sm" /> : 'Exportar para Control de Operaciones'}
                                    </Button>
                                    {/* --- FIN DE BOTONES CONDICIONALES --- */}
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