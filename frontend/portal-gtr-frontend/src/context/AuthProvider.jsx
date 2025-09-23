// RUTA: src/context/AuthProvider.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { AuthContext } from './AuthContext';
import { Modal, Button } from 'react-bootstrap';

export const AuthProvider = ({ children }) => {
    // --- 1. DEFINICIÓN DE TODOS LOS ESTADOS ---
    const [user, setUser] = useState(null);
    const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showInactivityModal, setShowInactivityModal] = useState(false);

    const navigate = useNavigate();

    // --- 2. DEFINICIÓN DE TODAS LAS FUNCIONES ---
    const INACTIVITY_TIMEOUT = 2 * 60 * 1000;
    const WARNING_TIME = 1 * 60 * 1000;

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setUser(null);
        setShowInactivityModal(false);
        clearTimeout(window.warningTimeout);
        clearTimeout(window.logoutTimeout);
        navigate('/login');
    }, [navigate]);

    const resetInactivityTimer = useCallback(() => {
        if (window.warningTimeout) clearTimeout(window.warningTimeout);
        if (window.logoutTimeout) clearTimeout(window.logoutTimeout);

        window.warningTimeout = setTimeout(() => {
            setShowInactivityModal(true);
        }, WARNING_TIME);

        window.logoutTimeout = setTimeout(logout, INACTIVITY_TIMEOUT);
    }, [logout, WARNING_TIME, INACTIVITY_TIMEOUT]);

    const handleContinueSession = () => {
        setShowInactivityModal(false);
        resetInactivityTimer();
    };

    const fetchUserProfile = useCallback(async (token) => {
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/users/me/`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
            } else {
                console.error("Token no válido o sesión expirada. Limpiando sesión.");
                logout();
            }
        } catch (error) {
            console.error("Error de red al obtener el perfil del usuario:", error);
            logout();
        } finally {
            setLoading(false);
        }
    }, [logout]);

    const refreshUser = useCallback(async () => {
        if (authToken) {
            await fetchUserProfile(authToken);
        }
    }, [authToken, fetchUserProfile]);

    const login = async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: email, password: password }).toString(),
            });
            if (!response.ok) {
                if (response.status === 429) throw new Error("Demasiados intentos. Por favor, espera un minuto.");
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Email o contraseña incorrectos.');
            }
            const data = await response.json();
            localStorage.setItem('authToken', data.access_token);
            localStorage.setItem('refreshToken', data.refresh_token);
            setAuthToken(data.access_token);
            return true;
        } catch (error) {
            console.error("Error de login:", error);
            setError(error.message);
            return false;
        } finally {
            setLoading(false);
        }
    };

    // --- 3. EFECTOS SECUNDARIOS (useEffect) ---
    useEffect(() => {
        // Este efecto carga el perfil del usuario cuando el token cambia
        if (authToken) {
            fetchUserProfile(authToken);
        } else {
            setLoading(false);
        }
    }, [authToken, fetchUserProfile]);

    useEffect(() => {
        // Este efecto maneja la lógica de inactividad
        if (!authToken) return;

        const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
        
        const activityTracker = () => {
            // No reseteamos el timer si el modal ya está visible
            if (!showInactivityModal) {
                resetInactivityTimer();
            }
        };

        activityEvents.forEach(event => {
            window.addEventListener(event, activityTracker);
        });

        resetInactivityTimer(); // Inicia el temporizador la primera vez

        // Función de limpieza para quitar los listeners
        return () => {
            activityEvents.forEach(event => {
                window.removeEventListener(event, activityTracker);
            });
            clearTimeout(window.warningTimeout);
            clearTimeout(window.logoutTimeout);
        };
    }, [authToken, resetInactivityTimer, showInactivityModal]);


    const InactivityModal = () => (
        <Modal show={showInactivityModal} backdrop="static" centered>
            <Modal.Header><Modal.Title>¿Sigues ahí?</Modal.Title></Modal.Header>
            <Modal.Body>Tu sesión se cerrará pronto por inactividad. ¿Deseas continuar trabajando?</Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={logout}>Cerrar Sesión</Button>
                <Button variant="primary" onClick={handleContinueSession}>Seguir Conectado</Button>
            </Modal.Footer>
        </Modal>
    );

    return (
        <AuthContext.Provider value={{ user, authToken, loading, error, login, logout, refreshUser }}>
            {children}
            <InactivityModal />
        </AuthContext.Provider>
    );
};