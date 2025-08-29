export function decimalToHHMM(decimalHours) {
    if (decimalHours === null || isNaN(decimalHours) || decimalHours < 0) return "00:00";
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function hhmmToDecimal(timeString) {
    if (!timeString || typeof timeString !== 'string') return 0;
    const parts = timeString.split(':');
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return isNaN(hours) || isNaN(minutes) ? 0 : hours + (minutes / 60);
}