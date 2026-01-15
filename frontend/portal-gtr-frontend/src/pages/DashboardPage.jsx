// RUTA: src/pages/DashboardPage.jsx

import React, { useEffect, useState, useRef } from 'react';
import { Container, Row, Col, Card, Badge, Table, Button, ProgressBar, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL, fetchWithAuth } from '../api'; 
import { useNavigate } from 'react-router-dom';

// Widgets
import PanelRegistroWidget from '../components/dashboard/PanelRegistroWidget';
import MisIncidenciasWidget from '../components/dashboard/MisIncidenciasWidget';
import WidgetAlertas from '../components/dashboard/WidgetAlertas'; 
import CampaignSelector from '../components/dashboard/CampaignSelector';

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

    // Estados Supervisor
    const [cumplimientoCampanas, setCumplimientoCampanas] = useState([]);
    const [estadoAnalistas, setEstadoAnalistas] = useState([]);

    // Bandera para asegurar que solo cargue una vez (Fix Bucle Infinito)
    const dataLoaded = useRef(false);

    useEffect(() => {
        // Solo cargamos si tenemos usuario y NO hemos cargado antes
        if (user?.id && !dataLoaded.current) {
            cargarDatosDashboard();
            dataLoaded.current = true; // 🔒 Bloqueamos futuras cargas automáticas
        }
    }, [user?.id]);

    const cargarDatosDashboard = async () => {
        setLoading(true);
        try {
            // 1. Datos Comunes (Stats y Cobertura)
            // Solo los cargamos si el usuario NO es Supervisor de Operaciones (ellos no usan estos widgets)
            if (user.role !== 'SUPERVISOR_OPERACIONES') {
                const [resStats, resCobertura] = await Promise.all([
                    fetchWithAuth(`${API_BASE_URL}/gtr/dashboard/stats`),
                    fetchWithAuth(`${API_BASE_URL}/gtr/sesiones/cobertura`)
                ]);

                if (resStats.ok) setStatsIncidencias(await resStats.json());
                
                var dataCobertura = [];
                if (resCobertura.ok) {
                    dataCobertura = await resCobertura.json();
                    setCoberturaGlobal(dataCobertura);
                }
            }

            // 2. Carga de datos específicos según rol
            if (user.role === 'ANALISTA') {
                await cargarDatosEspecificosAnalista(dataCobertura);
            } else if (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') {
                await cargarDatosEspecificosSupervisor(dataCobertura);
            }
            // Si es SUPERVISOR_OPERACIONES, no hacemos nada más aquí.

        } catch (error) { console.error("Error dashboard", error); } 
        finally { setLoading(false); }
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
            return { id: c.campana_id, nombre: c.nombre_campana, avance: porcentaje, tiene_tareas: tareasCampaña.length > 0, vencidas };
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
    // WIDGETS DE INCIDENCIAS SUPERVISOR (COMPLETO)
    // ========================================================================
    const renderIncidentWidgetsSupervisor = () => (
        <Row className="g-2 mb-3">
            <Col xs={6} md={3}>
                <Card className="bg-danger text-white text-center shadow-sm h-100 py-1 action-hover" style={{cursor: 'pointer'}} onClick={() => navigate('/control-incidencias?estado=ABIERTA&estado=EN_PROGRESO')}>
                    <Card.Body className="p-2">
                        <h4 className="mb-0 fw-bold">{statsIncidencias?.total_incidencias_activas || 0}</h4>
                        <small style={{fontSize:'0.75rem'}}>Incidencias Activas 👆</small>
                    </Card.Body>
                </Card>
            </Col>
            <Col xs={6} md={3}>
                <Card className="bg-warning text-dark text-center shadow-sm h-100 py-1 action-hover" style={{cursor: 'pointer'}} onClick={() => navigate('/control-incidencias?estado=ABIERTA&asignado=false')}>
                    <Card.Body className="p-2">
                        <h4 className="mb-0 fw-bold">{statsIncidencias?.incidencias_sin_asignar || 0}</h4>
                        <small style={{fontSize:'0.75rem'}}>Sin Asignar 👆</small>
                    </Card.Body>
                </Card>
            </Col>
            <Col xs={6} md={3}>
                <Card className="bg-success text-white text-center shadow-sm h-100 py-1">
                    <Card.Body className="p-2">
                        <h4 className="mb-0 fw-bold">{statsIncidencias?.incidencias_cerradas_hoy || 0}</h4>
                        <small style={{fontSize:'0.75rem'}}>Cerradas Hoy</small>
                    </Card.Body>
                </Card>
            </Col>
            <Col xs={6} md={3}>
                <Card className="bg-info text-white text-center shadow-sm h-100 py-1">
                    <Card.Body className="p-2">
                        <h4 className="mb-0 fw-bold">{estadoAnalistas.filter(a=>a.estado === 'ACTIVO').length} / {estadoAnalistas.length}</h4>
                        <small style={{fontSize:'0.75rem'}}>Dotación Online</small>
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    );

    // ========================================================================
    // VISTA SUPERVISOR Y RESPONSABLE
    // ========================================================================
    if (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') {
        const sinCobertura = coberturaGlobal.filter(c => c.analistas_activos === 0);
        const conCobertura = coberturaGlobal.filter(c => c.analistas_activos > 0);

        return (
            <Container fluid className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h3 className="fw-bold mb-0">Tablero de Control</h3>
                    <Button variant="outline-primary" size="sm" onClick={cargarDatosDashboard}>Actualizar</Button>
                </div>

                {renderIncidentWidgetsSupervisor()}

                <div className="mb-4">
                    <h6 className="text-muted fw-bold mb-2">📡 Radar de Cobertura</h6>
                    {sinCobertura.length > 0 && (
                        <Row className="g-2 mb-3">
                            {sinCobertura.map(c => (
                                <Col md={2} sm={4} key={c.campana_id}>
                                    <Card className="bg-danger text-white shadow h-100 animate__animated animate__pulse animate__infinite">
                                        <Card.Body className="text-center p-2">
                                            <div className="fs-3 mb-1">🚨</div>
                                            <div className="fw-bold text-truncate" title={c.nombre_campana} style={{fontSize:'0.9rem'}}>{c.nombre_campana}</div>
                                            <Badge bg="white" text="danger" style={{fontSize:'0.6rem'}}>DESCUBIERTA</Badge>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}
                    <Row className="g-2">
                        {conCobertura.map(c => (
                            <Col md={2} sm={4} key={c.campana_id}>
                                <OverlayTrigger placement="top" overlay={<Tooltip id={`tooltip-${c.campana_id}`}><strong>Analistas conectados:</strong>{c.nombres_analistas.length > 0 ? c.nombres_analistas.map(n => <div key={n} style={{textAlign:'left'}}>• {n}</div>) : <div>(Sin datos)</div>}</Tooltip>}>
                                    <Card className="border-success bg-light shadow-sm h-100" style={{cursor:'help'}}>
                                        <Card.Body className="p-2 text-center">
                                            <div className="fw-bold text-success text-truncate" title={c.nombre_campana} style={{fontSize:'0.9rem'}}>{c.nombre_campana}</div>
                                            <small className="text-muted d-block" style={{fontSize:'0.75rem'}}>👥 {c.analistas_activos} Analistas</small>
                                        </Card.Body>
                                    </Card>
                                </OverlayTrigger>
                            </Col>
                        ))}
                    </Row>
                </div>

                <Row className="g-3">
                    <Col lg={7}>
                        <Card className="shadow-sm border-0 h-100">
                            <Card.Header className="bg-white fw-bold">📊 Cumplimiento de Rutinas (Hoy)</Card.Header>
                            <Card.Body className="p-0 overflow-auto" style={{maxHeight: '400px'}}>
                                <Table hover className="mb-0 align-middle">
                                    <thead className="bg-light small text-muted">
                                        <tr><th className="ps-3">Campaña</th><th>Estado</th><th className="pe-3 text-end">Avance</th></tr>
                                    </thead>
                                    <tbody>
                                        {cumplimientoCampanas.map(c => (
                                            <tr key={c.id}>
                                                <td className="ps-3 fw-semibold">
                                                    {c.nombre}
                                                    {c.vencidas > 0 && <Badge bg="danger" className="ms-2" style={{fontSize:'0.6em'}}>{c.vencidas} Vencidas</Badge>}
                                                </td>
                                                <td>
                                                    {!c.tiene_tareas ? <Badge bg="light" text="muted" className="border fw-normal">Sin gestión iniciada</Badge> : 
                                                    <ProgressBar style={{height: '6px', minWidth: '100px'}}>
                                                        <ProgressBar variant={c.avance === 100 ? 'success' : (c.vencidas > 0 ? 'danger' : 'primary')} now={c.avance} />
                                                    </ProgressBar>}
                                                </td>
                                                <td className="pe-3 text-end fw-bold text-muted">{c.tiene_tareas ? `${c.avance}%` : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg={5}>
                        <Card className="shadow-sm border-0 h-100">
                            <Card.Header className="bg-white fw-bold d-flex justify-content-between">
                                <span>👥 Dotación</span>
                                <Badge bg="light" text="dark" className="border">Total: {estadoAnalistas.length}</Badge>
                            </Card.Header>
                            <Card.Body className="p-0 overflow-auto" style={{maxHeight: '400px'}}>
                                <Table hover className="mb-0 align-middle">
                                    <tbody>
                                        {estadoAnalistas.map(a => (
                                            <tr key={a.id}>
                                                <td className="ps-3">
                                                    <div className="d-flex align-items-center">
                                                        <div className={`rounded-circle d-flex justify-content-center align-items-center text-white me-2 shadow-sm ${a.estado === 'ACTIVO' ? 'bg-success' : 'bg-secondary'}`} style={{width:'30px', height:'30px', fontSize:'0.8rem'}}>
                                                            {a.nombre.charAt(0)}
                                                        </div>
                                                        <span className={a.estado === 'LIBRE' ? 'text-muted' : 'fw-semibold'}>{a.nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="text-end pe-3">
                                                    {a.estado === 'ACTIVO' ? (
                                                        <div className="d-flex flex-wrap justify-content-end gap-1">
                                                            {a.campanas.map((c, i) => <Badge key={i} bg="success" className="fw-normal">{c}</Badge>)}
                                                        </div>
                                                    ) : <Badge bg="light" text="secondary" className="border fw-normal">Inactivo / Libre</Badge>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
                
                <Row className="mt-4">
                    <Col>
                        <Card className="shadow-sm border-0 bg-light">
                            <Card.Body>
                                <h6 className="text-muted mb-3">📝 Registro Rápido de Incidencias</h6>
                                <PanelRegistroWidget />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        );
    }

    // ========================================================================
    // VISTA SUPERVISOR DE OPERACIONES (NUEVA INTERCEPCIÓN)
    // ========================================================================
    if (user.role === 'SUPERVISOR_OPERACIONES') {
        return (
            <Container fluid className="p-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
                <div className="text-center animate__animated animate__fadeIn">
                    <div className="mb-4">
                        <span style={{ fontSize: '4rem' }}>🛠️</span>
                    </div>
                    <h1 className="display-5 fw-bold text-dark mb-3">Panel de Operaciones</h1>
                    <p className="lead text-muted mb-4">
                        Bienvenido al módulo de gestión operativa.
                    </p>
                    <Card className="shadow-sm border-0 bg-light d-inline-block text-start" style={{ maxWidth: '600px' }}>
                        <Card.Body className="p-4">
                            <h6 className="fw-bold mb-3">Accesos Directos:</h6>
                            <ul className="mb-0 text-muted">
                                <li className="mb-2">Utiliza el menú GESTION HHEE para acceder a las opciones disponibles .</li>
                                <li className="mb-2">Gestiona las <strong>HHEE</strong> y Exporta la informacion .</li>
                                <li>Consulta las metricas de carga de HHEE.</li>
                            </ul>
                        </Card.Body>
                    </Card>
                </div>
            </Container>
        );
    }

    // ========================================================================
    // VISTA ANALISTA (POR DEFECTO)
    // ========================================================================
    const campañasSinAnalistas = coberturaGlobal.filter(c => c.analistas_activos === 0);

    return (
        <Container fluid className="p-4">
            {/* CABECERA */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-0">Hola, {user.nombre}</h2>
                    <div className="d-flex align-items-center mt-1">
                        <span className="text-muted me-2">Activo en:</span>
                        {misSesionesActivas.length > 0 ? (
                            misSesionesActivas.map((s, i) => <Badge key={i} bg="success" className="me-1">{s.campana.nombre}</Badge>)
                        ) : (
                            <Badge bg="secondary">Ninguna (Inicia sesión)</Badge>
                        )}
                    </div>
                </div>
                <Button variant="primary" onClick={() => setShowCampaignModal(true)} className="shadow-sm">
                    🔄 Gestionar mi Actividad
                </Button>
            </div>

            {/* 1. OPORTUNIDADES DE COLABORACIÓN (COMPACTAS) */}
            <Row className="mb-4">
                <Col xs={12}>
                    <Card className="shadow-sm border-0 border-start border-danger border-4">
                        <Card.Header className="bg-white fw-bold text-danger d-flex justify-content-between align-items-center">
                            <span>🤝 Oportunidades de Colaboración (Campañas sin Analistas)</span>
                            <Badge bg="danger">{campañasSinAnalistas.length}</Badge>
                        </Card.Header>
                        <Card.Body className="py-2">
                            {campañasSinAnalistas.length > 0 ? (
                                <Row className="g-2">
                                    {/* MÁS PEQUEÑAS: xs=6 md=3 lg=2 */}
                                    {campañasSinAnalistas.map(c => (
                                        <Col xs={6} md={3} lg={2} key={c.campana_id}>
                                            <Card className="bg-danger text-white shadow-sm h-100 animate__animated animate__pulse animate__infinite border-0">
                                                <Card.Body className="text-center p-2">
                                                    <div className="fs-4 mb-1">🚨</div>
                                                    <div className="fw-bold text-truncate small" title={c.nombre_campana}>
                                                        {c.nombre_campana}
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            ) : (
                                <div className="text-success d-flex align-items-center">
                                    <span className="fs-5 me-2">✅</span> <span>¡Todo cubierto! Excelente trabajo de equipo.</span>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* 2. ZONA PRINCIPAL */}
            <Row className="g-4 mb-4">
                
                {/* COLUMNA IZQUIERDA (40%) */}
                <Col lg={5}>
                    
                    {/* WIDGETS COMPACTOS PERSONALIZADOS (SOLO ACTIVAS Y SIN ASIGNAR) */}
                    <Row className="g-2 mb-3">
                        <Col xs={6}>
                            <Card 
                                className="bg-danger text-white text-center shadow-sm h-100 py-1 action-hover" 
                                style={{cursor: 'pointer'}} 
                                onClick={() => navigate('/control-incidencias?estado=ABIERTA&estado=EN_PROGRESO')}
                            >
                                <Card.Body className="p-2 d-flex flex-column justify-content-center">
                                    <h5 className="mb-0 fw-bold">{statsIncidencias?.total_incidencias_activas || 0}</h5>
                                    <small style={{fontSize:'0.65rem'}}>Incidencias Activas</small>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xs={6}>
                            <Card 
                                className="bg-warning text-dark text-center shadow-sm h-100 py-1 action-hover" 
                                style={{cursor: 'pointer'}} 
                                onClick={() => navigate('/control-incidencias?estado=ABIERTA&asignado=false')}
                            >
                                <Card.Body className="p-2 d-flex flex-column justify-content-center">
                                    <h5 className="mb-0 fw-bold">{statsIncidencias?.incidencias_sin_asignar || 0}</h5>
                                    <small style={{fontSize:'0.65rem'}}>Sin Asignar</small>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                    
                    <Card className="shadow-sm border-0 bg-light mb-3">
                        <Card.Body className="py-2 px-3">
                            <h6 className="text-muted small mb-2">⚡ Nueva Incidencia</h6>
                            <PanelRegistroWidget compact={true} />
                        </Card.Body>
                    </Card>

                    <div style={{maxHeight:'400px', overflowY:'auto'}}>
                         <MisIncidenciasWidget incidencias={misIncidencias} loading={loading} />
                    </div>
                </Col>

                {/* COLUMNA DERECHA (60%): WIDGET ALERTAS (MAIN MODE) */}
                <Col lg={7}>
                    <WidgetAlertas variant="main" />
                </Col>
            </Row>

            <CampaignSelector 
                show={showCampaignModal} 
                handleClose={() => setShowCampaignModal(false)}
                onUpdate={cargarDatosDashboard} 
            />
        </Container>
    );
}

export default DashboardPage;