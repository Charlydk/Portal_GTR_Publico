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

    // 1. ESTADO INICIAL COMPLETO (Con los 3 bloques de horario)
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        fecha_inicio: '',
        fecha_fin: '',
        
        // Bloque Semana
        hora_inicio_semana: '',
        hora_fin_semana: '',
        
        // Bloque Sábado
        hora_inicio_sabado: '',
        hora_fin_sabado: '',
        
        // Bloque Domingo
        hora_inicio_domingo: '',
        hora_fin_domingo: ''
    });
    
    const [lobs, setLobs] = useState(['']); 
    const [loading, setLoading] = useState(isEditing);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // --- MANEJO DE LOBs ---
    const handleLobChange = (index, event) => {
        const nuevosLobs = [...lobs];
        nuevosLobs[index] = event.target.value;
        setLobs(nuevosLobs);
    };
    const handleAddLob = () => setLobs([...lobs, '']);
    const handleRemoveLob = (index) => {
        if (lobs.length > 1) {
            setLobs(lobs.filter((_, i) => i !== index));
        } else {
            setLobs(['']);
        }
    };
    
    // --- CARGA DE DATOS (SI ES EDICIÓN) ---
    const fetchCampana = useCallback(async () => {
        if (!isEditing || !authToken) {
            setLoading(false);
            return;
        }
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${id}`);
            if (!response.ok) throw new Error('Error al cargar la campaña.');
            
            const data = await response.json();

            // Helpers para formatear fechas y horas
            const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
            const formatTime = (t) => t ? t.substring(0, 5) : ''; // "08:00:00" -> "08:00"

            setFormData({
                nombre: data.nombre || '',
                descripcion: data.descripcion || '',
                fecha_inicio: formatDate(data.fecha_inicio),
                fecha_fin: formatDate(data.fecha_fin),
                
                // Mapeamos los horarios que vienen del backend
                hora_inicio_semana: formatTime(data.hora_inicio_semana),
                hora_fin_semana: formatTime(data.hora_fin_semana),
                
                hora_inicio_sabado: formatTime(data.hora_inicio_sabado),
                hora_fin_sabado: formatTime(data.hora_fin_sabado),
                
                hora_inicio_domingo: formatTime(data.hora_inicio_domingo),
                hora_fin_domingo: formatTime(data.hora_fin_domingo),
            });

            const lobsExistentes = data.lobs ? data.lobs.map(lob => lob.nombre) : [];
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

    // --- ENVÍO DEL FORMULARIO (LA CORRECCIÓN CLAVE ESTÁ AQUÍ) ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        // Limpieza de LOBs vacíos
        const lobs_nombres_filtrados = lobs.filter(lob => lob.trim() !== '');

        // Función auxiliar: Si el campo está vacío (""), enviar null. Si tiene valor, enviarlo.
        // Esto evita el error 422 de "Invalid Time"
        const cleanTime = (val) => (val && val.trim() !== '') ? val : null;
        const cleanDate = (val) => (val && val.trim() !== '') ? new Date(val).toISOString() : null;

        const payload = {
            nombre: formData.nombre,
            descripcion: formData.descripcion,
            fecha_inicio: cleanDate(formData.fecha_inicio),
            fecha_fin: cleanDate(formData.fecha_fin),
            
            // Enviamos los 3 bloques limpios
            hora_inicio_semana: cleanTime(formData.hora_inicio_semana),
            hora_fin_semana: cleanTime(formData.hora_fin_semana),
            
            hora_inicio_sabado: cleanTime(formData.hora_inicio_sabado),
            hora_fin_sabado: cleanTime(formData.hora_fin_sabado),
            
            hora_inicio_domingo: cleanTime(formData.hora_inicio_domingo),
            hora_fin_domingo: cleanTime(formData.hora_fin_domingo),
            
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
                console.error("Error Backend:", errorData); // Para depurar en consola
                // Si es 422, suele devolver un array 'detail'
                const msg = errorData.detail ? JSON.stringify(errorData.detail) : 'Error al guardar.';
                throw new Error(msg);
            }

            const result = await response.json();
            setSuccess(`Campaña "${result.nombre}" guardada correctamente.`);
            setTimeout(() => navigate('/campanas'), 1500);

        } catch (err) {
            setError("Error: " + err.message);
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
                    {/* --- DATOS BÁSICOS --- */}
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Nombre de la Campaña</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    name="nombre" 
                                    value={formData.nombre} 
                                    onChange={handleChange} 
                                    required 
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Descripción</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    name="descripcion" 
                                    value={formData.descripcion} 
                                    onChange={handleChange} 
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="mb-4">
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Fecha de Inicio</Form.Label>
                                <Form.Control 
                                    type="date" 
                                    name="fecha_inicio" 
                                    value={formData.fecha_inicio} 
                                    onChange={handleChange} 
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Fecha de Fin</Form.Label>
                                <Form.Control 
                                    type="date" 
                                    name="fecha_fin" 
                                    value={formData.fecha_fin} 
                                    onChange={handleChange} 
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <hr />

                    {/* --- SECCIÓN DE HORARIOS (3 BLOQUES: SEMANA, SÁBADO, DOMINGO) --- */}
                    <div className="mb-4">
                        <h5 className="text-secondary mb-3">🕒 Configuración de Horarios Operativos</h5>
                        <Row className="g-3">
                            {/* BLOQUE 1: SEMANA */}
                            <Col md={4}>
                                <Card className="h-100 border-primary border-opacity-25">
                                    <Card.Header className="bg-primary bg-opacity-10 fw-bold text-primary text-center">
                                        🏢 Lunes a Viernes
                                    </Card.Header>
                                    <Card.Body>
                                        <Form.Group className="mb-2">
                                            <Form.Label className="small text-muted">Apertura</Form.Label>
                                            <Form.Control 
                                                type="time" 
                                                name="hora_inicio_semana" 
                                                value={formData.hora_inicio_semana || ''} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                        <Form.Group>
                                            <Form.Label className="small text-muted">Cierre</Form.Label>
                                            <Form.Control 
                                                type="time" 
                                                name="hora_fin_semana" 
                                                value={formData.hora_fin_semana || ''} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Card.Body>
                                </Card>
                            </Col>

                            {/* BLOQUE 2: SÁBADO */}
                            <Col md={4}>
                                <Card className="h-100 border-info border-opacity-25">
                                    <Card.Header className="bg-info bg-opacity-10 fw-bold text-info text-center">
                                        🌤️ Sábados
                                    </Card.Header>
                                    <Card.Body>
                                        <Form.Group className="mb-2">
                                            <Form.Label className="small text-muted">Apertura</Form.Label>
                                            <Form.Control 
                                                type="time" 
                                                name="hora_inicio_sabado" 
                                                value={formData.hora_inicio_sabado || ''} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                        <Form.Group>
                                            <Form.Label className="small text-muted">Cierre</Form.Label>
                                            <Form.Control 
                                                type="time" 
                                                name="hora_fin_sabado" 
                                                value={formData.hora_fin_sabado || ''} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Card.Body>
                                </Card>
                            </Col>

                            {/* BLOQUE 3: DOMINGO */}
                            <Col md={4}>
                                <Card className="h-100 border-success border-opacity-25">
                                    <Card.Header className="bg-success bg-opacity-10 fw-bold text-success text-center">
                                        🏡 Domingos
                                    </Card.Header>
                                    <Card.Body>
                                        <Form.Group className="mb-2">
                                            <Form.Label className="small text-muted">Apertura</Form.Label>
                                            <Form.Control 
                                                type="time" 
                                                name="hora_inicio_domingo" 
                                                value={formData.hora_inicio_domingo || ''} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                        <Form.Group>
                                            <Form.Label className="small text-muted">Cierre</Form.Label>
                                            <Form.Control 
                                                type="time" 
                                                name="hora_fin_domingo" 
                                                value={formData.hora_fin_domingo || ''} 
                                                onChange={handleChange} 
                                            />
                                        </Form.Group>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                        <Form.Text className="text-muted d-block text-center mt-2">
                            * Deja los campos vacíos en los días que la campaña permanece cerrada.
                        </Form.Text>
                    </div>

                    <hr />

                    {/* --- LOBS --- */}
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
                    
                    {/* --- BOTONES --- */}
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