import React, { useEffect } from 'react';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';

const HerramientasWFM = ({ 
  conceptos, 
  conceptoSeleccionado, 
  setConceptoSeleccionado,
  horaInicio, setHoraInicio, // Nuevas props
  horaFin, setHoraFin        // Nuevas props
}) => {
  
  // Cuando seleccionas un concepto (ej: T1), autocompletamos las horas
  // Pero dejamos que el usuario las edite si quiere
  useEffect(() => {
    if (conceptoSeleccionado) {
        // Asumimos que el backend podría mandar horarios por defecto en el futuro
        // Por ahora, simulamos horarios base según el código, o lo dejamos vacío
        if (conceptoSeleccionado.codigo === 'T1') {
            setHoraInicio("08:00");
            setHoraFin("18:00");
        } else if (conceptoSeleccionado.codigo === 'T2') {
            setHoraInicio("12:00");
            setHoraFin("22:00");
        } else if (conceptoSeleccionado.codigo === 'OFF') {
            setHoraInicio("");
            setHoraFin("");
        }
    }
  }, [conceptoSeleccionado]);

  const getVariant = (codigo) => {
    if (codigo === 'OFF') return 'outline-secondary';
    if (codigo === 'VAC') return 'outline-info';
    if (codigo === 'LIC') return 'outline-danger';
    return 'outline-success';
  };

  return (
    <Card className="mb-3 shadow-sm border-0 bg-light">
      <Card.Body className="py-2 d-flex align-items-center flex-wrap gap-3">
        
        {/* 1. SELECCIÓN DE TIPO DE TURNO */}
        <div className="d-flex gap-1">
          {conceptos.map(concepto => (
            <Button
              key={concepto.id}
              variant={getVariant(concepto.codigo)}
              size="sm"
              active={conceptoSeleccionado?.id === concepto.id}
              onClick={() => setConceptoSeleccionado(concepto)}
              className={conceptoSeleccionado?.id === concepto.id ? 'fw-bold border-2 shadow-sm' : ''}
            >
              {concepto.codigo}
            </Button>
          ))}
        </div>

        <div className="vr mx-2"></div>

        {/* 2. PERSONALIZACIÓN DE HORARIO (CRÍTICO PARA TU CASO) */}
        <div className="d-flex align-items-center gap-2">
            <InputGroup size="sm">
                <InputGroup.Text>Inicio</InputGroup.Text>
                <Form.Control 
                    type="time" 
                    value={horaInicio} 
                    onChange={(e) => setHoraInicio(e.target.value)}
                    disabled={!conceptoSeleccionado || conceptoSeleccionado.codigo === 'OFF'}
                />
            </InputGroup>
            
            <span className="text-muted">-</span>

            <InputGroup size="sm">
                <InputGroup.Text>Fin</InputGroup.Text>
                <Form.Control 
                    type="time" 
                    value={horaFin} 
                    onChange={(e) => setHoraFin(e.target.value)}
                    disabled={!conceptoSeleccionado || conceptoSeleccionado.codigo === 'OFF'}
                />
            </InputGroup>
        </div>

        <div className="ms-auto small text-primary fw-bold">
          {conceptoSeleccionado && horaInicio && horaFin 
            ? `Asignando: ${horaInicio} - ${horaFin}` 
            : 'Selecciona concepto y hora'}
        </div>
      </Card.Body>
    </Card>
  );
};

export default HerramientasWFM;