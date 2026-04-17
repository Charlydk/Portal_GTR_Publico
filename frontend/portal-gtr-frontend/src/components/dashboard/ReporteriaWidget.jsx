import React from 'react';
import { Card, Table, Badge, Button } from 'react-bootstrap';

const ReporteriaWidget = ({ bolsa = [], onShowAudit }) => {

    const getEstadoBadge = (estado) => {
        switch (estado) {
            case 'COMPLETADO': return <Badge bg="success">Completado</Badge>;
            case 'EN_PROCESO': return <Badge bg="info">En Proceso</Badge>;
            default: return <Badge bg="secondary">Pendiente</Badge>;
        }
    };

    // Filtrar solo las del día actual
    const hoyStr = new Date().toISOString().split('T')[0];
    const bolsaHoy = bolsa.filter(t => t.fecha_tarea === hoyStr);

    return (
        <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white border-0 pt-3 pb-2 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold text-muted mb-0">📊 REPORTERÍA</h6>
                <Button variant="outline-link" size="sm" className="p-0 text-primary text-decoration-none small" onClick={onShowAudit}>
                    📜 Ver Auditoría
                </Button>
            </Card.Header>
            <Card.Body className="p-0">
                <div style={{ maxHeight: '430px', overflowY: 'auto' }}>
                    <Table hover responsive className="mb-0 align-middle small">
                        <thead className="bg-light sticky-top">
                            <tr>
                                <th className="ps-3" style={{width:'50%'}}>Reporte</th>
                                <th>Estado</th>
                                <th className="pe-3 text-end">Vencimiento</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bolsaHoy.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="text-center py-4 text-muted">No hay reportes cargados hoy</td>
                                </tr>
                            ) : (
                                bolsaHoy.map((t) => (
                                    <tr key={t.id}>
                                        <td className="ps-3">
                                            <div className="fw-bold">{t.nombre}</div>
                                            <div className="text-muted" style={{fontSize: '0.7rem'}}>{t.categoria}</div>
                                        </td>
                                        <td>{getEstadoBadge(t.estado)}</td>
                                        <td className="pe-3 text-end text-muted">
                                            {t.hora_vencimiento ? t.hora_vencimiento.substring(0, 5) : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
};

export default ReporteriaWidget;
