// RUTA: src/pages/DetalleCampanaPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { GTR_API_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Card, ListGroup, Button, Spinner, Alert, Row, Col, Badge } from 'react-bootstrap';

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
            return;
        }
        setLoading(true);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${id}`);
            if (!response.ok) throw new Error(`Error al cargar la campana: ${response.statusText}`);
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
        const endpoint = `${GTR_API_URL}/analistas/${user.id}/campanas/${campana.id}`;
        const method = action === 'assign' ? 'POST' : 'DELETE';
        try {
            await fetchWithAuth(endpoint, { method: method });
            await fetchCampanaDetails();
            await refreshUser();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Función auxiliar para mostrar horas o "Cerrado"
    const renderTimeBlock = (start, end) => {
        if (!start || !end) return <span className="text-muted fst-italic">Cerrado</span>;
        return (
            <span className="fw-bold text-dark">
                {start.substring(0, 5)} - {end.substring(0, 5)}
            </span>
        );
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
    if (!campana) return <Container className="mt-4"><Alert variant="info">Campaña no encontrada.</Alert></Container>;
    
    const canManageCampana = user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE');
    const isAnalyst = user && user.role === 'ANALISTA';
    const isAssignedToThisCampana = isAnalyst && campana.analistas_asignados?.some(analyst => analyst.id === user.id);

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="bg-primary text-white text-center">
                    {campana.nombre}
                </Card.Header>
                <Card.Body>
                    <Row className="mb-4 g-4">
                        {/* COLUMNA IZQUIERDA: Info General */}
                        <Col lg={5}>
                            <h5 className="text-primary border-bottom pb-2 mb-3">Información General</h5>
                            <div className="mb-3">
                                <small className="text-muted d-block text-uppercase fw-bold" style={{fontSize: '0.75rem'}}>Descripción</small>
                                <p className="mb-0">{campana.descripcion || 'Sin descripción'}</p>
                            </div>
                            <div className="mb-3">
                                <small className="text-muted d-block text-uppercase fw-bold" style={{fontSize: '0.75rem'}}>Personal Asignado</small>
                                <Badge bg="info" className="fs-6 fw-normal text-dark">
                                    👤 {campana.analistas_asignados?.length || 0} Analistas
                                </Badge>
                            </div>
                            <div>
                                <small className="text-muted d-block text-uppercase fw-bold" style={{fontSize: '0.75rem'}}>Vigencia</small>
                                <span>{campana.fecha_fin ? new Date(campana.fecha_fin).toLocaleDateString() : 'Indefinida'}</span>
                            </div>
                        </Col>
                        
                        {/* COLUMNA DERECHA: Horarios (3 Bloques) */}
                        <Col lg={7}>
                            <h5 className="text-secondary border-bottom pb-2 mb-3">Configuración Operativa</h5>
                            <Row className="g-2 text-center">
                                {/* Lunes a Viernes */}
                                <Col sm={4}>
                                    <div className="border rounded p-2 bg-primary bg-opacity-10 h-100">
                                        <div className="text-primary fw-bold small mb-1">🏢 Lunes a Viernes</div>
                                        {renderTimeBlock(campana.hora_inicio_semana, campana.hora_fin_semana)}
                                    </div>
                                </Col>
                                {/* Sábado */}
                                <Col sm={4}>
                                    <div className="border rounded p-2 bg-info bg-opacity-10 h-100">
                                        <div className="text-info fw-bold small mb-1">🌤️ Sábados</div>
                                        {renderTimeBlock(campana.hora_inicio_sabado, campana.hora_fin_sabado)}
                                    </div>
                                </Col>
                                {/* Domingo */}
                                <Col sm={4}>
                                    <div className="border rounded p-2 bg-success bg-opacity-10 h-100">
                                        <div className="text-success fw-bold small mb-1">🏡 Domingos</div>
                                        {renderTimeBlock(campana.hora_inicio_domingo, campana.hora_fin_domingo)}
                                    </div>
                                </Col>
                            </Row>
                        </Col>
                    </Row>

                    {/* BOTONES DE ASIGNACIÓN */}
                    <div className="d-flex justify-content-end mb-3">
                         {isAnalyst && (
                                isAssignedToThisCampana ? (
                                    <Button variant="outline-danger" onClick={() => handleAssignUnassign('unassign')} disabled={isProcessing}>
                                        {isProcessing ? <Spinner size="sm" /> : 'Abandonar Campaña'}
                                    </Button>
                                ) : (
                                    <Button variant="success" onClick={() => handleAssignUnassign('assign')} disabled={isProcessing}>
                                        {isProcessing ? <Spinner size="sm" /> : 'Unirme a Campaña'}
                                    </Button>
                                )
                            )}
                    </div>
                    
                    {/* LOBS */}
                    <Card border="light" className="mt-2 bg-light">
                        <Card.Header as="h6" className="bg-transparent border-0 pt-3">Líneas de Negocio (LOBs)</Card.Header>
                        <Card.Body className="pt-0">
                            {campana.lobs && campana.lobs.length > 0 ? (
                                <div className="d-flex flex-wrap gap-2">
                                    {campana.lobs.map(lob => (
                                        <Badge key={lob.id} bg="secondary" className="p-2 fw-normal text-white">
                                            {lob.nombre}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted small fst-italic">Sin LOBs definidos.</p>
                            )}
                        </Card.Body>
                    </Card>

                </Card.Body>
                <Card.Footer className="text-end">
                    <Button variant="secondary" onClick={() => navigate('/campanas')} className="me-2">
                        Volver
                    </Button>
                    {canManageCampana && (
                        <Link to={`/campanas/editar/${campana.id}`} className="btn btn-warning">
                            ✏️ Editar
                        </Link>
                    )}
                </Card.Footer>
            </Card>
        </Container>
    );
}

export default DetalleCampanaPage;