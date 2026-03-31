// RUTA: src/pages/DashboardPage.jsx

import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Badge, Table, Button, ProgressBar, Spinner, OverlayTrigger, Tooltip, ListGroup, Modal } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL, fetchWithAuth } from '../api'; 
import { useNavigate } from 'react-router-dom';

// Widgets
import PanelRegistroWidget from '../components/dashboard/PanelRegistroWidget';
import MisIncidenciasWidget from '../components/dashboard/MisIncidenciasWidget';
import WidgetAlertas from '../components/dashboard/WidgetAlertas'; 
import WidgetAlertasSupervisor from '../components/dashboard/WidgetAlertasSupervisor';
import CampaignSelector from '../components/dashboard/CampaignSelector';
import EntregablesWidget from '../components/dashboard/EntregablesWidget';

function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Estados Generales
    const [loading, setLoading] = useState(true);
    const [statsIncidencias, setStatsIncidencias] = useState(null);
    const [coberturaGlobal, setCoberturaGlobal] = useState([]); 
    
    // Estados Analista
    const [misIncidencias, setMisIncidencias] = useState([]);
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [misSesionesActivas, setMisSesionesActivas] = useState([]); 
    const [showRegistroModal, setShowRegistroModal] = useState(false);

    // Estados Supervisor
    const [cumplimientoCampanas, setCumplimientoCampanas] = useState([]);
    const [estadoAnalistas, setEstadoAnalistas] = useState([]);
    const [showRegistroModalSup, setShowRegistroModalSup] = useState(false);
    const [showRutinasModal, setShowRutinasModal] = useState(false);
    const [showDotacionModal, setShowDotacionModal] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        if (user) {
            cargarDatosDashboard();
        }
    }, [user]);

    // Auto-refresh cada 5 minutos para supervisores
    useEffect(() => {
        if (user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE')) {
            const interval = setInterval(() => {
                if (!document.hidden) cargarDatosDashboard(true);
            }, 300000); // 5 minutos
            return () => clearInterval(interval);
        }
    }, [user]);

    const cargarDatosDashboard = async (isSilent = false) => {
        if (user.role === 'SUPERVISOR_OPERACIONES') {
            setLoading(false);
            return;
        }
        if (!isSilent) setLoading(true);
        try {
            // 1. Datos Comunes
            const [resStats, resCobertura] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/gtr/dashboard/stats`),
                fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/cobertura`)
            ]);

            if (resStats.ok) setStatsIncidencias(await resStats.json());

            let dataCobertura = [];
            if (resCobertura.ok) {
                dataCobertura = await resCobertura.json();
                setCoberturaGlobal(dataCobertura);
            }

            if (user.role === 'ANALISTA') {
                await cargarDatosEspecificosAnalista(dataCobertura);
            } else {
                await cargarDatosEspecificosSupervisor(dataCobertura);
            }

        } catch (error) { console.error("Error dashboard", error); } 
        finally { 
            if (!isSilent) setLoading(false);
            setLastUpdated(new Date());
        }
    };

    const cargarDatosEspecificosAnalista = async (dataCobertura) => {
        const resInc = await fetchWithAuth(`${API_BASE_URL}/gtr/incidencias/mis-incidencias`);
        if (resInc.ok) setMisIncidencias(await resInc.json());

        const resSesiones = await fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/activas`);
        if (resSesiones.ok) {
            const dataSesiones = await resSesiones.json();
            setMisSesionesActivas(dataSesiones);
        }
    };

    const cargarDatosEspecificosSupervisor = async (dataCobertura) => {
        const hoy = new Date().toISOString().split('T')[0];
        const [resTareas, resAnalistas] = await Promise.all([
            fetchWithAuth(`${API_BASE_URL}/gtr/monitor/tareas?fecha=${hoy}`),
            fetchWithAuth(`${API_BASE_URL}/gtr/analistas/listado-simple/`)
        ]);

        if (resTareas.ok && resAnalistas.ok) {
            const tareas = await resTareas.json();
            const analistas = await resAnalistas.json();
            procesarCumplimiento(tareas, dataCobertura);
            procesarEstadoAnalistas(analistas, dataCobertura);
        }
    };

    // --- PROCESADORES SUPERVISOR ---
    const procesarCumplimiento = (tareas, cobertura) => {
        const reporte = cobertura.map(c => {
            const tareasCampaña = tareas.filter(t => t.campana_id === c.campana_id);
            let porcentaje = 0, total = 0, completados = 0, vencidas = 0;

            if (tareasCampaña.length > 0) {
                tareasCampaña.forEach(t => {
                    t.checklist_items.forEach(i => {
                        total++;
                        if (i.completado) completados++;
                        if (!i.completado && i.hora_sugerida) {
                             const now = new Date();
                             const [h, m] = i.hora_sugerida.toString().substring(0, 5).split(':').map(Number);
                             if ((now.getHours() * 60 + now.getMinutes()) - (h * 60 + m) > 15) vencidas++;
                        }
                    });
                });
                porcentaje = total === 0 ? 0 : Math.round((completados / total) * 100);
            }
            return { id: c.campana_id, nombre: c.nombre_campana, avance: porcentaje, tiene_tareas: tareasCampaña.length > 0, vencidas, tarea_id: tareasCampaña[0]?.id || null };
        });
        setCumplimientoCampanas(reporte.sort((a, b) => b.tiene_tareas - a.tiene_tareas || b.vencidas - a.vencidas));
    };

    const procesarEstadoAnalistas = (todosAnalistas, cobertura) => {
        const mapaActivos = {}; 
        cobertura.forEach(camp => {
            camp.nombres_analistas.forEach(nombreCompleto => {
                if (!mapaActivos[nombreCompleto]) mapaActivos[nombreCompleto] = [];
                mapaActivos[nombreCompleto].push(camp.nombre_campana);
            });
        });

        const estado = todosAnalistas.map(a => {
            const key = Object.keys(mapaActivos).find(k => k.toLowerCase().includes(a.nombre.toLowerCase()));
            const campañas = key ? mapaActivos[key] : [];

            return {
                id: a.id,
                nombre: `${a.nombre} ${a.apellido}`,
                campanas: campañas,
                estado: campañas.length > 0 ? 'ACTIVO' : 'LIBRE'
            };
        });
        setEstadoAnalistas(estado.sort((a, b) => (a.estado === 'ACTIVO' ? -1 : 1)));
    };

    // ========================================================================
    // WIDGETS DE INCIDENCIAS SUPERVISOR (COMPACTOS — solo 2 KPIs)
    // ========================================================================
    const renderIncidentWidgetsSupervisor = () => (
        <Row className="g-2 mb-3">
            <Col xs={6}>
                <Card className="bg-danger text-white text-center shadow-sm h-100 py-1 action-hover" style={{cursor: 'pointer'}} onClick={() => navigate('/control-incidencias?estado=ABIERTA&estado=EN_PROGRESO')}>
                    <Card.Body className="p-2">
                        <h4 className="mb-0 fw-bold">{statsIncidencias?.total_incidencias_activas || 0}</h4>
                        <small style={{fontSize:'0.75rem'}}>Activas 👆</small>
                    </Card.Body>
                </Card>
            </Col>
            <Col xs={6}>
                <Card className="bg-warning text-dark text-center shadow-sm h-100 py-1 action-hover" style={{cursor: 'pointer'}} onClick={() => navigate('/control-incidencias?estado=ABIERTA&asignado=false')}>
                    <Card.Body className="p-2">
                        <h4 className="mb-0 fw-bold">{statsIncidencias?.incidencias_sin_asignar || 0}</h4>
                        <small style={{fontSize:'0.75rem'}}>Sin Asignar 👆</small>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    );

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
                <div className="text-center">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted fw-semibold">Sincronizando Tablero...</p>
                </div>
            </div>
        );
    }

    // ========================================================================
    // VISTA SUPERVISOR OPERACIONES (PORTAL WORKFORCE HHEE)
    // ========================================================================
    if (user.role === 'SUPERVISOR_OPERACIONES') {
        return (
            <Container fluid className="p-4">
                <Card className="shadow-sm border-0 bg-light">
                    <Card.Body className="text-center py-5">
                        <div className="fs-1 mb-3">🛠️</div>
                        <h2 className="fw-bold mb-3">Panel de Operaciones</h2>
                        <p className="lead mb-4">Bienvenido al módulo de gestión operativa.</p>
                        <hr className="my-4" />
                        <div className="text-start mx-auto" style={{maxWidth: '600px'}}>
                            <h5 className="fw-bold mb-3">Accesos Directos:</h5>
                            <ListGroup variant="flush" className="bg-transparent">
                                <ListGroup.Item className="bg-transparent border-0 ps-0">
                                    <span className="me-2">🔹</span>
                                    Utiliza el menú <strong>GESTION HHEE</strong> para acceder a las opciones disponibles.
                                </ListGroup.Item>
                                <ListGroup.Item className="bg-transparent border-0 ps-0">
                                    <span className="me-2">🔹</span>
                                    Gestiona las HHEE y Exporta la informacion.
                                </ListGroup.Item>
                                <ListGroup.Item className="bg-transparent border-0 ps-0">
                                    <span className="me-2">🔹</span>
                                    Consulta las metricas de carga de HHEE.
                                </ListGroup.Item>
                            </ListGroup>
                        </div>
                    </Card.Body>
                </Card>
            </Container>
        );
    }

    // ========================================================================
    // VISTA SUPERVISOR
    // ========================================================================
    if (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') {
        const sinCobertura = coberturaGlobal.filter(c => c.analistas_activos === 0);
        const conCobertura = coberturaGlobal.filter(c => c.analistas_activos > 0);
        const cerradas = coberturaGlobal.filter(c => c.estado === 'CERRADA');

        return (
            <Container fluid className="p-4">
                {/* CABECERA */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h3 className="fw-bold mb-0">Tablero de Control</h3>
                        {lastUpdated && (
                            <small className="text-muted" style={{fontSize:'0.75rem'}}>
                                Última actualización: {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} &nbsp;
                                <span className="spinner-grow spinner-grow-sm text-success" role="status" style={{width:'6px', height:'6px'}}></span>
                            </small>
                        )}
                    </div>
                    <Button variant="outline-primary" size="sm" onClick={() => cargarDatosDashboard()}>Actualizar</Button>
                </div>

                {/* KPIs compactos + Radar de Cobertura (Semáforo) + Botones de Gestión */}
                <Row className="g-2 mb-3 align-items-center">
                    <Col xs={12} md={3}>
                        {renderIncidentWidgetsSupervisor()}
                    </Col>

                    <Col xs={12} md={6}>
                        <Card className="shadow-sm border-0 h-100">
                            <Card.Body className="py-2 px-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h6 className="mb-0 fw-bold text-muted small">📡 RADAR DE COBERTURA</h6>
                                    <div className="d-flex gap-2">
                                        <Badge bg="danger" className="fw-normal">🔴 {sinCobertura.length}</Badge>
                                        <Badge bg="success" className="fw-normal">🟢 {conCobertura.length}</Badge>
                                        <Badge bg="secondary" className="fw-normal">⚫ {cerradas.length}</Badge>
                                    </div>
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                    {sinCobertura.map(c => (
                                        <OverlayTrigger key={c.campana_id} placement="top" overlay={<Tooltip>Sin analistas ⚠️</Tooltip>}>
                                            <Badge bg="danger" className="p-2 shadow-sm animate__animated animate__pulse animate__infinite" style={{fontSize:'0.75rem', cursor:'default'}}>
                                                🚨 {c.nombre_campana}
                                            </Badge>
                                        </OverlayTrigger>
                                    ))}
                                    {conCobertura.map(c => (
                                        <OverlayTrigger key={c.campana_id} placement="top" overlay={<Tooltip><strong>Online:</strong> {c.nombres_analistas.join(', ') || '(sin datos)'}</Tooltip>}>
                                            <Badge bg="success" className="p-2 shadow-sm" style={{fontSize:'0.75rem', cursor:'help'}}>
                                                👥 {c.nombre_campana} ({c.analistas_activos})
                                            </Badge>
                                        </OverlayTrigger>
                                    ))}
                                    {cerradas.map(c => (
                                        <Badge key={c.campana_id} bg="secondary" className="p-2" style={{fontSize:'0.75rem', opacity:'0.6'}}>
                                            ⚫ {c.nombre_campana}
                                        </Badge>
                                    ))}
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col xs={12} md={3}>
                        <div className="d-flex flex-column gap-2 h-100">
                            <Button 
                                variant={cumplimientoCampanas.some(c => c.vencidas > 0) ? "danger" : "outline-primary"} 
                                className="w-100 py-2 shadow-sm d-flex justify-content-between align-items-center"
                                onClick={() => setShowRutinasModal(true)}
                            >
                                <span className="fw-bold">📊 Rutinas</span>
                                {cumplimientoCampanas.some(c => c.vencidas > 0) && <Badge bg="white" text="danger" pill>⚠️</Badge>}
                            </Button>
                            <Button 
                                variant="outline-secondary" 
                                className="w-100 py-2 shadow-sm d-flex justify-content-between align-items-center"
                                onClick={() => setShowDotacionModal(true)}
                            >
                                <span className="fw-bold">👥 Dotación</span>
                                <Badge bg="secondary" pill>{estadoAnalistas.length}</Badge>
                            </Button>
                        </div>
                    </Col>
                </Row>

                {/* ZONA PRINCIPAL: Entregables y Pulso Operacional */}
                <Row className="g-3">
                    <Col lg={7}>
                        <div className="mb-3">
                            <EntregablesWidget role={user.role} />
                        </div>
                    </Col>
                    <Col lg={5}>
                        <WidgetAlertasSupervisor />
                    </Col>
                </Row>

                {/* MODALES SUPERVISOR */}
                <Modal show={showRutinasModal} onHide={() => setShowRutinasModal(false)} size="lg" centered>
                    <Modal.Header closeButton className="bg-light shadow-sm">
                        <Modal.Title className="h6 fw-bold">📊 Cumplimiento de Rutinas (Hoy)</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-0">
                        <Table hover className="mb-0 align-middle">
                            <thead className="bg-light small text-muted">
                                <tr><th className="ps-3">Campaña</th><th>Estado</th><th className="pe-3 text-end">Avance</th></tr>
                            </thead>
                            <tbody>
                                {cumplimientoCampanas.map(c => (
                                    <tr key={c.id} onClick={() => { navigate(c.tarea_id ? `/tareas/${c.tarea_id}` : '/tareas/'); setShowRutinasModal(false); }} style={{cursor:'pointer'}}>
                                        <td className="ps-3 fw-semibold">
                                            {c.nombre}
                                            {c.vencidas > 0 && <Badge bg="danger" className="ms-2" style={{fontSize:'0.6em'}}>{c.vencidas} Vencidas</Badge>}
                                        </td>
                                        <td>
                                            {!c.tiene_tareas ? <Badge bg="light" text="muted" className="border fw-normal">Sin gestión iniciada</Badge> : 
                                            <ProgressBar style={{height: '6px'}}>
                                                <ProgressBar variant={c.avance === 100 ? 'success' : (c.vencidas > 0 ? 'danger' : 'primary')} now={c.avance} />
                                            </ProgressBar>}
                                        </td>
                                        <td className="pe-3 text-end fw-bold text-muted">{c.tiene_tareas ? `${c.avance}%` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Modal.Body>
                </Modal>

                <Modal show={showDotacionModal} onHide={() => setShowDotacionModal(false)} size="md" centered>
                    <Modal.Header closeButton className="bg-light shadow-sm">
                        <Modal.Title className="h6 fw-bold">👥 Estado de Dotación</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="p-0" style={{maxHeight:'70vh', overflowY:'auto'}}>
                        <Table hover className="mb-0 align-middle">
                            <tbody>
                                {estadoAnalistas.map(a => (
                                    <tr key={a.id} onClick={() => { navigate(`/analistas/${a.id}`); setShowDotacionModal(false); }} style={{cursor:'pointer'}}>
                                        <td className="ps-3">
                                            <div className="d-flex align-items-center">
                                                <div className={`rounded-circle d-flex justify-content-center align-items-center text-white me-2 shadow-sm ${a.estado === 'ACTIVO' ? 'bg-success' : 'bg-secondary'}`} style={{width:'28px', height:'28px', fontSize:'0.75rem'}}>
                                                    {a.nombre.charAt(0)}
                                                </div>
                                                <span className={a.estado === 'LIBRE' ? 'text-muted' : 'fw-semibold'}>{a.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="text-end pe-3">
                                            {a.estado === 'ACTIVO' ? (
                                                <div className="d-flex flex-wrap justify-content-end gap-1">
                                                    {a.campanas.map((c, i) => <Badge key={i} bg="success" className="fw-normal" style={{fontSize:'0.65rem'}}>{c}</Badge>)}
                                                </div>
                                            ) : <Badge bg="light" text="secondary" className="border fw-normal small">Inactivo / Libre</Badge>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </Modal.Body>
                </Modal>

                {/* FAB NUEVA INCIDENCIA */}
                <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1050 }}>
                    <OverlayTrigger placement="left" overlay={<Tooltip>Registrar Evento</Tooltip>}>
                        <Button 
                            variant="warning" 
                            className="shadow-lg d-flex align-items-center justify-content-center border-0 rounded-pill px-4 py-3 text-dark fw-bold"
                            style={{
                                background: 'linear-gradient(135deg, #ffc107, #ff9800)',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            onClick={() => setShowRegistroModalSup(true)}
                        >
                            <span style={{fontSize: '1.5rem'}} className="me-2">⚡</span> Registrar Evento
                        </Button>
                    </OverlayTrigger>
                </div>

                <Modal show={showRegistroModalSup} onHide={() => setShowRegistroModalSup(false)} centered size="md">
                    <Modal.Header closeButton className="border-0 pb-0">
                        <Modal.Title className="h6 text-muted"><i className="bi bi-lightning-charge-fill text-warning me-2"></i>Nueva Incidencia Rápida</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="pt-0">
                        <PanelRegistroWidget compact={false} />
                    </Modal.Body>
                </Modal>
            </Container>
        );
    }

    // ========================================================================
    // VISTA ANALISTA (CORREGIDA Y COMPACTA)
    // ========================================================================
    const campañasSinAnalistas = coberturaGlobal.filter(c => c.analistas_activos === 0);

    return (
        <Container fluid className="p-4">
            {/* CABECERA */}
            <div className="d-flex justify-content-between align-items-start mb-4">
                <div>
                    <h2 className="mb-0">Hola, {user.nombre}</h2>
                    <div className="d-flex align-items-center mt-1 mb-2">
                        <span className="text-muted me-2">Activo en:</span>
                        {misSesionesActivas.length > 0 ? (
                            misSesionesActivas.map((s, i) => <Badge key={i} bg="success" className="me-1">{s.campana.nombre}</Badge>)
                        ) : (
                            <Badge bg="secondary">Ninguna (Inicia sesión)</Badge>
                        )}
                    </div>
                </div>
                <div className="text-end">
                    {lastUpdated && (
                        <small className="text-muted d-block mb-1" style={{fontSize:'0.75rem'}}>
                            Actualizó: {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </small>
                    )}
                    <Button variant="outline-secondary" size="sm" onClick={() => cargarDatosDashboard(true)}>🔄 Actualizar</Button>
                </div>
            </div>

            {/* ZONA PRINCIPAL: FLUJO VERTICAL */}
            <Row className="g-4">
                
                {/* COLUMNA IZQUIERDA (60%) */}
                <Col lg={7}>
                    {/* 1. OPORTUNIDADES DE COLABORACIÓN */}
                    <Card className="shadow-sm border-0 border-start border-danger border-4 mb-4">
                        <Card.Header className="bg-white fw-bold text-danger d-flex justify-content-between align-items-center py-3">
                            <span>🤝 Oportunidades de Colaboración</span>
                            <Badge bg="danger" pill>{campañasSinAnalistas.length}</Badge>
                        </Card.Header>
                        <Card.Body className="py-2">
                            {campañasSinAnalistas.length > 0 ? (
                                <div className="d-flex flex-wrap gap-2 py-2">
                                    {campañasSinAnalistas.map(c => (
                                        <Badge 
                                            bg="danger" 
                                            className="d-flex align-items-center p-2 px-3 shadow-sm border border-danger fw-normal" 
                                            key={c.campana_id}
                                            style={{fontSize: '0.85rem'}}
                                        >
                                            <span className="me-2 fs-6">🚨</span> {c.nombre_campana}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-success d-flex align-items-center py-2">
                                    <span className="fs-5 me-2">✅</span> <span className="small fw-semibold">¡Todo cubierto! Excelente trabajo de equipo.</span>
                                </div>
                            )}
                        </Card.Body>
                    </Card>

                    {/* 2. MIS ENTREGABLES */}
                    <div className="mb-4">
                        <EntregablesWidget role={user.role} />
                    </div>

                    {/* 3. MIS INCIDENCIAS */}
                    <div className="mb-4" style={{maxHeight:'500px', overflowY:'auto'}}>
                         <MisIncidenciasWidget incidencias={misIncidencias} loading={loading} />
                    </div>
                </Col>

                {/* COLUMNA DERECHA (40%): ALERTAS Y BOTÓN ACTIVIDAD */}
                <Col lg={5}>
                    <div className="d-grid gap-3 mb-4">
                        <Button variant="primary" className="py-3 shadow-sm fw-bold border-0" onClick={() => setShowCampaignModal(true)} style={{background: 'linear-gradient(135deg, #0d6efd, #0a58ca)'}}>
                            🔄 Gestionar mi Actividad
                        </Button>
                    </div>
                    <WidgetAlertas variant="main" />
                </Col>
            </Row>

            {/* FAB NUEVA INCIDENCIA */}
            <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1050 }}>
                <OverlayTrigger placement="left" overlay={<Tooltip>Registrar Evento</Tooltip>}>
                    <Button 
                        variant="warning" 
                        className="shadow-lg d-flex align-items-center justify-content-center border-0 rounded-pill px-4 py-3 text-dark fw-bold"
                        style={{
                            background: 'linear-gradient(135deg, #ffc107, #ff9800)',
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        onClick={() => setShowRegistroModal(true)}
                    >
                        <span style={{fontSize: '1.5rem'}} className="me-2">⚡</span> Registrar Evento
                    </Button>
                </OverlayTrigger>
            </div>

            <Modal show={showRegistroModal} onHide={() => setShowRegistroModal(false)} centered size="md">
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="h6 text-muted"><i className="bi bi-lightning-charge-fill text-warning me-2"></i>Nueva Incidencia Rápida</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-0">
                    <PanelRegistroWidget compact={false} />
                </Modal.Body>
            </Modal>

            <CampaignSelector 
                show={showCampaignModal} 
                handleClose={() => setShowCampaignModal(false)}
                onUpdate={cargarDatosDashboard} 
            />
        </Container>
    );
}

export default DashboardPage;