import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Form, Button, Spinner, Table, Badge, Row, Col, Alert } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';

const CatalogoReporteriaPage = () => {
    const { user } = useAuth();
    
    // --- ESTADOS ---
    const [tareas, setTareas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [editItem, setEditItem] = useState(null);
    const [syncing, setSyncing] = useState(false);

    // Formulario
    const [formData, setFormData] = useState({
        categoria: '',
        nombre: '',
        descripcion: '',
        hora_vencimiento: '',
        activa: true,
        lunes: true, martes: true, miercoles: true, jueves: true, viernes: true,
        sabado: false, domingo: false
    });

    // --- CARGAS DE DATOS ---
    const fetchCatalogo = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/reporteria/catalogo`);
            if (response.ok) {
                const data = await response.json();
                setTareas(data);
            } else {
                setError("No se pudo cargar el catálogo");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCatalogo();
    }, [fetchCatalogo]);

    // --- MANEJO DE FORMULARIO ---
    const resetForm = () => {
        setFormData({
            categoria: '',
            nombre: '',
            descripcion: '',
            hora_vencimiento: '',
            activa: true,
            lunes: true, martes: true, miercoles: true, jueves: true, viernes: true,
            sabado: false, domingo: false
        });
        setEditItem(null);
    };

    const handleToggleDia = (dia) => {
        setFormData(prev => ({ ...prev, [dia]: !prev[dia] }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const method = editItem ? 'PUT' : 'POST';
        const url = editItem 
            ? `${API_BASE_URL}/api/reporteria/catalogo/${editItem.id}`
            : `${API_BASE_URL}/api/reporteria/catalogo`;

        const payload = { ...formData };
        if (payload.hora_vencimiento === '') {
            payload.hora_vencimiento = null;
        }

        try {
            const response = await fetchWithAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                resetForm();
                fetchCatalogo();
                setSuccessMsg(editItem ? "Guardado correctamente" : "Creado correctamente");
            } else {
                const errData = await response.json();
                let errMsg = "Error al guardar tarea";
                if (errData.detail) {
                    errMsg = Array.isArray(errData.detail) 
                        ? errData.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ')
                        : errData.detail;
                }
                setError(errMsg);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (t) => {
        setEditItem(t);
        setFormData({
            categoria: t.categoria,
            nombre: t.nombre,
            descripcion: t.descripcion || '',
            hora_vencimiento: t.hora_vencimiento || '',
            activa: t.activa,
            lunes: t.lunes,
            martes: t.martes,
            miercoles: t.miercoles,
            jueves: t.jueves,
            viernes: t.viernes,
            sabado: t.sabado,
            domingo: t.domingo
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de eliminar este ítem del catálogo permanente?")) return;
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/reporteria/catalogo/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setSuccessMsg("Ítem eliminado correctamente");
                fetchCatalogo();
            } else {
                const data = await response.json();
                setError(data.detail || "Error al eliminar");
            }
        } catch (err) {
            setError("Error al eliminar: " + err.message);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/reporteria/sync`, {
                method: 'POST'
            });
            const data = await response.json();
            if (response.ok) {
                setSuccessMsg(data.message);
            } else {
                setError(data.detail || "Error en la sincronización");
            }
        } catch (err) {
            setError("Error en la sincronización: " + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const renderDiasBadge = (item) => {
        const diasConfig = [
            { key: 'lunes', label: 'L' }, { key: 'martes', label: 'M' }, { key: 'miercoles', label: 'X' },
            { key: 'jueves', label: 'J' }, { key: 'viernes', label: 'V' }, { key: 'sabado', label: 'S' },
            { key: 'domingo', label: 'D' }
        ];
        return (
            <div className="d-flex gap-1 mt-1">
                {diasConfig.map(dia => (
                    <span key={dia.key} 
                          className={`badge rounded-circle p-1 d-flex align-items-center justify-content-center ${item[dia.key] ? 'bg-primary' : 'bg-light text-muted border'}`} 
                          style={{width: '20px', height: '20px', fontSize: '0.6rem'}}>
                        {dia.label}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <Container className="py-4">
            <Row className="justify-content-center">
                <Col lg={10}>
                    {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
                    {successMsg && <Alert variant="success" dismissible onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}
                    
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h3 className="mb-0 text-primary fw-bold">Catálogo de Reportería</h3>
                        <Button 
                            variant="primary" 
                            className="shadow-sm fw-bold px-4 rounded-pill"
                            onClick={handleSync}
                            disabled={syncing}
                        >
                            {syncing ? <Spinner size="sm" animation="border" className="me-2"/> : '⚡'} 
                            Sincronizar Bolsa de Hoy
                        </Button>
                    </div>

                    {/* FORMULARIO DE EDICIÓN / CREACIÓN */}
                    <Card className="shadow border-0 mb-4 animate__animated animate__fadeIn">
                        <Card.Header className="bg-white border-bottom py-3">
                            <h5 className="mb-0 text-muted">
                                {editItem ? `✏️ Editando: ${editItem.nombre}` : '⚡ Nuevo Reporte Programado'}
                            </h5>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <Form onSubmit={handleSave}>
                                <Row g={3}>
                                    <Col md={3}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="small fw-bold">Categoría</Form.Label>
                                            <Form.Control
                                                type="text"
                                                placeholder="Ej: SIT, Delivery"
                                                value={formData.categoria}
                                                onChange={e => setFormData({...formData, categoria: e.target.value})}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="small fw-bold">Nombre del Reporte</Form.Label>
                                            <Form.Control
                                                type="text"
                                                placeholder="Ej: Tablero Consalud Mañana"
                                                value={formData.nombre}
                                                onChange={e => setFormData({...formData, nombre: e.target.value})}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={3}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="small fw-bold">SLA (Hora)</Form.Label>
                                            <Form.Control
                                                type="time"
                                                value={formData.hora_vencimiento}
                                                onChange={e => setFormData({...formData, hora_vencimiento: e.target.value})}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={12}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="small fw-bold">Descripción / Instrucciones (Opcional)</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={2}
                                                placeholder="Detalles sobre el envío o link al recurso..."
                                                value={formData.descripcion}
                                                onChange={e => setFormData({...formData, descripcion: e.target.value})}
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <div className="mb-4">
                                    <Form.Label className="small fw-bold d-block mb-2">Días de ejecución automática:</Form.Label>
                                    <div className="d-flex flex-wrap gap-2">
                                        {[
                                            {k:'lunes', l:'Lun'}, {k:'martes', l:'Mar'}, {k:'miercoles', l:'Mié'}, 
                                            {k:'jueves', l:'Jue'}, {k:'viernes', l:'Vie'}, {k:'sabado', l:'Sáb'}, {k:'domingo', l:'Dom'}
                                        ].map(dia => (
                                            <Button 
                                                key={dia.k}
                                                variant={formData[dia.k] ? 'primary' : 'outline-secondary'}
                                                size="sm"
                                                onClick={() => handleToggleDia(dia.k)}
                                                className="rounded-pill px-3"
                                                type="button"
                                            >
                                                {dia.l}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between align-items-center">
                                    <Form.Check 
                                        type="switch"
                                        id="active-switch"
                                        label="Item Activo"
                                        checked={formData.activa}
                                        onChange={e => setFormData({...formData, activa: e.target.checked})}
                                        className="fw-bold text-muted"
                                    />
                                    <div className="d-flex gap-2">
                                        {editItem && (
                                            <Button variant="link" className="text-muted" onClick={resetForm}>
                                                Cancelar
                                            </Button>
                                        )}
                                        <Button type="submit" variant={editItem ? "warning" : "success"} disabled={submitting} className="fw-bold px-4">
                                            {submitting ? <Spinner size="sm" animation="border"/> : (editItem ? 'Actualizar Cambios' : 'Guardar en Catálogo')}
                                        </Button>
                                    </div>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>

                    {/* LISTADO DE ITEMS */}
                    <Card className="shadow border-0">
                        <Card.Header className="bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 text-muted">Configuración Permanente</h5>
                            <Badge bg="info">{tareas.length} reportes</Badge>
                        </Card.Header>
                        <Card.Body className="p-0">
                            <div className="table-responsive">
                                <Table hover className="align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="px-4">Categoría</th>
                                            <th>Reporte</th>
                                            <th>SLA</th>
                                            <th className="text-center">Activo</th>
                                            <th className="text-end px-4">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="5" className="text-center py-5"><Spinner animation="border" variant="primary"/></td></tr>
                                        ) : tareas.length === 0 ? (
                                            <tr><td colSpan="5" className="text-center py-5 text-muted">No hay tareas configuradas en el catálogo.</td></tr>
                                        ) : tareas.map(t => (
                                            <tr key={t.id} className={!t.activa ? 'opacity-50 bg-light' : ''}>
                                                <td className="px-4">
                                                    <Badge bg="secondary" className="fw-normal">{t.categoria}</Badge>
                                                </td>
                                                <td>
                                                    <div className="fw-bold">{t.nombre}</div>
                                                    <div className="text-muted small mb-1" style={{maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                        {t.descripcion || 'Sin descripción'}
                                                    </div>
                                                    {renderDiasBadge(t)}
                                                </td>
                                                <td>
                                                    <Badge bg="warning" text="dark">
                                                        <i className="bi bi-clock me-1"></i>
                                                        {t.hora_vencimiento ? t.hora_vencimiento.substring(0, 5) : '--:--'}
                                                    </Badge>
                                                </td>
                                                <td className="text-center">
                                                    {t.activa ? <Badge bg="success">Sí</Badge> : <Badge bg="danger">No</Badge>}
                                                </td>
                                                <td className="text-end px-4">
                                                    <Button variant="outline-primary" size="sm" className="me-2 fw-bold" onClick={() => handleEdit(t)}>
                                                        ✏️ Editar
                                                    </Button>
                                                    <Button variant="outline-danger" size="sm" className="fw-bold" onClick={() => handleDelete(t.id)}>
                                                        🗑️ Eliminar
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default CatalogoReporteriaPage;
