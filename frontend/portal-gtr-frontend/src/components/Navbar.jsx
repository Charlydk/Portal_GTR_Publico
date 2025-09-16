// src/components/Navbar.jsx

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Navbar, Nav, NavDropdown, Container } from 'react-bootstrap';

function NavbarComponent() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);

    const handleLogout = () => {
        logout();
        setExpanded(false);
        navigate('/login');
    };

    // --- LÓGICA DE ROLES MODIFICADA ---
    // Ahora, solo el SUPERVISOR se considera usuario y admin de GTR.
    const isGtrUser = user && user.role === 'SUPERVISOR';
    const isGtrAdmin = user && user.role === 'SUPERVISOR';
    
    // El resto de los roles no cambia.
    const isHheeUser = user && ['SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES'].includes(user.role);
    const isAnalyst = user && user.role === 'ANALISTA';

    return (
        <Navbar expand="lg" bg="primary" variant="dark" expanded={expanded} onToggle={() => setExpanded(prev => !prev)} collapseOnSelect>
            <Container fluid>
                <Navbar.Brand as={Link} to="/" onClick={() => setExpanded(false)}>Portal WORKFORCE</Navbar.Brand>
                <Navbar.Toggle aria-controls="responsive-navbar-nav" />
                <Navbar.Collapse id="responsive-navbar-nav">
                    <Nav className="me-auto">
                        {user && <Nav.Link as={Link} to="/dashboard" onClick={() => setExpanded(false)}>Dashboard</Nav.Link>}
                        
                        {/* Estos enlaces ahora solo los verá el SUPERVISOR */}
                        {isGtrUser && (
                            <>
                                <Nav.Link as={Link} to="/avisos" onClick={() => setExpanded(false)}>Avisos</Nav.Link>
                                <Nav.Link as={Link} to="/tareas" onClick={() => setExpanded(false)}>Tareas</Nav.Link>
                                <Nav.Link as={Link} to="/campanas" onClick={() => setExpanded(false)}>Campañas</Nav.Link>
                            </>
                        )}

                        {isGtrAdmin && (
                            <>
                                <Nav.Link as={Link} to="/analistas" onClick={() => setExpanded(false)}>Analistas</Nav.Link>
                                <Nav.Link as={Link} to="/control-incidencias" onClick={() => setExpanded(false)}>Control Incidencias</Nav.Link>
                                <Nav.Link as={Link} to="/asignar-campanas" onClick={() => setExpanded(false)}>Asignar Campañas</Nav.Link>
                            </>
                        )}
                        
                        {/* El analista solo verá su portal de solicitudes HHEE */}
                        {isAnalyst && (
                             <Nav.Link as={Link} to="/mis-solicitudes-hhee" onClick={() => setExpanded(false)}>Mis Solicitudes HHEE</Nav.Link>
                        )}

                        {isHheeUser && (
                            <NavDropdown title="Gestión HHEE" id="hhee-nav-dropdown">
                                {isGtrAdmin && (
                                    <NavDropdown.Item as={Link} to="/aprobar-hhee" onClick={() => setExpanded(false)}>
                                        Aprobar HHEE (GTR)
                                    </NavDropdown.Item>
                                )}
                                <NavDropdown.Item as={Link} to="/hhee/portal" onClick={() => setExpanded(false)}>
                                    Portal de Carga (OP)
                                </NavDropdown.Item>
                                <NavDropdown.Item as={Link} to="/hhee/reportes" onClick={() => setExpanded(false)}>
                                    Exportar Reportes
                                </NavDropdown.Item>
                                <NavDropdown.Item as={Link} to="/hhee/metricas" onClick={() => setExpanded(false)}>
                                    Métricas
                                </NavDropdown.Item>
                            </NavDropdown>
                        )}
                    </Nav>

                    {/* Menú de Usuario (derecha) */}
                    <Nav>
                        {user ? (
                            <NavDropdown title={`Hola, ${user.nombre} (${user.role})`} id="user-nav-dropdown" align="end">
                                <NavDropdown.Item as={Link} to="/cambiar-password" onClick={() => setExpanded(false)}>Cambiar Contraseña</NavDropdown.Item>
                                <NavDropdown.Divider />
                                <NavDropdown.Item onClick={handleLogout}>Cerrar Sesión</NavDropdown.Item>
                            </NavDropdown>
                        ) : (
                            <Nav.Link as={Link} to="/login" onClick={() => setExpanded(false)}>Iniciar Sesión</Nav.Link>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}

export default NavbarComponent;