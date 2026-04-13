import React, { useState, useEffect } from 'react';
import { Card, Badge, ListGroup, Spinner, ProgressBar, Nav, Button, Modal, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../../api';

function MisTareasAnalistaWidget({ bolsa = [], userId, onUpdateRequested }) {
    const [dataEntregables, setDataEntregables] = useState(null);
    const [loadingEntregables, setLoadingEntregables] = useState(true);
    const [activeTab, setActiveTab] = useState('entregables');
    const [actionLoading, setActionLoading] = useState(null); // id of task being processed
    
    // Modal state for checkout comment
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [checkoutItemId, setCheckoutItemId] = useState(null);
    const [checkoutComment, setCheckoutComment] = useState("");
    
    // Modal state for Bolsa Disponible
    const [showBolsaModal, setShowBolsaModal] = useState(false);
    const [selectedBolsaTasks, setSelectedBolsaTasks] = useState([]);
    const [filtroCategoria, setFiltroCategoria] = useState('Todas');

    const navigate = useNavigate();

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const resEntregables = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/resumen-pendientes`);
                if (resEntregables.ok) setDataEntregables(await resEntregables.json());
            } catch (err) {
                console.error("Error fetching entregables", err);
            } finally {
                setLoadingEntregables(false);
            }
        };
        fetchInitialData();
    }, []);

    // Derived states for Reporteria
    const misTareasReporteria = bolsa.filter(t => t.estado === 'EN_PROCESO' && Number(t.analista_id) === Number(userId));
    const tareasDisponibles = bolsa.filter(t => t.estado === 'PENDIENTE');
    
    const categoriasDisponibles = ['Todas', ...new Set(tareasDisponibles.map(t => t.categoria || 'Sin Categoría'))];
    const tareasDisponiblesFiltradas = filtroCategoria === 'Todas' ? tareasDisponibles : tareasDisponibles.filter(t => (t.categoria || 'Sin Categoría') === filtroCategoria);

    // Totals for Badges
    const totalEntregables = dataEntregables ? dataEntregables.total : 0;
    const progressEntregables = totalEntregables === 0 ? 0 : Math.round((dataEntregables.en_progreso / totalEntregables) * 100);

    const isOverdue = (tarea) => {
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        if (!tarea.fecha_tarea) return false;
        
        const parts = tarea.fecha_tarea.split('-');
        const tareaDate = new Date(parts[0], parts[1]-1, parts[2]);
        tareaDate.setHours(0,0,0,0);

        let isTimeOverdue = false;
        if (tarea.hora_vencimiento) {
            const [h, m, s] = tarea.hora_vencimiento.split(':').map(Number);
            const deadline = new Date(parts[0], parts[1]-1, parts[2], h, m, s || 0);
            if (new Date() > deadline) isTimeOverdue = true;
        }
        return (tareaDate < hoy || isTimeOverdue) && tarea.estado !== 'COMPLETADO';
    };

    const countVencidas = misTareasReporteria.filter(t => isOverdue(t)).length;

    // Actions
    const handleTomarMultiples = async () => {
        if (selectedBolsaTasks.length === 0) return;
        setActionLoading('multi');
        try {
            const promises = selectedBolsaTasks.map(id => fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activity_type: "REPORTERIA", target_id: id })
            }));
            await Promise.all(promises);
            
            setSelectedBolsaTasks([]);
            setShowBolsaModal(false);
            if (onUpdateRequested) onUpdateRequested(true);
        } catch (error) {
            alert("Error al tomar las tareas");
        } finally {
            setActionLoading(null);
        }
    };

    const handleOpenCheckout = (id) => {
        setCheckoutItemId(id);
        setCheckoutComment("");
        setShowCommentModal(true);
    };

    const handleCheckoutSubmit = async (abortMode = false, overrideId = null) => {
        if (!abortMode && !checkoutComment.trim()) return;
        
        const id = overrideId || checkoutItemId;
        setShowCommentModal(false);
        setActionLoading(id);
        
        try {
            await fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/check-out`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    activity_type: "REPORTERIA", 
                    target_id: id, 
                    comentario: abortMode ? null : checkoutComment,
                    abort: abortMode
                })
            });
            if (onUpdateRequested) onUpdateRequested(true);
        } catch (error) {
            alert("Error al gestionar la tarea");
        } finally {
            setActionLoading(null);
        }
    };

    if (loadingEntregables) return (
        <Card className="shadow-sm border-0 h-100">
            <Card.Body className="d-flex justify-content-center align-items-center">
                <Spinner animation="border" size="sm" variant="primary" />
            </Card.Body>
        </Card>
    );

    return (
        <>
        <Card className="shadow-sm border-0 h-100 overflow-hidden">
            <Card.Header className="bg-white border-0 py-3">
                <Nav variant="tabs" className="mb-0 border-bottom-0" activeKey={activeTab} onSelect={k => setActiveTab(k)}>
                    <Nav.Item>
                        <Nav.Link eventKey="entregables" className={`fw-bold ${activeTab === 'entregables' ? 'text-primary border-bottom border-primary border-3' : 'text-muted border-0'}`}>
                            💼 Mis Tareas
                            {totalEntregables > 0 && <Badge bg="primary" pill className="ms-2">{totalEntregables}</Badge>}
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="reporteria" className={`fw-bold ${activeTab === 'reporteria' ? 'text-primary border-bottom border-primary border-3' : 'text-muted border-0'}`}>
                            🗂️ Reportería
                            {misTareasReporteria.length > 0 && <Badge bg="warning" text="dark" pill className="ms-2">{misTareasReporteria.length}</Badge>}
                            {countVencidas > 0 && <Badge bg="danger" pill className="ms-1">!</Badge>}
                        </Nav.Link>
                    </Nav.Item>
                </Nav>
            </Card.Header>

            <Card.Body className="pt-2 bg-light" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {activeTab === 'entregables' && (
                    <>
                        {totalEntregables > 0 ? (
                            <div className="bg-white p-3 rounded shadow-sm mb-3">
                                <div className="d-flex justify-content-between small mb-1">
                                    <span className="text-muted">Progreso actual ({dataEntregables.en_progreso}/{totalEntregables})</span>
                                    <span className="fw-bold">{progressEntregables}%</span>
                                </div>
                                <ProgressBar now={progressEntregables} variant="info" style={{height: '6px'}} className="rounded-pill shadow-sm" />
                            </div>
                        ) : null}

                        <div className="bg-white rounded shadow-sm">
                            <ListGroup variant="flush">
                                {totalEntregables > 0 ? dataEntregables.recientes.map(item => (
                                    <ListGroup.Item 
                                        key={item.id} 
                                        action 
                                        onClick={() => navigate(`/backoffice/entregables/${item.id}`)}
                                        className="px-3 py-3 border-bottom d-flex justify-content-between align-items-center"
                                        style={{fontSize: '0.85rem'}}
                                    >
                                        <div className="text-truncate me-2">
                                            <div className="fw-semibold text-dark text-truncate">{item.titulo}</div>
                                            <small className="text-muted">{item.campana_nombre}</small>
                                        </div>
                                        <Badge bg={item.estado === 'EN_PROGRESO' ? 'warning' : 'secondary'} className="fw-normal shadow-sm">
                                            {item.estado === 'EN_PROGRESO' ? '⚡ En curso' : '📋 Pendiente'}
                                        </Badge>
                                    </ListGroup.Item>
                                )) : (
                                    <div className="text-center py-4">
                                        <div className="fs-3 mb-2">🎉</div>
                                        <p className="text-muted small mb-0">No hay tareas pendientes por ahora.</p>
                                    </div>
                                )}
                            </ListGroup>
                        </div>
                        {totalEntregables > 0 && (
                            <div className="text-center mt-3">
                                <Button variant="link" size="sm" className="text-decoration-none fw-bold" onClick={() => navigate('/backoffice/kanban')}>
                                    Ver tablero completo →
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'reporteria' && (
                    <>
                        <h6 className="fw-bold text-muted mb-2 small text-uppercase">Tus Reportes (En Proceso)</h6>
                        {misTareasReporteria.length > 0 ? (
                            <div className="bg-white rounded shadow-sm mb-4">
                                <ListGroup variant="flush">
                                    {misTareasReporteria.map(t => {
                                        const overdue = isOverdue(t);
                                        return (
                                            <ListGroup.Item key={t.id} className="p-3 border-bottom">
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <div className="fw-bold">{t.nombre}</div>
                                                        <div className="text-muted" style={{fontSize: '0.75rem'}}>{t.categoria}</div>
                                                    </div>
                                                    {t.hora_vencimiento && (
                                                        <Badge bg={overdue ? 'danger' : 'light'} text={overdue ? 'white' : 'dark'} className="border">
                                                            ⏱️ {t.hora_vencimiento.substring(0, 5)} {overdue && '🚨'}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="d-flex gap-2 mt-2">
                                                    <Button 
                                                        variant="success" 
                                                        size="sm" 
                                                        className="flex-grow-1 fw-bold"
                                                        onClick={() => handleOpenCheckout(t.id)}
                                                        disabled={actionLoading === t.id}
                                                    >
                                                        {actionLoading === t.id ? <Spinner size="sm" animation="border" /> : '✅ Completar'}
                                                    </Button>
                                                    <Button 
                                                        variant="outline-danger" 
                                                        size="sm" 
                                                        className="fw-bold"
                                                        onClick={() => handleCheckoutSubmit(true, t.id)} // Abort mode direct
                                                        disabled={actionLoading === t.id}
                                                    >
                                                        ↩️ Liberar
                                                    </Button>
                                                </div>
                                            </ListGroup.Item>
                                        );
                                    })}
                                </ListGroup>
                            </div>
                        ) : (
                            <div className="text-center py-3 mb-4 bg-white rounded shadow-sm">
                                <p className="text-muted small mb-0">No tenés reportes en curso.</p>
                            </div>
                        )}

                        <div className="d-grid mt-2">
                            <Button 
                                variant="outline-primary" 
                                className="py-2 border-2 shadow-sm fw-bold d-flex justify-content-between align-items-center"
                                onClick={() => setShowBolsaModal(true)}
                            >
                                <span>Ver Bolsa Disponible</span>
                                <Badge bg="primary" pill>{tareasDisponibles.length}</Badge>
                            </Button>
                        </div>
                    </>
                )}
            </Card.Body>
        </Card>

        {/* Modal Bolsa Disponible */}
        <Modal show={showBolsaModal} onHide={() => {setShowBolsaModal(false); setSelectedBolsaTasks([]);}} backdrop="static" centered size="lg">
            <Modal.Header closeButton className="bg-light pb-2 border-bottom-0">
                <Modal.Title className="h6 fw-bold">📋 Bolsa Disponible de Reportería</Modal.Title>
            </Modal.Header>
            
            {/* Filtros de Categoría */}
            <div className="bg-light px-3 flex-wrap gap-2 d-flex pb-2 shadow-sm">
                {categoriasDisponibles.map(cat => (
                    <Badge 
                        key={cat} 
                        bg={filtroCategoria === cat ? 'primary' : 'white'} 
                        text={filtroCategoria === cat ? 'white' : 'dark'}
                        className={`border action-hover p-2 ${filtroCategoria === cat ? 'border-primary' : 'border-secondary'} shadow-sm`}
                        style={{cursor: 'pointer'}}
                        onClick={() => setFiltroCategoria(cat)}
                    >
                        {cat}
                    </Badge>
                ))}
            </div>

            <Modal.Body className="p-0" style={{maxHeight: '55vh', overflowY: 'auto'}}>
                {tareasDisponiblesFiltradas.length > 0 ? (
                    <ListGroup variant="flush">
                        {tareasDisponiblesFiltradas.map(t => {
                            const overdue = isOverdue(t);
                            const isSelected = selectedBolsaTasks.includes(t.id);
                            return (
                                <ListGroup.Item 
                                    key={t.id} 
                                    className={`p-3 border-bottom d-flex align-items-center justify-content-between action-hover ${isSelected ? 'bg-light border-primary border-start border-4' : ''}`}
                                    onClick={() => {
                                        if (isSelected) setSelectedBolsaTasks(prev => prev.filter(id => id !== t.id));
                                        else setSelectedBolsaTasks(prev => [...prev, t.id]);
                                    }}
                                    style={{cursor: 'pointer'}}
                                >
                                    <div>
                                        <div className="fw-semibold text-dark" style={{fontSize: '0.95rem'}}>{t.nombre}</div>
                                        <div className="d-flex align-items-center gap-2 mt-1">
                                            <span className="text-muted fw-bold" style={{fontSize: '0.75rem'}}>{t.categoria}</span>
                                            {t.hora_vencimiento && (
                                                <Badge bg="secondary" style={{fontSize: '0.65rem'}}>
                                                    ⏱ Límite: {t.hora_vencimiento.substring(0, 5)}
                                                </Badge>
                                            )}
                                            {overdue && <Badge bg="danger" style={{fontSize: '0.65rem'}}>🚨 Atrasado</Badge>}
                                        </div>
                                    </div>
                                    <Form.Check 
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}} // Controlled via onClick on the row
                                        style={{transform: 'scale(1.2)'}}
                                    />
                                </ListGroup.Item>
                            );
                        })}
                    </ListGroup>
                ) : (
                    <div className="text-center py-5 bg-white">
                        <p className="text-muted mb-0">No hay tareas para esta categoría.</p>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer className="border-top-0 bg-light py-2 d-flex justify-content-between">
                <div>
                     <span className="text-muted small fw-bold">{selectedBolsaTasks.length} seleccionadas</span>
                </div>
                <div>
                    <Button variant="outline-secondary" className="me-2" onClick={() => {setShowBolsaModal(false); setSelectedBolsaTasks([]);}}>Cerrar</Button>
                    <Button 
                        variant="primary" 
                        onClick={handleTomarMultiples}
                        disabled={selectedBolsaTasks.length === 0 || actionLoading === 'multi'}
                        className="fw-bold shadow-sm px-4"
                    >
                        {actionLoading === 'multi' ? <Spinner size="sm" animation="border" /> : 'Confirmar Tareas'}
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>

        {/* Modal Intermedio para comentario de Reportería */}
        <Modal show={showCommentModal} onHide={() => setShowCommentModal(false)} backdrop="static" centered>
             <Modal.Header closeButton>
                <Modal.Title className="h6 fw-bold">Completar Tarea de Reportería</Modal.Title>
            </Modal.Header>
            <Modal.Body className="bg-light">
                <p className="mb-3 small text-muted">Por favor, deja un comentario confirmando el resultado, links enviados o motivo del cierre:</p>
                <Form.Control 
                    as="textarea"
                    rows={3}
                    placeholder="Escribe tu comentario aquí..."
                    value={checkoutComment}
                    onChange={(e) => setCheckoutComment(e.target.value)}
                    className="shadow-sm"
                />
            </Modal.Body>
            <Modal.Footer className="border-top-0 d-flex justify-content-end">
                <Button variant="outline-secondary" onClick={() => setShowCommentModal(false)}>Cancelar</Button>
                <Button variant="success" className="shadow-sm fw-bold" onClick={() => handleCheckoutSubmit(false)} disabled={!checkoutComment.trim()}>
                    ✅ Terminar Tarea
                </Button>
            </Modal.Footer>
        </Modal>
        </>
    );
}

export default MisTareasAnalistaWidget;
