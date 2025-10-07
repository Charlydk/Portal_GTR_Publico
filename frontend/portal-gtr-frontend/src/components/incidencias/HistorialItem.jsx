// RUTA: src/components/incidencias/HistorialItem.jsx

import React from 'react';
import { ListGroup, Badge, Row, Col } from 'react-bootstrap';
import { formatDateTime } from '../../utils/dateFormatter';

const getStatusVariant = (estado) => {
    const map = { 'ABIERTA': 'danger', 'EN_PROGRESO': 'warning', 'CERRADA': 'success' };
    return map[estado] || 'secondary';
};

function HistorialItem({ actualizacion }) {
    let icon = '💬';
    let content = <p className="mb-1" style={{whiteSpace: "pre-wrap"}}>{actualizacion.comentario}</p>;
    let title = "Comentario";

    const comentario = actualizacion.comentario;

    if (comentario.startsWith('El estado de la incidencia cambió')) {
        icon = '🔄';
        title = "Cambio de Estado";
        const matches = comentario.match(/'(.*?)' a '(.*?)'/);
        if (matches) {
            const [, oldState, newState] = matches;
            content = (
                <div className="d-flex align-items-center">
                    <Badge bg={getStatusVariant(oldState)}>{oldState.replace('_', ' ')}</Badge>
                    <span className="mx-2">→</span>
                    <Badge bg={getStatusVariant(newState)}>{newState.replace('_', ' ')}</Badge>
                </div>
            );
        }
    } 
    else if (comentario.startsWith('Incidencia asignada a') || comentario.startsWith('Incidencia reasignada')) {
        icon = '🧑‍💻'; // Icono de usuario para asignaciones
        title = "Cambio de Responsable";
        content = <p className="mb-1 fst-italic">{comentario}</p>;
    }
    else if (comentario.startsWith('Comentario de Cierre:')) {
        icon = '🏁'; // Icono de bandera para el cierre
        title = "Comentario de Cierre";
        // Mostramos solo el texto del comentario, sin el prefijo
        content = <p className="mb-1">{comentario.substring('Comentario de Cierre: '.length)}</p>;
    }
    else if (comentario.startsWith('Incidencia actualizada por')) {
        icon = '✏️';
        title = "Campos Modificados";
        const parts = comentario.split(':\n- ');
        const changes = parts.length > 1 ? parts[1].split('\n- ') : [];
        content = (
            <ul className="mb-1 ps-3">
                {changes.map((change, index) => <li key={index}><small>{change}</small></li>)}
            </ul>
        );
    }

    return (
        <ListGroup.Item className="px-0">
            <Row className="g-0">
                <Col xs={1} className="text-center d-flex align-items-start justify-content-center pt-1">
                    <span style={{ fontSize: '1.2rem' }} title={title}>{icon}</span>
                </Col>
                <Col xs={11}>
                    {content}
                    <small className="text-muted">
                        Por: {actualizacion.autor?.nombre || 'Desconocido'} - {formatDateTime(actualizacion.fecha_actualizacion)}
                    </small>
                </Col>
            </Row>
        </ListGroup.Item>
    );
}

export default HistorialItem;