// RUTA: src/pages/ControlIncidenciasPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container, Card, Spinner, Alert, Form, Button, Row, Col, Table, Badge, Modal, ListGroup } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../api';
import { formatDateTime } from '../utils/dateFormatter';
import HistorialItem from '../components/incidencias/HistorialItem';

function ControlIncidenciasPage() {
    const { authToken, user } = useAuth();
    const location = useLocation(); // Hook para leer la URL

    const [incidencias, setIncidencias] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    
    // El estado del filtro ahora puede manejar 'estado' como un string (del dropdown) o un array (de la URL)
    const [filtros, setFiltros] = useState({
        fecha_inicio: '',
        fecha_fin: '',
        campana_id: '',
        estado: '',
        asignado_a_id: ''
    });

    const [listaCampanas, setListaCampanas] = useState([]);
    const [listaAnalistas, setListaAnalistas] = useState([]);

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedIncidence, setSelectedIncidence] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const fetchFilterData = useCallback(async () => {
        if (!authToken) return;
        try {
            const [campanasRes, analistasRes] = await Promise.all([
                fetchWithAuth(`${GTR_API_URL}/campanas/listado-simple/`),
                fetchWithAuth(`${GTR_API_URL}/analistas/listado-simple/`)
            ]);
            if (!campanasRes.ok || !analistasRes.ok) throw new Error("No se pudieron cargar los datos para los filtros.");
            setListaCampanas(await campanasRes.json());
            setListaAnalistas(await analistasRes.json());
        } catch (err) {
            setError(err.message);
        }
    }, [authToken]);

    const fetchIncidencias = useCallback(async (filtrosActuales) => {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        
        // Lógica para manejar 'estado' (puede ser string o array)
        if (Array.isArray(filtrosActuales.estado)) {
            filtrosActuales.estado.forEach(e => params.append('estado', e));
        } else if (filtrosActuales.estado) {
            params.append('estado', filtrosActuales.estado);
        }
        
        // Añadimos el resto de los filtros
        Object.entries(filtrosActuales).forEach(([key, value]) => {
            if (value && key !== 'estado') {
                params.append(key, value);
            }
        });

        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/incidencias/filtradas/?${params.toString()}`);
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
    }, [authToken]);

    // useEffect que se ejecuta al cargar la página o si cambia la URL
    useEffect(() => {
        fetchFilterData(); // Carga los datos para los dropdowns

        const params = new URLSearchParams(location.search);
        const estados = params.getAll('estado');
        const asignadoId = params.get('asignado_a_id');
        
        // Si hay filtros en la URL, los procesamos
        if (estados.length > 0 || asignadoId) {
            const filtrosDesdeUrl = {
                fecha_inicio: '',
                fecha_fin: '',
                campana_id: '',
                estado: estados.length > 0 ? estados : '', // Guardamos el array de estados
                asignado_a_id: asignadoId || ''
            };
            // Actualizamos la UI de los filtros. El dropdown de estado no reflejará la selección múltiple, pero está bien.
            setFiltros(prev => ({...prev, ...filtrosDesdeUrl, estado: ''})); 
            // Ejecutamos la búsqueda automáticamente con los filtros de la URL
            fetchIncidencias(filtrosDesdeUrl);
        }
    }, [location.search, fetchFilterData]); // Se re-ejecuta si la URL (los query params) cambia

    const handleFiltroChange = (e) => {
        setFiltros(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLimpiarFiltros = () => {
        setFiltros({
            fecha_inicio: '', fecha_fin: '', campana_id: '', estado: '', asignado_a_id: ''
        });
        setIncidencias([]);
    };

    const handleExportar = async () => {
        setIsExporting(true);
        setError(null);
        
        try {
            // Preparamos el payload igual que en los filtros
            // Asegurándonos de enviar null si los campos están vacíos
            const payload = {
                fecha_inicio: filtros.fecha_inicio || null,
                fecha_fin: filtros.fecha_fin || null,
                campana_id: filtros.campana_id ? parseInt(filtros.campana_id) : null,
                estado: filtros.estado || null, // El backend espera un string o null en el esquema actual de exportación
                asignado_a_id: filtros.asignado_a_id ? parseInt(filtros.asignado_a_id) : null
            };

            const response = await fetchWithAuth(`${GTR_API_URL}/incidencias/exportar/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Error al generar el archivo Excel.');
            }

            // Manejo de la descarga del archivo binario (Blob)
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_Incidencias_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (err) {
            console.error("Error exportando incidencias:", err);
            setError(err.message);
        } finally {
            setIsExporting(false);
        }
    };

    const getStatusVariant = (estado) => {
        const map = { 'ABIERTA': 'danger', 'EN_PROGRESO': 'warning', 'CERRADA': 'success' };
        return map[estado] || 'secondary';
    };

    const handleShowDetail = async (incidenciaId) => {
        setShowDetailModal(true);
        setLoadingDetail(true);
        setError(null);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/incidencias/${incidenciaId}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "No se pudo cargar el detalle de la incidencia.");
            }
            setSelectedIncidence(await response.json());
        } catch (err) {
            setError(err.message);
            // Si hay un error, cerramos el modal para mostrar el error principal
            setShowDetailModal(false); 
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleCloseDetail = () => {
        setShowDetailModal(false);
        setSelectedIncidence(null); // Limpiamos la incidencia seleccionada
    };

    const handleAssignToMe = async (incidenciaId) => {
        setLoadingDetail(true); // Reutilizamos el spinner del modal
        setError(null);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/incidencias/${incidenciaId}/asignar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'No se pudo asignar la incidencia.');
            }
            // Si tiene éxito, cerramos el modal y refrescamos la lista principal
            handleCloseDetail();
            fetchIncidencias(filtros);
        } catch (err) {
            setError(err.message);
            setLoadingDetail(false); // Detenemos el spinner si hay error
        }
    };

    const canEdit = user && ['ANALISTA', 'SUPERVISOR', 'RESPONSABLE'].includes(user.role);


    return (
        <Container fluid className="py-4">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center bg-secondary text-white">
                    Portal de Control de Incidencias
                </Card.Header>
                <Card.Body>
                    <Card className="mb-4 p-3 bg-light">
                        <Form>
                            <Row className="g-3">
                                <Col md={3}><Form.Group><Form.Label>Desde Fecha</Form.Label><Form.Control type="date" name="fecha_inicio" value={filtros.fecha_inicio} onChange={handleFiltroChange} /></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Hasta Fecha</Form.Label><Form.Control type="date" name="fecha_fin" value={filtros.fecha_fin} onChange={handleFiltroChange} /></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Campaña</Form.Label><Form.Select name="campana_id" value={filtros.campana_id} onChange={handleFiltroChange}><option value="">Todas</option>{listaCampanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Estado</Form.Label><Form.Select name="estado" value={filtros.estado} onChange={handleFiltroChange}><option value="">Todos</option><option value="ABIERTA">Abierta</option><option value="EN_PROGRESO">En Progreso</option><option value="CERRADA">Cerrada</option></Form.Select></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Analista Asignado</Form.Label><Form.Select name="asignado_a_id" value={filtros.asignado_a_id} onChange={handleFiltroChange}><option value="">Todos</option><option value="0">Sin Asignar</option>{listaAnalistas.map(a => <option key={a.id} value={a.id}>{`${a.nombre} ${a.apellido}`}</option>)}</Form.Select></Form.Group></Col>
                                <Col md={6} className="d-flex align-items-end gap-2">
                                    {/* El botón ahora llama a fetchIncidencias pasándole los filtros del estado actual */}
                                    <Button variant="primary" onClick={() => fetchIncidencias(filtros)} disabled={loading || isExporting} className="w-100">{loading ? <Spinner size="sm" /> : 'Filtrar'}</Button>
                                    <Button variant="outline-secondary" onClick={handleLimpiarFiltros} className="w-100">Limpiar</Button>
                                    <Button variant="success" onClick={handleExportar} disabled={loading || isExporting} className="w-100">{isExporting ? <><Spinner size="sm" /> Exportando...</> : 'Exportar a Excel'}</Button>
                                </Col>
                            </Row>
                        </Form>
                    </Card>

                    {error && <Alert variant="danger">{error}</Alert>}
                    
                    <div className="table-responsive">
                        <Table striped bordered hover>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Título</th>
                                    <th>Campaña</th>
                                    <th>LOBs Afectados</th>
                                    <th>Gravedad</th>
                                    <th style={{minWidth: '170px'}}>Estado</th>
                                    <th>Responsable</th>
                                    <th>Fecha Apertura</th>
                                    <th>Fecha Cierre</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="10" className="text-center"><Spinner /></td></tr>
                                ) : incidencias.length > 0 ? (
                                    incidencias.map(inc => (
                                        <tr key={inc.id}>
                                            <td>{inc.id}</td>
                                            <td>{inc.titulo}</td>
                                            <td>{inc.campana?.nombre || 'N/A'}</td>
                                            <td>
                                                {inc.lobs && inc.lobs.length > 0 ? (
                                                    inc.lobs.map(lob => (
                                                        <Badge key={lob.id} bg="secondary" className="me-1 mb-1">{lob.nombre}</Badge>
                                                    ))
                                                ) : (<span className="text-muted">N/A</span>)}
                                            </td>
                                            <td>
                                                <Badge bg={inc.gravedad === 'ALTA' ? 'danger' : inc.gravedad === 'MEDIA' ? 'warning' : 'info'}>
                                                    {inc.gravedad}
                                                </Badge>
                                            </td>
                                            <td><Badge bg={getStatusVariant(inc.estado)}>{inc.estado.replace('_', ' ')}</Badge></td>
                                            <td>
                                                {inc.estado === 'CERRADA' && inc.cerrado_por 
                                                    ? <span title={`Cerrada por ${inc.cerrado_por.nombre}`}>{inc.cerrado_por.nombre} {inc.cerrado_por.apellido}</span>
                                                    : inc.asignado_a 
                                                        ? `${inc.asignado_a.nombre} ${inc.asignado_a.apellido}` 
                                                        : <span className="text-muted fst-italic">Sin Asignar</span>}
                                            </td>
                                            <td>{formatDateTime(inc.fecha_apertura)}</td>
                                            <td>{formatDateTime(inc.fecha_cierre)}</td>
                                            <td>
                                                <Button variant="outline-primary" size="sm" onClick={() => handleShowDetail(inc.id)}>
                                                    Ver Detalle
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="10" className="text-center text-muted">No se encontraron incidencias con los filtros seleccionados.</td></tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>

            <Modal show={showDetailModal} onHide={handleCloseDetail} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>Detalle de Incidencia: #{selectedIncidence?.id}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {loadingDetail ? (
                        <div className="text-center"><Spinner /></div>
                    ) : selectedIncidence ? (
                        <>
                            <h4>{selectedIncidence.titulo}</h4>
                            <hr />
                            <Row>
                                <Col md={6}>
                                    {/* --- INICIO DE LA CORRECCIÓN --- */}
                                    <p><strong>Campaña:</strong> {selectedIncidence.campana?.nombre || 'N/A'}</p>
                                    <p><strong>Creador:</strong> {selectedIncidence.creador?.nombre || 'Usuario'} {selectedIncidence.creador?.apellido || 'Desconocido'}</p>
                                    <p><strong>Responsable:</strong> 
                                    {selectedIncidence.estado === 'CERRADA' && selectedIncidence.cerrado_por
                                        ? <span title={`Cerrada por ${selectedIncidence.cerrado_por.nombre}`}>{selectedIncidence.cerrado_por.nombre} {selectedIncidence.cerrado_por.apellido}</span>
                                        : selectedIncidence.asignado_a
                                            ? `${selectedIncidence.asignado_a.nombre} ${selectedIncidence.asignado_a.apellido}`
                                            : 'Sin Asignar'
                                    }
                                </p>

                                <p><strong>Estado:</strong> <Badge bg={getStatusVariant(selectedIncidence.estado)}>{selectedIncidence.estado}</Badge></p>
                                    </Col>
                                <Col md={6}>
                                    <p><strong>Gravedad:</strong> <Badge bg={selectedIncidence.gravedad === 'ALTA' ? 'danger' : 'warning'}>{selectedIncidence.gravedad}</Badge></p>
                                    <p><strong>Herramienta Afectada:</strong> {selectedIncidence.herramienta_afectada || 'N/A'}</p>
                                    <p><strong>Indicador Afectado:</strong> {selectedIncidence.indicador_afectado || 'N/A'}</p>
                                    <p><strong>Fecha Apertura:</strong> {formatDateTime(selectedIncidence.fecha_apertura)}</p>
                                </Col>
                            </Row>
                            <hr />
                            <h5>Descripción</h5>
                            <p>{selectedIncidence.descripcion_inicial}</p>
                            
                            <h5>Historial de Actualizaciones</h5>

                            {selectedIncidence.actualizaciones?.length > 0 ? (
                                <ListGroup variant="flush">
                                    {selectedIncidence.actualizaciones
                                        .sort((a, b) => new Date(b.fecha_actualizacion) - new Date(a.fecha_actualizacion)) // Ordenamos
                                        .map(act => (
                                            <HistorialItem key={act.id} actualizacion={act} />
                                        ))}
                                </ListGroup>
                            ) : (
                                <p className="text-muted">No hay actualizaciones para esta incidencia.</p>
                            )}
                        </>
                    ) : (
                        <p>No se pudo cargar la información de la incidencia.</p>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDetail}>
                        Cerrar
                    </Button>
                    
                    {/* Botón para Asignarse a uno mismo (si está libre y no es tuya) */}
                    {user && selectedIncidence && selectedIncidence.asignado_a?.id !== user.id && selectedIncidence.estado !== 'CERRADA' && (
                        <Button variant="info" onClick={() => handleAssignToMe(selectedIncidence.id)} disabled={loadingDetail}>
                            {loadingDetail ? <Spinner size="sm"/> : 'Asignar a Mí'}
                        </Button>
                    )}
                    
                    {/* Botón para ir a la página de detalles completos */}
                    {selectedIncidence && (
                        // Añadimos target y rel para abrir en una nueva pestaña de forma segura
                        <Link to={`/incidencias/${selectedIncidence.id}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="primary" onClick={handleCloseDetail}>
                                Ver / Gestionar Detalles
                            </Button>
                        </Link>
                    )}
                </Modal.Footer>
            </Modal>

        </Container>
    );
}

export default ControlIncidenciasPage;