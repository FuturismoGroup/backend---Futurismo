// Routes de Agencies
// Fuente: 04_apis_lista.md
// API-031 a API-035: Agencies CRUD

const express = require('express');
const router = express.Router();
const agencyController = require('../controllers/agencyController');
const agencyPaymentMethodController = require('../controllers/agencyPaymentMethodController');
const pointsController = require('../controllers/pointsController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * API-031: ListAgencies
 * GET /api/agencies
 * Roles permitidos: Admin
 */
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  agencyController.listAgencies
);

/**
 * API-032: GetAgency
 * GET /api/agencies/:id
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency']),
  agencyController.getAgency
);

/**
 * API-033: CreateAgency
 * POST /api/agencies
 * Roles permitidos: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  agencyController.createAgency
);

/**
 * API-034: UpdateAgency
 * PUT /api/agencies/:id
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'agency']),
  agencyController.updateAgency
);

/**
 * DELETE /api/agencies/:id
 * ELM-480: Delete Confirmation Modal - Elimina (soft delete) una agencia
 * FLW-139: Eliminar cliente (aplica tambien a agencias)
 * No se puede eliminar si tiene reservas activas (pending/confirmed)
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  agencyController.deleteAgency
);

/**
 * PATCH /api/agencies/:id/status
 * Actualizar estado de agencia
 * Roles permitidos: Admin
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  agencyController.updateAgencyStatus
);

/**
 * GET /api/agencies/:id/stats
 * Estadísticas de la agencia
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/:id/stats',
  authenticate,
  authorize(['admin', 'agency']),
  agencyController.getAgencyStats
);

/**
 * API-035: GetAgencyReservations
 * GET /api/agencies/:id/reservations
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:id/reservations',
  authenticate,
  authorize(['admin', 'agency']),
  agencyController.getAgencyReservations
);

/**
 * GetAgencyMonthlyReport
 * GET /api/agencies/:id/reports/monthly
 * FLW-132: Genera reporte mensual de ventas para una agencia
 * Usado por ELM-450 (Date Navigation Panel), ELM-447 (AgencyReports)
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:id/reports/monthly',
  authenticate,
  authorize(['admin', 'agency']),
  agencyController.getAgencyMonthlyReport
);

/**
 * GetAgencyYearlyReport
 * GET /api/agencies/:id/reports/yearly
 * FLW-132: Genera reporte anual de ventas para una agencia (comparativo mensual)
 * Usado por ELM-450 (Date Navigation Panel), ELM-447 (AgencyReports)
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:id/reports/yearly',
  authenticate,
  authorize(['admin', 'agency']),
  agencyController.getAgencyYearlyReport
);

/**
 * GET /api/agencies/:agencyId/payment-methods
 * Lista métodos de pago de la agencia
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:agencyId/payment-methods',
  authenticate,
  authorize(['admin', 'agency']),
  agencyPaymentMethodController.listAgencyPaymentMethods
);

/**
 * POST /api/agencies/:agencyId/payment-methods
 * Crear método de pago para la agencia
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.post(
  '/:agencyId/payment-methods',
  authenticate,
  authorize(['admin', 'agency']),
  agencyPaymentMethodController.createAgencyPaymentMethod
);

/**
 * PUT /api/agencies/:agencyId/payment-methods/:id
 * Actualizar método de pago
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.put(
  '/:agencyId/payment-methods/:id',
  authenticate,
  authorize(['admin', 'agency']),
  agencyPaymentMethodController.updateAgencyPaymentMethod
);

/**
 * DELETE /api/agencies/:agencyId/payment-methods/:id
 * Eliminar método de pago
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.delete(
  '/:agencyId/payment-methods/:id',
  authenticate,
  authorize(['admin', 'agency']),
  agencyPaymentMethodController.deleteAgencyPaymentMethod
);

/**
 * PATCH /api/agencies/:agencyId/payment-methods/:id/toggle
 * Toggle activar/desactivar método de pago
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.patch(
  '/:agencyId/payment-methods/:id/toggle',
  authenticate,
  authorize(['admin', 'agency']),
  agencyPaymentMethodController.toggleAgencyPaymentMethod
);

/**
 * API-041: GetAgencyPoints
 * GET /api/agencies/:id/points
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:id/points',
  authenticate,
  authorize(['admin', 'agency']),
  pointsController.getAgencyPoints
);

/**
 * GET /api/agencies/:id/points/balance
 * Alias for GetAgencyPoints - frontend compatibility
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:id/points/balance',
  authenticate,
  authorize(['admin', 'agency']),
  pointsController.getAgencyPoints
);

/**
 * API-042: GetPointsTransactions
 * GET /api/agencies/:id/points/transactions
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:id/points/transactions',
  authenticate,
  authorize(['admin', 'agency']),
  pointsController.getPointsTransactions
);

/**
 * API-045: RedeemReward
 * POST /api/agencies/:agencyId/points/redeem
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.post(
  '/:agencyId/points/redeem',
  authenticate,
  authorize(['admin', 'agency']),
  pointsController.redeemReward
);

/**
 * API-046: GetRedemptions
 * GET /api/agencies/:id/redemptions
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
router.get(
  '/:id/redemptions',
  authenticate,
  authorize(['admin', 'agency']),
  pointsController.getRedemptions
);

/**
 * ELM-414: AddPointsToAgency
 * POST /api/agencies/:id/points
 * FLW-021, FLW-125: Asignar puntos manualmente a una agencia
 * Roles permitidos: Admin
 */
router.post(
  '/:id/points',
  authenticate,
  authorize(['admin']),
  pointsController.addPointsToAgency
);

module.exports = router;
