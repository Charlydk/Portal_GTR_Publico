// RUTA: src/pages/DetalleTareaPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Badge, ProgressBar, Button, Form, Spinner, ListGroup, Alert, InputGroup, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';

const DetalleTareaPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [tarea, setTarea] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Estados para UI local
    const [comentario, setComentario] = useState('');
    const [enviandoComentario, setEnviandoComentario] = useState(false);
    const [showExtraInput, setShowExtraInput] = useState(false);
    const [extraItemText, setExtraItemText] = useState('');
    const [extraItemTime, setExtraItemTime] = useState('');
    const [addingItem, setAddingItem] = useState(false);

    // Estados Modales
    const [showModalFinalizar, setShowModalFinalizar] = useState(false);
    const [comentarioFinal, setComentarioFinal] = useState('');
    const [procesandoEstado, setProcesandoEstado] = useState(false);
    const [showModalReasignar, setShowModalReasignar] = useState(false);
    const [analistas, setAnalistas] = useState([]);
    const [nuevoResponsableId, setNuevoResponsableId] = useState('');
    const [reasignando, setReasignando] = useState(false);

    // --- CARGA DE DATOS ---

    const fetchTarea = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}`);
            if (!response.ok) throw new Error("Error de conexión");
            const data = await response.json();
            
            if (data.checklist_items) {
                data.checklist_items.sort((a, b) => a.id - b.id);
            }
            setTarea(data);
        } catch (err) {
            console.error(err);
            if (!isSilent) setError(err.message);
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const fetchAnalistas = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/analistas/listado-simple/`);
            if (res.ok) setAnalistas(await res.json());
        } catch (err) { console.error(err); }
    };

    // --- SINCRONIZACIÓN AUTOMÁTICA (POLLING) ---
    useEffect(() => {
        fetchTarea(); // Primera carga

        const interval = setInterval(() => {
            // Refrescar cada 2 segundos si la pestaña está activa
            if (!document.hidden) fetchTarea(true); 
        }, 10000);

        return () => clearInterval(interval);
    }, [id]);

    useEffect(() => {
        if (showModalReasignar && analistas.length === 0) fetchAnalistas();
    }, [showModalReasignar]);

    // --- ACCIONES ---

    const toggleItem = async (itemId, estadoActual) => {
        // Optimistic UI: Cambiamos visualmente antes de esperar al servidor
        // para que se sienta instantáneo para quien hace click.
        const nuevosItems = tarea.checklist_items.map(i => 
            i.id === itemId ? { ...i, completado: !estadoActual } : i
        );
        setTarea({ ...tarea, checklist_items: nuevosItems });

        try {
            await fetchWithAuth(`${API_BASE_URL}/gtr/checklist_items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completado: !estadoActual })
            });
            // No hacemos fetchTarea() aquí porque el Polling lo hará en breve
            // y ya actualizamos la UI localmente.
        } catch (err) {
            console.error("Error al marcar item:", err);
            fetchTarea(); // Revertir si falló
        }
    };

    const handleAddExtraItem = async () => {
        if (!extraItemText.trim()) return;
        setAddingItem(true);
        
        // Mantenemos esto visual por si acaso
        let descripcionFinal = extraItemTime ? `[${extraItemTime}] (Extra) ${extraItemText}` : `(Extra) ${extraItemText}`;

        try {
            await fetchWithAuth(`${API_BASE_URL}/gtr/checklist_items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descripcion: descripcionFinal,
                    tarea_id: parseInt(id),
                    completado: false,
                    // 👇 ¡AQUÍ ESTABA EL ERROR! AGREGAMOS ESTA LÍNEA 👇
                    hora_sugerida: extraItemTime || null 
                })
            });
            setExtraItemText('');
            setExtraItemTime('');
            setShowExtraInput(false);
            fetchTarea(true); 
        } catch (err) {
            alert("Error al agregar ítem");
        } finally {
            setAddingItem(false);
        }
    };

    const handleComentario = async (e) => {
        e.preventDefault();
        if (!comentario.trim()) return;
        setEnviandoComentario(true);
        try {
            await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}/comentarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: comentario })
            });
            setComentario('');
            fetchTarea(true);
        } catch (err) { alert("Error enviando comentario"); } 
        finally { setEnviandoComentario(false); }
    };

    // ... (El resto de funciones confirmarFinalizacion, retomarTarea, handleReasignar se mantienen igual) ...
    const confirmarFinalizacion = async () => {
        setProcesandoEstado(true);
        try {
            if (comentarioFinal.trim()) {
                await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}/comentarios`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texto: `[CIERRE] ${comentarioFinal}` })
                });
            }
            await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ progreso: 'COMPLETADA' })
            });
            setShowModalFinalizar(false);
            navigate('/tareas/disponibles'); 
        } catch (err) { alert("Error al finalizar"); } 
        finally { setProcesandoEstado(false); }
    };

    const retomarTarea = async () => {
        if(!window.confirm("¿Reabrir rutina?")) return;
        setProcesandoEstado(true);
        try {
            await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ progreso: 'EN_PROGRESO' })
            });
            await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}/comentarios`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: `[SISTEMA] Tarea reabierta.` })
            });
            fetchTarea(); 
        } catch (err) { alert("Error al retomar"); } 
        finally { setProcesandoEstado(false); }
    };

    const handleReasignar = async () => {
        if (!nuevoResponsableId) return;
        setReasignando(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analista_id: parseInt(nuevoResponsableId) })
            });
            if (res.ok) {
                const analistaNombre = analistas.find(a => a.id === parseInt(nuevoResponsableId))?.nombre || 'Otro';
                await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}/comentarios`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texto: `[SISTEMA] Reasignado a: ${analistaNombre}` })
                });
                alert("Reasignado correctamente.");
                setShowModalReasignar(false);
                fetchTarea();
            } else throw new Error();
        } catch (error) { alert("Error al reasignar."); } 
        finally { setReasignando(false); }
    };

    // --- RENDER ---
    if (loading) return <Container className="py-5 text-center"><Spinner animation="border" /></Container>;
    if (error) return <Container className="py-5"><Alert variant="danger">{error}</Alert></Container>;
    if (!tarea) return null;

    const totalItems = tarea.checklist_items.length;
    const completados = tarea.checklist_items.filter(i => i.completado).length;
    const progreso = totalItems === 0 ? 0 : Math.round((completados / totalItems) * 100);
    const esAnalista = user.role === 'ANALISTA';
    const esSupervisor = ['SUPERVISOR', 'RESPONSABLE'].includes(user.role);
    const tareaCerrada = tarea.progreso === 'COMPLETADA';

    return (
        <Container className="py-4">
            <div className="mb-4">
                <Button variant="link" className="text-muted ps-0 mb-2" onClick={() => navigate(-1)}>← Volver</Button>
                <div className="d-flex justify-content-between align-items-start">
                    <div>
                        <Badge bg={tareaCerrada ? 'success' : 'primary'} className="mb-2">{tarea.campana?.nombre} {tareaCerrada && '✓'}</Badge>
                        <h2 className="mb-1">{tarea.titulo}</h2>
                        <p className="text-muted mb-0">{tarea.descripcion}</p>
                        {/* Indicador de Modo Colaborativo */}
                        <div className="mt-2 text-success small">
                            <span className="spinner-grow spinner-grow-sm me-2" role="status" style={{width:'8px', height:'8px'}}></span>
                            Sincronización en vivo activa
                        </div>
                    </div>
                    <div className="text-end">
                        <h3 className={`mb-0 ${progreso === 100 ? 'text-success' : 'text-primary'}`}>{progreso}%</h3>
                        <small className="text-muted">Progreso Global</small>
                    </div>
                </div>
                <ProgressBar now={progreso} variant={progreso === 100 ? 'success' : 'primary'} className="mt-3" style={{ height: '10px' }} />
            </div>

            <Row className="g-4">
                <Col lg={8}>
                    <Card className={`shadow-sm border-0 mb-4 ${tareaCerrada ? 'bg-light border-success' : ''}`}>
                        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center flex-wrap">
                            <h5 className="mb-0">✅ Lista de Actividades</h5>
                            
                            {/* --- REFERENCIA VISUAL CORREGIDA --- */}
                            <div className="d-flex align-items-center bg-light px-3 py-2 rounded" style={{ fontSize: '0.75rem' }}>
                                <span className="fw-bold me-3 text-muted text-uppercase" style={{fontSize:'0.7rem'}}>Referencias:</span>
                                
                                {/* Rojo: Vencido */}
                                <div className="d-flex align-items-center me-3">
                                    <span className="rounded-circle me-1" style={{width:'12px', height:'12px', backgroundColor: '#dc3545', display:'inline-block'}}></span>
                                    <span className="text-secondary">Vencido</span>
                                </div>
                                
                                {/* Azul: En Horario */}
                                <div className="d-flex align-items-center me-3">
                                    <span className="rounded-circle me-1" style={{width:'12px', height:'12px', backgroundColor: '#0d6efd', display:'inline-block'}}></span>
                                    <span className="text-secondary">En Horario</span>
                                </div>
                                
                                {/* Amarillo: Próximo */}
                                <div className="d-flex align-items-center">
                                    <span className="rounded-circle me-1" style={{width:'12px', height:'12px', backgroundColor: '#ffc107', display:'inline-block'}}></span>
                                    <span className="text-secondary">Próximo</span>
                                </div>
                            </div>
                        </Card.Header>
                        <ListGroup variant="flush" className={tareaCerrada ? 'opacity-75' : ''}>
                        {tarea.checklist_items.map(item => {
                            // --- 1. LIMPIEZA DE TEXTO Y DETECCIÓN DE EXTRA ---
                            let descripcionLimpia = item.descripcion;
                            // Detectamos si es extra antes de limpiar
                            const esExtra = descripcionLimpia.includes('(Extra)');
                            
                            // Borramos [HH:MM] del inicio y la palabra (Extra)
                            descripcionLimpia = descripcionLimpia
                                .replace(/^\[.*?\]\s*/, '') // Quita [10:30]
                                .replace(/\(Extra\)\s*/, ''); // Quita (Extra)
                            // ------------------------------------------------

                            // --- 2. LÓGICA DE SEMÁFORO (COLORES) ---
                            let badgeBg = 'warning'; 
                            let badgeIcon = 'bi-clock';
                            // Ya no usamos badgeText (Atrasado/En curso)
                            
                            if (item.hora_sugerida && !item.completado) {
                                const now = new Date();
                                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                                const [h, m] = item.hora_sugerida.toString().substring(0, 5).split(':').map(Number);
                                const taskMinutes = h * 60 + m;
                                const diff = currentMinutes - taskMinutes;

                                if (diff > 15) {
                                    badgeBg = 'danger'; // Rojo
                                    badgeIcon = 'bi-alarm-fill';
                                } else if (diff >= 0 && diff <= 15) {
                                    badgeBg = 'primary'; // Azul
                                    badgeIcon = 'bi-rocket-takeoff-fill';
                                } else {
                                    badgeBg = 'warning'; // Amarillo
                                    badgeIcon = 'bi-clock';
                                }
                            } else if (item.completado) {
                                badgeBg = 'success';
                                badgeIcon = 'bi-check-circle-fill';
                            }

                            return (
                                <ListGroup.Item key={item.id} className="py-3 action-hover bg-transparent">
                                    <Form.Check type="checkbox" id={`check-${item.id}`}>
                                        <div className="d-flex align-items-center">
                                            <Form.Check.Input 
                                                type="checkbox" 
                                                checked={item.completado}
                                                onChange={() => toggleItem(item.id, item.completado)}
                                                style={{ transform: 'scale(1.3)', cursor: 'pointer', marginTop: 0 }}
                                                disabled={tareaCerrada} 
                                            />
                                            <Form.Check.Label 
                                                style={{ 
                                                    marginLeft: '12px', 
                                                    cursor: tareaCerrada ? 'default' : 'pointer',
                                                    textDecoration: item.completado ? 'line-through' : 'none',
                                                    color: item.completado ? '#adb5bd' : '#212529',
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap'
                                                }}
                                            >
                                                {/* --- BADGE DE HORA (SOLO ICONO + HORA) --- */}
                                                {item.hora_sugerida && (
                                                    <Badge 
                                                        bg={badgeBg} 
                                                        text={badgeBg === 'warning' ? "dark" : "white"} 
                                                        className="me-2 d-flex align-items-center" 
                                                        style={{ fontSize: '0.85em', height: '24px' }}
                                                    >
                                                        <i className={`bi ${badgeIcon} me-1`}></i>
                                                        {item.hora_sugerida.toString().substring(0, 5)}
                                                    </Badge>
                                                )}

                                                {esExtra && (
                                                    <OverlayTrigger overlay={<Tooltip>Actividad Extra</Tooltip>}>
                                                        <Badge bg="light" text="dark" className="me-2" style={{height: '24px', width: '24px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%'}}>
                                                            ↪️
                                                        </Badge>
                                                    </OverlayTrigger>
                                                )}
                                                
                                                {/* --- DESCRIPCIÓN LIMPIA --- */}
                                                <span style={{ paddingTop: '2px' }}>
                                                    {descripcionLimpia}
                                                </span>
                                            </Form.Check.Label>
                                        </div>
                                    </Form.Check>
                                </ListGroup.Item>
                            );
                        })}
                    </ListGroup>
                        {/* Footer input extra... (mismo código anterior) */}
                        {!tareaCerrada && (esAnalista || esSupervisor) && (
                            <Card.Footer className="bg-white border-top-0 pt-0 pb-3">
                                {showExtraInput ? (
                                    <div className="mt-2">
                                        <InputGroup>
                                            <Form.Control type="time" style={{maxWidth:'130px'}} value={extraItemTime} onChange={(e)=>setExtraItemTime(e.target.value)}/>
                                            <Form.Control placeholder="Actividad extra..." value={extraItemText} onChange={(e)=>setExtraItemText(e.target.value)} onKeyPress={(e)=>e.key==='Enter' && handleAddExtraItem()}/>
                                            <Button variant="outline-secondary" onClick={()=>setShowExtraInput(false)}>✕</Button>
                                            <Button variant="primary" onClick={handleAddExtraItem} disabled={addingItem}>{addingItem?<Spinner size="sm"/>:'Guardar'}</Button>
                                        </InputGroup>
                                    </div>
                                ) : (
                                    <Button variant="link" className="text-decoration-none ps-0 mt-2 text-muted" onClick={()=>setShowExtraInput(true)}>+ Agregar extra</Button>
                                )}
                            </Card.Footer>
                        )}
                    </Card>
                    
                    {/* Botones de acción finales... (mismo código anterior) */}
                    {esAnalista && (
                        <div className="d-grid gap-2 mb-5">
                            {!tareaCerrada ? (
                                <Button variant="success" size="lg" onClick={() => setShowModalFinalizar(true)}>Finalizar Rutina</Button>
                            ) : (
                                <Button variant="warning" className="text-white fw-bold" size="lg" onClick={retomarTarea} disabled={procesandoEstado}>
                                    {procesandoEstado ? <Spinner size="sm"/> : '↩ Retomar Tarea'}
                                </Button>
                            )}
                        </div>
                    )}
                </Col>

                {/* Columna Derecha (Info y Chat)... (mismo código anterior) */}
                <Col lg={4}>
                    <Card className="shadow-sm border-0 mb-3 bg-light">
                        <Card.Body>
                            <small className="text-muted d-block">Estado</small>
                            <Badge bg={tareaCerrada ? 'success' : 'warning'} className="mb-3">{tarea.progreso}</Badge>
                            {esSupervisor && !tareaCerrada && (
                                <div className="mt-3 d-grid"><Button size="sm" variant="outline-dark" onClick={() => setShowModalReasignar(true)}>👤 Reasignar Responsable</Button></div>
                            )}
                        </Card.Body>
                    </Card>
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-white"><h6 className="mb-0">💬 Chat de Equipo</h6></Card.Header>
                        <Card.Body style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {tarea.comentarios.length === 0 ? <p className="text-muted small text-center my-3">Sin mensajes.</p> : (
                                tarea.comentarios.map(c => (
                                    <div key={c.id} className="mb-3 border-bottom pb-2">
                                        <div className="d-flex justify-content-between">
                                            <strong style={{fontSize: '0.9rem'}}>{c.autor?.nombre}</strong>
                                            <small className="text-muted" style={{fontSize: '0.75rem'}}>{new Date(c.fecha_creacion).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                                        </div>
                                        <p className="mb-0 small text-secondary">{c.texto}</p>
                                    </div>
                                ))
                            )}
                        </Card.Body>
                        <Card.Footer className="bg-white">
                            <Form onSubmit={handleComentario}>
                                <InputGroup>
                                    <Form.Control size="sm" placeholder="Escribir mensaje..." value={comentario} onChange={e => setComentario(e.target.value)} />
                                    <Button type="submit" size="sm" variant="outline-primary" disabled={enviandoComentario}>Enviar</Button>
                                </InputGroup>
                            </Form>
                        </Card.Footer>
                    </Card>
                </Col>
            </Row>

            {/* Modales Finalizar y Reasignar... (igual que antes) */}
            <Modal show={showModalFinalizar} onHide={() => setShowModalFinalizar(false)} centered>
                <Modal.Header closeButton><Modal.Title>Finalizar</Modal.Title></Modal.Header>
                <Modal.Body>
                    <p>¿Confirmas el cierre de la rutina?</p>
                    <Form.Control as="textarea" rows={3} placeholder="Comentario opcional..." value={comentarioFinal} onChange={(e) => setComentarioFinal(e.target.value)} />
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModalFinalizar(false)}>Cancelar</Button>
                    <Button variant="success" onClick={confirmarFinalizacion} disabled={procesandoEstado}>{procesandoEstado ? <Spinner size="sm"/> : 'Confirmar'}</Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showModalReasignar} onHide={() => setShowModalReasignar(false)} centered>
                <Modal.Header closeButton><Modal.Title>Reasignar Tarea</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form.Select value={nuevoResponsableId} onChange={(e) => setNuevoResponsableId(e.target.value)}>
                        <option value="">-- Seleccionar --</option>
                        {analistas.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                    </Form.Select>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={handleReasignar} disabled={!nuevoResponsableId || reasignando}>{reasignando ? <Spinner size="sm"/> : 'Guardar'}</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default DetalleTareaPage;