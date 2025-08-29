import React from 'react';
import { Form, Button } from 'react-bootstrap';
import { decimalToHHMM } from '../../utils/timeUtils';

function ResultadoFila({ dia, validacionDia, onValidationChange, onSimpleChange, onRevalidar, isPendientesView }) {
    
    if (!validacionDia) return null;

    const esDescanso = (dia.inicio_turno_teorico === '00:00' && dia.fin_turno_teorico === '00:00');

    const renderInputsHHEE = () => {
        if (dia.estado_final === 'Validado') {
            const partes = [];
            if (dia.hhee_aprobadas_inicio > 0) partes.push(<div key="antes-val" className="mb-1 text-success">✅ Antes: {decimalToHHMM(dia.hhee_aprobadas_inicio)}</div>);
            if (dia.hhee_aprobadas_fin > 0) partes.push(<div key="despues-val" className="text-success">✅ Después: {decimalToHHMM(dia.hhee_aprobadas_fin)}</div>);
            if (dia.hhee_aprobadas_descanso > 0) partes.push(<div key="desc-val" className="text-success">✅ Descanso: {decimalToHHMM(dia.hhee_aprobadas_descanso)}</div>);

            if (dia.hhee_inicio_calculadas > 0 && !dia.hhee_aprobadas_inicio) {
                 partes.push(
                    <div key="antes-in" className="d-flex align-items-center mb-1">
                        <Form.Check type="checkbox" className="me-2" checked={validacionDia.antes.habilitado} onChange={e => onValidationChange(dia.fecha, 'antes', 'habilitado', e.target.checked)} />
                        <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>Antes:</Form.Label>
                        <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.antes.valor} max={decimalToHHMM(dia.hhee_inicio_calculadas)} disabled={!validacionDia.antes.habilitado} onChange={e => onValidationChange(dia.fecha, 'antes', 'valor', e.target.value)} />
                    </div>
                 );
            }
            if (dia.hhee_fin_calculadas > 0 && !dia.hhee_aprobadas_fin) {
                partes.push(
                    <div key="despues-in" className="d-flex align-items-center">
                        <Form.Check type="checkbox" className="me-2" checked={validacionDia.despues.habilitado} onChange={e => onValidationChange(dia.fecha, 'despues', 'habilitado', e.target.checked)} />
                        <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>Después:</Form.Label>
                        <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.despues.valor} max={decimalToHHMM(dia.hhee_fin_calculadas)} disabled={!validacionDia.despues.habilitado} onChange={e => onValidationChange(dia.fecha, 'despues', 'valor', e.target.value)} />
                    </div>
                );
            }

            return partes.length > 0 ? partes : <span className="text-muted fst-italic">Completo</span>;
        }
    
        if (dia.estado_final === 'Pendiente por Corrección') {
            const hheeCalculadas = [];
            if (dia.hhee_inicio_calculadas > 0) hheeCalculadas.push(<div key="hhee-antes">Antes: {decimalToHHMM(dia.hhee_inicio_calculadas)}</div>);
            if (dia.hhee_fin_calculadas > 0) hheeCalculadas.push(<div key="hhee-despues">Después: {decimalToHHMM(dia.hhee_fin_calculadas)}</div>);
            if (esDescanso && dia.cantidad_hhee_calculadas > 0) hheeCalculadas.push(<div key="hhee-descanso">Descanso: {decimalToHHMM(dia.cantidad_hhee_calculadas)}</div>);
            return hheeCalculadas.length > 0 ? <div className="text-muted fst-italic">{hheeCalculadas}</div> : '---';
        }
        
        const isDisabledGeneral = validacionDia.pendiente;
        
        if (esDescanso) {
            // Verificamos si RRHH ya aprobó horas para este día de descanso
            const totalRRHHDescanso = (dia.hhee_autorizadas_antes_gv || 0) + (dia.hhee_autorizadas_despues_gv || 0);
            
            // Si RRHH ya aprobó, o no hay horas calculadas, no mostramos nada.
            if (totalRRHHDescanso > 0 || dia.cantidad_hhee_calculadas <= 0) {
                return '---';
            }
            
            // Si no, mostramos el input para que el supervisor apruebe
            return (
                <div className="d-flex align-items-center">
                    <Form.Check type="checkbox" className="me-2" checked={validacionDia.descanso.habilitado} disabled={isDisabledGeneral} onChange={e => onValidationChange(dia.fecha, 'descanso', 'habilitado', e.target.checked)} />
                    <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>Descanso:</Form.Label>
                    <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.descanso.valor} max={decimalToHHMM(dia.cantidad_hhee_calculadas)} disabled={isDisabledGeneral || !validacionDia.descanso.habilitado} onChange={e => onValidationChange(dia.fecha, 'descanso', 'valor', e.target.value)} />
                </div>
            );
        }
        
        const mostrarAntes = dia.hhee_inicio_calculadas > 0 && !dia.hhee_autorizadas_antes_gv;
        const mostrarDespues = dia.hhee_fin_calculadas > 0 && !dia.hhee_autorizadas_despues_gv;
    
        if (!mostrarAntes && !mostrarDespues) return '---';
    
        return (
            <>
                {mostrarAntes && (
                    <div className="d-flex align-items-center mb-1">
                        <Form.Check type="checkbox" className="me-2" checked={validacionDia.antes.habilitado} disabled={isDisabledGeneral} onChange={e => onValidationChange(dia.fecha, 'antes', 'habilitado', e.target.checked)} />
                        <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>Antes:</Form.Label>
                        <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.antes.valor} max={decimalToHHMM(dia.hhee_inicio_calculadas)} disabled={isDisabledGeneral || !validacionDia.antes.habilitado} onChange={e => onValidationChange(dia.fecha, 'antes', 'valor', e.target.value)} />
                    </div>
                )}
                {mostrarDespues && (
                    <div className="d-flex align-items-center">
                        <Form.Check type="checkbox" className="me-2" checked={validacionDia.despues.habilitado} disabled={isDisabledGeneral} onChange={e => onValidationChange(dia.fecha, 'despues', 'habilitado', e.target.checked)} />
                        <Form.Label className="me-2 mb-0 fw-bold" style={{whiteSpace: 'nowrap'}}>Después:</Form.Label>
                        <Form.Control type="time" style={{ width: '100px' }} value={validacionDia.despues.valor} max={decimalToHHMM(dia.hhee_fin_calculadas)} disabled={isDisabledGeneral || !validacionDia.despues.habilitado} onChange={e => onValidationChange(dia.fecha, 'despues', 'valor', e.target.value)} />
                    </div>
                )}
            </>
        );
    };
    
    const renderCeldaPendiente = () => {
         if (dia.estado_final === 'Pendiente por Corrección') {
            return (
                <>
                    <Form.Select size="sm" className="mt-1" value={dia.notas || ''} disabled>
                        <option>{dia.notas || 'Sin motivo'}</option>
                    </Form.Select>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-100 mt-2" 
                        onClick={() => onRevalidar(dia.rut_con_formato, dia.fecha)}
                    >
                        Re-Validar
                    </Button>
                </>
            );
        }
         if (dia.estado_final !== 'Validado') {
            return (
                <>
                    <Form.Check 
                        type="checkbox"
                        label="Marcar"
                        checked={validacionDia.pendiente || false}
                        onChange={(e) => onSimpleChange(dia.fecha, 'pendiente', e.target.checked)}
                    />
                    {validacionDia.pendiente && (
                        <Form.Select size="sm" className="mt-1" value={validacionDia.nota || ''} onChange={(e) => onSimpleChange(dia.fecha, 'nota', e.target.value)}>
                            <option value="">Seleccione motivo...</option>
                            <option value="Pendiente de cambio de turno">Cambio de turno</option>
                            <option value="Pendiente de corrección de marcas">Corrección de marcas</option>
                        </Form.Select>
                    )}
                </>
            );
        }
        return '---';
    };

    const renderHHEERRHH = () => {
        if (esDescanso) {
            const totalDescansoRRHH = (dia.hhee_autorizadas_antes_gv || 0) + (dia.hhee_autorizadas_despues_gv || 0);
            return totalDescansoRRHH > 0 ? <span className="text-primary">☑️☑️ Descanso: {decimalToHHMM(totalDescansoRRHH)}</span> : "";
        }
        const antes = dia.hhee_autorizadas_antes_gv > 0 ? <span className="text-primary">☑️☑️ Antes: {decimalToHHMM(dia.hhee_autorizadas_antes_gv)}</span> : null;
        const despues = dia.hhee_autorizadas_despues_gv > 0 ? <span className="text-primary"> ☑️☑️ Después: {decimalToHHMM(dia.hhee_autorizadas_despues_gv)}</span> : null;
        if (!antes && !despues) return "";
        return (<>{antes && <div>{antes}</div>}{despues && <div>{despues}</div>}</>);
    };

    return (
        <tr style={{ backgroundColor: dia.estado_final === 'Pendiente por Corrección' ? '#fff9e6' : dia.estado_final === 'Validado' ? '#e6ffed' : '' }}>
            {isPendientesView && <td><strong>{dia.nombre_apellido}</strong></td>}
            <td><strong>{dia.fecha}</strong></td>
            <td>
                <div>Turno: {esDescanso ? 'Descanso' : `${dia.inicio_turno_teorico || 'N/A'} - ${dia.fin_turno_teorico || 'N/A'}`}</div>
                <div>Marcas: {`${dia.marca_real_inicio || 'N/A'} - ${dia.marca_real_fin || 'N/A'}`}</div>
            </td>
            <td>{renderInputsHHEE()}</td>
            <td>{renderHHEERRHH()}</td>
            <td>{renderCeldaPendiente()}</td>
        </tr>
    );
}

export default ResultadoFila;