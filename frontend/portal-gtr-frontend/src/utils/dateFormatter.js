// src/utils/dateFormatter.js

// Usamos "export" para que la función pueda ser importada desde otros archivos.
export const formatDateTime = (apiDateString) => {
    // Si no hay fecha, devuelve N/A
    if (!apiDateString) {
        return 'N/A';
    }

    // Verificamos si el string ya tiene información de zona horaria ('Z' o '+').
    const isAlreadyUtc = apiDateString.includes('Z') || apiDateString.includes('+');

    // Si NO la tiene, le añadimos la 'Z' para tratarlo como UTC.
    const date = new Date(isAlreadyUtc ? apiDateString : apiDateString + 'Z');

    // Verificamos si la fecha parseada es válida
    if (isNaN(date.getTime())) {
        return `Fecha inválida (${apiDateString})`;
    }

    // Estos métodos devuelven los componentes en la hora local del navegador
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};

// En el futuro, podrías añadir más funciones relacionadas con fechas aquí.
// export const formatDateOnly = (apiDateString) => { ... };