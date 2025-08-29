// src/components/FormularioComentarioCampana.jsx

import React from 'react';

function FormularioComentarioCampana({ formData, handleChange, handleSubmit, isSubmitting, analistas }) {
  // Pequeña comprobación defensiva, aunque formData siempre debería estar definido
  // si se inicializa correctamente en el componente padre.
  if (!formData) {
    console.error("FormularioComentarioCampana: formData es undefined o null. Esto no debería ocurrir.");
    return null; // O podrías renderizar un mensaje de carga o error aquí
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="contenido" className="form-label">Contenido del Comentario</label>
        <textarea
          className="form-control"
          id="contenido"
          name="contenido"
          value={formData.contenido} // Aquí es donde se intentaba leer 'contenido'
          onChange={handleChange}
          rows="3"
          required
          minLength="10" // Añadimos validación de longitud mínima en el frontend
        ></textarea>
        <div className="form-text">El comentario debe tener al menos 10 caracteres.</div>
      </div>
      <div className="mb-3">
        <label htmlFor="analista_id" className="form-label">Analista</label>
        <select
          className="form-select"
          id="analista_id"
          name="analista_id"
          value={formData.analista_id}
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
      
      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Enviando...' : 'Agregar Comentario'}
      </button>
    </form>
  );
}

export default FormularioComentarioCampana;
