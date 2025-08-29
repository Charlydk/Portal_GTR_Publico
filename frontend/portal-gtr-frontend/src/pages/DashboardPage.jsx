// src/pages/DashboardPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, ListGroup, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../api';
import { Link } from 'react-router-dom';

// Componente reutilizable para los widgets de estadísticas
const StatWidget = ({ title, value, variant = 'primary' }) => (
    <Card className={`text-center shadow-sm bg-${variant} text-white h-100`}>
        <Card.Body className="d-flex flex-column justify-content-center">
            <Card.Title as="h3">{value}</Card.Title>
            <Card.Text className="mb-0">{title}</Card.Text>
        </Card.Body>
    </Card>
);

function DashboardPage() {
    const { user, authToken, loading: authLoading } = useAuth();
    
    
    // Estados para la carga y datos
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Estados para los datos del dashboard
    const [campanasAsignadas, setCampanasAsignadas] = useState([]);
    const [avisosPendientes, setAvisosPendientes] = useState([]);
    const [misTareasActivas, setMisTareasActivas] = useState([]);
    const [tareasDisponibles, setTareasDisponibles] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null); // Estado para las nuevas estadísticas

    // Función para obtener todos los datos del dashboard en paralelo
    const fetchDashboardData = useCallback(async () => {
        if (!authToken || !user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const [
                userMeRes,
                allAvisosRes,
                acusesReciboRes,
                tareasDisponiblesRes,
                statsRes, // Nueva petición para las estadísticas
            ] = await Promise.all([
                fetch(`${API_BASE_URL}/users/me/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${API_BASE_URL}/avisos/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${API_BASE_URL}/analistas/${user.id}/acuses_recibo_avisos`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${API_BASE_URL}/campanas/tareas_disponibles/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${API_BASE_URL}/dashboard/stats`, { headers: { 'Authorization': `Bearer ${authToken}` } })
            ]);

            // Procesamiento de datos de usuario, tareas y campañas
            if (!userMeRes.ok) throw new Error('Error al cargar datos del usuario.');
            const userMeData = await userMeRes.json();
            setCampanasAsignadas(userMeData.campanas_asignadas || []);
            const tareasDeCampana = (userMeData.tareas || []).map(t => ({ ...t, type: 'campaign' }));
            const tareasGeneradas = (userMeData.tareas_generadas_por_avisos || []).map(t => ({ ...t, type: 'generated' }));
            const todasMisTareas = [...tareasDeCampana, ...tareasGeneradas].sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
            setMisTareasActivas(todasMisTareas);

            // Procesamiento de avisos pendientes
            if (!allAvisosRes.ok) throw new Error('Error al cargar avisos.');
            if (!acusesReciboRes.ok) throw new Error('Error al cargar acuses de recibo.');
            const allAvisos = await allAvisosRes.json();
            const acusesRecibo = await acusesReciboRes.json();
            const acusadosIds = new Set(acusesRecibo.map(ar => ar.aviso.id));
            setAvisosPendientes(allAvisos.filter(aviso => !acusadosIds.has(aviso.id)));
            
            // Procesamiento de tareas disponibles
            if (!tareasDisponiblesRes.ok) throw new Error('Error al cargar tareas disponibles.');
            setTareasDisponibles(await tareasDisponiblesRes.json());
            
            // Procesamiento de las nuevas estadísticas de incidencias
            if (!statsRes.ok) throw new Error('Error al cargar estadísticas de incidencias.');
            setDashboardStats(await statsRes.json());

        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            setError(err.message || "No se pudieron cargar los datos del dashboard.");
        } finally {
            setLoading(false);
        }
    }, [authToken, user]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchDashboardData();
        }
    }, [authLoading, user, fetchDashboardData]);
    
    // Funciones de utilidad y manejadores de eventos
    const handleAcuseRecibo = async (avisoId) => {
        if (!authToken || !user) {
            setError("Necesita iniciar sesión para realizar esta acción.");
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/avisos/${avisoId}/acuse_recibo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ analista_id: user.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al acusar recibo: ${response.statusText}`);
            }

            setSuccessMessage("Acuse de recibo registrado con éxito y tarea generada si aplica!");
            fetchDashboardData();
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error("Error al acusar recibo:", err);
            setError(err.message || "No se pudo registrar el acuse de recibo.");
            setTimeout(() => setError(null), 5000);
        }
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

    const getStatusVariant = (estado) => {
        const map = { 'ABIERTA': 'danger', 'EN_PROGRESO': 'warning', 'CERRADA': 'success' };
        return map[estado] || 'secondary';
    };

    // Renderizado condicional para carga, error o falta de usuario
    if (authLoading || loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center min-vh-100">
                <Spinner animation="border" role="status" />
                <p className="ms-3 text-muted">Cargando datos del dashboard...</p>
            </Container>
        );
    }
    if (error) {
        return <Container className="mt-4"><Alert variant="danger">{error}</Alert></Container>;
    }
    if (!user) {
        return <Container className="mt-4"><Alert variant="warning">No se pudo cargar la información del usuario.</Alert></Container>;
    }

    // Renderizado principal del Dashboard
    return (
        <Container className="py-5">
            <h1 className="mb-4 text-center text-primary">Dashboard de {user.role}</h1>
            {successMessage && <Alert variant="success">{successMessage}</Alert>}
            
            {/* Sección de Widgets de Estadísticas (se adapta por rol) */}
            {dashboardStats && (
                <Row className="mb-4 g-4">
                    {user.role === 'ANALISTA' && (
                        <>
                            <Col md={4}>
                                <StatWidget title="Incidencias Asignadas a Mí" value={dashboardStats.mis_incidencias_asignadas} variant="success" />
                            </Col>
                            <Col md={4}>
                                <StatWidget title="Incidencias Nuevas (Sin Asignar)" value={dashboardStats.incidencias_sin_asignar} variant="info" />
                            </Col>
                             <Col md={4}>
                                <Link to="/tareas/disponibles" className="text-decoration-none">
                                <StatWidget title="Tareas de Campaña Disponibles" value={tareasDisponibles.length} variant="primary" />
                                </Link>
                            </Col>
                        </>
                    )}
                    {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                        <Col md={{ span: 6, offset: 3 }}>
                            <StatWidget title="Total de Incidencias Activas" value={dashboardStats.total_incidencias_activas} variant="danger" />
                        </Col>
                    )}
                </Row>
            )}

            {/* Lista de Incidencias del día (solo para Analistas) */}
            {user.role === 'ANALISTA' && dashboardStats && (
                 <Row className="mb-4">
                    <Col>
                        <Card className="shadow-sm">
                             <Card.Header as="h5" className="text-secondary">Incidencias Activas de Hoy</Card.Header>
                            <ListGroup variant="flush">
                                {dashboardStats.incidencias_del_dia.length > 0 ? (
                                    dashboardStats.incidencias_del_dia.map(inc => (
                                        <ListGroup.Item key={inc.id} action as={Link} to={`/incidencias/${inc.id}`} className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <strong>{inc.titulo}</strong><br />
                                                <small className="text-muted">Campaña: {inc.campana.nombre}</small>
                                            </div>
                                            <Badge bg={getStatusVariant(inc.estado)}>{inc.estado}</Badge>
                                        </ListGroup.Item>
                                    ))
                                ) : (
                                    <ListGroup.Item><Alert variant="info" className="mb-0">No hay incidencias activas reportadas hoy.</Alert></ListGroup.Item>
                                )}
                            </ListGroup>
                        </Card>
                    </Col>
                </Row>
            )}
            
            {/* Sección de Avisos Pendientes */}
            <Row className="mb-4">
                <Col>
                    <Card className="shadow-sm">
                        <Card.Body>
                            <Card.Title className="text-secondary">Avisos Pendientes de Acusar Recibo</Card.Title>
                            {avisosPendientes.length > 0 ? (
                                <ListGroup variant="flush">
                                    {avisosPendientes.map(aviso => (
                                        <ListGroup.Item key={aviso.id} className="d-flex justify-content-between align-items-center flex-wrap">
                                            <div>
                                                <strong>{aviso.titulo}</strong>
                                                <p className="mb-1 text-muted small">{aviso.contenido}</p>
                                                <small>Creador: {aviso.creador?.nombre} {aviso.creador?.apellido} | Campaña: {aviso.campana?.nombre || 'General'}</small>
                                                {aviso.requiere_tarea && (<div className="mt-1"><Badge bg="warning" text="dark">Requiere Tarea</Badge></div>)}
                                            </div>
                                            <Button variant="success" size="sm" onClick={() => handleAcuseRecibo(aviso.id)}>Acusar Recibo</Button>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : ( <Alert variant="success" className="mb-0">No tienes avisos pendientes de acusar recibo.</Alert> )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Sección de Tareas y Campañas */}
            <Row>
                <Col md={6} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Body>
                            <Card.Title className="text-secondary">Mis Tareas Activas</Card.Title>
                            {misTareasActivas.length > 0 ? (
                                <ListGroup variant="flush">
                                    {misTareasActivas.map(tarea => (
                                        <ListGroup.Item key={`${tarea.type}-${tarea.id}`}>
                                            <Link to={tarea.type === 'campaign' ? `/tareas/${tarea.id}` : `/tareas-generadas/${tarea.id}`} className="text-decoration-none d-block">
                                                <strong>{tarea.titulo}</strong>
                                                <div>
                                                    <Badge bg={tarea.type === 'campaign' ? 'primary' : 'info'}>{tarea.type === 'campaign' ? 'Campaña' : 'Aviso'}</Badge>
                                                    <small className="ms-2 text-muted">Vence: {formatDateTime(tarea.fecha_vencimiento)}</small>
                                                </div>
                                            </Link>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : ( <Alert variant="info" className="mb-0">No tienes tareas activas.</Alert> )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6} className="mb-4">
                    <Card className="shadow-sm h-100">
                        <Card.Body>
                             <Card.Title className="text-secondary">Mis Campañas Asignadas</Card.Title>
                             {campanasAsignadas.length > 0 ? (
                                <ListGroup variant="flush">
                                    {campanasAsignadas.map(campana => (
                                        <ListGroup.Item key={campana.id}>
                                            <Link to={`/campanas/${campana.id}`} className="text-decoration-none">{campana.nombre}</Link>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                             ) : ( <Alert variant="info" className="mb-0">No tienes campañas asignadas.</Alert> )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default DashboardPage;