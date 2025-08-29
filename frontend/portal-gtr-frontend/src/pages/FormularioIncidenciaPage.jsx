// src/pages/FormularioIncidenciaPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Form, Button, Container, Card, Spinner, Alert, Row, Col } from 'react-bootstrap';

function FormularioIncidenciaPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { authToken } = useAuth();
    
    const queryParams = new URLSearchParams(location.search);
    const campanaIdFromQuery = queryParams.get('campanaId');

    const [formData, setFormData] = useState({
        titulo: '',
        descripcion_inicial: '',
        herramienta_afectada: '',
        indicador_afectado: '',
        tipo: 'TECNICA',
        campana_id: campanaIdFromQuery || '',
        fecha_apertura: '',
    });
    const [usarAhoraCreacion, setUsarAhoraCreacion] = useState(true);
    const [campanas, setCampanas] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCampanas = async () => {
            if (!authToken) return;
            try {
                const response = await fetch(`${API_BASE_URL}/campanas/`, {
                    headers: { 'Authorization': `Bearer ${authToken}` },
                });
                if (!response.ok) throw new Error('No se pudieron cargar las campañas.');
                const data = await response.json();
                setCampanas(data);
            } catch (err) {
                setError(err.message);
            }
        };
        fetchCampanas();
    }, [authToken]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        // Preparamos el payload que se enviará
        const payload = {
            ...formData,
            campana_id: parseInt(formData.campana_id, 10),
        };

        // Si el checkbox está marcado, no enviamos fecha_apertura
        // para que el backend use la hora actual.
        if (usarAhoraCreacion) {
            delete payload.fecha_apertura;
        } else if (!payload.fecha_apertura) {
            // Si no está marcado, nos aseguramos de que se haya introducido una fecha
            setError("Debe especificar una fecha y hora de apertura.");
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al crear la incidencia.');
            }
            
            const nuevaIncidencia = await response.json();
            navigate(`/incidencias/${nuevaIncidencia.id}`);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="bg-danger text-white">Registrar Nueva Incidencia</Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3" controlId="titulo">
                            <Form.Label>Título</Form.Label>
                            <Form.Control type="text" name="titulo" value={formData.titulo} onChange={handleChange} required />
                        </Form.Group>

                        <Form.Group className="mb-3" controlId="descripcion_inicial">
                            <Form.Label>Descripción Inicial</Form.Label>
                            <Form.Control as="textarea" rows={4} name="descripcion_inicial" value={formData.descripcion_inicial} onChange={handleChange} required />
                        </Form.Group>

                        <Form.Group className="mb-3" controlId="fecha_apertura_group">
                            <Form.Check 
                                type="checkbox"
                                id="usarAhoraCreacion"
                                label="Usar fecha y hora actual para la apertura"
                                checked={usarAhoraCreacion}
                                onChange={(e) => setUsarAhoraCreacion(e.target.checked)}
                            />
                            {!usarAhoraCreacion && (
                                <Form.Control
                                    type="datetime-local"
                                    name="fecha_apertura"
                                    value={formData.fecha_apertura}
                                    onChange={handleChange}
                                    className="mt-2"
                                />
                            )}
                        </Form.Group>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3" controlId="herramienta_afectada">
                                    <Form.Label>Herramienta Afectada</Form.Label>
                                    <Form.Control type="text" name="herramienta_afectada" value={formData.herramienta_afectada} onChange={handleChange} />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3" controlId="indicador_afectado">
                                    <Form.Label>Indicador Afectado</Form.Label>
                                    <Form.Control type="text" name="indicador_afectado" value={formData.indicador_afectado} onChange={handleChange} />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3" controlId="tipo">
                                    <Form.Label>Tipo de Incidencia</Form.Label>
                                    <Form.Select name="tipo" value={formData.tipo} onChange={handleChange}>
                                        <option value="TECNICA">Técnica</option>
                                        <option value="OPERATIVA">Operativa</option>
                                        <option value="HUMANA">Humana</option>
                                        <option value="OTRO">Otro</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3" controlId="campana_id">
                                    <Form.Label>Campaña</Form.Label>
                                    <Form.Select name="campana_id" value={formData.campana_id} onChange={handleChange} required disabled={!!campanaIdFromQuery}>
                                        <option value="">Seleccione una campaña</option>
                                        {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        
                        <div className="text-end">
                            <Link to={campanaIdFromQuery ? `/campanas/${campanaIdFromQuery}` : '/incidencias'} className="btn btn-secondary me-2">
                                Cancelar
                            </Link>
                            <Button type="submit" variant="primary" disabled={isSubmitting}>
                                {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Registrar Incidencia'}
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
}

export default FormularioIncidenciaPage;
