/**
 * Utilidad para formatear números con precisión decimal correcta
 * Evita mostrar números con muchos decimales innecesarios
 */

/**
 * Formatea un precio/monto monetario a 2 decimales
 * @param {number} value - Valor a formatear
 * @returns {number} - Valor formateado con 2 decimales
 */
const formatPrice = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return parseFloat(parseFloat(value).toFixed(2));
};

/**
 * Formatea un porcentaje a 1 decimal
 * @param {number} value - Valor a formatear
 * @returns {number} - Valor formateado con 1 decimal
 */
const formatPercentage = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return parseFloat(parseFloat(value).toFixed(1));
};

/**
 * Formatea un rating/calificación a 1 decimal
 * @param {number} value - Valor a formatear
 * @returns {number} - Valor formateado con 1 decimal
 */
const formatRating = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return parseFloat(parseFloat(value).toFixed(1));
};

/**
 * Formatea un promedio genérico a 2 decimales
 * @param {number} value - Valor a formatear
 * @returns {number} - Valor formateado con 2 decimales
 */
const formatAverage = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return parseFloat(parseFloat(value).toFixed(2));
};

/**
 * Calcula y formatea un promedio de división
 * @param {number} total - Numerador
 * @param {number} count - Denominador
 * @param {number} decimals - Número de decimales (default 2)
 * @returns {number} - Promedio formateado
 */
const safeAverage = (total, count, decimals = 2) => {
  if (!count || count === 0 || isNaN(total) || isNaN(count)) {
    return 0;
  }
  const avg = total / count;
  return parseFloat(avg.toFixed(decimals));
};

/**
 * Calcula y formatea un porcentaje
 * @param {number} part - Parte
 * @param {number} total - Total
 * @returns {number} - Porcentaje formateado con 1 decimal
 */
const safePercentage = (part, total) => {
  if (!total || total === 0 || isNaN(part) || isNaN(total)) {
    return 0;
  }
  const percentage = (part / total) * 100;
  return parseFloat(percentage.toFixed(1));
};

/**
 * Formatea coordenadas GPS a 6 decimales
 * @param {number} coordinate - Coordenada a formatear
 * @returns {number} - Coordenada formateada
 */
const formatCoordinate = (coordinate) => {
  if (coordinate === null || coordinate === undefined || isNaN(coordinate)) {
    return 0;
  }
  return parseFloat(parseFloat(coordinate).toFixed(6));
};

module.exports = {
  formatPrice,
  formatPercentage,
  formatRating,
  formatAverage,
  safeAverage,
  safePercentage,
  formatCoordinate
};
