// RUTA: src/components/dashboard/PanelRegistroWidget.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Spinner, Alert, Col, Row, ListGroup, Tabs, Tab, Badge } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../../api';
import FormularioIncidencia from '../incidencias/FormularioIncidencia';

function PanelRegistroWidget({ onUpdate }) {
    const { authToken } = useAuth();
    const [key, setKey] = useState('bitacora');
    const [campanas, setCampanas] = useState([]);
    const [selectedCampana, setSelectedCampana] = useState('');
    const [logDiario, setLogDiario] = useState([]);
    const [lobs, setLobs] = useState([]);
    const [selectedLob, setSelectedLob] = useState('');
    const [selectedLobIds, setSelectedLobIds] = useState([]);
    const [editingEntry, setEditingEntry] = useState(null);
    const [bitacoraData, setBitacoraData] = useState({ hora: '', comentario: '' });
    const [incidenciaData, setIncidenciaData] = useState({
        titulo: '', descripcion_inicial: '', herramienta_afectada: '',
        indicador_afectado: '', tipo: 'TECNICA', gravedad: 'MEDIA', campana_id: ''
    });
    const [loading, setLoading] = useState({
        campanas: false, log: false, lobs: false, submitBitacora: false, submitIncidencia: false
    });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');

    const fetchCampanas = useCallback(async () => {
        if (!authToken) return;
        setLoading(prev => ({ ...prev, campanas: true }));
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/`);
            if (!response.ok) throw new Error('No se pudieron cargar las campañas.');
            const data = await response.json();
            setCampanas(data);
        } catch (err) { setError(err.message); }
        finally { setLoading(prev => ({ ...prev, campanas: false })); }
    }, [authToken]);

    const fetchLogDiario = useCallback(async (campanaId) => {
        if (!campanaId) { setLogDiario([]); return; }
        setLoading(prev => ({ ...prev, log: true }));
        setError(null);
        try {

            // 1. Obtenemos la fecha de HOY según el navegador del usuario
            const fechaDeHoy = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    
            // 2. Añadimos la fecha como un parámetro en la URL
            const url = `${GTR_API_URL}/campanas/${campanaId}/bitacora?fecha=${fechaDeHoy}`;
            
            const response = await fetchWithAuth(url);

    
            if (response.status === 404) {
                setLogDiario([]);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al cargar la bitácora.');
            }
            const data = await response.json();
            setLogDiario(data);
        } catch (err) {
            setError(err.message);
            setLogDiario([]);
        } finally {
            setLoading(prev => ({ ...prev, log: false }));
        }
    }, [authToken]);

    const fetchLobs = useCallback(async (campanaId) => {
        if (!campanaId) { setLobs([]); return; }
        setLoading(prev => ({ ...prev, lobs: true }));
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${campanaId}/lobs`);
            if (response.ok) { setLobs(await response.json()); } else { setLobs([]); }
        } catch (err) { console.error("Error al cargar LOBs:", err); } 
        finally { setLoading(prev => ({ ...prev, lobs: false })); }
    }, [authToken]);

    // --- SECCIÓN DE useEffect CORREGIDA ---
    useEffect(() => {
        fetchCampanas();
    }, [fetchCampanas]);

    useEffect(() => {
        // Este efecto reacciona a los cambios de pestaña y campaña
        const campanaIdActiva = key === 'bitacora' ? selectedCampana : incidenciaData.campana_id;
        
        if (campanaIdActiva) {
            fetchLobs(campanaIdActiva);
            if (key === 'bitacora') {
                fetchLogDiario(campanaIdActiva);
            }
        } else {
            // Si no hay campaña seleccionada, nos aseguramos de que las listas estén vacías
            setLobs([]);
            if (key === 'bitacora') setLogDiario([]);
        }
    }, [key, selectedCampana, incidenciaData.campana_id, fetchLobs, fetchLogDiario]);
    // --- FIN DE LA SECCIÓN CORREGIDA ---

    const handleIncidenciaChange = (e) => {
        const { name, value } = e.target;
        setIncidenciaData(prev => ({ ...prev, [name]: value }));
        // Si el campo que cambió es la campaña, limpiamos los LOBs seleccionados
        if (name === 'campana_id') {
            setSelectedLobIds([]);
        }
    };
    
    const handleBitacoraFormChange = (e) => setBitacoraData({ ...bitacoraData, [e.target.name]: e.target.value });
    const handleLobChange = (lobId) => setSelectedLobIds(prev => prev.includes(lobId) ? prev.filter(id => id !== lobId) : [...prev, lobId]);
    
    const handleEditClick = (entry) => {
        setEditingEntry(entry);
        setSelectedLob(entry.lob ? entry.lob.id : '');
        setBitacoraData({ hora: entry.hora.substring(0, 5), comentario: entry.comentario || '' });
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setSelectedLob('');
        setBitacoraData({ hora: '', comentario: '' });
    };

    const handleBitacoraSubmit = async (e) => {
        e.preventDefault();
        setLoading(prev => ({...prev, submitBitacora: true}));
        setError(null); setSuccess('');
        const isEditing = !!editingEntry;
        const url = isEditing ? `${GTR_API_URL}/bitacora_entries/${editingEntry.id}` : `${GTR_API_URL}/bitacora_entries/`;
        const method = isEditing ? 'PUT' : 'POST';
        const payload = isEditing 
            ? { hora: bitacoraData.hora, comentario: bitacoraData.comentario, lob_id: selectedLob ? parseInt(selectedLob) : null }
            : { ...bitacoraData, campana_id: selectedCampana, fecha: new Date().toISOString().split('T')[0], lob_id: selectedLob ? parseInt(selectedLob) : null };
        try {
            const response = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.detail); }
            setSuccess(`Entrada ${isEditing ? 'actualizada' : 'registrada'}!`);
            handleCancelEdit(); 
            await fetchLogDiario(selectedCampana);
            if (onUpdate) onUpdate();
        } catch (err) { setError(err.message); } 
        finally { 
            setLoading(prev => ({...prev, submitBitacora: false}));
            setTimeout(() => setSuccess(''), 5000);
        }
    };
    
    const handleIncidenciaSubmit = async (formDataDesdeHijo) => {
        setLoading(prev => ({...prev, submitIncidencia: true}));
        setError(null); setSuccess('');
        try {
            const payload = { ...formDataDesdeHijo, campana_id: parseInt(formDataDesdeHijo.campana_id, 10) };
            const response = await fetchWithAuth(`${GTR_API_URL}/incidencias/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.detail); }
            setSuccess('¡Incidencia registrada!');
            setIncidenciaData({ titulo: '', descripcion_inicial: '', herramienta_afectada: '', indicador_afectado: '', tipo: 'TECNICA', gravedad: 'MEDIA', campana_id: '' });
            setSelectedLobIds([]);
            if(onUpdate) onUpdate();
        } catch (err) { setError(err.message); } 
        finally { 
            setLoading(prev => ({...prev, submitIncidencia: false}));
            setTimeout(() => { setSuccess(''); setError(null); }, 5000);
        }
    };
    
    const generarOpcionesHorario = () => {
        const opciones = [];
        for (let h = 0; h < 24; h++) { for (let m = 0; m < 60; m += 30) { const hora = String(h).padStart(2, '0'); const minuto = String(m).padStart(2, '0'); opciones.push(`${hora}:${minuto}`); } }
        return opciones;
    };

    return (
        <Card className="shadow-sm h-100">
            <Card.Header>
                <Tabs activeKey={key} onSelect={(k) => setKey(k)} id="panel-registro-tabs" fill>
                    <Tab eventKey="bitacora" title="📝 Bitácora de Eventos" />
                    <Tab eventKey="incidencia" title="⚡ Registrar Incidencia" />
                </Tabs>
            </Card.Header>
            <Card.Body>
                {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
                {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}
                <Tab.Content>
                    <Tab.Pane eventKey="bitacora" active={key === 'bitacora'}>
                         <Form onSubmit={handleBitacoraSubmit}>
                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column sm={3}>Campaña</Form.Label>
                                <Col sm={9}><Form.Select required value={selectedCampana} onChange={e => setSelectedCampana(e.target.value)} disabled={!!editingEntry}><option value="">Selecciona...</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Col>
                            </Form.Group>
                            {selectedCampana && (<>
                                <Form.Group as={Row} className="mb-3">
                                    <Form.Label column sm={3}>LOB (Opcional)</Form.Label>
                                    <Col sm={9}>
                                        <Form.Select 
                                            value={selectedLob} 
                                            onChange={e => setSelectedLob(e.target.value)}
                                            disabled={loading.lobs || !!editingEntry}
                                        >
                                            <option value="">{loading.lobs ? 'Cargando...' : 'Seleccionar...'}</option>
                                            {lobs.map(lob => <option key={lob.id} value={lob.id}>{lob.nombre}</option>)}
                                        </Form.Select>
                                    </Col>
                                </Form.Group>
                                <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Horario</Form.Label><Col sm={9}><Form.Select required name="hora" value={bitacoraData.hora} onChange={handleBitacoraFormChange}><option value="">Selecciona...</option>{generarOpcionesHorario().map(h => <option key={h} value={h}>{h}</option>)}</Form.Select></Col></Form.Group>
                                <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Comentario</Form.Label><Col sm={9}><Form.Control as="textarea" rows={2} name="comentario" value={bitacoraData.comentario} onChange={handleBitacoraFormChange} /></Col></Form.Group>
                                <div className="d-flex justify-content-end">{editingEntry && (<Button variant="secondary" onClick={handleCancelEdit} className="me-2">Cancelar</Button>)}<Button variant={editingEntry ? 'warning' : 'primary'} type="submit" disabled={loading.submitBitacora}>{loading.submitBitacora ? <Spinner size="sm" /> : (editingEntry ? 'Actualizar' : 'Registrar')}</Button></div>
                            </>)}
                        </Form>
                        <hr />
                        <h6>Log de Hoy</h6>
                        {loading.log ? <div className="text-center"><Spinner size="sm"/></div> : (<ListGroup variant="flush" style={{maxHeight: '200px', overflowY: 'auto'}}>{logDiario.length > 0 ? logDiario.map(entry => (<ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-center"><div><strong>{entry.hora.substring(0, 5)}:</strong>
                        {entry.lob && <Badge bg="info" text="dark" className="ms-2">{entry.lob.nombre}</Badge>}
                        <span className="ms-2">{entry.comentario}</span><br /><small className="text-muted">Por: {entry.autor.nombre}</small></div><Button variant="outline-secondary" size="sm" onClick={() => handleEditClick(entry)}>Editar</Button></ListGroup.Item>)) : <p className="text-muted small mt-2">No hay entradas.</p>}</ListGroup>)}
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
            </Card.Body>
        </Card>
    );
}

export default PanelRegistroWidget;