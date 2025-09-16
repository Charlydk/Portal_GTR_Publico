// RUTA: src/pages/ControlIncidenciasPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Spinner, Alert, Form, Button, Row, Col, Table, Badge } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL } from '../api';
import { formatDateTime } from '../utils/dateFormatter';

function ControlIncidenciasPage() {
    const { authToken } = useAuth();

    // Estados para la página
    const [incidencias, setIncidencias] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Estados para los filtros
    const [filtros, setFiltros] = useState({
        fecha_inicio: '',
        fecha_fin: '',
        campana_id: '',
        estado: '',
        asignado_a_id: ''
    });

    // Aquí irá la lógica para cargar los datos y los filtros...

    return (
        <Container fluid className="py-4">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center bg-secondary text-white">
                    Portal de Control de Incidencias
                </Card.Header>
                <Card.Body>
                    <p>Aquí construiremos los filtros y la tabla de resultados.</p>
                    {/* Próximamente: Formulario de Filtros */}
                    <hr />
                    {/* Próximamente: Tabla de Incidencias */}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default ControlIncidenciasPage;