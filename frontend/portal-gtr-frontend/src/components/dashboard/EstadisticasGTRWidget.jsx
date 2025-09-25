// RUTA: src/components/dashboard/EstadisticasGTRWidget.jsx

import React from 'react';
import { Row, Col, Card } from 'react-bootstrap';
// Ya no necesitamos 'Link' porque las tarjetas no serán clickeables
// import { Link } from 'react-router-dom';

const StatCard = ({ title, value, variant = 'primary' }) => {
    // Hemos eliminado la prop 'linkTo' y el componente Link
    return (
        <Card className={`text-center shadow-sm bg-${variant} text-white h-100`}>
            <Card.Body className="d-flex flex-column justify-content-center">
                <Card.Title as="h2" className="mb-0">{value}</Card.Title>
                <Card.Text>{title}</Card.Text>
            </Card.Body>
        </Card>
    );
};

function EstadisticasGTRWidget({ stats, user }) {
    if (!stats) return null;

    // Vista para Supervisor y Responsable
    if (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') {
        return (
            <Row className="g-3">
                <Col>
                   {/* Tarjeta sin enlace */}
                   <StatCard title="Total Incidencias Activas" value={stats.total_incidencias_activas} variant="danger" />
                </Col>
            </Row>
        );
    }

    // Vista para Analista
    if (user.role === 'ANALISTA') {
        return (
             <Row className="g-3">
                <Col>
                   {/* Tarjeta sin enlace */}
                   <StatCard title="Incidencias sin Asignar" value={stats.incidencias_sin_asignar} variant="info" />
                </Col>
                {/* Hemos eliminado la tarjeta de "Tareas Disponibles" */}
            </Row>
        );
    }

    return null;
}

export default EstadisticasGTRWidget;