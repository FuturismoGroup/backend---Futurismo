// Routes de Config
// Fuente: 04_apis_lista.md
// API-050: GetPointsConfig
// API-061 a API-070: System/Reservation/Notification Config y Categories

const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const systemConfigController = require('../controllers/systemConfigController');
const { authenticate, authorize } = require('../middlewares/auth');
const prisma = require('../config/db');

/**
 * GET /api/config/modules
 * Público - Configuración de módulos habilitados (para carga inicial de la app)
 * Lee de tabla settings con category='modules' via Prisma (real BD)
 */
router.get('/modules', async (req, res) => {
  try {
    // Buscar configuracion de modulos en la tabla settings
    const modulesSettings = await prisma.settings.findMany({
      where: { category: 'modules' }
    });

    // Configuracion por defecto de modulos
    const defaultModules = {
      reservations: { enabled: true, label: 'Reservas' },
      tours: { enabled: true, label: 'Tours' },
      guides: { enabled: true, label: 'Guías' },
      agencies: { enabled: true, label: 'Agencias' },
      providers: { enabled: true, label: 'Proveedores' },
      vehicles: { enabled: true, label: 'Vehículos' },
      drivers: { enabled: true, label: 'Conductores' },
      rewards: { enabled: true, label: 'Recompensas' },
      chat: { enabled: true, label: 'Chat' },
      reports: { enabled: true, label: 'Reportes' },
      emergency: { enabled: true, label: 'Emergencias' },
      monitoring: { enabled: true, label: 'Monitoreo' },
      marketplace: { enabled: true, label: 'Marketplace' },
      feedback: { enabled: true, label: 'Feedback' }
    };

    // Si hay configuracion en BD, combinarla con defaults
    let modules = { ...defaultModules };
    if (modulesSettings.length > 0) {
      modulesSettings.forEach(setting => {
        if (setting.key && setting.value) {
          modules[setting.key] = setting.value;
        }
      });
    }

    res.json({ modules });
  } catch (error) {
    console.error('Error en GET /config/modules:', error);
    // Fallback con valores por defecto
    res.json({
      modules: {
        reservations: { enabled: true, label: 'Reservas' },
        tours: { enabled: true, label: 'Tours' },
        guides: { enabled: true, label: 'Guías' },
        agencies: { enabled: true, label: 'Agencias' },
        providers: { enabled: true, label: 'Proveedores' },
        vehicles: { enabled: true, label: 'Vehículos' },
        drivers: { enabled: true, label: 'Conductores' },
        rewards: { enabled: true, label: 'Recompensas' },
        chat: { enabled: true, label: 'Chat' },
        reports: { enabled: true, label: 'Reportes' },
        emergency: { enabled: true, label: 'Emergencias' },
        monitoring: { enabled: true, label: 'Monitoreo' },
        marketplace: { enabled: true, label: 'Marketplace' },
        feedback: { enabled: true, label: 'Feedback' }
      }
    });
  }
});

/**
 * GET /api/config/settings
 * Público - Configuración general de la aplicación (para carga inicial)
 * Lee de tabla system_config via Prisma (real BD)
 */
