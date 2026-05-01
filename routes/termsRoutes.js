// Routes de Términos y Condiciones
// Rutas públicas para obtener términos
// Rutas protegidas para CRUD (Admin) y aceptación (Usuario)

const express = require('express');
const router = express.Router();
const termsController = require('../controllers/termsController');
const { authenticate, authorize } = require('../middlewares/auth');

// =============================================================================
// RUTAS PÚBLICAS (sin autenticación)
// =============================================================================

/**
 * GET /api/terms/:type/current
 * Obtener términos activos por tipo
 * Público - Para mostrar en modal de registro
 */
router.get('/:type/current', termsController.getCurrentTerms);

/**
 * GET /api/terms/:type/version/:version
 * Obtener una versión específica de términos
 * Público
 */
router.get('/:type/version/:version', termsController.getTermsByVersion);

// =============================================================================
// RUTAS PROTEGIDAS - ADMIN
// =============================================================================

/**
 * GET /api/terms
 * Listar todos los términos
 * Solo Admin
 */
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  termsController.listAllTerms
);

/**
 * POST /api/terms
 * Crear nuevos términos
 * Solo Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  termsController.createTerms
);

/**
 * PUT /api/terms/:id
 * Actualizar términos
 * Solo Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  termsController.updateTerms
);

/**
 * PUT /api/terms/:id/activate
 * Activar una versión de términos
 * Solo Admin
 */
router.put(
  '/:id/activate',
  authenticate,
  authorize(['admin']),
  termsController.activateTerms
);

// =============================================================================
// RUTAS PROTEGIDAS - USUARIO AUTENTICADO
// =============================================================================

/**
 * POST /api/terms/accept
 * Registrar aceptación de términos
 * Usuario autenticado
 */
router.post(
  '/accept',
  authenticate,
  termsController.acceptTerms
);

/**
 * GET /api/terms/acceptance/status
 * Verificar estado de aceptación del usuario
 * Usuario autenticado
 */
router.get(
  '/acceptance/status',
  authenticate,
  termsController.getAcceptanceStatus
);

module.exports = router;
