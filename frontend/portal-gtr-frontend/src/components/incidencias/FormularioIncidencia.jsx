// RUTA: src/components/incidencias/FormularioIncidencia.jsx

import React from 'react';
import { Form, Button, Row, Col, OverlayTrigger, Tooltip, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

// Este es un componente "tonto" que solo muestra el formulario.
// Recibe todos los datos y funciones de su componente padre.
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
    campanaIdFromQuery = null
}) {

    const renderTooltip = (text) => (
        <Tooltip id={`tooltip-${text.replace(/\s/g, '')}`}>{text}</Tooltip>
    );

    // No mostramos nada si se están cargando los datos iniciales
    if (loading && isEditing) return <div className="text-center"><Spinner /></div>;

    return (
        <>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="titulo">
                    <Form.Label>
                        Título
                        <OverlayTrigger placement="right" overlay={renderTooltip('Sé breve y descriptivo. Ej: "Caida de sistema de logueo"')}>
                            <span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span>
                        </OverlayTrigger>
                    </Form.Label>
                    <Form.Control type="text" name="titulo" value={formData.titulo} onChange={handleChange} required />
                </Form.Group>

                <Form.Group className="mb-3" controlId="descripcion_inicial">
                    <Form.Label>
                        Descripción Inicial
                        <OverlayTrigger placement="right" overlay={renderTooltip('registra el detalle de la incidencia lo mas preciso posible')}>
                            <span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span>
                        </OverlayTrigger>
                    </Form.Label>
                    <Form.Control as="textarea" rows={4} name="descripcion_inicial" value={formData.descripcion_inicial} onChange={handleChange} required />
                </Form.Group>

                <Row>
                    <Col md={6}><Form.Group className="mb-3" controlId="herramienta_afectada">
                        <Form.Label>
                            Herramienta Afectada
                        <OverlayTrigger placement="right" overlay={renderTooltip('Ej: Avaya, OneX, Siebel, cloud, etc.')}>
                            <span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span>
                        </OverlayTrigger>
                        </Form.Label><Form.Control type="text" name="herramienta_afectada" value={formData.herramienta_afectada} onChange={handleChange} /></Form.Group></Col>

                    <Col md={6}><Form.Group className="mb-3" controlId="indicador_afectado">
                        <Form.Label>
                            Indicador Afectado
                        <OverlayTrigger placement="right" overlay={renderTooltip('Ej: AHT, NPS, CSAT, AUS, AUX etc.')}>
                            <span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span>
                        </OverlayTrigger>
                        </Form.Label><Form.Control type="text" name="indicador_afectado" value={formData.indicador_afectado} onChange={handleChange} /></Form.Group></Col>
                </Row>
                <Row>
                    <Col md={4}><Form.Group className="mb-3" controlId="tipo">
                        <Form.Label>
                            Tipo
                        <OverlayTrigger placement="right" overlay={renderTooltip('**Técnica:** relacionada con sistemas o herramientas.// **Operativa:** contingencias informadas por la Operaciones que afecta a lo proyectado. EJ: capacitacion no planificada.// **Humana:** errores o acciones del personal severas como multiples cambios de turno o breaks que afecten el dia  - incidencias externas como corte de luz, problemas climaticos, etc. // **Otro:** no encaja en las anteriores.')}>
                            <span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span>
                        </OverlayTrigger>    
                            </Form.Label><Form.Select name="tipo" value={formData.tipo} onChange={handleChange}><option value="TECNICA">Técnica</option><option value="OPERATIVA">Operativa</option><option value="HUMANA">Humana</option><option value="OTRO">Otro</option></Form.Select></Form.Group></Col>
                    <Col md={4}><Form.Group className="mb-3" controlId="gravedad"><Form.Label>
                        Gravedad
                        <OverlayTrigger placement="right" overlay={renderTooltip('**Baja:** impacto mínimo, no afecta operaciones críticas.// **Media:** impacto moderado, puede afectar algunas operaciones pero con soluciones temporales.// **Alta:** impacto severo, afecta operaciones críticas y requiere atención inmediata.')}>
                            <span className="ms-2 text-primary" style={{ cursor: 'pointer' }}>ℹ️</span>
                        </OverlayTrigger>
                        </Form.Label><Form.Select name="gravedad" value={formData.gravedad} onChange={handleChange}><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option></Form.Select></Form.Group></Col>
                    <Col md={4}><Form.Group className="mb-3" controlId="campana_id"><Form.Label>Campaña</Form.Label><Form.Select name="campana_id" value={formData.campana_id} onChange={handleChange} required disabled={!!campanaIdFromQuery}><option value="">Seleccione una campaña</option>{campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Form.Select></Form.Group></Col>
                </Row>
                
                {isEditing && (
                     <Form.Group className="mb-3" controlId="asignado_a_id">
                        <Form.Label>Asignar a</Form.Label>
                        <Form.Select name="asignado_a_id" value={formData.asignado_a_id} onChange={handleChange}>
                            <option value="">Sin Asignar</option>
                            {analistas.map(a => <option key={a.id} value={a.id}>{`${a.nombre} ${a.apellido}`}</option>)}
                        </Form.Select>
                    </Form.Group>
                )}
                <div className="text-end">
                    {!isEditing && ( // Oculta el botón de cancelar si no es una página de edición
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