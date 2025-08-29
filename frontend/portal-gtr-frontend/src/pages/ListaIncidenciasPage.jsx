// src/pages/ListaIncidenciasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Card, Spinner, Alert, Table, Badge } from 'react-bootstrap';

function ListaIncidenciasPage() {
    const { authToken } = useAuth();
    const [incidencias, setIncidencias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchIncidencias = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/incidencias/`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) throw new Error('No se pudieron cargar las incidencias.');
            const data = await response.json();
            setIncidencias(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        fetchIncidencias();
    }, [fetchIncidencias]);

    const getStatusVariant = (estado) => {
        const map = { 'ABIERTA': 'danger', 'EN PROGRESO': 'warning', 'CERRADA': 'success' };
        return map[estado] || 'secondary';
    };

    const formatDateTime = (apiDateString) => {
        // Si no hay fecha, devuelve N/A
        if (!apiDateString) {
            return 'N/A';
        }
    
        // --- LA CORRECCIÓN DEFINITIVA ---
        // Le añadimos la 'Z' al final para forzar a que JavaScript
        // interprete el string como una fecha en formato UTC universal.
        const date = new Date(apiDateString + 'Z');
        // --------------------------------
    
        // Verificamos si la fecha parseada es válida
        if (isNaN(date.getTime())) {
            return 'Fecha inválida';
        }
    
        // A partir de aquí, el resto del código funciona como se espera
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son de 0 a 11
        const year = date.getFullYear();
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
    
        return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2">Listado de Incidencias</Card.Header>
                <Card.Body>
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Título</th>
                                <th>Campaña</th>
                                <th>Estado</th>
                                <th>Fecha Apertura</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {incidencias.map(inc => (
                                <tr key={inc.id}>
                                    <td>{inc.id}</td>
                                    <td>{inc.titulo}</td>
                                    <td>{inc.campana.nombre}</td>
                                    <td><Badge bg={getStatusVariant(inc.estado)}>{inc.estado}</Badge></td>
                                    <td>{formatDateTime(inc.fecha_apertura)}</td>
                                    <td>
                                        <Link to={`/incidencias/${inc.id}`} className="btn btn-info btn-sm">
                                            Ver Detalles
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>
        </Container>
    );
}

export default ListaIncidenciasPage;
