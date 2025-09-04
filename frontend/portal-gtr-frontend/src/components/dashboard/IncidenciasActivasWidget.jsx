import React from 'react';
import { Card, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function IncidenciasActivasWidget({ incidencias, loading }) {
    const getStatusVariant = (estado) => ({'ABIERTA': 'danger', 'EN_PROGRESO': 'warning'}[estado] || 'secondary');

    return (
        <Card className="shadow-sm h-100">
            <Card.Header as="h5">Últimas Incidencias Activas</Card.Header>
            {loading ? (
                <Card.Body className="text-center"><Spinner animation="border" /></Card.Body>
            ) : (
                <ListGroup variant="flush">
                    {incidencias.length > 0 ? incidencias.map(inc => (
                        <ListGroup.Item key={inc.id} action as={Link} to={`/incidencias/${inc.id}`} className="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>{inc.titulo}</strong>
                                <br />
                                <small className="text-muted">Campaña: {inc.campana.nombre}</small>
                            </div>
                            <Badge bg={getStatusVariant(inc.estado)}>{inc.estado}</Badge>
                        </ListGroup.Item>
                    )) : <ListGroup.Item>¡Sin incidencias activas!</ListGroup.Item>}
                </ListGroup>
            )}
        </Card>
    );
}

export default IncidenciasActivasWidget;