/**
 * Utilidades para manejo correcto de fechas
 * Previene problemas de zona horaria en conversiones de fecha
 *
 * PROBLEMA RESUELTO: Cuando se usa new Date("2026-01-10") JavaScript interpreta
 * esto como medianoche UTC (00:00:00Z), lo cual en timezone UTC-5 (Lima/Bogota)
 * resulta en el dia anterior (2026-01-09 19:00:00-05).
 *
 * SOLUCION: Parsear las fechas forzando la interpretacion en zona horaria local.
 */

/**
 * Convierte un string de fecha (YYYY-MM-DD) a Date sin ajuste de timezone
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @returns {Date|null} Objeto Date con la fecha exacta sin conversion de zona horaria
 *
 * SOLUCION ROBUSTA: Usar hora 12:00 UTC para evitar que cualquier conversion
 * de timezone (hacia atras o adelante) cambie el dia.
 * Ejemplo: 2027-01-10T12:00:00Z en UTC-12 = 2027-01-10 00:00, en UTC+14 = 2027-01-11 02:00
 * Pero al guardar en campo DATE de PostgreSQL, solo se guarda la fecha: 2027-01-10
 */
const parseLocalDate = (dateString) => {
  if (!dateString) return null;

  // Si ya es un objeto Date, extraer sus componentes UTC
  // IMPORTANTE: Usar getUTC* en lugar de getFullYear/getMonth/getDate
  // porque con process.env.TZ='America/Lima' (UTC-5), los metodos locales
  // devuelven el dia anterior para fechas cerca de medianoche UTC
  // Ej: 2026-03-01T00:00:00Z → getDate()=28(feb), getUTCDate()=1(mar)
  if (dateString instanceof Date) {
    const year = dateString.getUTCFullYear();
    const month = dateString.getUTCMonth();
    const day = dateString.getUTCDate();
    // Crear fecha UTC al mediodia para evitar desfases
    return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  }

  // Si es string en formato ISO con hora (ej: "2026-01-10T00:00:00.000Z")
  // extraer solo la parte de fecha
  const dateOnly = String(dateString).split('T')[0];

  // Extraer componentes de la fecha
  const [year, month, day] = dateOnly.split('-').map(Number);

  // Validar componentes
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  // Crear Date usando UTC al mediodia (12:00:00Z)
  // Esto garantiza que incluso con conversiones de timezone extremas (-12 a +14),
  // el dia se mantenga correcto al guardar en PostgreSQL como DATE
  // month - 1 porque Date usa meses 0-indexed
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
};

/**
 * Convierte un Date a string YYYY-MM-DD sin ajuste de timezone
 * @param {Date} date - Objeto Date
 * @returns {string|null} Fecha en formato YYYY-MM-DD
 *
 * IMPORTANTE: Usa métodos UTC porque parseLocalDate guarda fechas con UTC al mediodía.
 * Esto garantiza consistencia: si se guardó 2026-01-29T12:00:00Z, se retorna "2026-01-29"
 * independientemente de la zona horaria del servidor (local o Railway).
 */
const formatLocalDate = (date) => {
  if (!date) return null;

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) return null;

  // Usar métodos UTC para consistencia con parseLocalDate
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

/**
 * Valida que una fecha sea mayor o igual a hoy (sin considerar hora)
 * @param {string|Date} dateInput - Fecha en formato YYYY-MM-DD o Date object
 * @returns {boolean}
 */
const isDateTodayOrFuture = (dateInput) => {
  const inputDate = parseLocalDate(dateInput);
  if (!inputDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);

  return inputDate >= today;
};

/**
 * Compara dos fechas ignorando la hora
 * @param {string|Date} date1
 * @param {string|Date} date2
 * @returns {number} -1 si date1 < date2, 0 si iguales, 1 si date1 > date2
 */
const compareDates = (date1, date2) => {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);

  if (!d1 || !d2) return null;

  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
};

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD usando UTC
 * @returns {string}
 */
const getTodayString = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Verifica si un string es una fecha valida en formato YYYY-MM-DD
 * @param {string} dateString
 * @returns {boolean}
 */
