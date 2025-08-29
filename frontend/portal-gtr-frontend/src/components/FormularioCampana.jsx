// src/components/FormularioCampana.jsx

import React from 'react';
import { Link } from 'react-router-dom';

// Este componente recibe las props necesarias de FormularioCampanaPage
function FormularioCampana({ formData, handleChange, handleSubmit, isSubmitting, isEditMode }) {
  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="nombre" className="form-label">Nombre de la Campaña</label>
        <input
          type="text"
          className="form-control"
          id="nombre"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="descripcion" className="form-label">Descripción</label>
        <textarea
          className="form-control"
          id="descripcion"
          name="descripcion"
          value={formData.descripcion}
          onChange={handleChange}
          rows="3"
        ></textarea>
      </div>
      <div className="mb-3">
        <label htmlFor="fecha_inicio" className="form-label">Fecha de Inicio</label>
        <input
          type="datetime-local"
          className="form-control"
          id="fecha_inicio"
          name="fecha_inicio"
          value={formData.fecha_inicio}
          onChange={handleChange}
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="fecha_fin" className="form-label">Fecha de Fin (Opcional)</label>
        <input
          type="datetime-local"
          className="form-control"
          id="fecha_fin"
          name="fecha_fin"
          value={formData.fecha_fin}
          onChange={handleChange}
        />
      </div>
      
      <button type="submit" className="btn btn-primary me-2" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : (isEditMode ? 'Actualizar Campaña' : 'Crear Campaña')}
      </button>
      <Link to="/campanas" className="btn btn-secondary">Cancelar</Link>
    </form>
  );
}

export default FormularioCampana;
