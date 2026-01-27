// RUTA: src/pages/GestionPlantillasPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Form, Button, Spinner, Alert, ListGroup, Row, Col, Badge } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../api';

function GestionPlantillasPage() {
    const { authToken } = useAuth();
    
    // --- ESTADOS ---
    const [campanas, setCampanas] = useState([]);
    const [selectedCampanaId, setSelectedCampanaId] = useState('');
    const [plantillaItems, setPlantillaItems] = useState([]);
    
    // Formulario Nuevo Item
    const [newItemText, setNewItemText] = useState('');
    const [newItemTime, setNewItemTime] = useState('');
    
    // Estado de Días (Inicialmente todos activos)
    const [diasSeleccionados, setDiasSeleccionados] = useState({
        lunes: true, martes: true, miercoles: true, jueves: true, 
        viernes: true, sabado: true, domingo: true
    });
    
    const [loading, setLoading] = useState({ campanas: false, items: false });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // --- CARGAS DE DATOS ---
    const fetchCampanas = useCallback(async () => {
        if (!authToken) return;
        setLoading(prev => ({ ...prev, campanas: true }));
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/listado-simple/`);
            if (response.ok) setCampanas(await response.json());
        } catch (err) { setError(err.message); } 
        finally { setLoading(prev => ({ ...prev, campanas: false })); }
    }, [authToken]);

    useEffect(() => { fetchCampanas(); }, [fetchCampanas]);

    const fetchPlantillaItems = useCallback(async (campanaId) => {
        if (!campanaId) return;
        setLoading(prev => ({ ...prev, items: true }));
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${campanaId}/plantilla`);
            if (response.ok) setPlantillaItems(await response.json());
            else setPlantillaItems([]);
        } catch (err) { setPlantillaItems([]); } 
        finally { setLoading(prev => ({ ...prev, items: false })); }
    }, []);

    useEffect(() => {
        if (selectedCampanaId) fetchPlantillaItems(selectedCampanaId);
        else setPlantillaItems([]);
    }, [selectedCampanaId, fetchPlantillaItems]);

    // --- MANEJO DE SELECCIÓN DE DÍAS (Toggle) ---
    const toggleDia = (diaKey) => {
        setDiasSeleccionados(prev => ({
            ...prev,
            [diaKey]: !prev[diaKey]
        }));
    };

    // --- AGREGAR ITEM ---
    const handleAddChecklistItem = async (e) => {
        e.preventDefault();
        if (!newItemText || !selectedCampanaId) return;
        
        setSubmitting(true);
        try {
            const payload = {
                descripcion: newItemText, 
                // Si el usuario puso hora, la enviamos. Si no, enviamos null.
                hora_sugerida: newItemTime ? newItemTime : null, 
                ...diasSeleccionados
            };

            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${selectedCampanaId}/plantilla`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setNewItemText('');
                // Opcional: ¿Resetear días o mantener la selección anterior? 
                // Lo dejamos igual por si quiere cargar varios items para los mismos dias.
                fetchPlantillaItems(selectedCampanaId);
            } else {
                alert("Error al guardar. Revisa consola.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm("¿Borrar este ítem?")) return;
        try {
            await fetchWithAuth(`${GTR_API_URL}/plantilla-items/${itemId}`, { method: 'DELETE' });
            fetchPlantillaItems(selectedCampanaId);
        } catch (err) { alert("Error al eliminar"); }
    };

    // Renderizado de las "Bolitas" de días en la lista
    const renderDiasBadge = (item) => {
        const diasConfig = [
            { key: 'lunes', label: 'L' }, { key: 'martes', label: 'M' }, { key: 'miercoles', label: 'X' },
            { key: 'jueves', label: 'J' }, { key: 'viernes', label: 'V' }, { key: 'sabado', label: 'S' },
            { key: 'domingo', label: 'D' }
        ];
        return (
            <div className="d-flex gap-1 mt-1">
                {diasConfig.map(dia => (
                    <span key={dia.key} 
                          className={`badge rounded-circle p-1 d-flex align-items-center justify-content-center ${item[dia.key] ? 'bg-primary' : 'bg-light text-muted border'}`} 
                          style={{width: '20px', height: '20px', fontSize: '0.6rem'}}>
                        {dia.label}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <Container className="py-4">
            <h3 className="mb-4 text-center text-primary fw-bold">Gestión de Rutinas</h3>
            
            <Row className="justify-content-center">
                <Col md={10} lg={8}>
                    <Card className="shadow border-0">
                        <Card.Header className="bg-white border-bottom py-3">
                            <h5 className="mb-0 text-muted">Configuración de Tareas Diarias</h5>
                        </Card.Header>
                        <Card.Body className="p-4">
                            
                            {/* 1. SELECTOR DE CAMPAÑA */}
                            <Form.Group className="mb-4">
                                <Form.Label className="fw-bold">Seleccionar Campaña</Form.Label>
                                <Form.Select 
                                    size="lg"
                                    value={selectedCampanaId} 
                                    onChange={(e) => setSelectedCampanaId(e.target.value)}
                                    className="shadow-sm"
                                >
                                    <option value="">-- Selecciona una campaña --</option>
                                    {campanas.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>

                            {selectedCampanaId && (
                                <div className="animate__animated animate__fadeIn">
                                    {/* 2. FORMULARIO DE NUEVA TAREA */}
                                    <div className="bg-light p-4 rounded-3 border mb-4">
                                        <h6 className="fw-bold text-primary mb-3">⚡ Nueva Tarea Programada</h6>
                                        <Form onSubmit={handleAddChecklistItem}>
                                            <Row>
                                                <Col md={8}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="small text-muted">Descripción</Form.Label>
                                                        <Form.Control
                                                            type="text"
                                                            placeholder="Ej: Enviar reporte de cierre"
                                                            value={newItemText}
                                                            onChange={e => setNewItemText(e.target.value)}
                                                            required
                                                            className="border-0 shadow-sm py-2"
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={4}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="small text-muted">Hora (Opcional)</Form.Label>
                                                        <Form.Control
                                                            type="time"
                                                            value={newItemTime}
                                                            onChange={e => setNewItemTime(e.target.value)}
                                                            className="border-0 shadow-sm py-2"
                                                        />
                                                    </Form.Group>
                                                </Col>
                                            </Row>

                                            {/* SELECTOR DE DÍAS (BOTONES) */}
                                            <div className="mb-3">
                                                <Form.Label className="small text-muted d-block mb-2">Días activos:</Form.Label>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {[
                                                        {k:'lunes', l:'Lun'}, {k:'martes', l:'Mar'}, {k:'miercoles', l:'Mié'}, 
                                                        {k:'jueves', l:'Jue'}, {k:'viernes', l:'Vie'}, {k:'sabado', l:'Sáb'}, {k:'domingo', l:'Dom'}
                                                    ].map(dia => (
                                                        <Button 
                                                            key={dia.k}
                                                            variant={diasSeleccionados[dia.k] ? 'primary' : 'outline-secondary'}
                                                            size="sm"
                                                            onClick={() => toggleDia(dia.k)}
                                                            className="rounded-pill px-3"
                                                            type="button" // Importante para no enviar form
                                                        >
                                                            {dia.l}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="d-grid">
                                                <Button type="submit" variant="success" disabled={submitting} className="fw-bold py-2">
                                                    {submitting ? <Spinner size="sm" animation="border"/> : '+ Agregar Tarea a la Rutina'}
                                                </Button>
                                            </div>
                                        </Form>
                                    </div>

                                    <hr className="text-muted opacity-25 my-4" />
                                    
                                    {/* 3. LISTA DE TAREAS */}
                                    <h6 className="text-muted mb-3">Tareas Configuradas ({plantillaItems.length})</h6>
                                    {loading.items ? <div className="text-center py-3"><Spinner animation="border" variant="primary"/></div> : (
                                        <ListGroup variant="flush">
                                            {plantillaItems.map(item => (
                                                <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center py-3 px-0 border-bottom">
                                                    <div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            {/* Mostramos la hora si existe */}
                                                            {item.hora_sugerida && (
                                                                <Badge bg="warning" text="dark" className="d-flex align-items-center">
                                                                    <i className="bi bi-clock me-1"></i>
                                                                    {item.hora_sugerida.substring(0, 5)}
                                                                </Badge>
                                                            )}
                                                            <div className="fw-semibold text-dark" style={{fontSize: '1.05rem'}}>
                                                                {item.descripcion}
                                                            </div>
                                                        </div>
                                                        {renderDiasBadge(item)}
                                                    </div>
                                                    <Button variant="link" className="text-danger p-0 ms-3" onClick={() => handleDeleteItem(item.id)}>
                                                        <i className="bi bi-trash"></i> Eliminar
                                                    </Button>
                                                </ListGroup.Item>
                                            ))}
                                            {plantillaItems.length === 0 && (
                                                <div className="text-center text-muted py-4">
                                                    No hay tareas configuradas. <br/>
                                                    <small>Esta campaña no generará checklist automático.</small>
                                                </div>
                                            )}
                                        </ListGroup>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default GestionPlantillasPage;