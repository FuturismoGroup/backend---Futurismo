// Routes de Feedback
// CRUD para feedback de usuarios
// Tabla: feedback

const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * GET /api/feedback/my
 * Obtiene los feedbacks del usuario autenticado
 * Roles: Admin, Agency, Guide, Tourist
 * NOTA: Debe ir ANTES de /:id
 */
router.get(
  '/my',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'tourist']),
  feedbackController.getMyFeedback
);

/**
 * GET /api/feedback/stats
 * Obtiene estadísticas de feedback
 * Roles: Admin
 * NOTA: Debe ir ANTES de /:id
 */
router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  feedbackController.getFeedbackStats
);

/**
 * GET /api/feedback
 * Lista todos los feedbacks con filtros
 * Query params: type, status, priority, search, from, to
 * Roles: Admin
 */
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  feedbackController.listFeedback
);

/**
 * POST /api/feedback
 * Crea un nuevo feedback
 * Roles: Admin, Agency, Guide, Tourist
 */
router.post(
  '/',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'tourist']),
  feedbackController.createFeedback
);

/**
 * GET /api/feedback/:id
 * Obtiene un feedback por ID
 * Roles: Admin
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin']),
  feedbackController.getFeedback
);

/**
 * PUT /api/feedback/:id
 * Actualiza un feedback
 * Roles: Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  feedbackController.updateFeedback
);

/**
 * PATCH /api/feedback/:id/respond
 * Responde a un feedback
 * Roles: Admin
 */
router.patch(
  '/:id/respond',
  authenticate,
  authorize(['admin']),
  feedbackController.respondToFeedback
);

/**
 * DELETE /api/feedback/:id
 * Elimina un feedback
 * Roles: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  feedbackController.deleteFeedback
);

module.exports = router;
