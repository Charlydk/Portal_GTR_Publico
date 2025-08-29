// src/components/FormularioAviso.jsx

import React from 'react';
import { Link } from 'react-router-dom';

// This component receives the necessary props from FormularioAvisoPage
function FormularioAviso({ formData, handleChange, handleSubmit, isSubmitting, isEditMode, analistas, campanas }) {
  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="titulo" className="form-label">Título del Aviso</label>
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
        <label htmlFor="contenido" className="form-label">Contenido del Aviso</label>
        <textarea
          className="form-control"
          id="contenido"
          name="contenido"
          value={formData.contenido}
          onChange={handleChange}
          rows="5"
          required
        ></textarea>
      </div>
      <div className="mb-3">
        <label htmlFor="fecha_vencimiento" className="form-label">Fecha de Vencimiento (Opcional)</label>
        <input
          type="datetime-local"
          className="form-control"
          id="fecha_vencimiento"
          name="fecha_vencimiento"
          value={formData.fecha_vencimiento}
          onChange={handleChange}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="creador_id" className="form-label">Creador (Analista)</label>
        <select
          className="form-select"
          id="creador_id"
          name="creador_id"
          value={formData.creador_id}
          onChange={handleChange}
          required
        >
          <option value="">Seleccione un analista</option>
          {analistas.map((analista) => (
            <option key={analista.id} value={analista.id}>
              {analista.nombre} {analista.apellido} (BMS ID: {analista.bms_id})
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label htmlFor="campana_id" className="form-label">Campaña Asociada (Opcional)</label>
        <select
          className="form-select"
          id="campana_id"
          name="campana_id"
          value={formData.campana_id}
          onChange={handleChange}
        >
          <option value="">Ninguna</option>
          {campanas.map((campana) => (
            <option key={campana.id} value={campana.id}>
              {campana.nombre}
            </option>
          ))}
        </select>
      </div>
      
      <button type="submit" className="btn btn-primary me-2" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : (isEditMode ? 'Actualizar Aviso' : 'Crear Aviso')}
      </button>
      <Link to="/avisos" className="btn btn-secondary">Cancelar</Link>
    </form>
  );
}

export default FormularioAviso;
