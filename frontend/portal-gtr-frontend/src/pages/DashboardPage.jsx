// RUTA: src/pages/DashboardPage.jsx

import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../api';
import { Link } from 'react-router-dom';

// Widgets
import PanelRegistroWidget from '../components/dashboard/PanelRegistroWidget';
import MisIncidenciasWidget from '../components/dashboard/MisIncidenciasWidget';
import EstadisticasGTRWidget from '../components/dashboard/EstadisticasGTRWidget';

function DashboardPage() {
    const { user, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [misIncidencias, setMisIncidencias] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [tareasDisponibles, setTareasDisponibles] = useState([]);

    // Estas funciones son estables gracias a useCallback con dependencias vacías
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

    useEffect(() => {
        if (authLoading || !user) {
            return; // Si está cargando la autenticación o no hay usuario, no hacemos nada.
        }

        const fetchInitialData = async () => {
            // NO volvemos a poner setLoading(true) aquí. Esto evita el parpadeo.
            setError(null);
            try {
                const promises = [fetchDashboardStats()];
                if (user.role === 'ANALISTA') {
                    promises.push(fetchMisIncidencias(), fetchTareasDisponibles());
                }
                await Promise.all(promises);
            } catch (err) {
                setError(err.message);
            } finally {
                // Solo cambiamos el estado de carga a false la primera vez.
                if (loading) {
                    setLoading(false);
                }
            }
        };

        fetchInitialData();
    // --- CAMBIO CLAVE: Usamos user.id en lugar de user para evitar re-cargas innecesarias ---
    }, [user?.id, authLoading, fetchDashboardStats, fetchMisIncidencias, fetchTareasDisponibles]);

    const handleIncidenciaCreada = useCallback(() => {
        setError(null);
        const promisesToRun = [fetchDashboardStats()];
        if (user && user.role === 'ANALISTA') {
            promisesToRun.push(fetchMisIncidencias());
        }
        Promise.all(promisesToRun).catch(err => {
            console.error("Error al actualizar widgets del dashboard:", err);
            setError(err.message);
        });
    }, [user, fetchDashboardStats, fetchMisIncidencias]);

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
                    </Row>
                </Col>
            </Row>
        </Container>
    );
}

export default DashboardPage;