import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Spinner, Alert, Col, Row, ListGroup } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../../api';

function BitacoraDiariaWidget({ onUpdate }) {
    const { authToken } = useAuth();
    const [campanas, setCampanas] = useState([]);
    const [selectedCampana, setSelectedCampana] = useState('');
    
    const [bitacoraData, setBitacoraData] = useState({ hora: '', comentario: '' });
    const [editingEntry, setEditingEntry] = useState(null);

    const [logDiario, setLogDiario] = useState([]);
    const [loadingLog, setLoadingLog] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');

    const generarOpcionesHorario = () => {
        const opciones = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const hora = String(h).padStart(2, '0');
                const minuto = String(m).padStart(2, '0');
                opciones.push(`${hora}:${minuto}`);
            }
        }
        return opciones;
    };

    const fetchCampanas = useCallback(async () => {
        if (!authToken) return;
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/`);
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.detail || 'No se pudieron cargar las campañas.');
            }
            const data = await response.json();
            setCampanas(data);
        } catch (err) {
            setError(err.message);
        }
    }, [authToken]);
    
    const fetchLogDiario = useCallback(async (campanaId) => {
        if (!campanaId) {
            setLogDiario([]);
            return;
        }
        setLoadingLog(true);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/bitacora/hoy/${campanaId}`);
            if (!response.ok) {
                 setLogDiario([]);
                 throw new Error("No se pudieron cargar las entradas de la bitácora.");
            }
            const data = await response.json();
            setLogDiario(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingLog(false);
        }
    }, [authToken]);

    useEffect(() => {
        fetchCampanas();
    }, [fetchCampanas]);
    
    useEffect(() => {
        fetchLogDiario(selectedCampana);
    }, [selectedCampana, fetchLogDiario]);

    const handleFormChange = (e) => {
        setBitacoraData({ ...bitacoraData, [e.target.name]: e.target.value });
    };

    const handleEditClick = (entry) => {
        setEditingEntry(entry);
        setBitacoraData({ hora: entry.hora.substring(0, 5), comentario: entry.comentario || '' });
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setBitacoraData({ hora: '', comentario: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess('');

        const isEditing = !!editingEntry;
        const url = isEditing 
            ? `${GTR_API_URL}/bitacora_entries/${editingEntry.id}`
            : `${GTR_API_URL}/bitacora_entries/`;
        
        const method = isEditing ? 'PUT' : 'POST';

        const payload = isEditing 
            ? { hora: bitacoraData.hora, comentario: bitacoraData.comentario }
            : { ...bitacoraData, campana_id: selectedCampana, fecha: new Date().toISOString().split('T')[0] };

        try {
            const response = await fetchWithAuth(url, {
                method: method,
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.detail || `No se pudo ${isEditing ? 'actualizar' : 'registrar'} la entrada.`);
            }
            setSuccess(`Entrada ${isEditing ? 'actualizada' : 'registrada'} con éxito!`);
            handleCancelEdit();
            fetchLogDiario(selectedCampana);
            if(onUpdate) onUpdate();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Card className="shadow-sm h-100">
            <Card.Header as="h5">Bitácora del Día</Card.Header>
            <Card.Body>
                {/* --- CORRECCIÓN AQUÍ: Mostramos los errores y éxitos --- */}
                {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
                {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}

                <Form onSubmit={handleSubmit}>
                    <Form.Group as={Row} className="mb-3">
                        <Form.Label column sm={3}>Campaña</Form.Label>
                        <Col sm={9}>
                            <Form.Select 
                                required 
                                value={selectedCampana} 
                                onChange={e => setSelectedCampana(e.target.value)}
                                disabled={!!editingEntry}
                            >
                                <option value="">Selecciona una campaña...</option>
                                {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </Form.Select>
                        </Col>
                    </Form.Group>
                    
                    {selectedCampana && (
                        <>
                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column sm={3}>Horario</Form.Label>
                                <Col sm={9}>
                                    <Form.Select required name="hora" value={bitacoraData.hora} onChange={handleFormChange}>
                                        <option value="">Selecciona una franja...</option>
                                        {generarOpcionesHorario().map(h => <option key={h} value={h}>{h}</option>)}
                                    </Form.Select>
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column sm={3}>Comentario</Form.Label>
                                <Col sm={9}>
                                    <Form.Control as="textarea" rows={2} name="comentario" value={bitacoraData.comentario} onChange={handleFormChange} />
                                </Col>
                            </Form.Group>
                            <div className="d-flex justify-content-end">
                                {editingEntry && (
                                    <Button variant="secondary" onClick={handleCancelEdit} className="me-2">Cancelar</Button>
                                )}
                                <Button variant={editingEntry ? 'warning' : 'primary'} type="submit" disabled={loading}>
                                    {loading ? <Spinner size="sm" /> : (editingEntry ? 'Actualizar' : 'Registrar')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
                <hr />
                <h6>Log de Hoy para la Campaña Seleccionada</h6>
                {loadingLog ? <div className="text-center"><Spinner size="sm"/></div> : (
                    <ListGroup variant="flush" style={{maxHeight: '200px', overflowY: 'auto'}}>
                        {logDiario.length > 0 ? logDiario.map(entry => (
                            <ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>{entry.hora.substring(0, 5)}:</strong> {entry.comentario}
                                    <br />
                                    <small className="text-muted">Por: {entry.autor.nombre}</small>
                                </div>
                                <Button variant="outline-secondary" size="sm" onClick={() => handleEditClick(entry)}>Editar</Button>
                            </ListGroup.Item>
                        )) : <p className="text-muted small mt-2">No hay entradas para esta campaña hoy.</p>}
                    </ListGroup>
                )}
            </Card.Body>
        </Card>
    );
}

export default BitacoraDiariaWidget;