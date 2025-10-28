// RUTA: src/components/Navbar.jsx

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
    
    // Roles para GTR (Analista, Supervisor, Responsable)
    const isGtrUser = user && ['ANALISTA', 'SUPERVISOR', 'RESPONSABLE'].includes(user.role);
    // Roles de Admin GTR (Supervisor, Responsable)
    const isGtrAdmin = user && ['SUPERVISOR', 'RESPONSABLE'].includes(user.role);
    
    // Roles para HHEE
    const isHheeUser = user && ['SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES'].includes(user.role);
    const isAnalystHhee = user && user.role === 'ANALISTA';

    return (
        <Navbar expand="lg" bg="primary" variant="dark" expanded={expanded} onToggle={() => setExpanded(prev => !prev)} collapseOnSelect>
            <Container fluid>
                <Navbar.Brand as={Link} to="/" onClick={() => setExpanded(false)}>Portal WORKFORCE</Navbar.Brand>
                <Navbar.Toggle aria-controls="responsive-navbar-nav" />
                <Navbar.Collapse id="responsive-navbar-nav">
                    <Nav className="me-auto">
                        {user && <Nav.Link as={Link} to="/dashboard" onClick={() => setExpanded(false)}>Dashboard</Nav.Link>}
                        
                        {isGtrUser && (
                            <NavDropdown title="Gestión GTR" id="gtr-nav-dropdown">
                                
                                {/* --- INICIO DEL CAMBIO --- */}
                                {/* Estos enlaces ahora solo son visibles para Supervisores y Responsables */}
                                {isGtrAdmin && (
                                    <>
                                        {/* <NavDropdown.Item as={Link} to="/avisos" onClick={() => setExpanded(false)}>Avisos</NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/tareas" onClick={() => setExpanded(false)}>Tareas</NavDropdown.Item>
                                        <NavDropdown.Item as={Link} to="/tareas/disponibles" onClick={() => setExpanded(false)}>Tareas Disponibles</NavDropdown.Item>*/}
                                    </>
                                )}
                                {/* --- FIN DEL CAMBIO --- */}

                                {/* Estos enlaces siguen siendo visibles para todos los roles GTR (incluyendo Analista) */}
                                <NavDropdown.Item as={Link} to="/campanas" onClick={() => setExpanded(false)}>Campañas</NavDropdown.Item>
                                <NavDropdown.Item as={Link} to="/control-incidencias" onClick={() => setExpanded(false)}>Control Incidencias</NavDropdown.Item>
                                
                                {/* aqui va el de tareas disponibles cuando este activo */}
                                
                                
                                <NavDropdown.Item as={Link} to="/control-eventos" onClick={() => setExpanded(false)}>Control Eventos</NavDropdown.Item>
                            </NavDropdown>
                        )}

                        {isGtrAdmin && (
                             <NavDropdown title="Admin GTR" id="admin-gtr-nav-dropdown">
                                <NavDropdown.Item as={Link} to="/analistas" onClick={() => setExpanded(false)}>Analistas</NavDropdown.Item>
                                <NavDropdown.Item as={Link} to="/asignar-campanas" onClick={() => setExpanded(false)}>Asignar Campañas</NavDropdown.Item>
                                <NavDropdown.Item as={Link} to="/plantillas-checklist" onClick={() => setExpanded(false)}>Plantillas de Tareas</NavDropdown.Item>
                            </NavDropdown>
                        )}
                        
                        {isAnalystHhee && (
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

                    <Nav>
                        {user ? (
                            <NavDropdown title={`Hola, ${user.nombre} (${user.role})`} id="user-nav-dropdown" align="end">
                                <NavDropdown.Item as={Link} to="/ayuda" onClick={() => setExpanded(false)}>Ayuda</NavDropdown.Item>
                                <NavDropdown.Divider />
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