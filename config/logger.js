/**
 * Configuracion de Winston Logger
 * Logs estructurados para desarrollo y produccion
 */

const winston = require('winston');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

// Formato personalizado para desarrollo
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

// Formato JSON para produccion
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Directorio de logs
const logsDir = path.join(__dirname, '..', 'logs');

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: isDev ? devFormat : prodFormat,
  defaultMeta: { service: 'futurismo-api' },
  transports: [
    // Consola - siempre activo
    new winston.transports.Console({
      format: devFormat
    })
  ]
});

// En produccion, agregar logs a archivos
if (!isDev) {
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// Metodos auxiliares para logging de requests
logger.request = (req, message = 'Request') => {
  logger.info(message, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id,
    userRole: req.user?.role
  });
};

logger.response = (req, res, message = 'Response') => {
  logger.info(message, {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration: res.get('X-Response-Time')
  });
};

logger.apiError = (req, error, message = 'API Error') => {
  logger.error(message, {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    error: error.message,
    stack: isDev ? error.stack : undefined
  });
};

module.exports = logger;
