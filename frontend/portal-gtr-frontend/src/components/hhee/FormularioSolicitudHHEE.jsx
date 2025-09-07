// src/components/hhee/FormularioSolicitudHHEE.jsx
import React, { useState } from 'react';
import { Form, Button, Row, Col, Spinner, Alert } from 'react-bootstrap';
// <-- CAMBIO: Importamos la función de utilidad que ya teníamos en el proyecto
import { hhmmToDecimal } from '../../utils/timeUtils';

function FormularioSolicitudHHEE({ onSubmit, loading, error, success }) {
    const [formData, setFormData] = useState({
        fecha_hhee: '',
        tipo: 'DESPUES_TURNO',
        // <-- CAMBIO: El valor inicial ahora es un string de tiempo
        horas_solicitadas: '00:00', 
        justificacion: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // <-- CAMBIO: Convertimos el formato HH:MM a decimal antes de enviarlo
        const horasDecimales = hhmmToDecimal(formData.horas_solicitadas);
        if (horasDecimales <= 0) {
            alert("Las horas solicitadas deben ser mayores a 00:00.");
            return;
        }

        const dataToSend = {
            ...formData,
            horas_solicitadas: horasDecimales
        };
        // -----------------------------------------------------------------

        onSubmit(dataToSend).then(success => {
            if (success) {
                // Limpiar formulario si el envío fue exitoso
                setFormData({
                    fecha_hhee: '', tipo: 'DESPUES_TURNO',
                    horas_solicitadas: '00:00', // <-- CAMBIO
                    justificacion: ''
                });
            }
        });
    };

    return (
        <Form onSubmit={handleSubmit} className="mb-4">
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}
            <Row className="g-3">
                <Col md={3}>
                    <Form.Group controlId="fecha_hhee">
                        <Form.Label>Fecha de las HHEE</Form.Label>
                        <Form.Control type="date" name="fecha_hhee" value={formData.fecha_hhee} onChange={handleChange} required />
                    </Form.Group>
                </Col>
                <Col md={3}>
                    <Form.Group controlId="tipo">
                        <Form.Label>Tipo</Form.Label>
                        <Form.Select name="tipo" value={formData.tipo} onChange={handleChange} required>
                            <option value="ANTES_TURNO">Antes de Turno</option>
                            <option value="DESPUES_TURNO">Después de Turno</option>
                            <option value="DIA_DESCANSO">Día de Descanso</option>
                        </Form.Select>
                    </Form.Group>
                </Col>
                <Col md={2}>
                    <Form.Group controlId="horas_solicitadas">
                        {/* <-- CAMBIO: El input ahora es de tipo 'time' */}
                        <Form.Label>Horas (HH:MM)</Form.Label>
                        <Form.Control type="time" name="horas_solicitadas" value={formData.horas_solicitadas} onChange={handleChange} required />
                    </Form.Group>
                </Col>
                <Col md={4}>
                    <Form.Group controlId="justificacion">
                        <Form.Label>Justificación</Form.Label>
                        <Form.Control as="textarea" name="justificacion" value={formData.justificacion} onChange={handleChange} required rows={1} placeholder="Motivo de las HHEE..." />
                    </Form.Group>
                </Col>
            </Row>
            <Button variant="primary" type="submit" className="mt-3" disabled={loading}>
                {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Enviar Solicitud'}
            </Button>
        </Form>
    );
}

export default FormularioSolicitudHHEE;