// Routes de Reward Categories
// Fuente: ELM-378 CategoryManager
// Tabla: reward_categories (TBL-009)
// Flujo: FLW-107 Gestionar categorias de premios

const express = require('express');
const router = express.Router();
const rewardCategoryController = require('../controllers/rewardCategoryController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * GET /api/reward-categories
 * Lista todas las categorias de premios activas
 * Roles: Admin, Agency (lectura para filtros)
 * Elemento: ELM-378 CategoryManager
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency']),
  rewardCategoryController.listCategories
);

/**
 * GET /api/reward-categories/:id
 * Obtiene una categoria por ID
 * Roles: Admin
 * Elemento: ELM-378 CategoryManager
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin']),
  rewardCategoryController.getCategory
);

/**
 * POST /api/reward-categories
 * Crea una nueva categoria de premios
 * Roles: Admin
 * Elemento: ELM-378 CategoryManager
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  rewardCategoryController.createCategory
);

/**
 * PUT /api/reward-categories/:id
 * Actualiza una categoria
 * Roles: Admin
 * Elemento: ELM-378 CategoryManager
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  rewardCategoryController.updateCategory
);

/**
 * DELETE /api/reward-categories/:id
 * Elimina una categoria (soft delete)
 * Roles: Admin
 * Elemento: ELM-378 CategoryManager
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  rewardCategoryController.deleteCategory
);

module.exports = router;
