// src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
/**
 * Componente de Ruta Privada para proteger rutas basadas en autenticación y roles.
 *
 * @param {object} props - Las propiedades del componente.
 * @param {Array<string>} props.allowedRoles - Un array de roles permitidos para acceder a esta ruta (ej. ['ANALISTA', 'SUPERVISOR']).
 * @param {React.ReactNode} props.children - Los componentes hijos que se renderizarán si el acceso es permitido.
 * @returns {React.ReactNode} Los componentes hijos si el usuario está autenticado y tiene el rol permitido,
 * o un componente Navigate a la página de login si no lo está.
 */
function PrivateRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth(); // ¡CAMBIADO: Ahora usamos 'loading' del contexto!

    // Si la autenticación aún está en progreso, no renderizar nada (o un spinner)
    if (loading) { // ¡CAMBIADO: Usamos 'loading' aquí!
        return null; // Puedes poner un spinner de carga global aquí si lo deseas
    }

    // Si no hay usuario o el usuario no tiene un rol (después de que la carga haya terminado), redirigir a login
    if (!user || !user.role) {
        return <Navigate to="/login" replace />;
    }

    // Si se especifican roles permitidos, verificar si el rol del usuario está en esa lista
    if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(user.role)) {
            // Si el usuario no tiene el rol permitido, redirigir a una página de acceso denegado o a la home
            return <Navigate to="/" replace />; // Redirigir a la página de inicio por defecto
        }
    }

    // Si todo está bien (no está cargando, hay usuario y tiene el rol permitido), renderizar los componentes hijos
    return children;
}

export default PrivateRoute;
