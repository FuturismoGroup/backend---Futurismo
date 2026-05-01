// Routes de Suggestions
// CRUD para sugerencias
// Tabla: suggestions

const express = require('express');
const router = express.Router();
const suggestionController = require('../controllers/suggestionController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * GET /api/suggestions
 * Lista todas las sugerencias con filtros
 * Query params: status, category, search
 * Roles: Admin, Agency
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency']),
  suggestionController.listSuggestions
);

/**
 * POST /api/suggestions
 * Crea una nueva sugerencia
 * Roles: Admin, Agency, Guide, Tourist
 */
router.post(
  '/',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'tourist']),
  suggestionController.createSuggestion
);

/**
 * GET /api/suggestions/:id
 * Obtiene una sugerencia por ID
 * Roles: Admin, Agency
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency']),
  suggestionController.getSuggestion
);

/**
 * PATCH /api/suggestions/:id/status
 * Actualiza el estado de una sugerencia
 * Roles: Admin
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  suggestionController.updateSuggestionStatus
);

/**
 * POST /api/suggestions/:id/vote
 * Vota por una sugerencia
 * Roles: Admin, Agency, Guide, Tourist
 */
router.post(
  '/:id/vote',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'tourist']),
  suggestionController.voteSuggestion
);

/**
 * DELETE /api/suggestions/:id
 * Elimina una sugerencia
 * Roles: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  suggestionController.deleteSuggestion
);

module.exports = router;
