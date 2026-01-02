// RUTA: src/pages/TareasPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, ProgressBar, Button, Card, Row, Col, Form, InputGroup, Spinner } from 'react-bootstrap';
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

    useEffect(() => {
        cargarCampanas();
    }, []);

    useEffect(() => {
        cargarTareas();
    }, [fechaFiltro, campanaFiltro, estadoFiltro]);

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
                setTareas(data);
            }
        } catch (error) {
            console.error("Error cargando tareas:", error);
        } finally {
            setLoading(false);
        }
    };

    const calcularProgreso = (items) => {
        if (!items || items.length === 0) return 0;
        const completados = items.filter(i => i.completado).length;
        return Math.round((completados / items.length) * 100);
    };

    // --- 🛠️ FUNCIÓN SEGURA PARA FORMATEAR LA HORA ---
    const formatTime = (dateString) => {
        if (!dateString) return '--:--'; // Si es null o undefined
        
        let date = new Date(dateString);
        
        // Si la fecha es inválida, intentamos el truco de agregar 'Z' (por si viene sin zona horaria)
        if (isNaN(date.getTime())) {
            date = new Date(dateString + 'Z');
        }

        // Si sigue siendo inválida, nos rendimos elegantemente
        if (isNaN(date.getTime())) return '--:--';

        return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };
    // -----------------------------------------------

    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">🛡️ Monitor de Cumplimiento</h2>
                <div className="d-flex gap-2">
                    <Button variant="outline-primary" onClick={cargarTareas}>🔄 Refrescar</Button>
                </div>
            </div>

            {/* --- BARRA DE FILTROS --- */}
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
                                <th style={{width: '15%'}}>Avance</th>
                                <th className="text-end pe-4">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tareas.length > 0 ? (
                                tareas.map(tarea => {
                                    const progreso = calcularProgreso(tarea.checklist_items);
                                    
                                    let badgeBg = 'secondary';
                                    if (tarea.progreso === 'COMPLETADA') badgeBg = 'success';
                                    else if (tarea.progreso === 'EN_PROGRESO') badgeBg = 'primary';
                                    else if (tarea.progreso === 'PENDIENTE') badgeBg = 'warning';

                                    return (
                                        <tr key={tarea.id}>
                                            <td className="ps-4">
                                                <Badge bg={badgeBg} className="fw-normal px-2 py-1">
                                                    {tarea.progreso.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="fw-bold text-dark">
                                                {tarea.campana?.nombre}
                                            </td>
                                            <td>
                                                {tarea.analista ? (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-primary text-white rounded-circle d-flex justify-content-center align-items-center shadow-sm" style={{width: 32, height: 32, fontSize: '0.8rem'}}>
                                                            {tarea.analista.nombre.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="fw-semibold" style={{fontSize:'0.9rem'}}>{tarea.analista.nombre} {tarea.analista.apellido}</div>
                                                            <div className="text-muted small" style={{fontSize:'0.75rem'}}>ID: {tarea.analista.bms_id || 'N/A'}</div>
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
                                                <div className="fw-bold text-dark" style={{ fontSize: '1rem' }}>
                                                    {tarea.titulo}
                                                </div>
                                                {/* Agregamos el origen aquí para dar contexto sin usar la hora */}
                                                <div className="mt-1">
                                                    {tarea.es_generada_automaticamente ? (
                                                        <Badge bg="light" text="secondary" className="border fw-normal">🤖 Automática</Badge>
                                                    ) : (
                                                        <Badge bg="info" className="fw-normal">👤 Manual</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-between small text-muted mb-1">
                                                    <span>{progreso}%</span>
                                                </div>
                                                <ProgressBar now={progreso} variant={progreso === 100 ? 'success' : 'primary'} style={{height: 6}} />
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