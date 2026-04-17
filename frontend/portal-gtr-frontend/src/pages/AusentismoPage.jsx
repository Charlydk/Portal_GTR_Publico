import React, { useState, useMemo } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner, Badge, ButtonGroup, InputGroup } from 'react-bootstrap';
import { API_BASE_URL, fetchWithAuth } from '../api';

const AusentismoPage = () => {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [reporte, setReporte] = useState([]);
    const [logCargas, setLogCargas] = useState({});
    const [error, setError] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');

    // Filtros de vista
    const [filtroPais, setFiltroPais] = useState('Global');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' });
    const [filtroLobs, setFiltroLobs] = useState(new Set());
    const [filtroEstados, setFiltroEstados] = useState(new Set());
    const [filtroPlanificados, setFiltroPlanificados] = useState(new Set());

    const isToday = fecha === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

    // Hora actual en Chile (todo el sistema opera en horario Santiago)
    const getChileTimeStr = () => {
        return new Date().toLocaleTimeString('en-GB', {
            timeZone: 'America/Santiago',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const formatFechaCarga = (logObj) => {
        if (!logObj || !logObj.fecha) return 'Sin datos';
        const d = new Date(logObj.fecha);
        const dateStr = d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit' });
        const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' });
        return `${dateStr} ${timeStr}`;
    };

    const renderLogList = (prefix) => {
        const keys = Object.keys(logCargas).filter(k => k.startsWith(prefix));
        if (keys.length === 0) return (
            <div className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-clock-history me-1"></i>Sin datos
            </div>
        );

        return (
            <div className="mb-2">
                {keys.map(k => {
                    const label = k === 'Usuarios' ? 'BD' : k.replace(prefix + ' ', '');

                    let extraText = '';
                    if (logCargas[k] && logCargas[k].nombre) {
                        const nombreStr = String(logCargas[k].nombre);
                        if (prefix === 'Planificacion' && nombreStr.includes('Roster')) {
                            const partes = nombreStr.split('Roster');
                            extraText = ` - ${partes.length > 1 ? partes[1].trim() : nombreStr}`;
                        } else if (prefix !== 'Usuarios') {
                            extraText = ` - ${nombreStr}`;
                        }
                    }

                    return (
                        <div key={k} className="text-muted" style={{ fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={logCargas[k]?.nombre || ''}>
                            <i className="bi bi-clock-history me-1"></i>
                            <strong>{label}:</strong> {formatFechaCarga(logCargas[k])}<span className="opacity-75">{extraText}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const fetchLogCargas = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/ausentismo/estado-cargas`);
            if (response.ok) {
                const data = await response.json();
                setLogCargas(data);
            }
        } catch (err) { }
    };

    React.useEffect(() => {
        fetchLogCargas();
    }, []);

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
            fetchLogCargas(); // Actualizar indicadores

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

            // Ajuste en vivo: Si es hoy, y están Ausentes pero su turno aún no comenzó, pasarlos a Pendiente
            const nowHHMM = getChileTimeStr();
            const isQueryingToday = fecha === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

            const adjustedData = data.map(r => {
                if (isQueryingToday && r.estado === 'Ausente' && r.hora_inicio_plan && r.hora_inicio_plan > nowHHMM) {
                    return { ...r, estado: 'Pendiente' };
                }
                return r;
            });

            setReporte(adjustedData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const kpis = useMemo(() => {
        if (!reporte.length) return null;

        const nowHHMM = getChileTimeStr();

        const baseStats = () => ({
            total: 0,
            ausentes: 0,
            ausentes_franja: 0,   // ausentes cuyo turno YA empezó
            dotacion_esperada: 0, // planificados cuyo turno YA empezó
            presentes_plan: 0,
            presentes_extra: 0
        });

        const groups = {
            front: baseStats(),
            rrss: baseStats(),
            pne: baseStats(),
            global: baseStats()
        };

        const processRow = (grp, r) => {
            grp.total++;

            if (r.estado === 'Ausente') grp.ausentes++;
            if (r.estado === 'Presente') grp.presentes_plan++;
            if (r.estado === 'Turno Extra') grp.presentes_extra++;

            // Dotación esperada: agentes con turno planificado que ya debería haber comenzado
            const turnoEmpezado = r.hora_inicio_plan && (!isToday || r.hora_inicio_plan <= nowHHMM)
                && r.estado !== 'Libre' && r.estado !== 'Turno Extra';
            if (turnoEmpezado) {
                grp.dotacion_esperada++;
                if (r.estado === 'Ausente') grp.ausentes_franja++;
            }
        };

        reporte.forEach(r => {
            if (filtroPais !== 'Global' && r.pais !== filtroPais) return;

            const campana = (r.campana || '').toLowerCase();

            if (campana.includes('front') && !campana.includes('mediatel')) {
                processRow(groups.front, r);
                processRow(groups.global, r); // global = solo LOBs medidos
            } else if (campana.includes('pne sod rrss') || campana.includes('pne')) {
                processRow(groups.pne, r);
                processRow(groups.global, r);
            } else if (campana.includes('rrss')) {
                processRow(groups.rrss, r);
                processRow(groups.global, r);
            }
            // Los LOBs no clasificados NO entran al global
        });

        const formatGrp = (grp) => {
            // El porcentaje siempre debe ser sobre la dotación esperada, no sobre el padrón total
            const num = grp.ausentes_franja;
            const den = grp.dotacion_esperada;
            const pctNormal = den === 0 ? 0 : Math.round((num / den) * 100);

            // Ausentismo Prima = (Ausentes - Presentes_Extra) / Dotacion Esperada
            const primaRaw = grp.ausentes_franja - grp.presentes_extra;
            const pctPrima = den === 0 ? 0 : Math.round((primaRaw / den) * 100);

            return {
                obj: grp,
                pct: pctNormal,
                pctPrima: pctPrima
            };
        };

        return {
            front: formatGrp(groups.front),
            rrss: formatGrp(groups.rrss),
            pne: formatGrp(groups.pne),
            global: formatGrp(groups.global)
        };
    }, [reporte, filtroPais]);

    // Valores únicos para los segmentadores (derivados del reporte completo)
    const opcionesLobs = useMemo(() => [...new Set(reporte.map(r => r.campana).filter(Boolean))].sort(), [reporte]);
    const opcionesEstados = useMemo(() => [...new Set(reporte.map(r => r.estado).filter(Boolean))].sort(), [reporte]);
    const opcionesPlanificados = useMemo(() => [...new Set(reporte.map(r => r.planificado).filter(Boolean))].sort(), [reporte]);

    const toggleFiltro = (set, setFn, valor) => {
        setFn(prev => {
            const next = new Set(prev);
            if (next.has(valor)) next.delete(valor); else next.add(valor);
            return next;
        });
    };

    const filteredAndSortedReporte = useMemo(() => {
        let result = [...reporte];

        if (filtroPais !== 'Global') {
            result = result.filter(r => r.pais === filtroPais);
        }
        if (filtroLobs.size > 0) {
            result = result.filter(r => filtroLobs.has(r.campana));
        }
        if (filtroEstados.size > 0) {
            result = result.filter(r => filtroEstados.has(r.estado));
        }
        if (filtroPlanificados.size > 0) {
            result = result.filter(r => filtroPlanificados.has(r.planificado));
        }

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
    }, [reporte, searchTerm, sortConfig, filtroPais, filtroLobs, filtroEstados, filtroPlanificados]);

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
        switch (estado) {
            case 'Presente': return 'success';
            case 'Ausente': return 'danger';
            case 'Turno Extra': return 'info';
            case 'Libre': return 'secondary';
            case 'Pendiente': return 'warning';
            default: return 'dark';
        }
    };

    const renderKpiBox = (title, data) => (
        <Col>
            <Card className="text-center shadow-sm h-100 border-0 bg-light">
                <Card.Body className="py-2 px-1">
                    <h6 className="text-muted fw-bold mb-1" style={{ fontSize: '0.8rem' }}>{title}</h6>
                    <h4 className="mb-2 d-flex justify-content-center gap-2">
                        <Badge bg={data.pct > 10 ? 'danger' : (data.pct > 5 ? 'warning' : 'success')} title="Ausentismo Bruto">
                            Bruto: {data.pct}%
                        </Badge>
                        <Badge bg={data.pctPrima > 10 ? 'danger' : (data.pctPrima > 0 ? 'warning' : 'primary')} title="Ausentismo Prima (Real compensado)">
                            Prima: {data.pctPrima}%
                        </Badge>
                    </h4>
                    <div className="text-start mt-2 border-top pt-2" style={{ fontSize: '0.7rem', lineHeight: '1.6' }}>
                        <div className="d-flex justify-content-between text-muted">
                            <span>Dotación esperada:</span>
                            <strong>{data.obj.dotacion_esperada}</strong>
                        </div>
                        <div className="d-flex justify-content-between text-success">
                            <span>Presentes (plan):</span>
                            <strong>{data.obj.presentes_plan}</strong>
                        </div>
                        <div className="d-flex justify-content-between text-info">
                            <span>Presentes (extra):</span>
                            <strong>{data.obj.presentes_extra}</strong>
                        </div>
                        <div className="d-flex justify-content-between text-danger">
                            <span>Ausentes:</span>
                            <strong>{data.obj.ausentes_franja}</strong>
                        </div>
                    </div>
                </Card.Body>
            </Card>
        </Col>
    );

    return (
        <Container fluid className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Reporte de Ausentismo - Walmart</h2>
                <div>
                    <ButtonGroup size="sm" className="shadow-sm">
                        <Button variant={filtroPais === 'Global' ? 'primary' : 'outline-primary'} onClick={() => setFiltroPais('Global')}>Global</Button>
                        <Button variant={filtroPais === 'Chile' ? 'primary' : 'outline-primary'} onClick={() => setFiltroPais('Chile')}>Chile (CL)</Button>
                        <Button variant={filtroPais === 'Paraguay' ? 'primary' : 'outline-primary'} onClick={() => setFiltroPais('Paraguay')}>Paraguay (PRY)</Button>
                    </ButtonGroup>
                </div>
            </div>

            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
            {statusMsg && <Alert variant="info" onClose={() => setStatusMsg('')} dismissible>{statusMsg}</Alert>}

            {/* ZONA DE CARGA DE DATOS */}
            <Row className="mb-4">
                <Col md={12}>
                    <Card className="shadow-sm">
                        <Card.Header className="bg-primary text-white">Carga de Datos (Sábanas) &mdash; <small>Reporte con huso horario de Chile</small></Card.Header>
                        <Card.Body>
                            <Row className="g-3">
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label className="mb-0">1. BBDD Usuarios</Form.Label>
                                        {renderLogList('Usuarios')}
                                        <Form.Control type="file" size="sm" onChange={(e) => handleUpload('subir-usuarios', e.target.files[0])} />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label className="mb-0">2. Planificación (Roster)</Form.Label>
                                        {renderLogList('Planificacion')}
                                        <Form.Control type="file" size="sm" onChange={(e) => handleUpload('subir-planificacion', e.target.files[0])} />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label className="mb-0">3. Log Adereso</Form.Label>
                                        {renderLogList('Adereso')}
                                        <Form.Control type="file" size="sm" onChange={(e) => handleUpload('subir-log-adereso', e.target.files[0])} />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group>
                                        <Form.Label className="mb-0">4. Log Mediatel</Form.Label>
                                        {renderLogList('Mediatel')}
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
                <Row className="mb-4 g-2 row-cols-1 row-cols-md-4">
                    {renderKpiBox('Global', kpis.global)}
                    {renderKpiBox('Front', kpis.front)}
                    {renderKpiBox('RRSS Cerradas', kpis.rrss)}
                    {renderKpiBox('PNe SOD RRSS', kpis.pne)}
                </Row>
            )}

            {/* TABLA DE RESULTADOS */}
            <Card className="shadow-sm">
                <Card.Header className="bg-light">
                    <Row className="align-items-center mb-2">
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
                    {reporte.length > 0 && (
                        <div className="border-top pt-2">
                            <div className="d-flex flex-wrap gap-1 mb-1 align-items-center">
                                <span className="text-muted fw-semibold me-1" style={{ fontSize: '0.72rem' }}>LOB:</span>
                                {opcionesLobs.map(lob => (
                                    <Button key={lob} size="sm" onClick={() => toggleFiltro(filtroLobs, setFiltroLobs, lob)}
                                        variant={filtroLobs.has(lob) ? 'primary' : 'outline-secondary'}
                                        style={{ fontSize: '0.7rem', padding: '1px 7px', lineHeight: '1.4' }}>
                                        {lob}
                                    </Button>
                                ))}
                                {filtroLobs.size > 0 && <Button size="sm" variant="link" className="text-danger p-0 ms-1" style={{ fontSize: '0.7rem' }} onClick={() => setFiltroLobs(new Set())}>✕ Limpiar</Button>}
                            </div>
                            <div className="d-flex flex-wrap gap-1 mb-1 align-items-center">
                                <span className="text-muted fw-semibold me-1" style={{ fontSize: '0.72rem' }}>Estado:</span>
                                {opcionesEstados.map(est => (
                                    <Button key={est} size="sm" onClick={() => toggleFiltro(filtroEstados, setFiltroEstados, est)}
                                        variant={filtroEstados.has(est) ? 'primary' : 'outline-secondary'}
                                        style={{ fontSize: '0.7rem', padding: '1px 7px', lineHeight: '1.4' }}>
                                        {est}
                                    </Button>
                                ))}
                                {filtroEstados.size > 0 && <Button size="sm" variant="link" className="text-danger p-0 ms-1" style={{ fontSize: '0.7rem' }} onClick={() => setFiltroEstados(new Set())}>✕ Limpiar</Button>}
                            </div>
                            <div className="d-flex flex-wrap gap-1 align-items-center">
                                <span className="text-muted fw-semibold me-1" style={{ fontSize: '0.72rem' }}>Horario:</span>
                                {opcionesPlanificados.map(h => (
                                    <Button key={h} size="sm" onClick={() => toggleFiltro(filtroPlanificados, setFiltroPlanificados, h)}
                                        variant={filtroPlanificados.has(h) ? 'primary' : 'outline-secondary'}
                                        style={{ fontSize: '0.7rem', padding: '1px 7px', lineHeight: '1.4' }}>
                                        {h}
                                    </Button>
                                ))}
                                {filtroPlanificados.size > 0 && <Button size="sm" variant="link" className="text-danger p-0 ms-1" style={{ fontSize: '0.7rem' }} onClick={() => setFiltroPlanificados(new Set())}>✕ Limpiar</Button>}
                            </div>
                        </div>
                    )}
                </Card.Header>
                <Card.Body>
                    <Table striped bordered hover responsive size="sm" className="mb-0 text-center align-middle">
                        <thead className="table-dark">
                            <tr>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('rut')}>RUT <SortIcon column="rut" /></th>
                                <th style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => handleSort('nombre')}>Nombre <SortIcon column="nombre" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('campana')}>LOB <SortIcon column="campana" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('pais')}>País <SortIcon column="pais" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('planificado')}>Planificado <SortIcon column="planificado" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('horas_plan')}>Hrs. Plan <SortIcon column="horas_plan" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('h_adereso')}>Hrs. Adereso <SortIcon column="h_adereso" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('h_mediatel')}>Hrs. Mediatel <SortIcon column="h_mediatel" /></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('estado')}>Estado <SortIcon column="estado" /></th>

                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedReporte.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-4">No hay datos para mostrar. Ajuste los filtros o genere el reporte.</td>
                                </tr>
                            ) : (
                                filteredAndSortedReporte.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{item.rut}</td>
                                        <td className="text-start">{item.nombre}</td>
                                        <td>{item.campana}</td>
                                        <td>{item.pais || '-'}</td>
                                        <td>{item.planificado}</td>
                                        <td>{item.horas_plan}h</td>
                                        <td>{item.h_adereso > 0 ? `${item.h_adereso}h` : '-'}</td>
                                        <td>{item.h_mediatel > 0 ? `${item.h_mediatel}h` : '-'}</td>
                                        <td>
                                            <Badge bg={getBadgeColor(item.estado)}>
                                                {item.estado}
                                            </Badge>
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
