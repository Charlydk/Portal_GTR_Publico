// RUTA: src/pages/ControlIncidenciasPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Spinner, Alert, Form, Button, Row, Col, Table, Badge } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL } from '../api';
import { formatDateTime } from '../utils/dateFormatter';

function ControlIncidenciasPage() {
    const { authToken } = useAuth();

    // --- ESTADOS PRINCIPALES ---
    const [incidencias, setIncidencias] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- ESTADOS PARA LOS FILTROS ---
    const [filtros, setFiltros] = useState({
        fecha_inicio: '',
        fecha_fin: '',
        campana_id: '',
        estado: '',
        asignado_a_id: ''
    });
    const [listaCampanas, setListaCampanas] = useState([]);
    const [listaAnalistas, setListaAnalistas] = useState([]);

    // --- LÓGICA PARA CARGAR DATOS ---

    // Carga las listas de campañas y analistas para poblar los menús de filtro
    const fetchFilterData = useCallback(async () => {
        if (!authToken) return;
        try {
            const [campanasRes, analistasRes] = await Promise.all([
                fetch(`${GTR_API_URL}/campanas/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${GTR_API_URL}/analistas/listado-simple/`, { headers: { 'Authorization': `Bearer ${authToken}` } }) // <-- CAMBIA A ESTA NUEVA RUTA
            ]);
            if (!campanasRes.ok || !analistasRes.ok) throw new Error("No se pudieron cargar los datos para los filtros.");
            
            setListaCampanas(await campanasRes.json());
            setListaAnalistas(await analistasRes.json());
        } catch (err) {
            setError(err.message);
        }
    }, [authToken]);

    useEffect(() => {
        fetchFilterData();
    }, [fetchFilterData]);

    // Busca las incidencias en la API según los filtros aplicados
    const fetchIncidencias = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        // Construye los parámetros de la URL solo con los filtros que tienen valor
        const params = new URLSearchParams();
        Object.entries(filtros).forEach(([key, value]) => {
            if (value) {
                params.append(key, value);
            }
        });

        try {
            const response = await fetch(`${GTR_API_URL}/incidencias/filtradas/?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Error al buscar incidencias.");
            }
            setIncidencias(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, filtros]);

    // --- MANEJADORES DE EVENTOS ---
    
    const handleFiltroChange = (e) => {
        setFiltros(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLimpiarFiltros = () => {
        setFiltros({
            fecha_inicio: '', fecha_fin: '', campana_id: '',
            estado: '', asignado_a_id: ''
        });
        setIncidencias([]); // Limpia los resultados de la tabla
    };

    const getStatusVariant = (estado) => {
        const map = { 'ABIERTA': 'danger', 'EN_PROGRESO': 'warning', 'CERRADA': 'success' };
        return map[estado] || 'secondary';
    };

    return (
        <Container fluid className="py-4">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center bg-secondary text-white">
                    Portal de Control de Incidencias
                </Card.Header>
                <Card.Body>
                    {/* --- FORMULARIO DE FILTROS --- */}
                    <Card className="mb-4 p-3 bg-light">
                        <Form>
                            <Row className="g-3">
                                <Col md={3}><Form.Group><Form.Label>Desde Fecha</Form.Label><Form.Control type="date" name="fecha_inicio" value={filtros.fecha_inicio} onChange={handleFiltroChange} /></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Hasta Fecha</Form.Label><Form.Control type="date" name="fecha_fin" value={filtros.fecha_fin} onChange={handleFiltroChange} /></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Campaña</Form.Label><Form.Select name="campana_id" value={filtros.campana_id} onChange={handleFiltroChange}><option value="">Todas</option>{listaCampanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Estado</Form.Label><Form.Select name="estado" value={filtros.estado} onChange={handleFiltroChange}><option value="">Todos</option><option value="ABIERTA">Abierta</option><option value="EN_PROGRESO">En Progreso</option><option value="CERRADA">Cerrada</option></Form.Select></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Analista Asignado</Form.Label><Form.Select name="asignado_a_id" value={filtros.asignado_a_id} onChange={handleFiltroChange}><option value="">Todos</option><option value="0">Sin Asignar</option>{listaAnalistas.map(a => <option key={a.id} value={a.id}>{`${a.nombre} ${a.apellido}`}</option>)}</Form.Select></Form.Group></Col>
                                <Col md={6} className="d-flex align-items-end gap-2">
                                    <Button variant="primary" onClick={fetchIncidencias} disabled={loading} className="w-100">{loading ? <Spinner size="sm" /> : 'Filtrar'}</Button>
                                    <Button variant="outline-secondary" onClick={handleLimpiarFiltros} className="w-100">Limpiar</Button>
                                </Col>
                            </Row>
                        </Form>
                    </Card>

                    {error && <Alert variant="danger">{error}</Alert>}
                    
                    {/* --- TABLA DE RESULTADOS --- */}
                    <div className="table-responsive">
                        <Table striped bordered hover>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Título</th>
                                    <th>Campaña</th>
                                    <th>Estado</th>
                                    <th>Creador</th>
                                    <th>Asignado a</th>
                                    <th>Fecha Apertura</th>
                                    <th>Fecha Cierre</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="8" className="text-center"><Spinner /></td></tr>
                                ) : incidencias.length > 0 ? (
                                    incidencias.map(inc => (
                                        <tr key={inc.id}>
                                            <td>{inc.id}</td>
                                            <td>{inc.titulo}</td>
                                            <td>{inc.campana.nombre}</td>
                                            <td><Badge bg={getStatusVariant(inc.estado)}>{inc.estado.replace('_', ' ')}</Badge></td>
                                            <td>{`${inc.creador.nombre} ${inc.creador.apellido}`}</td>
                                            <td>{inc.asignado_a ? `${inc.asignado_a.nombre} ${inc.asignado_a.apellido}` : <span className="text-muted">Sin Asignar</span>}</td>
                                            <td>{formatDateTime(inc.fecha_apertura)}</td>
                                            <td>{formatDateTime(inc.fecha_cierre)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="8" className="text-center text-muted">No se encontraron incidencias con los filtros seleccionados.</td></tr>
                                )}
                            </tbody>
                        </Table>
                    </div>

                </Card.Body>
            </Card>
        </Container>
    );
}

export default ControlIncidenciasPage;