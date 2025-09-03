import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Card, Spinner, Alert, ListGroup, Table, Row, Col, Badge  } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';
import ResultadoFila from '../../components/hhee/ResultadoFila';
import { decimalToHHMM, hhmmToDecimal } from '../../utils/timeUtils';

function PortalHHEEPage() {
    const [rut, setRut] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [resultados, setResultados] = useState([]);
    const [nombreAgente, setNombreAgente] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [validaciones, setValidaciones] = useState({});
    const [guardadoResumen, setGuardadoResumen] = useState(null);
    const { authToken } = useAuth();
    const [isPendientesView, setIsPendientesView] = useState(false);



    // --- 1. NUEVO ESTADO PARA LOS TOTALES ---
    const [totalesResumen, setTotalesResumen] = useState({
        declaradas: 0,
        aprobadasRRHH: 0,
    });

    // --- 2. useEffect PARA CALCULAR LOS TOTALES EN TIEMPO REAL ---
    useEffect(() => {
        if (resultados.length > 0) {
            let totalDeclaradas = 0;
            let totalAprobadasRRHH = 0;

            resultados.forEach(dia => {
                // Sumar lo ya aprobado por RRHH (viene de GeoVictoria)
                totalAprobadasRRHH += (dia.hhee_autorizadas_antes_gv || 0);
                totalAprobadasRRHH += (dia.hhee_autorizadas_despues_gv || 0);

                // Sumar lo que el supervisor está validando en esta sesión
                const validacionDia = validaciones[dia.fecha];
                if (validacionDia) {
                    if (validacionDia.antes.habilitado) {
                        totalDeclaradas += hhmmToDecimal(validacionDia.antes.valor);
                    }
                    if (validacionDia.despues.habilitado) {
                        totalDeclaradas += hhmmToDecimal(validacionDia.despues.valor);
                    }
                    if (validacionDia.descanso.habilitado) {
                        totalDeclaradas += hhmmToDecimal(validacionDia.descanso.valor);
                    }
                }

                // Sumar lo que ya fue validado en sesiones anteriores
                totalDeclaradas += (dia.hhee_aprobadas_inicio || 0);
                totalDeclaradas += (dia.hhee_aprobadas_fin || 0);
                totalDeclaradas += (dia.hhee_aprobadas_descanso || 0);
            });

            setTotalesResumen({
                declaradas: totalDeclaradas,
                aprobadasRRHH: totalAprobadasRRHH,
            });
        }
    }, [validaciones, resultados]); // Se recalcula si cambian las validaciones o los resultados

    const formatRut = (rutString) => {
        if (!rutString) return "";
        let rutLimpio = rutString.replace(/[^0-9kK]/g, '').toUpperCase();
        if (rutLimpio.length <= 1) return rutLimpio;
        
        const cuerpo = rutLimpio.slice(0, -1);
        const dv = rutLimpio.slice(-1);
        return cuerpo + '-' + dv;
    };

    const handleRutBlur = (e) => {
        const rutFormateado = formatRut(e.target.value);
        setRut(rutFormateado);
    };

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Función para formatear nombres
    const formatFullName = (fullName) => {
    if (!fullName) return '';

    // Divide el nombre en un array de palabras
    const words = fullName.toLowerCase().split(' ');

    // Mapea cada palabra para capitalizar la primera letra
    const formattedWords = words.map(word => {
        if (word.length === 0) return '';
        return word.charAt(0).toUpperCase() + word.slice(1);
    });

    // Une las palabras de nuevo en una sola cadena
    return formattedWords.join(' ');
};
    
    const handlePeriodoChange = (seleccion) => {
        let fechaInicio, fechaFin;
        const hoy = new Date();
        switch (seleccion) {
            case 'actual':
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth(), 25);
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 26);
                break;
            case 'anterior':
                fechaFin = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 25);
                fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 26);
                break;
            default:
                setFechaInicio(''); setFechaFin(''); return;
        }
        setFechaInicio(formatDate(fechaInicio));
        setFechaFin(formatDate(fechaFin));
    };

    const initializeValidaciones = (datos) => {
        const initialValidaciones = {};
        datos.forEach(dia => {
            const esDescanso = (dia.inicio_turno_teorico === '00:00' && dia.fin_turno_teorico === '00:00');
            initialValidaciones[dia.fecha] = {
                antes: { habilitado: false, valor: decimalToHHMM(dia.hhee_inicio_calculadas) },
                despues: { habilitado: false, valor: decimalToHHMM(dia.hhee_fin_calculadas) },
                descanso: { habilitado: false, valor: decimalToHHMM(esDescanso ? dia.cantidad_hhee_calculadas : 0) },
                pendiente: dia.estado_final === 'Pendiente por Corrección',
                nota: dia.notas || ''
            };
        });
        setValidaciones(initialValidaciones);
    };

    const handleConsulta = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);
        setResultados([]);
        setNombreAgente('');
        setGuardadoResumen(null);
        setIsPendientesView(false); // Vista Individual

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/consultar-empleado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ rut, fecha_inicio: fechaInicio, fecha_fin: fechaFin })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);

            setNombreAgente(data.nombre_agente);
            setResultados(data.datos_periodo);
            initializeValidaciones(data.datos_periodo);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleCargarPendientes = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setResultados([]);
        setNombreAgente('');
        setGuardadoResumen(null);
        setIsPendientesView(true); // Vista de Pendientes

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/pendientes`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);

            if (!data.datos_periodo || data.datos_periodo.length === 0) {
                setSuccess('¡Excelente! No hay registros pendientes por corregir.');
                return;
            }

            setNombreAgente(data.nombre_agente);
            setResultados(data.datos_periodo);
            initializeValidaciones(data.datos_periodo);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleValidationChange = (fecha, tipo, campo, valor) => {
        setValidaciones(prev => {
            const newState = JSON.parse(JSON.stringify(prev));
            newState[fecha][tipo][campo] = valor;
            if (campo === 'habilitado' && !valor) {
                const diaData = resultados.find(d => d.fecha === fecha);
                if (diaData) {
                    let valorOriginal = "00:00";
                    if (tipo === 'antes') valorOriginal = decimalToHHMM(diaData.hhee_inicio_calculadas);
                    if (tipo === 'despues') valorOriginal = decimalToHHMM(diaData.hhee_fin_calculadas);
                    if (tipo === 'descanso') valorOriginal = decimalToHHMM(diaData.cantidad_hhee_calculadas);
                    newState[fecha][tipo]['valor'] = valorOriginal;
                }
            }
            return newState;
        });
    };

    const handleSimpleChange = (fecha, campo, valor) => {
        setValidaciones(prev => ({
            ...prev,
            [fecha]: { ...prev[fecha], [campo]: valor }
        }));
    };
    
    const handleRevalidar = (rutAgente, fecha) => {
        setResultados(prev => prev.map(dia => 
            dia.fecha === fecha ? { ...dia, estado_final: 'No Guardado', notas: '' } : dia
        ));
        setValidaciones(prev => {
            const diaOriginal = resultados.find(d => d.fecha === fecha);
            return {
                ...prev,
                [fecha]: {
                    ...prev[fecha],
                    pendiente: false,
                    nota: '',
                    revalidado: true,
                    antes: { habilitado: false, valor: decimalToHHMM(diaOriginal.hhee_inicio_calculadas) },
                    despues: { habilitado: false, valor: decimalToHHMM(diaOriginal.hhee_fin_calculadas) },
                    descanso: { habilitado: false, valor: decimalToHHMM(diaOriginal.cantidad_hhee_calculadas) }
                }
            };
        });
    };

    const handleGuardar = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        setGuardadoResumen(null); // Limpiamos resumen previo

        const validacionesParaEnviar = resultados.map(dia => {
            const validacion = validaciones[dia.fecha];
            if (!validacion) return null;

            const debeEnviar = validacion.antes?.habilitado || validacion.despues?.habilitado || validacion.descanso?.habilitado || validacion.pendiente || validacion.revalidado;
            if (!debeEnviar) return null;

            return {
                rut_con_formato: isPendientesView ? dia.rut_con_formato : rut,
                fecha: dia.fecha,
                nombre_apellido: dia.nombre_apellido,
                campaña: dia.campaña,
                turno_es_incorrecto: validacion.pendiente,
                nota: validacion.nota,
                hhee_aprobadas_inicio: validacion.antes.habilitado ? hhmmToDecimal(validacion.antes.valor) : (dia.hhee_aprobadas_inicio || 0),
                hhee_aprobadas_fin: validacion.despues.habilitado ? hhmmToDecimal(validacion.despues.valor) : (dia.hhee_aprobadas_fin || 0),
                hhee_aprobadas_descanso: validacion.descanso.habilitado ? hhmmToDecimal(validacion.descanso.valor) : (dia.hhee_aprobadas_descanso || 0),
            };
        }).filter(Boolean);

        if (validacionesParaEnviar.length === 0) {
            setError("No has habilitado ninguna fila para guardar o re-validar.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/hhee/cargar-hhee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ validaciones: validacionesParaEnviar })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);
            //setSuccess(data.mensaje); // Muestra el mensaje de éxito de la API (reemplazamos por el resumen)
            setResultados([]); // Limpia la tabla de resultados
            setNombreAgente(''); // Limpia el nombre del agente
            setGuardadoResumen(validacionesParaEnviar); // Guarda los datos enviados para mostrarlos en el resumen
            
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Container className="py-1">
            <h3 className="mb-2">Portal de Carga de Horas Extras (HHEE)</h3>
            <Card className="shadow-sm mb-1">
                <Card.Body className="p-1">
                    <Card.Title className="mb-2">Consultar Período de Empleado</Card.Title>
                    <Form onSubmit={handleConsulta}>
                    <Row className="align-items-end g-3 mb-2">
                            <Col md={4}>
                                <Form.Group controlId="rut-consulta"><Form.Label>RUT del Empleado</Form.Label><Form.Control type="text" placeholder="Ej: 12345678-9" value={rut} onChange={(e) => setRut(e.target.value)} onBlur={handleRutBlur} required /></Form.Group>
                            </Col>
                            <Col md={2}>
                                {/* 1. Mover Período Rápido al lado del RUT */}
                                <Form.Group controlId="select-periodo"><Form.Label>Período Rápido</Form.Label><Form.Select onChange={(e) => handlePeriodoChange(e.target.value)}><option value="">Seleccionar...</option><option value="actual">Periodo actual</option><option value="anterior">Periodo anterior (-1)</option></Form.Select></Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group controlId="fecha-inicio"><Form.Label>Fecha de Inicio</Form.Label><Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required  /></Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group controlId="fecha-fin"><Form.Label>Fecha de Fin</Form.Label><Form.Control type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required /></Form.Group>
                            </Col>
                        </Row>
                        {/* 2. Centrar los botones */}
                        <Row className="justify-content-center mt-3">
                            <Col xs="auto">
                                <Button variant="primary" type="submit" disabled={loading} className="me-2">{loading && !isPendientesView ? <Spinner as="span" animation="border" size="sm" /> : 'Consultar'}</Button>
                                <Button variant="warning" type="button" onClick={handleCargarPendientes} disabled={loading}>{loading && isPendientesView ? <Spinner as="span" animation="border" size="sm" /> : 'Mostrar Pendientes'}</Button>
                            </Col>
                        </Row>
                    </Form>
                </Card.Body>
            </Card>

            {loading && <div className="text-center"><Spinner animation="border" /> <p>Cargando...</p></div>}
            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

                    {/* --- INICIO DEL NUEVO BLOQUE DE CÓDIGO --- */}
            {guardadoResumen ? (
                // Si hay un resumen guardado, muestra esta tarjeta
                <Card className="shadow-sm mt-4">
                    <Card.Header as="h4" className="bg-success text-white">Resumen de la Carga</Card.Header>
                    <Card.Body>
                        <Alert variant="success">¡Los datos se han guardado correctamente!</Alert>
                        <ListGroup variant="flush">
                            {guardadoResumen.map((item, index) => (
                                <ListGroup.Item key={index}>
                                    <strong>Fecha: {item.fecha}</strong>
                                    {isPendientesView && <span> | <strong>RUT: {item.rut_con_formato}</strong></span>}
                                    <ul>
                                        {item.turno_es_incorrecto ? (
                                            <li className="text-warning">Marcado como Pendiente: {item.nota}</li>
                                        ) : (
                                            <>
                                                {item.hhee_aprobadas_inicio > 0 && <li>HHEE Antes: {decimalToHHMM(item.hhee_aprobadas_inicio)}</li>}
                                                {item.hhee_aprobadas_fin > 0 && <li>HHEE Después: {decimalToHHMM(item.hhee_aprobadas_fin)}</li>}
                                                {item.hhee_aprobadas_descanso > 0 && <li>HHEE Descanso: {decimalToHHMM(item.hhee_aprobadas_descanso)}</li>}
                                            </>
                                        )}
                                    </ul>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                        <div className="text-center mt-3">
                            <Button variant="primary" onClick={() => setGuardadoResumen(null)}>
                                Realizar nueva consulta
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            ) : resultados.length > 0 && (
                // Si NO hay resumen pero SÍ hay resultados de una consulta, muestra la tabla normal
                <Card className="shadow-sm">
                <Card.Header>
                        <Row className="align-items-center">
                            <Col md={5}>
                                <h4>Resultados para: {nombreAgente}</h4>
                            </Col>
                            <Col md={5}>
                                <div className="text-center">
                                    <span className="me-3">
                                        Declaradas (OP): <Badge bg="success">{decimalToHHMM(totalesResumen.declaradas)}</Badge>
                                    </span>
                                    <span>
                                        Aprobadas (RRHH): <Badge bg="primary">{decimalToHHMM(totalesResumen.aprobadasRRHH)}</Badge>
                                    </span>
                                </div>
                            </Col>
                            <Col md={2} className="text-end">
                                <Button variant="success" onClick={handleGuardar} disabled={loading}>
                                    Guardar
                                </Button>
                            </Col>
                        </Row>
                    </Card.Header>
                    <Card.Body className='pt-0' style={{ maxHeight: '60vh', overflow: 'auto' }}>
                        <Table bordered hover>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white' }}>
                                <tr>
                                    {isPendientesView && <th>Agente</th>}
                                    <th>Fecha</th>
                                    <th>Turno / Marcas</th>
                                    <th>HHEE Declaradas (OP)</th>
                                    <th>HHEE Aprobadas (RRHH)</th>
                                    <th>Marcar como Pendiente</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resultados.map((dia) => {
                                    const formattedDia = {
                                        ...dia,
                                        nombre_apellido: formatFullName(dia.nombre_apellido)
                                    };
                                    return (
                                        <ResultadoFila
                                            key={dia.rut_con_formato ? `${dia.rut_con_formato}-${dia.fecha}` : dia.fecha}
                                            dia={formattedDia}
                                            validacionDia={validaciones[dia.fecha]}
                                            onValidationChange={handleValidationChange}
                                            onSimpleChange={handleSimpleChange}
                                            onRevalidar={handleRevalidar}
                                            isPendientesView={isPendientesView}
                                        />
                                    );
                                })}
                            </tbody>
                        </Table>
                    </Card.Body>
                </Card>
            )}
            {/* --- FIN DEL NUEVO BLOQUE DE CÓDIGO --- */}
        </Container>
    );
}

export default PortalHHEEPage;