import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Toast, ToastContainer } from 'react-bootstrap';
import wfmService from '../../services/wfmService';
import MallaGrid from '../../components/planificacion/MallaGrid';
import HerramientasWFM from '../../components/planificacion/HerramientasWFM';
import { useAuth } from '../../hooks/useAuth';

const Planificacion = () => {
  const { user } = useAuth();
  const isAdmin = user && ['SUPERVISOR', 'RESPONSABLE'].includes(user.role);

  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [diasVista, setDiasVista] = useState(7);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState("");

  const [analistas, setAnalistas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [conceptos, setConceptos] = useState([]);
  const [conceptoSeleccionado, setConceptoSeleccionado] = useState(null);
  const [showToast, setShowToast] = useState(false); // Para mostrar mensajes de error/éxito
  const [toastMsg, setToastMsg] = useState("");

  const [horaInicioManual, setHoraInicioManual] = useState("");
  const [horaFinManual, setHoraFinManual] = useState("");

  const [listaClusters, setListaClusters] = useState([]);
  const [clusterSeleccionadoId, setClusterSeleccionadoId] = useState("");
  const [modoBorrador, setModoBorrador] = useState(false);

  // Carga inicial (Equipos y Conceptos)
  useEffect(() => {
    Promise.all([
      wfmService.getEquipos(),
      wfmService.getConceptos(),
      wfmService.getClusters()
    ]).then(([equiposData, conceptosData, clustersData]) => {
      setEquipos(equiposData);
      setConceptos(conceptosData);
      setListaClusters(clustersData);
      if (conceptosData.length > 0) setConceptoSeleccionado(conceptosData[0]);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, diasVista, equipoSeleccionado]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaInicio);
      fin.setDate(inicio.getDate() + diasVista - 1);
      const fechaFinStr = fin.toISOString().slice(0, 10);

      const [analistasData, turnosData] = await Promise.all([
        wfmService.getAnalistas(equipoSeleccionado || null),
        wfmService.getPlanificacion(fechaInicio, fechaFinStr, equipoSeleccionado || null)
      ]);

      setAnalistas(analistasData);
      setTurnos(turnosData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCeldaClick = async (analistaId, fecha, turnoActual) => {
    if (!isAdmin) return; // Analistas no pueden editar

    // CASO 1: MODO BORRADOR
    if (modoBorrador) {
        if (!turnoActual) return; // No hay nada que borrar

        try {
            await wfmService.deleteTurno(analistaId, fecha);
            // Actualizar estado local eliminando el turno
            setTurnos(prev => prev.filter(t => !(t.analista_id === analistaId && t.fecha === fecha)));
            setToastMsg("🗑️ Turno eliminado"); setShowToast(true);
        } catch (error) {
            console.error(error);
            setToastMsg("❌ Error al eliminar"); setShowToast(true);
        }
        return;
    }

    // CASO 2: MODO ASIGNAR (Lógica existente)
    if (!conceptoSeleccionado) {
      setToastMsg("⚠️ Selecciona un pincel o el borrador.");
      setShowToast(true);
      return;
    }

    try {
      const payload = {
        fecha: fecha,
        analista_id: analistaId,
        concepto_id: conceptoSeleccionado.id,
        hora_inicio: horaInicioManual || null,
        hora_fin: horaFinManual || null,
        cluster_id: (conceptoSeleccionado.es_laborable && clusterSeleccionadoId)
                    ? parseInt(clusterSeleccionadoId)
                    : null

      };



      // Validación rápida: Si es un turno laboral (T1, T2) y no tiene horas definidas
      if (conceptoSeleccionado.es_laborable && (!horaInicioManual || !horaFinManual)) {
          setToastMsg("⚠️ Por favor define la hora de inicio y fin para este turno.");
          setShowToast(true);
          return;
      }

      const turnoGuardado = await wfmService.saveTurno(payload);

      // Actualizamos localmente usando el objeto cluster que devuelve el backend
      actualizarTurnoLocal(analistaId, fecha, conceptoSeleccionado, horaInicioManual, horaFinManual, turnoGuardado.cluster);

    } catch (error) {
      console.error("Error guardando turno:", error);
      setToastMsg("❌ Error al guardar.");
      setShowToast(true);
    }
  };

  const actualizarTurnoLocal = (analistaId, fecha, concepto, inicio, fin, objCluster) => {
    setTurnos(prev => {
      const filtrados = prev.filter(t => !(t.analista_id === analistaId && t.fecha === fecha));
      return [...filtrados, {
        analista_id: analistaId,
        fecha: fecha,
        concepto: concepto,
        concepto_id: concepto.id,
        hora_inicio: inicio,
        hora_fin: fin,
        cluster: objCluster
      }];
    });
};

  const generarColumnasFechas = () => {
    const columnas = [];
    const actual = new Date(fechaInicio);
    // Ajuste de zona horaria simple: sumamos horas para asegurar que no salte de día al convertir
    actual.setHours(12,0,0,0);

    for (let i = 0; i < diasVista; i++) {
      columnas.push({
        fechaIso: actual.toISOString().slice(0, 10),
        nombreDia: actual.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase(),
        numeroDia: actual.getDate()
      });
      actual.setDate(actual.getDate() + 1);
    }
    return columnas;
  };

  return (
    <Container fluid className="p-4 bg-light min-h-screen">
      {/* Toast de Notificaciones */}
      <ToastContainer position="top-end" className="p-3">
        <Toast onClose={() => setShowToast(false)} show={showToast} delay={3000} autohide bg="warning">
          <Toast.Body>{toastMsg}</Toast.Body>
        </Toast>
      </ToastContainer>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-primary fw-bold">📅 Planificación de Turnos</h2>
        <Button variant="outline-primary" onClick={cargarDatos} disabled={loading}>
            {loading ? <Spinner size="sm" animation="border" /> : 'Refrescar'}
        </Button>
      </div>

      {/* 1. BARRA DE HERRAMIENTAS (Pinceles) - Solo Admin */}
      {isAdmin && (
        <HerramientasWFM
            conceptos={conceptos}
            conceptoSeleccionado={conceptoSeleccionado}
            setConceptoSeleccionado={setConceptoSeleccionado}

            horaInicio={horaInicioManual}
            setHoraInicio={setHoraInicioManual}
            horaFin={horaFinManual}
            setHoraFin={setHoraFinManual}
            clusters={listaClusters}
            clusterSeleccionado={clusterSeleccionadoId}
            setClusterSeleccionado={setClusterSeleccionadoId}
            modoBorrador={modoBorrador}
            setModoBorrador={setModoBorrador}
        />
      )}

      {/* 2. FILTROS */}
      <div className="bg-white p-3 rounded shadow-sm mb-3">
        <Row className="g-3 align-items-end">
          <Col md={3}>
            <Form.Label>Fecha Inicio</Form.Label>
            <Form.Control type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </Col>
          <Col md={2}>
            <Form.Label>Vista</Form.Label>
            <Form.Select value={diasVista} onChange={(e) => setDiasVista(Number(e.target.value))}>
              <option value={7}>Semanal</option>
              <option value={15}>Quincenal</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label>Equipo</Form.Label>
            <Form.Select value={equipoSeleccionado} onChange={(e) => setEquipoSeleccionado(e.target.value)}>
              <option value="">Todos</option>
              {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
            </Form.Select>
          </Col>
        </Row>
      </div>

      {/* 3. MALLA INTERACTIVA */}
      {loading && turnos.length === 0 ? (
        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
      ) : (
        <MallaGrid
          analistas={analistas}
          turnos={turnos}
          rangoFechas={generarColumnasFechas()}
          onCeldaClick={handleCeldaClick}
        />
      )}
    </Container>
  );
};

export default Planificacion;