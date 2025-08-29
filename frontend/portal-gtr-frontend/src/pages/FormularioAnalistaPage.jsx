// src/pages/FormularioAnalistaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth'; // ¡NUEVO! Importa useAuth

function FormularioAnalistaPage() {
  const { id } = useParams(); // Para saber si estamos editando
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    bms_id: '',
    password: '', // Solo para el registro, no para la actualización de datos generales
    role: 'ANALISTA' // Valor por defecto para nuevos registros
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Efecto para cargar los datos del analista si estamos editando
  useEffect(() => {
    const fetchAnalista = async () => {
      if (!id) { // Si no hay ID, es una creación, no necesitamos cargar datos
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/analistas/${id}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`, // Envía el token para la carga
          },
        });
        if (!response.ok) {
          throw new Error(`Error al cargar el analista: ${response.statusText}`);
        }
        const data = await response.json();
        setFormData({
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          bms_id: data.bms_id,
          password: '', // No cargamos la contraseña por seguridad
          role: data.role
        });
      } catch (err) {
        console.error("Error al cargar el analista:", err);
        setError(err.message || "No se pudo cargar la información del analista.");
      } finally {
        setLoading(false);
      }
    };

    if (authToken) { // Solo intenta cargar si hay token
      fetchAnalista();
    } else {
      setLoading(false);
      setError("Necesita iniciar sesión para gestionar analistas.");
    }
  }, [id, authToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let method;
      let url;
      let dataToSend;

      if (id) { // Modo edición
        method = 'PUT';
        url = `${API_BASE_URL}/analistas/${id}`;
        dataToSend = {
          nombre: formData.nombre,
          apellido: formData.apellido,
          email: formData.email,
          bms_id: parseInt(formData.bms_id),
          role: formData.role // Permitimos actualizar el rol en edición
        };
      } else { // Modo creación (registro)
        method = 'POST';
        url = `${API_BASE_URL}/analistas/`; // El endpoint /analistas/ es para crear (protegido)
        dataToSend = {
          nombre: formData.nombre,
          apellido: formData.apellido,
          email: formData.email,
          bms_id: parseInt(formData.bms_id),
          password: formData.password,
          role: formData.role
        };
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 422 && errorData.detail) {
          const validationErrors = errorData.detail.map(err => {
            const field = err.loc[err.loc.length - 1];
            return `${field}: ${err.msg}`;
          }).join('\n');
          throw new Error(`Errores de validación:\n${validationErrors}`);
        }
        throw new Error(errorData.detail || `Error al ${id ? 'actualizar' : 'crear'} analista: ${response.statusText}`);
      }

      alert(`Analista ${id ? 'actualizado' : 'creado'} con éxito.`);
      navigate('/analistas'); // Redirige a la lista de analistas
    } catch (err) {
      console.error(`Error al ${id ? 'actualizar' : 'crear'} analista:`, err);
      setError(err.message || `No se pudo ${id ? 'actualizar' : 'crear'} el analista.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determinar si el campo de contraseña debe ser visible
  const showPasswordField = !id; // Solo mostrar en modo creación
  // Determinar si el campo de rol debe ser editable
  const isRoleEditable = user && user.role === 'SUPERVISOR'; // Solo supervisor puede cambiar el rol

  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando formulario...</span>
        </div>
        <p>Cargando información del analista...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        {!authToken && (
          <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
        )}
        <button onClick={() => navigate('/analistas')} className="btn btn-secondary mt-3">Volver a Analistas</button>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">{id ? 'Editar Analista' : 'Crear Nuevo Analista'}</h2>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="nombreInput" className="form-label">Nombre:</label>
          <input
            type="text"
            className="form-control rounded-md"
            id="nombreInput"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="apellidoInput" className="form-label">Apellido:</label>
          <input
            type="text"
            className="form-control rounded-md"
            id="apellidoInput"
            name="apellido"
            value={formData.apellido}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="emailInput" className="form-label">Email:</label>
          <input
            type="email"
            className="form-control rounded-md"
            id="emailInput"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="bmsIdInput" className="form-label">BMS ID:</label>
          <input
            type="number"
            className="form-control rounded-md"
            id="bmsIdInput"
            name="bms_id"
            value={formData.bms_id}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>
        {showPasswordField && (
          <div className="mb-3">
            <label htmlFor="passwordInput" className="form-label">Contraseña:</label>
            <input
              type="password"
              className="form-control rounded-md"
              id="passwordInput"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              disabled={isSubmitting}
            />
          </div>
        )}
        <div className="mb-3">
          <label htmlFor="roleSelect" className="form-label">Rol:</label>
          <select
            className="form-select rounded-md"
            id="roleSelect"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            disabled={isSubmitting || !isRoleEditable} // Deshabilita si no es editable
          >
            <option value="ANALISTA">Analista</option>
            <option value="RESPONSABLE">Responsable</option>
            <option value="SUPERVISOR">Supervisor</option>
          </select>
          {!isRoleEditable && id && (
            <small className="form-text text-muted">Solo un Supervisor puede cambiar el rol de un analista existente.</small>
          )}
        </div>
        <div className="d-grid gap-2">
          <button type="submit" className="btn btn-primary rounded-md" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : (id ? 'Actualizar Analista' : 'Crear Analista')}
          </button>
          <button type="button" onClick={() => navigate('/analistas')} className="btn btn-secondary rounded-md">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default FormularioAnalistaPage;
