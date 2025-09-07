// src/pages/MisSolicitudesHHEEPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE_URL } from '../../api';
import FormularioSolicitudHHEE from '../../components/hhee/FormularioSolicitudHHEE';
import HistorialSolicitudesHHEE from '../../components/hhee/HistorialSolicitudesHHEE';

function MisSolicitudesHHEEPage() {
    const { authToken } = useAuth();
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitStatus, setSubmitStatus] = useState({ loading: false, error: null, success: null });

    const fetchMisSolicitudes = useCallback(async () => {
        if (!authToken) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/hhee/solicitudes/mis-solicitudes/`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
            });
            if (!response.ok) throw new Error('No se pudo cargar el historial de solicitudes.');
            const data = await response.json();
            setSolicitudes(data);
        } catch (err) {
            setSubmitStatus(prev => ({ ...prev, error: err.message }));
        } finally {
            setLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        fetchMisSolicitudes();
    }, [fetchMisSolicitudes]);

    const handleCreateSolicitud = async (formData) => {
        setSubmitStatus({ loading: true, error: null, success: null });
        try {
            const response = await fetch(`${API_BASE_URL}/hhee/solicitudes/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify(formData),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al enviar la solicitud.');
            }
            setSubmitStatus({ loading: false, error: null, success: '¡Solicitud enviada con éxito!' });
            fetchMisSolicitudes(); // Recargar el historial
            return true; // Indica éxito para que el form se limpie
        } catch (err) {
            setSubmitStatus({ loading: false, error: err.message, success: null });
            return false; // Indica fallo
        }
    };

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="text-center bg-info text-white">
                    Mis Solicitudes de Horas Extras
                </Card.Header>
                <Card.Body>
                    <Card.Title>Registrar Horas Extras Realizadas</Card.Title>
                    <FormularioSolicitudHHEE 
                        onSubmit={handleCreateSolicitud}
                        loading={submitStatus.loading}
                        error={submitStatus.error}
                        success={submitStatus.success}
                    />
                    <hr />
                    <Card.Title>Mi Historial</Card.Title>
                    {loading ? (
                        <div className="text-center"><Spinner /></div>
                    ) : (
                        <HistorialSolicitudesHHEE solicitudes={solicitudes} />
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default MisSolicitudesHHEEPage;