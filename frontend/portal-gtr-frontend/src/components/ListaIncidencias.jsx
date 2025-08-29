// src/components/ListaIncidencias.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ListGroup, Badge, Button, Card } from 'react-bootstrap';

// Este componente recibe las incidencias directamente de su página padre
const ListaIncidencias = ({ incidencias, campanaId }) => {

  // Función para dar un color diferente a cada estado de la incidencia
  const getStatusVariant = (estado) => {
    switch (estado) {
      case 'ABIERTA':
        return 'danger';
      case 'EN PROGRESO':
        return 'warning';
      case 'CERRADA':
        return 'success';
      default:
        return 'secondary';
    }
  };

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

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Historial de Incidencias</span>
        <Link to={`/incidencias/crear?campanaId=${campanaId}`}>
          <Button variant="primary" size="sm">Registrar Nueva Incidencia</Button>
        </Link>
      </Card.Header>
      <Card.Body>
        {(!incidencias || incidencias.length === 0) ? (
          <p className="text-muted">No hay incidencias registradas para esta campaña.</p>
        ) : (
          <ListGroup variant="flush">
            {incidencias.map((incidencia) => (
              <ListGroup.Item 
                key={incidencia.id} 
                as={Link} 
                to={`/incidencias/${incidencia.id}`} 
                action 
                className="d-flex justify-content-between align-items-start"
              >
                <div className="ms-2 me-auto">
                  <div className="fw-bold">{incidencia.titulo}</div>
                  <small className="text-muted">Abierta el: {formatDateTime(incidencia.fecha_apertura)}</small>
                </div>
                <Badge bg={getStatusVariant(incidencia.estado)} pill>
                  {incidencia.estado}
                </Badge>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
};

export default ListaIncidencias;
