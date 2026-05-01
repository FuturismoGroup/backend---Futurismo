// Routes de Tours
// Fuente: 04_apis_lista.md
// API-008: GET /api/tours (ListTours)
// API-009: GET /api/tours/:id (GetTour)
// API-010: POST /api/tours (CreateTour)
// API-011: PUT /api/tours/:id (UpdateTour)
// API-012: DELETE /api/tours/:id (DeleteTour)

const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tourController');
const ratingController = require('../controllers/ratingController');
const tourProgressController = require('../controllers/tourProgressController');
const tourPhotoController = require('../controllers/tourPhotoController');
const { authenticate, authorize } = require('../middlewares/auth');
const { handleSingleUpload, handleMultipleUpload } = require('../middlewares/uploadTourPhoto');

/**
 * GET /api/tours/categories
 * Obtiene categorías de tours disponibles
 * Roles permitidos: Admin, Agency, Guide
 * NOTA: Debe ir ANTES de /:id genérico
 */
router.get(
  '/categories',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  tourController.getTourCategories
);

/**
 * GET /api/tours/statistics
 * Estadísticas de tours
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/statistics',
  authenticate,
  authorize(['admin', 'agency']),
  tourController.getTourStatistics
);

/**
 * GET /api/tours/available
 * Tours activos disponibles
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/available',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  tourController.getAvailableTours
);

/**
 * GET /api/tours/search
 * Buscar tours
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/search',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  tourController.searchTours
);

/**
 * GET /api/tours/languages
 * Idiomas disponibles para tours
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/languages',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  tourController.getTourLanguages
);

/**
 * GET /api/tours/guide-tours
 * Tours asignados al guía actual
 * Roles permitidos: Guide
 */
router.get(
  '/guide-tours',
  authenticate,
  authorize(['guide']),
  tourController.getGuideTours
);

/**
 * API-008: ListTours
 * GET /api/tours
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  tourController.listTours
);

/**
 * API-010: CreateTour
 * POST /api/tours
 * Roles permitidos: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  tourController.createTour
);

/**
 * API-009: GetTour
 * GET /api/tours/:id
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  tourController.getTour
);

/**
 * API-011: UpdateTour
 * PUT /api/tours/:id
 * Roles permitidos: Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  tourController.updateTour
);

/**
 * API-012: DeleteTour
 * DELETE /api/tours/:id
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  tourController.deleteTour
);

/**
 * PUT /api/tours/:id/toggle-status
 * Activa/desactiva un tour
 * Roles permitidos: Admin
 */
router.put(
  '/:id/toggle-status',
  authenticate,
  authorize(['admin']),
  tourController.toggleTourStatus
);

/**
 * PUT /api/tours/:id/status
 * Actualizar estado de un tour
 * Roles permitidos: Admin
 */
router.put(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  tourController.updateTourStatus
);

/**
 * POST /api/tours/:id/duplicate
 * Duplicar un tour
 * Roles permitidos: Admin
 */
router.post(
  '/:id/duplicate',
  authenticate,
  authorize(['admin']),
  tourController.duplicateTour
);

/**
 * GET /api/tours/:id/availability
 * Disponibilidad de un tour
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/:id/availability',
  authenticate,
  authorize(['admin', 'agency']),
  tourController.getTourAvailability
);

/**
 * GET /api/tours/:id/available-guides
 * Guías disponibles para un tour
 * Roles permitidos: Admin
 */
router.get(
  '/:id/available-guides',
  authenticate,
  authorize(['admin']),
  tourController.getAvailableGuidesForTour
);

/**
 * POST /api/tours/:id/assign-guide
 * Asigna un guía a un tour
 * Roles permitidos: Admin
 */
router.post(
  '/:id/assign-guide',
  authenticate,
  authorize(['admin']),
  tourController.assignGuideToTour
);

/**
 * POST /api/tours/:id/assign-driver
 * Asigna un chofer a un tour
 * Roles permitidos: Admin
 */
router.post(
  '/:id/assign-driver',
  authenticate,
  authorize(['admin']),
  tourController.assignDriverToTour
);

/**
 * POST /api/tours/:id/assign-vehicle
 * Asigna un vehículo a un tour
 * Roles permitidos: Admin
 */
router.post(
  '/:id/assign-vehicle',
  authenticate,
  authorize(['admin']),
  tourController.assignVehicleToTour
);

/**
 * DELETE /api/tours/:id/assignments/:type
 * Remueve una asignación del tour (guide, driver, vehicle)
 * Roles permitidos: Admin
 */
