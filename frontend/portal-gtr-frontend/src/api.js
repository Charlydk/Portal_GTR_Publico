// RUTA: src/api.js

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";
export const GTR_API_URL = `${API_BASE_URL}/gtr`;
export const HHEE_API_URL = `${API_BASE_URL}/hhee`;

/**
 * Función auxiliar que intenta refrescar los tokens usando el refreshToken.
 * Si tiene éxito, devuelve el nuevo access_token.
 * Si falla, limpia el almacenamiento y devuelve null.
 */
const tryRefreshToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
        console.log("No hay refresh token disponible. Forzando logout.");
        window.dispatchEvent(new Event('logout'));
        return null;
    }

    try {
        const refreshResponse = await fetch(`${API_BASE_URL}/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${refreshToken}` },
        });

        if (!refreshResponse.ok) {
            throw new Error('El refresh token falló o ha expirado.');
        }
        
        const newTokens = await refreshResponse.json();
        
        localStorage.setItem('authToken', newTokens.access_token);
        localStorage.setItem('refreshToken', newTokens.refresh_token);
        console.log("Token refrescado exitosamente.");
        
        return newTokens.access_token; // Devuelve el nuevo token de acceso

    } catch (error) {
        console.error("Fallo al refrescar el token:", error);
        window.dispatchEvent(new Event('logout')); // Dispara el evento global de logout
        return null;
    }
};

/**
 * Realiza una llamada fetch autenticada, manejando la expiración y refresco de tokens.
 */
export const fetchWithAuth = async (url, options = {}) => {
    let token = localStorage.getItem('authToken');

    // CASO 1: No hay token de acceso. Intentamos refrescar la sesión inmediatamente.
    if (!token) {
        console.log("No se encontró access token. Intentando refrescar...");
        token = await tryRefreshToken();
        // Si el refresco falla (devuelve null), lanzamos un error para detener la operación.
        if (!token) throw new Error('Sesión no válida. Por favor, inicie sesión.');
    }

    // Preparamos los encabezados y realizamos la petición original.
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    let response = await fetch(url, { ...options, headers });

    // CASO 2: El token de acceso existía pero expiró (la API devuelve 401).
    if (response.status === 401) {
        console.log("Access token expirado. Intentando refrescar...");
        token = await tryRefreshToken();
        // Si el refresco falla, lanzamos un error.
        if (!token) throw new Error('La sesión ha expirado. Por favor, inicie sesión.');

        // Reintentamos la petición original con el nuevo token.
        const newHeaders = { ...options.headers, 'Authorization': `Bearer ${token}` };
        response = await fetch(url, { ...options, headers: newHeaders });
    }

    return response;
};