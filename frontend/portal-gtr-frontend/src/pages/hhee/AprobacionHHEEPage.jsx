// src/pages/hhee/AprobacionHHEEPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Card, Spinner, Alert, Table, Button, Form, Badge } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL, fetchWithAuth } from '../../api';
import { decimalToHHMM, hhmmToDecimal } from '../../utils/timeUtils';
import { Link } from 'react-router-dom';


const getPeriodoActual = () => {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();
    const fechaFin = new Date(anioActual, mesActual, 25);
    const fechaInicio = new Date(anioActual, mesActual - 1, 26);
    const aISO = (fecha) => fecha.toISOString().split('T')[0];
    return { inicio: aISO(fechaInicio), fin: aISO(fechaFin) };
};

function AprobacionHHEEPage() {
    // ... (toda la lógica de estados y funciones de fetch/guardado no cambia) ...
    const { authToken } = useAuth();
    const [solicitudes, setSolicitudes] = useState([]);
    const [cambios, setCambios] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const fetchPendientes = useCallback(async () => {
        if (!authToken) return;
        const periodo = getPeriodoActual();
        const url = `${API_BASE_URL}/hhee/solicitudes/pendientes/?fecha_inicio=${periodo.inicio}&fecha_fin=${periodo.fin}`;
        setLoading(true);
        setError(null);
        try {
            const response = await fetchWithAuth(url,{});
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'No se pudieron cargar las solicitudes pendientes.');
            }
            const data = await response.json();
            setSolicitudes(data);
            setCambios({});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        fetchPendientes();
    }, [fetchPendientes]);

    const solicitudesAgrupadas = useMemo(() => {
        return solicitudes.reduce((acc, solicitud) => {
            const nombreAnalista = `${solicitud.solicitante.nombre} ${solicitud.solicitante.apellido}`;
            if (!acc[nombreAnalista]) { acc[nombreAnalista] = []; }
            acc[nombreAnalista].push(solicitud);
            return acc;
        }, {});
    }, [solicitudes]);

    const handleChanges = (solicitudId, campo, valor) => {
        setCambios(prev => ({ ...prev, [solicitudId]: { ...prev[solicitudId], [campo]: valor } }));
    };
    
    const handleGuardarCambios = async () => {
        setSubmitting(true);
        setError(null);
        setSuccess(null);
    
        const decisiones = Object.entries(cambios).map(([solicitudIdStr, cambio]) => {
            const solicitudId = parseInt(solicitudIdStr);
                  
            // 1. Buscamos la solicitud original para obtener sus datos por defecto.
            const solicitudOriginal = solicitudes.find(s => s.id === solicitudId);
            if (!solicitudOriginal) return null;
    
            // 2. Replicamos la lógica para saber cuál era el cálculo sugerido por el sistema.
            const gv = solicitudOriginal.datos_geovictoria || {};
            let calculoSugerido = 0;
            if (solicitudOriginal.tipo === 'ANTES_TURNO') {
                calculoSugerido = gv.hhee_inicio_calculadas || 0;
            } else if (solicitudOriginal.tipo === 'DESPUES_TURNO') {
                calculoSugerido = gv.hhee_fin_calculadas || 0;
            } else if (solicitudOriginal.tipo === 'DIA_DESCANSO') {
                calculoSugerido = gv.cantidad_hhee_calculadas || 0;
            }
            
            // 3. Determinamos el valor final en formato HH:MM.
            // Será el valor que el supervisor editó, o si no lo tocó, el cálculo del sistema.
            const valorFinalHHMM = cambio.horas_aprobadas ?? decimalToHHMM(calculoSugerido);
            
            // 4. Convertimos ese valor final a decimal para enviarlo a la API.
            const horasDecimales = hhmmToDecimal(valorFinalHHMM);
    
            return {
                solicitud_id: solicitudId,
                estado: cambio.estado || 'PENDIENTE',
                horas_aprobadas: horasDecimales,
                comentario_supervisor: cambio.comentario_supervisor ?? '' // Usamos el comentario editado o uno vacío
            };
           
        }).filter(d => d && d.estado !== 'PENDIENTE'); // Filtramos nulos y los que no se tocaron
    
        if (decisiones.length === 0) {
            setError("No se ha realizado ninguna aprobación o rechazo.");
            setSubmitting(false);
            return;
        }
    
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/hhee/solicitudes/procesar-lote/`, {
                method: 'POST',
                headers: {
            'Content-Type': 'application/json'
             },
                body: JSON.stringify({ decisiones }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al procesar el lote.');
            }
            const result = await response.json();
            setSuccess(result.detail);
            fetchPendientes();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };
    if (loading) return <Container className="text-center py-5"><Spinner /></Container>;

    return (
        <Container fluid className="py-4 px-xl-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="d-flex justify-content-between align-items-center bg-warning">
                    <span>Panel de Aprobación Masiva de HHEE</span>
                    <Link to="/historial-aprobaciones" className="btn btn-dark btn-sm">
                        Ver Historial de Gestiones
                    </Link>
                </Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {success && <Alert variant="success">{success}</Alert>}
                    <div className="d-flex justify-content-end mb-3">
                        <Button onClick={handleGuardarCambios} disabled={submitting || Object.keys(cambios).length === 0}>
                            {submitting ? <Spinner size="sm"/> : 'Guardar Todos los Cambios'}
                        </Button>
                    </div>

                    {Object.keys(solicitudesAgrupadas).length > 0 ? (
                        Object.entries(solicitudesAgrupadas).map(([nombreAnalista, solicitudesAnalista]) => (
                            <div key={nombreAnalista} className="mb-4">
                                <h4>{nombreAnalista}</h4>
                                {/* --- INICIO DEL REDISEÑO DE LA TABLA --- */}
                                <Table striped bordered hover responsive size="sm">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        {/* --- LÍNEA A MODIFICAR --- */}
                                        <th style={{ minWidth: '180px' }}>Turno / Marcas</th>
                                        {/* ------------------------- */}
                                        <th>Validación HHEE</th>
                                        <th>Comentario</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                    <tbody>
                                        {solicitudesAnalista.map(sol => {
                                            const cambioActual = cambios[sol.id] || {};
                                            const gv = sol.datos_geovictoria || {};
                                            
                                            // --- Determinar el cálculo sugerido correcto ---
                                            let calculoSugerido = 0;
                                            if (sol.tipo === 'ANTES_TURNO') {
                                                calculoSugerido = gv.hhee_inicio_calculadas || 0;
                                            } else if (sol.tipo === 'DESPUES_TURNO') {
                                                calculoSugerido = gv.hhee_fin_calculadas || 0;
                                            } else if (sol.tipo === 'DIA_DESCANSO') {
                                                // Para día de descanso, sí usamos el total
                                                calculoSugerido = gv.cantidad_hhee_calculadas || 0;
                                            }
                                            

                                            // --- FUNCIÓN DE FORMATEO HORA LOCAL ---
                                            const formatDateOnly = (dateString) => {
                                                if (!dateString) return 'N/A';
                                                const [year, month, day] = dateString.split('-');
                                                return `${day}/${month}/${year}`;
                                            };
                                            // ---------------------------------

                                            // Obtenemos el valor actual del input, ya sea el editado o el por defecto.
                                            const valorActualHHMM = cambioActual.horas_aprobadas ?? decimalToHHMM(calculoSugerido);
                                            // Comparamos el valor actual (convertido a decimal) con el máximo permitido.
                                            const isInvalid = hhmmToDecimal(valorActualHHMM) > calculoSugerido;

                                            return (
                                                <tr key={sol.id}>
                                                    <td>
                                                        {formatDateOnly(sol.fecha_hhee)}
                                                        <div className="text-muted small">{sol.justificacion}</div>
                                                    </td>
                                                    <td style={{ minWidth: '180px' }}>
                                                        {gv.inicio_turno_teorico === '00:00' && gv.fin_turno_teorico === '00:00' ? (
                                                            <div><Badge bg="secondary">Turno</Badge> <span className="fw-bold dark">Descanso</span></div>
                                                        ) : (
                                                            <div><Badge bg="secondary">Turno</Badge> {gv.inicio_turno_teorico || 'N/A'} - {gv.fin_turno_teorico || 'N/A'}</div>
                                                        )}
                                                        <div><Badge>Marcas</Badge> {gv.marca_real_inicio || 'N/A'} - {gv.marca_real_fin || 'N/A'}</div>
                                                    </td>
                                                    <td>
                                                    <div className="d-flex align-items-center mb-1">
                                                        <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>
                                                            {sol.tipo === 'DIA_DESCANSO' ? 'DESCANSO' : sol.tipo.split('_')[0]}:
                                                        </Form.Label>
                                                            <Form.Control 
                                                                type="time"
                                                                size="sm"
                                                                style={{ width: '120px' }}
                                                                max={decimalToHHMM(calculoSugerido)}
                                                                value={valorActualHHMM}
                                                                onChange={e => handleChanges(sol.id, 'horas_aprobadas', e.target.value)}
                                                                // --- PROPIEDAD AÑADIDA PARA EL ESTILO ROJO ---
                                                                isInvalid={isInvalid}
                                                            />
                                                            <Badge bg="success" className="ms-2">Solic: {decimalToHHMM(sol.horas_solicitadas)}</Badge>
                                                        </div>
                                                    </td>
                                                    <td style={{minWidth: '200px'}}>
                                                        <Form.Control as="textarea" rows={1} size="sm" placeholder="Ajuste por..."
                                                            value={cambioActual.comentario_supervisor ?? ''}
                                                            onChange={e => handleChanges(sol.id, 'comentario_supervisor', e.target.value)}
                                                        />
                                                    </td>
                                                    <td style={{minWidth: '180px'}}>
                                                        <Form.Check inline type="radio" name={`accion-${sol.id}`} label="Aprobar" checked={cambioActual.estado === 'APROBADA'} onChange={() => handleChanges(sol.id, 'estado', 'APROBADA')} />
                                                        <Form.Check inline type="radio" name={`accion-${sol.id}`} label="Rechazar" checked={cambioActual.estado === 'RECHAZADA'} onChange={() => handleChanges(sol.id, 'estado', 'RECHAZADA')} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                        ))
                    ) : (
                        <Alert variant="success" className="text-center">¡Excelente! No hay solicitudes pendientes para el período actual.</Alert>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default AprobacionHHEEPage;