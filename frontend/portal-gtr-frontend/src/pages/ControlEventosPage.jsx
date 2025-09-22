// RUTA: src/pages/ControlEventosPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Spinner, Alert, Form, Button, Row, Col, Table } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL } from '../api';

function ControlEventosPage() {
    const { authToken } = useAuth();
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [filtros, setFiltros] = useState({
        fecha_inicio: '', fecha_fin: '', campana_id: '', autor_id: ''
    });
    const [listaCampanas, setListaCampanas] = useState([]);
    const [listaAnalistas, setListaAnalistas] = useState([]);

    const fetchFilterData = useCallback(async () => {
        if (!authToken) return;
        try {
            const [campanasRes, analistasRes] = await Promise.all([
                fetch(`${GTR_API_URL}/campanas/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${GTR_API_URL}/analistas/listado-simple/`, { headers: { 'Authorization': `Bearer ${authToken}` } })
            ]);
            if (!campanasRes.ok || !analistasRes.ok) throw new Error("No se pudieron cargar los datos para los filtros.");
            setListaCampanas(await campanasRes.json());
            setListaAnalistas(await analistasRes.json());
        } catch (err) { setError(err.message); }
    }, [authToken]);

    useEffect(() => { fetchFilterData(); }, [fetchFilterData]);

    const fetchEventos = useCallback(async () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        Object.entries(filtros).forEach(([key, value]) => { if (value) params.append(key, value); });

        try {
            const response = await fetch(`${GTR_API_URL}/bitacora/filtrar/?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) { const d = await response.json(); throw new Error(d.detail); }
            setEventos(await response.json());
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    }, [authToken, filtros]);

    const handleFiltroChange = (e) => setFiltros(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleLimpiarFiltros = () => {
        setFiltros({ fecha_inicio: '', fecha_fin: '', campana_id: '', autor_id: '' });
        setEventos([]);
    };

    const handleExportar = async () => {
        setIsExporting(true);
        setError(null);
        try {
            const payload = {
                fecha_inicio: filtros.fecha_inicio || null,
                fecha_fin: filtros.fecha_fin || null,
                campana_id: filtros.campana_id ? parseInt(filtros.campana_id) : null,
                lob: filtros.lob || null,
                autor_id: filtros.autor_id ? parseInt(filtros.autor_id) : null,
            };
            const response = await fetch(`${GTR_API_URL}/bitacora/exportar/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`},
                body: JSON.stringify(payload)
            });
            if (!response.ok) { const errData = await response.json(); throw new Error(errData.detail); }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_Eventos_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) { setError(err.message); } 
        finally { setIsExporting(false); }
    };

    return (
        <Container fluid className="py-4">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center bg-info text-white">Portal de Control de Eventos</Card.Header>
                <Card.Body>
                    <Card className="mb-4 p-3 bg-light">
                        <Form>
                            <Row className="g-3">
                                <Col md={3}><Form.Group><Form.Label>Desde Fecha</Form.Label><Form.Control type="date" name="fecha_inicio" value={filtros.fecha_inicio} onChange={handleFiltroChange} /></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Hasta Fecha</Form.Label><Form.Control type="date" name="fecha_fin" value={filtros.fecha_fin} onChange={handleFiltroChange} /></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Campaña</Form.Label><Form.Select name="campana_id" value={filtros.campana_id} onChange={handleFiltroChange}><option value="">Todas</option>{listaCampanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Form.Group></Col>
                                <Col md={3}><Form.Group><Form.Label>Autor</Form.Label><Form.Select name="autor_id" value={filtros.autor_id} onChange={handleFiltroChange}><option value="">Todos</option>{listaAnalistas.map(a => <option key={a.id} value={a.id}>{`${a.nombre} ${a.apellido}`}</option>)}</Form.Select></Form.Group></Col>
                                <Col md={6} className="d-flex align-items-end gap-2">
                                    <Button variant="primary" onClick={fetchEventos} disabled={loading || isExporting} className="w-100">{loading ? <Spinner size="sm" /> : 'Filtrar'}</Button>
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
                                <tr><th>Fecha</th><th>Hora</th><th>Campaña</th><th>Lob</th><th>Autor</th><th>Comentario</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="5" className="text-center"><Spinner /></td></tr>
                                ) : eventos.length > 0 ? (
                                    eventos.map(evt => (
                                        <tr key={evt.id}>
                                            <td>{evt.fecha}</td>
                                            <td>{evt.hora}</td>
                                            <td>{evt.campana.nombre}</td>
                                            <td>{evt.lob ? evt.lob.nombre : 'N/A'}</td>
                                            <td>{`${evt.autor.nombre} ${evt.autor.apellido}`}</td>
                                            <td>{evt.comentario}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="5" className="text-center text-muted">No se encontraron eventos.</td></tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>
        </Container>
    );
}

export default ControlEventosPage;