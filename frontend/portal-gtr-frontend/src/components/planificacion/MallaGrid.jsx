import React from 'react';
import { Table, Badge } from 'react-bootstrap';

const MallaGrid = ({ analistas, turnos, rangoFechas, conceptos }) => {
  
  // Función auxiliar para encontrar el turno de una persona en una fecha
  const getTurno = (analistaId, fechaStr) => {
    return turnos.find(t => 
      t.analista_id === analistaId && 
      t.fecha === fechaStr
    );
  };

  // Función para obtener el color del badge según el concepto
  const getColorBadge = (codigo) => {
    if (codigo === 'OFF') return 'secondary';
    if (codigo === 'VAC') return 'info';
    if (codigo === 'LIC') return 'danger';
    return 'success'; // Turnos normales (T1, T2...)
  };

  return (
    <div className="table-responsive shadow-sm border rounded bg-white">
      <Table bordered hover size="sm" className="mb-0 text-center align-middle">
        <thead className="bg-light">
          <tr>
            <th className="text-start p-3" style={{ minWidth: '200px', position: 'sticky', left: 0, background: '#f8f9fa', zIndex: 10 }}>
              Analista
            </th>
            {rangoFechas.map(dia => (
              <th key={dia.fechaIso} style={{ minWidth: '60px' }}>
                <div className="small text-muted">{dia.nombreDia}</div>
                <div>{dia.numeroDia}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {analistas.map(analista => (
            <tr key={analista.id}>
              {/* Columna Fija: Nombre del Analista */}
              <td className="text-start fw-bold text-secondary" style={{ position: 'sticky', left: 0, background: 'white', zIndex: 5 }}>
                {analista.apellido}, {analista.nombre}
              </td>

              {/* Columnas Dinámicas: Días */}
              {rangoFechas.map(dia => {
                const turno = getTurno(analista.id, dia.fechaIso);
                return (
                  <td key={`${analista.id}-${dia.fechaIso}`} className="p-1" style={{ cursor: 'pointer' }}>
                    {turno ? (
                      <Badge bg={getColorBadge(turno.concepto?.codigo)}>
                        {turno.concepto?.codigo}
                      </Badge>
                    ) : (
                      <span className="text-muted small">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          
          {analistas.length === 0 && (
            <tr>
              <td colSpan={rangoFechas.length + 1} className="p-4 text-muted">
                No hay analistas seleccionados para este equipo.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default MallaGrid;