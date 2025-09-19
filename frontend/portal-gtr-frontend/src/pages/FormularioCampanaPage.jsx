// RUTA: src/pages/FormularioCampanaPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GTR_API_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Form, Button, Alert, Spinner, Card, Row, Col, InputGroup } from 'react-bootstrap';

function FormularioCampanaPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { authToken, user } = useAuth();
    const isEditing = !!id;

    // --- ESTADO PRINCIPAL ---
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        fecha_inicio: '',
        fecha_fin: '',
    });
    // --- NUEVO ESTADO PARA MANEJAR LOS LOBS ---
    const [lobs, setLobs] = useState(['']); // Empezamos con un LOB vacío

    const [loading, setLoading] = useState(isEditing);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // --- LÓGICA PARA MANEJAR LOS LOBS ---
    
    // Cambia el valor de un LOB específico por su índice
    const handleLobChange = (index, event) => {
        const nuevosLobs = [...lobs];
        nuevosLobs[index] = event.target.value;
        setLobs(nuevosLobs);
    };

    // Añade un nuevo campo de LOB vacío a la lista
    const handleAddLob = () => {
        setLobs([...lobs, '']);
    };

    // Quita un campo de LOB de la lista por su índice
    const handleRemoveLob = (index) => {
        const nuevosLobs = [...lobs];
        nuevosLobs.splice(index, 1);
        setLobs(nuevosLobs);
    };
    
    // --- LÓGICA PRINCIPAL DEL FORMULARIO ---

    // Cargar datos si estamos en modo edición (la dejaremos preparada para el futuro)
    const fetchCampana = useCallback(async () => {
        // ... (La lógica de edición la implementaremos más adelante) ...
        setLoading(false);
    }, [id, isEditing, authToken]);

    useEffect(() => {
        fetchCampana();
    }, [fetchCampana]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        // Filtramos los LOBs para no enviar campos vacíos
        const lobs_nombres_filtrados = lobs.filter(lob => lob.trim() !== '');

        const payload = {
            ...formData,
            fecha_inicio: formData.fecha_inicio ? new Date(formData.fecha_inicio).toISOString() : null,
            fecha_fin: formData.fecha_fin ? new Date(formData.fecha_fin).toISOString() : null,
            lobs_nombres: lobs_nombres_filtrados
        };

        try {
            const response = await fetch(`${GTR_API_URL}/campanas/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al crear la campaña.`);
            }

            const result = await response.json();
            setSuccess(`Campaña "${result.nombre}" creada con éxito!`);
            setTimeout(() => navigate(`/campanas/${result.id}`), 2000);

        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };
    
    if (loading) return <Container className="text-center py-5"><Spinner /></Container>;

    return (
        <Container className="py-5">
            <Card className="shadow-lg p-4">
                <h2 className="text-center mb-4 text-primary">
                    {isEditing ? 'Editar Campaña' : 'Crear Nueva Campaña'}
                </h2>

                {error && <Alert variant="danger">{error}</Alert>}
                {success && <Alert variant="success">{success}</Alert>}

                <Form onSubmit={handleSubmit}>
                    <Row>
                        <Col md={6}><Form.Group className="mb-3"><Form.Label>Nombre de la Campaña</Form.Label><Form.Control type="text" name="nombre" value={formData.nombre} onChange={handleChange} required /></Form.Group></Col>
                        <Col md={6}><Form.Group className="mb-3"><Form.Label>Descripción</Form.Label><Form.Control type="text" name="descripcion" value={formData.descripcion} onChange={handleChange} /></Form.Group></Col>
                    </Row>
                    <Row>
                        <Col md={6}><Form.Group className="mb-3"><Form.Label>Fecha de Inicio</Form.Label><Form.Control type="date" name="fecha_inicio" value={formData.fecha_inicio} onChange={handleChange} /></Form.Group></Col>
                        <Col md={6}><Form.Group className="mb-3"><Form.Label>Fecha de Fin</Form.Label><Form.Control type="date" name="fecha_fin" value={formData.fecha_fin} onChange={handleChange} /></Form.Group></Col>
                    </Row>

                    <hr />

                    {/* --- SECCIÓN DINÁMICA PARA LOBS --- */}
                    <Form.Group className="mb-3">
                        <Form.Label>Líneas de Negocio (LOBs)</Form.Label>
                        {lobs.map((lob, index) => (
                            <InputGroup className="mb-2" key={index}>
                                <Form.Control
                                    type="text"
                                    placeholder={`Nombre del LOB #${index + 1}`}
                                    value={lob}
                                    onChange={(e) => handleLobChange(index, e)}
                                />
                                <Button variant="outline-danger" onClick={() => handleRemoveLob(index)} disabled={lobs.length <= 1}>
                                    ✕
                                </Button>
                            </InputGroup>
                        ))}
                        <Button variant="outline-primary" size="sm" onClick={handleAddLob}>
                            + Añadir LOB
                        </Button>
                    </Form.Group>
                    
                    <div className="d-grid gap-2 mt-4">
                        <Button variant="primary" type="submit" disabled={submitting}>
                            {submitting ? <Spinner as="span" size="sm" /> : 'Crear Campaña'}
                        </Button>
                        <Button variant="secondary" onClick={() => navigate('/campanas')} disabled={submitting}>
                            Cancelar
                        </Button>
                    </div>
                </Form>
            </Card>
        </Container>
    );
}

export default FormularioCampanaPage;