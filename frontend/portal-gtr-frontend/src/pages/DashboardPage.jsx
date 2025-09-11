// src/pages/DashboardPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL } from '../api';
import { Link } from 'react-router-dom';

// Importamos todos nuestros widgets
import PanelRegistroWidget from '../components/dashboard/PanelRegistroWidget';
import IncidenciasActivasWidget from '../components/dashboard/IncidenciasActivasWidget';
import MisIncidenciasWidget from '../components/dashboard/MisIncidenciasWidget';
import EstadisticasGTRWidget from '../components/dashboard/EstadisticasGTRWidget';

function DashboardPage() {
    const { user, authToken, loading: authLoading } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Estados para los datos de los widgets
    const [incidenciasActivas, setIncidenciasActivas] = useState([]);
    const [misIncidencias, setMisIncidencias] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [tareasDisponibles, setTareasDisponibles] = useState([]);

    const fetchDashboardData = useCallback(async () => {
        if (!authToken || !user) return;
        setLoading(true);
        setError(null);
        try {
            // Hacemos todas las peticiones en paralelo
            const requests = [
                fetch(`${GTR_API_URL}/incidencias/activas/recientes`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${GTR_API_URL}/dashboard/stats`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
            ];

            // Añadimos peticiones específicas por rol
            if (user.role === 'ANALISTA') {
                requests.push(fetch(`${GTR_API_URL}/analistas/me/incidencias_asignadas`, { headers: { 'Authorization': `Bearer ${authToken}` } }));
                requests.push(fetch(`${GTR_API_URL}/campanas/tareas_disponibles/`, { headers: { 'Authorization': `Bearer ${authToken}` } }));
            }

            const responses = await Promise.all(requests);
            
            for (const res of responses) {
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ detail: 'Error en una de las peticiones a la API.' }));
                    throw new Error(errorData.detail);
                }
            }

            const [activasData, statsData] = await Promise.all(responses.slice(0, 2).map(res => res.json()));
            setIncidenciasActivas(activasData);
            setDashboardStats(statsData);

            if (user.role === 'ANALISTA') {
                const [misIncidenciasData, tareasDispData] = await Promise.all(responses.slice(2).map(res => res.json()));
                setMisIncidencias(misIncidenciasData);
                setTareasDisponibles(tareasDispData);
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, user]);

    useEffect(() => {
        if (!authLoading && user) {
            // El dashboard GTR solo se carga para Supervisores y Responsables
            if (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') {
                fetchDashboardData();
            } else {
                setLoading(false);
            }
        }
    }, [authLoading, user, fetchDashboardData]);

    if (authLoading || loading) {
        return <Container className="text-center py-5"><Spinner /></Container>;
    }
    
    if (!user) return null;
    
    // --- LÓGICA DE ROLES MODIFICADA ---

    // 1. Vista para Supervisor de Operaciones (sin cambios)
    if (user.role === 'SUPERVISOR_OPERACIONES') {
        return (
            <Container className="py-5 text-center">
                <Card className="shadow-lg p-4 mx-auto" style={{maxWidth: '600px'}}>
                    <Card.Body>
                        <Card.Title as="h2">¡Bienvenido, {user.nombre}!</Card.Title>
                        <Card.Text className="my-4">Accede al portal para la gestión de Horas Extras.</Card.Text>
                        <Link to="/hhee/portal" className="btn btn-primary btn-lg">Ir al Portal de HHEE</Link>
                    </Card.Body>
                </Card>
            </Container>
        );
    }

    // 2. NUEVA VISTA: Panel simple para Analistas
    if (user.role === 'ANALISTA') {
        return (
            <Container className="py-5 text-center">
                <Card className="shadow-lg p-4 mx-auto" style={{maxWidth: '600px'}}>
                    <Card.Body>
                        <Card.Title as="h2">¡Bienvenido, {user.nombre}!</Card.Title>
                        <Card.Text className="my-4">Accede a tu portal para solicitar y revisar tus Horas Extras.</Card.Text>
                        <Link to="/mis-solicitudes-hhee" className="btn btn-primary btn-lg">Ir a Mis Solicitudes HHEE</Link>
                    </Card.Body>
                </Card>
            </Container>
        );
    }

    // 3. El Dashboard GTR completo ahora solo es visible para SUPERVISOR y RESPONSABLE
    return (
        <Container fluid className="p-4">
            <h1 className="mb-4">Bitácora y Centro de Comando GTR</h1>
            {error && <Alert variant="danger">{error}</Alert>}
            
            <Row className="g-4">
                <Col lg={5}>
                    <PanelRegistroWidget onUpdate={fetchDashboardData} />
                </Col>
                <Col lg={7}>
                    <Row className="g-4">
                        <Col md={12}>
                             <IncidenciasActivasWidget incidencias={incidenciasActivas} loading={loading} />
                        </Col>
                        <Col md={12}>
                            <EstadisticasGTRWidget stats={dashboardStats} user={user} />
                        </Col>
                    </Row>
                </Col>
            </Row>
        </Container>
    );
}

export default DashboardPage;