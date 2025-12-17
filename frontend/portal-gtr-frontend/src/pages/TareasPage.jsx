// RUTA: src/pages/TareasPage.jsx

import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, ProgressBar, Button, Card, Row, Col, Form, InputGroup, Spinner } from 'react-bootstrap';
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
        // Filtro simple en memoria (Buscador)
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
            // Llamamos al endpoint global (que ahora trae historial, comentarios e items)
            const response = await fetchWithAuth(`${API_BASE_URL}/gtr/tareas/`);
            if (response.ok) {
                const data = await response.json();
                // Ordenar: Pendientes primero
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

    const calcularProgreso = (items) => {
        if (!items || items.length === 0) return 0;
        const completados = items.filter(i => i.completado).length;
        return Math.round((completados / items.length) * 100);
    };

    if (loading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;

    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">🛡️ Monitor de Cumplimiento</h2>
                <Button variant="outline-primary" onClick={cargarTareas}>🔄 Refrescar</Button>
            </div>

            {/* Buscador y Resumen */}
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
                            <th style={{width: '20%'}}>Avance</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTareas.length > 0 ? (
                            filteredTareas.map(tarea => {
                                const progreso = calcularProgreso(tarea.checklist_items);
                                return (
                                    <tr key={tarea.id}>
                                        {/* 1. Estado General */}
                                        <td>
                                            {progreso === 100 ? (
                                                <Badge bg="success">COMPLETADA</Badge>
                                            ) : (
                                                <Badge bg="warning" text="dark">EN PROCESO</Badge>
                                            )}
                                        </td>
                                        
                                        {/* 2. Campaña */}
                                        <td className="fw-bold text-primary">{tarea.campana?.nombre}</td>
                                        
                                        {/* 3. Analista con Avatar simple */}
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="bg-secondary text-white rounded-circle d-flex justify-content-center align-items-center" style={{width: 30, height: 30, fontSize: 12}}>
                                                    {tarea.analista?.nombre?.charAt(0)}
                                                </div>
                                                {tarea.analista?.nombre} {tarea.analista?.apellido}
                                            </div>
                                        </td>
                                        
                                        {/* 4. Título y Origen (AQUÍ ESTÁ EL CAMBIO VISUAL) */}
                                        <td>
                                            <div className="fw-bold">{tarea.titulo}</div>
                                            {tarea.es_generada_automaticamente ? (
                                                <Badge bg="light" text="secondary" className="border mt-1">
                                                    🤖 Rutina Diaria
                                                </Badge>
                                            ) : (
                                                <Badge bg="secondary" className="mt-1">
                                                    👤 Manual
                                                </Badge>
                                            )}
                                        </td>
                                        
                                        {/* 5. Barra de Progreso */}
                                        <td>
                                            <div className="d-flex justify-content-between small text-muted mb-1">
                                                <span>{progreso}%</span>
                                            </div>
                                            <ProgressBar now={progreso} variant={progreso === 100 ? 'success' : 'info'} style={{height: 6}} />
                                        </td>
                                        
                                        {/* 6. Botón de Acción */}
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