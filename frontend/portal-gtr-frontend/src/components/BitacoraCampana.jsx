// src/components/BitacoraCampana.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';import { Card, Form, Button, Alert, Spinner, Table, Badge, Row, Col } from 'react-bootstrap';
import HistorialComentarios from './HistorialComentarios';

const BitacoraCampana = ({ campanaId, campanaNombre }) => {
  const { user, authToken, loading: authLoading } = useAuth();
  const [bitacoraEntries, setBitacoraEntries] = useState([]);
  
  // ELIMINADO: Estados para el comentario general único
  // const [displayedComment, setDisplayedComment] = useState('');
  // const [commentInput, setCommentInput] = useState('');
  
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryComment, setNewEntryComment] = useState('');
  const [newEntryHour, setNewEntryHour] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  
  // ELIMINADO: Estado de envío para el comentario general
  // const [submittingComment, setSubmittingComment] = useState(false);

  const generarOpcionesHorario = () => {
    const opciones = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hora = String(h).padStart(2, '0');
        const minuto = String(m).padStart(2, '0');
        opciones.push(`${hora}:${minuto}`);
      }
    }
    return opciones;
  };

  const fetchBitacoraEntries = useCallback(async () => {
    if (!authToken || !campanaId || !currentDate) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/campanas/${campanaId}/bitacora?fecha=${currentDate}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar entradas de bitácora: ${response.statusText}`);
      }
      const data = await response.json();
      setBitacoraEntries(data);
    } catch (err) {
      console.error("Error fetching bitacora entries:", err);
      setError(err.message || "No se pudieron cargar las entradas de bitácora.");
    }
  }, [authToken, campanaId, currentDate]);

  // ELIMINADO: La función fetchGeneralComment ya no es necesaria
  // const fetchGeneralComment = useCallback(async () => { ... });

  useEffect(() => {
    if (!authLoading && user && campanaId) {
      setLoading(true);
      // SIMPLIFICADO: Solo cargamos las entradas de la bitácora diaria
      fetchBitacoraEntries().finally(() => setLoading(false));
    }
  }, [authLoading, user, campanaId, fetchBitacoraEntries]);

  const handleNewEntrySubmit = async (e) => {
    e.preventDefault();
    setSubmittingEntry(true);
    setError(null);
    setSuccess(null);
    const newEntry = {
      campana_id: campanaId,
      fecha: currentDate,
      hora: newEntryHour,
      comentario: newEntryComment,
      es_incidencia: false,
    };
    try {
      const response = await fetch(`${API_BASE_URL}/bitacora_entries/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(newEntry),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al añadir entrada.`);
      }
      setSuccess('Observación añadida con éxito!');
      setNewEntryComment('');
      setNewEntryHour('');
      fetchBitacoraEntries();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingEntry(false);
      setTimeout(() => { setSuccess(null); setError(null); }, 5000);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 text-secondary">Bitácora Diaria de Campaña: {campanaNombre}</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card className="shadow-sm p-3 mb-4">
        <Form.Group as={Row} className="align-items-center">
          <Form.Label column sm={3}>Seleccionar Fecha:</Form.Label>
          <Col sm={9}>
            <Form.Control type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} />
          </Col>
        </Form.Group>
      </Card>
      
      {/* NUEVO: Renderizamos el componente de historial de comentarios */}
      <HistorialComentarios campanaId={campanaId} />

      {/* ELIMINADO: Se borran las dos secciones <Card> que manejaban el comentario general único */}

      <Card className="shadow-sm p-4 mb-4">
        <h4 className="mb-4 text-primary">Registrar Observaciones de franja</h4>
        <Form onSubmit={handleNewEntrySubmit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="newEntryHour">Hora:</Form.Label>
            <Form.Select id="newEntryHour" value={newEntryHour} onChange={(e) => setNewEntryHour(e.target.value)} required disabled={submittingEntry}>
              <option value="">Selecciona una hora</option>
              {generarOpcionesHorario().map((hora) => (<option key={hora} value={hora}>{hora}</option>))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="newEntryComment">Comentario de la Observación:</Form.Label>
            <Form.Control as="textarea" id="newEntryComment" rows={3} value={newEntryComment} onChange={(e) => setNewEntryComment(e.target.value)} required disabled={submittingEntry} />
          </Form.Group>
          <Button type="submit" variant="primary" className="w-100 mt-3" disabled={submittingEntry}>
            {submittingEntry ? <Spinner as="span" animation="border" size="sm" /> : 'Añadir Observación'}
          </Button>
        </Form>
      </Card>
     

      <Card className="shadow-sm p-4">
        <h4 className="mb-4 text-secondary">Entradas de Bitácora para {currentDate}</h4>
        {bitacoraEntries.length === 0 ? (
          <Alert variant="info">No hay entradas de bitácora para esta fecha.</Alert>
        ) : (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Comentario</th>
                <th>Comentario Incidencia</th>
              </tr>
            </thead>
            <tbody>
              {bitacoraEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.hora}</td>
                  <td>
                    {entry.es_incidencia ? (<Badge bg="danger">{entry.tipo_incidencia || 'Incidencia'}</Badge>) : (<Badge bg="primary">Observación</Badge>)}
                  </td>
                  <td>{entry.comentario || 'N/A'}</td>
                  <td>{entry.comentario_incidencia || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default BitacoraCampana;
