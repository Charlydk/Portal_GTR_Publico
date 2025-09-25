// RUTA: src/components/auth/ProtectedRoute.jsx

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

function ProtectedRoute({ allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) {
        // Muestra un loader mientras se verifica la autenticación
        return <div>Cargando...</div>;
    }

    if (!user) {
        // Si no hay usuario, redirige al login
        return <Navigate to="/login" replace />;
    }
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Si el rol del usuario no está en la lista de roles permitidos,
        // lo redirigimos al dashboard (o a una página de "No Autorizado")
        return <Navigate to="/dashboard" replace />;
    }

    // Si el usuario está autenticado y tiene el rol correcto, muestra la página
    return <Outlet />;
}

export default ProtectedRoute;