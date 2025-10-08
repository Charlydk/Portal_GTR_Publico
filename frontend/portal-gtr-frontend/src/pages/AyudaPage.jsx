// RUTA: src/pages/AyudaPage.jsx

import React from 'react';
import { Container, Card, Image, Accordion, ListGroup, Table, Badge } from 'react-bootstrap';

// Importamos las imágenes con los nombres correctos
import img_dashboard from '../assets/ayuda/img_dashboard.png';
import img_seleccionar_campana from '../assets/ayuda/img_seleccionar_campana.png';
import img_tabs_eventos_incidencias from '../assets/ayuda/img_tabs_eventos_incidencias.png';
import img_formulario_eventos from '../assets/ayuda/img_formulario_eventos.png';
import img_log_de_hoy from '../assets/ayuda/img_log_de_hoy.png';
import img_error_evento_duplicado from '../assets/ayuda/img_error_evento_duplicado.png';
import img_editar_evento from '../assets/ayuda/img_editar_evento.png';
import img_menu_control_eventos from '../assets/ayuda/img_menu_control_eventos.png';
import img_portal_control_eventos from '../assets/ayuda/img_portal_control_eventos.png';
import img_portal_control_eventos_filtrado from '../assets/ayuda/img_portal_control_eventos_filtrado.png';
import img_exportar_a_excel from '../assets/ayuda/img_exportar_a_excel.png';
import img_archivo_excel from '../assets/ayuda/img_archivo_excel.png';
import img_formulario_incidencia from '../assets/ayuda/img_formulario_incidencia.png';
import img_widgets_incidencias from '../assets/ayuda/img_widgets_incidencias.png';
import img_incidencias_sin_asignar from '../assets/ayuda/img_incidencias_sin_asignar.png';
import img_incidencias_activas from '../assets/ayuda/img_incidencias_activas.png';
import img_mis_incidencias from '../assets/ayuda/img_mis_incidencias.png';
import img_menu_control_incidencias from '../assets/ayuda/img_menu_control_incidencias.png';
import img_portal_incidencias from '../assets/ayuda/img_portal_incidencias.png';
import img_modal_detalle_incidencia from '../assets/ayuda/img_modal_detalle_incidencia.png';
import img_pagina_detalle_incidencia from '../assets/ayuda/img_pagina_detalle_incidencia.png';
import img_detalle_seccion_incidencia from '../assets/ayuda/img_detalle_seccion_incidencia.png';
import img_historial_actualizaciones from '../assets/ayuda/img_historial_actualizaciones.png';
import img_icono_cambio_estado from '../assets/ayuda/img_icono_cambio_estado.png';
import img_icono_cierre_comentario from '../assets/ayuda/img_icono_cierre_comentario.png';
import img_icono_reasignacion from '../assets/ayuda/img_icono_reasignacion.png';
import img_icono_comentario from '../assets/ayuda/img_icono_comentario.png';
import img_estado_en_progreso from '../assets/ayuda/img_estado_en_progreso.png';
import img_estado_abierta from '../assets/ayuda/img_estado_abierta.png';
import img_estado_cerrada from '../assets/ayuda/img_estado_cerrada.png';
import img_gestion_botones_asignado from '../assets/ayuda/img_gestion_botones_asignado.png';
import img_gestion_botones_sin_asignar from '../assets/ayuda/img_gestion_botones_sin_asignar.png';
import img_gestion_botones_cerrada from '../assets/ayuda/img_gestion_botones_cerrada.png';
import img_boton_modificar from '../assets/ayuda/img_boton_modificar.png';
import img_boton_cerrar from '../assets/ayuda/img_boton_cerrar.png';
import img_boton_liberar from '../assets/ayuda/img_boton_liberar.png';
import img_boton_asignar from '../assets/ayuda/img_boton_asignar.png';
import img_boton_reabrir from '../assets/ayuda/img_boton_reabrir.png';
import img_modal_cierre_incidencia from '../assets/ayuda/img_modal_cierre_incidencia.png';

