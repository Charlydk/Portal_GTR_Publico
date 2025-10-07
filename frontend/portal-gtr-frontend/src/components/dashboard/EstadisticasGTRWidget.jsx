// RUTA: src/components/dashboard/EstadisticasGTRWidget.jsx

import React from 'react';
import { Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom'; // <-- 1. IMPORTAMOS Link

const StatCard = ({ title, value, variant = 'primary', linkTo = null }) => {
    const cardContent = (
        <Card className={`text-center shadow-sm bg-${variant} text-white h-100`}>
            <Card.Body className="d-flex flex-column justify-content-center">
                <Card.Title as="h2" className="mb-0">{value}</Card.Title>
                <Card.Text>{title}</Card.Text>
            </Card.Body>
        </Card>
    );
    // Si la tarjeta tiene un 'linkTo', la envolvemos en un Link
    if (linkTo) {
        return <Link to={linkTo} className="text-decoration-none h-100">{cardContent}</Link>;
    }
    return cardContent;
};

function EstadisticasGTRWidget({ stats, user, tareasDisponibles = 0 }) {
    if (!stats) return null;

    return (
        <Row className="g-3">
            {/* --- 2. AÑADIMOS LA PROP 'linkTo' --- */}
            <Col>
                <StatCard 
                    title="Total Incidencias Activas" 
                    value={stats.total_incidencias_activas} 
                    variant="danger" 
                    linkTo="/control-incidencias?estado=ABIERTA&estado=EN_PROGRESO"
                />
            </Col>
            
            {user.role === 'ANALISTA' && (
                <>
                    <Col>
                       <StatCard 
                           title="Incidencias sin Asignar" 
                           value={stats.incidencias_sin_asignar} 
                           variant="info"
                            linkTo="/control-incidencias?asignado_a_id=0&estado=ABIERTA"                       />
                    </Col>
                    <Col>
                       <StatCard 
                           title="Tareas Disponibles" 
                           value={tareasDisponibles} 
                           variant="success"
                           linkTo="/tareas/disponibles"
                       />
                    </Col>
                </>
            )}
        </Row>
    );
}

export default EstadisticasGTRWidget;