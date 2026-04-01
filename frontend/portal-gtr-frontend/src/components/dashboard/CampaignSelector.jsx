// src/components/dashboard/CampaignSelector.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Card, Spinner, Badge } from 'react-bootstrap';
import { fetchWithAuth, API_BASE_URL } from '../../api';

const CampaignSelector = ({ show, handleClose, onUpdate }) => {
    const [campanas, setCampanas] = useState([]);
    const [serverSesiones, setServerSesiones] = useState([]); // IDs activos en el servidor
    const [tempSelected, setTempSelected] = useState([]);    // IDs seleccionados localmente en el modal
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Cargar datos originales al abrir el modal
    useEffect(() => {
        if (show) {
            loadData();
        }
    }, [show]);

    const loadData = async () => {
        setLoading(true);
        try {
            const resCampanas = await fetchWithAuth(`${API_BASE_URL}/gtr/campanas/`);
            const dataCampanas = await resCampanas.json();

            const resSesiones = await fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/activas`);
            const dataSesiones = await resSesiones.json();

            const idsActivos = dataSesiones.map(s => s.campana.id);

            setCampanas(dataCampanas);
            setServerSesiones(idsActivos);
            setTempSelected(idsActivos); // Inicializamos la selección temporal con lo que hay en el server
        } catch (error) {
            console.error("Error cargando campañas:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleLocalSelection = (campanaId) => {
        if (tempSelected.includes(campanaId)) {
            setTempSelected(prev => prev.filter(id => id !== campanaId));
        } else {
            setTempSelected(prev => [...prev, campanaId]);
        }
    };

    const handleConfirm = async () => {
        setIsSaving(true);
        
        // Calculamos qué hay que agregar y qué hay que quitar
        const toAdd = tempSelected.filter(id => !serverSesiones.includes(id));
        const toRemove = serverSesiones.filter(id => !tempSelected.includes(id));

        try {
            // Ejecutamos todos los check-ins necesarios
            const addPromises = toAdd.map(id => 
                fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/check-in`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campana_id: id })
                })
            );

            // Ejecutamos todos los check-outs necesarios
            const removePromises = toRemove.map(id => 
                fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/check-out`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campana_id: id })
                })
            );

            await Promise.all([...addPromises, ...removePromises]);

            // Notificar al padre que hubo cambios (silent refresh para evitar el spinner de pantalla completa)
            if (onUpdate) await onUpdate(true);
            
            handleClose();
        } catch (error) {
            console.error("Error sincronizando sesiones:", error);
            alert("Hubo un error al guardar los cambios. Por favor intenta de nuevo.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal show={show} onHide={isSaving ? undefined : handleClose} size="lg" centered backdrop="static">
            <Modal.Header closeButton={!isSaving}>
                <Modal.Title className="fw-bold">Gestión de Actividad</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                <div className="text-center mb-4">
                    <h5 className="mb-1">¿En qué campañas vas a trabajar?</h5>
                    <p className="text-muted small">
                        Seleccioná las campañas que vas a gestionar ahora. <br/>
                        Tu supervisor verá que estas campañas están cubiertas por vos.
                    </p>
                </div>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted">Cargando opciones...</p>
                    </div>
                ) : (
                    <Row xs={1} md={2} lg={3} className="g-3">
                        {campanas.map((campana) => {
                            const isSelected = tempSelected.includes(campana.id);
                            const isNew = isSelected && !serverSesiones.includes(campana.id);
                            const isRemoving = !isSelected && serverSesiones.includes(campana.id);

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
                                        onClick={() => !isSaving && toggleLocalSelection(campana.id)}
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
                )}
            </Modal.Body>
            <Modal.Footer className="bg-light border-top">
                <Button variant="link" className="text-muted text-decoration-none" onClick={handleClose} disabled={isSaving}>
                    Cancelar
                </Button>
                <Button 
                    variant="primary" 
                    onClick={handleConfirm} 
                    disabled={isSaving || loading}
                    className="px-4 fw-bold shadow-sm"
                    style={{ minWidth: '160px' }}
                >
                    {isSaving ? (
                        <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                            Guardando...
                        </>
                    ) : 'Confirmar Actividad'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default CampaignSelector;