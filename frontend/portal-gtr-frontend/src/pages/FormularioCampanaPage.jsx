// RUTA: src/pages/FormularioCampanaPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GTR_API_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Form, Button, Alert, Spinner, Card, Row, Col, InputGroup } from 'react-bootstrap';

function FormularioCampanaPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { authToken } = useAuth();
    const isEditing = !!id;

    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        fecha_inicio: '',
        fecha_fin: '',
    });
    const [lobs, setLobs] = useState(['']); 
    const [loading, setLoading] = useState(isEditing);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleLobChange = (index, event) => {
        const nuevosLobs = [...lobs];
        nuevosLobs[index] = event.target.value;
        setLobs(nuevosLobs);
    };

    const handleAddLob = () => {
        setLobs([...lobs, '']);
    };

    const handleRemoveLob = (index) => {
        // Solo permite eliminar si hay más de un campo
        if (lobs.length > 1) {
            const nuevosLobs = lobs.filter((_, i) => i !== index);
            setLobs(nuevosLobs);
        } else {
            // Si es el último, simplemente lo vacía
            setLobs(['']);
        }
    };
    
    // --- FUNCIÓN DE CARGA DE DATOS (AHORA IMPLEMENTADA) ---
    const fetchCampana = useCallback(async () => {
        if (!isEditing || !authToken) {
            setLoading(false);
            return;
        }
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${id}`);
            if (!response.ok) {
                throw new Error('No se pudo cargar la información de la campaña.');
            }
            const data = await response.json();

            // Función para formatear fechas para el input type="date"
            const formatDateForInput = (dateString) => {
                if (!dateString) return '';
                return new Date(dateString).toISOString().split('T')[0];
            };
            
            setFormData({
                nombre: data.nombre || '',
                descripcion: data.descripcion || '',
                fecha_inicio: formatDateForInput(data.fecha_inicio),
                fecha_fin: formatDateForInput(data.fecha_fin),
            });

            // Cargamos los LOBs existentes
            const lobsExistentes = data.lobs.map(lob => lob.nombre);
            setLobs(lobsExistentes.length > 0 ? lobsExistentes : ['']);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id, isEditing, authToken]);

    useEffect(() => {
        fetchCampana();
    }, [fetchCampana]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // --- FUNCIÓN DE GUARDADO (AHORA MANEJA EDICIÓN Y CREACIÓN) ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        const lobs_nombres_filtrados = lobs.filter(lob => lob.trim() !== '');

        const payload = {
            ...formData,
            fecha_inicio: formData.fecha_inicio ? new Date(formData.fecha_inicio).toISOString() : null,
            fecha_fin: formData.fecha_fin ? new Date(formData.fecha_fin).toISOString() : null,
            lobs_nombres: lobs_nombres_filtrados
        };

        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `${GTR_API_URL}/campanas/${id}` : `${GTR_API_URL}/campanas/`;

        try {
            const response = await fetchWithAuth(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} la campaña.`);
            }

            const result = await response.json();
            setSuccess(`Campaña "${result.nombre}" ${isEditing ? 'actualizada' : 'creada'} con éxito!`);
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
                                <Button variant="outline-danger" onClick={() => handleRemoveLob(index)}>
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
                            {submitting ? <Spinner as="span" size="sm" /> : (isEditing ? 'Actualizar Campaña' : 'Crear Campaña')}
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