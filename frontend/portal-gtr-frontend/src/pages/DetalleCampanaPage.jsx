import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { GTR_API_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Card, ListGroup, Button, Spinner, Alert, Row, Col } from 'react-bootstrap';

function DetalleCampanaPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { authToken, user, refreshUser } = useAuth();

    const [campana, setCampana] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const fetchCampanaDetails = useCallback(async () => {
        if (!authToken) {
            setLoading(false);
            setError("Necesita iniciar sesión para ver los detalles de la campana.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${GTR_API_URL}/campanas/${id}`, {
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
        const endpoint = `${GTR_API_URL}/analistas/${user.id}/campanas/${campana.id}`;
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
                    
                    <hr />

                    {/* --- SECCIÓN PARA MOSTRAR LOBS --- */}
                    <Card border="light" className="mt-4">
                        <Card.Header as="h5">Líneas de Negocio (LOBs)</Card.Header>
                        <Card.Body>
                            {campana.lobs && campana.lobs.length > 0 ? (
                                <ListGroup variant="flush">
                                    {campana.lobs.map(lob => (
                                        <ListGroup.Item key={lob.id}>
                                            {lob.nombre}
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : (
                                <p className="text-muted">Esta campaña no tiene LOBs definidos.</p>
                            )}
                        </Card.Body>
                    </Card>

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