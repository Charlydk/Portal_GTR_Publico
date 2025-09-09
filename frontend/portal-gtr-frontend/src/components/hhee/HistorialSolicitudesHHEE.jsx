// src/components/hhee/HistorialSolicitudesHHEE.jsx
import React from 'react';
import { Table, Badge } from 'react-bootstrap';
import { decimalToHHMM } from '../../utils/timeUtils'; // Importamos la utilidad

function HistorialSolicitudesHHEE({ solicitudes }) {
    
    const getStatusBadge = (estado) => {
        const variants = { PENDIENTE: 'warning', APROBADA: 'success', RECHAZADA: 'danger' };
        return <Badge bg={variants[estado] || 'secondary'}>{estado}</Badge>;
    };

    const formatTipo = (tipo) => {
        return tipo.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };
    
    const formatDateOnly = (dateString) => {
        if (!dateString) return 'N/A';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    return (
        <Table striped bordered hover responsive>
            <thead>
                <tr>
                    <th>Fecha HHEE</th>
                    <th>Tipo</th>
                    <th>H. Solicitadas</th>
                    <th>H. Aprobadas (Sup.)</th>
                    <th>H. Cargadas (RRHH)</th> {/* <-- NUEVA COLUMNA */}
                    <th>Estado</th>
                    <th>Comentario del Supervisor</th>
                </tr>
            </thead>
            <tbody>
                {solicitudes.length > 0 ? (
                    solicitudes.map(solicitud => {
                        const gv = solicitud.datos_geovictoria || {};
                        const horasRRHH = (gv.hhee_autorizadas_antes_gv || 0) + (gv.hhee_autorizadas_despues_gv || 0);

                        return (
                            <tr key={solicitud.id}>
                                <td>{formatDateOnly(solicitud.fecha_hhee)}</td>
                                <td>{formatTipo(solicitud.tipo)}</td>
                                {/* --- COLUMNAS CON FORMATO HH:MM --- */}
                                <td>{decimalToHHMM(solicitud.horas_solicitadas)}</td>
                                <td>{solicitud.horas_aprobadas !== null ? decimalToHHMM(solicitud.horas_aprobadas) : '---'}</td>
                                <td>{decimalToHHMM(horasRRHH)}</td>
                                {/* --------------------------------- */}
                                <td>{getStatusBadge(solicitud.estado)}</td>
                                <td>{solicitud.comentario_supervisor || '---'}</td>
                            </tr>
                        );
                    })
                ) : (
                    <tr>
                        <td colSpan="7" className="text-center text-muted">No se encontraron solicitudes para el período seleccionado.</td>
                    </tr>
                )}
            </tbody>
        </Table>
    );
}

export default HistorialSolicitudesHHEE;