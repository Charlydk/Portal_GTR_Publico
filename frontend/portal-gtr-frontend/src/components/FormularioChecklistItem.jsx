// src/components/FormularioChecklistItem.jsx

import React from 'react';
import { Link } from 'react-router-dom';

// Este componente recibe las props necesarias de FormularioChecklistItemPage
function FormularioChecklistItem({ formData, handleChange, handleSubmit, isSubmitting, isEditMode }) {
  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="descripcion" className="form-label">Descripción del Ítem</label>
        <input
          type="text"
          className="form-control"
          id="descripcion"
          name="descripcion"
          value={formData.descripcion}
          onChange={handleChange}
          required
        />
      </div>
      <div className="form-check mb-3">
        <input
          type="checkbox"
          className="form-check-input"
          id="completado"
          name="completado"
          checked={formData.completado}
          onChange={handleChange}
        />
        <label className="form-check-label" htmlFor="completado">Completado</label>
      </div>
      
      <button type="submit" className="btn btn-primary me-2" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : (isEditMode ? 'Actualizar Ítem' : 'Crear Ítem')}
      </button>
      {/* El botón de cancelar redirige a la página de detalle de la tarea */}
      <Link to={`/tareas/${formData.tarea_id}`} className="btn btn-secondary">Cancelar</Link>
    </form>
  );
}

export default FormularioChecklistItem;
