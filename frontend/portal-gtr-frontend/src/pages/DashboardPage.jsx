// RUTA: src/pages/DashboardPage.jsx

import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL, API_BASE_URL, fetchWithAuth } from '../api'; 
import { Link } from 'react-router-dom';
import CampaignSelector from '../components/dashboard/CampaignSelector';

// Widgets
import PanelRegistroWidget from '../components/dashboard/PanelRegistroWidget';
import MisIncidenciasWidget from '../components/dashboard/MisIncidenciasWidget';
import EstadisticasGTRWidget from '../components/dashboard/EstadisticasGTRWidget';
import CoberturaWidget from '../components/dashboard/CoberturaWidget';
import WidgetAlertas from '../components/dashboard/WidgetAlertas';

function DashboardPage() {
    const { user, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [misIncidencias, setMisIncidencias] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [tareasDisponibles, setTareasDisponibles] = useState([]);
    
    // Estados para el Selector Dinámico
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [misSesiones, setMisSesiones] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0); 

    // --- Callbacks de Carga ---
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

    const fetchMisSesiones = useCallback(async () => {
        try {
            if (['ANALISTA', 'SUPERVISOR', 'RESPONSABLE'].includes(user?.role)) {
                const res = await fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/activas`);
                if (res.ok) {
                    const data = await res.json();
                    setMisSesiones(data);
                }
            }
        } catch (err) {
            console.error("Error cargando sesiones", err);
        }
    }, [user?.role]);

    const handleManualRefresh = async () => {
        setRefreshing(true);
        try {
            const promises = [
                fetchDashboardStats(),
                fetchMisSesiones() 
            ];

            if (user.role === 'ANALISTA') {
                promises.push(fetchMisIncidencias(), fetchTareasDisponibles());
            }

            await Promise.all(promises);
            setRefreshTrigger(prev => prev + 1);

        } catch (error) {
            console.error("Error al actualizar:", error);
        } finally {
            setTimeout(() => setRefreshing(false), 500);
        }
    };

    // --- Efecto Inicial ---
    useEffect(() => {
        if (authLoading || !user) return; 

        if (user.role === 'SUPERVISOR_OPERACIONES') {
            setLoading(false);
            return;
        }

        const fetchInitialData = async () => {
            setError(null);
            try {
                const promises = [fetchDashboardStats(), fetchMisSesiones()];

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
        
    }, [user?.id, authLoading, fetchDashboardStats, fetchMisIncidencias, fetchTareasDisponibles, fetchMisSesiones]);

    const handleIncidenciaCreada = useCallback(() => {
        setError(null);
        const promisesToRun = [fetchDashboardStats()];
        if (user && user.role === 'ANALISTA') {
            promisesToRun.push(fetchMisIncidencias());
        }
        Promise.all(promisesToRun).catch(err => {
            console.error("Error al actualizar widgets:", err);
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
                        <Link to="/hhee/portal" className="btn btn-primary btn-lg mt-4">Ir al Portal de HHEE</Link>
                    </Card.Body>
                </Card>
            </Container>
        );
    }

    return (
        <Container fluid className="p-4">
            {/* --- CABECERA --- */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1 className="mb-0">Bitácora y Centro de Comando GTR</h1>
                <Button 
                    variant="light" 
                    className="border shadow-sm d-flex align-items-center gap-2"
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? <Spinner size="sm" animation="border" /> : '🔄'}
                    {refreshing ? 'Actualizando...' : 'Actualizar Todo'}
                </Button>
            </div>
            
            {/* --- BARRA DE CAMPAÑAS --- */}
            <Card className="mb-4 shadow-sm border-primary">
                <Card.Body className="d-flex justify-content-between align-items-center flex-wrap">
                    <div>
                        <h5 className="mb-1">Mis Campañas Activas:</h5>
                        {misSesiones.length > 0 ? (
                            <div className="d-flex gap-2 flex-wrap">
                                {misSesiones.map(sesion => (
                                    <Badge key={sesion.id} bg="success" className="p-2">
                                        {sesion.campana.nombre}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <span className="text-muted fst-italic">No estás gestionando ninguna campaña activamente.</span>
                        )}
                    </div>
                    <Button 
                        variant="outline-primary" 
                        onClick={() => setShowCampaignModal(true)}
                        className="mt-2 mt-md-0"
                    >
                        🔄 Gestionar mi Actividad
                    </Button>
                </Card.Body>
            </Card>

            {error && <Alert variant="danger">{error}</Alert>}

            {/* --- ZONA PRINCIPAL DE TRABAJO --- */}
            <Row className="g-4">
                
                {/* COLUMNA IZQUIERDA (66%): GESTIÓN DE INCIDENCIAS (Stats + Carga) */}
                <Col lg={8}>
                    {/* 1. Estadísticas (Budgets) */}
                    <div className="mb-4">
                        {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                            <EstadisticasGTRWidget stats={dashboardStats} user={user} />
                        )}
                        {user.role === 'ANALISTA' && (
                            <EstadisticasGTRWidget 
                                stats={dashboardStats} 
                                user={user} 
                                tareasDisponibles={tareasDisponibles.length} 
                            />
                        )}
                    </div>

                    {/* 2. Registro Rápido (Pegado abajo de los budgets) */}
                    <div>
                        <PanelRegistroWidget onUpdate={handleIncidenciaCreada} />
                    </div>
                </Col>

                {/* COLUMNA DERECHA (33%): AGENDA DE ACTIVIDADES (Suelto) */}
                <Col lg={4}>
                     <WidgetAlertas />
                </Col>
            </Row>

            {/* --- ZONA INFERIOR: TABLAS Y LISTADOS --- */}
            <Row className="g-4 mt-2">
                {user.role === 'ANALISTA' && (
                    <Col md={12}>
                        <MisIncidenciasWidget incidencias={misIncidencias} loading={loading} />
                    </Col>
                )}

                {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                    <Col md={12}>
                        <CoberturaWidget refreshTrigger={refreshTrigger} />
                    </Col>
                )}
            </Row>

            <CampaignSelector 
                show={showCampaignModal} 
                handleClose={() => setShowCampaignModal(false)}
                onUpdate={fetchMisSesiones} 
            />
        </Container>
    );
}

export default DashboardPage;