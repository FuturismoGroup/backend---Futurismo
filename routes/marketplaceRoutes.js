// Routes de Marketplace
// Favoritos y funcionalidades de marketplace de guías
// Tabla: user_favorites

const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const marketplaceController = require('../controllers/marketplaceController');
const serviceRequestController = require('../controllers/serviceRequestController');
const { authenticate, authorize } = require('../middlewares/auth');

// =============================================================================
// GUÍAS FREELANCE
// =============================================================================

/**
 * GET /api/marketplace/guides
 * Lista guías freelance disponibles
 * Roles: Admin, Agency
 */
router.get(
  '/guides',
  authenticate,
  authorize(['admin', 'agency']),
  marketplaceController.listFreelanceGuides
);

/**
 * GET /api/marketplace/guides/:id
 * Obtiene perfil completo de un guía
 * Roles: Admin, Agency, Guide
 */
router.get(
  '/guides/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  marketplaceController.getGuideProfile
);

/**
 * GET /api/marketplace/guides/:id/reviews
 * Obtiene las reseñas de un guía
 * Roles: Admin, Agency
 */
router.get(
  '/guides/:id/reviews',
  authenticate,
  authorize(['admin', 'agency']),
  marketplaceController.getGuideReviews
);

// =============================================================================
// FAVORITOS
// =============================================================================

/**
 * GET /api/marketplace/favorites
 * Lista los guías favoritos del usuario actual
 * Roles: Admin, Agency
 */
router.get(
  '/favorites',
  authenticate,
  authorize(['admin', 'agency']),
  favoriteController.listFavorites
);

/**
 * GET /api/marketplace/favorites/check/:guideId
 * Verifica si un guía es favorito
 * Roles: Admin, Agency
 * NOTA: Debe ir ANTES de /favorites/:guideId
 */
router.get(
  '/favorites/check/:guideId',
  authenticate,
  authorize(['admin', 'agency']),
  favoriteController.checkFavorite
);

/**
 * POST /api/marketplace/favorites/:guideId
 * Añade un guía a favoritos
 * Roles: Admin, Agency
 */
router.post(
  '/favorites/:guideId',
  authenticate,
  authorize(['admin', 'agency']),
  favoriteController.addFavorite
);

/**
 * POST /api/marketplace/favorites/:guideId/toggle
 * Toggle favorito (añade si no existe, elimina si existe)
 * Roles: Admin, Agency
 */
router.post(
  '/favorites/:guideId/toggle',
  authenticate,
  authorize(['admin', 'agency']),
  favoriteController.toggleFavorite
);

/**
 * DELETE /api/marketplace/favorites/:guideId
 * Elimina un guía de favoritos
 * Roles: Admin, Agency
 */
router.delete(
  '/favorites/:guideId',
  authenticate,
  authorize(['admin', 'agency']),
  favoriteController.removeFavorite
);

// =============================================================================
// TARIFA DEL GUÍA
// =============================================================================

/**
 * PUT /api/marketplace/guides/:guideId/rate
 * Actualizar tarifa por persona del guía freelance
 * Roles: Guide (owner), Admin
 */
router.put(
  '/guides/:guideId/rate',
  authenticate,
  authorize(['admin', 'guide']),
  marketplaceController.updateGuideRate
);

/**
 * PUT /api/marketplace/guides/:guideId/online
 * Toggle disponibilidad online/offline del guía freelance
 * Roles: Guide (owner), Admin
 */
router.put(
  '/guides/:guideId/online',
  authenticate,
  authorize(['admin', 'guide']),
  marketplaceController.toggleGuideOnline
);

// =============================================================================
// DISPONIBILIDAD
// =============================================================================

/**
 * GET /api/marketplace/guides/:guideId/check-date-availability
 * Verificar disponibilidad del guía en una fecha
 * Roles: Agency, Admin
 */
router.get(
  '/guides/:guideId/check-date-availability',
  authenticate,
  authorize(['admin', 'agency']),
  serviceRequestController.checkDateAvailability
);

// =============================================================================
// SOLICITUDES DE SERVICIO
// =============================================================================

/**
 * POST /api/marketplace/service-requests
 * Crear solicitud de servicio
 * Roles: Agency, Admin
 */
router.post(
  '/service-requests',
  authenticate,
  authorize(['admin', 'agency']),
  serviceRequestController.createServiceRequest
);

/**
 * GET /api/marketplace/service-requests
 * Listar solicitudes (filtradas por rol)
 * Roles: Agency, Admin, Guide
 */
router.get(
  '/service-requests',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  serviceRequestController.listServiceRequests
);

/**
 * GET /api/marketplace/service-requests/:id
 * Detalle de solicitud
 * Roles: Agency, Admin, Guide
 */
router.get(
  '/service-requests/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  serviceRequestController.getServiceRequestById
);

/**
 * POST /api/marketplace/service-requests/:id/respond
 * Guía acepta o rechaza solicitud
 * Roles: Guide (asignado), Admin
 */
router.post(
  '/service-requests/:id/respond',
  authenticate,
  authorize(['admin', 'guide']),
  serviceRequestController.respondToServiceRequest
);

/**
 * POST /api/marketplace/service-requests/:id/cancel
 * Agencia cancela solicitud
 * Roles: Agency (owner), Admin
 */
router.post(
  '/service-requests/:id/cancel',
  authenticate,
  authorize(['admin', 'agency']),
  serviceRequestController.cancelServiceRequest
);

/**
 * POST /api/marketplace/service-requests/:id/complete
 * Marcar servicio como completado
 * Roles: Agency (owner), Admin
 */
router.post(
  '/service-requests/:id/complete',
  authenticate,
  authorize(['admin', 'agency']),
  serviceRequestController.completeServiceRequest
);

// =============================================================================
// REVIEWS
// =============================================================================

/**
 * POST /api/marketplace/reviews
 * Crear review para un servicio completado
 * Roles: Agency, Admin
 */
router.post(
  '/reviews',
  authenticate,
  authorize(['admin', 'agency']),
  serviceRequestController.createReview
);

module.exports = router;
