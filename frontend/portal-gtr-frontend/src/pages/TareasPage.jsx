// RUTA: src/pages/TareasPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, ProgressBar, Button, Card, Row, Col, Form, InputGroup, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth } from '../api';

const TareasPage = () => {
    const navigate = useNavigate();
    const [tareas, setTareas] = useState([]);
    const [filteredTareas, setFilteredTareas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        cargarTareas();
    }, []);

    useEffect(() => {
        const results = tareas.filter(t => 
            t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.analista?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.campana?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredTareas(results);
    }, [searchTerm, tareas]);

    const cargarTareas = async () => {
        setLoading(true);
        try {
            // Usamos el endpoint global
            const response = await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/`);
            if (response.ok) {
                const data = await response.json();
                // Ordenar: Las que requieren atención primero
                const sorted = data.sort((a, b) => (a.progreso === 'COMPLETADA' ? 1 : -1));
                setTareas(sorted);
                setFilteredTareas(sorted);
            }
        } catch (error) {
            console.error("Error cargando tareas:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- 🧠 CEREBRO DE LA BARRA DE PROGRESO ---
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
                // Parseamos la hora (HH:MM)
                const [h, m] = item.hora_sugerida.toString().substring(0, 5).split(':').map(Number);
                const itemMinutes = h * 60 + m;
                // Calculamos diferencia (Misma lógica que el Dashboard)
                const diff = currentMinutes - itemMinutes;

                if (diff > 15) { 
                    late++; // Pasaron más de 15 min -> VENCIDO
                } else {
                    pending++; // Aún en tiempo o futuro
                }
            } else {
                pending++; // Sin hora asignada
            }
        });

        const total = items.length;
        // Calculamos porcentajes para la barra visual (La suma debe dar 100 aprox)
        return {
            total, ok, late, pending,
            pctOk: (ok / total) * 100,
            pctLate: (late / total) * 100,
            pctPending: (pending / total) * 100
        };
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;

    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">🛡️ Monitor de Cumplimiento</h2>
                <Button variant="outline-primary" onClick={cargarTareas}>🔄 Refrescar</Button>
            </div>

            <Row className="mb-4 g-3">
                <Col md={8}>
                    <InputGroup>
                        <InputGroup.Text>🔍</InputGroup.Text>
                        <Form.Control 
                            placeholder="Buscar por analista, campaña o título..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </Col>
                <Col md={4} className="text-end">
                    <Badge bg="primary" className="p-2 me-2">Total: {tareas.length}</Badge>
                    <Badge bg="warning" text="dark" className="p-2">Pendientes: {tareas.filter(t => t.progreso !== 'COMPLETADA').length}</Badge>
                </Col>
            </Row>

            <Card className="shadow-sm border-0">
                <Table hover responsive className="mb-0 align-middle">
                    <thead className="bg-light">
                        <tr>
                            <th>Estado</th>
                            <th>Campaña</th>
                            <th>Analista</th>
                            <th>Rutina / Tarea</th>
                            <th style={{width: '25%'}}>Progreso y Riesgo</th> {/* Columna más ancha */}
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTareas.length > 0 ? (
                            filteredTareas.map(tarea => {
                                // Calculamos las estadísticas de esta tarea
                                const stats = analizarProgreso(tarea.checklist_items);
                                
                                // Tooltip con el detalle exacto al pasar el mouse
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
                                        <td>
                                            {tarea.progreso === 'COMPLETADA' ? (
                                                <Badge bg="success">COMPLETADA</Badge>
                                            ) : (
                                                <Badge bg="warning" text="dark">EN PROCESO</Badge>
                                            )}
                                        </td>
                                        
                                        <td className="fw-bold text-primary">{tarea.campana?.nombre}</td>
                                        
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="bg-secondary text-white rounded-circle d-flex justify-content-center align-items-center" style={{width: 30, height: 30, fontSize: 12}}>
                                                    {tarea.analista?.nombre?.charAt(0) || '?'}
                                                </div>
                                                <span className="small">
                                                    {tarea.analista ? `${tarea.analista.nombre} ${tarea.analista.apellido}` : 'Sin asignar'}
                                                </span>
                                            </div>
                                        </td>
                                        
                                        <td>
                                            <div className="fw-bold">{tarea.titulo}</div>
                                            {tarea.es_generada_automaticamente ? (
                                                <Badge bg="light" text="secondary" className="border mt-1">🤖 Rutina Diaria</Badge>
                                            ) : (
                                                <Badge bg="secondary" className="mt-1">👤 Manual</Badge>
                                            )}
                                        </td>
                                        
                                        {/* --- BARRA DE PROGRESO INTELIGENTE --- */}
                                        <td>
                                            <OverlayTrigger placement="top" overlay={renderTooltip}>
                                                <div style={{cursor: 'help'}}>
                                                    <div className="d-flex justify-content-between small text-muted mb-1">
                                                        <span>{Math.round(stats.pctOk)}%</span>
                                                        {stats.late > 0 && <span className="text-danger fw-bold">{stats.late} Vencidas</span>}
                                                    </div>
                                                    
                                                    {/* Barra Apilada (Stacked) */}
                                                    <ProgressBar style={{height: '10px', backgroundColor: '#e9ecef'}}>
                                                        <ProgressBar variant="success" now={stats.pctOk} key={1} />
                                                        <ProgressBar variant="danger" now={stats.pctLate} key={2} animated={stats.late > 0} />
                                                        <ProgressBar variant="info" now={stats.pctPending} key={3} />
                                                    </ProgressBar>
                                                </div>
                                            </OverlayTrigger>
                                        </td>
                                        
                                        <td>
                                            <Button size="sm" variant="outline-dark" onClick={() => navigate(`/tareas/${tarea.id}`)}>
                                                Auditar
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center py-4 text-muted">
                                    No se encontraron tareas con ese criterio.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Card>
        </Container>
    );
};

export default TareasPage;