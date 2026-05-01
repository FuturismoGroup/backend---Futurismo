// Routes de Rewards
// Fuente: 04_apis_lista.md
// API-043, API-044, API-047, API-048, API-049: Rewards CRUD
// ELM-378: CategoryManager - FLW-107: Gestionar categorias de premios

const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const rewardCategoryController = require('../controllers/rewardCategoryController');
const { authenticate, authorize } = require('../middlewares/auth');
const { handleUpload } = require('../middlewares/uploadReward');

// ============================================================================
// RUTAS PARA CATEGORIAS DE PREMIOS (reward_categories)
// Tabla: reward_categories (TBL-009)
// IMPORTANTE: Estas rutas DEBEN ir ANTES de las rutas con /:id
// ============================================================================

/**
 * GET /api/rewards/categories
 * Lista todas las categorias de premios activas
 * Roles: Admin, Agency (lectura para filtros ELM-424)
 * Elemento: ELM-378 CategoryManager, ELM-424 Panel filtros
 */
router.get(
  '/categories',
  authenticate,
  authorize(['admin', 'agency']),
  rewardCategoryController.listCategories
);

/**
 * POST /api/rewards/categories
 * Crea una nueva categoria de premios
 * Roles: Admin
 * Elemento: ELM-378 CategoryManager
 */
router.post(
  '/categories',
  authenticate,
  authorize(['admin']),
  rewardCategoryController.createCategory
);

/**
 * GET /api/rewards/categories/:id
 * Obtiene una categoria por ID
 * Roles: Admin
 * Elemento: ELM-378 CategoryManager
 */
router.get(
  '/categories/:id',
  authenticate,
  authorize(['admin']),
  rewardCategoryController.getCategory
);

/**
 * PUT /api/rewards/categories/:id
 * Actualiza una categoria
 * Roles: Admin
 * Elemento: ELM-378 CategoryManager
 */
router.put(
  '/categories/:id',
  authenticate,
  authorize(['admin']),
  rewardCategoryController.updateCategory
);

/**
 * DELETE /api/rewards/categories/:id
 * Elimina una categoria (soft delete)
 * Roles: Admin
 * Elemento: ELM-378 CategoryManager
 */
router.delete(
  '/categories/:id',
  authenticate,
  authorize(['admin']),
  rewardCategoryController.deleteCategory
);

// ============================================================================
// RUTAS PARA REDEMPTIONS (canjes) - Deben ir ANTES de /:id
// Tabla: redemptions (TBL-011)
// ELM-411: RewardsManagement - Tab Canjes
// ============================================================================

/**
 * GET /api/rewards/redemptions
 * Lista todos los canjes del sistema (Admin only)
 * ELM-411 RewardsManagement - Tab Canjes
 */
router.get(
  '/redemptions',
  authenticate,
  authorize(['admin']),
  pointsController.listAllRedemptions
);

/**
 * PATCH /api/rewards/redemptions/:id
 * Actualiza el estado de un canje (Admin only)
 * ELM-411 RewardsManagement - Aprobar/Rechazar/Entregar canjes
 */
router.patch(
  '/redemptions/:id',
  authenticate,
  authorize(['admin']),
  pointsController.updateRedemptionStatus
);

// ============================================================================
// RUTAS PARA REWARDS (premios)
// ============================================================================

/**
 * API-043: ListRewards
 * GET /api/rewards
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency']),
  pointsController.listRewards
);

/**
 * API-044: GetReward
 * GET /api/rewards/:id
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency']),
  pointsController.getReward
);

/**
 * API-047: CreateReward
 * POST /api/rewards
 * Roles permitidos: Admin
 * Soporta upload de imagen via multipart/form-data
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  handleUpload,
  pointsController.createReward
);

/**
 * API-048: UpdateReward
 * PUT /api/rewards/:id
 * Roles permitidos: Admin
 * Soporta upload de imagen via multipart/form-data
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  handleUpload,
  pointsController.updateReward
);

/**
 * API-049: DeleteReward
 * DELETE /api/rewards/:id
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  pointsController.deleteReward
);

module.exports = router;
