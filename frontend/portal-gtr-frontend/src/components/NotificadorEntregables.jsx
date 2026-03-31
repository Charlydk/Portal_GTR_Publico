// RUTA: src/components/NotificadorEntregables.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL, fetchWithAuth } from '../api';
import { useNavigate } from 'react-router-dom';

function NotificadorEntregables() {
    const { user } = useAuth();
    const [showToast, setShowToast] = useState(false);
    const [nuevaTarea, setNuevaTarea] = useState(null);
    const lastSeenCount = useRef(null);
    const lastSeenIds = useRef(new Set());
    const navigate = useNavigate();

    const checkNewTasks = useCallback(async () => {
        if (!user) return;
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/gtr/entregables/resumen-pendientes`);
            if (res.ok) {
                const data = await res.json();
                const total = data.total || 0;
                const recientes = data.recientes || [];
                const currentIds = new Set(recientes.map(r => r.id));

                // Primera carga: Solo guardamos el estado actual sin notificar
                if (lastSeenCount.current === null) {
                    lastSeenCount.current = total;
                    lastSeenIds.current = currentIds;
                    return;
                }

                // Si hay tareas nuevas (aumentó el contador o hay IDs nuevos en el top 5)
                const hasNewTask = 
                    total > lastSeenCount.current || 
                    [...currentIds].some(id => !lastSeenIds.current.has(id));

                if (hasNewTask) {
                    const newOne = recientes[0]; // La más reciente
                    if (newOne && !lastSeenIds.current.has(newOne.id)) {
                        // FILTRO: Solo notificar si la tarea está asignada al usuario actual
                        if (newOne.asignado_a_id === user.id) {
                            setNuevaTarea(newOne);
                            setShowToast(true);
                        }
                    }
                }

                lastSeenCount.current = total;
                lastSeenIds.current = currentIds;
            }
        } catch (err) {
            console.error("Error polling notifications", err);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        
        // Polling cada 5 minutos
        const interval = setInterval(checkNewTasks, 300000);
        
        // Ejecutar inmediatamente al montar
        checkNewTasks();

        return () => clearInterval(interval);
    }, [user, checkNewTasks]);

    if (!nuevaTarea) return null;

    return (
        <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
            <Toast show={showToast} onClose={() => setShowToast(false)} delay={8000} autohide 
                className="shadow-lg border-0 bg-white" 
                style={{ borderLeft: '4px solid #ffc107' }}>
                <Toast.Header className="bg-white border-0 py-2">
                    <strong className="me-auto text-dark">🔔 Nueva Tarea Asignada</strong>
                    <small className="text-muted">Justo ahora</small>
                </Toast.Header>
                <Toast.Body className="py-2" style={{ cursor: 'pointer' }} onClick={() => {
                    navigate(`/backoffice/entregables/${nuevaTarea.id}`);
                    setShowToast(false);
                }}>
                    <div className="fw-bold text-dark">{nuevaTarea.titulo}</div>
                    <small className="text-muted">Campaña: {nuevaTarea.campana_nombre}</small>
                    <div className="mt-1 small text-primary fw-semibold">Click para ver detalle →</div>
                </Toast.Body>
            </Toast>
        </ToastContainer>
    );
}

export default NotificadorEntregables;
