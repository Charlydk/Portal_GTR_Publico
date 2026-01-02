// RUTA: src/pages/TareasPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, ProgressBar, Button, Card, Row, Col, Form, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../api';

const TareasPage = () => {
    const navigate = useNavigate();
    
    // --- ESTADOS DE FILTROS ---
    const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]); // Hoy por defecto
    const [campanaFiltro, setCampanaFiltro] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState('');
    
    // --- DATOS ---
    const [tareas, setTareas] = useState([]);
    const [campanas, setCampanas] = useState([]);
    const [loading, setLoading] = useState(true);

    // Carga inicial de Campañas (para el select)
    useEffect(() => {
        cargarCampanas();
    }, []);

    // Cada vez que cambie un filtro, recargamos las tareas
    useEffect(() => {
        cargarTareas();
    }, [fechaFiltro, campanaFiltro, estadoFiltro]);

    const cargarCampanas = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/campanas/listado-simple/`);
            if (res.ok) setCampanas(await res.json());
        } catch (error) { console.error("Error cargando campañas"); }
    };

    // --- 🧠 CEREBRO DEL PROGRESO (Cálculo) ---
    const analizarProgreso = (items) => {
        if (!items || items.length === 0) {
            return { total: 0, ok: 0, late: 0, pending: 0, pctOk: 0, pctLate: 0, pctPending: 0 };
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        let ok = 0;
        let late = 0;
        let pending = 0;

        items.forEach(item => {
            if (item.completado) {
                ok++;
            } else if (item.hora_sugerida) {
                const [h, m] = item.hora_sugerida.toString().substring(0, 5).split(':').map(Number);
                const itemMinutes = h * 60 + m;
                const diff = currentMinutes - itemMinutes;

                if (diff > 15) { 
                    late++; // Vencido
                } else {
                    pending++; // En tiempo
                }
            } else {
                pending++;
            }
        });

        const total = items.length;
        return {
            total, ok, late, pending,
            pctOk: (ok / total) * 100,
            pctLate: (late / total) * 100,
            pctPending: (pending / total) * 100
        };
    };

    const cargarTareas = async () => {
        setLoading(true);
        try {
            // Usamos el endpoint con FILTROS (/monitor/tareas)
            let url = `${API_BASE_URL}/gtr/monitor/tareas?fecha=${fechaFiltro}`;
            if (campanaFiltro) url += `&campana_id=${campanaFiltro}`;
            if (estadoFiltro) url += `&estado=${estadoFiltro}`;

            const response = await fetchWithAuth(url);
            if (response.ok) {
                const data = await response.json();
                
                // --- ORDENAMIENTO INTELIGENTE ---
                const sorted = data.sort((a, b) => {
                    const statsA = analizarProgreso(a.checklist_items);
                    const statsB = analizarProgreso(b.checklist_items);

                    // 1. Prioridad: Cantidad de vencidas (Mayor a menor)
                    if (statsB.late !== statsA.late) {
                        return statsB.late - statsA.late;
                    }
                    
                    // 2. Prioridad: Porcentaje de cumplimiento (Menor a mayor - ver los más atrasados primero)
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

    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">🛡️ Monitor de Cumplimiento</h2>
                <div className="d-flex gap-2">
                    <Button variant="outline-primary" onClick={cargarTareas}>🔄 Refrescar</Button>
                </div>
            </div>

            {/* --- BARRA DE FILTROS (RECUPERADA) --- */}
            <Card className="shadow-sm border-0 mb-4 bg-light">
                <Card.Body className="py-3">
                    <Row className="g-3 align-items-end">
                        <Col md={3}>
                            <Form.Label className="small text-muted fw-bold">Fecha de Gestión</Form.Label>
                            <Form.Control 
                                type="date" 
                                value={fechaFiltro} 
                                onChange={(e) => setFechaFiltro(e.target.value)} 
                            />
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
                            <h4 className="mb-0 text-primary fw-bold">{tareas.length} <span className="fs-6 text-muted fw-normal">rutinas</span></h4>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* --- TABLA DE RESULTADOS --- */}
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
                                <th>Rutina</th>
                                <th style={{width: '25%'}}>Progreso y Riesgo</th> {/* Columna ancha para la barra */}
                                <th className="text-end pe-4">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tareas.length > 0 ? (
                                tareas.map(tarea => {
                                    // Calculamos stats para la barra
                                    const stats = analizarProgreso(tarea.checklist_items);
                                    
                                    let badgeBg = 'secondary';
                                    if (tarea.progreso === 'COMPLETADA') badgeBg = 'success';
                                    else if (tarea.progreso === 'EN_PROGRESO') badgeBg = 'primary';
                                    else if (tarea.progreso === 'PENDIENTE') badgeBg = 'warning';

                                    // Tooltip detallado
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
                                            {/* 1. Estado */}
                                            <td className="ps-4">
                                                <Badge bg={badgeBg} className="fw-normal px-2 py-1">
                                                    {tarea.progreso.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            
                                            {/* 2. Campaña */}
                                            <td className="fw-bold text-dark">
                                                {tarea.campana?.nombre}
                                            </td>
                                            
                                            {/* 3. Analista o Equipo */}
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
                                            
                                            {/* 4. Título y Origen */}
                                            <td>
                                                <div className="fw-bold text-dark" style={{ fontSize: '1rem' }}>
                                                    {tarea.titulo}
                                                </div>
                                                <div className="mt-1">
                                                    {tarea.es_generada_automaticamente ? (
                                                        <Badge bg="light" text="secondary" className="border fw-normal">🤖 Automática</Badge>
                                                    ) : (
                                                        <Badge bg="info" className="fw-normal">👤 Manual</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            
                                            {/* 5. BARRA DE PROGRESO Y RIESGO (STACKED) */}
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
                                            
                                            {/* 6. Botón */}
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
                                        <div>No se encontraron rutinas para esta fecha y filtros.</div>
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