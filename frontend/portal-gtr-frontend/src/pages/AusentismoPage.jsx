import React, { useState, useMemo } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner, InputGroup, Badge } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../api';

const AusentismoPage = () => {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [reporte, setReporte] = useState([]);
    const [error, setError] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' });

    const isToday = fecha === new Date().toISOString().split('T')[0];

    // Formato de hora "HH:MM" actual para cruce de franja
    const getCurrentTimeStr = () => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const handleUpload = async (endpoint, file) => {
        if (!file) return;
        setUploading(true);
        setStatusMsg(`Subiendo ${file.name}...`);
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/ausentismo/${endpoint}`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Error al subir el archivo');
            
            const result = await response.json();
            setStatusMsg(`Éxito: ${file.name} procesado (${result.upserted || result.inserted || 'OK'})`);
        } catch (err) {
            setError(`Error subiendo ${file.name}: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const fetchReporte = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/ausentismo/reporte-diario?fecha=${fecha}`);
            if (!response.ok) throw new Error('No se pudo obtener el reporte');
            const data = await response.json();
            setReporte(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const kpis = useMemo(() => {
        if (!reporte.length) return null;

        const nowHHMM = getCurrentTimeStr();

        const baseStats = () => ({
            total: 0, 
            ausentes: 0, 
            plan_franja: 0, 
            presentes_plan: 0, 
            presentes_extra: 0
        });

        const groups = {
            front: baseStats(),
            rrss: baseStats(),
            pne: baseStats(),
            otros: baseStats(),
            global: baseStats()
        };

        const processRow = (grp, r) => {
            grp.total++;
            
            // Logica cruzada de estados
            if (r.estado === 'Ausente') grp.ausentes++;
            if (r.estado === 'Presente') grp.presentes_plan++;
            if (r.estado === 'Turno Extra') grp.presentes_extra++;

            // Planificacos hasta la franja (sólo aplica al día de hoy para métricas)
            if (r.hora_inicio_plan && r.hora_inicio_plan <= nowHHMM && r.estado !== 'Libre' && r.estado !== 'Turno Extra') {
                grp.plan_franja++;
            }
        };

        reporte.forEach(r => {
            processRow(groups.global, r);

            const campana = (r.campana || '').toLowerCase();
            
            if (campana.includes('front') || campana.includes('mediatel')) {
                processRow(groups.front, r);
            } else if (campana.includes('pne sod rrss')) {
                processRow(groups.pne, r);
            } else if (campana.includes('rrss')) {
                processRow(groups.rrss, r);
            } else {
                processRow(groups.otros, r);
            }
        });

        const formatGrp = (grp) => ({
            obj: grp,
            pct: grp.total === 0 ? 0 : Math.round((grp.ausentes / grp.total) * 100)
        });

        return {
            front: formatGrp(groups.front),
            rrss: formatGrp(groups.rrss),
            pne: formatGrp(groups.pne),
            otros: formatGrp(groups.otros),
            global: formatGrp(groups.global)
        };
    }, [reporte]);

    const filteredAndSortedReporte = useMemo(() => {
        let result = [...reporte];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(r => 
                (r.nombre && r.nombre.toLowerCase().includes(term)) ||
                (r.rut && r.rut.toLowerCase().includes(term)) ||
                (r.campana && r.campana.toLowerCase().includes(term))
            );
        }

        if (sortConfig.key) {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];
                
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [reporte, searchTerm, sortConfig]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span className="text-muted ms-1 small">⇅</span>;
        return <span className="ms-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const getBadgeColor = (estado) => {
        switch(estado) {
            case 'Presente': return 'success';
            case 'Ausente': return 'danger';
            case 'Turno Extra': return 'info';
            case 'Libre': return 'secondary';
            default: return 'dark';
        }
    };

    const renderKpiBox = (title, data) => (
        <Col>
            <Card className="text-center shadow-sm h-100 border-0 bg-light">
                <Card.Body className="py-2 px-1">
                    <h6 className="text-muted fw-bold mb-1" style={{fontSize: '0.8rem'}}>{title}</h6>
                    <h4 className="mb-2">
                        <Badge bg={data.pct > 10 ? 'danger' : (data.pct > 5 ? 'warning' : 'success')}>
                            {data.pct}%
                        </Badge>
                    </h4>
                    {isToday && (
                        <div className="text-start mt-2 border-top pt-2" style={{fontSize: '0.7rem', lineHeight: '1.2'}}>
                            <div className="d-flex justify-content-between text-muted">
                                <span>Plan Franja:</span>
                                <strong>{data.obj.plan_franja}</strong>
                            </div>
                            <div className="d-flex justify-content-between text-success">
                                <span>Presentes Plan:</span>
                                <strong>{data.obj.presentes_plan}</strong>
                            </div>
                            <div className="d-flex justify-content-between text-info">
                                <span>Presentes Extra:</span>
                                <strong>{data.obj.presentes_extra}</strong>
                            </div>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Col>
    );

    return (
        <Container fluid className="py-4">
            <h2 className="mb-4">Reporte de Ausentismo - Walmart</h2>
            
            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
            {statusMsg && <Alert variant="info" onClose={() => setStatusMsg('')} dismissible>{statusMsg}</Alert>}

            {/* ZONA DE CARGA DE DATOS */}
            <Row className="mb-4">
                <Col md={12}>
                    <Card className="shadow-sm">
                        <Card.Header className="bg-primary text-white">Carga de Datos (Sábanas)</Card.Header>
                        <Card.Body>
                            <Row className="g-3">
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label>1. BBDD Usuarios</Form.Label>
                                        <Form.Control type="file" size="sm" onChange={(e) => handleUpload('subir-usuarios', e.target.files[0])} />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label>2. Planificación (Roster)</Form.Label>
                                        <Form.Control type="file" size="sm" onChange={(e) => handleUpload('subir-planificacion', e.target.files[0])} />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label>3. Log Adereso</Form.Label>
                                        <Form.Control type="file" size="sm" onChange={(e) => handleUpload('subir-log-adereso', e.target.files[0])} />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label>4. Log Mediatel</Form.Label>
                                        <Form.Control type="file" size="sm" onChange={(e) => handleUpload('subir-log-mediatel', e.target.files[0])} />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* KPI BADGES */}
            {kpis && (
                <Row className="mb-4 g-2 row-cols-1 row-cols-md-5">
                    {renderKpiBox('Global', kpis.global)}
                    {renderKpiBox('Front (Mediatel)', kpis.front)}
                    {renderKpiBox('RRSS Cerradas', kpis.rrss)}
                    {renderKpiBox('PNE SOD RRSS', kpis.pne)}
                    {renderKpiBox('Otros', kpis.otros)}
                </Row>
            )}

            {/* TABLA DE RESULTADOS */}
            <Card className="shadow-sm">
                <Card.Header className="bg-light">
                    <Row className="align-items-center">
                        <Col md={4}>
                            <h5 className="mb-0">Resultados del Reporte</h5>
                        </Col>
                        <Col md={8} className="d-flex justify-content-end gap-2">
                            <InputGroup size="sm" style={{ width: '250px' }}>
                                <InputGroup.Text>🔍</InputGroup.Text>
                                <Form.Control 
                                    placeholder="Buscar por Nombre, RUT o LOB..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </InputGroup>
                            <Form.Control 
                                type="date" 
                                size="sm" 
                                value={fecha} 
                                onChange={(e) => setFecha(e.target.value)} 
                                style={{ width: '150px' }}
                            />
                            <Button variant="success" size="sm" onClick={fetchReporte} disabled={loading || uploading}>
                                {loading ? <Spinner animation="border" size="sm" /> : 'Generar Reporte'}
                            </Button>
                        </Col>
                    </Row>
                </Card.Header>
                <Card.Body>
                    <Table striped bordered hover responsive size="sm" className="mb-0 text-center align-middle">
                        <thead className="table-dark">
                            <tr>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('rut')}>RUT <SortIcon column="rut" /></th>
                                <th style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => handleSort('nombre')}>Nombre <SortIcon column="nombre" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('campana')}>LOB <SortIcon column="campana" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('planificado')}>Planificado <SortIcon column="planificado" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('horas_plan')}>Hrs. Plan <SortIcon column="horas_plan" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('h_adereso')}>Hrs. Adereso <SortIcon column="h_adereso" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('h_mediatel')}>Hrs. Mediatel <SortIcon column="h_mediatel" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('estado')}>Estado <SortIcon column="estado" /></th>
                                <th>Alertas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedReporte.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-4">No hay datos para mostrar. Ajuste los filtros o genere el reporte.</td>
                                </tr>
                            ) : (
                                filteredAndSortedReporte.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{item.rut}</td>
                                        <td className="text-start">{item.nombre}</td>
                                        <td>{item.campana}</td>
                                        <td>{item.planificado}</td>
                                        <td>{item.horas_plan}h</td>
                                        <td>{item.h_adereso > 0 ? `${item.h_adereso}h` : '-'}</td>
                                        <td>{item.h_mediatel > 0 ? `${item.h_mediatel}h` : '-'}</td>
                                        <td>
                                            <Badge bg={getBadgeColor(item.estado)}>
                                                {item.estado}
                                            </Badge>
                                        </td>
                                        <td>
                                            {item.concurrente && (
                                                <Badge bg="warning" text="dark" className="me-1">Doble Logueo</Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default AusentismoPage;