const isValidDateString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return false;

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const parsed = parseLocalDate(dateString);
  return parsed !== null && !isNaN(parsed.getTime());
};

/**
 * Construye un objeto de filtro para Prisma con campos DATE
 * Maneja correctamente el rango de fechas evitando problemas de timezone
 * @param {string} startDate - Fecha inicio en formato YYYY-MM-DD
 * @param {string} endDate - Fecha fin en formato YYYY-MM-DD
 * @returns {object|null} Objeto para usar en where.date de Prisma
 */
const buildDateFilter = (startDate, endDate) => {
  const filter = {};

  if (startDate) {
    const parsed = parseLocalDate(startDate);
    if (parsed) filter.gte = parsed;
  }

  if (endDate) {
    const parsed = parseLocalDate(endDate);
    if (parsed) filter.lte = parsed;
  }

  return Object.keys(filter).length > 0 ? filter : null;
};

/**
 * Construye filtro para campos TIMESTAMPTZ (con hora)
 * Para rango de fechas completas (desde 00:00:00 hasta 23:59:59)
 * @param {string} startDate - Fecha inicio en formato YYYY-MM-DD
 * @param {string} endDate - Fecha fin en formato YYYY-MM-DD
 * @returns {object|null} Objeto para usar en where.created_at de Prisma
 */
const buildTimestampFilter = (startDate, endDate) => {
  const filter = {};

  if (startDate) {
    const [year, month, day] = startDate.split('-').map(Number);
    if (year && month && day) {
      // Inicio del día en UTC
      filter.gte = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }
  }

  if (endDate) {
    const [year, month, day] = endDate.split('-').map(Number);
    if (year && month && day) {
      // Fin del día en UTC (23:59:59.999)
      filter.lte = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    }
  }

  return Object.keys(filter).length > 0 ? filter : null;
};

/**
 * Obtiene un timestamp "ahora" en la zona horaria de la aplicacion (America/Lima)
 * Usa Intl.DateTimeFormat para producir un ISO string con la hora local de Lima.
 *
 * Para columnas TIMESTAMPTZ: PostgreSQL almacena internamente en UTC,
 * pero esta funcion retorna un Date cuyo .toISOString() refleja UTC.
 * La diferencia clave es que al usar process.env.TZ = 'America/Lima',
 * new Date() ya reporta la hora local correcta en toString()/getHours().
 *
 * @returns {Date} Date actual (internamente UTC, pero TZ del proceso es Lima)
 */
const nowLocal = () => {
  return new Date();
};

/**
 * Formatea un timestamp (Date o ISO string) a string legible en America/Lima
 * Ejemplo: "22/02/2026, 10:30 PM" o "22 feb 2026, 22:30"
 *
 * @param {Date|string} timestamp - Date object o ISO string
 * @param {object} options - Opciones de Intl.DateTimeFormat (override)
 * @returns {string} Timestamp formateado en America/Lima
 */
const formatTimestamp = (timestamp, options = {}) => {
  if (!timestamp) return null;

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return null;

  const { APP_TIMEZONE } = require('../config/timezone');

  const defaultOptions = {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options
  };

  return date.toLocaleString('es-PE', defaultOptions);
};

/**
 * Convierte un timestamp a ISO string pero con la hora ajustada a America/Lima
 * Util para respuestas de API donde el frontend necesita parsear la fecha
 *
 * @param {Date|string} timestamp - Date object o ISO string
 * @returns {string|null} ISO string representando el momento en Lima timezone
 */
const toLocalISOString = (timestamp) => {
  if (!timestamp) return null;

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return null;

  const { APP_TIMEZONE } = require('../config/timezone');

  // Obtener componentes en la timezone de Lima
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find(p => p.type === type)?.value || '00';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') === '24' ? '00' : get('hour');
  const minute = get('minute');
  const second = get('second');

  // Retornar con sufijo que indica timezone Lima (UTC-5)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
};

module.exports = {
  parseLocalDate,
  formatLocalDate,
  isDateTodayOrFuture,
  compareDates,
  getTodayString,
  isValidDateString,
  buildDateFilter,
  buildTimestampFilter,
  nowLocal,
  formatTimestamp,
  toLocalISOString
};
