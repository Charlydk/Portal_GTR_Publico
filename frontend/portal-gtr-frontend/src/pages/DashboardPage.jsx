import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL } from '../api';
import { Link } from 'react-router-dom';
import RegistroRapidoWidget from '../components/dashboard/RegistroRapidoWidget';
import IncidenciasActivasWidget from '../components/dashboard/IncidenciasActivasWidget';
import MisIncidenciasWidget from '../components/dashboard/MisIncidenciasWidget';

function DashboardPage() {
    const { user, authToken, loading: authLoading } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [incidenciasActivas, setIncidenciasActivas] = useState([]);
    const [misIncidencias, setMisIncidencias] = useState([]);

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const [activasRes, misIncidenciasRes] = await Promise.all([
                // VVV CORRECCIÓN AQUÍ: Usamos authToken en lugar de user.token VVV
                fetch(`${GTR_API_URL}/incidencias/activas/recientes`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                user.role === 'ANALISTA' 
                    ? fetch(`${GTR_API_URL}/analistas/me/incidencias_asignadas`, { headers: { 'Authorization': `Bearer ${authToken}` } }) 
                    : Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
                // ^^^ FIN DE LA CORRECCIÓN ^^^
            ]);

            if (!activasRes.ok) throw new Error('Error al cargar incidencias activas.');
            if (!misIncidenciasRes.ok) throw new Error('Error al cargar mis incidencias.');

            setIncidenciasActivas(await activasRes.json());
            setMisIncidencias(await misIncidenciasRes.json());

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, authToken]);

    useEffect(() => {
        if (!authLoading && user) {
            if (user.role !== 'SUPERVISOR_OPERACIONES') {
                fetchDashboardData();
            } else {
                setLoading(false);
            }
        }
    }, [authLoading, user, fetchDashboardData]);

    if (authLoading) {
        return <Container className="text-center py-5"><Spinner /></Container>;
    }
    
    if (!user) {
        return null; // O redirigir al login
    }
    
    // Vista para Supervisor de Operaciones (sin cambios)
    if (user.role === 'SUPERVISOR_OPERACIONES') {
        return (
            <Container className="py-5 text-center">
                <Card className="shadow-lg p-4 mx-auto" style={{maxWidth: '600px'}}>
                    <Card.Body>
                        <Card.Title as="h2">¡Bienvenido, {user.nombre}!</Card.Title>
                        <Card.Text className="my-4">Accedé al portal para la gestión de Horas Extras.</Card.Text>
                        <Link to="/hhee/portal" className="btn btn-primary btn-lg">Ir al Portal de HHEE</Link>
                    </Card.Body>
                </Card>
            </Container>
        );
    }

    // --- NUEVO DASHBOARD PARA ROLES GTR ---
    return (
        <Container className="py-4">
            <h1 className="mb-4">Centro de Comando GTR</h1>
            {error && <Alert variant="danger">{error}</Alert>}
            
            <Row className="g-4">
                {/* Columna Izquierda: Registro Rápido */}
                <Col lg={6}>
                    <RegistroRapidoWidget onUpdate={fetchDashboardData} />
                </Col>

                {/* Columna Derecha: Widgets de Listas */}
                <Col lg={6}>
                    <Row className="g-4">
                        <Col xs={12}>
                            <IncidenciasActivasWidget incidencias={incidenciasActivas} loading={loading} />
                        </Col>
                        {user.role === 'ANALISTA' && (
                            <Col xs={12}>
                                <MisIncidenciasWidget incidencias={misIncidencias} loading={loading} />
                            </Col>
                        )}
                    </Row>
                </Col>
            </Row>
        </Container>
    );
}

export default DashboardPage;