import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../api';
import { Link } from 'react-router-dom';

// Widgets
import PanelRegistroWidget from '../components/dashboard/PanelRegistroWidget';
import IncidenciasActivasWidget from '../components/dashboard/IncidenciasActivasWidget';
import MisIncidenciasWidget from '../components/dashboard/MisIncidenciasWidget';
import EstadisticasGTRWidget from '../components/dashboard/EstadisticasGTRWidget';

function DashboardPage() {
    const { user, loading: authLoading } = useAuth();

    // --- ESTADOS (sin cambios) ---
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [incidenciasActivas, setIncidenciasActivas] = useState([]);
    const [misIncidencias, setMisIncidencias] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [tareasDisponibles, setTareasDisponibles] = useState([]);

    // --- 1. SEPARAMOS LA LÓGICA DE BÚSQUEDA EN FUNCIONES INDIVIDUALES ---
    const fetchIncidenciasActivas = useCallback(async () => {
        const response = await fetchWithAuth(`${GTR_API_URL}/incidencias/activas/recientes`);
        if (!response.ok) throw new Error('Error al cargar incidencias activas.');
        setIncidenciasActivas(await response.json());
    }, []);

    const fetchDashboardStats = useCallback(async () => {
        const response = await fetchWithAuth(`${GTR_API_URL}/dashboard/stats`);
        if (!response.ok) throw new Error('Error al cargar estadísticas.');
        setDashboardStats(await response.json());
    }, []);

    const fetchMisIncidencias = useCallback(async () => {
        const response = await fetchWithAuth(`${GTR_API_URL}/analistas/me/incidencias_asignadas`);
        if (!response.ok) throw new Error('Error al cargar mis incidencias.');
        setMisIncidencias(await response.json());
    }, []);

    const fetchTareasDisponibles = useCallback(async () => {
        const response = await fetchWithAuth(`${GTR_API_URL}/campanas/tareas_disponibles/`);
        if (!response.ok) throw new Error('Error al cargar tareas disponibles.');
        setTareasDisponibles(await response.json());
    }, []);

    // --- 2. useEffect INICIAL QUE CARGA TODO UNA SOLA VEZ ---
    useEffect(() => {
        if (!authLoading && user) {
            if (!['ANALISTA', 'SUPERVISOR', 'RESPONSABLE'].includes(user.role)) {
                setLoading(false);
                return;
            }

            const fetchInitialData = async () => {
                setLoading(true);
                setError(null);
                try {
                    const promises = [fetchIncidenciasActivas(), fetchDashboardStats()];
                    if (user.role === 'ANALISTA') {
                        promises.push(fetchMisIncidencias(), fetchTareasDisponibles());
                    }
                    await Promise.all(promises);
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            fetchInitialData();
        }
    }, [authLoading, user, fetchIncidenciasActivas, fetchDashboardStats, fetchMisIncidencias, fetchTareasDisponibles]);

    // --- 3. CREAMOS UNA FUNCIÓN DE ACTUALIZACIÓN ESPECÍFICA ---
    const handleIncidenciaCreada = useCallback(() => {
        // Cuando se crea una incidencia, solo refrescamos la lista de activas y las estadísticas.
        // ¡Ya no recargamos todo lo demás!
        setError(null);
        Promise.all([
            fetchIncidenciasActivas(),
            fetchDashboardStats()
        ]).catch(err => setError(err.message));
    }, [fetchIncidenciasActivas, fetchDashboardStats]);

    // --- RENDERIZADO (sin cambios en la estructura visual) ---
    if (authLoading || loading) {
        return <Container className="text-center py-5"><Spinner /></Container>;
    }

    if (!user) return null;

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

    return (
        <Container fluid className="p-4">
            <h1 className="mb-4">Bitácora y Centro de Comando GTR</h1>
            {error && <Alert variant="danger">{error}</Alert>}

            <Row className="g-4">
                <Col lg={5}>
                    {/* 4. PASAMOS LA NUEVA FUNCIÓN ESPECÍFICA AL WIDGET */}
                    <PanelRegistroWidget onUpdate={handleIncidenciaCreada} />
                </Col>
                <Col lg={7}>
                    <Row className="g-4">
                        {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                            <Col md={12}>
                                <EstadisticasGTRWidget stats={dashboardStats} user={user} />
                            </Col>
                        )}
                        {user.role === 'ANALISTA' && (
                            <>
                                <Col md={12}>
                                    <EstadisticasGTRWidget 
                                        stats={dashboardStats} 
                                        user={user} 
                                        tareasDisponibles={tareasDisponibles.length} 
                                    />
                                </Col>
                                <Col md={12}>
                                    <MisIncidenciasWidget incidencias={misIncidencias} loading={loading} />
                                </Col>
                            </>
                        )}
                        <Col md={12}>
                            <IncidenciasActivasWidget incidencias={incidenciasActivas} loading={loading} />
                        </Col>
                    </Row>
                </Col>
            </Row>
        </Container>
    );
}

export default DashboardPage;