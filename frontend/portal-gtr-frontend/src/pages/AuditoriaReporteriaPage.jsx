import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import HistoricoReporteriaWidget from '../components/dashboard/HistoricoReporteriaWidget';

const AuditoriaReporteriaPage = () => {
    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="fw-bold mb-0">📜 Auditoría de Reportería</h3>
                    <span className="text-muted small">
                        Consulta el historial de todas las tareas (completadas, pendientes y vencidas).
                    </span>
                </div>
            </div>

            <Row>
                <Col xs={12}>
                    <HistoricoReporteriaWidget />
                </Col>
            </Row>
        </Container>
    );
};

export default AuditoriaReporteriaPage;
