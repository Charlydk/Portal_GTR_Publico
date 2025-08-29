// src/pages/TareasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, ListGroup, Button, Badge, Form } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../api';
import { useNavigate } from 'react-router-dom';

function TareasPage() {
    const { user, authToken, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [allTasks, setAllTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- INICIO DE CAMBIOS: Estado de filtros ampliado ---
    const [filtros, setFiltros] = useState({
        analistaId: '',
        campanaId: '',
        estado: '',
        fechaDesde: '',
        fechaHasta: ''
    });
    const [analistas, setAnalistas] = useState([]);
    const [campanas, setCampanas] = useState([]);
    // --- FIN DE CAMBIOS ---

    // La función fetchFilterData ahora también obtiene campañas para los analistas
    const fetchFilterData = useCallback(async () => {
        if (!authToken || !user) return;
        try {
            // Supervisores obtienen todo
            if (user.role !== 'ANALISTA') {
                const [analistasRes, campanasRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/analistas/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                    fetch(`${API_BASE_URL}/campanas/`, { headers: { 'Authorization': `Bearer ${authToken}` } })
                ]);
                if (!analistasRes.ok) throw new Error('No se pudo cargar la lista de analistas.');
                if (!campanasRes.ok) throw new Error('No se pudo cargar la lista de campañas.');
                setAnalistas(await analistasRes.json());
                setCampanas(await campanasRes.json());
            } else { // Analistas obtienen solo sus campañas
                const userRes = await fetch(`${API_BASE_URL}/users/me/`, { headers: { 'Authorization': `Bearer ${authToken}` } });
                if (!userRes.ok) throw new Error('No se pudo cargar la lista de campañas.');
                const userData = await userRes.json();
                setCampanas(userData.campanas_asignadas || []);
            }
        } catch (err) {
            setError(err.message);
        }
    }, [authToken, user]);

    // La función fetchAllTasks ahora es mucho más inteligente
    const fetchAllTasks = useCallback(async () => {
        if (!authToken || !user) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (user.role === 'ANALISTA') {
                params.append('analista_id', user.id);
            } else if (filtros.analistaId) {
                params.append('analista_id', filtros.analistaId);
            }

            if (filtros.campanaId) params.append('campana_id', filtros.campanaId);
            if (filtros.estado) params.append('estado', filtros.estado);
            if (filtros.fechaDesde) params.append('fecha_desde', filtros.fechaDesde);
            if (filtros.fechaHasta) params.append('fecha_hasta', filtros.fechaHasta);
            
            const queryString = params.toString();
            const campaignTasksUrl = `${API_BASE_URL}/tareas/?${queryString}`;
            const generatedTasksUrl = `${API_BASE_URL}/tareas_generadas_por_avisos/?${queryString}`;

            const [campaignTasksResponse, generatedTasksResponse] = await Promise.all([
                fetch(campaignTasksUrl, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(generatedTasksUrl, { headers: { 'Authorization': `Bearer ${authToken}` } })
            ]);

            if (!campaignTasksResponse.ok) throw new Error('Error al cargar tareas de campaña.');
            if (!generatedTasksResponse.ok) throw new Error('Error al cargar tareas generadas.');

            const campaignTasks = (await campaignTasksResponse.json()).map(t => ({ ...t, type: 'campaign' }));
            const generatedTasks = (await generatedTasksResponse.json()).map(t => ({ ...t, type: 'generated' }));

            const combinedTasks = [...campaignTasks, ...generatedTasks].sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
            setAllTasks(combinedTasks);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, user, filtros]);

    useEffect(() => {
      if (!authLoading && user) {
          fetchFilterData(); // Carga los datos para los selectores
          fetchAllTasks(); // Hace la primera búsqueda inicial sin filtros
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]); // Se ejecuta solo una vez cuando el usuario carga
  

    const handleFilterChange = (e) => {
        setFiltros(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const clearFilters = () => {
        setFiltros({ analistaId: '', campanaId: '', estado: '', fechaDesde: '', fechaHasta: '' });
    };
    
    // El resto de funciones no cambian
    const formatDateTime = (apiDateString) => {
        if (!apiDateString) return 'N/A';
        const date = new Date(apiDateString + 'Z');
        if (isNaN(date.getTime())) return 'Fecha inválida';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year}, ${hours}:${minutes}`;
    };

    if (authLoading) return <Container className="text-center py-5"><Spinner /></Container>;

    return (
        <Container className="py-5">
            <h1 className="mb-4 text-center text-primary">Gestión de Tareas</h1>
            {error && <Alert variant="danger">{error}</Alert>}

            {/* --- INICIO DE CAMBIOS: El formulario de filtros ahora es para todos --- */}
            <Card className="mb-4 shadow-sm">
                <Card.Body>
                    <Row className="g-3">
                        {user.role !== 'ANALISTA' && (
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Analista</Form.Label>
                                    <Form.Select name="analistaId" value={filtros.analistaId} onChange={handleFilterChange}>
                                        <option value="">Todos</option>
                                        <option value="0">Sin Asignar</option>
                                        {analistas.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        )}
                        <Col md={user.role !== 'ANALISTA' ? 4 : 6}>
                            <Form.Group>
                                <Form.Label>Campaña</Form.Label>
                                <Form.Select name="campanaId" value={filtros.campanaId} onChange={handleFilterChange}>
                                    <option value="">Todas</option>
                                    <option value="0">Sin Campaña (Personal)</option>
                                    {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={user.role !== 'ANALISTA' ? 4 : 6}>
                            <Form.Group>
                                <Form.Label>Estado</Form.Label>
                                <Form.Select name="estado" value={filtros.estado} onChange={handleFilterChange}>
                                    <option value="">Todos</option>
                                    <option value="PENDIENTE">Pendiente</option>
                                    <option value="EN_PROGRESO">En Progreso</option>
                                    <option value="COMPLETADA">Completada</option>
                                    <option value="CANCELADA">Cancelada</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Vencimiento Desde</Form.Label>
                                <Form.Control type="date" name="fechaDesde" value={filtros.fechaDesde} onChange={handleFilterChange} />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Vencimiento Hasta</Form.Label>
                                <Form.Control type="date" name="fechaHasta" value={filtros.fechaHasta} onChange={handleFilterChange} />
                            </Form.Group>
                        </Col>
                        <Col md={6} className="d-flex align-items-end gap-2">
                            <Button variant="primary" onClick={fetchAllTasks} className="w-100">
                                Aplicar Filtros
                            </Button>
                            <Button variant="secondary" onClick={clearFilters} className="w-100">
                                Limpiar Filtros
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
            {/* --- FIN DE CAMBIOS --- */}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <h4>{loading ? 'Cargando...' : `Mostrando ${allTasks.length} tareas`}</h4>
                <Button variant="primary" onClick={() => navigate('/tareas/crear')}>
                    Crear Nueva Tarea
                </Button>
            </div>

            {loading ? (
                <div className="text-center"><Spinner /></div>
            ) : allTasks.length > 0 ? (
                // ... (La lista de tareas no necesita cambios)
                 <ListGroup variant="flush">
                    {allTasks.map(tarea => (
                       <ListGroup.Item key={`${tarea.type}-${tarea.id}`} className="mb-2 shadow-sm rounded p-3">
                            <Row>
                                <Col>
                                    <h5>{tarea.titulo} <Badge bg={tarea.type === 'campaign' ? 'primary' : 'info'}>{tarea.type === 'campaign' ? 'Campaña' : 'Aviso'}</Badge></h5>
                                    <p className="mb-1 text-muted small">{tarea.descripcion}</p>
                                    <small>Asignado a: {tarea.analista?.nombre || tarea.analista_asignado?.nombre || 'N/A'} {tarea.analista?.apellido || tarea.analista_asignado?.apellido}</small>
                                    <br/>
                                    <small>Estado: <Badge bg={tarea.progreso === 'PENDIENTE' ? 'secondary' : 'success'}>{tarea.progreso}</Badge></small>
                                    {tarea.fecha_vencimiento && <small className="ms-2 text-danger">Vence: {formatDateTime(tarea.fecha_vencimiento)}</small>}
                                </Col>
                                <Col xs="auto" className="d-flex flex-column justify-content-center">
                                    <Button variant="outline-primary" size="sm" onClick={() => navigate(tarea.type === 'campaign' ? `/tareas/${tarea.id}` : `/tareas-generadas/${tarea.id}`)}>Ver Detalles</Button>
                                </Col>
                            </Row>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            ) : (
                <Alert variant="info">No se encontraron tareas con los filtros seleccionados.</Alert>
            )}
        </Container>
    );
}

export default TareasPage;