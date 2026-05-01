// Routes de Guides
// Fuente: 04_apis_lista.md
// API-013: GET /api/guides (ListGuides)
// API-014: GET /api/guides/:id (GetGuide)
// API-015: PUT /api/guides/:id (UpdateGuide)
// API-016: GET /api/guides/:id/availability (GetGuideAvailability)
// API-017: PUT /api/guides/:id/availability (UpdateGuideAvailability)
// API-020: POST /api/guides/:guideId/tours (AssignTourToGuide)

const express = require('express');
const router = express.Router();
const guideController = require('../controllers/guideController');
const ratingController = require('../controllers/ratingController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * API-013: ListGuides
 * GET /api/guides
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency']),
  guideController.listGuides
);

/**
 * POST /api/guides
 * Crear nuevo guía
 * Roles permitidos: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  guideController.createGuide
);

/**
 * GET /api/guides/summary
 * Resumen de guías
 * Roles permitidos: Admin, Agency
 * NOTA: Debe ir ANTES de /:id
 */
router.get(
  '/summary',
  authenticate,
  authorize(['admin', 'agency']),
  guideController.getGuidesSummary
);

/**
 * POST /api/guides/check-availability
 * Verificar disponibilidad de guías
 * Roles permitidos: Admin, Agency
 * NOTA: Debe ir ANTES de /:id
 */
router.post(
  '/check-availability',
  authenticate,
  authorize(['admin', 'agency']),
  guideController.checkGuidesAvailability
);

/**
 * API-014: GetGuide
 * GET /api/guides/:id
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  guideController.getGuide
);

/**
 * API-015: UpdateGuide
 * PUT /api/guides/:id
 * Roles permitidos: Admin, Guide (solo su propio perfil)
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'guide']),
  guideController.updateGuide
);

/**
 * DeleteGuide
 * DELETE /api/guides/:id
 * Elimina (soft delete) un guía
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  guideController.deleteGuide
);

/**
 * PATCH /api/guides/:id/status
 * Actualizar estado del guía
 * Roles permitidos: Admin
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  guideController.updateGuideStatus
);

/**
 * GET /api/guides/:id/stats
 * Estadísticas del guía
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id/stats',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  guideController.getGuideStats
);

/**
 * API-107: GetGuideSchedule
 * GET /api/guides/:id/schedule
 * Roles permitidos: Admin, Guide
 * NOTA: Debe ir ANTES de /:id genérico
 */
router.get(
  '/:id/schedule',
  authenticate,
  authorize(['admin', 'guide']),
  guideController.getGuideSchedule
);

/**
 * API-020: AssignTourToGuide
 * POST /api/guides/:guideId/tours
 * Roles permitidos: Admin
 */
router.post(
  '/:guideId/tours',
  authenticate,
  authorize(['admin']),
  guideController.assignTourToGuide
);

/**
 * API-051: ListGuideRatings
 * GET /api/guides/:id/ratings
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id/ratings',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  ratingController.listGuideRatings
);

/**
 * API-060: GetGuideRatingStats
 * GET /api/guides/:id/rating-stats
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id/rating-stats',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  ratingController.getGuideRatingStats
);

// =============================================================================
// PERSONAL EVENTS CRUD - ELM-031, ELM-032, ELM-033
// Endpoints para gestionar eventos personales del guía (agenda independiente)
// =============================================================================

/**
 * GET /api/guides/:guideId/personal-events
 * Lista eventos personales de un guía
 * Roles: Admin, Guide (solo sus propios eventos), Agency (lectura para calendario marketplace)
 */
router.get(
  '/:guideId/personal-events',
  authenticate,
  authorize(['admin', 'guide', 'agency']),
  guideController.getPersonalEvents
);

/**
 * POST /api/guides/:guideId/personal-events
 * Crea un nuevo evento personal
 * Roles: Admin, Guide (solo sus propios eventos)
 */
router.post(
  '/:guideId/personal-events',
  authenticate,
  authorize(['admin', 'guide']),
  guideController.createPersonalEvent
);

/**
 * PUT /api/guides/:guideId/personal-events/:eventId
 * Actualiza un evento personal existente
 * Roles: Admin, Guide (solo sus propios eventos)
 */
router.put(
  '/:guideId/personal-events/:eventId',
  authenticate,
  authorize(['admin', 'guide']),
  guideController.updatePersonalEvent
);

/**
 * DELETE /api/guides/:guideId/personal-events/:eventId
 * Elimina un evento personal - ELM-031
 * Roles: Admin, Guide (solo sus propios eventos)
 */
router.delete(
  '/:guideId/personal-events/:eventId',
  authenticate,
  authorize(['admin', 'guide']),
  guideController.deletePersonalEvent
);

/**
 * POST /api/guides/:guideId/occupied-time
 * Marca un bloque de tiempo como ocupado
 * Roles: Admin, Guide (solo su propio tiempo)
 */
router.post(
  '/:guideId/occupied-time',
  authenticate,
  authorize(['admin', 'guide']),
  guideController.markTimeAsOccupied
);

/**
 * GET /api/guides/:guideId/working-hours
 * Obtiene el horario laboral del guía
 * Roles: Admin, Guide (solo su propio horario)
 * ELM-080: WorkingHoursModal
 */
router.get(
  '/:guideId/working-hours',
  authenticate,
  authorize(['admin', 'guide', 'agency']),
  guideController.getWorkingHours
);

/**
 * PUT /api/guides/:guideId/working-hours
 * Actualiza el horario laboral del guía
 * Roles: Admin, Guide (solo su propio horario)
 * ELM-080, ELM-082: WorkingHoursModal
 */
router.put(
  '/:guideId/working-hours',
  authenticate,
  authorize(['admin', 'guide']),
  guideController.updateWorkingHours
);

/**
 * GET /api/guides/:guideId/complete-agenda
 * Obtiene la agenda completa del guía (eventos personales + tours asignados)
 * Roles: Admin, Guide (solo su propia agenda)
 * ELM-090: DayView, ELM-095: MonthView, ELM-100: WeekView
 */
router.get(
  '/:guideId/complete-agenda',
  authenticate,
  authorize(['admin', 'guide']),
  guideController.getCompleteAgenda
);

module.exports = router;
