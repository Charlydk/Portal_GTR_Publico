// src/components/Navbar.jsx

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Lógica de roles para mostrar/ocultar enlaces
    const isGtrUser = user && ['ANALISTA', 'SUPERVISOR', 'RESPONSABLE'].includes(user.role);
    const isGtrAdmin = user && ['SUPERVISOR', 'RESPONSABLE'].includes(user.role);
    const isHheeUser = user && ['SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES'].includes(user.role);

    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
            <div className="container-fluid">
                <Link className="navbar-brand" to="/">Portal WORKFORCE</Link>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        {user && (
                            <li className="nav-item"><Link className="nav-link" to="/dashboard">Dashboard</Link></li>
                        )}
                        
                        {isGtrUser && (
                            <>
                                <li className="nav-item"><Link className="nav-link" to="/avisos">Avisos</Link></li>
                                <li className="nav-item"><Link className="nav-link" to="/tareas">Tareas</Link></li>
                                <li className="nav-item"><Link className="nav-link" to="/campanas">Campañas</Link></li>
                                {user.role === 'ANALISTA' && (
                                    <li className="nav-item"><Link className="nav-link" to="/mis-solicitudes-hhee">Mis Solicitudes HHEE</Link></li>
                                )}
                            </>
                        )}

                        {isGtrAdmin && (
                            <>
                                <li className="nav-item"><Link className="nav-link" to="/analistas">Analistas</Link></li>
                                <li className="nav-item"><Link className="nav-link" to="/asignar-campanas">Asignar Campañas</Link></li>
                                <li className="nav-item"><Link className="nav-link" to="/aprobar-hhee">Aprobar HHEE</Link></li>
                            </>
                        )}

                        {isHheeUser && (
                            <>
                                <li className="nav-item"><Link className="nav-link" to="/hhee/portal">Portal HHEE</Link></li>
                                <li className="nav-item"><Link className="nav-link" to="/hhee/reportes">Reportes HHEE</Link></li>
                                <li className="nav-item"><Link className="nav-link" to="/hhee/metricas">Métricas HHEE</Link></li>
                            </>
                        )}
                    </ul>
                    <ul className="navbar-nav">
                        {user ? (
                            <>
                                <li className="nav-item"><span className="nav-link text-white">Hola, {user.nombre} ({user.role})</span></li>
                                <li className="nav-item"><button onClick={handleLogout} className="btn btn-outline-light ms-2">Cerrar Sesión</button></li>
                            </>
                        ) : (
                            <li className="nav-item"><Link className="btn btn-outline-light" to="/login">Iniciar Sesión</Link></li>
                        )}
                    </ul>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;