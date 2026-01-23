import { API_BASE_URL, fetchWithAuth } from '../api';

const wfmService = {
  // --- 1. CONFIGURACIÓN (Dropdowns) ---

  getEquipos: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/wfm/equipos`, { method: 'GET' });
    if (!response.ok) throw new Error('Error al cargar equipos');
    return await response.json();
  },

  getClusters: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/wfm/clusters`, { method: 'GET' });
    if (!response.ok) throw new Error('Error al cargar clusters');
    return await response.json();
  },

  getConceptos: async () => {
    const response = await fetchWithAuth(`${API_BASE_URL}/wfm/conceptos`, { method: 'GET' });
    if (!response.ok) throw new Error('Error al cargar conceptos');
    return await response.json();
  },

  getAnalistas: async (equipoId = null) => {
    let url = `${API_BASE_URL}/wfm/analistas`;
    if (equipoId) url += `?equipo_id=${equipoId}`;
    const response = await fetchWithAuth(url, { method: 'GET' });
    if (!response.ok) throw new Error('Error al cargar analistas');
    return await response.json();
  },

  // --- 2. MALLA DE TURNOS ---

  getPlanificacion: async (fechaInicio, fechaFin, equipoId = null) => {
    const url = new URL(`${API_BASE_URL}/wfm/planificacion`);
    url.searchParams.append('fecha_inicio', fechaInicio);
    url.searchParams.append('fecha_fin', fechaFin);
    if (equipoId) url.searchParams.append('equipo_id', equipoId);

    const response = await fetchWithAuth(url.toString(), { method: 'GET' });
    if (!response.ok) throw new Error('Error al cargar planificación');
    return await response.json();
  },

  // --- 3. GUARDAR Y BORRAR ---

  saveTurno: async (turnoData) => {
    const response = await fetchWithAuth(`${API_BASE_URL}/wfm/planificacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(turnoData)
    });
    if (!response.ok) throw new Error('Error al guardar turno');
    return await response.json();
  },

  // 👇 ESTA ES LA FUNCIÓN QUE TE FALTA 👇
  deleteTurno: async (analistaId, fecha) => {
    const url = new URL(`${API_BASE_URL}/wfm/planificacion`);
    url.searchParams.append('analista_id', analistaId);
    url.searchParams.append('fecha', fecha);

    const response = await fetchWithAuth(url.toString(), { method: 'DELETE' });

    // Si es 204 o 200 está bien. Si es 404 lo ignoramos (ya estaba borrado)
    if (!response.ok && response.status !== 404) {
        throw new Error('Error al eliminar el turno');
    }
    return true;
  }
};

export default wfmService;