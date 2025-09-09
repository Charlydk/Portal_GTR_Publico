// src/pages/HomePage.jsx
import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function HomePage() {
    const { user } = useAuth();

    return (
        <Container className="py-5 text-center">
            <Row className="justify-content-center">
                <Col lg={8}>
                    <h1 className="display-4 fw-bold">Bienvenido al Portal WorkForce</h1>
                    <p className="lead text-muted mt-3">
                        Tu centro de comando unificado para la gestión en tiempo real (GTR) y la validación de horas extras (HHEE).
                    </p>
                    <hr className="my-4" />
                    
                    {/* Mensaje dinámico basado en si el usuario está logueado */}
                    {!user ? (
                        <>
                            <p>
                                Para comenzar, por favor, inicia sesión con tus credenciales.
                            </p>
                            <Link to="/login">
                                <Button variant="primary" size="lg">Iniciar Sesión</Button>
                            </Link>
                        </>
                    ) : (
                        <>
                            <p>
                                Utiliza la navegación para acceder a las diferentes herramientas y gestionar tu equipo de manera eficiente.
                            </p>
                            <Link to="/dashboard">
                                <Button variant="success" size="lg">Ir a mi Dashboard</Button>
                            </Link>
                        </>
                    )}
                </Col>
            </Row>
        </Container>
    );
}

export default HomePage;