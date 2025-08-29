// src/pages/DetalleAnalistaPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

function DetalleAnalistaPage() {
  const { id } = useParams(); // Obtiene el ID del analista de la URL
  const navigate = useNavigate();
  const [analista, setAnalista] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { authToken, user } = useAuth(); // Obtiene authToken y user del contexto

  // Estados para la funcionalidad de cambio de contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Función para obtener los detalles del analista
  const fetchAnalista = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const analistaId = parseInt(id); // Asegura que el ID sea numérico
      if (isNaN(analistaId)) {
        throw new Error("ID de analista inválido.");
      }

      const response = await fetch(`${API_BASE_URL}/analistas/${analistaId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`, // ¡IMPORTANTE! Envía el token de autenticación
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Analista no encontrado.");
        }
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para ver este analista.");
        }
        throw new Error(`Error al cargar el analista: ${response.statusText}`);
      }
      const data = await response.json();
      setAnalista(data);
    } catch (err) {
      console.error("Error al obtener analista:", err);
      setError(err.message || "No se pudo cargar la información del analista.");
    } finally {
      setLoading(false);
    }
  }, [id, authToken]); // Vuelve a ejecutar cuando el ID o el token cambien

  // Efecto para cargar los datos al montar el componente o cuando el ID/token cambia
  useEffect(() => {
    if (id && authToken) {
      fetchAnalista();
    } else if (!authToken) {
      setLoading(false);
      setError("Necesita iniciar sesión para ver los detalles del analista.");
    } else {
      setLoading(false);
      setError("No se especificó un ID de analista.");
    }
  }, [id, authToken, fetchAnalista]);

  const formatDateTime = (apiDateString) => {
    // Si no hay fecha, devuelve N/A
    if (!apiDateString) {
        return 'N/A';
    }

    // --- LA CORRECCIÓN DEFINITIVA ---
    // Le añadimos la 'Z' al final para forzar a que JavaScript
    // interprete el string como una fecha en formato UTC universal.
    const date = new Date(apiDateString + 'Z');
    // --------------------------------

    // Verificamos si la fecha parseada es válida
    if (isNaN(date.getTime())) {
        return 'Fecha inválida';
    }

    // A partir de aquí, el resto del código funciona como se espera
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son de 0 a 11
    const year = date.getFullYear();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};

  // Función para manejar la desactivación de un analista
  const handleDesactivarAnalista = async () => {
    if (!window.confirm('¿Está seguro de que desea desactivar este analista?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/analistas/${analista.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`, // Envía el token
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado para desactivar analistas. Por favor, inicie sesión.");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado. No tiene los permisos necesarios para desactivar analistas.");
        }
        throw new Error(`Error al desactivar analista: ${response.statusText}`);
        // Considerar un mensaje más específico si el error es por intentar desactivarse a sí mismo
      }

      alert('Analista desactivado con éxito.');
      navigate('/analistas'); // Redirige a la lista de analistas
    } catch (err) {
      console.error("Error al desactivar analista:", err);
      setError(err.message || "No se pudo desactivar el analista.");
    }
  };

  // Función para manejar el cambio de contraseña
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);
    setIsChangingPassword(true);

    if (newPassword !== confirmPassword) {
      setPasswordChangeError("Las contraseñas no coinciden.");
      setIsChangingPassword(false);
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeError("La contraseña debe tener al menos 6 caracteres.");
      setIsChangingPassword(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/analistas/${analista.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ 
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al cambiar la contraseña: ${response.statusText}`);
      }

      setPasswordChangeSuccess("Contraseña actualizada con éxito.");
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error("Error al cambiar contraseña:", err);
      setPasswordChangeError(err.message || "No se pudo cambiar la contraseña. Intente de nuevo.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Lógica para determinar si el usuario actual puede cambiar la contraseña del analista visto
  const canChangePassword = user && (
    user.role === 'SUPERVISOR' ||
    (user.role === 'RESPONSABLE' && analista && analista.role === 'ANALISTA')
  );

  // Lógica para determinar si el botón de desactivar es visible
  const canDeactivate = user && user.role === 'SUPERVISOR' && analista && analista.esta_activo && analista.id !== user.id;


  if (loading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando analista...</span>
        </div>
        <p>Cargando detalles del analista...</p>
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
        <Link to="/analistas" className="btn btn-secondary mt-3">Volver a Analistas</Link>
      </div>
    );
  }

  if (!analista) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning" role="alert">
          El analista no pudo ser cargado o no existe.
        </div>
        <Link to="/analistas" className="btn btn-secondary mt-3">Volver a Analistas</Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h3>Detalles del Analista: {analista.nombre} {analista.apellido}</h3>
      <hr />
      <p><strong>ID:</strong> {analista.id}</p>
      <p><strong>Nombre:</strong> {analista.nombre}</p>
      <p><strong>Apellido:</strong> {analista.apellido}</p>
      <p><strong>Email:</strong> {analista.email}</p>
      <p><strong>BMS ID:</strong> {analista.bms_id}</p>
      <p><strong>Rol:</strong> {analista.role}</p>
      <p><strong>Activo:</strong> {analista.esta_activo ? 'Sí' : 'No'}</p>
      <p><strong>Fecha de Creación:</strong> {formatDateTime(analista.fecha_creacion)}</p>

      <div className="mt-4">
        <Link to="/analistas" className="btn btn-secondary me-2">Volver a la lista de Analistas</Link>
        {user && (user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
          <Link to={`/analistas/editar/${analista.id}`} className="btn btn-warning me-2">Editar Analista</Link>
        )}
        {canDeactivate && (
          <button onClick={handleDesactivarAnalista} className="btn btn-danger">Desactivar Analista</button>
        )}
      </div>

      {/* Sección para cambiar contraseña */}
      {canChangePassword && (
        <div className="mt-5 p-4 border rounded shadow-sm bg-light">
          <h4>Cambiar Contraseña</h4>
          <hr />
          {passwordChangeError && (
            <div className="alert alert-danger" role="alert">
              {passwordChangeError}
            </div>
          )}
          {passwordChangeSuccess && (
            <div className="alert alert-success" role="alert">
              {passwordChangeSuccess}
            </div>
          )}
          <form onSubmit={handleChangePassword}>
            <div className="mb-3">
              <label htmlFor="newPasswordInput" className="form-label">Nueva Contraseña:</label>
              <input
                type="password"
                className="form-control rounded-md"
                id="newPasswordInput"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength="6"
                disabled={isChangingPassword}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="confirmPasswordInput" className="form-label">Confirmar Contraseña:</label>
              <input
                type="password"
                className="form-control rounded-md"
                id="confirmPasswordInput"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength="6"
                disabled={isChangingPassword}
              />
            </div>
            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-primary rounded-md" disabled={isChangingPassword}>
                {isChangingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default DetalleAnalistaPage;
