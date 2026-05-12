// Routes de Reservations
// Fuente: 04_apis_lista.md
// API-001: GET /api/reservations (ListReservations)
// API-002: GET /api/reservations/:id (GetReservation)
// API-003: POST /api/reservations (CreateReservation)
// API-004: PATCH /api/reservations/:id (UpdateReservation)
// API-005: PATCH /api/reservations/:id/status (UpdateReservationStatus)
// API-006: GET /api/reservations/export (ExportReservations)
// API-007: PATCH /api/reservations/:id/assign-guide (AssignGuideToReservation)

const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const ratingController = require('../controllers/ratingController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { reservation: rv } = require('../validations');

/**
 * API-001: ListReservations
 * GET /api/reservations
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  reservationController.listReservations
);

/**
 * API-006: ExportReservations
 * GET /api/reservations/export
 * Roles permitidos: Admin, Agency
 * NOTA: Debe ir ANTES de /:id
 */
router.get(
  '/export',
  authenticate,
  authorize(['admin', 'agency']),
  reservationController.exportReservations
);

/**
 * GET /api/reservations/stats
 * Estadísticas de reservaciones
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/stats',
  authenticate,
  authorize(['admin', 'agency']),
  reservationController.getReservationStats
);

/**
 * GET /api/reservations/search
 * Buscar reservaciones
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/search',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  reservationController.searchReservations
);

/**
 * GET /api/reservations/available-tours
 * Tours disponibles para una fecha
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/available-tours',
  authenticate,
  authorize(['admin', 'agency']),
  reservationController.getAvailableTours
);

/**
 * POST /api/reservations/check-availability
 * Verificar disponibilidad
 * Roles permitidos: Admin, Agency
 */
router.post(
  '/check-availability',
  authenticate,
  authorize(['admin', 'agency']),
  validate(rv.checkAvailabilitySchema),
  reservationController.checkAvailability
);

/**
 * API-108: BulkUpdateReservationStatus
 * POST /api/reservations/bulk-status
 * Roles permitidos: Admin
 * NOTA: Debe ir ANTES de /:id
 */
router.post(
  '/bulk-status',
  authenticate,
  authorize(['admin']),
  reservationController.bulkUpdateReservationStatus
);

/**
 * API-003: CreateReservation
 * POST /api/reservations
 * Roles permitidos: Admin, Agency
 */
router.post(
  '/',
  authenticate,
  authorize(['admin', 'agency']),
  validate(rv.createReservationSchema),
  reservationController.createReservation
);

/**
 * API-005: UpdateReservationStatus
 * PATCH /api/reservations/:id/status
 * Roles permitidos:
 *   - Admin: cualquier transición permitida
 *   - Guide: solo iniciar/completar sus propios tours
 *   - Agency: solo cancelar SUS PROPIAS reservas (el controller hace el guard)
 * NOTA: Debe ir ANTES de /:id genérico
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin', 'guide', 'agency']),
  validate(rv.updateStatusSchema),
  reservationController.updateReservationStatus
);

/**
 * API-007: AssignGuideToReservation
 * PATCH /api/reservations/:id/assign-guide
 * Roles permitidos: Admin
 * NOTA: Debe ir ANTES de /:id genérico
 */
router.patch(
  '/:id/assign-guide',
  authenticate,
  authorize(['admin']),
  validate(rv.assignGuideSchema),
  reservationController.assignGuideToReservation
);

/**
 * GET /api/reservations/:id/voucher
 * Generar voucher de reservación
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/:id/voucher',
  authenticate,
  authorize(['admin', 'agency']),
  reservationController.getVoucher
);

/**
 * POST /api/reservations/:id/duplicate
 * Duplicar reservación
 * Roles permitidos: Admin, Agency
 */
router.post(
  '/:id/duplicate',
  authenticate,
  authorize(['admin', 'agency']),
  reservationController.duplicateReservation
);

/**
 * API-053: CreateRating
 * POST /api/reservations/:reservationId/rating
 * Roles permitidos: Admin, Agency, Client
 */
router.post(
  '/:reservationId/rating',
  authenticate,
  authorize(['admin', 'agency']),
  ratingController.createRating
);

/**
 * GetExecutionHistory
 * GET /api/reservations/:id/execution-history
 * Historial completo de ejecución del servicio (paradas, fotos, notas)
 * Roles permitidos: Admin, Agency
 * NOTA: Debe ir ANTES de /:id genérico
 */
router.get(
  '/:id/execution-history',
  authenticate,
  authorize(['admin', 'agency']),
  reservationController.getExecutionHistory
);

/**
 * API-002: GetReservation
 * GET /api/reservations/:id
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  reservationController.getReservation
);

/**
 * API-004: UpdateReservation
 * PATCH /api/reservations/:id
 * Roles permitidos: Admin, Agency
 */
router.patch(
  '/:id',
  authenticate,
  authorize(['admin', 'agency']),
  validate(rv.updateReservationSchema),
  reservationController.updateReservation
);

module.exports = router;
