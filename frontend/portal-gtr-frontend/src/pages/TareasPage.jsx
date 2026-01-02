// RUTA: src/pages/TareasPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, ProgressBar, Button, Card, Row, Col, Form, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../api';

const TareasPage = () => {
    const navigate = useNavigate();
    
    // --- ESTADOS ---
    const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]); 
    const [campanaFiltro, setCampanaFiltro] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState('');
    
    const [tareas, setTareas] = useState([]);
    const [campanas, setCampanas] = useState([]);
    const [rowsToDisplay, setRowsToDisplay] = useState([]); // Nueva lista combinada
    const [loading, setLoading] = useState(true);

    // Carga inicial de Campañas
    useEffect(() => {
        cargarCampanas();
    }, []);

    // Recargar tareas al cambiar filtros
    useEffect(() => {
        cargarTareas();
    }, [fechaFiltro, campanaFiltro, estadoFiltro]);

    // --- LÓGICA DE FUSIÓN (EL CEREBRO NUEVO) ---
    useEffect(() => {
        if (loading) return;

        let combinedRows = [...tareas];

        // Solo agregamos las "Fantasmas" si estamos viendo el día de HOY y no hay filtros restrictivos
        const esHoy = fechaFiltro === new Date().toISOString().split('T')[0];
        const filtroEstadoPermiteVerPendientes = estadoFiltro === '' || estadoFiltro === 'PENDIENTE';

        if (esHoy && filtroEstadoPermiteVerPendientes) {
            // 1. Identificar qué campañas YA tienen tarea
            const idsCampanasConTarea = new Set(tareas.map(t => t.campana_id));

            // 2. Buscar campañas que FALTAN
            const campanasFaltantes = campanas.filter(c => {
                // Si el usuario filtró por una campaña específica, solo revisamos esa
                if (campanaFiltro && parseInt(campanaFiltro) !== c.id) return false;
                
                // Si la campaña ya tiene tarea, la ignoramos (ya está en la lista 'tareas')
                return !idsCampanasConTarea.has(c.id);
            });

            // 3. Crear objetos "Fantasma" para las faltantes
            const filasFantasma = campanasFaltantes.map(c => ({
                id: `ghost-${c.id}`, // ID falso
                es_fantasma: true,   // Bandera para identificarla
                campana: c,
                titulo: `Rutina Diaria - ${c.nombre}`,
                progreso: 'SIN_GESTION', // Estado especial
                analista: null
            }));

            // 4. Agregar al principio de la lista (Son Urgentes)
            combinedRows = [...filasFantasma, ...combinedRows];
        }

        setRowsToDisplay(combinedRows);

    }, [tareas, campanas, fechaFiltro, campanaFiltro, estadoFiltro, loading]);


    const cargarCampanas = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/campanas/listado-simple/`);
            if (res.ok) setCampanas(await res.json());
        } catch (error) { console.error("Error cargando campañas"); }
    };

    const cargarTareas = async () => {
        setLoading(true);
        try {
            let url = `${API_BASE_URL}/gtr/monitor/tareas?fecha=${fechaFiltro}`;
            if (campanaFiltro) url += `&campana_id=${campanaFiltro}`;
            if (estadoFiltro) url += `&estado=${estadoFiltro}`;

            const response = await fetchWithAuth(url);
            if (response.ok) {
                const data = await response.json();
                // Ordenar tareas reales: Prioridad Vencidas
                const sorted = data.sort((a, b) => {
                    const statsA = analizarProgreso(a.checklist_items);
                    const statsB = analizarProgreso(b.checklist_items);
                    if (statsB.late !== statsA.late) return statsB.late - statsA.late;
                    return statsA.pctOk - statsB.pctOk;
                });
                setTareas(sorted);
            }
        } catch (error) {
            console.error("Error cargando tareas:", error);
        } finally {
            setLoading(false);
        }
    };

    const analizarProgreso = (items) => {
        if (!items || items.length === 0) return { pctOk: 0, late: 0, pending: 0 };
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        let ok = 0, late = 0, pending = 0;

        items.forEach(item => {
            if (item.completado) ok++;
            else if (item.hora_sugerida) {
                const [h, m] = item.hora_sugerida.toString().substring(0, 5).split(':').map(Number);
                if ((currentMinutes - (h * 60 + m)) > 15) late++;
                else pending++;
            } else pending++;
        });
        const total = items.length;
        return { pctOk: (ok / total) * 100, pctLate: (late / total) * 100, pctPending: (pending / total) * 100, ok, late, pending };
    };

    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">🛡️ Monitor de Cumplimiento</h2>
                <div className="d-flex gap-2">
                    <Button variant="outline-primary" onClick={cargarTareas}>🔄 Refrescar</Button>
                </div>
            </div>

            {/* FILTROS */}
            <Card className="shadow-sm border-0 mb-4 bg-light">
                <Card.Body className="py-3">
                    <Row className="g-3 align-items-end">
                        <Col md={3}>
                            <Form.Label className="small text-muted fw-bold">Fecha de Gestión</Form.Label>
                            <Form.Control type="date" value={fechaFiltro} onChange={(e) => setFechaFiltro(e.target.value)} />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="small text-muted fw-bold">Campaña</Form.Label>
                            <Form.Select value={campanaFiltro} onChange={(e) => setCampanaFiltro(e.target.value)}>
                                <option value="">Todas las campañas</option>
                                {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </Form.Select>
                        </Col>
                        <Col md={3}>
                            <Form.Label className="small text-muted fw-bold">Estado</Form.Label>
                            <Form.Select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="EN_PROGRESO">En Progreso</option>
                                <option value="COMPLETADA">Completada</option>
                            </Form.Select>
                        </Col>
                        <Col md={3} className="text-end">
                            <div className="mb-2 text-muted small">Resultados</div>
                            <h4 className="mb-0 text-primary fw-bold">{rowsToDisplay.length} <span className="fs-6 text-muted fw-normal">rutinas</span></h4>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* TABLA */}
            <Card className="shadow-sm border-0">
                {loading ? (
                    <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                ) : (
                    <Table hover responsive className="mb-0 align-middle">
                        <thead className="bg-white text-muted small text-uppercase">
                            <tr>
                                <th className="ps-4">Estado</th>
                                <th>Campaña</th>
                                <th>Analista / Equipo</th>
                                <th>Rutina / Tarea</th>
                                <th style={{width: '25%'}}>Progreso y Riesgo</th>
                                <th className="text-end pe-4">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rowsToDisplay.length > 0 ? (
                                rowsToDisplay.map(tarea => {
                                    
                                    // --- RENDERIZADO DE FILA "FANTASMA" (SIN GESTIÓN) ---
                                    if (tarea.es_fantasma) {
                                        return (
                                            <tr key={tarea.id} className="table-danger" style={{borderLeft: '4px solid #dc3545'}}>
                                                <td className="ps-4">
                                                    <Badge bg="danger" className="fw-normal px-2 py-1 animate__animated animate__pulse animate__infinite">
                                                        🚨 SIN GESTIÓN
                                                    </Badge>
                                                </td>
                                                <td className="fw-bold text-danger">{tarea.campana?.nombre}</td>
                                                <td>
                                                    <span className="text-muted fst-italic">🚫 Nadie conectado</span>
                                                </td>
                                                <td>
                                                    <div className="fw-bold text-secondary">{tarea.titulo}</div>
                                                    <div className="small text-danger">⚠️ Requiere atención inmediata</div>
                                                </td>
                                                <td>
                                                    <ProgressBar now={0} style={{height: '10px', backgroundColor: '#e9ecef'}} />
                                                </td>
                                                <td className="text-end pe-4">
                                                    <Button size="sm" variant="outline-secondary" disabled>
                                                        Pendiente de Inicio
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // --- RENDERIZADO DE TAREA REAL ---
                                    const stats = analizarProgreso(tarea.checklist_items);
                                    let badgeBg = 'secondary';
                                    if (tarea.progreso === 'COMPLETADA') badgeBg = 'success';
                                    else if (tarea.progreso === 'EN_PROGRESO') badgeBg = 'primary';
                                    else if (tarea.progreso === 'PENDIENTE') badgeBg = 'warning';

                                    const renderTooltip = (props) => (
                                        <Tooltip id={`tooltip-${tarea.id}`} {...props}>
                                            <div className="text-start">
                                                <div>✅ Realizadas: {stats.ok}</div>
                                                <div className="text-danger">⚠️ Vencidas: {stats.late}</div>
                                                <div>⏳ En tiempo: {stats.pending}</div>
                                            </div>
                                        </Tooltip>
                                    );

                                    return (
                                        <tr key={tarea.id}>
                                            <td className="ps-4">
                                                <Badge bg={badgeBg} className="fw-normal px-2 py-1">
                                                    {tarea.progreso.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="fw-bold text-dark">{tarea.campana?.nombre}</td>
                                            <td>
                                                {tarea.analista ? (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-primary text-white rounded-circle d-flex justify-content-center align-items-center shadow-sm" style={{width: 32, height: 32, fontSize: '0.8rem'}}>
                                                            {tarea.analista.nombre.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="fw-semibold" style={{fontSize:'0.9rem'}}>{tarea.analista.nombre} {tarea.analista.apellido}</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="d-flex align-items-center gap-2 text-secondary">
                                                        <div className="bg-light border text-secondary rounded-circle d-flex justify-content-center align-items-center" style={{width: 32, height: 32}}>
                                                            <i className="bi bi-people-fill"></i>
                                                        </div>
                                                        <span className="fst-italic small">👥 Equipo Operativo</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="fw-bold text-dark">{tarea.titulo}</div>
                                                <div className="mt-1">
                                                    {tarea.es_generada_automaticamente ? 
                                                        <Badge bg="light" text="secondary" className="border fw-normal">🤖 Automática</Badge> : 
                                                        <Badge bg="info" className="fw-normal">👤 Manual</Badge>
                                                    }
                                                </div>
                                            </td>
                                            <td>
                                                <OverlayTrigger placement="top" overlay={renderTooltip}>
                                                    <div style={{cursor: 'help'}}>
                                                        <div className="d-flex justify-content-between small text-muted mb-1">
                                                            <span>{Math.round(stats.pctOk)}%</span>
                                                            {stats.late > 0 && <span className="text-danger fw-bold">{stats.late} Vencidas</span>}
                                                        </div>
                                                        <ProgressBar style={{height: '10px', backgroundColor: '#e9ecef'}}>
                                                            <ProgressBar variant="success" now={stats.pctOk} key={1} />
                                                            <ProgressBar variant="danger" now={stats.pctLate} key={2} animated={stats.late > 0} />
                                                            <ProgressBar variant="info" now={stats.pctPending} key={3} />
                                                        </ProgressBar>
                                                    </div>
                                                </OverlayTrigger>
                                            </td>
                                            <td className="text-end pe-4">
                                                <Button size="sm" variant="outline-dark" onClick={() => navigate(`/tareas/${tarea.id}`)}>
                                                    Auditar
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-muted">
                                        <div style={{fontSize: '2rem'}}>📭</div>
                                        <div>No hay tareas (y todas las campañas están cubiertas).</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                )}
            </Card>
        </Container>
    );
};

export default TareasPage;