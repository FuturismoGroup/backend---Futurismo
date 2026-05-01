// Futurismo Backend - Servidor Express + Socket.io
// Punto de entrada principal de la aplicación

// IMPORTANTE: Configurar timezone ANTES de cualquier otro modulo
// Garantiza que process.env.TZ = 'America/Lima' en todo el proceso
require('./config/timezone');

require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('./config/logger');
const requestLogger = require('./middlewares/requestLogger');
const { initializeSocket } = require('./config/socket');

const app = express();
const httpServer = http.createServer(app);

// Trust proxy - necesario para Railway/Heroku/cualquier reverse proxy
// Permite que express-rate-limit obtenga la IP real del cliente
app.set('trust proxy', 1);

// Rate limiting - previene ataques de fuerza bruta
// En desarrollo: límites más permisivos
const isDev = process.env.NODE_ENV !== 'production';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDev ? 2000 : 1000, // 2000 en dev, 1000 en prod (~1 req/seg)
  message: { error: 'Too Many Requests', message: 'Demasiadas solicitudes, intente mas tarde' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDev && req.ip === '::1' // Skip localhost en dev
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDev ? 200 : 100, // 200 en dev, 100 en prod (suficiente para testing de usuarios)
  message: { error: 'Too Many Attempts', message: 'Demasiados intentos de login, intente en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middlewares globales
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permitir acceso a archivos estáticos
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Aplicar rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Health check mejorado
const prisma = require('./config/db');
app.get('/api/health', async (req, res) => {
  try {
    // Verificar conexion a BD
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Database error'
    });
  }
});

// Rutas de API
const reservationRoutes = require('./routes/reservationRoutes');
const tourRoutes = require('./routes/tourRoutes');
const guideRoutes = require('./routes/guideRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const rewardCategoryRoutes = require('./routes/rewardCategoryRoutes');
const configRoutes = require('./routes/configRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const providerRoutes = require('./routes/providerRoutes');
const chatRoutes = require('./routes/chatRoutes');
const reportRoutes = require('./routes/reportRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');
const driverRoutes = require('./routes/driverRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const profileRoutes = require('./routes/profileRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const appRoutes = require('./routes/appRoutes');
const financialRoutes = require('./routes/financialRoutes');
const termsRoutes = require('./routes/termsRoutes');
const languageRoutes = require('./routes/languageRoutes');
const systemRoutes = require('./routes/systemRoutes');
const fileRoutes = require('./routes/fileRoutes');

// Registrar rutas
app.use('/api/reservations', reservationRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/agencies', agencyRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/reward-categories', rewardCategoryRoutes);
app.use('/api/config', configRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/emergency', emergencyRoutes); // Alias singular para compatibilidad frontend
app.use('/api/providers', providerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/app', appRoutes);
app.use('/api', appRoutes); // También montar en /api para soportar /api/data/section/*
app.use('/api/financial', financialRoutes);
app.use('/api/terms', termsRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/files', fileRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Ruta ${req.method} ${req.path} no encontrada`
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId: req.user?.id
  });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

// Inicializar Socket.io
const io = initializeSocket(httpServer);

// Hacer io accesible desde los controladores via req.app.get('io')
app.set('io', io);

const server = httpServer.listen(PORT, () => {
  const env = process.env.NODE_ENV || 'development';

  if (env !== 'production') {
    const dbUrl = process.env.DATABASE_URL || '';
    const dbName = dbUrl.match(/\/([^/?]+)(\?|$)/)?.[1] || 'unknown';
    console.log('\n============================================');
    console.log('  FUTURISMO - DESARROLLO LOCAL');
    console.log('============================================');
    console.log(`  Puerto:    ${PORT}`);
    console.log(`  Entorno:   ${env}`);
    console.log(`  Base datos: ${dbName}`);
    console.log(`  Health:    http://localhost:${PORT}/api/health`);
    console.log('============================================\n');
  }

  logger.info('Server started', {
    port: PORT,
    environment: env,
    healthCheck: `http://localhost:${PORT}/api/health`,
    websocket: 'enabled'
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info('Shutdown signal received', { signal });

  // Cerrar Socket.io primero
  io.close(() => {
    logger.info('WebSocket server closed');
  });

  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (err) {
      logger.error('Error closing database', { error: err.message });
    }
    process.exit(0);
  });

  // Forzar cierre si tarda mas de 10s
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
