import React from 'react';
import { Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

// Pequeño componente interno para las tarjetas de estadísticas
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


function EstadisticasGTRWidget({ stats, user, tareasDisponibles = 0 }) {
    if (!stats) {
        return null; // No mostrar nada si no hay estadísticas
    }

    // Vista para Supervisores y Responsables
    if (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') {
        return (
            <Card className="shadow-sm h-100">
                <Card.Header as="h5">Estadísticas Generales</Card.Header>
                <Card.Body className="d-flex align-items-center">
                    <Row className="g-3 w-100">
                        <Col>
                           <StatCard title="Total Incidencias Activas" value={stats.total_incidencias_activas} variant="danger" />
                        </Col>
                        {/* Aquí podrías añadir más estadísticas para supervisores en el futuro */}
                    </Row>
                </Card.Body>
            </Card>
        );
    }

    // Vista para Analistas
    if (user.role === 'ANALISTA') {
        return (
             <Card className="shadow-sm h-100">
                <Card.Header as="h5">Mis Estadísticas</Card.Header>
                <Card.Body className="d-flex align-items-center">
                    <Row className="g-3 w-100">
                        <Col>
                           <StatCard title="Incidencias sin Asignar" value={stats.incidencias_sin_asignar} variant="info" />
                        </Col>
                         <Col>
                           <StatCard title="Tareas Disponibles" value={tareasDisponibles} variant="primary" linkTo="/tareas/disponibles" />
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
        );
    }

    return null; // No mostrar para otros roles
}

export default EstadisticasGTRWidget;