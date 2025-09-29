// RUTA: src/pages/FormularioIncidenciaPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { GTR_API_URL, fetchWithAuth } from '../api';
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
                fetchWithAuth(`${GTR_API_URL}/campanas/`, {}),
                fetchWithAuth(`${GTR_API_URL}/analistas/listado-simple/`, {})
            ]);
            if (!campanasRes.ok || !analistasRes.ok) throw new Error('No se pudieron cargar los datos necesarios.');
            setCampanas(await campanasRes.json());
            setAnalistas(await analistasRes.json());

            if (isEditing) {
                const incidenciaRes = await fetchWithAuth(`${GTR_API_URL}/incidencias/${id}`, {});
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

    const handleSubmit = async (e) => { // La `e` viene del formulario hijo, pero es en realidad el payload
        setIsSubmitting(true);
        setError(null);
    
        // Ya no necesitamos e.preventDefault() porque el hijo no es un form real
        const payload = e; // El argumento 'e' es ahora nuestro payload de datos
    
        const url = isEditing ? `${GTR_API_URL}/incidencias/${id}` : `${GTR_API_URL}/incidencias/`;
        const method = isEditing ? 'PUT' : 'POST';
    
        try {
            // AÑADIMOS el header 'Content-Type'
            const response = await fetchWithAuth(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
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