// RUTA: src/components/dashboard/PanelRegistroWidget.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Spinner, Alert, Col, Row, ListGroup, Tabs, Tab, Badge } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { GTR_API_URL } from '../../api';
import FormularioIncidencia from '../incidencias/FormularioIncidencia';

function PanelRegistroWidget({ onUpdate }) {
    const { authToken } = useAuth();
    const [key, setKey] = useState('bitacora');
    const [campanas, setCampanas] = useState([]);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');
    const [loadingIncidencia, setLoadingIncidencia] = useState(false);
    const [loadingBitacora, setLoadingBitacora] = useState(false);
    const [selectedCampana, setSelectedCampana] = useState('');
    const [bitacoraData, setBitacoraData] = useState({ hora: '', comentario: '' });
    
    // --- ESTADOS PARA LOB ---
    const [lobs, setLobs] = useState([]);
    const [selectedLob, setSelectedLob] = useState('');
    const [loadingLobs, setLoadingLobs] = useState(false);
    // ------------------------

    const [editingEntry, setEditingEntry] = useState(null);
    const [logDiario, setLogDiario] = useState([]);
    const [loadingLog, setLoadingLog] = useState(false);
    const [incidenciaData, setIncidenciaData] = useState({
        titulo: '', descripcion_inicial: '', herramienta_afectada: '',
        indicador_afectado: '', tipo: 'TECNICA', gravedad: 'MEDIA', campana_id: ''
    });

    const fetchCampanas = useCallback(async () => {
        if (!authToken) return;
        try {
            const response = await fetch(`${GTR_API_URL}/campanas/`, { headers: { 'Authorization': `Bearer ${authToken}` } });
            if (!response.ok) throw new Error('No se pudieron cargar las campañas.');
            const data = await response.json();
            setCampanas(data);
            
        } catch (err) { setError(err.message); }
    }, [authToken]);

    const fetchLogDiario = useCallback(async (campanaId) => {
        if (!campanaId) { setLogDiario([]); return; }
        setLoadingLog(true);
        try {
            const response = await fetch(`${GTR_API_URL}/bitacora/hoy/${campanaId}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
            if (!response.ok) { setLogDiario([]); return; }
            const data = await response.json();
            setLogDiario(data);
        } catch (err) { setError(err.message); } 
        finally { setLoadingLog(false); }
    }, [authToken]);

    // --- FUNCIÓN PARA CARGAR LOBS ---
    const fetchLobs = useCallback(async (campanaId) => {
        if (!campanaId) {
            setLobs([]);
            setSelectedLob('');
            return;
        }
        setLoadingLobs(true);
        try {
            const response = await fetch(`${GTR_API_URL}/campanas/${campanaId}/lobs`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setLobs(data);
            } else {
                setLobs([]);
            }
        } catch (err) {
            console.error("Error al cargar LOBs:", err);
        } finally {
            setLoadingLobs(false);
        }
    }, [authToken]);
    // ----------------------------------

    useEffect(() => { fetchCampanas(); }, [fetchCampanas]);

    useEffect(() => {
        if (key === 'bitacora') {
            fetchLogDiario(selectedCampana);
            fetchLobs(selectedCampana); // <-- Llamamos a fetchLobs aquí
        }
    }, [key, selectedCampana, fetchLogDiario, fetchLobs]); // <-- Añadimos fetchLobs como dependencia

    const handleIncidenciaChange = (e) => setIncidenciaData({ ...incidenciaData, [e.target.name]: e.target.value });
    const handleBitacoraFormChange = (e) => setBitacoraData({ ...bitacoraData, [e.target.name]: e.target.value });
    
    const handleEditClick = (entry) => {
        setEditingEntry(entry);
        setSelectedLob(entry.lob ? entry.lob.id : ''); // <-- Rellenamos el LOB
        setBitacoraData({ hora: entry.hora.substring(0, 5), comentario: entry.comentario || '' });
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setSelectedLob(''); // <-- Limpiamos el LOB
        setBitacoraData({ hora: '', comentario: '' });
    };

    const handleBitacoraSubmit = async (e) => {
        e.preventDefault();
        setLoadingBitacora(true); setError(null); setSuccess('');
        const isEditing = !!editingEntry;
        const url = isEditing ? `${GTR_API_URL}/bitacora_entries/${editingEntry.id}` : `${GTR_API_URL}/bitacora_entries/`;
        const method = isEditing ? 'PUT' : 'POST';

        // --- PAYLOAD CON LOB_ID ---
        const payload = isEditing 
            ? { hora: bitacoraData.hora, comentario: bitacoraData.comentario, lob_id: selectedLob ? parseInt(selectedLob) : null }
            : { ...bitacoraData, campana_id: selectedCampana, fecha: new Date().toISOString().split('T')[0], lob_id: selectedLob ? parseInt(selectedLob) : null };
        // --------------------------

        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify(payload) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.detail); }
            setSuccess(`Entrada ${isEditing ? 'actualizada' : 'registrada'}!`);
            handleCancelEdit(); 
            fetchLogDiario(selectedCampana); 
        } catch (err) { setError(err.message); } 
        finally { 
            setLoadingBitacora(false);
            setTimeout(() => setSuccess(''), 5000);
        }
    };

    const handleIncidenciaSubmit = async (e) => {
        e.preventDefault();
        setLoadingIncidencia(true); setError(null); setSuccess('');
        try {
            const payload = { ...incidenciaData, campana_id: parseInt(incidenciaData.campana_id, 10) };
            const response = await fetch(`${GTR_API_URL}/incidencias/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify(payload)
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.detail); }
            setSuccess('¡Incidencia registrada!');
            setIncidenciaData({ titulo: '', descripcion_inicial: '', herramienta_afectada: '', indicador_afectado: '', tipo: 'TECNICA', gravedad: 'MEDIA', campana_id: '' });
            if(onUpdate) onUpdate();
        } catch (err) { setError(err.message); } 
        finally { 
            setLoadingIncidencia(false); 
            setTimeout(() => {
                setSuccess('');
                setError(null);
            }, 5000);
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
                {error && <Alert variant="danger">{error}</Alert>}
                {success && <Alert variant="success">{success}</Alert>}
                <Tab.Content>
                    <Tab.Pane eventKey="bitacora" active={key === 'bitacora'}>
                         <Form onSubmit={handleBitacoraSubmit}>
                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column sm={3}>Campaña</Form.Label>
                                <Col sm={9}><Form.Select required value={selectedCampana} onChange={e => setSelectedCampana(e.target.value)} disabled={!!editingEntry}><option value="">Selecciona...</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Col>
                            </Form.Group>
                            
                            {selectedCampana && (<>
                                {/* --- INPUT DEL LOB --- */}
                                <Form.Group as={Row} className="mb-3">
                                    <Form.Label column sm={3}>LOB (Opcional)</Form.Label>
                                    <Col sm={9}>
                                        <Form.Select 
                                            value={selectedLob} 
                                            onChange={e => setSelectedLob(e.target.value)}
                                            disabled={loadingLobs || !!editingEntry}
                                        >
                                            <option value="">{loadingLobs ? 'Cargando...' : 'Seleccionar...'}</option>
                                            {lobs.map(lob => <option key={lob.id} value={lob.id}>{lob.nombre}</option>)}
                                        </Form.Select>
                                    </Col>
                                </Form.Group>
                                {/* --------------------- */}

                                <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Horario</Form.Label><Col sm={9}><Form.Select required name="hora" value={bitacoraData.hora} onChange={handleBitacoraFormChange}><option value="">Selecciona...</option>{generarOpcionesHorario().map(h => <option key={h} value={h}>{h}</option>)}</Form.Select></Col></Form.Group>
                                <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Comentario</Form.Label><Col sm={9}><Form.Control as="textarea" rows={2} name="comentario" value={bitacoraData.comentario} onChange={handleBitacoraFormChange} /></Col></Form.Group>
                                <div className="d-flex justify-content-end">{editingEntry && (<Button variant="secondary" onClick={handleCancelEdit} className="me-2">Cancelar</Button>)}<Button variant={editingEntry ? 'warning' : 'primary'} type="submit" disabled={loadingBitacora}>{loadingBitacora ? <Spinner size="sm" /> : (editingEntry ? 'Actualizar' : 'Registrar')}</Button></div>
                            </>)}
                        </Form>
                        <hr />
                        <h6>Log de Hoy</h6>
                        {loadingLog ? <div className="text-center"><Spinner size="sm"/></div> : (<ListGroup variant="flush" style={{maxHeight: '200px', overflowY: 'auto'}}>{logDiario.length > 0 ? logDiario.map(entry => (<ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-center"><div><strong>{entry.hora.substring(0, 5)}:</strong>
                        
                        {/* --- MOSTRAR EL LOB --- */}
                        {entry.lob && <Badge bg="info" text="dark" className="ms-2">{entry.lob.nombre}</Badge>}
                        {/* ---------------------- */}
                        
                        <span className="ms-2">{entry.comentario}</span><br /><small className="text-muted">Por: {entry.autor.nombre}</small></div><Button variant="outline-secondary" size="sm" onClick={() => handleEditClick(entry)}>Editar</Button></ListGroup.Item>)) : <p className="text-muted small mt-2">No hay entradas.</p>}</ListGroup>)}
                    </Tab.Pane>
                    <Tab.Pane eventKey="incidencia" active={key === 'incidencia'}>
                        <FormularioIncidencia
                            formData={incidenciaData}
                            handleChange={handleIncidenciaChange}
                            handleSubmit={handleIncidenciaSubmit}
                            isSubmitting={loadingIncidencia}
                            campanas={campanas}
                        />
                    </Tab.Pane>
                </Tab.Content>
            </Card.Body>
        </Card>
    );
}

export default PanelRegistroWidget;