// RUTA: src/components/incidencias/FormularioIncidencia.jsx

import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col, OverlayTrigger, Tooltip, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';

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
    campanaIdFromQuery = null,
    lobs = [],
    loadingLobs = false,
}) {

    // --- ESTADO LOCAL PARA MANEJAR LA SELECCIÓN ---
    const [selectedLobIds, setSelectedLobIds] = useState([]);

    // Sincroniza los LOBs si estamos en modo edición
    useEffect(() => {
        if (isEditing && formData.lobs && Array.isArray(formData.lobs)) {
            setSelectedLobIds(formData.lobs.map(lob => lob.id));
        }
    }, [formData.lobs, isEditing]);

    // --- MANEJADOR PARA LOS CHECKBOXES ---
    const handleLobChange = (lobId) => {
        setSelectedLobIds(prevIds =>
            prevIds.includes(lobId)
                ? prevIds.filter(id => id !== lobId)
                : [...prevIds, lobId]
        );
    };
    
    // --- MANEJADOR DEL SUBMIT QUE ENVÍA LOS DATOS CORRECTOS ---
    const handleLocalSubmit = (e) => {
        e.preventDefault();
        // Llamamos a la función del padre, pero añadiendo la lista de IDs de LOBs
        handleSubmit({ 
            ...formData, 
            lob_ids: selectedLobIds 
        });
    };

    const renderTooltip = (text) => (
        <Tooltip id={`tooltip-${text.replace(/\s/g, '')}`}>{text}</Tooltip>
    );

    if (loading && isEditing) return <div className="text-center"><Spinner /></div>;

    return (
        <>
            {error && <Alert variant="danger">{error}</Alert>}
            {/* Usamos nuestro "adaptador" en el onSubmit */}
            <Form onSubmit={handleLocalSubmit}>
                
                {/* ... (Título, Descripción, etc. no cambian) ... */}
                <Form.Group className="mb-3" controlId="titulo"><Form.Label>Título<OverlayTrigger placement="right" overlay={renderTooltip('Sé breve y descriptivo. Ej: "Caida de sistema de logueo"')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Control type="text" name="titulo" value={formData.titulo} onChange={handleChange} required /></Form.Group>
                <Form.Group className="mb-3" controlId="descripcion_inicial"><Form.Label>Descripción Inicial<OverlayTrigger placement="right" overlay={renderTooltip('registra el detalle de la incidencia lo mas preciso posible')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Control as="textarea" rows={4} name="descripcion_inicial" value={formData.descripcion_inicial} onChange={handleChange} required /></Form.Group>
                <Row><Col md={6}><Form.Group className="mb-3" controlId="herramienta_afectada"><Form.Label>Herramienta Afectada<OverlayTrigger placement="right" overlay={renderTooltip('Ej: Avaya, OneX, Siebel, cloud, etc.')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Control type="text" name="herramienta_afectada" value={formData.herramienta_afectada} onChange={handleChange} /></Form.Group></Col><Col md={6}><Form.Group className="mb-3" controlId="indicador_afectado"><Form.Label>Indicador Afectado<OverlayTrigger placement="right" overlay={renderTooltip('Ej: AHT, NPS, CSAT, AUS, AUX etc.')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Control type="text" name="indicador_afectado" value={formData.indicador_afectado} onChange={handleChange} /></Form.Group></Col></Row>
                <Row><Col md={4}><Form.Group className="mb-3" controlId="tipo"><Form.Label>Tipo<OverlayTrigger placement="right" overlay={renderTooltip('**Técnica:** relacionada con sistemas o herramientas.// **Operativa:** contingencias informadas por la Operaciones que afecta a lo proyectado. EJ: capacitacion no planificada.// **Humana:** errores o acciones del personal severas como multiples cambios de turno o breaks que afecten el dia  - incidencias externas como corte de luz, problemas climaticos, etc. // **Otro:** no encaja en las anteriores.')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Select name="tipo" value={formData.tipo} onChange={handleChange}><option value="TECNICA">Técnica</option><option value="OPERATIVA">Operativa</option><option value="HUMANA">Humana</option><option value="OTRO">Otro</option></Form.Select></Form.Group></Col><Col md={4}><Form.Group className="mb-3" controlId="gravedad"><Form.Label>Gravedad<OverlayTrigger placement="right" overlay={renderTooltip('**Baja:** impacto mínimo, no afecta operaciones críticas.// **Media:** impacto moderado, puede afectar algunas operaciones pero con soluciones temporales.// **Alta:** impacto severo, afecta operaciones críticas y requiere atención inmediata.')}><span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span></OverlayTrigger></Form.Label><Form.Select name="gravedad" value={formData.gravedad} onChange={handleChange}><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option></Form.Select></Form.Group></Col><Col md={4}><Form.Group className="mb-3" controlId="campana_id"><Form.Label>Campaña</Form.Label><Form.Select name="campana_id" value={formData.campana_id} onChange={handleChange} required disabled={!!campanaIdFromQuery}><option value="">Seleccione una campaña</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Form.Group></Col></Row>
                
                {/* --- BLOQUE PARA LOS CHECKBOXES DE LOBS (ahora con la lógica local) --- */}
                {formData.campana_id && (
                    <Form.Group className="mb-3" controlId="lobs">
                        <Form.Label>LOBs Afectados</Form.Label>
                        {loadingLobs ? <Spinner size="sm" /> : (
                            <div className="p-2 rounded" style={{ border: '1px solid #dee2e6', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                                {lobs.length > 0 ? lobs.map(lob => (
                                    <Form.Check
                                        type="checkbox"
                                        id={`lob-check-${lob.id}`}
                                        key={lob.id}
                                        label={lob.nombre}
                                        checked={selectedLobIds.includes(lob.id)}
                                        onChange={() => handleLobChange(lob.id)}
                                    />
                                )) : <p className="text-muted small mb-0">Esta campaña no tiene LOBs definidos.</p>}
                            </div>
                        )}
                    </Form.Group>
                )}
                {/* ------------------------------------------- */}

                {isEditing && (
                     <Form.Group className="mb-3" controlId="asignado_a_id">
                        <Form.Label>Asignar a</Form.Label>
                        <Form.Select name="asignado_a_id" value={formData.asignado_a_id || ''} onChange={handleChange}>
                            <option value="">Sin Asignar</option>
                            {analistas.map(a => <option key={a.id} value={a.id}>{`${a.nombre} ${a.apellido}`}</option>)}
                        </Form.Select>
                    </Form.Group>
                )}
                <div className="text-end">
                    {!isEditing && (
                         <Link to={isEditing ? `/incidencias/${formData.id}` : '/control-incidencias'} className="btn btn-secondary me-2">Cancelar</Link>
                    )}
                    <Button type="submit" variant="primary" disabled={isSubmitting}>
                        {isSubmitting ? <Spinner size="sm" /> : (isEditing ? 'Guardar Cambios' : 'Registrar Incidencia')}
                    </Button>
                </div>
            </Form>
        </>
    );
}

export default FormularioIncidencia;