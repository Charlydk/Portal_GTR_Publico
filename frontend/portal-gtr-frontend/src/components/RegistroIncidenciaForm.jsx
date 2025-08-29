// src/components/RegistroIncidenciaForm.jsx
import React, { useState } from 'react';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';import { Form, Button, Alert, Spinner, Card } from 'react-bootstrap';

const RegistroIncidenciaForm = ({ campanaId, onSuccess, onError }) => {
  const { user, authToken } = useAuth();

  const [comentario, setComentario] = useState('');
  const [horario, setHorario] = useState('');
  const [tipoIncidencia, setTipoIncidencia] = useState('TECNICA'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    if (!user || !authToken) {
      setFormError("No estás autenticado. Por favor, inicia sesión.");
      setIsSubmitting(false);
      return;
    }
    if (!campanaId) {
      setFormError("ID de campaña no proporcionado. No se puede registrar la incidencia.");
      setIsSubmitting(false);
      return;
    }

    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    const newBitacoraEntry = {
      campana_id: campanaId,
      fecha: formattedDate,
      hora: horario,
      comentario: null,
      es_incidencia: true,
      tipo_incidencia: tipoIncidencia,
      comentario_incidencia: comentario,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/bitacora_entries/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(newBitacoraEntry),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al registrar incidencia: ${response.statusText}`);
      }

      const data = await response.json();
      setFormSuccess('Incidencia registrada con éxito!');
      setComentario('');
      setHorario('');
      setTipoIncidencia('TECNICA');

      if (onSuccess) {
        onSuccess(data);
      }

    } catch (err) {
      console.error('Error al registrar incidencia:', err);
      setFormError(err.message || 'Hubo un error al registrar la incidencia.');
      if (onError) {
        onError(err);
      }
    } finally {
      setIsSubmitting(false);
      setTimeout(() => { setFormError(null); setFormSuccess(null); }, 5000);
    }
  };

  return (
    <Card className="shadow-sm p-4 mb-4">
      <h4 className="mb-4 text-primary">Registrar Nueva Incidencia</h4>

      {formError && <Alert variant="danger">{formError}</Alert>}
      {formSuccess && <Alert variant="success">{formSuccess}</Alert>}

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label htmlFor="comentario">Comentario de la Incidencia:</Form.Label>
          <Form.Control
            as="textarea"
            id="comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            required
            rows="3"
            disabled={isSubmitting}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor="horario">Horario de la Incidencia:</Form.Label>
          <Form.Select
            id="horario"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            required
            disabled={isSubmitting}
          >
            <option value="">Selecciona un horario</option>
            {generarOpcionesHorario().map((hora) => (
              <option key={hora} value={hora}>{hora}</option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label htmlFor="tipoIncidencia">Tipo de Incidencia:</Form.Label>
          <Form.Select
            id="tipoIncidencia"
            value={tipoIncidencia}
            onChange={(e) => setTipoIncidencia(e.target.value)}
            required
            disabled={isSubmitting}
          >
            <option value="TECNICA">Tecnica</option>
            <option value="OPERATIVA">Operativa</option>
            <option value="OTRO">Otros</option>
          </Form.Select>
        </Form.Group>

        <Button
          type="submit"
          variant="danger"
          className="w-100 mt-3"
          disabled={isSubmitting}
        >
          {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Registrar Incidencia'}
        </Button>
      </Form>
    </Card>
  );
};

export default RegistroIncidenciaForm;
