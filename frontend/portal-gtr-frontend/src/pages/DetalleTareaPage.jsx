// src/pages/DetalleTareaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button, Alert, Spinner, ListGroup, Badge, Modal, Form } from 'react-bootstrap';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import HistorialTarea from '../components/HistorialTarea';
import { formatDateTime } from '../utils/dateFormatter';

function DetalleTareaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, authToken, loading: authLoading } = useAuth();

  const [tarea, setTarea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [submittingComentario, setSubmittingComentario] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submittingProgress, setSubmittingProgress] = useState(false); // Para el spinner de progreso
  const [submittingChecklist, setSubmittingChecklist] = useState(null); // Para el spinner de checklist item
  
  const [historial, setHistorial] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState(null);

  const fetchTarea = useCallback(async () => {
    if (!authToken || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tareas/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cargar la tarea: ${response.statusText}`);
      }
      const data = await response.json();
      setTarea(data);
    } catch (err) {
      console.error("Error fetching tarea:", err);
      setError(err.message || "No se pudo cargar la tarea.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken, user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchTarea();
    }
  }, [authLoading, user, fetchTarea]);

  const handlePostComentario = async (e) => {
    e.preventDefault();
    if (!nuevoComentario.trim()) return;

    setSubmittingComentario(true);
    setError(null);
    try {
        const response = await fetch(`${API_BASE_URL}/tareas/${id}/comentarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ texto: nuevoComentario }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'No se pudo publicar el comentario.');
        }
        
        setNuevoComentario(''); // Limpiar el campo de texto
        await fetchTarea(); // Recargar la tarea para mostrar el nuevo comentario
    } catch (err) {
        setError(err.message);
    } finally {
        setSubmittingComentario(false);
    }
};

   const handleFetchHistorial = async () => {
    if (showHistorial) {
      setShowHistorial(false);
      return;
    }

    setLoadingHistorial(true);
    setErrorHistorial(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tareas/${id}/historial_estados`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "No se pudo cargar el historial.");
      }
      const data = await response.json();
      setHistorial(data);
      setShowHistorial(true);
    } catch (error) {
      setErrorHistorial(error.message);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const handleUpdateProgress = async (newProgress) => {
    if (!authToken || !user || !tarea) return;

    setSubmittingProgress(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/tareas/${tarea.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ progreso: newProgress }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al actualizar el progreso: ${response.statusText}`);
      }

      const updatedTarea = await response.json();
      setTarea(updatedTarea);
      setSuccess("Progreso de la tarea actualizado con éxito!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error al actualizar progreso:", err);
      setError(err.message || "No se pudo actualizar el progreso.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmittingProgress(false);
    }
  };

  const handleToggleChecklistItem = async (checklistItemId, currentCompletado) => {
    if (!authToken || !user || !tarea) return;

    setSubmittingChecklist(checklistItemId); // Set the ID of the item being submitted
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/checklist_items/${checklistItemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ completado: !currentCompletado }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al actualizar checklist item: ${response.statusText}`);
      }

      // Actualizar el estado de la tarea localmente para reflejar el cambio
      setTarea(prevTarea => {
        const updatedChecklistItems = prevTarea.checklist_items.map(item =>
          item.id === checklistItemId ? { ...item, completado: !currentCompletado } : item
        );
        return { ...prevTarea, checklist_items: updatedChecklistItems };
      });
      setSuccess("Checklist Item actualizado con éxito!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error al actualizar checklist item:", err);
      setError(err.message || "No se pudo actualizar el checklist item.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmittingChecklist(null); // Clear the submitting item ID
    }
  };

  const handleTomarTarea = async () => {
    if (!authToken || !user || !tarea || submittingProgress) return;

    setSubmittingProgress(true);
    setError(null);
    setSuccess(null);

    try {
        const response = await fetch(`${API_BASE_URL}/tareas/${tarea.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            // Nos asignamos la tarea a nosotros mismos
            body: JSON.stringify({ analista_id: user.id }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Error al asignarse la tarea.");
        }

        // Actualizamos la tarea en el estado local para que se refleje inmediatamente
        const updatedTarea = await response.json();
        setTarea(updatedTarea);
        setSuccess("¡Tarea asignada con éxito!");
        setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
        console.error("Error al tomar la tarea:", err);
        setError(err.message);
        setTimeout(() => setError(null), 5000);
    } finally {
        setSubmittingProgress(false);
    }
};