router.delete(
  '/:id/assignments/:type',
  authenticate,
  authorize(['admin']),
  tourController.removeAssignment
);

/**
 * GET /api/tours/assignments/pending
 * Lista reservas con asignaciones pendientes o parciales
 * Roles permitidos: Admin
 * NOTA: Esta ruta debe ir ANTES de /:id para evitar conflictos
 */
router.get(
  '/assignments/pending',
  authenticate,
  authorize(['admin']),
  tourController.getPendingAssignments
);

/**
 * GET /api/tours/reservations/:reservationId/assignment-pdf
 * Genera datos para PDF de asignación completa
 * Roles permitidos: Admin
 */
router.get(
  '/reservations/:reservationId/assignment-pdf',
  authenticate,
  authorize(['admin']),
  tourController.generateAssignmentPDF
);

/**
 * API-052: ListTourRatings
 * GET /api/tours/:id/ratings
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id/ratings',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  ratingController.listTourRatings
);

// =============================================================================
// TOUR PROGRESS (tours activos)
// =============================================================================

/**
 * GetTourProgress
 * GET /api/tours/:id/progress
 * Obtiene progreso de un tour activo
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id/progress',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  tourProgressController.getTourProgress
);

/**
 * CheckInTourStop
 * POST /api/tours/:id/stops/:stopId/checkin
 * Marca llegada a una parada
 * Roles permitidos: Guide
 */
router.post(
  '/:id/stops/:stopId/checkin',
  authenticate,
  authorize(['guide']),
  tourProgressController.checkInTourStop
);

/**
 * CheckOutTourStop
 * POST /api/tours/:id/stops/:stopId/checkout
 * Marca salida de una parada
 * Roles permitidos: Guide
 */
router.post(
  '/:id/stops/:stopId/checkout',
  authenticate,
  authorize(['guide']),
  tourProgressController.checkOutTourStop
);

/**
 * UpdateTourStopStatus
 * PATCH /api/tours/:id/stops/:stopId
 * Actualiza estado de una parada
 * Roles permitidos: Guide
 */
router.patch(
  '/:id/stops/:stopId',
  authenticate,
  authorize(['guide']),
  tourProgressController.updateTourStopStatus
);

/**
 * ReportTourIncident
 * POST /api/tours/:id/incidents
 * Reporta un incidente durante el tour
 * Roles permitidos: Guide
 */
router.post(
  '/:id/incidents',
  authenticate,
  authorize(['guide']),
  tourProgressController.reportTourIncident
);

/**
 * CompleteTour
 * POST /api/tours/:id/complete
 * Marca un tour activo como completado
 * Roles permitidos: Guide, Admin
 */
router.post(
  '/:id/complete',
  authenticate,
  authorize(['guide', 'admin']),
  tourProgressController.completeTour
);

// =====================================================
// TOUR PHOTOS - Subida y gestión de fotos
// =====================================================

/**
 * GetTourPhotos
 * GET /api/tours/:tourId/photos
 * Obtiene fotos de un tour activo
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:tourId/photos',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  tourPhotoController.getTourPhotos
);

/**
 * UploadTourPhoto
 * POST /api/tours/:tourId/photos
 * Sube una foto a un tour activo (archivo físico)
 * Roles permitidos: Guide
 */
router.post(
  '/:tourId/photos',
  authenticate,
  authorize(['guide']),
  handleSingleUpload,
  tourPhotoController.uploadTourPhoto
);

/**
 * UploadMultipleTourPhotos
 * POST /api/tours/:tourId/photos/batch
 * Sube múltiples fotos a un tour activo
 * Roles permitidos: Guide
 */
router.post(
  '/:tourId/photos/batch',
  authenticate,
  authorize(['guide']),
  handleMultipleUpload,
  tourPhotoController.uploadMultipleTourPhotos
);

/**
 * DeleteTourPhoto
 * DELETE /api/tours/:tourId/photos/:photoId
 * Elimina una foto de un tour
 * Roles permitidos: Guide (propia), Admin
 */
router.delete(
  '/:tourId/photos/:photoId',
  authenticate,
  authorize(['guide', 'admin']),
  tourPhotoController.deleteTourPhoto
);

/**
 * AddStopComment
 * POST /api/tours/:tourId/stops/:stopId/comments
 * Agrega un comentario/nota a una parada
 * Roles permitidos: Guide
 */
router.post(
  '/:tourId/stops/:stopId/comments',
  authenticate,
  authorize(['guide']),
  tourPhotoController.addStopComment
);

module.exports = router;
