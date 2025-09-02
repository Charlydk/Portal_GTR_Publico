// src/api.js
// Esta será la URL base de tu backend FastAPI
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001';

// Creamos una URL específica para el API del portal GTR con el prefijo
export const GTR_API_URL = `${API_BASE_URL}/gtr`;
