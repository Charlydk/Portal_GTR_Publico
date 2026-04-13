import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Table, Badge, Spinner, Alert } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { useAuth } from '../../hooks/useAuth';

const GestionCatalogModal = ({ show, onHide }) => {
    const { user } = useAuth();

    const [tareas, setTareas] = useState([]);
    const [bolsaHoy, setBolsaHoy] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tomando, setTomando] = useState(null);
    const [mensajeExito, setMensajeExito] = useState(null);

    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const [resCatalogo, resBolsa] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/api/reporteria/catalogo`),
                fetchWithAuth(`${API_BASE_URL}/api/reporteria/bolsa`)
            ]);
            
            if (resCatalogo.ok) setTareas(await resCatalogo.json());
            if (resBolsa.ok) setBolsaHoy(await resBolsa.json());
        } catch (e) { 
            console.error(e); 
        } finally { 
            setLoading(false); 
        }
    }, []);

    useEffect(() => {
        if (show) {
            setMensajeExito(null);
            cargarDatos();
        }
    }, [show, cargarDatos]);

    const handleTomar = async (bolsaItem) => {
        setTomando(bolsaItem.id);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/api/reporteria/bolsa/${bolsaItem.id}/tomar`, { method: 'PUT' });
            if (res.ok) {
                setMensajeExito(`✅ Tomaste "${bolsaItem.nombre}" — ¡ya está en tu sesión!`);
                cargarDatos();
            } else {
                const err = await res.json().catch(() => ({}));
                setMensajeExito(`⚠️ ${err.detail || 'No se pudo tomar la tarea'}`);
            }
        } catch (e) {
            console.error(e);
            setMensajeExito('❌ Error de conexión');
        } finally {
            setTomando(null);
        }
    };

    const getBolsaItem = (catalogItem) =>
        bolsaHoy.find(b => b.nombre === catalogItem.nombre);

    return (
        <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
            <Modal.Header closeButton className="bg-light">
                <Modal.Title className="h6 fw-bold">
                    📋 Catálogo de Reportería — Tareas Disponibles
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {mensajeExito && (
                    <Alert
                        variant={mensajeExito.startsWith('✅') ? 'success' : 'warning'}
                        dismissible
                        onClose={() => setMensajeExito(null)}
                        className="py-2 small"
                    >
                        {mensajeExito}
                    </Alert>
                )}

                <p className="text-muted small mb-3">
                    Estas son las tareas de reportería configuradas para hoy. Podés tomar las que están <Badge bg="warning" text="dark">Pendiente</Badge> y aún no tienen analista asignado.
                </p>

                <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <Table hover responsive size="sm" className="align-middle">
                        <thead className="bg-white sticky-top">
                            <tr>
                                <th>Categoría</th>
                                <th>Reporte</th>
                                <th>SLA</th>
                                <th className="text-center">Estado Hoy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? <tr><td colSpan="4" className="text-center py-4"><Spinner animation="border" size="sm" /></td></tr>
                                : tareas.length === 0
                                    ? <tr><td colSpan="4" className="text-center py-4 text-muted">No hay tareas en el catálogo</td></tr>
                                    : tareas.filter(t => t.activa).map(t => {
                                        const bolsaItem = getBolsaItem(t);
                                        const esPendiente = bolsaItem?.estado === 'PENDIENTE';
                                        const esEnProceso = bolsaItem?.estado === 'EN_PROCESO';
                                        const esCompletado = bolsaItem?.estado === 'COMPLETADO';
                                        const esPropia = bolsaItem?.analista_id === user?.id;

                                        return (
                                            <tr key={t.id}>
                                                <td><Badge bg="info" className="fw-normal">{t.categoria}</Badge></td>
                                                <td>
                                                    <div className="fw-bold">{t.nombre}</div>
                                                    {t.descripcion && <div className="text-muted small" style={{fontSize: '0.75rem'}}>{t.descripcion}</div>}
                                                </td>
                                                <td className="text-muted">{t.hora_vencimiento ? t.hora_vencimiento.substring(0,5) : '-'}</td>
                                                <td className="text-center">
                                                    {!bolsaItem ? (
                                                        <Badge bg="light" text="muted" className="border">Sin instancia hoy</Badge>
                                                    ) : esCompletado ? (
                                                        <Badge bg="success">✓ Completado</Badge>
                                                    ) : esEnProceso && esPropia ? (
                                                        <Badge bg="info">▶ En curso (tuya)</Badge>
                                                    ) : esEnProceso ? (
                                                        <Badge bg="secondary">En curso (otro)</Badge>
                                                    ) : esPendiente ? (
                                                        <Button
                                                            variant="warning"
                                                            size="sm"
                                                            className="py-0 px-2 fw-bold"
                                                            onClick={() => handleTomar(bolsaItem)}
                                                            disabled={tomando === bolsaItem.id}
                                                        >
                                                            {tomando === bolsaItem.id
                                                                ? <Spinner animation="border" size="sm" />
                                                                : '⚡ Tomar'}
                                                        </Button>
                                                    ) : (
                                                        <Badge bg="light" text="muted" className="border">{bolsaItem.estado}</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                            }
                        </tbody>
                    </Table>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default GestionCatalogModal;