const handleDejarTarea = async () => {
  if (!authToken || !user || !tarea || submittingProgress) return;

  if (!window.confirm('¿Estás seguro de que quieres liberar esta tarea? Volverá al pool de la campaña.')) {
      return;
  }

  setSubmittingProgress(true);
  setError(null);
  setSuccess(null);

  try {
      const response = await fetch(`${API_BASE_URL}/tareas/${tarea.id}`, {
          method: 'PUT',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
          },
          // Enviamos null para desasignar
          body: JSON.stringify({ analista_id: null }),
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Error al liberar la tarea.");
      }

      const updatedTarea = await response.json();
      setTarea(updatedTarea);
      setSuccess("¡Tarea liberada con éxito!");
      setTimeout(() => setSuccess(null), 3000);

  } catch (err) {
      console.error("Error al dejar la tarea:", err);
      setError(err.message);
      setTimeout(() => setError(null), 5000);
  } finally {
      setSubmittingProgress(false);
  }
};

  const handleDeleteTarea = async () => {
    if (!authToken || !user || !tarea) return;

    setShowDeleteModal(false);
    setSubmittingProgress(true); // Reutilizamos este spinner
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/tareas/${tarea.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al eliminar la tarea: ${response.statusText}`);
      }

      setSuccess("Tarea eliminada con éxito!");
      setTimeout(() => {
        setSuccess(null);
        navigate('/tareas'); // Redirigir a la lista de tareas
      }, 2000);
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
      setError(err.message || "No se pudo eliminar la tarea.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmittingProgress(false);
    }
  };
  
  if (authLoading || loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
        <p className="ms-3 text-muted">Cargando detalles de la tarea...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Error al cargar la tarea</Alert.Heading>
          <p>{error}</p>
          <Button onClick={() => navigate('/tareas')}>Volver a Tareas</Button>
        </Alert>
      </Container>
    );
  }

  if (!tarea) {
    return (
      <Container className="mt-4">
        <Alert variant="info">
          <Alert.Heading>Tarea no encontrada</Alert.Heading>
          <p>La tarea que buscas no existe o no tienes permiso para verla.</p>
          <Button onClick={() => navigate('/tareas')}>Volver a Tareas</Button>
        </Alert>
      </Container>
    );
  }

  /// --- LÓGICA DE PERMISOS CORREGIDA ---

  const isAssignedToCampaign = user?.campanas_asignadas?.some(c => c.id === tarea.campana_id);

  const canViewTask = user && (
    user.role === 'SUPERVISOR' || 
    user.role === 'RESPONSABLE' || 
    (user.role === 'ANALISTA' && (tarea.analista_id === user.id || (tarea.analista_id === null && isAssignedToCampaign)))
  );

  const canEditTask = user && (
    user.role === 'SUPERVISOR' || 
    user.role === 'RESPONSABLE' || 
    (user.role === 'ANALISTA' && tarea.analista_id === user.id)
  );
  
  const canDeleteTask = user && user.role === 'SUPERVISOR';

  // CAMBIO CLAVE: Permisos para crear/editar checklist items
  const canManageChecklist = user && (
    user.role === 'SUPERVISOR' ||
    user.role === 'RESPONSABLE' ||
    // Un analista puede si la tarea es suya O si está libre en su campaña
    (user.role === 'ANALISTA' && (tarea.analista_id === user.id || (tarea.analista_id === null && isAssignedToCampaign)))
  );


  if (!canViewTask) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Acceso Denegado</Alert.Heading>
          <p>No tienes los permisos necesarios para ver esta tarea.</p>
          <Button onClick={() => navigate('/tareas')}>Ir a Tareas</Button>
        </Alert>
      </Container>
    );
  }
  
  // ✅ CORRECCIÓN 1: DEFINICIÓN DE LA VARIABLE ANTES DEL RETURN
  const esTareaFinalizada = tarea.progreso === 'COMPLETADA' || tarea.progreso === 'CANCELADA';

  return (
    <Container className="py-5">
      <Card className="shadow-lg p-4">
        <h2 className="text-center mb-4 text-primary">Detalles de la Tarea</h2>

        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        <Card.Body>
          <Card.Title className="mb-3">{tarea.titulo}</Card.Title>
          <Card.Text>
            <strong>Descripción:</strong> {tarea.descripcion || 'N/A'}
          </Card.Text>
          <Card.Text>
            <strong>Asignado a:</strong> {tarea.analista?.nombre} {tarea.analista?.apellido} (BMS ID: {tarea.analista?.bms_id})
          </Card.Text>
          {tarea.campana && (
            <Card.Text>
              <strong>Campaña:</strong> <a href={`/campanas/${tarea.campana.id}`}>{tarea.campana.nombre}</a>
            </Card.Text>
          )}
          <Card.Text>
            <strong>Estado:</strong> <Badge bg={tarea.progreso === 'PENDIENTE' ? 'danger' : tarea.progreso === 'EN_PROGRESO' ? 'warning' : 'success'}>{tarea.progreso}</Badge>
          </Card.Text>
          <Card.Text>
            <strong>Fecha de Creación:</strong> {formatDateTime(tarea.fecha_creacion)}
          </Card.Text>
          <Card.Text>
            <strong>Fecha de Vencimiento:</strong> {formatDateTime(tarea.fecha_vencimiento)}
          </Card.Text>

          {esTareaFinalizada && tarea.fecha_finalizacion && (
            <Card.Text><strong>Fecha de Finalización:</strong> {formatDateTime(tarea.fecha_finalizacion)}</Card.Text>
          )}

          {/* Opciones de progreso para analistas asignados */}
          {user.role === 'ANALISTA' && tarea.analista_id === user.id && tarea.progreso !== 'COMPLETADA' && (
            <Form.Group className="mb-3">
              <Form.Label>Actualizar Progreso</Form.Label>
              <Form.Select
                value={tarea.progreso}
                onChange={(e) => handleUpdateProgress(e.target.value)}
                disabled={submittingProgress}
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="EN_PROGRESO">EN_PROGRESO</option>
                <option value="COMPLETADA">COMPLETADA</option>
                <option value="CANCELADA">CANCELADA</option>
              </Form.Select>
              {submittingProgress && <Spinner animation="border" size="sm" className="ms-2" />}
            </Form.Group>
          )}
          {/* Opciones de progreso para Supervisores/Responsables */}
          {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
            <Form.Group className="mb-3">
              <Form.Label>Actualizar Progreso</Form.Label>
              <Form.Select
                value={tarea.progreso}
                onChange={(e) => handleUpdateProgress(e.target.value)}
                disabled={submittingProgress}
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="EN_PROGRESO">EN_PROGRESO</option>
                <option value="COMPLETADA">COMPLETADA</option>
                <option value="CANCELADA">CANCELADA</option>
              </Form.Select>
              {submittingProgress && <Spinner animation="border" size="sm" className="ms-2" />}
            </Form.Group>
          )}

          <h4 className="mt-4 mb-3">Checklist Items</h4>
          {/* CAMBIO: Usamos la nueva variable de permisos 'canManageChecklist' */}
          {canManageChecklist && (
            <div className="d-flex justify-content-end mb-3">
              <Button
                variant="success"
                size="sm"
                onClick={() => navigate(`/tareas/${tarea.id}/checklist_items/crear`)}
              >
                Crear Nuevo Checklist Item
              </Button>
            </div>
          )}
          
          {tarea.checklist_items && tarea.checklist_items.length > 0 ? (
            <ListGroup>
              {tarea.checklist_items.map(item => (
                <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center">
                  <Form.Check
                    type="checkbox"
                    label={item.descripcion}
                    checked={item.completado}
                    onChange={() => handleToggleChecklistItem(item.id, item.completado)}
                    disabled={submittingChecklist === item.id || !canManageChecklist}
                  />
                  {submittingChecklist === item.id && <Spinner animation="border" size="sm" />}
                  {canManageChecklist && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => navigate(`/tareas/${tarea.id}/checklist_items/editar/${item.id}`)}
                      className="ms-3"
                    >
                      Editar
                    </Button>
                  )}
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <Alert variant="info">No hay checklist items para esta tarea.</Alert>
          )}

          {/* ✅ CORRECCIÓN 2: BOTÓN AÑADIDO AL GRUPO DE ACCIONES */}
          {user.role === 'ANALISTA' && !tarea.analista && isAssignedToCampaign && (
          <div className="d-grid gap-2 mb-3">
              <Button
                  variant="success"
                  onClick={handleTomarTarea}
                  disabled={submittingProgress}
              >
                  {submittingProgress ? 'Asignando...' : 'Tomar Tarea'}
              </Button>
          </div>
            )}

          {user.role === 'ANALISTA' && tarea.analista?.id === user.id && !esTareaFinalizada && (
          <div className="d-grid gap-2 mb-3">
            <Button
                variant="warning"
                onClick={handleDejarTarea}
                disabled={submittingProgress}
            >
                {submittingProgress ? 'Liberando...' : 'Liberar Tarea'}
            </Button>
          </div>
            )} 
          
          
          <div className="d-grid gap-2 mt-4">
            {canEditTask && (
              <Button variant="secondary" onClick={() => navigate(`/tareas/editar/${tarea.id}`)}>
                Editar Tarea
              </Button>
            )}
            {canDeleteTask && (
              <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
                Eliminar Tarea
              </Button>
            )}
            <Button variant="info" onClick={handleFetchHistorial} disabled={loadingHistorial}>
              {loadingHistorial ? 'Cargando...' : showHistorial ? 'Ocultar Historial' : 'Ver Historial'}
            </Button>
            <Button variant="outline-secondary" onClick={() => navigate('/tareas')}>
              Volver a la Lista de Tareas
            </Button>
          </div>

           {showHistorial && (
            <HistorialTarea historial={historial} isLoading={loadingHistorial} error={errorHistorial} />
          )}

        </Card.Body>
      </Card>

      <Card className="shadow-lg mt-4">
    <Card.Header as="h4">Comentarios</Card.Header>
    <Card.Body>
        <ListGroup variant="flush" className="mb-3">
            {tarea.comentarios && tarea.comentarios.length > 0 ? (
                
                tarea.comentarios.map(comentario => {
                    // --- PRUEBA DE DIAGNÓSTICO ---
                    console.log("Valor de fecha_creacion del comentario:", comentario.fecha_creacion);
                    // -----------------------------
                    
                    return (
                        <ListGroup.Item key={comentario.id} className="px-0">
                            <p className="mb-1">{comentario.texto}</p>
                            <small className="text-muted">
                                Por: <strong>{comentario.autor.nombre} {comentario.autor.apellido}</strong>
                            </small>
                            <small className="text-muted" style={{ float: 'right' }}>
                                {formatDateTime(comentario.fecha_creacion)}
                            </small>
                        </ListGroup.Item>
                    );
                })

            ) : (
                <p className="text-muted">No hay comentarios en esta tarea. ¡Sé el primero en añadir uno!</p>
            )}
        </ListGroup>

        <Form onSubmit={handlePostComentario}>
            <Form.Group>
                <Form.Label>Añadir un nuevo comentario</Form.Label>
                <Form.Control 
                    as="textarea" 
                    rows={3}
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    placeholder="Escribe tu comentario aquí..."
                    required
                    disabled={submittingComentario}
                />
            </Form.Group>
            <Button variant="primary" type="submit" className="mt-2" disabled={submittingComentario}>
                {submittingComentario ? <Spinner as="span" size="sm" /> : 'Publicar Comentario'}
            </Button>
        </Form>
    </Card.Body>
</Card>

      {/* Modal de Confirmación de Eliminación (esto se queda al final) */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          ¿Estás seguro de que quieres eliminar la tarea "{tarea.titulo}"? Esta acción no se puede deshacer.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDeleteTarea} disabled={submittingProgress}>
            {submittingProgress ? (
              <><Spinner as="span" animation="border" size="sm" />{' '}Eliminando...</>
            ) : (
              'Eliminar'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default DetalleTareaPage;