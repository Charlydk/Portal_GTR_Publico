// src/components/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
function Navbar() {
    const { user, logout } = useAuth(); // Obtiene el usuario y la función logout del contexto
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login'); // Redirige a la página de login después de cerrar sesión
    };

    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
            <div className="container-fluid">
                <Link className="navbar-brand" to="/">Portal GTR</Link>
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarNav"
                    aria-controls="navbarNav"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        <li className="nav-item">
                            <Link className="nav-link" to="/">Inicio</Link>
                        </li>
                        {user && ( // Mostrar enlaces solo si el usuario está logueado
                            <>
                                {/* NUEVO: Enlace al Dashboard */}
                                <li className="nav-item">
                                    <Link className="nav-link" to="/dashboard">Dashboard</Link>
                                </li>
                                <li className="nav-item">
                                    <Link className="nav-link" to="/avisos">Avisos</Link>
                                </li>
                                <li className="nav-item">
                                    <Link className="nav-link" to="/tareas">Tareas</Link>
                                </li>
                                {/* Puedes añadir más enlaces aquí según los roles */}
                                {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                                    <li className="nav-item">
                                        <Link className="nav-link" to="/analistas">Analistas</Link>
                                    </li>
                                )}
                                {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE' || user.role === 'ANALISTA') && (
                                    <li className="nav-item">
                                        <Link className="nav-link" to="/campanas">Campañas</Link>
                                    </li>
                                )}
                                {(user.role === 'SUPERVISOR' || user.role === 'RESPONSABLE') && (
                                    <li className="nav-item">
                                        <Link className="nav-link" to="/asignar-campanas">Asignar Campañas</Link>
                                    </li>,
                                    <li className="nav-item">
                                        <Link className="nav-link" to="/hhee/portal">Portal HHEE</Link>
                                    </li>
                                )}
                            </>
                        )}
                    </ul>
                    <ul className="navbar-nav">
                        {user ? (
                            <>
                                <li className="nav-item">
                                    <span className="nav-link text-white">
                                        Hola, {user.nombre} ({user.role})
                                    </span>
                                </li>
                                <li className="nav-item">
                                    <button onClick={handleLogout} className="btn btn-outline-light ms-2">
                                        Cerrar Sesión
                                    </button>
                                </li>
                            </>
                        ) : (
                            <li className="nav-item">
                                <Link className="btn btn-outline-light" to="/login">
                                    Iniciar Sesión
                                </Link>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
