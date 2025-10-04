// RUTA: src/pages/FormularioIncidenciaPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GTR_API_URL, fetchWithAuth } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Container, Card, Spinner } from 'react-bootstrap';
import FormularioIncidencia from '../components/incidencias/FormularioIncidencia';

function FormularioIncidenciaPage() {
    const { id } = useParams();
    const isEditing = !!id;
    const navigate = useNavigate();
    const { authToken } = useAuth();
    
    const [incidencia, setIncidencia] = useState(null);
    const [formData, setFormData] = useState({
        titulo: '', descripcion_inicial: '', herramienta_afectada: '',
        indicador_afectado: '', tipo: 'TECNICA', gravedad: 'MEDIA',
        campana_id: '', asignado_a_id: ''
    });

    const [campanas, setCampanas] = useState([]);
    const [analistas, setAnalistas] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- 1. AÑADIMOS ESTADOS PARA LOS LOBS ---
    const [lobs, setLobs] = useState([]);
    const [loadingLobs, setLoadingLobs] = useState(false);

    // --- 2. CREAMOS UNA FUNCIÓN PARA BUSCAR LOBS ---
    const fetchLobs = useCallback(async (campanaId) => {
        if (!authToken || !campanaId) {
            setLobs([]);
            return;
        }
        setLoadingLobs(true);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${campanaId}/lobs`, {});
            if (!response.ok) {
                setLobs([]);
                console.error("No se pudieron cargar los LOBs.");
                return;
            }
            setLobs(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingLobs(false);
        }
    }, [authToken]);


    const fetchData = useCallback(async () => {
        if (!authToken) return;
        setLoading(true);
        try {
            const [campanasRes, analistasRes] = await Promise.all([
                fetchWithAuth(`${GTR_API_URL}/campanas/listado-simple/`, {}),
                fetchWithAuth(`${GTR_API_URL}/analistas/listado-simple/`, {})
            ]);
            if (!campanasRes.ok || !analistasRes.ok) throw new Error('No se pudieron cargar los datos necesarios.');
            setCampanas(await campanasRes.json());
            setAnalistas(await analistasRes.json());

            if (isEditing) {
                const incidenciaRes = await fetchWithAuth(`${GTR_API_URL}/incidencias/${id}`, {});
                if (!incidenciaRes.ok) throw new Error('No se pudo cargar la incidencia para editar.');
                const incidenciaData = await incidenciaRes.json();
                
                setIncidencia(incidenciaData);
                setFormData({
                    titulo: incidenciaData.titulo || '',
                    descripcion_inicial: incidenciaData.descripcion_inicial || '',
                    herramienta_afectada: incidenciaData.herramienta_afectada || '',
                    indicador_afectado: incidenciaData.indicador_afectado || '',
                    tipo: incidenciaData.tipo || 'TECNICA',
                    gravedad: incidenciaData.gravedad || 'MEDIA',
                    campana_id: incidenciaData.campana?.id || '',
                    asignado_a_id: incidenciaData.asignado_a?.id || '',
                    fecha_apertura: incidenciaData.fecha_apertura
                });

                // --- 3. LLAMAMOS A LA FUNCIÓN PARA CARGAR LOS LOBS DE LA CAMPAÑA EDITADA ---
                if (incidenciaData.campana?.id) {
                    fetchLobs(incidenciaData.campana.id);
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [authToken, id, isEditing, fetchLobs]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- 4. AÑADIMOS UN useEffect PARA RECARGAR LOBS SI SE CAMBIA LA CAMPAÑA MANUALMENTE ---
    useEffect(() => {
        if (formData.campana_id) {
            fetchLobs(formData.campana_id);
        }
    }, [formData.campana_id, fetchLobs]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (payload) => {
        setIsSubmitting(true);
        setError(null);
    
        const url = isEditing ? `${GTR_API_URL}/incidencias/${id}` : `${GTR_API_URL}/incidencias/`;
        const method = isEditing ? 'PUT' : 'POST';
    
        try {
            const response = await fetchWithAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
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

    if (loading) return <Container className="text-center py-5"><Spinner /></Container>;

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
                        selectedLobs={incidencia?.lobs || []}

                        // --- 5. PASAMOS LOS NUEVOS DATOS AL FORMULARIO ---
                        lobs={lobs}
                        loadingLobs={loadingLobs}
                    />
                </Card.Body>
            </Card>
        </Container>
    );
}

export default FormularioIncidenciaPage;