// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Obtenemos el error y el loading directamente del contexto de autenticación
  const { login, error: authError, loading } = useAuth();
  

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Simplemente llamamos a la función de login.
    // App.jsx se encargará de la redirección.
    await login(email, password);
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-lg p-4">
            <h2 className="card-title text-center mb-4">Iniciar Sesión</h2>
            {/* Usamos el authError del contexto para mostrar el mensaje */}
            {authError && (
              <div className="alert alert-danger" role="alert">
                {authError}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="emailInput" className="form-label">Email:</label>
                <input
                  type="email"
                  className="form-control rounded-md"
                  id="emailInput"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="d-grid gap-2">
                <button type="submit" className="btn btn-primary rounded-md" disabled={loading}>
                  {loading ? 'Iniciando sesión...' : 'Login'}
                </button>
              </div>
            </form>
            <p className="text-center mt-3">
              ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;