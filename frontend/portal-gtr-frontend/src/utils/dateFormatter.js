// RUTA: src/utils/dateFormatter.js

export const formatDateTime = (apiDateString) => {
    if (!apiDateString) {
        return 'N/A';
    }

    // 1. Eliminamos los microsegundos para estandarizar el formato.
    let cleanDateString = apiDateString.split('.')[0];

    // 2. Verificamos si ya tiene un indicador de zona horaria.
    const isAlreadyUtc = cleanDateString.includes('Z') || cleanDateString.includes('+');
    
    // 3. Si no lo tiene, añadimos la 'Z' para tratarlo como UTC.
    const date = new Date(isAlreadyUtc ? cleanDateString : cleanDateString + 'Z');

    if (isNaN(date.getTime())) {
        return `Fecha inválida (${apiDateString})`;
    }

    // 4. Estos métodos siempre devuelven los componentes en la hora local del navegador.
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};