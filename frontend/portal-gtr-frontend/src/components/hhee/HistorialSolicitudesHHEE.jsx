// src/components/hhee/HistorialSolicitudesHHEE.jsx
import React from 'react';
import { Table, Badge } from 'react-bootstrap';
import { formatDateTime } from '../../utils/dateFormatter'; // Reutilizamos nuestro formateador de fechas

function HistorialSolicitudesHHEE({ solicitudes }) {
    
    const getStatusBadge = (estado) => {
        const variants = {
            PENDIENTE: 'warning',
            APROBADA: 'success',
            RECHAZADA: 'danger',
        };
        return <Badge bg={variants[estado] || 'secondary'}>{estado}</Badge>;
    };

    const formatTipo = (tipo) => {
        return tipo.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <Table striped bordered hover responsive>
            <thead>
                <tr>
                    <th>Fecha HHEE</th>
                    <th>Tipo</th>
                    <th>Horas Solicitadas</th>
                    <th>Estado</th>
                    <th>Horas Aprobadas</th>
                    <th>Comentario del Supervisor</th>
                    <th>Fecha Solicitud</th>
                </tr>
            </thead>
            <tbody>
                {solicitudes.length > 0 ? (
                    solicitudes.map(solicitud => (
                        <tr key={solicitud.id}>
                            <td>{new Date(solicitud.fecha_hhee + 'T00:00:00-03:00').toLocaleDateString('es-AR')}</td>
                            <td>{formatTipo(solicitud.tipo)}</td>
                            <td>{solicitud.horas_solicitadas.toFixed(2)}</td>
                            <td>{getStatusBadge(solicitud.estado)}</td>
                            <td>{solicitud.horas_aprobadas !== null ? solicitud.horas_aprobadas.toFixed(2) : '---'}</td>
                            <td>{solicitud.comentario_supervisor || '---'}</td>
                            <td>{formatDateTime(solicitud.fecha_solicitud)}</td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="7" className="text-center text-muted">Aún no has realizado ninguna solicitud.</td>
                    </tr>
                )}
            </tbody>
        </Table>
    );
}

export default HistorialSolicitudesHHEE;