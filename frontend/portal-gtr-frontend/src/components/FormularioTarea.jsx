// src/components/FormularioTarea.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Recibimos las nuevas props: analistas, campanas y onSave
function FormularioTarea({ tareaInicial, onSave, analistas, campanas }) {
  const navigate = useNavigate();

  // Estado local para los campos del formulario
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    progreso: 'PENDIENTE', // Valor por defecto
    fecha_vencimiento: '',
    analista_id: '',
    campana_id: '',
    // checklist_items: [], // Por ahora no manejamos checklist_items directamente en este formulario de alto nivel
  });

  // Efecto para inicializar el formulario cuando tareaInicial cambie (para edición)
  useEffect(() => {
    if (tareaInicial) {
      // --- MODIFICACIÓN AQUÍ para formatear la fecha ---
      const formattedDate = tareaInicial.fecha_vencimiento
        ? tareaInicial.fecha_vencimiento.split('T')[0] // Toma solo la parte YYYY-MM-DD
        : '';
      // ---------------------------------------------------

      setFormData({
        titulo: tareaInicial.titulo || '',
        descripcion: tareaInicial.descripcion || '',
        progreso: tareaInicial.progreso || 'PENDIENTE',
        fecha_vencimiento: formattedDate, // Usa la fecha formateada para el input type="date"
        analista_id: tareaInicial.analista_id || '',
        campana_id: tareaInicial.campana_id || '',
        // checklist_items: tareaInicial.checklist_items || [],
      });
    } else {
      // Si no hay tareaInicial, reseteamos el formulario (para creación)
      setFormData({
        titulo: '',
        descripcion: '',
        progreso: 'PENDIENTE',
        fecha_vencimiento: '',
        analista_id: '',
        campana_id: '',
      });
    }
  }, [tareaInicial]);

  // Manejador genérico para cambios en los inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  // Manejador para el envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault(); // Previene el comportamiento por defecto del formulario (recargar la página)

    // Validaciones básicas (puedes añadir más)
    if (!formData.titulo || !formData.descripcion || !formData.analista_id || !formData.campana_id) {
      alert('Por favor, completa todos los campos obligatorios (Título, Descripción, Analista, Campaña).');
      return;
    }

    // Llamamos a la función onSave que viene de FormularioTareaPage
    onSave({
      ...formData,
      // Convertimos IDs a números si no vienen así del select
      analista_id: parseInt(formData.analista_id),
      campana_id: parseInt(formData.campana_id)
    });
  };

  // Opciones de progreso
  const progresoOpciones = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'BLOQUEADA'];

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header bg-success text-white">
          <h4 className="mb-0">{tareaInicial ? 'Editar Tarea' : 'Crear Nueva Tarea'}</h4>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="titulo" className="form-label">Título:</label>
              <input
                type="text"
                className="form-control"
                id="titulo"
                name="titulo"
                value={formData.titulo}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="descripcion" className="form-label">Descripción:</label>
              <textarea
                className="form-control"
                id="descripcion"
                name="descripcion"
                rows="3"
                value={formData.descripcion}
                onChange={handleChange}
                required
              ></textarea>
            </div>

            <div className="mb-3">
              <label htmlFor="analista_id" className="form-label">Analista Asignado:</label>
              <select
                className="form-select"
                id="analista_id"
                name="analista_id"
                value={formData.analista_id}
                onChange={handleChange}
                required
              >
                <option value="">Seleccione un analista</option>
                {analistas.map(analista => (
                  <option key={analista.id} value={analista.id}>
                    {analista.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label htmlFor="campana_id" className="form-label">Campaña:</label>
              <select
                className="form-select"
                id="campana_id"
                name="campana_id"
                value={formData.campana_id}
                onChange={handleChange}
                required
              >
                <option value="">Seleccione una campaña</option>
                {campanas.map(campana => (
                  <option key={campana.id} value={campana.id}>
                    {campana.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label htmlFor="progreso" className="form-label">Progreso:</label>
              <select
                className="form-select"
                id="progreso"
                name="progreso"
                value={formData.progreso}
                onChange={handleChange}
              >
                {progresoOpciones.map(opcion => (
                  <option key={opcion} value={opcion}>
                    {opcion.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label htmlFor="fecha_vencimiento" className="form-label">Fecha de Vencimiento:</label>
              <input
                type="date"
                className="form-control"
                id="fecha_vencimiento"
                name="fecha_vencimiento"
                value={formData.fecha_vencimiento}
                onChange={handleChange}
              />
            </div>

            <div className="d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-secondary me-2"
                onClick={() => navigate('/tareas')} // Botón Volver a la lista
              >
                Volver
              </button>
              <button type="submit" className="btn btn-primary">
                {tareaInicial ? 'Actualizar Tarea' : 'Crear Tarea'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default FormularioTarea;