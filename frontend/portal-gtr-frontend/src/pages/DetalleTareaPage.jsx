// RUTA: src/pages/DetalleTareaPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Card, Row, Col, Badge, ProgressBar, Button, Form, Spinner, ListGroup, Alert, InputGroup } from 'react-bootstrap';
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
    
    // Estados para comentarios
    const [comentario, setComentario] = useState('');
    const [enviandoComentario, setEnviandoComentario] = useState(false);

    // Estados para item extra
    const [showExtraInput, setShowExtraInput] = useState(false);
    const [extraItemText, setExtraItemText] = useState('');
    const [extraItemTime, setExtraItemTime] = useState(''); // <--- NUEVO ESTADO PARA HORA
    const [addingItem, setAddingItem] = useState(false);

    // Cargar datos
    const fetchTarea = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}`);
            if (!response.ok) throw new Error("No se pudo cargar la tarea");
            const data = await response.json();
            
            // Ordenar items: primero por ID para mantener orden de creación
            if (data.checklist_items) {
                data.checklist_items.sort((a, b) => a.id - b.id);
            }
            setTarea(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTarea();
    }, [id]);

    // --- ACCIONES ---

    // 1. Marcar / Desmarcar Checkbox
    const toggleItem = async (itemId, estadoActual) => {
        // Actualización optimista
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
        } catch (err) {
            console.error("Error al marcar item:", err);
            fetchTarea(); // Revertir si falla
        }
    };

    // 2. Agregar Item Extra (MODIFICADO CON HORA)
    const handleAddExtraItem = async () => {
        if (!extraItemText.trim()) return;
        setAddingItem(true);

        // Formatear el texto final dependiendo de si hay hora o no
        let descripcionFinal = `(Extra) ${extraItemText}`;
        if (extraItemTime) {
            descripcionFinal = `[${extraItemTime}] (Extra) ${extraItemText}`;
        }

        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/checklist_items/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descripcion: descripcionFinal,
                    tarea_id: parseInt(id),
                    completado: false
                })
            });

            if (res.ok) {
                setExtraItemText('');
                setExtraItemTime(''); // Limpiar hora
                setShowExtraInput(false);
                fetchTarea(); 
            }
        } catch (err) {
            alert("Error al agregar ítem extra");
        } finally {
            setAddingItem(false);
        }
    };

    // 3. Completar Tarea
    const finalizarTarea = async () => {
        if (!window.confirm("¿Confirmas que has terminado la rutina?")) return;
        try {
            await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ progreso: 'COMPLETADA' })
            });
            navigate('/tareas/disponibles'); 
        } catch (err) {
            alert("Error al finalizar tarea");
        }
    };

    // 4. Enviar Comentario
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
            fetchTarea(); 
        } catch (err) {
            alert("Error enviando comentario");
        } finally {
            setEnviandoComentario(false);
        }
    };

    // --- RENDER ---
    if (loading) return <Container className="py-5 text-center"><Spinner animation="border" /></Container>;
    if (error) return <Container className="py-5"><Alert variant="danger">{error}</Alert></Container>;
    if (!tarea) return null;

    const totalItems = tarea.checklist_items.length;
    const completados = tarea.checklist_items.filter(i => i.completado).length;
    const progreso = totalItems === 0 ? 0 : Math.round((completados / totalItems) * 100);
    const esAnalista = user.role === 'ANALISTA';
    const tareaCerrada = tarea.progreso === 'COMPLETADA';

    return (
        <Container className="py-4">
            {/* ENCABEZADO */}
            <div className="mb-4">
                <Button variant="link" className="text-muted ps-0 mb-2" onClick={() => navigate(-1)}>← Volver</Button>
                <div className="d-flex justify-content-between align-items-start">
                    <div>
                        <Badge bg="primary" className="mb-2">{tarea.campana?.nombre}</Badge>
                        <h2 className="mb-1">{tarea.titulo}</h2>
                        <p className="text-muted mb-0">{tarea.descripcion}</p>
                    </div>
                    <div className="text-end">
                        <h3 className={`mb-0 ${progreso === 100 ? 'text-success' : 'text-primary'}`}>{progreso}%</h3>
                        <small className="text-muted">Progreso</small>
                    </div>
                </div>
                <ProgressBar now={progreso} variant={progreso === 100 ? 'success' : 'primary'} className="mt-3" style={{ height: '10px' }} />
            </div>

            <Row className="g-4">
                {/* COLUMNA IZQUIERDA: CHECKLIST */}
                <Col lg={8}>
                    <Card className="shadow-sm border-0 mb-4">
                        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">✅ Lista de Actividades</h5>
                        </Card.Header>
                        <ListGroup variant="flush">
                            {tarea.checklist_items.map(item => (
                                <ListGroup.Item key={item.id} className="py-3 action-hover">
                                    <Form.Check type="checkbox" id={`check-${item.id}`}>
                                        <Form.Check.Input 
                                            type="checkbox" 
                                            checked={item.completado}
                                            onChange={() => toggleItem(item.id, item.completado)}
                                            style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                                            disabled={!esAnalista && tareaCerrada}
                                        />
                                        <Form.Check.Label 
                                            style={{ 
                                                marginLeft: '10px', 
                                                cursor: 'pointer',
                                                textDecoration: item.completado ? 'line-through' : 'none',
                                                color: item.completado ? '#adb5bd' : '#212529'
                                            }}
                                        >
                                            {item.descripcion}
                                        </Form.Check.Label>
                                    </Form.Check>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                        
                        {/* --- SECCIÓN AGREGAR ITEM EXTRA (CON HORA) --- */}
                        {!tareaCerrada && esAnalista && (
                            <Card.Footer className="bg-white border-top-0 pt-0 pb-3">
                                {showExtraInput ? (
                                    <div className="mt-2">
                                        <InputGroup>
                                            {/* Selector de hora opcional */}
                                            <Form.Control 
                                                type="time"
                                                style={{ maxWidth: '130px' }}
                                                value={extraItemTime}
                                                onChange={(e) => setExtraItemTime(e.target.value)}
                                                title="Hora (Opcional)"
                                            />
                                            {/* Texto de la tarea */}
                                            <Form.Control 
                                                placeholder="Describe la actividad extra..." 
                                                value={extraItemText}
                                                onChange={(e) => setExtraItemText(e.target.value)}
                                                autoFocus
                                                onKeyPress={(e) => e.key === 'Enter' && handleAddExtraItem()}
                                            />
                                            <Button variant="outline-secondary" onClick={() => setShowExtraInput(false)}>✕</Button>
                                            <Button variant="primary" onClick={handleAddExtraItem} disabled={addingItem}>
                                                {addingItem ? <Spinner size="sm"/> : 'Guardar'}
                                            </Button>
                                        </InputGroup>
                                    </div>
                                ) : (
                                    <Button 
                                        variant="link" 
                                        className="text-decoration-none ps-0 mt-2 text-muted" 
                                        onClick={() => setShowExtraInput(true)}
                                    >
                                        + Agregar actividad extra no listada
                                    </Button>
                                )}
                            </Card.Footer>
                        )}
                    </Card>

                    {/* BOTÓN DE ACCIÓN FINAL */}
                    {esAnalista && !tareaCerrada && (
                        <div className="d-grid gap-2">
                            <Button 
                                variant={progreso === 100 ? "success" : "secondary"} 
                                size="lg"
                                onClick={finalizarTarea}
                            >
                                {progreso === 100 ? '🎉 Finalizar Rutina' : 'Finalizar Rutina'}
                            </Button>
                        </div>
                    )}
                </Col>

                {/* COLUMNA DERECHA: COMENTARIOS */}
                <Col lg={4}>
                    <Card className="shadow-sm border-0 mb-3 bg-light">
                        <Card.Body>
                            <small className="text-muted d-block">Estado Actual</small>
                            <Badge bg={tareaCerrada ? 'success' : 'warning'} className="mb-3">
                                {tarea.progreso}
                            </Badge>
                            
                            <small className="text-muted d-block">Vence hoy a las:</small>
                            <strong>{new Date(tarea.fecha_vencimiento).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong>
                        </Card.Body>
                    </Card>

                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-white">
                            <h6 className="mb-0">💬 Bitácora / Comentarios</h6>
                        </Card.Header>
                        <Card.Body style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {tarea.comentarios.length === 0 ? (
                                <p className="text-muted small text-center my-3">No hay comentarios.</p>
                            ) : (
                                tarea.comentarios.map(c => (
                                    <div key={c.id} className="mb-3 border-bottom pb-2">
                                        <div className="d-flex justify-content-between">
                                            <strong style={{fontSize: '0.9rem'}}>{c.autor?.nombre}</strong>
                                            <small className="text-muted" style={{fontSize: '0.75rem'}}>
                                                {new Date(c.fecha_creacion).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </small>
                                        </div>
                                        <p className="mb-0 small text-secondary">{c.texto}</p>
                                    </div>
                                ))
                            )}
                        </Card.Body>
                        <Card.Footer className="bg-white">
                            <Form onSubmit={handleComentario}>
                                <Form.Group className="mb-2">
                                    <Form.Control 
                                        as="textarea" rows={2} 
                                        placeholder="Reportar novedad..." 
                                        value={comentario}
                                        onChange={e => setComentario(e.target.value)}
                                        style={{fontSize: '0.9rem'}}
                                    />
                                </Form.Group>
                                <div className="text-end">
                                    <Button type="submit" size="sm" variant="outline-primary" disabled={enviandoComentario}>
                                        Enviar
                                    </Button>
                                </div>
                            </Form>
                        </Card.Footer>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default DetalleTareaPage;