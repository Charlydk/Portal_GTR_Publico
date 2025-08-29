// src/pages/LoginPage.jsx
import React, { useState } from 'react'; // Asegúrate de que React y useState están importados
import { useNavigate, Link } from 'react-router-dom'; // ¡NUEVO! Importa Link
import { useAuth } from '../hooks/useAuth'; // Importa el hook de autenticación

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth(); // Obtiene la función de login del contexto
  const navigate = useNavigate(); // Hook para navegar programáticamente

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Limpia errores anteriores
    setLoading(true); // Activa el estado de carga

    try {
      await login(email, password); // Llama a la función de login del contexto
      navigate('/'); // Redirige al dashboard o a la página principal después del login exitoso
    } catch (err) {
      setError(err.message || 'Error desconocido al iniciar sesión.'); // Muestra el error
    } finally {
      setLoading(false); // Desactiva el estado de carga
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-lg p-4">
            <h2 className="card-title text-center mb-4">Iniciar Sesión</h2>
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
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
