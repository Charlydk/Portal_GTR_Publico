import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Spinner, Alert, Badge } from 'react-bootstrap';
import { GTR_API_URL, fetchWithAuth } from '../../api';
import { useAuth } from '../../hooks/useAuth';

function EventosCampanaWidget({ campanaId }) {
    const { authToken } = useAuth();
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEventos = useCallback(async () => {
        if (!authToken || !campanaId) return;
        setLoading(true);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/bitacora/filtrar/?campana_id=${campanaId}`);
            if (!response.ok) throw new Error("Error al traer los eventos de la campaña");
            const data = await response.json();
            // Ordenamos por ID descendente (más nuevos primero)
            const sorted = data.sort((a,b) => b.id - a.id);
            setEventos(sorted);
        } catch(err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, campanaId]);

    useEffect(() => { fetchEventos() }, [fetchEventos]);

    return (
        <Card className="shadow-sm h-100">
            <Card.Header as="h5" className="bg-light">📋 Eventos Registrados en esta Campaña</Card.Header>
            <Card.Body className="p-0">
                {loading ? <div className="text-center py-4"><Spinner animation="border" /></div> : error ? <Alert variant="danger" className="m-3">{error}</Alert> : (
                    <div className="table-responsive" style={{maxHeight:'500px', overflowY: 'auto'}}>
                        <Table striped hover size="sm" className="mb-0">
                            <thead style={{position:'sticky', top:0, zIndex: 1, backgroundColor: '#f8f9fa'}} className="shadow-sm">
                                <tr>
                                    <th className="px-3">Fecha/Hora</th>
                                    <th>LOB</th>
                                    <th>Autor</th>
                                    <th>Evento</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eventos.map(evt => (
                                    <tr key={evt.id}>
                                        <td className="px-3" style={{whiteSpace: 'nowrap'}}>{evt.fecha} <Badge bg="secondary">{evt.hora?.substring(0,5)}</Badge></td>
                                        <td>{evt.lob?.nombre || 'General'}</td>
                                        <td>{evt.autor?.nombre} {evt.autor?.apellido}</td>
                                        <td>{evt.comentario}</td>
                                    </tr>
                                ))}
                                {eventos.length === 0 && <tr><td colSpan="4" className="text-muted text-center py-4">No hay eventos vinculados a esta campaña.</td></tr>}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Card.Body>
        </Card>
    );
}

export default EventosCampanaWidget;
