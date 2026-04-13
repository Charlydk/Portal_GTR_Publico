// src/components/dashboard/CampaignSelector.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Card, Spinner, Badge } from 'react-bootstrap';
import { fetchWithAuth, API_BASE_URL } from '../../api';

const CampaignSelector = ({ show, handleClose, onUpdate }) => {
    // Data Campañas
    const [campanas, setCampanas] = useState([]);
    const [serverSesionesCampanas, setServerSesionesCampanas] = useState([]); 
    const [tempSelectedCampanas, setTempSelectedCampanas] = useState([]);    
    
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
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
        } catch (error) {
            console.error("Error cargando campañas:", error);
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

    const validateAndConfirm = () => {
        executeSync();
    };

    const executeSync = async () => {
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

            await Promise.all(promises);

            if (onUpdate) await onUpdate(true);
            handleClose();
        } catch (error) {
            console.error("Error sincronizando campañas:", error);
            alert("Hubo un error al guardar los cambios.");
        } finally {
            setIsSaving(false);
        }
    };

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

    return (
        <Modal show={show} onHide={isSaving ? undefined : handleClose} size="lg" centered backdrop="static">
            <Modal.Header closeButton={!isSaving}>
                <Modal.Title className="fw-bold">Gestión de Actividad</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '65vh', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                <div className="text-center mb-3">
                    <h5 className="mb-1">Elige tu Campaña Actual</h5>
                    <p className="text-muted small mb-0">Selecciona las campañas en las que prestarás atención.</p>
                </div>

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted">Cargando opciones...</p>
                    </div>
                ) : (
                    renderCampanas()
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
    );
};

export default CampaignSelector;