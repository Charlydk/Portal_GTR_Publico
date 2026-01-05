import { API_BASE_URL, fetchWithAuth } from '../api';

const wfmService = {
  // --- 1. CONFIGURACIÓN (Dropdowns) ---
  
  getEquipos: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/wfm/equipos`, {
      method: 'GET'
    });
    if (!response.ok) throw new Error('Error al cargar equipos');
    return await response.json();
  },

  getClusters: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/wfm/clusters`, {
      method: 'GET'
    });
    if (!response.ok) throw new Error('Error al cargar clusters');
    return await response.json();
  },

  getConceptos: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/wfm/conceptos`, {
      method: 'GET'
    });
    if (!response.ok) throw new Error('Error al cargar conceptos');
    return await response.json();
  },

  // --- 2. MALLA DE TURNOS ---

  getPlanificacion: async (fechaInicio, fechaFin, equipoId = null) => {
    // Construimos la URL con parámetros manualmente (estilo Fetch nativo)
    const url = new URL(`${API_BASE_URL}/wfm/planificacion`);
    url.searchParams.append('fecha_inicio', fechaInicio);
    url.searchParams.append('fecha_fin', fechaFin);
    
    if (equipoId) {
      url.searchParams.append('equipo_id', equipoId);
    }

    const response = await fetchWithAuth(url.toString(), {
      method: 'GET'
    });

    if (!response.ok) throw new Error('Error al cargar la planificación');
    return await response.json();
  },

  // --- 3. GUARDAR TURNO ---

  saveTurno: async (turnoData) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/wfm/planificacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(turnoData)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al guardar el turno');
    }
    return await response.json();
  }
};

export default wfmService;