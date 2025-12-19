// RUTA: src/pages/TareasDisponiblesPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, ProgressBar, Badge, Button, Spinner, Alert, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';

const TareasDisponiblesPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    // ESTADO DEL FILTRO DE FECHA (Por defecto: HOY)
    // Obtenemos la fecha actual en formato YYYY-MM-DD ajustada a Argentina
    const hoyArgentina = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Tucuman' });
    const [fechaFiltro, setFechaFiltro] = useState(hoyArgentina);

    const [tareas, setTareas] = useState([]);
    const [sesionesActivas, setSesionesActivas] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const cargarDatos = async () => {
            console.log("🔄 Cargando tareas para la fecha:", fechaFiltro);
            try {
                setLoading(true);
                
                // 1. Petición paralela
                const [resTareas, resSesiones] = await Promise.all([
                    fetchWithAuth(`${API_BASE_URL}/gtr/tareas/`),
                    fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/activas`) 
                ]);

                if (!resTareas.ok || !resSesiones.ok) throw new Error("Error de conexión");

                const dataTareas = await resTareas.json();
                const dataSesiones = await resSesiones.json();
                
                setSesionesActivas(dataSesiones);
                const idsCampanasActivas = dataSesiones.map(s => s.campana_id);

                // 2. FILTRADO POTENTE
                const misTareas = dataTareas.filter(t => {
                    // A. Filtro de Responsabilidad (Dueño o Colaborador)
                    const soyElDuenio = t.analista_id === user.id;
                    const esDeSesionActiva = idsCampanasActivas.includes(t.campana_id);
                    const esVisible = soyElDuenio || (t.es_generada_automaticamente && esDeSesionActiva);

                    if (!esVisible) return false;

                    // B. Filtro de FECHA (La magia para mostrar solo lo del día seleccionado)
                    // Convertimos la fecha de creación de la tarea a string YYYY-MM-DD en hora Argentina
                    const fechaTareaStr = new Date(t.fecha_creacion).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Tucuman' });
                    
                    return fechaTareaStr === fechaFiltro;
                });
                
                // 3. Ordenar
                misTareas.sort((a, b) => {
                    if (a.progreso === 'COMPLETADA' && b.progreso !== 'COMPLETADA') return 1;
                    if (a.progreso !== 'COMPLETADA' && b.progreso === 'COMPLETADA') return -1;
                    return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
                });
                
                setTareas(misTareas);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user) cargarDatos();
    }, [user, fechaFiltro]); // <--- Se recarga cuando cambia el usuario O la fecha

    const calcularProgreso = (items) => {
        if (!items || items.length === 0) return 0;
        const completados = items.filter(i => i.completado).length;
        return Math.round((completados / items.length) * 100);
    };

    // FUNCIÓN PARA FORMATEAR HORA (SOLUCIÓN GMT-3)
    const formatearHoraArgentina = (fechaIso) => {
        if (!fechaIso) return '--:--';
        return new Date(fechaIso).toLocaleTimeString('es-AR', {
            hour: '2-digit', 
            minute: '2-digit', 
            timeZone: 'America/Argentina/Tucuman' // <--- FORZAMOS LA ZONA HORARIA
        });
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" variant="primary" /></Container>;

    return (
        <Container className="py-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
                <div>
                    <h2 className="mb-1">📋 Mis Rutinas</h2>
                    <p className="text-muted mb-0">
                        Mostrando gestión del día: <strong>{new Date(fechaFiltro + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                    </p>
                </div>
                
                <div className="d-flex gap-2 align-items-center">
                    {/* SELECTOR DE FECHA */}
                    <Form.Control 
                        type="date" 
                        value={fechaFiltro}
                        onChange={(e) => setFechaFiltro(e.target.value)}
                        style={{ maxWidth: '160px' }}
                        title="Cambiar fecha para ver historial"
                    />

                    {/* Botón Actualizar */}
                    <Button variant="outline-secondary" onClick={() => { setLoading(true); setFechaFiltro(fechaFiltro); }}>
                        🔄
                    </Button>
                </div>
            </div>
            
            {/* Indicador de Conexión (si existe) */}
            {sesionesActivas.length > 0 && (
                <div className="mb-3">
                    <span className="badge bg-light text-success border px-2 py-2">
                        <span className="spinner-grow spinner-grow-sm me-2"></span>
                        Conectado en vivo a: <strong>{sesionesActivas.map(s => s.campana.nombre).join(', ')}</strong>
                    </span>
                </div>
            )}

            {error && <Alert variant="danger">{error}</Alert>}

            {tareas.length === 0 ? (
                <div className="text-center py-5 bg-light rounded border border-dashed">
                    <h4 className="text-muted">No hay tareas para esta fecha</h4>
                    {fechaFiltro === hoyArgentina ? (
                        <>
                            <p>Haz <b>Check-in</b> en el Dashboard para comenzar tu día.</p>
                            <Button variant="primary" onClick={() => navigate('/dashboard')}>Ir al Dashboard</Button>
                        </>
                    ) : (
                        <p>No se encontraron registros históricos para el día seleccionado.</p>
                    )}
                </div>
            ) : (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {tareas.map(tarea => {
                        const progreso = calcularProgreso(tarea.checklist_items);
                        const esCompletada = tarea.progreso === 'COMPLETADA';
                        const esCancelada = tarea.progreso === 'CANCELADA';
                        
                        let borderClass = 'border-0';
                        let bgHeader = 'bg-white';
                        let badgeBg = 'primary';
                        
                        if (esCompletada) {
                            borderClass = 'border-success';
                            bgHeader = 'bg-success text-white';
                            badgeBg = 'light';
                        } else if (esCancelada) {
                            borderClass = 'border-secondary';
                            bgHeader = 'bg-secondary text-white';
                            badgeBg = 'dark';
                        }

                        return (
                            <Col key={tarea.id}>
                                <Card 
                                    className={`h-100 shadow-sm hover-shadow ${borderClass}`} 
                                    style={{ transition: '0.3s', opacity: (esCompletada || esCancelada) ? 0.85 : 1 }}
                                >
                                    <Card.Header className={`${bgHeader} border-bottom-0 d-flex justify-content-between align-items-center pt-3`}>
                                        <Badge bg={badgeBg} className={esCompletada || esCancelada ? 'text-dark' : ''}>
                                            {tarea.campana?.nombre || 'General'}
                                        </Badge>
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
                                                variant={esCompletada ? 'success' : (esCancelada ? 'secondary' : 'primary')} 
                                                style={{ height: '8px' }} 
                                            />
                                        </div>

                                        <div className="d-grid">
                                            <Button 
                                                variant={esCompletada ? "outline-success" : (esCancelada ? "outline-secondary" : "primary")} 
                                                onClick={() => navigate(`/tareas/${tarea.id}`)}
                                            >
                                                {esCompletada ? '👁️ Ver / Retomar' : (esCancelada ? '👁️ Ver Histórico' : (progreso === 0 ? '🚀 Unirse / Comenzar' : '▶️ Continuar'))}
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