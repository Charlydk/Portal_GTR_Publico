// RUTA: src/components/incidencias/FormularioIncidencia.jsx

import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, OverlayTrigger, Tooltip, Spinner, Alert, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const toLocalISOString = (dateString) => {
    if (!dateString) return '';
    // Añadimos la 'Z' para asegurar que se interprete como UTC
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

function FormularioIncidencia({
    formData,
    handleChange,
    handleSubmit,
    isEditing = false,
    isSubmitting = false,
    loading = false,
    campanas = [],
    analistas = [],
    error = null,
    selectedLobs = [],
    lobs = [],
    loadingLobs = false,
    hideCampanaSelector = false,
}) {
    const navigate = useNavigate();
    const [selectedLobIds, setSelectedLobIds] = useState([]);
    const [usarAhora, setUsarAhora] = useState(true);
    const [fechaManual, setFechaManual] = useState('');

    useEffect(() => {
        // Este efecto SÓLO se preocupa de rellenar el formulario en modo EDICIÓN.
        if (isEditing) {
            // Sincroniza los LOBs seleccionados
            if (Array.isArray(selectedLobs)) {
                setSelectedLobIds(selectedLobs.map(lob => lob.id));
            }
            
            // Sincroniza la fecha de apertura
            if (formData.fecha_apertura) {
                setUsarAhora(false);
                setFechaManual(toLocalISOString(formData.fecha_apertura));
            }
        }
    }, [selectedLobs, formData.fecha_apertura, isEditing]);

    const handleLobChange = (lobId) => {
        setSelectedLobIds(prevIds =>
            prevIds.includes(lobId) ? prevIds.filter(id => id !== lobId) : [...prevIds, lobId]
        );
    };
    
    const handleLocalSubmit = (e) => {
        e.preventDefault();
        let payload = { ...formData, lob_ids: selectedLobIds };

        if (!usarAhora) {
            if (!fechaManual) {
                alert("Por favor, seleccione una fecha y hora de apertura.");
                return;
            }
            payload.fecha_apertura = new Date(fechaManual).toISOString();
        } else {
            if (isEditing) {
                payload.fecha_apertura = new Date().toISOString();
            } else {
                delete payload.fecha_apertura;
            }
        }
        
        handleSubmit(payload);
    };

    const renderTooltip = (text) => ( <Tooltip id={text.replace(/\s/g, '')}>{text}</Tooltip> );

    if (loading && isEditing) return <div className="text-center"><Spinner /></div>;

    return (
        <>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleLocalSubmit}>
                <Form.Group className="mb-3" controlId="titulo"><Form.Label>Título<OverlayTrigger placement="right" overlay={renderTooltip('Sé breve y descriptivo. Ej: "Caida de sistema de logueo"')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Control type="text" name="titulo" value={formData.titulo} onChange={handleChange} required /></Form.Group>
                <Form.Group className="mb-3" controlId="descripcion_inicial"><Form.Label>Descripción Inicial<OverlayTrigger placement="right" overlay={renderTooltip('Registra el detalle de la incidencia lo más preciso posible')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Control as="textarea" rows={4} name="descripcion_inicial" value={formData.descripcion_inicial} onChange={handleChange} required /></Form.Group>
                <Row><Col md={6}><Form.Group className="mb-3" controlId="herramienta_afectada"><Form.Label>Herramienta Afectada<OverlayTrigger placement="right" overlay={renderTooltip('Ej: Avaya, OneX, Siebel, cloud, etc.')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Control type="text" name="herramienta_afectada" value={formData.herramienta_afectada} onChange={handleChange} /></Form.Group></Col><Col md={6}><Form.Group className="mb-3" controlId="indicador_afectado"><Form.Label>Indicador Afectado<OverlayTrigger placement="right" overlay={renderTooltip('Ej: AHT, NPS, CSAT, AUS, AUX etc.')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Control type="text" name="indicador_afectado" value={formData.indicador_afectado} onChange={handleChange} /></Form.Group></Col></Row>
                <Row>
                    <Col md={4}><Form.Group className="mb-3" controlId="tipo"><Form.Label>Tipo<OverlayTrigger placement="right" overlay={renderTooltip('**Técnica:** relacionada con sistemas o herramientas. **Operativa:** contingencias informadas por Operaciones que afectan lo proyectado. **Humana:** errores o acciones del personal, incidencias externas como cortes de luz, etc. **Otro:** no encaja en las anteriores.')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Select name="tipo" value={formData.tipo} onChange={handleChange}><option value="TECNICA">Técnica</option><option value="OPERATIVA">Operativa</option><option value="HUMANA">Humana</option><option value="OTRO">Otro</option></Form.Select></Form.Group></Col>
                    <Col md={4}><Form.Group className="mb-3" controlId="gravedad"><Form.Label>Gravedad<OverlayTrigger placement="right" overlay={renderTooltip('**Baja:** impacto mínimo. **Media:** impacto moderado. **Alta:** impacto severo, requiere atención inmediata.')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Select name="gravedad" value={formData.gravedad} onChange={handleChange}><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option></Form.Select></Form.Group></Col>
                    {!hideCampanaSelector && (<Col md={4}><Form.Group className="mb-3" controlId="campana_id"><Form.Label>Campaña</Form.Label><Form.Select name="campana_id" value={formData.campana_id} onChange={handleChange} required><option value="">Seleccione una campaña</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Form.Group></Col>)}
                </Row>
                
                {formData.campana_id && (
                    <Form.Group className="mb-3" controlId="lobs">
                        <Form.Label>LOBs Afectados</Form.Label>
                        {loadingLobs ? <Spinner size="sm" /> : (
                            <div className="p-2 rounded" style={{ border: '1px solid #dee2e6', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                                {lobs.length > 0 ? lobs.map(lob => (
                                    <Form.Check type="checkbox" id={`lob-check-${lob.id}`} key={lob.id} label={lob.nombre} checked={selectedLobIds.includes(lob.id)} onChange={() => handleLobChange(lob.id)} />
                                )) : <p className="text-muted small mb-0">Esta campaña no tiene LOBs definidos.</p>}
                            </div>
                        )}
                    </Form.Group>
                )}

                {isEditing && ( <Form.Group className="mb-3" controlId="asignado_a_id"><Form.Label>Asignar a</Form.Label><Form.Select name="asignado_a_id" value={formData.asignado_a_id || ''} onChange={handleChange}><option value="">Sin Asignar</option>{analistas.map(a => <option key={a.id} value={a.id}>{`${a.nombre} ${a.apellido}`}</option>)}</Form.Select></Form.Group> )}

                <Card className="p-3 mb-3 bg-light border">
                    <Form.Group controlId="fecha_apertura_group">
                        <Form.Label>Fecha de Apertura</Form.Label>
                        <Form.Check type="checkbox" id="usarAhora" label="Usar fecha y hora actual para la apertura" checked={usarAhora} onChange={(e) => setUsarAhora(e.target.checked)} />
                        {!usarAhora && (
                            <Form.Control type="datetime-local" value={fechaManual} onChange={(e) => setFechaManual(e.target.value)} className="mt-2" required />
                        )}
                    </Form.Group>
                </Card>

                <div className="text-end">
                    <Button variant="secondary" onClick={() => navigate(-1)} className="me-2" disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSubmitting}>
                        {isSubmitting ? <Spinner size="sm" /> : (isEditing ? 'Guardar Cambios' : 'Registrar Incidencia')}
                    </Button>
                </div>
            </Form>
        </>
    );
}

export default FormularioIncidencia;