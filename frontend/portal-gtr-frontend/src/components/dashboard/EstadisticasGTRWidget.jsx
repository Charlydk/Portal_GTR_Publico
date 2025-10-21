// RUTA: src/components/dashboard/EstadisticasGTRWidget.jsx

import React from 'react';
import { Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const StatCard = ({ title, value, variant = 'primary', linkTo = null }) => {
    const cardContent = (
        <Card className={`text-center shadow-sm bg-${variant} text-white h-100`}>
            <Card.Body className="d-flex flex-column justify-content-center">
                <Card.Title as="h2" className="mb-0">{value}</Card.Title>
                <Card.Text>{title}</Card.Text>
            </Card.Body>
        </Card>
    );

    if (linkTo) {
        return <Link to={linkTo} className="text-decoration-none h-100">{cardContent}</Link>;
    }
    return cardContent;
};

function EstadisticasGTRWidget({ stats, user }) {
    if (!stats) return null;

    // --- VISTA PARA SUPERVISOR Y RESPONSABLE (SIN CAMBIOS) ---
    if (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') {
        return (
            <Row className="g-3">
                <Col>
                   <StatCard 
                       title="Total Activas" 
                       value={stats.total_incidencias_activas} 
                       variant="danger" 
                       linkTo="/control-incidencias?estado=ABIERTA&estado=EN_PROGRESO"
                   />
                </Col>
                <Col>
                   <StatCard 
                       title="Sin Asignar" 
                       value={stats.incidencias_sin_asignar} 
                       variant="warning"
                       linkTo="/control-incidencias?asignado_a_id=0&estado=ABIERTA"
                   />
                </Col>
                <Col>
                   <StatCard 
                       title="Cerradas Hoy" 
                       value={stats.incidencias_cerradas_hoy} 
                       variant="success"
                       linkTo="/control-incidencias?estado=CERRADA" // Link a todas las cerradas
                   />
                </Col>
            </Row>
        );
    }

    // --- VISTA MEJORADA PARA ANALISTA ---
    if (user.role === 'ANALISTA') {
        return (
             <Row className="g-3">
                <Col>
                   <StatCard 
                       title="Total Activas" 
                       value={stats.total_incidencias_activas} 
                       variant="danger" 
                       linkTo="/control-incidencias?estado=ABIERTA&estado=EN_PROGRESO"
                   />
                </Col>
                <Col>
                   <StatCard 
                       title="Cerradas Hoy" 
                       value={stats.incidencias_cerradas_hoy} 
                       variant="success" // Verde para "completado"
                       // Este enlace filtrará por las incidencias cerradas por el usuario, hoy.
                       linkTo={`/control-incidencias?estado=CERRADA&cerrado_por_id=${user.id}`}
                   />
                </Col>
                <Col>
                   <StatCard 
                       title="Sin Asignar" 
                       value={stats.incidencias_sin_asignar} 
                       variant="warning" // Amarillo para "atención"
                       linkTo="/control-incidencias?asignado_a_id=0&estado=ABIERTA"
                   />
                </Col>
            </Row>
        );
    }

    return null;
}

export default EstadisticasGTRWidget;