// RUTA: src/pages/TareasDisponiblesPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, ProgressBar, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';

const TareasDisponiblesPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tareas, setTareas] = useState([]);
    const [sesionesActivas, setSesionesActivas] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const cargarDatos = async () => {
            console.log("🔄 Iniciando carga de tareas y sesiones..."); // DEBUG
            try {
                setLoading(true);
                
                // 1. PETICIÓN PARALELA: Pedimos Tareas y Sesiones al mismo tiempo
                const [resTareas, resSesiones] = await Promise.all([
                    fetchWithAuth(`${API_BASE_URL}/gtr/tareas/`),
                    fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/activas`) 
                ]);

                if (!resTareas.ok || !resSesiones.ok) throw new Error("Error de conexión con el servidor");

                const dataTareas = await resTareas.json();
                const dataSesiones = await resSesiones.json();
                
                console.log("📥 Sesiones Activas recibidas:", dataSesiones); // DEBUG
                setSesionesActivas(dataSesiones);

                // 2. Extraer IDs de campañas donde tengo Check-in activo
                const idsCampanasActivas = dataSesiones.map(s => s.campana_id);
                console.log("🔑 IDs de Campañas Activas:", idsCampanasActivas); // DEBUG

                // 3. FILTRO COLABORATIVO
                const misTareas = dataTareas.filter(t => {
                    // A. Soy el creador/dueño original
                    const soyElDuenio = t.analista_id === user.id;
                    
                    // B. O estoy trabajando en esa campaña AHORA (Check-in activo)
                    //    Esto permite ver tareas creadas por OTROS en mi campaña actual.
                    const esDeSesionActiva = idsCampanasActivas.includes(t.campana_id);
                    
                    // Condición Final:
                    return soyElDuenio || (t.es_generada_automaticamente && esDeSesionActiva);
                });
                
                console.log("📋 Tareas filtradas para mostrar:", misTareas.length); // DEBUG

                // 4. Ordenar: Pendientes primero
                misTareas.sort((a, b) => {
                    if (a.progreso === 'COMPLETADA' && b.progreso !== 'COMPLETADA') return 1;
                    if (a.progreso !== 'COMPLETADA' && b.progreso === 'COMPLETADA') return -1;
                    return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
                });
                
                setTareas(misTareas);
            } catch (err) {
                console.error("❌ Error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user) cargarDatos();
    }, [user]);

    const calcularProgreso = (items) => {
        if (!items || items.length === 0) return 0;
        const completados = items.filter(i => i.completado).length;
        return Math.round((completados / items.length) * 100);
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" variant="primary" /></Container>;

    return (
        <Container className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">📋 Mis Rutinas</h2>
                    <p className="text-muted">Gestión de actividades diarias.</p>
                </div>
                <div className="d-flex gap-2">
                    {/* Indicador visual de conexión a campañas */}
                    {sesionesActivas.length > 0 && (
                        <div className="d-none d-md-flex align-items-center me-3 text-success small border px-2 py-1 rounded bg-white">
                            <span className="spinner-grow spinner-grow-sm me-2 text-success"></span>
                            Conectado a: <strong>{sesionesActivas.map(s => s.campana.nombre).join(', ')}</strong>
                        </div>
                    )}
                    <Button variant="outline-secondary" onClick={() => window.location.reload()}>🔄 Actualizar</Button>
                </div>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            {tareas.length === 0 ? (
                <div className="text-center py-5 bg-light rounded border border-dashed">
                    <h4 className="text-muted">No tienes tareas asignadas</h4>
                    <p>Haz <b>Check-in</b> en una campaña desde el Dashboard para ver las tareas compartidas del equipo.</p>
                    <Button variant="primary" onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
                </div>
            ) : (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {tareas.map(tarea => {
                        const progreso = calcularProgreso(tarea.checklist_items);
                        const esCompletada = tarea.progreso === 'COMPLETADA';
                        
                        const borderClass = esCompletada ? 'border-success' : 'border-0';
                        const bgHeader = esCompletada ? 'bg-success text-white' : 'bg-white';
                        const badgeBg = esCompletada ? 'light' : 'primary';
                        const badgeText = esCompletada ? 'text-dark' : '';

                        return (
                            <Col key={tarea.id}>
                                <Card 
                                    className={`h-100 shadow-sm hover-shadow ${borderClass}`} 
                                    style={{ transition: '0.3s', opacity: esCompletada ? 0.85 : 1 }}
                                >
                                    <Card.Header className={`${bgHeader} border-bottom-0 d-flex justify-content-between align-items-center pt-3`}>
                                        <Badge bg={badgeBg} className={badgeText}>{tarea.campana?.nombre || 'General'}</Badge>
                                        <small className={esCompletada ? 'text-white-50' : 'text-muted'}>
                                            {esCompletada ? 'Finalizada' : `Vence: ${new Date(tarea.fecha_vencimiento).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                                        </small>
                                    </Card.Header>
                                    <Card.Body>
                                        <Card.Title className="h5 mb-3">
                                            {tarea.titulo} {esCompletada && '✅'}
                                        </Card.Title>
                                        
                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between small mb-1">
                                                <span>Progreso</span>
                                                <span className="fw-bold">{progreso}%</span>
                                            </div>
                                            <ProgressBar 
                                                now={progreso} 
                                                variant={esCompletada ? 'success' : 'primary'} 
                                                style={{ height: '8px' }} 
                                            />
                                        </div>

                                        <div className="d-grid">
                                            <Button 
                                                variant={esCompletada ? "outline-success" : "primary"} 
                                                onClick={() => navigate(`/tareas/${tarea.id}`)}
                                            >
                                                {esCompletada ? '👁️ Ver / Retomar' : (progreso === 0 ? '🚀 Unirse / Comenzar' : '▶️ Continuar')}
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}
        </Container>
    );
};

export default TareasDisponiblesPage;