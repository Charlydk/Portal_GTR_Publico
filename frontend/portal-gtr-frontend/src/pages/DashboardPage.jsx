// src/pages/DashboardPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, ListGroup, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL, GTR_API_URL } from '../api';
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
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados para los datos del dashboard (solo para roles GTR)
    const [campanasAsignadas, setCampanasAsignadas] = useState([]);
    const [avisosPendientes, setAvisosPendientes] = useState([]);
    const [misTareasActivas, setMisTareasActivas] = useState([]);
    const [tareasDisponibles, setTareasDisponibles] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null);

    const fetchGTRDashboardData = useCallback(async () => {
        if (!authToken || !user) return;
        setLoading(true);
        setError(null);
        try {
            const [
                userMeRes, allAvisosRes, acusesReciboRes, tareasDisponiblesRes, statsRes,
            ] = await Promise.all([
                fetch(`${API_BASE_URL}/users/me/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${GTR_API_URL}/avisos/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${GTR_API_URL}/analistas/${user.id}/acuses_recibo_avisos`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${GTR_API_URL}/campanas/tareas_disponibles/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${GTR_API_URL}/dashboard/stats`, { headers: { 'Authorization': `Bearer ${authToken}` } })
            ]);

            // Verificamos todas las respuestas antes de procesar
            if (!userMeRes.ok) throw new Error('Error al cargar datos del usuario.');
            if (!allAvisosRes.ok) throw new Error('Error al cargar avisos.');
            if (!acusesReciboRes.ok) throw new Error('Error al cargar acuses de recibo.');
            if (!tareasDisponiblesRes.ok) throw new Error('Error al cargar tareas disponibles.');
            if (!statsRes.ok) throw new Error('Error al cargar estadísticas de incidencias.');

            const userMeData = await userMeRes.json();
            setCampanasAsignadas(userMeData.campanas_asignadas || []);
            setMisTareasActivas([
                ...(userMeData.tareas || []).map(t => ({ ...t, type: 'campaign' })),
                ...(userMeData.tareas_generadas_por_avisos || []).map(t => ({ ...t, type: 'generated' }))
            ].sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion)));

            const allAvisos = await allAvisosRes.json();
            const acusesRecibo = await acusesReciboRes.json();
            const acusadosIds = new Set(acusesRecibo.map(ar => ar.aviso.id));
            setAvisosPendientes(allAvisos.filter(aviso => !acusadosIds.has(aviso.id)));
            
            setTareasDisponibles(await tareasDisponiblesRes.json());
            setDashboardStats(await statsRes.json());

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, user]);

    useEffect(() => {
        if (!authLoading && user) {
            // --- LÓGICA CLAVE ---
            // Solo cargamos los datos complejos si el rol NO es de operaciones
            if (user.role !== 'SUPERVISOR_OPERACIONES') {
                fetchGTRDashboardData();
            } else {
                setLoading(false); // Para el Supervisor de Operaciones, no hay nada que cargar.
            }
        }
    }, [authLoading, user, fetchGTRDashboardData]);

    const handleAcuseRecibo = async (avisoId) => {
        if (!authToken || !user) {
            setError("Necesita iniciar sesión para realizar esta acción.");
            return;
        }
        try {
            const response = await fetch(`${GTR_API_URL}/avisos/${avisoId}/acuse_recibo`, {
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
            
            // Si el acuse es exitoso, volvemos a cargar todos los datos del dashboard
            // para que la lista de avisos pendientes se actualice.
            fetchGTRDashboardData(); 

        } catch (err) {
            setError(err.message || "No se pudo registrar el acuse de recibo.");
        }
    };

    const formatDateTime = (apiDateString) => {
        // Si no hay fecha, devuelve N/A
        if (!apiDateString) {
            return 'N/A';
        }
    
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
        return <Container className="text-center py-5"><Spinner /></Container>;
    }
    
    if (!user) {
        return <Container className="mt-4"><Alert variant="warning">No se pudo cargar la información del usuario.</Alert></Container>;
    }

    // --- RENDERIZADO CONDICIONAL ---
    // Si el rol es SUPERVISOR_OPERACIONES, muestra una vista simple.
    if (user.role === 'SUPERVISOR_OPERACIONES') {
        return (
            <Container className="py-5 text-center">
                <Card className="shadow-lg p-4 mx-auto" style={{maxWidth: '600px'}}>
                    <Card.Body>
                        <Card.Title as="h2">¡Welcome, {user.nombre}!</Card.Title>
                        <Card.Text className="my-4">
                            Desde aquí podés acceder al portal para la gestión de Horas Extras.
                        </Card.Text>
                        <Link to="/hhee/portal" className="btn btn-primary btn-lg">
                            Ir al Portal de Carga de HHEE
                        </Link>
                    </Card.Body>
                </Card>
            </Container>
        );
    }

    // Renderizado principal del Dashboard
    return (
        <Container className="py-5">
            <h1 className="mb-4 text-center text-primary">Dashboard de {user.role}</h1>
            {error && <Alert variant="danger">{error}</Alert>}
            
            {dashboardStats && (
                <Row className="mb-4 g-4">
                    {user.role === 'ANALISTA' && (
                        <>
                            <Col md={4}><StatWidget title="Incidencias Asignadas" value={dashboardStats.mis_incidencias_asignadas} variant="success" /></Col>
                            <Col md={4}><StatWidget title="Incidencias Sin Asignar" value={dashboardStats.incidencias_sin_asignar} variant="info" /></Col>
                            <Col md={4}><Link to="/tareas/disponibles" className="text-decoration-none h-100"><StatWidget title="Tareas Disponibles" value={tareasDisponibles.length} variant="primary" /></Link></Col>
                        </>
                    )}
                    {user.role !== 'ANALISTA' && (
                        <Col md={{ span: 6, offset: 3 }}>
                            <StatWidget title="Total Incidencias Activas" value={dashboardStats.total_incidencias_activas} variant="danger" />
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