import React, { useState, useEffect } from 'react';
import wfmService from '../../services/wfmService.js';

const Planificacion = () => {
  const [conceptos, setConceptos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        // Hacemos las peticiones en paralelo
        const [conceptosData, equiposData] = await Promise.all([
          wfmService.getConceptos(),
          wfmService.getEquipos()
        ]);

        setConceptos(conceptosData);
        setEquipos(equiposData);
        setLoading(false);
      } catch (error) {
        console.error("Error cargando WFM:", error);
        setLoading(false);
      }
    };

    cargarConfiguracion();
  }, []);

  if (loading) return <div className="p-4">Cargando Malla de Turnos...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Planificación de Turnos (WFM)</h1>
      
      {/* TARJETA DE PRUEBA DE CONEXIÓN */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-green-600 mb-2">✅ Conexión Exitosa con Backend Fase 2</h2>
        <p className="text-gray-600 mb-4">Si ves las listas abajo, el frontend ya está leyendo la nueva base de datos.</p>

        <div className="grid grid-cols-2 gap-8">
          {/* LISTA DE EQUIPOS */}
          <div>
            <h3 className="font-bold text-gray-700 border-b pb-2 mb-2">Equipos Disponibles</h3>
            <ul className="list-disc pl-5">
              {equipos.map(eq => (
                <li key={eq.id} className="text-sm text-gray-600">
                  {eq.nombre} <span className="text-xs bg-gray-200 px-1 rounded">({eq.codigo_pais})</span>
                </li>
              ))}
            </ul>
          </div>

          {/* LISTA DE CONCEPTOS */}
          <div>
            <h3 className="font-bold text-gray-700 border-b pb-2 mb-2">Conceptos (Turnos/Off)</h3>
            <ul className="grid grid-cols-2 gap-2">
              {conceptos.map(c => (
                <li key={c.id} className="text-sm border p-2 rounded text-center">
                  <strong>{c.codigo}</strong>
                  <div className="text-xs text-gray-500">{c.nombre}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Planificacion;