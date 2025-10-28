// RUTA: src/pages/GestionPlantillasPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Form, Button, Spinner, Alert, ListGroup, InputGroup } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { GTR_API_URL, fetchWithAuth } from '../api';

function GestionPlantillasPage() {
    const { authToken } = useAuth();
    const [campanas, setCampanas] = useState([]);
    const [selectedCampanaId, setSelectedCampanaId] = useState('');
    const [plantillaItems, setPlantillaItems] = useState([]);
    const [newItemText, setNewItemText] = useState('');
    
    const [loading, setLoading] = useState({ campanas: false, items: false });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const fetchCampanas = useCallback(async () => {
        if (!authToken) return;
        setLoading(prev => ({ ...prev, campanas: true }));
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/listado-simple/`);
            if (!response.ok) throw new Error('No se pudieron cargar las campañas.');
            setCampanas(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(prev => ({ ...prev, campanas: false }));
        }
    }, [authToken]);

    const fetchPlantillaItems = useCallback(async () => {
        if (!authToken || !selectedCampanaId) {
            setPlantillaItems([]);
            return;
        }
        setLoading(prev => ({ ...prev, items: true }));
        setError(null);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${selectedCampanaId}/plantilla`);
            if (!response.ok) throw new Error('No se pudo cargar la plantilla para esta campaña.');
            setPlantillaItems(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(prev => ({ ...prev, items: false }));
        }
    }, [authToken, selectedCampanaId]);

    useEffect(() => {
        fetchCampanas();
    }, [fetchCampanas]);

    useEffect(() => {
        fetchPlantillaItems();
    }, [fetchPlantillaItems]);

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!newItemText.trim()) return;
        setSubmitting(true);
        setError(null);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/campanas/${selectedCampanaId}/plantilla`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descripcion: newItemText }),
            });
            if (!response.ok) throw new Error('No se pudo añadir el ítem.');
            setNewItemText('');
            fetchPlantillaItems(); // Refrescamos la lista
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este ítem de la plantilla?')) return;
        setError(null);
        try {
            const response = await fetchWithAuth(`${GTR_API_URL}/plantilla-items/${itemId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('No se pudo eliminar el ítem.');
            fetchPlantillaItems(); // Refrescamos la lista
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <Container className="py-5">
            <Card className="shadow-lg">
                <Card.Header as="h2" className="bg-info text-white">Gestión de Plantillas de Checklist</Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form.Group className="mb-4">
                        <Form.Label><h5>1. Selecciona una Campaña</h5></Form.Label>
                        <Form.Select 
                            value={selectedCampanaId} 
                            onChange={e => setSelectedCampanaId(e.target.value)}
                            disabled={loading.campanas}
                        >
                            <option value="">Selecciona para ver o editar su plantilla...</option>
                            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </Form.Select>
                    </Form.Group>

                    {selectedCampanaId && (
                        <>
                            <hr />
                            <h5>2. Tareas de la Plantilla</h5>
                            {loading.items ? <div className="text-center"><Spinner/></div> : (
                                <ListGroup className="mb-4">
                                    {plantillaItems.length > 0 ? plantillaItems.map(item => (
                                        <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center">
                                            {item.descripcion}
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDeleteItem(item.id)}>✕</Button>
                                        </ListGroup.Item>
                                    )) : <p className="text-muted">Esta campaña aún no tiene una plantilla de checklist.</p>}
                                </ListGroup>
                            )}

                            <h5>3. Añadir Nueva Tarea a la Plantilla</h5>
                            <Form onSubmit={handleAddItem}>
                                <InputGroup>
                                    <Form.Control
                                        type="text"
                                        placeholder="Ej: Generar reporte de ausentismo"
                                        value={newItemText}
                                        onChange={e => setNewItemText(e.target.value)}
                                        required
                                    />
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? <Spinner size="sm"/> : 'Añadir'}
                                    </Button>
                                </InputGroup>
                            </Form>
                        </>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default GestionPlantillasPage;