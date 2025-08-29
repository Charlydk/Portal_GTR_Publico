// src/pages/RegisterPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../api'; // Asegúrate de que esta ruta sea correcta

function RegisterPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    bms_id: '',
    password: '',
    role: 'ANALISTA' // Valor por defecto
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const dataToSend = {
        ...formData,
        bms_id: parseInt(formData.bms_id) // Asegura que bms_id sea un número
      };

      const response = await fetch(`${API_BASE_URL}/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(errorData.detail || `Error al registrar: ${response.statusText}`);
      }

      setSuccess('Usuario registrado con éxito. Ahora puedes iniciar sesión.');
      setFormData({ // Limpia el formulario
        nombre: '',
        apellido: '',
        email: '',
        bms_id: '',
        password: '',
        role: 'ANALISTA'
      });
      // Opcional: Redirigir al login después de un registro exitoso
      // setTimeout(() => navigate('/login'), 2000);

    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'No se pudo registrar el usuario. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-lg p-4">
            <h2 className="card-title text-center mb-4">Registrar Nuevo Analista</h2>
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success" role="alert">
                {success}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
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
                  disabled={loading}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="roleSelect" className="form-label">Rol:</label>
                <select
                  className="form-select rounded-md"
                  id="roleSelect"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  <option value="ANALISTA">Analista</option>
                  <option value="RESPONSABLE">Responsable</option>
                  <option value="SUPERVISOR">Supervisor</option>
                </select>
              </div>
              <div className="d-grid gap-2">
                <button type="submit" className="btn btn-success rounded-md" disabled={loading}>
                  {loading ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
            <p className="text-center mt-3">
              ¿Ya tienes cuenta? <Link to="/login">Inicia sesión aquí</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
