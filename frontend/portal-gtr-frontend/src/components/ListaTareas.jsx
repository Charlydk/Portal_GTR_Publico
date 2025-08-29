// src/components/ListaTareas.jsx

import React, { useState, useEffect, useCallback } from 'react'; // Agregamos useCallback
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // <-- Importamos la URL base

function ListaTareas() {
  // allTareas ahora será para almacenar las tareas cargadas de la API
  const [allTareas, setAllTareas] = useState([]);
  const [loading, setLoading] = useState(true); // Estado para indicar si estamos cargando
  const [error, setError] = useState(null);     // Estado para manejar errores de la API

  // Datos de prueba para los selects de filtros (por ahora, los mantenemos aquí. Más adelante, también vendrían de la API)
  const [analistas, setAnalistas] = useState([
    { id: 1, nombre: 'Juan Pérez' },
    { id: 2, nombre: 'María González' },
    { id: 3, nombre: 'Laura Martínez' },
  ]);

  const [campanas, setCampanas] = useState([
    { id: 1, nombre: 'Campaña General' },
    { id: 2, nombre: 'Campaña Leads' },
    { id: 3, nombre: 'Campaña Verano' },
    { id: 4, nombre: 'Campaña Redes' },
  ]);

  const [progresoOpciones] = useState([
    'PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'BLOQUEADA'
  ]);

  const [filtroAnalista, setFiltroAnalista] = useState('');
  const [filtroCampana, setFiltroCampana] = useState('');
  const [filtroProgreso, setFiltroProgreso] = useState('');

  // Función para cargar las tareas de la API
  // Usamos useCallback para que esta función no se recree innecesariamente
  const fetchTareas = useCallback(async () => {
    setLoading(true); // Ponemos loading a true antes de la petición
    setError(null);   // Limpiamos cualquier error previo
    try {
      const response = await fetch(`${API_BASE_URL}/tareas/`); // Asumiendo que tu API tiene este endpoint
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAllTareas(data); // Actualizamos el estado con las tareas de la API
    } catch (err) {
      console.error("Error al cargar las tareas:", err);
      setError("No se pudieron cargar las tareas. Intente de nuevo más tarde.");
    } finally {
      setLoading(false); // Siempre ponemos loading a false al finalizar
    }
  }, []); // Dependencias vacías, solo se crea una vez

  // useEffect para llamar a fetchTareas cuando el componente se monta
  useEffect(() => {
    fetchTareas();
  }, [fetchTareas]); // Ejecuta cuando `fetchTareas` cambie (que no cambiará por `useCallback`)


  // Lógica de filtrado (se mantiene igual, pero ahora sobre `allTareas` de la API)
  const tareasFiltradas = allTareas.filter(tarea => {
    const coincideAnalista = filtroAnalista ? tarea.analista_id === parseInt(filtroAnalista) : true;
    const coincideCampana = filtroCampana ? tarea.campana_id === parseInt(filtroCampana) : true;
    const coincideProgreso = filtroProgreso ? tarea.progreso === filtroProgreso : true;
    return coincideAnalista && coincideCampana && coincideProgreso;
  });

  // Manejo de la eliminación de una tarea (nueva funcionalidad)
  const handleDeleteTarea = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      return; // Si el usuario cancela, no hacemos nada
    }
    try {
      const response = await fetch(`${API_BASE_URL}/tareas/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // Si la eliminación fue exitosa, volvemos a cargar las tareas
      // O actualizamos el estado para remover la tarea eliminada
      setAllTareas(prevTareas => prevTareas.filter(tarea => tarea.id !== id));
      alert('Tarea eliminada con éxito.');
    } catch (err) {
      console.error("Error al eliminar la tarea:", err);
      setError("No se pudo eliminar la tarea. Intente de nuevo.");
    }
  };


  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando tareas...</span>
        </div>
        <p>Cargando tareas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <button className="btn btn-primary mt-3" onClick={fetchTareas}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>Lista de Tareas</h3>

      {/* Sección de Filtros */}
      <div className="card mb-4 p-3 bg-light">
        <div className="row g-3">
          <div className="col-md-4">
            <label htmlFor="filtroAnalista" className="form-label">Analista:</label>
            <select
              id="filtroAnalista"
              className="form-select"
              value={filtroAnalista}
              onChange={(e) => setFiltroAnalista(e.target.value)}
            >
              <option value="">Todos</option>
              {analistas.map(analista => (
                <option key={analista.id} value={analista.id}>
                  {analista.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="filtroCampana" className="form-label">Campaña:</label>
            <select
              id="filtroCampana"
              className="form-select"
              value={filtroCampana}
              onChange={(e) => setFiltroCampana(e.target.value)}
            >
              <option value="">Todas</option>
              {campanas.map(campana => (
                <option key={campana.id} value={campana.id}>
                  {campana.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="filtroProgreso" className="form-label">Progreso:</label>
            <select
              id="filtroProgreso"
              className="form-select"
              value={filtroProgreso}
              onChange={(e) => setFiltroProgreso(e.target.value)}
            >
              <option value="">Todos</option>
              {progresoOpciones.map(progreso => (
                <option key={progreso} value={progreso}>
                  {progreso.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Tareas Filtradas */}
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Campaña</th>
              <th>Analista Asignado</th>
              <th>Progreso</th>
              <th>Fecha Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tareasFiltradas.map(tarea => (
              <tr key={tarea.id}>
                <td>{tarea.id}</td>
                <td>{tarea.titulo}</td>
                <td>{tarea.campana_nombre}</td>
                <td>{tarea.analista_nombre}</td>
                <td>
                  <span className={`badge ${
                    tarea.progreso === 'PENDIENTE' ? 'text-bg-secondary' :
                    tarea.progreso === 'EN_PROGRESO' ? 'text-bg-info' :
                    tarea.progreso === 'COMPLETADA' ? 'text-bg-success' :
                    tarea.progreso === 'BLOQUEADA' ? 'text-bg-danger' : 'text-bg-light'
                  }`}>
                    {tarea.progreso.replace('_', ' ')}
                  </span>
                </td>
                <td>{tarea.fecha_vencimiento}</td>
                <td>
                  <Link to={`/tareas/${tarea.id}`} className="btn btn-sm btn-info me-2">
                    Ver
                  </Link>
                  <Link to={`/tareas/editar/${tarea.id}`} className="btn btn-sm btn-warning me-2">
                    Editar
                  </Link>
                  {/* Botón de eliminar */}
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteTarea(tarea.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tareasFiltradas.length === 0 && (
        <p className="text-center mt-3 text-muted">No se encontraron tareas que coincidan con los filtros.</p>
      )}
    </div>
  );
}

export default ListaTareas;