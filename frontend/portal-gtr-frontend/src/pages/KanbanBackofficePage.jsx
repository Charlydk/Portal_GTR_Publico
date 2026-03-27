// RUTA: src/pages/KanbanBackofficePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Badge, Button, Spinner, Alert, Modal, Form, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';

// ─── Constantes de Estado ───────────────────────────────────────────────────
const ESTADOS = [
    { key: 'PENDIENTE',   label: '📋 Pendiente',   variant: 'secondary', bg: '#f8f9fa', border: '#dee2e6' },
    { key: 'EN_PROGRESO', label: '⚡ En Progreso',  variant: 'warning',   bg: '#fff9e6', border: '#ffc107' },
    { key: 'COMPLETADO',  label: '✅ Completado',   variant: 'success',   bg: '#f0fff4', border: '#28a745' },
];

/**
 * Hook para efecto pulsante en CSS
 */
const style = `
@keyframes pulse-red {
    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
    100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
}
.overdue-pulse {
    animation: pulse-red 2s infinite;
    border: 1px solid #dc3545 !important;
}
`;

// ─── Modal de Crear/Editar Entregable ────────────────────────────────────────
function EntregableModal({ show, onHide, entregable, analistas, campanas, onSaved }) {
    const { user } = useAuth();
    const initialForm = { titulo: '', descripcion: '', estado: 'PENDIENTE', fecha_limite: '', asignado_a_id: '', campana_id: '' };
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const isSupervisor = user?.role === 'SUPERVISOR' || user?.role === 'RESPONSABLE';
    // Regla de Edición Core: Supervisor o Creador (si no está bloqueado)
    const canEditCore = !entregable || isSupervisor || (user?.id === entregable?.creador_id && !entregable?.es_bloqueado);

    useEffect(() => {
        if (entregable) {
            setForm({
                titulo: entregable.titulo || '',
                descripcion: entregable.descripcion || '',
                estado: entregable.estado || 'PENDIENTE',
                fecha_limite: entregable.fecha_limite || '',
                asignado_a_id: entregable.asignado_a_id ? entregable.asignado_a_id.toString() : '',
                campana_id: entregable.campana_id || '',
            });
        } else {
            setForm({
                ...initialForm,
                asignado_a_id: isSupervisor ? '' : user?.id?.toString() || ''
            });
        }
        setError(null);
    }, [entregable, show, user, isSupervisor]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const payload = {
            ...form,
            asignado_a_id: form.asignado_a_id ? parseInt(form.asignado_a_id) : null,
            campana_id: form.campana_id ? parseInt(form.campana_id) : null,
            fecha_limite: form.fecha_limite || null,
        };
        const url = entregable
            ? `${API_BASE_URL}/gtr/entregables/${entregable.id}`
            : `${API_BASE_URL}/gtr/entregables/`;
        const method = entregable ? 'PUT' : 'POST';
        try {
            const res = await fetchWithAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Error al guardar el entregable.');
            }
            await onSaved();
            onHide();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <form onSubmit={handleSubmit}>
                <Modal.Header closeButton>
                    <Modal.Title className="h6 fw-bold">
                        {entregable ? '✏️ Editar Entregable' : '➕ Nuevo Entregable'}
                        {entregable?.es_bloqueado && <Badge bg="dark" className="ms-2" style={{fontSize: '0.6rem'}}>🔒 BLOQUEADO</Badge>}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
                    
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold">Título *</Form.Label>
                        <Form.Control 
                            size="sm" name="titulo" value={form.titulo} 
                            onChange={e => setForm({...form, titulo: e.target.value})} 
                            required readOnly={!canEditCore}
                        />
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold">Descripción</Form.Label>
                        <Form.Control 
                            as="textarea" rows={2} size="sm" name="descripcion" 
                            value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} 
                            readOnly={!canEditCore}
                        />
                    </Form.Group>
                    
                    <Row className="g-2 mb-3">
                        <Col>
                            <Form.Label className="small fw-semibold">Estado</Form.Label>
                            <Form.Select size="sm" name="estado" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                                {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                            </Form.Select>
                        </Col>
                        <Col>
                            <Form.Label className="small fw-semibold">Fecha Límite</Form.Label>
                            <Form.Control 
                                type="date" size="sm" name="fecha_limite" 
                                value={form.fecha_limite} onChange={e => setForm({...form, fecha_limite: e.target.value})} 
                                readOnly={!canEditCore}
                            />
                        </Col>
                    </Row>
                    
                    <Row className="g-2">
                        <Col>
                            <Form.Label className="small fw-semibold">Asignado a</Form.Label>
                            <Form.Select 
                                size="sm" name="asignado_a_id" value={form.asignado_a_id} 
                                onChange={e => setForm({...form, asignado_a_id: e.target.value})}
                                disabled={!isSupervisor}
                            >
                                <option value="">Sin asignar</option>
                                {analistas.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                            </Form.Select>
                        </Col>
                        <Col>
                            <Form.Label className="small fw-semibold">Campaña</Form.Label>
                            <Form.Select 
                                size="sm" name="campana_id" value={form.campana_id} 
                                onChange={e => setForm({...form, campana_id: e.target.value})}
                                disabled={!canEditCore}
                            >
                                <option value="">Global</option>
                                {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </Form.Select>
                        </Col>
                    </Row>
                    
                    {!canEditCore && entregable && (
                        <Alert variant="info" className="mt-3 py-1 small mb-0">
                            Solo podés cambiar el <strong>Estado</strong>. Los campos principales están bloqueados por el creador o un supervisor.
                        </Alert>
                    )}
                </Modal.Body>
                <Modal.Footer className="border-0">
                    <Button variant="light" size="sm" onClick={onHide}>Cancelar</Button>
                    <Button variant="primary" size="sm" type="submit" disabled={loading}>
                        {loading ? <Spinner size="sm" animation="border" /> : (entregable ? 'Guardar' : 'Crear')}
                    </Button>
                </Modal.Footer>
            </form>
        </Modal>
    );
}

// ─── Tarjeta de Entregable ───────────────────────────────────────────────────
function EntregableCard({ item, onEdit, onDelete, canDelete }) {
    const navigate = useNavigate();
    const isVencido = item.fecha_limite && new Date(item.fecha_limite + 'T23:59:59') < new Date() && item.estado !== 'COMPLETADO';
    
    return (
        <Card 
            className={`mb-2 shadow-sm border-0 ${isVencido ? 'overdue-pulse' : ''}`} 
            style={{ borderRadius: '8px', cursor: 'pointer' }}
            onClick={() => navigate(`/backoffice/entregables/${item.id}`)}
        >
            <Card.Body className="p-3">
                <style>{style}</style>
                <div className="d-flex justify-content-between align-items-start">
                    <span className="fw-semibold small" style={{ lineHeight: '1.3' }}>{item.titulo}</span>
                    <div className="d-flex gap-1 ms-2" onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm p-0 px-1 text-muted" title="Rápido" onClick={() => onEdit(item)} style={{ fontSize: '0.75rem' }}>✏️</button>
                        {canDelete && <button className="btn btn-sm p-0 px-1 text-muted" title="Eliminar" onClick={() => onDelete(item.id)} style={{ fontSize: '0.75rem' }}>🗑️</button>}
                    </div>
                </div>
                {item.descripcion && <p className="text-muted mb-2 mt-1 text-truncate" style={{ fontSize: '0.7rem' }}>{item.descripcion}</p>}
                <div className="d-flex flex-wrap gap-1 mt-1">
                    {/* Badge de Creador */}
                    {item.creador && (
                        <Badge 
                            bg={item.creador.role === 'ANALISTA' ? 'secondary' : 'dark'} 
                            className="fw-normal" style={{ fontSize: '0.6rem' }}
                        >
                            {item.creador.role === 'ANALISTA' ? '👤 Analista' : '🛡️ Supervisor'}
                        </Badge>
                    )}
                    {item.campana && <Badge bg="info" className="fw-normal" style={{ fontSize: '0.6rem' }}>{item.campana.nombre}</Badge>}
                    {item.asignado_a && <Badge bg="light" text="dark" className="border fw-normal" style={{ fontSize: '0.6rem' }}>👤 {item.asignado_a.nombre}</Badge>}
                    {item.fecha_limite && (
                        <Badge bg={isVencido ? 'danger' : 'light'} text={isVencido ? 'white' : 'dark'} className="border fw-normal" style={{ fontSize: '0.6rem' }}>
                            📅 {item.fecha_limite} {isVencido && '⚠️'}
                        </Badge>
                    )}
                </div>
            </Card.Body>
        </Card>
    );
}

// ─── Columna Kanban ──────────────────────────────────────────────────────────
function KanbanColumn({ estado, items, onEdit, onDelete, canDeleteAdmin }) {
    return (
        <Col>
            <div
                className="h-100 p-2 rounded-3"
                style={{ background: estado.bg, border: `2px solid ${estado.border}`, minHeight: '500px' }}
            >
                <div className="d-flex justify-content-between align-items-center mb-3 px-1">
                    <span className="fw-bold small">{estado.label}</span>
                    <Badge bg={estado.variant} pill className="fw-normal">{items.length}</Badge>
                </div>
                <div className="kanban-scroll" style={{maxHeight: '70vh', overflowY: 'auto'}}>
                    {items.map(item => (
                        <EntregableCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} canDelete={canDeleteAdmin} />
                    ))}
                    {items.length === 0 && (
                        <p className="text-center text-muted small mt-5 px-2">Sin entregables</p>
                    )}
                </div>
            </div>
        </Col>
    );
}

// ─── Página Principal ────────────────────────────────────────────────────────
function KanbanBackofficePage() {
    const { user } = useAuth();
    const [entregables, setEntregables] = useState([]);
    const [analistas, setAnalistas] = useState([]);
    const [campanas, setCampanas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    // Filtros
    const [filtroAnalista, setFiltroAnalista] = useState('');
    const [showHistory, setShowHistory] = useState(false);

    const isSupervisor = user?.role === 'SUPERVISOR' || user?.role === 'RESPONSABLE';

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [resEnt, resAna, resCamp] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/gtr/entregables/?historico=${showHistory}`),
                fetchWithAuth(`${API_BASE_URL}/gtr/analistas/listado-simple/`),
                fetchWithAuth(`${API_BASE_URL}/gtr/campanas/`),
            ]);
            if (!resEnt.ok) throw new Error('No se pudieron cargar los entregables.');
            setEntregables(await resEnt.json());
            if (resAna.ok) setAnalistas(await resAna.json());
            if (resCamp.ok) setCampanas(await resCamp.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [showHistory]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEdit = (item) => { setEditTarget(item); setShowModal(true); };
    const handleNew = () => { setEditTarget(null); setShowModal(true); };
    const handleDelete = async (id) => {
        if (!window.confirm('¿Seguro que querés eliminar este entregable?')) return;
        await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/${id}`, { method: 'DELETE' });
        fetchData();
    };

    // Aplicar Filtros
    const filtrados = entregables.filter(item => {
        if (filtroAnalista && item.asignado_a_id !== parseInt(filtroAnalista)) return false;
        return true;
    });

    const columnas = ESTADOS.map(e => ({
        ...e,
        items: filtrados.filter(i => i.estado === e.key),
    }));

    return (
        <Container fluid className="py-4 px-4">
            {/* Cabecera */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                <div>
                    <h3 className="fw-bold mb-0">📦 Backoffice Kanban</h3>
                    <small className="text-muted">Control de entregables, reportes y desarrollos del equipo</small>
                </div>
                
                <div className="d-flex gap-3 align-items-center">
                    <Form.Check 
                        type="switch"
                        id="history-switch"
                        label="Ver Histórico (>15d)"
                        className="small text-muted fw-semibold mb-0"
                        checked={showHistory}
                        onChange={e => setShowHistory(e.target.checked)}
                        style={{fontSize: '0.8rem'}}
                    />

                    <InputGroup size="sm" style={{width: '240px'}} className="shadow-sm">
                        <InputGroup.Text className="bg-white px-2"><span style={{fontSize: '0.75rem'}}>👤 Analista</span></InputGroup.Text>
                        <Form.Select value={filtroAnalista} onChange={e => setFiltroAnalista(e.target.value)}>
                            <option value="">Todos</option>
                            {analistas.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                        </Form.Select>
                    </InputGroup>

                    <Button variant="primary" size="sm" className="shadow-sm px-3" onClick={handleNew}>
                        ➕ Nuevo
                    </Button>
                </div>
            </div>

            {loading && <div className="text-center py-5"><Spinner animation="border" /></div>}
            {error && <Alert variant="danger">{error}</Alert>}

            {!loading && !error && (
                <Row className="g-3">
                    {columnas.map(col => (
                        <KanbanColumn
                            key={col.key}
                            estado={col}
                            items={col.items}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            canDeleteAdmin={isSupervisor}
                        />
                    ))}
                </Row>
            )}

            <EntregableModal
                show={showModal}
                onHide={() => setShowModal(false)}
                entregable={editTarget}
                analistas={analistas}
                campanas={campanas}
                onSaved={fetchData}
            />
        </Container>
    );
}

export default KanbanBackofficePage;

