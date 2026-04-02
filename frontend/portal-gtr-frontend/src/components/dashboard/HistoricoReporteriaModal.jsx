import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import HistoricoReporteriaWidget from './HistoricoReporteriaWidget';

const HistoricoReporteriaModal = ({ show, onHide }) => {
    return (
        <Modal show={show} onHide={onHide} size="xl" centered scrollable backdrop="static">
            <Modal.Header closeButton className="bg-light">
                <Modal.Title className="h6 fw-bold text-muted">📜 Historial de Auditoría - REPORTERÍA</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-0">
                <HistoricoReporteriaWidget />
            </Modal.Body>
            <Modal.Footer className="bg-light py-1">
                <Button variant="secondary" size="sm" onClick={onHide}>Cerrar</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default HistoricoReporteriaModal;
