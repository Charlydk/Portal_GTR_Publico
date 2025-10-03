// src/pages/CambiarPasswordPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../api';



function CambiarPasswordPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/analistas/${user.id}/password`, {
                method: 'PUT',
                // --- INICIO DE LA CORRECCIÓN ---
                // Añadimos este encabezado para decirle al backend que es un JSON
                headers: {
                    'Content-Type': 'application/json',
                },
                // --- FIN DE LA CORRECCIÓN ---
                body: JSON.stringify({ new_password: newPassword }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'No se pudo actualizar la contraseña.');
            }

            setSuccess('¡Contraseña actualizada con éxito! Serás redirigido al dashboard.');
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="py-5">
            <Row className="justify-content-center">
                <Col md={6}>
                    <Card className="shadow-lg">
                        <Card.Header as="h2" className="text-center">Cambiar mi Contraseña</Card.Header>
                        <Card.Body>
                            {error && <Alert variant="danger">{error}</Alert>}
                            {success && <Alert variant="success">{success}</Alert>}
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3" controlId="newPassword">
                                    <Form.Label>Nueva Contraseña</Form.Label>
                                    <Form.Control 
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength="6"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3" controlId="confirmPassword">
                                    <Form.Label>Confirmar Nueva Contraseña</Form.Label>
                                    <Form.Control 
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </Form.Group>
                                <div className="d-grid">
                                    <Button variant="primary" type="submit" disabled={loading}>
                                        {loading ? <Spinner as="span" size="sm"/> : 'Actualizar Contraseña'}
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default CambiarPasswordPage;