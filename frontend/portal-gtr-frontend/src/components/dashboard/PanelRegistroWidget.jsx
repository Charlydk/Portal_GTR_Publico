import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Spinner, Alert, Col, Row, ListGroup, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { GTR_API_URL } from '../../api';

function PanelRegistroWidget({ onUpdate }) {
    const { authToken } = useAuth();
    const [key, setKey] = useState('bitacora'); // Pestaña por defecto

    // Estados generales
    const [campanas, setCampanas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');

    // --- Estados para Bitácora de Eventos ---
    const [selectedCampana, setSelectedCampana] = useState('');
    const [bitacoraData, setBitacoraData] = useState({ hora: '', comentario: '' });
    const [editingEntry, setEditingEntry] = useState(null);
    const [logDiario, setLogDiario] = useState([]);
    const [loadingLog, setLoadingLog] = useState(false);

    // --- Estados para Registro de Incidencias ---
    const [incidenciaData, setIncidenciaData] = useState({
        titulo: '', descripcion_inicial: '', campana_id: '',
        herramienta_afectada: '', indicador_afectado: '', tipo: 'TECNICA',
    });
    const [usarAhora, setUsarAhora] = useState(true);
    const [fechaManual, setFechaManual] = useState('');

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
            const response = await fetch(`${GTR_API_URL}/campanas/`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) throw new Error('No se pudieron cargar las campañas.');
            const data = await response.json();
            setCampanas(data);
        } catch (err) {
            setError(err.message);
        }
    }, [authToken]);

    const fetchLogDiario = useCallback(async (campanaId) => {
        if (!campanaId) { setLogDiario([]); return; }
        setLoadingLog(true);
        try {
            const response = await fetch(`${GTR_API_URL}/bitacora/hoy/${campanaId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) { setLogDiario([]); return; }
            const data = await response.json();
            setLogDiario(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingLog(false);
        }
    }, [authToken]);

    useEffect(() => { fetchCampanas(); }, [fetchCampanas]);
    useEffect(() => { if (key === 'bitacora') fetchLogDiario(selectedCampana); }, [key, selectedCampana, fetchLogDiario]);

    const handleBitacoraFormChange = (e) => {
        setBitacoraData({ ...bitacoraData, [e.target.name]: e.target.value });
    };
    
    const handleIncidenciaChange = (e) => {
        setIncidenciaData({ ...incidenciaData, [e.target.name]: e.target.value });
    };

    const handleEditClick = (entry) => {
        setEditingEntry(entry);
        setBitacoraData({ hora: entry.hora.substring(0, 5), comentario: entry.comentario || '' });
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setBitacoraData({ hora: '', comentario: '' });
    };

    const handleBitacoraSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(null); setSuccess('');
        const isEditing = !!editingEntry;
        const url = isEditing ? `${GTR_API_URL}/bitacora_entries/${editingEntry.id}` : `${GTR_API_URL}/bitacora_entries/`;
        const method = isEditing ? 'PUT' : 'POST';
        const payload = isEditing ? { hora: bitacoraData.hora, comentario: bitacoraData.comentario } : { ...bitacoraData, campana_id: selectedCampana, fecha: new Date().toISOString().split('T')[0] };
        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify(payload) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.detail); }
            setSuccess(`Entrada ${isEditing ? 'actualizada' : 'registrada'}!`);
            handleCancelEdit(); fetchLogDiario(selectedCampana); if(onUpdate) onUpdate();
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    const handleIncidenciaSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(null); setSuccess('');
        try {
            const payload = { ...incidenciaData };
            if (!usarAhora) { if (!fechaManual) throw new Error("Especifique una fecha de apertura."); payload.fecha_apertura = new Date(fechaManual).toISOString(); }
            const response = await fetch(`${GTR_API_URL}/incidencias/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify(payload) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.detail); }
            setSuccess('¡Incidencia registrada!');
            setIncidenciaData({ titulo: '', descripcion_inicial: '', campana_id: '', herramienta_afectada: '', indicador_afectado: '', tipo: 'TECNICA' });
            if(onUpdate) onUpdate();
        } catch (err) { setError(err.message); } finally { setLoading(false); }
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
                    {/* --- CONTENIDO DE LA PESTAÑA BITÁCORA --- */}
                    <Tab.Pane eventKey="bitacora" active={key === 'bitacora'}>
                        <Form onSubmit={handleBitacoraSubmit}>
                            <Form.Group as={Row} className="mb-3">
                                <Form.Label column sm={3}>Campaña</Form.Label>
                                <Col sm={9}><Form.Select required value={selectedCampana} onChange={e => setSelectedCampana(e.target.value)} disabled={!!editingEntry}><option value="">Selecciona...</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Col>
                            </Form.Group>
                            {selectedCampana && (<>
                                <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Horario</Form.Label><Col sm={9}><Form.Select required name="hora" value={bitacoraData.hora} onChange={handleBitacoraFormChange}><option value="">Selecciona...</option>{generarOpcionesHorario().map(h => <option key={h} value={h}>{h}</option>)}</Form.Select></Col></Form.Group>
                                <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Comentario</Form.Label><Col sm={9}><Form.Control as="textarea" rows={2} name="comentario" value={bitacoraData.comentario} onChange={handleBitacoraFormChange} /></Col></Form.Group>
                                <div className="d-flex justify-content-end">{editingEntry && (<Button variant="secondary" onClick={handleCancelEdit} className="me-2">Cancelar</Button>)}<Button variant={editingEntry ? 'warning' : 'primary'} type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : (editingEntry ? 'Actualizar' : 'Registrar')}</Button></div>
                            </>)}
                        </Form>
                        <hr />
                        <h6>Log de Hoy</h6>
                        {loadingLog ? <div className="text-center"><Spinner size="sm"/></div> : (<ListGroup variant="flush" style={{maxHeight: '200px', overflowY: 'auto'}}>{logDiario.length > 0 ? logDiario.map(entry => (<ListGroup.Item key={entry.id} className="d-flex justify-content-between align-items-center"><div><strong>{entry.hora.substring(0, 5)}:</strong> {entry.comentario}<br /><small className="text-muted">Por: {entry.autor.nombre}</small></div><Button variant="outline-secondary" size="sm" onClick={() => handleEditClick(entry)}>Editar</Button></ListGroup.Item>)) : <p className="text-muted small mt-2">No hay entradas.</p>}</ListGroup>)}
                    </Tab.Pane>

                    {/* --- CONTENIDO DE LA PESTAÑA INCIDENCIAS --- */}
                    <Tab.Pane eventKey="incidencia" active={key === 'incidencia'}>
                        <Form onSubmit={handleIncidenciaSubmit}>
                             <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Campaña*</Form.Label><Col sm={9}><Form.Select required name="campana_id" value={incidenciaData.campana_id} onChange={handleIncidenciaChange}><option value="">Selecciona...</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Col></Form.Group>
                            <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Título*</Form.Label><Col sm={9}><Form.Control type="text" placeholder="Falla en sistema X" required name="titulo" value={incidenciaData.titulo} onChange={handleIncidenciaChange} /></Col></Form.Group>
                            <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Descripción*</Form.Label><Col sm={9}><Form.Control as="textarea" rows={3} placeholder="Detalla lo que sucedió..." required name="descripcion_inicial" value={incidenciaData.descripcion_inicial} onChange={handleIncidenciaChange} /></Col></Form.Group>
                            <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Tipo</Form.Label><Col sm={9}><Form.Select name="tipo" value={incidenciaData.tipo} onChange={handleIncidenciaChange}><option value="TECNICA">Técnica</option><option value="OPERATIVA">Operativa</option><option value="OTRO">Otro</option></Form.Select></Col></Form.Group>
                            <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Herramienta</Form.Label><Col sm={9}><Form.Control type="text" placeholder="Ej: CRM" name="herramienta_afectada" value={incidenciaData.herramienta_afectada} onChange={handleIncidenciaChange} /></Col></Form.Group>
                            <Form.Group as={Row} className="mb-3"><Form.Label column sm={3}>Indicador</Form.Label><Col sm={9}><Form.Control type="text" placeholder="Ej: TMO" name="indicador_afectado" value={incidenciaData.indicador_afectado} onChange={handleIncidenciaChange} /></Col></Form.Group>
                            <Form.Group as={Row} className="mb-3 align-items-center"><Col sm={{span: 9, offset: 3}}><Form.Check type="checkbox" label="Usar fecha y hora actual" checked={usarAhora} onChange={(e) => setUsarAhora(e.target.checked)} />{!usarAhora && (<Form.Control type="datetime-local" value={fechaManual} onChange={(e) => setFechaManual(e.target.value)} className="mt-2" />)}</Col></Form.Group>
                            <div className="d-grid"><Button variant="danger" type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : 'Registrar Incidencia'}</Button></div>
                        </Form>
                    </Tab.Pane>
                </Tab.Content>
            </Card.Body>
        </Card>
    );
}

export default PanelRegistroWidget;