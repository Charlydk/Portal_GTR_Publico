// src/pages/DetalleIncidenciaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
// CORRECCIÓN: Añadimos 'Modal' a la lista de importaciones
import { Container, Card, Spinner, Alert, ListGroup, Badge, Form, Button, Row, Col, Modal } from 'react-bootstrap';

function DetalleIncidenciaPage() {
    const { id } = useParams();
    const { authToken, user } = useAuth();
    const [incidencia, setIncidencia] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [nuevoComentario, setNuevoComentario] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showCierreModal, setShowCierreModal] = useState(false);
    const [usarAhoraCierre, setUsarAhoraCierre] = useState(true);
    const [fechaCierreManual, setFechaCierreManual] = useState('');

    const formatDateTime = (apiDateString) => {
        // Si no hay fecha, devuelve N/A
        if (!apiDateString) {
            return 'N/A';
        }
    
        // --- LA CORRECCIÓN DEFINITIVA ---
        // Le añadimos la 'Z' al final para forzar a que JavaScript
        // interprete el string como una fecha en formato UTC universal.
        const date = new Date(apiDateString + 'Z');
        // --------------------------------
    
        // Verificamos si la fecha parseada es válida
        if (isNaN(date.getTime())) {
            return 'Fecha inválida';
        }
    
        // A partir de aquí, el resto del código funciona como se espera
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son de 0 a 11
        const year = date.getFullYear();
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
    
        return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
    };

    const getStatusVariant = (estado) => {
        const map = { 'ABIERTA': 'danger', 'EN_PROGRESO': 'warning', 'CERRADA': 'success' };
        return map[estado] || 'secondary';
    };

    const fetchIncidencia = useCallback(async () => {
        //setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/${id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) throw new Error('No se pudo cargar la incidencia.');
            const data = await response.json();
            setIncidencia(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id, authToken]);

    useEffect(() => {
        if (authToken) {
            fetchIncidencia();
        }
    }, [authToken, fetchIncidencia]);
    
    const handleAddUpdate = async (e) => {
        e.preventDefault();
        if (!nuevoComentario.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/${id}/actualizaciones`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ comentario: nuevoComentario }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se pudo añadir la actualización.');
            }
            setNuevoComentario('');
            fetchIncidencia();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssignToMe = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/${id}/asignar`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se pudo asignar la incidencia.');
            }
            fetchIncidencia(); // Recargar datos para mostrar el nuevo asignado
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusChange = async (nuevoEstado, fechaCierre = null) => {
        setIsSubmitting(true);
        setError(null);
        
        const payload = {
            estado: nuevoEstado,
        };

        if (nuevoEstado === 'CERRADA' && fechaCierre) {
            payload.fecha_cierre = fechaCierre;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/${id}/estado`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se pudo cambiar el estado.');
            }
            fetchIncidencia();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
            setShowCierreModal(false);
        }
    };

    const handleConfirmarCierre = () => {
        const fechaParaEnviar = usarAhoraCierre ? null : fechaCierreManual;
        if (!usarAhoraCierre && !fechaCierreManual) {
            alert("Por favor, seleccione una fecha y hora de cierre.");
            return;
        }
        handleStatusChange('CERRADA', fechaParaEnviar);
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
    if (!incidencia) return <Container className="mt-4"><Alert variant="info">Incidencia no encontrada.</Alert></Container>;

    const canManageStatus = !!user;
    const showAssignButton = user && incidencia.asignado_a?.id !== user.id && incidencia.estado !== 'CERRADA';


    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="d-flex justify-content-between align-items-center bg-light">
                    <span>Incidencia: {incidencia.titulo}</span>
                    <Badge bg={getStatusVariant(incidencia.estado)}>{incidencia.estado}</Badge>
                </Card.Header>
                <Card.Body>
                    <Row>
                        <Col md={6}>
                        <p><strong>Campaña:</strong> <Link to={`/campanas/${incidencia.campana.id}`}>{incidencia.campana.nombre}</Link></p>
                            <p><strong>Creador:</strong> {incidencia.creador.nombre} {incidencia.creador.apellido}</p>
                            <p><strong>Asignado a:</strong> {incidencia.asignado_a ? `${incidencia.asignado_a.nombre} ${incidencia.asignado_a.apellido}` : <span className="text-muted fst-italic">Nadie (Abierta)</span>}</p>
                        </Col>
                        <Col md={6}>
                            <p><strong>Herramienta Afectada:</strong> {incidencia.herramienta_afectada || 'N/A'}</p>
                            <p><strong>Indicador Afectado:</strong> {incidencia.indicador_afectado || 'N/A'}</p>
                            <p><strong>Fecha Apertura:</strong> {formatDateTime(incidencia.fecha_apertura)}</p>
                            <p><strong>Fecha Cierre:</strong> {formatDateTime(incidencia.fecha_cierre)}</p>
                        </Col>
                    </Row>
                    <hr />
                    <h5>Descripción Inicial</h5>
                    <p>{incidencia.descripcion_inicial}</p>
                </Card.Body>
            </Card>

            <Card className="shadow-lg mt-4">
                <Card.Header as="h4">Historial de Actualizaciones</Card.Header>
                <Card.Body>
                    <ListGroup variant="flush">
                        {incidencia.actualizaciones.length > 0 ? (
                            incidencia.actualizaciones.map(act => (
                                <ListGroup.Item key={act.id} className="px-0">
                                    <p className="mb-1">{act.comentario}</p>
                                    <small className="text-muted">
                                        Por {act.autor.nombre} {act.autor.apellido} el {formatDateTime(act.fecha_actualizacion)}
                                    </small>
                                </ListGroup.Item>
                            ))
                        ) : (
                            <p className="text-muted">No hay actualizaciones para esta incidencia.</p>
                        )}
                    </ListGroup>
                    <hr />
                    <Form onSubmit={handleAddUpdate}>
                        <Form.Group className="mb-3">
                            <Form.Label>Añadir Actualización</Form.Label>
                            <Form.Control as="textarea" rows={3} value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)} required disabled={isSubmitting} />
                        </Form.Group>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner size="sm" /> : "Publicar Actualización"}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>

            {canManageStatus && (
                <Card className="shadow-lg mt-4">
                    <Card.Header as="h4">Gestionar Incidencia</Card.Header>
                    <Card.Body className="text-center">
                        <p>Acciones disponibles:</p>
                        
                        {/* CAMBIO: Nuevo botón para asignarse la tarea */}
                        {showAssignButton && (
                            <Button variant="warning" onClick={handleAssignToMe} disabled={isSubmitting} className="me-2">
                                {incidencia.asignado_a ? 'Robar y Asignármela' : 'Asignármela'}
                            </Button>
                        )}
                        
                        <Button variant="success" onClick={() => setShowCierreModal(true)} disabled={isSubmitting || incidencia.estado === 'CERRADA'} className="me-2">
                            Cerrar Incidencia
                        </Button>
                        
                        {incidencia.estado !== 'ABIERTA' && (
                             <Button variant="danger" onClick={() => handleStatusChange('ABIERTA')} disabled={isSubmitting}>
                                Reabrir Incidencia
                            </Button>
                        )}
                    </Card.Body>
                </Card>
            )}

            <Modal show={showCierreModal} onHide={() => setShowCierreModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirmar Cierre de Incidencia</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group controlId="fecha_cierre_group">
                        <Form.Check 
                            type="checkbox"
                            id="usarAhoraCierre"
                            label="Usar fecha y hora actual para el cierre"
                            checked={usarAhoraCierre}
                            onChange={(e) => setUsarAhoraCierre(e.target.checked)}
                        />
                        {!usarAhoraCierre && (
                            <Form.Control
                                type="datetime-local"
                                value={fechaCierreManual}
                                onChange={(e) => setFechaCierreManual(e.target.value)}
                                className="mt-2"
                            />
                        )}
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCierreModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={handleConfirmarCierre} disabled={isSubmitting}>
                        {isSubmitting ? <Spinner size="sm" /> : "Confirmar Cierre"}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default DetalleIncidenciaPage;
