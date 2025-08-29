// src/pages/DetalleAvisoPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

function DetalleAvisoPage() {
    const { avisoId } = useParams();
    const navigate = useNavigate();
    const [aviso, setAviso] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { authToken, user } = useAuth();

    const fetchAvisoDetalle = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/avisos/${avisoId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
            });
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("No autorizado. Por favor, inicie sesión.");
                }
                if (response.status === 403) {
                    throw new Error("Acceso denegado. No tiene los permisos necesarios para ver este aviso.");
                }
                throw new Error(`Error al cargar el aviso: ${response.statusText}`);
            }
            const data = await response.json();
            setAviso(data);
        } catch (err) {
            console.error("Error al obtener detalle del aviso:", err);
            setError(err.message || "No se pudo cargar el detalle del aviso.");
        } finally {
            setLoading(false);
        }
    }, [avisoId, authToken]);

    useEffect(() => {
        if (authToken && avisoId) {
            fetchAvisoDetalle();
        } else {
            setLoading(false);
            setError("Necesita iniciar sesión para ver el aviso.");
        }
    }, [authToken, avisoId, fetchAvisoDetalle]);

    const handleAcuseRecibo = async () => {
        if (!user) {
            alert("Debe iniciar sesión para acusar recibo.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/avisos/${avisoId}/acuse_recibo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({ analista_id: user.id }),
            });

            if (!response.ok) {
                if (response.status === 409) {
                    alert("Ya ha acusado recibo de este aviso.");
                } else if (response.status === 403) {
                    alert("No tiene permiso para registrar este acuse de recibo.");
                } else {
                    throw new Error(`Error al registrar acuse de recibo: ${response.statusText}`);
                }
            } else {
                alert('Acuse de recibo registrado con éxito.');
                fetchAvisoDetalle(); // Recargar el aviso para actualizar los acuses
            }
        } catch (err) {
            console.error("Error al registrar acuse de recibo:", err);
            alert(err.message || "No se pudo registrar el acuse de recibo.");
        }
    };

    const formatDateTime = (apiDateString) => {
        // Si no hay fecha, devuelve N/A
        if (!apiDateString) {
            return 'N/A';
        }
    
        // --- LA CORRECCIÓN DEFINITIVA ---
        // Le añadimos la 'Z' al final para forzar a que JavaScript
        // interprete el string como una fecha en formato UTC universal.
        const date = new Date(apiDateString + 'Z');
        // --------------------------------
    
        // Verificamos si la fecha parseada es válida
        if (isNaN(date.getTime())) {
            return 'Fecha inválida';
        }
    
        // A partir de aquí, el resto del código funciona como se espera
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son de 0 a 11
        const year = date.getFullYear();
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
    
        return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
    };

    if (loading) {
        return (
            <div className="container mt-4 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando aviso...</span>
                </div>
                <p>Cargando detalle del aviso...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mt-4">
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
                {!authToken && (
                    <Link to="/login" className="btn btn-primary mt-3">Ir a Iniciar Sesión</Link>
                )}
                <button onClick={() => navigate(-1)} className="btn btn-secondary mt-3 ms-2">Volver</button>
            </div>
        );
    }

    if (!aviso) {
        return (
            <div className="container mt-4">
                <div className="alert alert-warning" role="alert">
                    Aviso no encontrado.
                </div>
                <button onClick={() => navigate(-1)} className="btn btn-secondary mt-3">Volver</button>
            </div>
        );
    }

    // Lógica para verificar si el usuario actual ya acusó recibo
    // ¡CORRECCIÓN CLAVE AQUÍ! Usar encadenamiento opcional para evitar TypeError
    const hasAcknowledged = aviso?.acuses_recibo?.some(acuse => acuse.analista?.id === user?.id); // Línea 148 o similar

    return (
        <div className="container mt-4">
            <h2 className="mb-4">Detalle del Aviso: {aviso.titulo}</h2>
            <div className="card mb-4">
                <div className="card-body">
                    <h5 className="card-title">{aviso.titulo}</h5>
                    <p className="card-text"><strong>Contenido:</strong> {aviso.contenido}</p>
                    {/* Mostrar nombre del creador y campaña si están disponibles */}
                    <p className="card-text"><strong>Creador:</strong> {aviso.creador ? `${aviso.creador.nombre} ${aviso.creador.apellido}` : 'N/A'}</p>
                    <p className="card-text"><strong>Campaña:</strong> {aviso.campana ? aviso.campana.nombre : 'N/A'}</p>
                    <p className="card-text"><strong>Fecha de Creación:</strong> {formatDateTime(aviso.fecha_creacion)}</p>
                    <p className="card-text"><strong>Fecha de Vencimiento:</strong> {aviso.fecha_vencimiento ? formatDateTime(aviso.fecha_vencimiento) : 'N/A'}</p>
                    
                    {user && user.role === 'ANALISTA' && !hasAcknowledged && (
                        <button onClick={handleAcuseRecibo} className="btn btn-success mt-3">
                            Acusar Recibo
                        </button>
                    )}
                    {user && user.role === 'ANALISTA' && hasAcknowledged && (
                        <p className="text-success mt-3">¡Ya has acusado recibo de este aviso!</p>
                    )}
                </div>
            </div>

            <h3 className="mb-3">Acuses de Recibo</h3>
            {/* Asegurarse de que aviso.acuses_recibo exista y sea un array antes de mapear */}
            {aviso.acuses_recibo && Array.isArray(aviso.acuses_recibo) && aviso.acuses_recibo.length > 0 ? (
                <ul className="list-group mb-4">
                    {aviso.acuses_recibo.map(acuse => (
                        <li key={acuse.id} className="list-group-item">
                            {/* Usar encadenamiento opcional también aquí */}
                            {acuse.analista ? `${acuse.analista.nombre} ${acuse.analista.apellido}` : `Analista ID: ${acuse.analista_id}`} - {formatDateTime(acuse.fecha_acuse)}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No hay acuses de recibo para este aviso aún.</p>
            )}

            <button onClick={() => navigate(-1)} className="btn btn-secondary mt-3">Volver a Avisos</button>
        </div>
    );
}

export default DetalleAvisoPage;