router.get('/settings', async (req, res) => {
  try {
    // Leer configuracion real de BD
    let sysConfig = await prisma.system_config.findFirst();

    // Valores por defecto si no hay registro en BD
    const defaultConfig = {
      company_name: 'Futurismo Tours',
      company_logo: null,
      company_phone: '',
      company_email: '',
      company_website: '',
      company_address: '',
      timezone: 'America/Lima',
      currency: 'PEN',
      language: 'es',
      date_format: 'DD/MM/YYYY',
      time_format: 'HH:mm',
      theme: { primaryColor: '#1976d2', secondaryColor: '#dc004e' }
    };

    if (!sysConfig) {
      sysConfig = defaultConfig;
    }

    // Mapear a formato esperado por frontend (useAppConfig.js)
    // TODOS los datos de contacto vienen de la BD (system_config)
    res.json({
      success: true,
      data: {
        app: {
          name: sysConfig.company_name || defaultConfig.company_name,
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        },
        contact: {
          // Datos 100% de BD - el admin los configura desde el panel
          whatsapp: sysConfig.admin_personal_phone || sysConfig.company_phone || '',
          email: sysConfig.company_email || '',
          website: sysConfig.company_website || '',
          phone: sysConfig.company_phone || '',
          emergency: {
            // Numeros de emergencia reales de Peru (no son datos ficticios)
            police: '105',
            fire: '116',
            medical: '106',
            // Telefono de emergencia de la empresa desde BD
            company: sysConfig.admin_emergency_phone || sysConfig.company_phone || ''
          }
        },
        api: {
          baseUrl: process.env.API_BASE_URL || '/api',
          wsUrl: process.env.WS_URL || 'ws://localhost:3001',
          timeout: parseInt(process.env.API_TIMEOUT, 10) || 30000
        },
        features: {
          notifications: true,
          emergency_alerts: true,
          multi_language: true,
          payment_gateway: false,
          real_time_tracking: true
        },
        limits: {
          max_file_size: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760,
          max_group_size: parseInt(process.env.MAX_GROUP_SIZE, 10) || 50,
          max_tour_capacity: parseInt(process.env.MAX_TOUR_CAPACITY, 10) || 20,
          reservation_days_ahead: parseInt(process.env.RESERVATION_DAYS_AHEAD, 10) || 365,
          cancellation_hours: parseInt(process.env.CANCELLATION_HOURS, 10) || 24,
          session_timeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 3600000,
          whatsapp_cutoff_hour: parseInt(process.env.WHATSAPP_CUTOFF_HOUR, 10) || 17
        },
        intervals: {
          fast_update: parseInt(process.env.UPDATE_INTERVAL_FAST, 10) || 30000,
          medium_update: parseInt(process.env.UPDATE_INTERVAL_MEDIUM, 10) || 60000,
          slow_update: parseInt(process.env.UPDATE_INTERVAL_SLOW, 10) || 300000,
          debounce_delay: parseInt(process.env.DEBOUNCE_DELAY, 10) || 300
        },
        formats: {
          date: sysConfig.date_format || defaultConfig.date_format,
          time: sysConfig.time_format || defaultConfig.time_format,
          currency: sysConfig.currency || defaultConfig.currency,
          timezone: sysConfig.timezone || defaultConfig.timezone
        },
        external_services: {
          google_maps_api: process.env.GOOGLE_MAPS_API_KEY || '',
          avatars_service: process.env.AVATAR_SERVICE_URL || 'https://ui-avatars.com/api',
          osm_tiles: process.env.MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        }
      }
    });
  } catch (error) {
    console.error('Error en GET /config/settings:', error);
    // Fallback con valores minimos si hay error de BD
    // Sin datos ficticios - el admin debe configurar desde el panel
    res.json({
      success: false,
      error: 'Error al cargar configuracion del sistema',
      data: {
        app: { name: 'Futurismo Tours', version: '1.0.0', environment: process.env.NODE_ENV || 'development' },
        contact: { whatsapp: '', email: '', website: '', phone: '', emergency: { police: '105', fire: '116', medical: '106', company: '' } },
        api: { baseUrl: '/api', wsUrl: process.env.WS_URL || 'ws://localhost:3001', timeout: 30000 },
        features: { notifications: true, emergency_alerts: true, multi_language: true, payment_gateway: false, real_time_tracking: true },
        limits: { max_file_size: 10485760, max_group_size: 50, max_tour_capacity: 20, reservation_days_ahead: 365, cancellation_hours: 24, session_timeout: 3600000, whatsapp_cutoff_hour: 17 },
        intervals: { fast_update: 30000, medium_update: 60000, slow_update: 300000, debounce_delay: 300 },
        formats: { date: 'DD/MM/YYYY', time: 'HH:mm', currency: 'PEN', timezone: 'America/Lima' },
        external_services: { google_maps_api: '', avatars_service: 'https://ui-avatars.com/api', osm_tiles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
      }
    });
  }
});

/**
 * API-050: GetPointsConfig
 * GET /api/config/points
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/points',
  authenticate,
  authorize(['admin', 'agency']),
  pointsController.getPointsConfig
);

/**
 * API-065: UpdatePointsConfig
 * PUT /api/config/points
 * Roles permitidos: Admin
 */
router.put(
  '/points',
  authenticate,
  authorize(['admin']),
  systemConfigController.updatePointsConfig
);

/**
 * API-061: GetSystemConfig
 * GET /api/config/system
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/system',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  systemConfigController.getSystemConfig
);

/**
 * API-062: UpdateSystemConfig
 * PUT /api/config/system
 * Roles permitidos: Admin
 */
router.put(
  '/system',
  authenticate,
  authorize(['admin']),
  systemConfigController.updateSystemConfig
);

/**
 * API-063: GetReservationConfig
 * GET /api/config/reservations
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/reservations',
  authenticate,
  authorize(['admin', 'agency']),
  systemConfigController.getReservationConfig
);

/**
 * API-064: UpdateReservationConfig
 * PUT /api/config/reservations
 * Roles permitidos: Admin
 */
router.put(
  '/reservations',
  authenticate,
  authorize(['admin']),
  systemConfigController.updateReservationConfig
);

/**
 * API-066: GetNotificationConfig
 * GET /api/config/notifications
 * Roles permitidos: Admin
 */
router.get(
  '/notifications',
  authenticate,
  authorize(['admin']),
  systemConfigController.getNotificationConfig
);

/**
 * API-067: UpdateNotificationConfig
 * PUT /api/config/notifications
 * Roles permitidos: Admin
 */
router.put(
  '/notifications',
  authenticate,
  authorize(['admin']),
  systemConfigController.updateNotificationConfig
);

/**
 * API-068: ListCategories
 * GET /api/config/categories
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/categories',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  systemConfigController.listCategories
);

/**
 * API-069: CreateCategory
 * POST /api/config/categories
 * Roles permitidos: Admin
 */
router.post(
  '/categories',
  authenticate,
  authorize(['admin']),
  systemConfigController.createCategory
);

/**
 * API-070: UpdateCategory
 * PUT /api/config/categories/:id
 * Roles permitidos: Admin
 */
router.put(
  '/categories/:id',
  authenticate,
  authorize(['admin']),
  systemConfigController.updateCategory
);

/**
 * FLW-045: GetToursConfig
 * GET /api/config/tours
 * Roles permitidos: Admin, Agency
 * Soporta ELM-387 (ToursSettings)
 */
router.get(
  '/tours',
  authenticate,
  authorize(['admin', 'agency']),
  systemConfigController.getToursConfig
);

/**
 * FLW-045: UpdateToursConfig
 * PUT /api/config/tours
 * Roles permitidos: Admin
 * Soporta ELM-387 (ToursSettings)
 */
router.put(
  '/tours',
  authenticate,
  authorize(['admin']),
  systemConfigController.updateToursConfig
);

/**
 * FLW-044: CRUD ServiceTypes
 * GET /api/config/service-types
 * Soporta ELM-386 (ServiceTypesSettings)
 * Roles permitidos: Admin
 */
router.get(
  '/service-types',
  authenticate,
  authorize(['admin']),
  systemConfigController.listServiceTypes
);

/**
 * POST /api/config/service-types
 * Roles permitidos: Admin
 */
router.post(
  '/service-types',
  authenticate,
  authorize(['admin']),
  systemConfigController.createServiceType
);

/**
 * PUT /api/config/service-types/:value
 * Roles permitidos: Admin
 */
router.put(
  '/service-types/:value',
  authenticate,
  authorize(['admin']),
  systemConfigController.updateServiceType
);

/**
 * DELETE /api/config/service-types/:value
 * Roles permitidos: Admin
 */
router.delete(
  '/service-types/:value',
  authenticate,
  authorize(['admin']),
  systemConfigController.deleteServiceType
);

module.exports = router;