const SectionImage = ({ src, alt = "Imagen de la guía" }) => (
    <Image src={src} alt={alt} fluid rounded className="my-4 shadow-sm border" />
);

function AyudaPage() {
    return (
        <Container className="py-5">
            <h1 className="text-center mb-4">Guía de Usuario: Bitácora y Centro de Comando GTR</h1>
            <p className="text-center text-muted mb-5">
                Este es el instructivo oficial para el uso del portal de registro de eventos y gestión de incidencias.
            </p>
             <SectionImage src={img_dashboard} />

            <Accordion defaultActiveKey="0" alwaysOpen>
                <Accordion.Item eventKey="0">
                    <Accordion.Header>Flujo de Trabajo: Eventos</Accordion.Header>
                    <Accordion.Body>
                        <Card.Title as="h4">Definición y Objetivo</Card.Title>
                        <blockquote className="blockquote">
                            <p>Definimos <strong>Eventos</strong> como un suceso significativo que provocó algún cambio (positivo o negativo) en las franjas de un LOB de una campaña.</p>
                            <footer className="blockquote-footer">El objetivo es dejar un registro para justificar métricas y para que otras áreas puedan llevar sus controles.</footer>
                        </blockquote>
                        <hr/>

                        <Card.Title as="h4" className="mt-4">Carga de un Evento</Card.Title>
                        <p><strong>1. Selecciona la Campaña:</strong> Desde el widget "Registro Rápido", elige la campaña.</p>
                        <SectionImage src={img_seleccionar_campana} />
                        <p><strong>2. Ve a la solapa "Eventos":</strong> Asegúrate de estar en la solapa correcta.</p>
                        <SectionImage src={img_tabs_eventos_incidencias} />
                        <p><strong>3. Completa el formulario:</strong></p>
                        <ul>
                            <li><strong>Horario:</strong> Es la franja de 30 minutos afectada.</li>
                            <li><strong>LOB (Opcional):</strong> La línea de negocio afectada.</li>
                            <li><strong>Comentario:</strong> Describe el evento de forma clara.</li>
                        </ul>
                        <SectionImage src={img_formulario_eventos} />
                        <p><strong>4. Registra:</strong> Al presionar "Registrar", la entrada aparecerá en el "Log de Hoy". No puedes registrar dos eventos en la misma franja para el mismo LOB.</p>
                        <SectionImage src={img_log_de_hoy} />
                        <p> No puedes registrar dos eventos en la misma franja para el mismo LOB.</p>

                        <SectionImage src={img_error_evento_duplicado} />
                        <hr/>

                        <Card.Title as="h4" className="mt-4">Edición y Control de Eventos</Card.Title>
                        <p>Puedes editar un evento para corregirlo o añadir información usando el botón "Editar".</p>
                        <SectionImage src={img_editar_evento} />
                        <p className="fw-bold">No se puede eliminar la entrada: en caso de error, el sistema no permite eliminar, por lo cual se podrá editar y pueden dejar el mensaje "sin eventos" en el comentario.</p>
                        <p>Para ver un historial completo, ve a <strong>Gestión GTR {'>'} Control de Eventos</strong>. Desde allí podrás filtrar por fechas, campañas, autor y exportar los resultados a Excel.</p>
                        <SectionImage src={img_menu_control_eventos} />
                        <SectionImage src={img_portal_control_eventos_filtrado} />
                        <p>Alli se muestra el historial de eventos, con los componentes de la tabla. Se puede exportar usando el botón Exportar a Excel, creara un archivo Excel para guardar en el pc</p>
                        <SectionImage src={img_archivo_excel} />
                    </Accordion.Body>
                </Accordion.Item>

                <Accordion.Item eventKey="1">
                    <Accordion.Header>Flujo de Trabajo: Incidencias</Accordion.Header>
                    <Accordion.Body>
                        <Card.Title as="h4">Definición y Objetivo</Card.Title>
                         <blockquote className="blockquote">
                            <p>Definimos <strong>Incidencias</strong> como sucesos que afectan de manera directa a la operación.</p>
                            <footer className="blockquote-footer">El objetivo es tener un registro organizado y parametrizado para que la búsqueda sea ágil y útil para distintas áreas.</footer>
                        </blockquote>
                        <hr/>
                        
                        <Card.Title as="h4" className="mt-4">Carga de una Incidencia</Card.Title>
                        <p>Selecciona la solapa "Incidencia" y completa su formulario:</p>
                        <SectionImage src={img_formulario_incidencia} />
                        <ListGroup variant="flush" className="mb-3">
                            <ListGroup.Item><strong>Título:</strong> Sé breve y descriptivo (ej: "Caída de sistema de logueo").</ListGroup.Item>
                            <ListGroup.Item><strong>Descripción Inicial:</strong> Detalla la incidencia con la mayor precisión posible.</ListGroup.Item>
                            <ListGroup.Item><strong>Herramienta/Indicador Afectado:</strong> Especifica los sistemas (Siebel, Avaya) o KPIs (AHT, SL) impactados.</ListGroup.Item>
                            <ListGroup.Item><strong>Tipo:</strong> Técnica, Operativa, Humana u Otro.</ListGroup.Item>
                            <ListGroup.Item><strong>Gravedad:</strong> Clasifica el impacto de la incidencia (Baja, Media, Alta).</ListGroup.Item>
                            <ListGroup.Item><strong>LOBs Afectados:</strong> Selecciona las líneas de negocio impactadas.</ListGroup.Item>
                            <ListGroup.Item><strong>Fecha de Apertura:</strong> Por defecto es la actual, pero puedes registrar una hora anterior.</ListGroup.Item>
                        </ListGroup>
                        <hr/>

                        <Card.Title as="h4" className="mt-4">Widgets del Dashboard</Card.Title>
                        <SectionImage src={img_widgets_incidencias} />
                        <p>Los widgets del dashboard son clickeables y te llevan a vistas pre-filtradas:</p>
                        <ListGroup variant="flush" className="mb-3">
                            <ListGroup.Item><Image src={img_incidencias_activas} style={{height: '40px'}} className="me-2"/> Muestra el total de incidencias en estado "Abierta" o "En Progreso".</ListGroup.Item>
                            <ListGroup.Item><Image src={img_incidencias_sin_asignar} style={{height: '40px'}} className="me-2"/> Muestra las incidencias abiertas que no tienen responsable.</ListGroup.Item>
                        </ListGroup>
                        <p>Al registrar una incidencia, se te asignará automáticamente y aparecerá en "Mis Incidencias Asignadas".</p>
                         <SectionImage src={img_mis_incidencias} />
                         <hr/>

                        <Card.Title as="h4" className="mt-4">Control y Gestión de Incidencias</Card.Title>
                        <p>Puedes ver un historial completo en <strong>Gestión GTR {'>'} Control Incidencias</strong>.</p>
                        <SectionImage src={img_menu_control_incidencias} />
                        <p>al presionar el boton filtrar se muestran las incidencias segun los filtros elegidos, </p>
                        <SectionImage src={img_portal_incidencias} />
                        <p>Al hacer clic en "Ver Detalle", se abrirá un modal. Desde allí, <strong>"Ver / Gestionar Detalles"</strong> te llevará a la página completa de la incidencia en una nueva pestaña.</p>
                        <SectionImage src={img_modal_detalle_incidencia} />
                        <p>En la página de detalles completos podrás añadir actualizaciones, cambiar el estado y gestionar la incidencia.</p>
                        <SectionImage src={img_pagina_detalle_incidencia} />
                        <p>La página de detalles tiene 3 secciones:</p>
                        <ListGroup variant="flush" className="mb-3">
                            <ListGroup.Item><strong>1. Detalles de la Incidencia:</strong> Muestra los datos cargados en la apertura.</ListGroup.Item>
                            <ListGroup.Item><strong>2. Historial de Actualizaciones:</strong> Registra todos los cambios y comentarios.</ListGroup.Item>
                            <ListGroup.Item><strong>3. Gestionar Incidencia:</strong> Contiene los botones para las diferentes acciones.</ListGroup.Item>
                        </ListGroup>
                        
                        <Card.Title as="h5" className="mt-3">Iconos del Historial</Card.Title>
                        <Table bordered size="sm" className="text-center align-middle">
                            <tbody>
                                <tr><td><Image src={img_icono_cambio_estado} style={{height: '24px'}} /></td><td>Indica un cambio de estado.</td></tr>
                                <tr><td><Image src={img_icono_cierre_comentario} style={{height: '24px'}} /></td><td>Indica el comentario final al cerrar una incidencia.</td></tr>
                                <tr><td><Image src={img_icono_reasignacion} style={{height: '24px'}} /></td><td>Indica una nueva asignación a un analista.</td></tr>
                                <tr><td><Image src={img_icono_comentario} style={{height: '24px'}} /></td><td>Indica un comentario de seguimiento manual.</td></tr>
                            </tbody>
                        </Table>
                        
                        <Card.Title as="h5" className="mt-3">Estados y Botones de Gestión</Card.Title>
                        <ListGroup>
                            <ListGroup.Item><Image src={img_estado_en_progreso} style={{height: '24px'}} className="me-2"/>Indica que la incidencia está abierta y un analista le está dando seguimiento.</ListGroup.Item>
                            <ListGroup.Item><Image src={img_estado_abierta} style={{height: '24px'}} className="me-2"/>Indica que la incidencia está abierta pero sin responsable.</ListGroup.Item>
                            <ListGroup.Item><Image src={img_estado_cerrada} style={{height: '24px'}} className="me-2"/>Indica que la incidencia está cerrada.</ListGroup.Item>
                        </ListGroup>
                        <p className="mt-3">Los botones disponibles cambian según el estado:</p>
                        <p><strong>Si está asignada:</strong></p>
                        <SectionImage src={img_gestion_botones_asignado} />
                        <p><strong>Si está sin asignar:</strong></p>
                        <SectionImage src={img_gestion_botones_sin_asignar} />
                        <p><strong>Si está cerrada:</strong></p>
                        <SectionImage src={img_gestion_botones_cerrada} />
                        
                        <Table bordered size="sm" className="align-middle mt-3">
                            <tbody>
                                <tr><td><Image src={img_boton_modificar} style={{height: '30px'}}/></td><td>Permite editar los registros que se guardaron al crear la incidencia.</td></tr>
                                <tr><td><Image src={img_boton_cerrar} style={{height: '30px'}}/></td><td>Abre un modal para poner un comentario de cierre y la fecha de finalización.</td></tr>
                                <tr><td><Image src={img_boton_liberar} style={{height: '30px'}}/></td><td>Libera la incidencia, cambiando su estado a "Abierta".</td></tr>
                                <tr><td><Image src={img_boton_asignar} style={{height: '30px'}}/></td><td>Te asigna la incidencia, cambiando su estado a "En Progreso".</td></tr>
                                <tr><td><Image src={img_boton_reabrir} style={{height: '30px'}}/></td><td>Permite reabrir una incidencia que ya estaba cerrada.</td></tr>
                            </tbody>
                        </Table>

                        <p><strong>Al igual que los eventos, se puede exportar haciendo click en exportar generando un archivo Excel con los datos</strong></p>

                    </Accordion.Body>
                </Accordion.Item>
            </Accordion>
        </Container>
    );
}

export default AyudaPage;