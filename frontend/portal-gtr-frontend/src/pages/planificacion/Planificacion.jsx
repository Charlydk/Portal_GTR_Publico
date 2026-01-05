import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner } from 'react-bootstrap';
import wfmService from '../../services/wfmService';
import MallaGrid from '../../components/planificacion/MallaGrid';

const Planificacion = () => {
  // Estado para filtros y datos
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10)); // Hoy
  const [diasVista, setDiasVista] = useState(7); // Ver 7 días por defecto
  
  const [analistas, setAnalistas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState("");

  // Cargar lista de equipos al inicio
  useEffect(() => {
    wfmService.getEquipos().then(setEquipos).catch(console.error);
  }, []);

  // Cargar la malla cuando cambian los filtros
  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, diasVista, equipoSeleccionado]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Calcular fecha fin basada en los días de vista
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaInicio);
      fin.setDate(inicio.getDate() + diasVista - 1);
      const fechaFinStr = fin.toISOString().slice(0, 10);

      // 2. Peticiones paralelas
      const [analistasData, turnosData] = await Promise.all([
        wfmService.getAnalistas(equipoSeleccionado || null),
        wfmService.getPlanificacion(fechaInicio, fechaFinStr, equipoSeleccionado || null)
      ]);

      setAnalistas(analistasData);
      setTurnos(turnosData);
    } catch (error) {
      console.error("Error cargando malla:", error);
    } finally {
      setLoading(false);
    }
  };

  // Generar array de fechas para las columnas
  const generarColumnasFechas = () => {
    const columnas = [];
    const actual = new Date(fechaInicio);
    
    for (let i = 0; i < diasVista; i++) {
      // Importante: usar UTC o ajustar zona horaria para evitar desfases visuales
      // Aquí usamos una aproximación simple para mostrar el concepto
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-primary fw-bold">📅 Planificación de Turnos</h2>
        <div>
          <Button variant="primary" onClick={cargarDatos} disabled={loading}>
            {loading ? <Spinner size="sm" animation="border" /> : 'Actualizar Malla'}
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-3 rounded shadow-sm mb-4">
        <Row className="g-3 align-items-end">
          <Col md={3}>
            <Form.Label>Fecha Inicio</Form.Label>
            <Form.Control 
              type="date" 
              value={fechaInicio} 
              onChange={(e) => setFechaInicio(e.target.value)} 
            />
          </Col>
          <Col md={2}>
            <Form.Label>Vista</Form.Label>
            <Form.Select value={diasVista} onChange={(e) => setDiasVista(Number(e.target.value))}>
              <option value={7}>Semanal (7 días)</option>
              <option value={15}>Quincenal (15 días)</option>
              <option value={30}>Mensual (30 días)</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label>Equipo / País</Form.Label>
            <Form.Select 
              value={equipoSeleccionado} 
              onChange={(e) => setEquipoSeleccionado(e.target.value)}
            >
              <option value="">Todos los equipos</option>
              {equipos.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nombre}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>
      </div>

      {/* MALLA (GRID) */}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">Cargando turnos...</p>
        </div>
      ) : (
        <MallaGrid 
          analistas={analistas} 
          turnos={turnos} 
          rangoFechas={generarColumnasFechas()} 
        />
      )}
    </Container>
  );
};

export default Planificacion;