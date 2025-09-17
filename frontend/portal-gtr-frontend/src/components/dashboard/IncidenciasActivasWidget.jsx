// RUTA: src/components/dashboard/IncidenciasActivasWidget.jsx
import React from 'react';
import { Card, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const GravedadIcon = ({ gravedad }) => {
    const iconMap = {
        ALTA: { variant: 'danger', symbol: '▲', title: 'Alta' },
        MEDIA: { variant: 'warning', symbol: '●', title: 'Media' },
        BAJA: { variant: 'info', symbol: '▼', title: 'Baja' },
    };
    const { variant, symbol, title } = iconMap[gravedad] || {};
    if (!symbol) return null;
    return <Badge pill bg={variant} className="me-2" title={`Gravedad: ${title}`}>{symbol}</Badge>;
};

function IncidenciasActivasWidget({ incidencias, loading }) {
    // ... (la función getStatusInfo se queda igual)

    return (
        <Card className="shadow-sm h-100">
            <Card.Header as="h5">Últimas Incidencias Activas</Card.Header>
            {loading ? (
                <Card.Body className="text-center"><Spinner animation="border" /></Card.Body>
            ) : (
                <ListGroup variant="flush">
                    {incidencias.length > 0 ? incidencias.map(inc => (
                        <ListGroup.Item key={inc.id} action as={Link} to={`/incidencias/${inc.id}`}>
                            <div className="d-flex w-100 justify-content-between">
                                <span className="fw-bold"><GravedadIcon gravedad={inc.gravedad} /> {inc.titulo}</span>
                                <Badge bg={inc.estado === 'ABIERTA' ? 'danger' : 'warning'}>{inc.estado.replace('_', ' ')}</Badge>
                            </div>
                            <div className="text-muted small mt-1">
                                Campaña: {inc.campana.nombre} | Asignado a: {inc.asignado_a ? inc.asignado_a.nombre : 'Nadie'}
                            </div>
                            {inc.ultimo_comentario && (
                                <div className="text-muted fst-italic small mt-1" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Último Comentario: {inc.ultimo_comentario}
                                </div>
                            )}
                        </ListGroup.Item>
                    )) : <ListGroup.Item>¡Sin incidencias activas!</ListGroup.Item>}
                </ListGroup>
            )}
        </Card>
    );
}

export default IncidenciasActivasWidget;