import React from 'react';
import { Card, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

function IncidenciasActivasWidget({ incidencias, loading }) {
    // La lógica de estados y colores no cambia
    const getStatusInfo = (incidencia) => {
        if (incidencia.estado === 'EN_PROGRESO' && incidencia.asignado_a) {
            return { text: 'En Seguimiento', variant: 'warning' };
        }
        if (incidencia.estado === 'ABIERTA' && !incidencia.asignado_a) {
            return { text: 'Abierta (Libre)', variant: 'danger' };
        }
        return { text: incidencia.estado, variant: 'secondary' };
    };

    return (
        <Card className="shadow-sm h-100">
            <Card.Header as="h5">Últimas Incidencias Activas</Card.Header>
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
                                    
                                    <small className="text-muted">
                                        Campaña: {inc.campana.nombre}
                                        {/* Si está en seguimiento, añadimos el nombre del analista */}
                                        {status.text === 'En Seguimiento' && (
                                            <>
                                                <span className="mx-2">|</span>
                                                Asignado a: {inc.asignado_a.nombre} {inc.asignado_a.apellido}
                                            </>
                                        )}
                                    </small>
                                    
                                </div>
                                <Badge bg={status.variant}>{status.text}</Badge>
                            </ListGroup.Item>
                        );
                    }) : <ListGroup.Item>¡Sin incidencias activas!</ListGroup.Item>}
                </ListGroup>
            )}
        </Card>
    );
}

export default IncidenciasActivasWidget;