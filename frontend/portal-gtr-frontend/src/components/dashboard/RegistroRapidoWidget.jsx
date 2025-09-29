import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Tabs, Tab, Spinner, Alert, Col, Row } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../../api';

function RegistroRapidoWidget({ onUpdate }) {
    const { authToken } = useAuth();
    const [campanas, setCampanas] = useState([]);
    
    const [incidenciaData, setIncidenciaData] = useState({
        titulo: '',
        descripcion_inicial: '',
        campana_id: '',
        herramienta_afectada: '',
        indicador_afectado: '',
        tipo: 'TECNICA',
    });
    const [usarAhora, setUsarAhora] = useState(true);
    const [fechaManual, setFechaManual] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');

    const fetchCampanas = useCallback(async () => {
        if (!authToken) return;
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'No se pudieron cargar las campañas.');
            }
            const data = await response.json();
            setCampanas(data); // <- Aquí se usa setCampanas
        } catch (err) {
            setError(err.message);
        }
    }, [authToken]);

    useEffect(() => {
        fetchCampanas();
    }, [fetchCampanas]);

    const handleIncidenciaChange = (e) => {
        setIncidenciaData({ ...incidenciaData, [e.target.name]: e.target.value });
    };
    
    const handleIncidenciaSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess('');
        try {
            const payload = { ...incidenciaData };
            if (!usarAhora) {
                if (!fechaManual) throw new Error("Debe especificar una fecha y hora de apertura.");
                payload.fecha_apertura = new Date(fechaManual).toISOString();
            }

            const response = await fetchWithAuth(`${GTR_API_URL}/incidencias/`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.detail || 'No se pudo registrar la incidencia.');
            }
            setSuccess('¡Incidencia registrada con éxito!');
            setIncidenciaData({ titulo: '', descripcion_inicial: '', campana_id: '', herramienta_afectada: '', indicador_afectado: '', tipo: 'TECNICA' });
            setUsarAhora(true);
            setFechaManual('');

            if(onUpdate) onUpdate();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Card className="shadow-sm">
            <Card.Header>
                <h5 className="mb-0 text-center p-2">⚡ Registrar Incidencia Rápida</h5>
            </Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                {success && <Alert variant="success">{success}</Alert>}

                <Form onSubmit={handleIncidenciaSubmit}>
                     <Form.Group as={Row} className="mb-3">
                        <Form.Label column sm={3}>Campaña*</Form.Label>
                        <Col sm={9}>
                            <Form.Select required name="campana_id" value={incidenciaData.campana_id} onChange={handleIncidenciaChange}>
                                <option value="">Selecciona una campaña...</option>
                                {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </Form.Select>
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3">
                        <Form.Label column sm={3}>Título*</Form.Label>
                        <Col sm={9}>
                            <Form.Control type="text" placeholder="Falla en sistema X" required name="titulo" value={incidenciaData.titulo} onChange={handleIncidenciaChange} />
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3">
                        <Form.Label column sm={3}>Descripción*</Form.Label>
                        <Col sm={9}>
                            <Form.Control as="textarea" rows={3} placeholder="Detalla lo que sucedió..." required name="descripcion_inicial" value={incidenciaData.descripcion_inicial} onChange={handleIncidenciaChange} />
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3">
                        <Form.Label column sm={3}>Tipo</Form.Label>
                        <Col sm={9}>
                            <Form.Select name="tipo" value={incidenciaData.tipo} onChange={handleIncidenciaChange}>
                                <option value="TECNICA">Técnica</option>
                                <option value="OPERATIVA">Operativa</option>
                                <option value="OTRO">Otro</option>
                            </Form.Select>
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3">
                        <Form.Label column sm={3}>Herramienta</Form.Label>
                        <Col sm={9}>
                            <Form.Control type="text" placeholder="Ej: CRM, Marcador" name="herramienta_afectada" value={incidenciaData.herramienta_afectada} onChange={handleIncidenciaChange} />
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3">
                        <Form.Label column sm={3}>Indicador</Form.Label>
                        <Col sm={9}>
                            <Form.Control type="text" placeholder="Ej: TMO, AHT" name="indicador_afectado" value={incidenciaData.indicador_afectado} onChange={handleIncidenciaChange} />
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row} className="mb-3 align-items-center">
                        <Col sm={{span: 9, offset: 3}}>
                            <Form.Check 
                                type="checkbox"
                                label="Usar fecha y hora actual para la apertura"
                                checked={usarAhora}
                                onChange={(e) => setUsarAhora(e.target.checked)}
                            />
                            {!usarAhora && (
                                <Form.Control
                                    type="datetime-local"
                                    value={fechaManual}
                                    onChange={(e) => setFechaManual(e.target.value)}
                                    className="mt-2"
                                />
                            )}
                        </Col>
                    </Form.Group>
                    <div className="d-grid">
                        <Button variant="danger" type="submit" disabled={loading}>
                            {loading ? <Spinner size="sm" /> : 'Registrar Incidencia'}
                        </Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
}

export default RegistroRapidoWidget;