// RUTA: src/pages/DetalleEntregablePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Button, Form, Spinner, Alert, ListGroup, InputGroup } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';

const ESTADOS = [
    { key: 'PENDIENTE',   label: '📋 Pendiente',   variant: 'secondary' },
    { key: 'EN_PROGRESO', label: '⚡ En Progreso',  variant: 'warning' },
    { key: 'COMPLETADO',  label: '✅ Completado',   variant: 'success' },
];

function DetalleEntregablePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [entregable, setEntregable] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Estados para edición
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({});
    const [analistas, setAnalistas] = useState([]);
    const [campanas, setCampanas] = useState([]);

    // Estados para items y comentarios
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newComment, setNewComment] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingItems, setLoadingItems] = useState(new Set());

    const fetchData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [resEnt, resAna, resCamp] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/gtr/entregables/${id}`),
                fetchWithAuth(`${API_BASE_URL}/gtr/analistas/listado-simple/`),
                fetchWithAuth(`${API_BASE_URL}/gtr/campanas/`),
            ]);
            if (!resEnt.ok) throw new Error('No se pudo cargar el entregable.');
            const data = await resEnt.json();
            setEntregable(data);
            setForm({
                titulo: data.titulo,
                descripcion: data.descripcion || '',
                estado: data.estado,
                fecha_limite: data.fecha_limite || '',
                asignado_a_id: data.asignado_a_id || '',
                campana_id: data.campana_id || '',
            });
            if (resAna.ok) setAnalistas(await resAna.json());
            if (resCamp.ok) setCampanas(await resCamp.json());
        } catch (err) {
            setError(err.message);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const refreshEntregable = () => fetchData(true);

    const isSupervisor = user?.role === 'SUPERVISOR' || user?.role === 'RESPONSABLE';
    const canEditCore = isSupervisor || (user?.id === entregable?.creador_id && !entregable?.es_bloqueado);
    const canManageItems = canEditCore || (user?.id === entregable?.asignado_a_id);

    const handleUpdate = async (e, newState = null) => {
        if (e) e.preventDefault();
        setActionLoading(true);
        try {
            const payload = {
                ...form,
                estado: newState || form.estado,
                asignado_a_id: form.asignado_a_id ? parseInt(form.asignado_a_id) : null,
                campana_id: form.campana_id ? parseInt(form.campana_id) : null,
                fecha_limite: form.fecha_limite || null,
            };
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Error al actualizar.');
            }
            setEditMode(false);
            await refreshEntregable();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleTomarControl = async () => {
        if (!window.confirm('¿Tomar control de esta tarea? Esto bloqueará la edición para el analista proactivo.')) return;
        setActionLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/${id}/tomar-control`, { method: 'POST' });
            if (!res.ok) throw new Error('Error al tomar control.');
            await fetchData();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!newItemDesc.trim()) return;
        setActionLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/${id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descripcion: newItemDesc, orden: entregable.items.length }),
            });
            if (!res.ok) throw new Error('Error al añadir item.');
            setNewItemDesc('');
            await refreshEntregable();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleItem = async (itemId, currentStatus) => {
        setLoadingItems(prev => new Set(prev).add(itemId));
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/${id}/items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completado: !currentStatus }),
            });
            if (!res.ok) throw new Error('Error al actualizar item.');
            await refreshEntregable();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoadingItems(prev => { const s = new Set(prev); s.delete(itemId); return s; });
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm('¿Eliminar esta tarea interna?')) return;
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/${id}/items/${itemId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Error al eliminar item.');
            await refreshEntregable();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setActionLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/${id}/comentarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contenido: newComment }),
            });
            if (!res.ok) throw new Error('Error al añadir comentario.');
            setNewComment('');
            await refreshEntregable();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <Container className="p-5 text-center"><Spinner animation="border" /></Container>;
    if (error) return <Container className="p-5"><Alert variant="danger">{error}</Alert></Container>;

    return (
        <Container className="py-4">
            <div className="d-flex justify-content-between align-items-start mb-4">
                <Button variant="outline-secondary" size="sm" onClick={() => navigate('/backoffice/kanban')}>
                    ← Volver al Kanban
                </Button>
                <div className="d-flex gap-2">
                    {isSupervisor && !entregable.es_bloqueado && entregable.creador_id !== user.id && (
                        <Button variant="warning" size="sm" onClick={handleTomarControl} disabled={actionLoading}>
                            🔒 Tomar Control
                        </Button>
                    )}
                    {canEditCore && !editMode && (
                        <Button variant="primary" size="sm" onClick={() => setEditMode(true)}>
                            ✏️ Editar Info Core
                        </Button>
                    )}
                </div>
            </div>

            <Row className="g-4">
                {/* Columna Info Core */}
                <Col lg={4}>
                    <Card className="shadow-sm border-0 sticky-top" style={{ top: '20px' }}>
                        <Card.Header className="bg-white fw-bold">ℹ️ Información Principal</Card.Header>
                        <Card.Body>
                            {editMode ? (
                                <Form onSubmit={handleUpdate}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="small fw-semibold">Título</Form.Label>
                                        <Form.Control size="sm" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} required />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="small fw-semibold">Descripción</Form.Label>
                                        <Form.Control as="textarea" rows={3} size="sm" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="small fw-semibold">Estado</Form.Label>
                                        <Form.Select size="sm" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                                            {ESTADOS.map(es => <option key={es.key} value={es.key}>{es.label}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="small fw-semibold">Fecha Límite</Form.Label>
                                        <Form.Control type="date" size="sm" value={form.fecha_limite} onChange={e => setForm({...form, fecha_limite: e.target.value})} />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="small fw-semibold">Asignado a</Form.Label>
                                        <Form.Select size="sm" value={form.asignado_a_id} onChange={e => setForm({...form, asignado_a_id: e.target.value})}>
                                            <option value="">Sin asignar</option>
                                            {analistas.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                    <Form.Group className="mb-4">
                                        <Form.Label className="small fw-semibold">Campaña</Form.Label>
                                        <Form.Select size="sm" value={form.campana_id} onChange={e => setForm({...form, campana_id: e.target.value})}>
                                            <option value="">Global</option>
                                            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                    <div className="d-flex gap-2">
                                        <Button variant="primary" size="sm" className="w-100" type="submit" disabled={actionLoading}>Guardar</Button>
                                        <Button variant="light" size="sm" className="w-100" onClick={() => setEditMode(false)}>Cancelar</Button>
                                    </div>
                                </Form>
                            ) : (
                                <>
                                    <h5 className="fw-bold mb-3">{entregable.titulo}</h5>
                                    <div className="mb-3">
                                        <Badge bg={ESTADOS.find(e => e.key === entregable.estado)?.variant || 'secondary'} className="me-2">
                                            {ESTADOS.find(e => e.key === entregable.estado)?.label || entregable.estado}
                                        </Badge>
                                        {entregable.es_bloqueado && <Badge bg="dark">🔒 Control Supervisor</Badge>}
                                    </div>
                                    <p className="text-muted small mb-4">{entregable.descripcion || 'Sin descripción.'}</p>
                                    
                                    <ListGroup variant="flush" className="small border-top pt-3">
                                        <ListGroup.Item className="d-flex justify-content-between px-0 py-2">
                                            <span className="text-muted">Asignado a:</span>
                                            <span className="fw-semibold">{entregable.asignado_a ? `${entregable.asignado_a.nombre}` : 'Sin asignar'}</span>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="d-flex justify-content-between px-0 py-2">
                                            <span className="text-muted">Campaña:</span>
                                            <span className="fw-semibold">{entregable.campana?.nombre || 'Global'}</span>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="d-flex justify-content-between px-0 py-2">
                                            <span className="text-muted">Fecha Límite:</span>
                                            <span className="fw-semibold">{entregable.fecha_limite || 'Sin definir'}</span>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="d-flex justify-content-between px-0 py-2">
                                            <span className="text-muted">Creado por:</span>
                                            <span className="fw-semibold">{entregable.creador ? `${entregable.creador.nombre} ${entregable.creador.apellido}` : 'Sistema'}</span>
                                        </ListGroup.Item>
                                    </ListGroup>

                                    {/* Cambio rápido de estado */}
                                    {canManageItems && (
                                        <div className="mt-4 pt-3 border-top">
                                            <Form.Label className="small fw-bold mb-2">Cambiar Estado:</Form.Label>
                                            <div className="d-flex flex-wrap gap-2">
                                                {ESTADOS.map(es => (
                                                    <Button 
                                                        key={es.key} 
                                                        variant={entregable.estado === es.key ? es.variant : `outline-${es.variant}`}
                                                        size="sm"
                                                        onClick={() => { setForm(prev => ({...prev, estado: es.key})); handleUpdate(null, es.key); }}
                                                        disabled={actionLoading}
                                                    >
                                                        {es.label.split(' ')[0]}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                {/* Columna Checklist y Comentarios */}
                <Col lg={8}>
                    {/* Checklist */}
                    <Card className="shadow-sm border-0 mb-4">
                        <Card.Header className="bg-white fw-bold d-flex justify-content-between align-items-center">
                            <span>✅ Sub-Checklist (Backlog)</span>
                            <Badge bg="light" text="dark" className="border">
                                {entregable.items.filter(i => i.completado).length}/{entregable.items.length}
                            </Badge>
                        </Card.Header>
                        <Card.Body>
                            {canManageItems && (
                                <Form onSubmit={handleAddItem} className="mb-4">
                                    <InputGroup size="sm">
                                        <Form.Control 
                                            placeholder="Agregar sub-tarea..." 
                                            value={newItemDesc} 
                                            onChange={e => setNewItemDesc(e.target.value)}
                                        />
                                        <Button variant="outline-primary" type="submit" disabled={actionLoading}>Añadir</Button>
                                    </InputGroup>
                                </Form>
                            )}
                            
                            <ListGroup variant="flush">
                                {entregable.items.map(item => (
                                    <ListGroup.Item key={item.id} className="d-flex align-items-center justify-content-between px-0">
                                        <div className="d-flex align-items-center flex-grow-1">
                                            {loadingItems.has(item.id) ? (
                                                <Spinner animation="border" size="sm" className="me-3 text-primary" style={{width:'16px', height:'16px'}} />
                                            ) : (
                                                <Form.Check 
                                                    type="checkbox"
                                                    checked={item.completado}
                                                    onChange={() => handleToggleItem(item.id, item.completado)}
                                                    className="me-3"
                                                    disabled={loadingItems.size > 0}
                                                />
                                            )}
                                            <span className={item.completado ? 'text-decoration-line-through text-muted' : ''}>
                                                {item.descripcion}
                                            </span>
                                            {item.completado && item.completado_por && (
                                                <Badge bg="light" text="dark" className="ms-2 border fw-normal" style={{fontSize: '0.65rem'}}>
                                                    Hecho por {item.completado_por.nombre}
                                                </Badge>
                                            )}
                                        </div>
                                        {canManageItems && (
                                            <Button variant="link" className="text-danger p-0" onClick={() => handleDeleteItem(item.id)} disabled={loadingItems.has(item.id)}>
                                                🗑️
                                            </Button>
                                        )}
                                    </ListGroup.Item>
                                ))}
                                {entregable.items.length === 0 && (
                                    <p className="text-center text-muted py-3">No hay tareas internas definidas.</p>
                                )}
                            </ListGroup>
                        </Card.Body>
                    </Card>

                    {/* Comentarios e Historial */}
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-white fw-bold">💬 Historial y Comentarios</Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleAddComment} className="mb-4">
                                <Form.Group>
                                    <Form.Control 
                                        as="textarea" 
                                        rows={2} 
                                        placeholder="Dejar un comentario o avance..." 
                                        size="sm"
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        className="mb-2"
                                    />
                                    <div className="text-end">
                                        <Button variant="primary" size="sm" type="submit" disabled={actionLoading || !newComment.trim()}>
                                            Enviar Comentario
                                        </Button>
                                    </div>
                                </Form.Group>
                            </Form>

                            <div className="historial-line" style={{maxHeight: '400px', overflowY: 'auto'}}>
                                {entregable.comentarios.slice().reverse().map(comment => (
                                    <div 
                                        key={comment.id} 
                                        className={`mb-3 p-2 rounded-3 ${comment.es_automatico ? 'bg-light border-start border-3 border-info' : 'bg-white border'}`}
                                        style={{fontSize: '0.85rem'}}
                                    >
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="fw-bold">{comment.autor.nombre} {comment.autor.apellido}</span>
                                            <span className="text-muted" style={{fontSize: '0.7rem'}}>
                                                {new Date(comment.fecha_creacion).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className={comment.es_automatico ? 'fst-italic text-muted' : ''}>
                                            {comment.contenido}
                                        </div>
                                    </div>
                                ))}
                                {entregable.comentarios.length === 0 && (
                                    <p className="text-center text-muted py-3">Sin actividad registrada.</p>
                                )}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default DetalleEntregablePage;
