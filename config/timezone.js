/**
 * Configuracion centralizada de zona horaria
 * Garantiza que todas las fechas/timestamps se manejen en America/Lima
 * Funciona tanto en desarrollo local como en Railway (produccion)
 *
 * IMPORTANTE: Este archivo DEBE importarse como primera linea en index.js
 * ANTES de cualquier otro require, para que process.env.TZ surta efecto
 * en todo el proceso Node.js.
 */

// Zona horaria de la aplicacion (Peru)
const APP_TIMEZONE = 'America/Lima';

// Configurar timezone del proceso Node.js
// Esto afecta a new Date().toString(), toLocaleString(), etc.
process.env.TZ = APP_TIMEZONE;

// Offset UTC en horas (Peru = UTC-5, no tiene horario de verano)
const UTC_OFFSET_HOURS = -5;

module.exports = {
  APP_TIMEZONE,
  UTC_OFFSET_HOURS
};
