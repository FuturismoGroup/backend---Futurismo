// Routes de Users
// Fuente: 04_apis_lista.md
// API-021 a API-030: Users CRUD y operaciones relacionadas

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/auth');

// =====================================================
// RUTAS ESTATICAS (deben ir ANTES de rutas con :id)
// =====================================================

/**
 * ListRoles (complemento para UserFilters ELM-390)
 * GET /api/users/roles/list
 * Roles permitidos: Admin
 * Retorna lista de roles para dropdowns de filtros
 */
router.get(
  '/roles/list',
  authenticate,
  authorize(['admin']),
  userController.listRoles
);

/**
 * API-030: GetUserStats
 * GET /api/users/stats
 * Roles permitidos: Admin
 * Retorna estadisticas agregadas de usuarios por rol
 */
router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  userController.getUserStats
);

/**
 * CheckUnique
 * POST /api/users/check-unique
 * Roles permitidos: Admin
 * Verifica si un username o email ya está en uso
 * Útil para validaciones en tiempo real en formularios
 */
router.post(
  '/check-unique',
  authenticate,
  authorize(['admin']),
  userController.checkUnique
);

/**
 * API-021: ListUsers
 * GET /api/users
 * Roles permitidos: Admin
 */
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  userController.listUsers
);

/**
 * API-023: CreateUser
 * POST /api/users
 * Roles permitidos: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  userController.createUser
);

// =====================================================
// RUTAS CON PARAMETRO :id (deben ir DESPUES de estaticas)
// =====================================================

/**
 * API-022: GetUser
 * GET /api/users/:id
 * Roles permitidos: Admin, Agency (propio)
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency']),
  userController.getUser
);

/**
 * API-024: UpdateUser
 * PUT /api/users/:id
 * Roles permitidos: Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  userController.updateUser
);

/**
 * API-025: DeleteUser
 * DELETE /api/users/:id
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  userController.deleteUser
);

/**
 * API-026: UpdateUserStatus
 * PATCH /api/users/:id/status
 * Roles permitidos: Admin
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  userController.updateUserStatus
);

/**
 * API-027: ResetUserPassword
 * POST /api/users/:id/reset-password
 * Roles permitidos: Admin
 */
router.post(
  '/:id/reset-password',
  authenticate,
  authorize(['admin']),
  userController.resetUserPassword
);

/**
 * API-028: GetUserPermissions
 * GET /api/users/:id/permissions
 * Roles permitidos: Admin
 */
router.get(
  '/:id/permissions',
  authenticate,
  authorize(['admin']),
  userController.getUserPermissions
);

/**
 * API-029: UpdateUserPermissions
 * PUT /api/users/:id/permissions
 * Roles permitidos: Admin
 */
router.put(
  '/:id/permissions',
  authenticate,
  authorize(['admin']),
  userController.updateUserPermissions
);

/**
 * RestoreUser
 * POST /api/users/:id/restore
 * Restaura un usuario eliminado (soft delete)
 * Roles permitidos: Admin
 */
router.post(
  '/:id/restore',
  authenticate,
  authorize(['admin']),
  userController.restoreUser
);

module.exports = router;
