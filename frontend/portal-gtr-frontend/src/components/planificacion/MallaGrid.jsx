import React from 'react';
import { Table, Badge } from 'react-bootstrap';

// 1. Agregamos onCeldaClick a las props
const MallaGrid = ({ analistas, turnos, rangoFechas, onCeldaClick }) => {

  const getTurno = (analistaId, fechaStr) => {
    return turnos.find(t => t.analista_id === analistaId && t.fecha === fechaStr);
  };

  const getColorBadge = (codigo) => {
    if (codigo === 'OFF') return 'secondary';
    if (codigo === 'VAC') return 'info';
    if (codigo === 'LIC') return 'danger';
    return 'success';
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
              <td className="text-start fw-bold text-secondary" style={{ position: 'sticky', left: 0, background: 'white', zIndex: 5 }}>
                {analista.apellido}, {analista.nombre}
              </td>

              {analistas.length > 0 && rangoFechas.map(dia => {
                const turno = getTurno(analista.id, dia.fechaIso);
                const clusterColor = turno?.cluster?.color_hex || '#dee2e6';
                return (
                <td
                    key={`${analista.id}-${dia.fechaIso}`}
                    className="p-1 text-center align-middle"
                    style={{
                        cursor: 'pointer',
                        height: '50px',
                        // PINTAMOS EL BORDE IZQUIERDO DEL COLOR DEL CLUSTER
                        borderLeft: turno?.cluster ? `4px solid ${clusterColor}` : '',
                        backgroundColor: turno?.cluster ? `${clusterColor}15` : '' // Un fondo muy suave del mismo color (opcional)
                    }}
                    onClick={() => onCeldaClick(analista.id, dia.fechaIso, turno)}
                >
                    {turno ? (
                    <div className="d-flex flex-column align-items-center lh-1">
                        <Badge bg={getColorBadge(turno.concepto?.codigo)} className="mb-1">
                        {turno.concepto?.codigo}
                        </Badge>

                        {turno.concepto?.es_laborable && turno.hora_inicio && (
                        <span style={{ fontSize: '0.65rem', color: '#555' }}>
                            {turno.hora_inicio.slice(0, 5)} - {turno.hora_fin.slice(0, 5)}
                        </span>
                        )}
                    </div>
                    ) : (
                    <span className="text-light text-opacity-25 user-select-none">·</span>
                    )}
                </td>
                );
              })}
            </tr>
          ))}
          {analistas.length === 0 && (
             <tr><td colSpan={rangoFechas.length + 1} className="p-4 text-muted">No hay analistas.</td></tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default MallaGrid;