// Routes de Drivers
// Soporta ELM-039 (AssignmentManager) y gestión de choferes
// TBL-022: drivers

const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { driver: dv } = require('../validations');

/**
 * GET /api/drivers/available
 * Obtener choferes disponibles para una fecha
 * Roles permitidos: Admin
 * NOTA: Debe ir ANTES de /:id para evitar conflicto de rutas
 */
router.get(
  '/available',
  authenticate,
  authorize(['admin']),
  driverController.getAvailableDrivers
);

/**
 * GET /api/drivers
 * Lista paginada de choferes
 * Roles permitidos: Admin
 */
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  driverController.listDrivers
);

/**
 * GET /api/drivers/:id
 * Detalle de un chofer
 * Roles permitidos: Admin
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin']),
  driverController.getDriver
);

/**
 * POST /api/drivers
 * Crear nuevo chofer
 * Roles permitidos: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  validate(dv.createDriverSchema),
  driverController.createDriver
);

/**
 * PUT /api/drivers/:id
 * Actualizar chofer
 * Roles permitidos: Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  validate(dv.updateDriverSchema),
  driverController.updateDriver
);

/**
 * DELETE /api/drivers/:id
 * Eliminar chofer (soft delete)
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  driverController.deleteDriver
);

/**
 * GET /api/drivers/:id/assignments
 * Obtener asignaciones de un chofer
 * Roles permitidos: Admin
 */
router.get(
  '/:id/assignments',
  authenticate,
  authorize(['admin']),
  driverController.getDriverAssignments
);

/**
 * POST /api/drivers/:id/assignments
 * Asignar un chofer a un tour/reserva
 * Roles permitidos: Admin
 */
router.post(
  '/:id/assignments',
  authenticate,
  authorize(['admin']),
  validate(dv.assignDriverSchema),
  driverController.assignDriverToTour
);

/**
 * DELETE /api/drivers/:id/assignments/:assignmentId
 * Remover asignación de chofer
 * Roles permitidos: Admin
 */
router.delete(
  '/:id/assignments/:assignmentId',
  authenticate,
  authorize(['admin']),
  driverController.removeDriverAssignment
);

module.exports = router;
