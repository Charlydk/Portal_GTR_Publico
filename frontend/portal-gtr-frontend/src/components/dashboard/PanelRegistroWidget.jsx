// RUTA: src/components/dashboard/PanelRegistroWidget.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Spinner, Alert, Col, Row, ListGroup, Tabs, Tab, Badge } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../../api';
import FormularioIncidencia from '../incidencias/FormularioIncidencia';

function PanelRegistroWidget({ onUpdate }) {
    const [key, setKey] = useState('bitacora');
    const [campanas, setCampanas] = useState([]);
    const [selectedCampana, setSelectedCampana] = useState('');
    const [logDiario, setLogDiario] = useState([]);
    const [lobs, setLobs] = useState([]);
    const [selectedLob, setSelectedLob] = useState('');
    const [editingEntry, setEditingEntry] = useState(null);
    const [bitacoraData, setBitacoraData] = useState({ hora: '', comentario: '' });
    const [incidenciaData, setIncidenciaData] = useState({
        titulo: '', descripcion_inicial: '', herramienta_afectada: '',
        indicador_afectado: '', tipo: 'TECNICA', gravedad: 'MEDIA', campana_id: ''
    });
    const [loading, setLoading] = useState({
        campanas: true, log: false, lobs: false, submitBitacora: false, submitIncidencia: false
    });
    const [error, setError] = useState({ campanas: null, log: null, lobs: null, submit: null });
    const [selectedLobIds, setSelectedLobIds] = useState([]);

    // Función centralizada para obtener la fecha local del navegador
    const getLocalDateString = () => {
        const hoy = new Date();
        const anio = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const dia = String(hoy.getDate()).padStart(2, '0');
        return `${anio}-${mes}-${dia}`;
    };

    const fetchCampanas = useCallback(async () => {
        setLoading(prev => ({ ...prev, campanas: true }));
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/`, {});
            if (!response.ok) throw new Error('No se pudieron cargar las campañas.');
            const data = await response.json();
            setCampanas(data);
        } catch (err) {
            setError(prev => ({ ...prev, campanas: err.message }));
        } finally {
            setLoading(prev => ({ ...prev, campanas: false }));
        }
    }, []);

    const fetchLobs = useCallback(async (campanaId) => {
        if (!campanaId) { setLobs([]); return; }
        setLoading(prev => ({ ...prev, lobs: true }));
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${campanaId}/lobs`, {});
            if (!response.ok) throw new Error('No se pudieron cargar los LOBs.');
            setLobs(await response.json());
        } catch (err) {
            setError(prev => ({ ...prev, lobs: err.message }));
        } finally {
            setLoading(prev => ({ ...prev, lobs: false }));
        }
    }, []);

    const fetchLogDiario = useCallback(async (campanaId) => {
        if (!campanaId) {
            setLogDiario([]);
            return;
        }
        setLoading(prev => ({ ...prev, log: true }));
        setError(prev => ({ ...prev, log: null }));
        try {
            // --- CAMBIO DEFINITIVO ---
            // Llamamos al nuevo endpoint que no necesita parámetros de fecha
            const url = `${GTR_API_URL}/bitacora/log_de_hoy/${campanaId}`;
            
            const response = await fetchWithAuth(url, {});
            if (!response.ok) {
                if (response.status === 404) { setLogDiario([]); return; }
                const errData = await response.json();
                throw new Error(errData.detail || 'No se pudo cargar la bitácora de hoy.');
            }
            setLogDiario(await response.json());
        } catch (err) {
            setError(prev => ({ ...prev, log: err.message }));
        } finally {
            setLoading(prev => ({ ...prev, log: false }));
        }
    }, []);

    useEffect(() => {
        fetchCampanas();
    }, [fetchCampanas]);

    useEffect(() => {
        if (selectedCampana) {
            fetchLogDiario(selectedCampana);
            fetchLobs(selectedCampana);
            setIncidenciaData(prev => ({ ...prev, campana_id: selectedCampana }));
        } else {
            setLogDiario([]);
            setLobs([]);
        }
    }, [selectedCampana, fetchLogDiario, fetchLobs]);

    const handleCampanaChange = (e) => {
        setSelectedCampana(e.target.value);
        setSelectedLob('');
        setSelectedLobIds([]);
    };
    
    const generarOpcionesHorario = () => {
        const opciones = [];
        const now = new Date();
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const hora = String(h).padStart(2, '0');
                const minuto = String(m).padStart(2, '0');
                opciones.push(`${hora}:${minuto}`);
            }
        }
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMinute = now.getMinutes() < 30 ? '00' : '30';
        const currentTime = `${currentHour}:${currentMinute}`;
        if (!opciones.includes(currentTime)) {
            opciones.push(currentTime);
            opciones.sort();
        }
        return opciones;
    };

    const handleBitacoraChange = (e) => {
        setBitacoraData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleBitacoraSubmit = async (e) => {
        e.preventDefault();
        setLoading(prev => ({ ...prev, submitBitacora: true }));
        setError(prev => ({ ...prev, submit: null }));
        try {
            const url = editingEntry ? `${GTR_API_URL}/bitacora_entries/${editingEntry.id}` : `${GTR_API_URL}/bitacora_entries/`;
            const method = editingEntry ? 'PUT' : 'POST';
            
            // CAMBIO: El payload ya no lleva la fecha. El backend se encarga.
            const payload = {
                ...bitacoraData,
                campana_id: parseInt(selectedCampana),
                lob_id: selectedLob ? parseInt(selectedLob) : null,
            };

            // Si estamos editando, sí necesitamos enviar la fecha que ya tiene la entrada
            if (editingEntry) {
                payload.fecha = editingEntry.fecha;
            }

            const response = await fetchWithAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Error al guardar la entrada.');
            }
            
            setBitacoraData({ hora: '', comentario: '' });
            setEditingEntry(null);
            setSelectedLob('');
            fetchLogDiario(selectedCampana);
            if(onUpdate) onUpdate();
        } catch (err) {
            setError(prev => ({ ...prev, submit: err.message }));
        } finally {
            setLoading(prev => ({ ...prev, submitBitacora: false }));
        }
    };

    const handleEditClick = (entry) => {
        setEditingEntry(entry);
        setBitacoraData({ hora: entry.hora.substring(0, 5), comentario: entry.comentario });
        setSelectedLob(entry.lob?.id || '');
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setBitacoraData({ hora: '', comentario: '' });
        setSelectedLob('');
    };

    const handleIncidenciaChange = (e) => {
        setIncidenciaData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLobChange = (lobId) => {
        setSelectedLobIds(prev => prev.includes(lobId) ? prev.filter(id => id !== lobId) : [...prev, lobId]);
    };

    const handleIncidenciaSubmit = async (payloadFromForm) => {
        setLoading(prev => ({ ...prev, submitIncidencia: true }));
        setError(prev => ({ ...prev, submit: null }));
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/incidencias/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadFromForm),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al registrar la incidencia.`);
            }
            setIncidenciaData({
                titulo: '', descripcion_inicial: '', herramienta_afectada: '',
                indicador_afectado: '', tipo: 'TECNICA', gravedad: 'MEDIA', campana_id: selectedCampana
            });
            setSelectedLobIds([]);
            if(onUpdate) onUpdate();
        } catch (err) {
            setError(prev => ({ ...prev, submit: err.message }));
        } finally {
            setLoading(prev => ({ ...prev, submitIncidencia: false }));
        }
    };

    return (
        <Card className="shadow-sm h-100">
            <Card.Header>
                <Row className="align-items-center">
                    <Col xs={5}><h5 className="mb-0">Registro Rápido</h5></Col>
                    <Col xs={7}>
                        {loading.campanas ? <Spinner size="sm" /> : (
                            <Form.Select size="sm" value={selectedCampana} onChange={handleCampanaChange}>
                                <option value="">Seleccione una campaña...</option>
                                {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </Form.Select>
                        )}
                    </Col>
                </Row>
            </Card.Header>
            <Card.Body>
                {error.campanas && <Alert variant="danger">{error.campanas}</Alert>}
                {error.submit && <Alert variant="danger" onClose={() => setError(prev => ({...prev, submit: null}))} dismissible>{error.submit}</Alert>}
                
                {!selectedCampana ? (
                    <Alert variant="info" className="text-center">Por favor, seleccione una campaña para comenzar.</Alert>
                ) : (
                    <>
                        <Tabs activeKey={key} onSelect={(k) => setKey(k)} id="registro-tabs" className="mb-3" fill>
                            <Tab eventKey="bitacora" title="Bitácora"></Tab>
                            <Tab eventKey="incidencia" title="Incidencia"></Tab>
                        </Tabs>
                        <Tab.Content>
                            <Tab.Pane eventKey="bitacora" active={key === 'bitacora'}>
                                <Form onSubmit={handleBitacoraSubmit}>
                                    {editingEntry && <Alert variant="warning" size="sm">Editando entrada de las {editingEntry.hora.substring(0, 5)}.</Alert>}
                                    <Row>
                                        <Col md={6}><Form.Group><Form.Label>Horario</Form.Label><Form.Select name="hora" value={bitacoraData.hora} onChange={handleBitacoraChange} required><option value="">Seleccionar</option>{generarOpcionesHorario().map(h => <option key={h} value={h}>{h}</option>)}</Form.Select></Form.Group></Col>
                                        <Col md={6}><Form.Group><Form.Label>LOB (Opcional)</Form.Label><Form.Select value={selectedLob} onChange={(e) => setSelectedLob(e.target.value)} disabled={loading.lobs}>{loading.lobs ? <option>Cargando...</option> : <><option value="">General</option>{lobs.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}</>}</Form.Select></Form.Group></Col>
                                    </Row>
                                    <Form.Group className="mt-2"><Form.Label>Comentario</Form.Label><Form.Control as="textarea" rows={2} name="comentario" value={bitacoraData.comentario} onChange={handleBitacoraChange} required /></Form.Group>
                                    <div className="d-flex justify-content-end mt-2">
                                        {editingEntry && <Button variant="secondary" size="sm" onClick={handleCancelEdit} className="me-2">Cancelar</Button>}
                                        <Button type="submit" variant="primary" size="sm" disabled={loading.submitBitacora}>{loading.submitBitacora ? <Spinner size="sm" /> : (editingEntry ? 'Actualizar' : 'Registrar')}</Button>
                                    </div>
                                </Form>
                                <hr />
                                <h6>Log de Hoy</h6>
                                {loading.log ? <div className="text-center"><Spinner size="sm"/></div> : error.log ? <Alert variant="warning" size="sm">{error.log}</Alert> : (
                                    <ListGroup variant="flush" style={{maxHeight: '200px', overflowY: 'auto'}}>
                                        {logDiario.length > 0 ? logDiario.map(entry => (
                                            <ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-center px-0">
                                                <div>
                                                    <strong>{entry.hora.substring(0, 5)}:</strong>
                                                    {entry.lob && <Badge bg="info" text="dark" className="ms-2">{entry.lob.nombre}</Badge>}
                                                    <span className="ms-2">{entry.comentario}</span><br />
                                                    <small className="text-muted">Por: {entry.autor.nombre}</small>
                                                </div>
                                                <Button variant="outline-secondary" size="sm" onClick={() => handleEditClick(entry)}>Editar</Button>
                                            </ListGroup.Item>
                                        )) : <p className="text-muted small mt-2">No hay entradas para esta campaña hoy.</p>}
                                    </ListGroup>
                                )}
                            </Tab.Pane>
                            <Tab.Pane eventKey="incidencia" active={key === 'incidencia'}>
                                <FormularioIncidencia
                                    formData={incidenciaData}
                                    handleChange={handleIncidenciaChange}
                                    handleSubmit={handleIncidenciaSubmit}
                                    isSubmitting={loading.submitIncidencia}
                                    campanas={campanas}
                                    lobs={lobs}
                                    loadingLobs={loading.lobs}
                                    selectedLobIds={selectedLobIds}
                                    handleLobChange={handleLobChange}
                                />
                            </Tab.Pane>
                        </Tab.Content>
                    </>
                )}
            </Card.Body>
        </Card>
    );
}

export default PanelRegistroWidget;