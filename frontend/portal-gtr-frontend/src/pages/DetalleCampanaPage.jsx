// src/pages/DetalleCampanaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Card, ListGroup, Button, Spinner, Alert, Row, Col, Tab, Nav, Badge } from 'react-bootstrap';
import BitacoraCampana from '../components/BitacoraCampana';
import ListaIncidencias from '../components/ListaIncidencias';

function DetalleCampanaPage() {
    const { id } = useParams();
    const navigate = useNavigate(); // Esta variable ahora se usa correctamente
    const { authToken, user, refreshUser } = useAuth();

    const [campana, setCampana] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [key, setKey] = useState('detalles');

    const fetchCampanaDetails = useCallback(async () => {
        if (!authToken) {
            setLoading(false);
            setError("Necesita iniciar sesión para ver los detalles de la campana.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/campanas/${id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) {
                throw new Error(`Error al cargar la campana: ${response.statusText}`);
            }
            const data = await response.json();
            setCampana(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id, authToken]);

    useEffect(() => {
        fetchCampanaDetails();
    }, [fetchCampanaDetails]);
    
    const handleAssignUnassign = async (action) => {
        if (!user || !authToken || isProcessing) return;
        setIsProcessing(true);
        setError(null);
        const endpoint = `${API_BASE_URL}/analistas/${user.id}/campanas/${campana.id}`;
        const method = action === 'assign' ? 'POST' : 'DELETE';
        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error en la operación');
            }
            await fetchCampanaDetails();
            await refreshUser();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
    }

    if (!campana) {
        return <Container className="mt-4"><Alert variant="info">Campaña no encontrada.</Alert></Container>;
    }

    const incidenciasActivasCount = campana?.incidencias?.filter(
        inc => inc.estado === 'ABIERTA' || inc.estado === 'EN_PROGRESO'
    ).length || 0;
    const canManageCampana = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');
    const isAnalyst = user && user.role === 'ANALISTA';
    const isAssignedToThisCampana = isAnalyst && campana.analistas_asignados?.some(analyst => analyst.id === user.id);

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="bg-primary text-white text-center">
                    Detalles de la Campaña: {campana.nombre}
                </Card.Header>
                <Card.Body>
                    <Tab.Container id="campana-tabs" activeKey={key} onSelect={(k) => setKey(k)}>
                        <Nav variant="tabs" className="mb-3">
                            <Nav.Item>
                                <Nav.Link eventKey="detalles">Detalles</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="bitacora">Bitácora</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="incidencias">
                                Incidencias <Badge pill bg="danger">{incidenciasActivasCount}</Badge>
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                        <Tab.Content>
                            <Tab.Pane eventKey="detalles">
                                <Row>
                                    <Col md={8}>
                                        <p><strong>Descripción:</strong> {campana.descripcion || 'N/A'}</p>
                                        <p><strong>Analistas Asignados:</strong> {campana.analistas_asignados?.length || 0}</p>
                                    </Col>
                                    <Col md={4} className="text-md-end">
                                        {isAnalyst && (
                                            isAssignedToThisCampana ? (
                                                <Button variant="danger" onClick={() => handleAssignUnassign('unassign')} disabled={isProcessing}>
                                                    {isProcessing ? <Spinner size="sm" /> : 'Desasignarme'}
                                                </Button>
                                            ) : (
                                                <Button variant="success" onClick={() => handleAssignUnassign('assign')} disabled={isProcessing}>
                                                    {isProcessing ? <Spinner size="sm" /> : 'Asignarme'}
                                                </Button>
                                            )
                                        )}
                                    </Col>
                                </Row>
                            </Tab.Pane>
                            <Tab.Pane eventKey="bitacora">
                                <BitacoraCampana campanaId={campana.id} campanaNombre={campana.nombre} />
                            </Tab.Pane>
                            <Tab.Pane eventKey="incidencias">
                                <ListaIncidencias incidencias={campana.incidencias} campanaId={campana.id} />
                            </Tab.Pane>
                        </Tab.Content>
                    </Tab.Container>
                </Card.Body>
                <Card.Footer className="text-end">
                    <Button variant="secondary" onClick={() => navigate('/campanas')} className="me-2">
                        Volver a Campañas
                    </Button>
                    {canManageCampana && (
                        <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning">
                            Editar Campana
                        </Link>
                    )}
                </Card.Footer>
            </Card>
        </Container>
    );
}

export default DetalleCampanaPage;
