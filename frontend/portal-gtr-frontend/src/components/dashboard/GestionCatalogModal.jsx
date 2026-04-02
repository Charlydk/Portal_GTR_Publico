import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Table, Badge, Row, Col, Spinner } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../../api';

const GestionCatalogModal = ({ show, onHide }) => {
    const [tareas, setTareas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        categoria: '',
        nombre: '',
        descripcion: '',
        hora_vencimiento: '',
        activa: true
    });

    const cargarCatalog = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/api/reporteria/catalogo`);
            if (res.ok) setTareas(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (show) cargarCatalog();
    }, [show]);

    const handleSave = async (e) => {
        e.preventDefault();
        const method = editItem ? 'PUT' : 'POST';
        const url = editItem ? `${API_BASE_URL}/api/reporteria/catalogo/${editItem.id}` : `${API_BASE_URL}/api/reporteria/catalogo`;

        try {
            const res = await fetchWithAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                setEditItem(null);
                setFormData({ categoria: '', nombre: '', descripcion: '', hora_vencimiento: '', activa: true });
                cargarCatalog();
            }
        } catch (e) { console.error(e); }
    };

    const handleEdit = (t) => {
        setEditItem(t);
        setFormData({
            categoria: t.categoria,
            nombre: t.nombre,
            descripcion: t.descripcion || '',
            hora_vencimiento: t.hora_vencimiento || '',
            activa: t.activa
        });
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Eliminar esta tarea del catálogo permanente?")) return;
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/api/reporteria/catalogo/${id}`, { method: 'DELETE' });
            if (res.ok) cargarCatalog();
        } catch (e) { console.error(e); }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="bg-light">
                <Modal.Title className="h6 fw-bold">⚙️ Gestión de Catálogo de Reportería</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSave} className="mb-4 p-3 border rounded bg-light">
                    <h6 className="fw-bold mb-3">{editItem ? 'Editar Tarea' : 'Nueva Tarea Permanente'}</h6>
                    <Row className="g-2">
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label className="small">Categoría</Form.Label>
                                <Form.Control size="sm" required value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Ej: SIT, Delivery, etc" />
                            </Form.Group>
                        </Col>
                        <Col md={5}>
                            <Form.Group>
                                <Form.Label className="small">Nombre del Reporte</Form.Label>
                                <Form.Control size="sm" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Tablero Consalud Mañana" />
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group>
                                <Form.Label className="small">SLA (Hora)</Form.Label>
                                <Form.Control size="sm" type="time" value={formData.hora_vencimiento} onChange={e => setFormData({...formData, hora_vencimiento: e.target.value})} />
                            </Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Group className="mt-2">
                                <Form.Label className="small">Descripción / Ruta (Opcional)</Form.Label>
                                <Form.Control size="sm" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Instrucciones o link al reporte..." />
                            </Form.Group>
                        </Col>
                    </Row>
                    <div className="mt-3 d-flex justify-content-end gap-2">
                        {editItem && <Button variant="link" size="sm" className="text-muted" onClick={() => { setEditItem(null); setFormData({ categoria: '', nombre: '', descripcion: '', hora_vencimiento: '', activa: true }); }}>Cancelar</Button>}
                        <Button variant={editItem ? "warning" : "primary"} size="sm" type="submit">
                            {editItem ? 'Actualizar Cambios' : 'Guardar en Catálogo'}
                        </Button>
                    </div>
                </Form>

                <div style={{maxHeight:'400px', overflowY:'auto'}}>
                    <Table hover responsive size="sm" className="align-middle">
                        <thead className="bg-white sticky-top">
                            <tr>
                                <th>Categoría</th>
                                <th>Reporte</th>
                                <th>SLA</th>
                                <th>Estado</th>
                                <th className="text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="5" className="text-center py-4"><Spinner animation="border" size="sm" /></td></tr> : 
                             tareas.map(t => (
                                <tr key={t.id}>
                                    <td><Badge bg="info" className="fw-normal">{t.categoria}</Badge></td>
                                    <td><div className="fw-bold">{t.nombre}</div></td>
                                    <td className="text-muted">{t.hora_vencimiento || '-'}</td>
                                    <td>{t.activa ? <Badge bg="success">Activa</Badge> : <Badge bg="secondary">Inactiva</Badge>}</td>
                                    <td className="text-end">
                                        <Button variant="link" size="sm" className="p-0 me-2" onClick={() => handleEdit(t)}>✏️</Button>
                                        <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => handleDelete(t.id)}>🗑️</Button>
                                    </td>
                                </tr>
                             ))
                            }
                        </tbody>
                    </Table>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default GestionCatalogModal;
