import React from 'react';
import { Card, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function MisIncidenciasWidget({ incidencias, loading }) {
    // La misma lógica de estados que en el otro widget
    const getStatusInfo = (incidencia) => {
        if (incidencia.estado === 'EN_PROGRESO' && incidencia.asignado_a) {
            return { text: 'En Seguimiento', variant: 'warning' };
        }
        return { text: 'Abierta', variant: 'danger' }; // Mis incidencias siempre están al menos en progreso
    };

    return (
        <Card className="shadow-sm h-100">
            <Card.Header as="h5">Mis Incidencias Asignadas</Card.Header>
            {loading ? (
                <Card.Body className="text-center"><Spinner animation="border" /></Card.Body>
            ) : (
                <ListGroup variant="flush">
                    {incidencias.length > 0 ? incidencias.map(inc => {
                        const status = getStatusInfo(inc);
                        return (
                            <ListGroup.Item key={inc.id} action as={Link} to={`/incidencias/${inc.id}`} className="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>{inc.titulo}</strong>
                                    <br />
                                    <small className="text-muted">Campaña: {inc.campana.nombre}</small>
                                </div>
                                <Badge bg={status.variant}>{status.text}</Badge>
                            </ListGroup.Item>
                        );
                    }) : <ListGroup.Item>No tenés incidencias asignadas.</ListGroup.Item>}
                </ListGroup>
            )}
        </Card>
    );
}

export default MisIncidenciasWidget;