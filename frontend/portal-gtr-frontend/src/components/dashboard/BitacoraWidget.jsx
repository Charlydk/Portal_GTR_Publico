import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Spinner, Alert, Col, Row, ListGroup } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { GTR_API_URL } from '../../api';

function BitacoraWidget() {
    const { authToken } = useAuth();
    const [campanas, setCampanas] = useState([]);
    const [selectedCampana, setSelectedCampana] = useState('');
    const [bitacoraEntries, setBitacoraEntries] = useState([]);
    
    // Estado para la entrada que se está editando
    const [editingEntry, setEditingEntry] = useState(null);
    
    // Estado para el formulario (se usa tanto para crear como para editar)
    const [formData, setFormData] = useState({ hora: '', comentario: '' });

    const [loadingEntries, setLoadingEntries] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Carga las campañas para el selector
    const fetchCampanas = useCallback(async () => {
        if (!authToken) return;
        try {
            const response = await fetch(`${GTR_API_URL}/campanas/`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            const data = await response.json();
            setCampanas(data);
            if (data.length > 0) {
                setSelectedCampana(data[0].id); // Selecciona la primera por defecto
            }
        } catch (err) {
            setError(err.message || 'No se pudieron cargar las campañas para el selector.');
        }
    }, [authToken]);

    // Carga las entradas de la bitácora para la campaña seleccionada
    const fetchBitacoraEntries = useCallback(async () => {
        if (!selectedCampana) return;
        setLoadingEntries(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`${GTR_API_URL}/campanas/${selectedCampana}/bitacora?fecha=${today}`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) {
                setBitacoraEntries([]); // Limpia las entradas si no hay
                throw new Error('No hay entradas para hoy o error al cargar.');
            }
            const data = await response.json();
            setBitacoraEntries(data);
        } catch (err) {
            // No mostramos este error para no ser intrusivos, la lista vacía es suficiente
            console.error(err.message);
        } finally {
            setLoadingEntries(false);
        }
    }, [authToken, selectedCampana]);

    useEffect(() => {
        fetchCampanas();
    }, [fetchCampanas]);

    useEffect(() => {
        fetchBitacoraEntries();
    }, [fetchBitacoraEntries]);

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEditClick = (entry) => {
        setEditingEntry(entry);
        setFormData({
            hora: entry.hora.substring(0, 5), // Formato HH:MM
            comentario: entry.comentario || ''
        });
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setFormData({ hora: '', comentario: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const isEditing = editingEntry !== null;
        const url = isEditing 
            ? `${GTR_API_URL}/bitacora_entries/${editingEntry.id}` 
            : `${GTR_API_URL}/bitacora_entries/`;
        
        const method = isEditing ? 'PUT' : 'POST';
        
        const payload = {
            campana_id: selectedCampana,
            fecha: new Date().toISOString().split('T')[0],
            hora: formData.hora,
            comentario: formData.comentario,
        };
        
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`},
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se pudo guardar la entrada.');
            }
            handleCancelEdit(); // Resetea el formulario
            fetchBitacoraEntries(); // Refresca la lista
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

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

    const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : 'N/A';

    return (
        <Card className="shadow-sm h-100">
            <Card.Header as="h5">Bitácora del Día</Card.Header>
            <Card.Body>
                {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
                <Form onSubmit={handleSubmit}>
                    <Row className="align-items-end">
                        <Col md={5}>
                            <Form.Group>
                                <Form.Label>Campaña</Form.Label>
                                <Form.Select value={selectedCampana} onChange={e => setSelectedCampana(e.target.value)} disabled={editingEntry}>
                                    {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                         <Col md={3}>
                            <Form.Group>
                                <Form.Label>Horario</Form.Label>
                                <Form.Select name="hora" value={formData.hora} onChange={handleFormChange} required>
                                     <option value="">Seleccionar...</option>
                                     {generarOpcionesHorario().map(h => <option key={h} value={h}>{h}</option>)}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Comentario</Form.Label>
                                <Form.Control type="text" name="comentario" value={formData.comentario} onChange={handleFormChange} placeholder="Observación rápida..." />
                            </Form.Group>
                        </Col>
                    </Row>
                    <div className="d-flex justify-content-end mt-3">
                        {editingEntry && (
                            <Button variant="secondary" onClick={handleCancelEdit} className="me-2" disabled={submitting}>
                                Cancelar
                            </Button>
                        )}
                        <Button variant={editingEntry ? "warning" : "primary"} type="submit" disabled={submitting}>
                            {submitting ? <Spinner size="sm" /> : (editingEntry ? 'Actualizar' : 'Registrar')}
                        </Button>
                    </div>
                </Form>
                
                <hr />

                <h6>Log de Hoy ({new Date().toLocaleDateString()})</h6>
                {loadingEntries ? <div className="text-center"><Spinner size="sm" /></div> : (
                    <ListGroup variant="flush" style={{maxHeight: '200px', overflowY: 'auto'}}>
                        {bitacoraEntries.length > 0 ? bitacoraEntries.map(entry => (
                            <ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-center px-0">
                                <div>
                                    <strong>{formatTime(entry.hora)}</strong> - {entry.comentario || <em className="text-muted">Sin comentario</em>}
                                    <br />
                                    <small className="text-muted">Por: {entry.autor.nombre}</small>
                                </div>
                                <Button variant="outline-secondary" size="sm" onClick={() => handleEditClick(entry)}>
                                    Editar
                                </Button>
                            </ListGroup.Item>
                        )) : <p className="text-muted small mt-2">No hay entradas para la campaña seleccionada.</p>}
                    </ListGroup>
                )}
            </Card.Body>
        </Card>
    );
}

export default BitacoraWidget;