// RUTA: src/pages/FormularioIncidenciaPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { GTR_API_URL } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Card, Spinner, Alert } from 'react-bootstrap';
import FormularioIncidencia from '../components/incidencias/FormularioIncidencia'; // <-- IMPORTAMOS EL NUEVO COMPONENTE

function FormularioIncidenciaPage() {
    const { id } = useParams();
    const isEditing = !!id;
    const navigate = useNavigate();
    const location = useLocation();
    const { authToken } = useAuth();
    
    const queryParams = new URLSearchParams(location.search);
    const campanaIdFromQuery = queryParams.get('campanaId');

    const [formData, setFormData] = useState({
        titulo: '', descripcion_inicial: '', herramienta_afectada: '',
        indicador_afectado: '', tipo: 'TECNICA', gravedad: 'MEDIA',
        campana_id: campanaIdFromQuery || '', asignado_a_id: ''
    });

    const [campanas, setCampanas] = useState([]);
    const [analistas, setAnalistas] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!authToken) return;
        setLoading(true);
        try {
            const [campanasRes, analistasRes] = await Promise.all([
                fetch(`${GTR_API_URL}/campanas/`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
                fetch(`${GTR_API_URL}/analistas/listado-simple/`, { headers: { 'Authorization': `Bearer ${authToken}` } })
            ]);
            if (!campanasRes.ok || !analistasRes.ok) throw new Error('No se pudieron cargar los datos necesarios.');
            setCampanas(await campanasRes.json());
            setAnalistas(await analistasRes.json());

            if (isEditing) {
                const incidenciaRes = await fetch(`${GTR_API_URL}/incidencias/${id}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
                if (!incidenciaRes.ok) throw new Error('No se pudo cargar la incidencia para editar.');
                const incidenciaData = await incidenciaRes.json();
                setFormData({
                    titulo: incidenciaData.titulo || '',
                    descripcion_inicial: incidenciaData.descripcion_inicial || '',
                    herramienta_afectada: incidenciaData.herramienta_afectada || '',
                    indicador_afectado: incidenciaData.indicador_afectado || '',
                    tipo: incidenciaData.tipo || 'TECNICA',
                    gravedad: incidenciaData.gravedad || 'MEDIA',
                    campana_id: incidenciaData.campana?.id || '',
                    asignado_a_id: incidenciaData.asignado_a?.id || ''
                });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, id, isEditing]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const url = isEditing ? `${GTR_API_URL}/incidencias/${id}` : `${GTR_API_URL}/incidencias/`;
        const method = isEditing ? 'PUT' : 'POST';
        
        const payload = isEditing ? {
             ...formData,
             asignado_a_id: formData.asignado_a_id ? parseInt(formData.asignado_a_id, 10) : null
        } : {
            ...formData,
            campana_id: parseInt(formData.campana_id, 10),
        };

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error al ${isEditing ? 'actualizar' : 'crear'} la incidencia.`);
            }
            const result = await response.json();
            navigate(`/incidencias/${result.id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading && !isEditing) return <Container className="text-center py-5"><Spinner /></Container>;

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="bg-danger text-white">{isEditing ? 'Modificar Incidencia' : 'Registrar Nueva Incidencia'}</Card.Header>
                <Card.Body>
                    <FormularioIncidencia
                        formData={formData}
                        handleChange={handleChange}
                        handleSubmit={handleSubmit}
                        isEditing={isEditing}
                        isSubmitting={isSubmitting}
                        loading={loading}
                        campanas={campanas}
                        analistas={analistas}
                        error={error}
                        campanaIdFromQuery={campanaIdFromQuery}
                    />
                </Card.Body>
            </Card>
        </Container>
    );
}

export default FormularioIncidenciaPage;