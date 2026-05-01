/**
 * Rutas del sistema (admin)
 * Gestión de configuraciones y datos propios de Futurismo Tours
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const systemPaymentMethodController = require('../controllers/systemPaymentMethodController');

// ============================================
// MÉTODOS DE PAGO DEL SISTEMA
// Solo accesibles para administradores
// ============================================

/**
 * GET /api/system/payment-methods
 * Listar todos los métodos de pago del sistema
 */
router.get(
  '/payment-methods',
  authenticate,
  authorize(['admin', 'administrator']),
  systemPaymentMethodController.listSystemPaymentMethods
);

/**
 * POST /api/system/payment-methods
 * Crear nuevo método de pago del sistema
 */
router.post(
  '/payment-methods',
  authenticate,
  authorize(['admin', 'administrator']),
  systemPaymentMethodController.createSystemPaymentMethod
);

/**
 * PUT /api/system/payment-methods/:id
 * Actualizar método de pago del sistema
 */
router.put(
  '/payment-methods/:id',
  authenticate,
  authorize(['admin', 'administrator']),
  systemPaymentMethodController.updateSystemPaymentMethod
);

/**
 * DELETE /api/system/payment-methods/:id
 * Eliminar método de pago del sistema
 */
router.delete(
  '/payment-methods/:id',
  authenticate,
  authorize(['admin', 'administrator']),
  systemPaymentMethodController.deleteSystemPaymentMethod
);

/**
 * PATCH /api/system/payment-methods/:id/toggle
 * Activar/desactivar método de pago del sistema
 */
router.patch(
  '/payment-methods/:id/toggle',
  authenticate,
  authorize(['admin', 'administrator']),
  systemPaymentMethodController.toggleSystemPaymentMethod
);

module.exports = router;
