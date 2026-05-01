// Routes de Ratings
// Fuente: 04_apis_lista.md
// API-051 a API-060: Ratings/Reviews
// Integrado para ELM-352 RatingDashboard

const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * ELM-352: GetDashboardStats
 * GET /api/ratings/dashboard/stats
 * Estadisticas generales para RatingDashboard
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/dashboard/stats',
  authenticate,
  authorize(['admin', 'agency']),
  ratingController.getDashboardStats
);

/**
 * ELM-352: GetRatingAreas
 * GET /api/ratings/areas
 * Estadisticas por area de servicio
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/areas',
  authenticate,
  authorize(['admin', 'agency']),
  ratingController.getRatingAreas
);

/**
 * ELM-352: GetRatingStaff
 * GET /api/ratings/staff
 * Estadisticas de staff/guias
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/staff',
  authenticate,
  authorize(['admin', 'agency']),
  ratingController.getRatingStaff
);

/**
 * ELM-352: GetServiceAreas
 * GET /api/ratings/service-areas
 * Lista de areas de servicio disponibles
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/service-areas',
  authenticate,
  authorize(['admin', 'agency']),
  ratingController.getServiceAreas
);

/**
 * ELM-358: CreateServiceAreaRating
 * POST /api/ratings/service-areas
 * Crea calificacion por areas de servicio (6 areas)
 * FLW-101: Calificar areas de servicio post-tour
 * Roles permitidos: Admin, Agency, Guide
 */
router.post(
  '/service-areas',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  ratingController.createServiceAreaRating
);

/**
 * ELM-352: GetPeriods
 * GET /api/ratings/periods
 * Lista de periodos disponibles para filtros
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/periods',
  authenticate,
  authorize(['admin', 'agency']),
  ratingController.getPeriods
);

/**
 * API-057: ListPendingRatings
 * GET /api/ratings/pending-moderation
 * Roles permitidos: Admin
 */
router.get(
  '/pending-moderation',
  authenticate,
  authorize(['admin']),
  ratingController.listPendingRatings
);

/**
 * API-059: GetRatingSummary
 * GET /api/ratings/summary
 * Roles permitidos: Admin
 */
router.get(
  '/summary',
  authenticate,
  authorize(['admin']),
  ratingController.getRatingSummary
);

/**
 * API-054: UpdateRating
 * PUT /api/ratings/:id
 * Roles permitidos: Admin, Client (solo su propia calificación)
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'agency']),
  ratingController.updateRating
);

/**
 * API-055: DeleteRating
 * DELETE /api/ratings/:id
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  ratingController.deleteRating
);

/**
 * API-056: RespondToRating
 * POST /api/ratings/:id/response
 * Roles permitidos: Guide, Admin
 */
router.post(
  '/:id/response',
  authenticate,
  authorize(['admin', 'guide']),
  ratingController.respondToRating
);

/**
 * API-058: ModerateRating
 * PATCH /api/ratings/:id/moderate
 * Roles permitidos: Admin
 */
router.patch(
  '/:id/moderate',
  authenticate,
  authorize(['admin']),
  ratingController.moderateRating
);

/**
 * ELM-363: CreateTouristRating
 * POST /api/ratings/tourists
 * Crea valoracion de experiencia de turista individual
 * FLW-034, FLW-102: Evaluar experiencia de turistas post-tour
 * Roles permitidos: Admin, Agency, Guide
 */
router.post(
  '/tourists',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  ratingController.createTouristRating
);

/**
 * ELM-363: GetTouristRatings
 * GET /api/ratings/tourists
 * Lista valoraciones de turistas
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/tourists',
  authenticate,
  authorize(['admin', 'agency']),
  ratingController.getTouristRatings
);

module.exports = router;
