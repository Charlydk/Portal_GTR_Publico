import React, { useEffect } from 'react';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';

const HerramientasWFM = ({
  conceptos,
  conceptoSeleccionado, setConceptoSeleccionado,
  horaInicio, setHoraInicio,
  horaFin, setHoraFin,
  // CAMBIAMOS CAMPAÑAS POR CLUSTERS
  clusters,
  clusterSeleccionado, setClusterSeleccionado,
  modoBorrador, setModoBorrador
}) => {

const handleConceptoClick = (concepto) => {
    setModoBorrador(false); // Apagamos el borrador
    setConceptoSeleccionado(concepto);
    };

    const handleBorradorClick = () => {
    setModoBorrador(true);
    setConceptoSeleccionado(null); // Deseleccionamos conceptos
    };

  // Auto-llenado de horas (igual que antes)
  useEffect(() => {
    if (conceptoSeleccionado) {
        if (conceptoSeleccionado.codigo === 'T1') { setHoraInicio("08:00"); setHoraFin("18:00"); }
        else if (conceptoSeleccionado.codigo === 'T2') { setHoraInicio("12:00"); setHoraFin("22:00"); }
        else if (conceptoSeleccionado.codigo === 'OFF') { setHoraInicio(""); setHoraFin(""); }
    }
  }, [conceptoSeleccionado]);

  return (
    <Card className="mb-3 shadow-sm border-0 bg-light">
      <Card.Body className="py-2 d-flex align-items-center flex-wrap gap-3">

        {/* 1. BOTONES DE TURNO */}
        <div className="d-flex gap-1">
          <Button
            variant="outline-danger"
            size="sm"
            active={modoBorrador}
            onClick={handleBorradorClick}
            className={modoBorrador ? 'fw-bold border-2 shadow-sm' : ''}
            title="Borrar turno"
          >
            🗑️ Borrar
          </Button>
          <div className="vr mx-1"></div>

          {conceptos.map(concepto => (
            <Button
              key={concepto.id}
              variant={concepto.codigo === 'OFF' ? 'outline-secondary' : 'outline-success'}
              size="sm"
              active={!modoBorrador && conceptoSeleccionado?.id === concepto.id}
              onClick={() => handleConceptoClick(concepto)} // Usamos el nuevo handler
              className={!modoBorrador && conceptoSeleccionado?.id === concepto.id ? 'fw-bold border-2 shadow-sm' : ''}
            >
              {concepto.codigo}
            </Button>
          ))}
        </div>

        <div className="vr mx-2"></div>

        {/* 2. SELECTOR DE CLUSTER (El "Dónde" / "Color") */}
        <div style={{ minWidth: '200px' }}>
            <Form.Select
                size="sm"
                value={clusterSeleccionado}
                onChange={(e) => setClusterSeleccionado(e.target.value)}
                disabled={!conceptoSeleccionado || conceptoSeleccionado.codigo === 'OFF'}
                className="fw-bold"
                style={{
                    // Truco visual: Si hay selección, poner el borde del color del cluster si pudiéramos
                    borderColor: '#ced4da'
                }}
            >
                <option value="">-- Seleccionar Cobertura --</option>
                {clusters.map(c => (
                    <option key={c.id} value={c.id}>
                        {c.nombre}
                    </option>
                ))}
            </Form.Select>
        </div>

        <div className="vr mx-2"></div>

        {/* 3. HORARIOS */}
        <div className="d-flex align-items-center gap-2">
            <InputGroup size="sm" style={{ width: '130px' }}>
                <Form.Control type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </InputGroup>
            <span className="text-muted">-</span>
            <InputGroup size="sm" style={{ width: '130px' }}>
                <Form.Control type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </InputGroup>
        </div>


      </Card.Body>
    </Card>
  );
};

export default HerramientasWFM;