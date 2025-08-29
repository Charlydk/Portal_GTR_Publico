// src/components/FormularioAnalista.jsx

import React from 'react';
import { Link } from 'react-router-dom';

// Este componente recibe las props necesarias de FormularioAnalistaPage
function FormularioAnalista({ formData, handleChange, handleSubmit, isSubmitting, isEditMode }) {
  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="nombre" className="form-label">Nombre</label>
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
        <label htmlFor="apellido" className="form-label">Apellido</label>
        <input
          type="text"
          className="form-control"
          id="apellido"
          name="apellido"
          value={formData.apellido}
          onChange={handleChange}
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="email" className="form-label">Email</label>
        <input
          type="email"
          className="form-control"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="bms_id" className="form-label">ID BMS</label>
        <input
          type="text"
          className="form-control"
          id="bms_id"
          name="bms_id"
          value={formData.bms_id}
          onChange={handleChange}
        />
      </div>
      
      <button type="submit" className="btn btn-primary me-2" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : (isEditMode ? 'Actualizar Analista' : 'Crear Analista')}
      </button>
      <Link to="/analistas" className="btn btn-secondary">Cancelar</Link>
    </form>
  );
}

export default FormularioAnalista;