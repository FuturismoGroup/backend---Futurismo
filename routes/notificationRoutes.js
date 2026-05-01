// Routes de Notifications
// Fuente: 04_apis_lista.md
// API-100 a API-102: Gestión de notificaciones

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * API-100: ListNotifications
 * GET /api/notifications
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  notificationController.listNotifications
);

/**
 * Alias: ListNotificationsByUser
 * GET /api/notifications/user/:userId
 * Alias para compatibilidad con frontend (usa el mismo handler)
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.get(
  '/user/:userId',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  notificationController.listNotifications
);

/**
 * API-102: MarkAllNotificationsRead
 * POST /api/notifications/mark-all-read
 * Roles permitidos: Admin, Agency, Guide, Client
 * NOTA: Debe ir ANTES de /:id
 */
router.post(
  '/mark-all-read',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  notificationController.markAllNotificationsRead
);

/**
 * Auxiliar: GetUnreadCount
 * GET /api/notifications/unread-count
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.get(
  '/unread-count',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  notificationController.getUnreadCount
);

/**
 * ClearAllNotifications
 * DELETE /api/notifications/all
 * Elimina todas las notificaciones del usuario
 * Roles permitidos: Admin, Agency, Guide, Client
 * NOTA: Debe ir ANTES de /:id
 */
router.delete(
  '/all',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  notificationController.clearAllNotifications
);

/**
 * API-101: MarkNotificationRead
 * PATCH /api/notifications/:id/read
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.patch(
  '/:id/read',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  notificationController.markNotificationRead
);

/**
 * Auxiliar: DeleteNotification
 * DELETE /api/notifications/:id
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  notificationController.deleteNotification
);

module.exports = router;
