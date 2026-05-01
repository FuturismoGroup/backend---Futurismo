// Routes de Evaluaciones de Staff
// ELM-361: StaffEvaluation
// FLW-035: Evaluar personal de la agencia
// Fuente: Integracion directa para useStaffEvaluation hook

const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * GET /api/evaluations/criteria
 * Obtiene los criterios de evaluacion activos
 * Roles permitidos: Admin, Agency (supervisores)
 */
router.get(
  '/criteria',
  authenticate,
  authorize(['admin', 'agency']),
  evaluationController.getCriteria
);

/**
 * GET /api/evaluations/recommendations
 * Obtiene las opciones de recomendacion activas
 * Roles permitidos: Admin, Agency (supervisores)
 */
router.get(
  '/recommendations',
  authenticate,
  authorize(['admin', 'agency']),
  evaluationController.getRecommendations
);

/**
 * POST /api/evaluations/staff
 * Crea una nueva evaluacion de staff
 * Roles permitidos: Admin, Agency (supervisores)
 */
router.post(
  '/staff',
  authenticate,
  authorize(['admin', 'agency']),
  evaluationController.createStaffEvaluation
);

/**
 * GET /api/evaluations/staff/:guideId
 * Obtiene las evaluaciones de un guia especifico
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/staff/:guideId',
  authenticate,
  authorize(['admin', 'agency']),
  evaluationController.getStaffEvaluations
);

/**
 * GET /api/evaluations/staff/:guideId/summary
 * Obtiene resumen de evaluaciones de un guia
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/staff/:guideId/summary',
  authenticate,
  authorize(['admin', 'agency']),
  evaluationController.getStaffEvaluationSummary
);

module.exports = router;
