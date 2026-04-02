// src/components/dashboard/CampaignSelector.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Card, Spinner, Badge, Nav, Form, Accordion } from 'react-bootstrap';
import { fetchWithAuth, API_BASE_URL } from '../../api';

const CampaignSelector = ({ show, handleClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('campanas');
    
    // Data Campañas
    const [campanas, setCampanas] = useState([]);
    const [serverSesionesCampanas, setServerSesionesCampanas] = useState([]); 
    const [tempSelectedCampanas, setTempSelectedCampanas] = useState([]);    
    
    // Data Reportería
    const [bolsaReporteria, setBolsaReporteria] = useState([]);
    const [serverSesionesReporteria, setServerSesionesReporteria] = useState([]);
    const [tempSelectedReporteria, setTempSelectedReporteria] = useState([]);

    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Estado para el modal de Checkout (Reportería)
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [checkoutItemId, setCheckoutItemId] = useState(null);
    const [checkoutComment, setCheckoutComment] = useState("");

    // Opcional: Obtener el ID del currentUser. Por ahora supongamos que lo inferimos
    // o el backend ya nos devuelve la bolsa y lo deducimos.
    
    useEffect(() => {
        if (show) {
            loadData();
        }
    }, [show]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Cargar Campañas
            const resCampanas = await fetchWithAuth(`${API_BASE_URL}/gtr/campanas/`);
            const dataCampanas = await resCampanas.json();

            const resSesiones = await fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/activas`);
            const dataSesiones = await resSesiones.json();
            const idsActivosCampanas = dataSesiones.map(s => s.campana.id);

            setCampanas(dataCampanas);
            setServerSesionesCampanas(idsActivosCampanas);
            setTempSelectedCampanas(idsActivosCampanas); 
            
            // 2. Cargar Reportería
            // Obtenemos el user ID actual para saber cuáles están asignadas a nosotros.
            const resMe = await fetchWithAuth(`${API_BASE_URL}/gtr/users/me/`);
            const me = await resMe.json();
            
            const resBolsa = await fetchWithAuth(`${API_BASE_URL}/api/reporteria/bolsa`);
            let dataBolsa = [];
            if(resBolsa.ok) {
                dataBolsa = await resBolsa.json();
            }
            
            const idsActivosReporteria = dataBolsa
                .filter(t => t.estado === 'EN_PROCESO' && t.analista_id === me.id)
                .map(t => t.id);

            setBolsaReporteria(dataBolsa);
            setServerSesionesReporteria(idsActivosReporteria);
            setTempSelectedReporteria(idsActivosReporteria);

        } catch (error) {
            console.error("Error cargando actividades:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleLocalSelectionCampana = (id) => {
        if (tempSelectedCampanas.includes(id)) {
            setTempSelectedCampanas(prev => prev.filter(i => i !== id));
        } else {
            setTempSelectedCampanas(prev => [...prev, id]);
        }
    };
    
    const toggleLocalSelectionReporteria = (id) => {
        if (tempSelectedReporteria.includes(id)) {
            // Si intenta deseleccionar, hay que forzar el comentario.
            // Para simplificar, abrimos directamente el flujo de Confirmación aquí o en el botón guardar.
            // Lo dejaremos para el botón Guardar general para mantener el UX bulk.
            setTempSelectedReporteria(prev => prev.filter(i => i !== id));
        } else {
            // Si intenta agregar, validemos (en la UI) que la bolsa está PENDIENTE
            const t = bolsaReporteria.find(x => x.id === id);
            if(t && t.estado !== 'PENDIENTE' && !serverSesionesReporteria.includes(id)) {
                alert("Esta tarea ya fue tomada por alguien más.");
                return;
            }
            setTempSelectedReporteria(prev => [...prev, id]);
        }
    };

    const validateAndConfirm = () => {
        // En reportería, si se está deseleccionando alguna, necesitamos comentarios de CADA una.
        // Pero para no complicar el modal, podemos pedir un comentario general o procesarlos uno por uno.
        // Dada la complejidad, si hay tareas a remover en Reportería, forzamos un prompt.
        const toRemoveRep = serverSesionesReporteria.filter(id => !tempSelectedReporteria.includes(id));
        
        if (toRemoveRep.length > 0) {
            // Tomamos el primero para el modal (si hay multiples lo ideal sería validarlos todos)
            setCheckoutItemId(toRemoveRep[0]); // Simplificación: pedimos de 1 en 1
            setCheckoutComment("");
            setShowCommentModal(true);
        } else {
            executeSync();
        }
    };

    const handleCommentSubmit = (abortMode = false) => {
        if (!abortMode && !checkoutComment.trim()) return;
        setShowCommentModal(false);
        executeSync(checkoutComment, abortMode);
    };

    const executeSync = async (comentarioGeneral = "", isAborting = false) => {
        setIsSaving(true);
        try {
            const promises = [];
            
            // --- Sync Campañas ---
            const toAddCamp = tempSelectedCampanas.filter(id => !serverSesionesCampanas.includes(id));
            const toRemoveCamp = serverSesionesCampanas.filter(id => !tempSelectedCampanas.includes(id));

            promises.push(...toAddCamp.map(id => 
                fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/check-in`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activity_type: "CAMPAÑA", campana_id: id })
                })
            ));
            promises.push(...toRemoveCamp.map(id => 
                fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/check-out`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activity_type: "CAMPAÑA", campana_id: id })
                })
            ));

            // --- Sync Reportería ---
            const toAddRep = tempSelectedReporteria.filter(id => !serverSesionesReporteria.includes(id));
            const toRemoveRep = serverSesionesReporteria.filter(id => !tempSelectedReporteria.includes(id));

            promises.push(...toAddRep.map(id => 
                fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/check-in`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activity_type: "REPORTERIA", target_id: id })
                })
            ));
            
            promises.push(...toRemoveRep.map(id => 
                fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/check-out`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        activity_type: "REPORTERIA", 
                        target_id: id, 
                        comentario: isAborting ? null : comentarioGeneral,
                        abort: isAborting
                    })
                })
            ));

            await Promise.all(promises);

            if (onUpdate) await onUpdate(true);
            handleClose();
        } catch (error) {
            console.error("Error sincronizando actividades:", error);
            alert("Hubo un error al guardar los cambios.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- RENDERIZADORES --- //

    const renderCampanas = () => (
        <Row xs={1} md={2} lg={3} className="g-3 mt-1">
            {campanas.map((campana) => {
                const isSelected = tempSelectedCampanas.includes(campana.id);
                const isNew = isSelected && !serverSesionesCampanas.includes(campana.id);
                const isRemoving = !isSelected && serverSesionesCampanas.includes(campana.id);

                return (
                    <Col key={campana.id}>
                        <Card 
                            className={`h-100 border-2 action-hover ${isSelected ? 'border-success shadow-sm' : 'border-light shadow-none'}`}
                            style={{ 
                                cursor: isSaving ? 'default' : 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                backgroundColor: isSelected ? '#e6f4ea' : '#fff',
                                opacity: isSaving ? 0.7 : 1
                            }}
                            onClick={() => !isSaving && toggleLocalSelectionCampana(campana.id)}
                        >
                            <Card.Body className="d-flex flex-column justify-content-center align-items-center p-3">
                                <div className="fs-4 mb-2">
                                    {isSelected ? '✅' : '⚪'}
                                </div>
                                <h6 className={`mb-2 text-center ${isSelected ? 'fw-bold text-success' : 'text-muted'}`}>
                                    {campana.nombre}
                                </h6>
                                
                                {isNew && <Badge bg="primary" pill style={{fontSize: '0.65rem'}}>Para iniciar</Badge>}
                                {isRemoving && <Badge bg="danger" pill style={{fontSize: '0.65rem'}}>Para finalizar</Badge>}
                                {!isNew && !isRemoving && isSelected && (
                                    <Badge bg="success" pill style={{fontSize: '0.65rem'}}>Activa</Badge>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                );
            })}
        </Row>
    );

    const renderReporteria = () => {
        if(bolsaReporteria.length === 0) {
            return <div className="text-center text-muted my-5">No hay tareas de reportería en la bolsa hoy.</div>;
        }

        const grouped = bolsaReporteria.reduce((acc, tarea) => {
            const cat = tarea.categoria || 'General';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(tarea);
            return acc;
        }, {});

        // Evitar problemas de zona horaria con las fechas
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        return (
            <Accordion className="mt-2">
                {Object.keys(grouped).map((categoria, idx) => (
                    <Accordion.Item eventKey={idx.toString()} key={categoria}>
                        <Accordion.Header><span className="fw-bold">{categoria}</span></Accordion.Header>
                        <Accordion.Body className="bg-light">
                            <Row xs={1} md={2} lg={3} className="g-3">
                                {grouped[categoria].map((tarea) => {
                                    const isSelected = tempSelectedReporteria.includes(tarea.id);
                                    const isNew = isSelected && !serverSesionesReporteria.includes(tarea.id);
                                    const isRemoving = !isSelected && serverSesionesReporteria.includes(tarea.id);
                                    const isTaken = tarea.estado === 'EN_PROCESO' && !serverSesionesReporteria.includes(tarea.id);
                                    
                                    // Parseamos la fecha_tarea (YYYY-MM-DD) asumiendo UTC para no desfasar
                                    const parts = tarea.fecha_tarea.split('-');
                                    const tareaDate = new Date(parts[0], parts[1] - 1, parts[2]);
                                    tareaDate.setHours(0,0,0,0);

                                    const now = new Date();
                                    let isTimeOverdue = false;
                                    if (tarea.hora_vencimiento) {
                                        const [h, m, s] = tarea.hora_vencimiento.split(':').map(Number);
                                        // Deadline en el contexto de la fecha de la tarea
                                        const deadline = new Date(parts[0], parts[1]-1, parts[2], h, m, s || 0);
                                        if (now > deadline) isTimeOverdue = true;
                                    }
                                    
                                    const isOverdue = (tareaDate < hoy || isTimeOverdue) && tarea.estado !== 'COMPLETADO';

                                    return (
                                        <Col key={tarea.id}>
                                            <Card 
                                                className={`h-100 border-2 action-hover ${isSelected ? 'border-success shadow-sm' : 'border-light shadow-none'} ${isTaken ? 'opacity-50' : ''}`}
                                                style={{ 
                                                    cursor: (isSaving || isTaken) ? 'default' : 'pointer',
                                                    transition: 'all 0.2s ease-in-out',
                                                    backgroundColor: isSelected ? '#e6f4ea' : '#fff',
                                                }}
                                                onClick={() => !isSaving && !isTaken && toggleLocalSelectionReporteria(tarea.id)}
                                            >
                                                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-3">
                                                    <div className="fs-4 mb-2">
                                                        {isTaken ? '🔒' : (isSelected ? '✅' : '⚪')}
                                                    </div>
                                                    <h6 className={`mb-2 text-center ${isSelected ? 'fw-bold text-success' : 'text-muted'}`}>
                                                        {tarea.nombre}
                                                    </h6>
                                                    {tarea.descripcion && (
                                                        <p className="small text-muted text-center mb-2" style={{fontSize: '0.75rem'}}>{tarea.descripcion}</p>
                                                    )}
                                                    
                                                    <div className="d-flex flex-wrap justify-content-center gap-1">
                                                        {isTaken && <Badge bg="secondary" pill style={{fontSize: '0.65rem'}}>Tomada</Badge>}
                                                        {isOverdue && <Badge bg="danger" pill style={{fontSize: '0.65rem'}}>🚨 ATRASADA: {tarea.fecha_tarea}</Badge>}
                                                        {isNew && <Badge bg="primary" pill style={{fontSize: '0.65rem'}}>Empezar ahora</Badge>}
                                                        {isRemoving && <Badge bg="danger" pill style={{fontSize: '0.65rem'}}>Finalizar</Badge>}
                                                        {!isNew && !isRemoving && isSelected && (
                                                            <Badge bg="success" pill style={{fontSize: '0.65rem'}}>En progreso</Badge>
                                                        )}
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>
                ))}
            </Accordion>
        );
    };

    return (
        <>
        <Modal show={show && !showCommentModal} onHide={isSaving ? undefined : handleClose} size="lg" centered backdrop="static">
            <Modal.Header closeButton={!isSaving}>
                <Modal.Title className="fw-bold">Gestión de Actividad</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '65vh', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                <div className="text-center mb-3">
                    <h5 className="mb-1">Elige tu Actividad Actual</h5>
                    <p className="text-muted small mb-0">Selecciona en qué estás trabajando ahora mismo.</p>
                </div>

                <Nav variant="pills" className="justify-content-center mb-4 pb-2 border-bottom" activeKey={activeTab} onSelect={k => setActiveTab(k)}>
                    <Nav.Item>
                        <Nav.Link eventKey="campanas" className="rounded-pill px-4 fw-medium">Atención Campañas</Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="reporteria" className="rounded-pill px-4 fw-medium">Backoffice / Reportería</Nav.Link>
                    </Nav.Item>
                </Nav>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted">Cargando opciones...</p>
                    </div>
                ) : (
                    activeTab === 'campanas' ? renderCampanas() : renderReporteria()
                )}
            </Modal.Body>
            <Modal.Footer className="bg-light border-top">
                <Button variant="link" className="text-muted text-decoration-none" onClick={handleClose} disabled={isSaving}>
                    Cancelar
                </Button>
                <Button 
                    variant="primary" 
                    onClick={validateAndConfirm} 
                    disabled={isSaving || loading}
                    className="px-4 fw-bold shadow-sm"
                    style={{ minWidth: '160px' }}
                >
                    {isSaving ? (
                        <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                            Sincronizando...
                        </>
                    ) : 'Guardar y Sincronizar'}
                </Button>
            </Modal.Footer>
        </Modal>

        {/* Modal Intermedio para comentario de Reportería */}
        <Modal show={showCommentModal} onHide={() => setShowCommentModal(false)} backdrop="static" centered>
             <Modal.Header closeButton>
                <Modal.Title>Finalizar Tarea de Reportería</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className="mb-2">Estás a punto de desmarcar una tarea de Reportería. Por favor, deja un comentario obligatorio sobre el resultado o el motivo del cierre:</p>
                <Form.Control 
                    as="textarea"
                    rows={3}
                    placeholder="Escribe el comentario final aquí..."
                    value={checkoutComment}
                    onChange={(e) => setCheckoutComment(e.target.value)}
                />
            </Modal.Body>
            <Modal.Footer className="d-flex justify-content-between">
                <Button variant="outline-danger" onClick={() => handleCommentSubmit(true)}>
                    🔓 Liberar Tarea (No concluir)
                </Button>
                <div className="d-flex gap-2">
                    <Button variant="secondary" onClick={() => setShowCommentModal(false)}>Cancelar</Button>
                    <Button variant="success" onClick={() => handleCommentSubmit(false)} disabled={!checkoutComment.trim()}>
                        ✅ Completar Tarea
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
        </>
    );
};

export default CampaignSelector;