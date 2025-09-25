// RUTA: src/api.js

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

// El resto de tu archivo no cambia
export const GTR_API_URL = `${API_BASE_URL}/gtr`;
export const HHEE_API_URL = `${API_BASE_URL}/hhee`;

// --- NUESTRA NUEVA FUNCIÓN "INTELIGENTE" ---
export const fetchWithAuth = async (url, options = {}) => {
    // 1. Obtenemos el token de acceso actual
    let token = localStorage.getItem('authToken');

    // 2. Preparamos los encabezados (headers)
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
    };

    // 3. Hacemos la petición inicial
    let response = await fetch(url, { ...options, headers });

    // 4. Si la respuesta es 401 (No Autorizado), el token expiró. ¡Intentamos refrescarlo!
    if (response.status === 401) {
        console.log("Token de acceso expirado. Intentando refrescar...");
        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
            // Si no hay refresh token, no podemos hacer nada. Forzamos el logout.
            window.dispatchEvent(new Event('logout')); 
            throw new Error('Sesión expirada.');
        }

        try {
            // 5. Hacemos la llamada al endpoint /refresh
            const refreshResponse = await fetch(`${API_BASE_URL}/refresh`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${refreshToken}` },
            });

            if (!refreshResponse.ok) {
                // Si el refresh token también falla, forzamos el logout
                throw new Error('No se pudo refrescar la sesión.');
            }
            
            const newTokens = await refreshResponse.json();
            
            // 6. Guardamos los nuevos tokens
            localStorage.setItem('authToken', newTokens.access_token);
            localStorage.setItem('refreshToken', newTokens.refresh_token);

            // 7. Reintentamos la petición original con el nuevo token
            console.log("Token refrescado. Reintentando la petición original...");
            const newHeaders = { ...options.headers, 'Authorization': `Bearer ${newTokens.access_token}` };
            response = await fetch(url, { ...options, headers: newHeaders });

        } catch (refreshError) {
            console.error("Error al refrescar el token:", refreshError);
            window.dispatchEvent(new Event('logout')); // Forzamos logout si el refresco falla
            throw refreshError;
        }
    }

    return response;
};