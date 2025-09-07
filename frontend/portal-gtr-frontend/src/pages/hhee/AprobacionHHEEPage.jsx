// src/pages/hhee/AprobacionHHEEPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Spinner, Alert, Table, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';
import { formatDateTime } from '../../utils/dateFormatter';

function AprobacionHHEEPage() {
    const { authToken } = useAuth();
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPendientes = useCallback(async () => {
        if (!authToken) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/hhee/solicitudes/pendientes/`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'No se pudieron cargar las solicitudes pendientes.');
            }
            const data = await response.json();
            setSolicitudes(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        fetchPendientes();
    }, [fetchPendientes]);

    const formatTipo = (tipo) => {
        return tipo.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    if (loading) {
        return <Container className="text-center py-5"><Spinner /></Container>;
    }

    if (error) {
        return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
    }

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center bg-warning">
                    Solicitudes de HHEE Pendientes de Aprobación
                </Card.Header>
                <Card.Body>
                    {solicitudes.length > 0 ? (
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>Solicitante</th>
                                    <th>Fecha HHEE</th>
                                    <th>Tipo</th>
                                    <th>Horas Solicitadas</th>
                                    <th>Fecha de Solicitud</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {solicitudes.map(solicitud => (
                                    <tr key={solicitud.id}>
                                        <td>{solicitud.solicitante.nombre} {solicitud.solicitante.apellido}</td>
                                        <td>{new Date(solicitud.fecha_hhee + 'T00:00:00-03:00').toLocaleDateString('es-AR')}</td>
                                        <td>{formatTipo(solicitud.tipo)}</td>
                                        <td>{solicitud.horas_solicitadas.toFixed(2)}</td>
                                        <td>{formatDateTime(solicitud.fecha_solicitud)}</td>
                                        <td>
                                            {/* Este botón nos llevará a la página de detalle que construiremos en el siguiente paso */}
                                            <Link to={`/aprobar-hhee/${solicitud.id}`} className="btn btn-primary btn-sm">
                                                Revisar
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                        <Alert variant="success" className="text-center">
                            ¡Excelente! No hay solicitudes pendientes de revisión.
                        </Alert>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default AprobacionHHEEPage;