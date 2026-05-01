// Routes de Languages
// Gestión de idiomas del sistema
// Tabla: languages
// Los idiomas se usan en guides y agencies (specializations)

const express = require('express');
const router = express.Router();
const languageController = require('../controllers/languageController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { language: lv } = require('../validations');

// ============================================================================
// RUTAS PÚBLICAS
// Estas rutas NO requieren autenticación (para formularios públicos)
// ============================================================================

/**
 * GET /api/languages
 * Lista todos los idiomas
 * Público (sin autenticación)
 * Usado en formularios de registro de guías/agencias
 */
router.get(
  '/',
  languageController.getAllLanguages
);

/**
 * GET /api/languages/active
 * Lista solo idiomas activos
 * Público (sin autenticación)
 * Usado en formularios y filtros del frontend
 * IMPORTANTE: Esta ruta debe ir ANTES de /:id
 */
router.get(
  '/active',
  languageController.getActiveLanguages
);

// ============================================================================
// RUTAS PROTEGIDAS - ADMIN
// Estas rutas requieren autenticación y rol de administrador
// ============================================================================

/**
 * POST /api/languages
 * Crea un nuevo idioma
 * Roles: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  validate(lv.createLanguageSchema),
  languageController.createLanguage
);

/**
 * GET /api/languages/:id
 * Obtiene un idioma por ID
 * Roles: Admin
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin']),
  languageController.getLanguageById
);

/**
 * PUT /api/languages/:id
 * Actualiza un idioma
 * Roles: Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  validate(lv.updateLanguageSchema),
  languageController.updateLanguage
);

/**
 * DELETE /api/languages/:id
 * Elimina un idioma (soft delete)
 * Roles: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  languageController.deleteLanguage
);

/**
 * PATCH /api/languages/:id/toggle
 * Alterna el estado activo/inactivo de un idioma
 * Roles: Admin
 * IMPORTANTE: Esta ruta debe ir DESPUÉS de las rutas específicas pero ANTES de /:id genérico
 */
router.patch(
  '/:id/toggle',
  authenticate,
  authorize(['admin']),
  languageController.toggleLanguageStatus
);

module.exports = router;
