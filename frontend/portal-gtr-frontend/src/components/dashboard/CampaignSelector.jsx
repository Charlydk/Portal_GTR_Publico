// src/components/dashboard/CampaignSelector.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Card, Spinner, Badge } from 'react-bootstrap';
import { fetchWithAuth, API_BASE_URL } from '../../api'; // Ajusta la ruta según tu estructura

const CampaignSelector = ({ show, handleClose, onUpdate }) => {
    const [campanas, setCampanas] = useState([]);
    const [sesionesActivas, setSesionesActivas] = useState([]); // IDs de campañas activas
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState(null); // Para mostrar spinner en el botón clickeado

    // Cargar datos al abrir el modal
    useEffect(() => {
        if (show) {
            loadData();
        }
    }, [show]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Obtener todas las campañas (endpoint abierto que hicimos)
            const resCampanas = await fetchWithAuth(`${API_BASE_URL}/gtr/campanas/`);
            const dataCampanas = await resCampanas.json();

            // 2. Obtener mis sesiones activas
            const resSesiones = await fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/activas`);
            const dataSesiones = await resSesiones.json();

            // Guardamos solo los IDs de las campañas donde estoy activo
            const idsActivos = dataSesiones.map(s => s.campana.id);

            setCampanas(dataCampanas);
            setSesionesActivas(idsActivos);
        } catch (error) {
            console.error("Error cargando campañas:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSesion = async (campanaId) => {
        setProcessingId(campanaId);
        const estaActivo = sesionesActivas.includes(campanaId);
        const url = estaActivo 
            ? `${API_BASE_URL}/gtr/sesiones/check-out`
            : `${API_BASE_URL}/gtr/sesiones/check-in`;

        try {
            const response = await fetchWithAuth(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campana_id: campanaId })
            });

            if (response.ok) {
                // Actualizar estado local inmediatamente para feedback visual
                if (estaActivo) {
                    setSesionesActivas(prev => prev.filter(id => id !== campanaId));
                } else {
                    setSesionesActivas(prev => [...prev, campanaId]);
                }
                // Notificar al padre que hubo cambios (para refrescar el dashboard)
                if (onUpdate) onUpdate();
            }
        } catch (error) {
            console.error("Error cambiando estado:", error);
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title>Selección de Actividad</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <p className="text-muted text-center mb-4">
                    Selecciona las campañas que gestionarás hoy. <br/>
                    <small>Esto ayuda a tu supervisor a saber qué campañas están cubiertas.</small>
                </p>

                {loading && campanas.length === 0 ? (
                    <div className="text-center"><Spinner animation="border" /></div>
                ) : (
                    <Row xs={1} md={2} lg={3} className="g-3">
                        {campanas.map((campana) => {
                            const isActive = sesionesActivas.includes(campana.id);
                            const isProcessing = processingId === campana.id;

                            return (
                                <Col key={campana.id}>
                                    <Card 
                                        className={`h-100 text-center cursor-pointer border-${isActive ? 'success' : 'secondary'}`}
                                        style={{ 
                                            transition: 'all 0.2s', 
                                            transform: isActive ? 'scale(1.02)' : 'scale(1)',
                                            backgroundColor: isActive ? '#f0fff4' : '#fff'
                                        }}
                                        onClick={() => !isProcessing && toggleSesion(campana.id)}
                                    >
                                        <Card.Body className="d-flex flex-column justify-content-center align-items-center">
                                            <h6 className="mb-2">{campana.nombre}</h6>
                                            {isProcessing ? (
                                                <Spinner size="sm" animation="border" variant={isActive ? 'danger' : 'success'} />
                                            ) : (
                                                <Badge bg={isActive ? 'success' : 'secondary'}>
                                                    {isActive ? 'Activo (Gestionando)' : 'Inactivo'}
                                                </Badge>
                                            )}
                                        </Card.Body>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={handleClose}>
                    Confirmar y Continuar
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default CampaignSelector;