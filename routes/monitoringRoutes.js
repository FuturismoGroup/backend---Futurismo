// Routes de Monitoring
// Fuente: 04_apis_lista.md
// API-088 a API-090: Monitoreo de tours en tiempo real

const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * API-088: GetActiveToursMonitoring
 * GET /api/monitoring/active-tours
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/active-tours',
  authenticate,
  authorize(['admin', 'agency']),
  monitoringController.getActiveToursMonitoring
);

/**
 * API-089: UpdateGuideLocation
 * POST /api/monitoring/location
 * Roles permitidos: Guide
 */
router.post(
  '/location',
  authenticate,
  authorize(['guide']),
  monitoringController.updateGuideLocation
);

/**
 * API-090: GetMonitoringAlerts
 * GET /api/monitoring/alerts
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/alerts',
  authenticate,
  authorize(['admin', 'agency']),
  monitoringController.getMonitoringAlerts
);

/**
 * Auxiliar: AcknowledgeAlert
 * PATCH /api/monitoring/alerts/:id/acknowledge
 * Roles permitidos: Admin, Agency
 */
router.patch(
  '/alerts/:id/acknowledge',
  authenticate,
  authorize(['admin', 'agency']),
  monitoringController.acknowledgeAlert
);

// NOTA: Las rutas de fotos fueron movidas a /api/tours/:tourId/photos
// Ver tourRoutes.js y tourPhotoController.js

module.exports = router;
