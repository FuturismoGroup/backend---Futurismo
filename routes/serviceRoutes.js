// Routes de Services (provider_services)
// Soporta ELM-052 (ProviderAssignment)
// Tabla: provider_services

const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * GET /api/services/types
 * Lista tipos de servicio disponibles
 * Roles permitidos: Admin, Agency
 * NOTA: Debe ir ANTES de /:id para evitar conflicto de rutas
 */
router.get(
  '/types',
  authenticate,
  authorize(['admin', 'agency']),
  serviceController.listServiceTypes
);

/**
 * GET /api/services/history
 * Lista historial de servicios (service_requests)
 * Query params: status, from, to, guideId, agencyId
 * Roles: Admin, Agency, Guide
 * NOTA: Debe ir ANTES de /:id
 */
router.get(
  '/history',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  serviceController.getServiceHistory
);

/**
 * GET /api/services/by-provider/:providerId
 * Lista servicios de un proveedor específico
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/by-provider/:providerId',
  authenticate,
  authorize(['admin', 'agency']),
  serviceController.listServicesByProvider
);

/**
 * GET /api/services
 * Lista todos los servicios de proveedores
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency']),
  serviceController.listServices
);

/**
 * GET /api/services/:id
 * Detalle de un servicio
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency']),
  serviceController.getService
);

/**
 * POST /api/services
 * Crear nuevo servicio
 * Roles permitidos: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  serviceController.createService
);

/**
 * PUT /api/services/:id
 * Actualizar servicio
 * Roles permitidos: Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  serviceController.updateService
);

/**
 * DELETE /api/services/:id
 * Eliminar servicio (soft delete)
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  serviceController.deleteService
);

module.exports = router;
