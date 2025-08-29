// src/components/HistorialTarea.jsx
import React from 'react';
import { ListGroup, Badge, Card, Alert, Spinner } from 'react-bootstrap';

const HistorialTarea = ({ historial, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="text-center">
        <Spinner animation="border" size="sm" />
        <p className="ms-2 d-inline">Cargando historial...</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger" className="mt-3">Error al cargar el historial: {error}</Alert>;
  }

  if (!historial || historial.length === 0) {
    return <Alert variant="info" className="mt-3">No hay historial de cambios para esta tarea.</Alert>;
  }

  const formatDateTime = (apiDateString) => {
    // Si no hay fecha, devuelve N/A
    if (!apiDateString) {
        return 'N/A';
    }

    // --- LA CORRECCIÓN DEFINITIVA ---
    // Le añadimos la 'Z' al final para forzar a que JavaScript
    // interprete el string como una fecha en formato UTC universal.
    const date = new Date(apiDateString + 'Z');
    // --------------------------------

    // Verificamos si la fecha parseada es válida
    if (isNaN(date.getTime())) {
        return 'Fecha inválida';
    }

    // A partir de aquí, el resto del código funciona como se espera
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son de 0 a 11
    const year = date.getFullYear();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};

  const getBadgeVariant = (progreso) => {
    switch (progreso) {
      case 'COMPLETADA': return 'success';
      case 'CANCELADA': return 'danger';
      case 'EN_PROGRESO': return 'primary';
      case 'PENDIENTE': return 'secondary';
      default: return 'light';
    }
  };

  return (
    <Card className="mt-4 shadow-sm">
      <Card.Header as="h5">Historial de Cambios de Estado</Card.Header>
      <ListGroup variant="flush">
        {historial.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((item) => (
          <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center flex-wrap">
            <div>
              La tarea pasó a <Badge bg={getBadgeVariant(item.new_progreso)}>{item.new_progreso.replace('_', ' ')}</Badge>
              <br />
              <small className="text-muted">
                Cambiado por: {item.changed_by_analista.nombre} {item.changed_by_analista.apellido}
              </small>
            </div>
            <span className="text-muted">{formatDateTime(item.timestamp)}</span>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </Card>
  );
};

export default HistorialTarea;