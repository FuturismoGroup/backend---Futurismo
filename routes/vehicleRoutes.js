// Routes de Vehicles
// Soporta ELM-039 (AssignmentManager) y gestión de vehículos
// TBL-023: vehicles

const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { vehicle: vv } = require('../validations');

/**
 * GET /api/vehicles/available
 * Obtener vehículos disponibles para una fecha
 * Roles permitidos: Admin
 * NOTA: Debe ir ANTES de /:id para evitar conflicto de rutas
 */
router.get(
  '/available',
  authenticate,
  authorize(['admin']),
  vehicleController.getAvailableVehicles
);

/**
 * GET /api/vehicles
 * Lista paginada de vehículos
 * Roles permitidos: Admin
 */
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  vehicleController.listVehicles
);

/**
 * GET /api/vehicles/:id
 * Detalle de un vehículo
 * Roles permitidos: Admin
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin']),
  vehicleController.getVehicle
);

/**
 * POST /api/vehicles
 * Crear nuevo vehículo
 * Roles permitidos: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  validate(vv.createVehicleSchema),
  vehicleController.createVehicle
);

/**
 * PUT /api/vehicles/:id
 * Actualizar vehículo
 * Roles permitidos: Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  validate(vv.updateVehicleSchema),
  vehicleController.updateVehicle
);

/**
 * DELETE /api/vehicles/:id
 * Eliminar vehículo (soft delete)
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  vehicleController.deleteVehicle
);

/**
 * POST /api/vehicles/:id/maintenance
 * Registrar mantenimiento de un vehículo
 * Roles permitidos: Admin
 */
router.post(
  '/:id/maintenance',
  authenticate,
  authorize(['admin']),
  validate(vv.registerMaintenanceSchema),
  vehicleController.registerMaintenance
);

/**
 * POST /api/vehicles/:id/assignments
 * Asignar un vehículo a un tour/reserva
 * Roles permitidos: Admin
 */
router.post(
  '/:id/assignments',
  authenticate,
  authorize(['admin']),
  vehicleController.assignVehicle
);

module.exports = router;
