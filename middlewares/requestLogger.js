/**
 * Middleware de logging de requests HTTP
 * Registra todas las requests entrantes y sus respuestas
 */

const logger = require('../config/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Interceptar el fin de la response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    const isSlow = duration > 1000;

    // En desarrollo: solo errores y requests lentas (menos ruido)
    // Para loguear todo: set LOG_ALL_REQUESTS=true
    const shouldLog = process.env.LOG_ALL_REQUESTS === 'true' || isError || isSlow;

    if (shouldLog) {
      const logLevel = isError ? 'warn' : 'info';
      logger[logLevel]('HTTP Request', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ...(isError && { userId: req.user?.id })
      });
    }
  });

  next();
};

module.exports = requestLogger;
