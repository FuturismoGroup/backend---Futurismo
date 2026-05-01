// Handler de notificaciones para Socket.io
// Emite notificaciones en tiempo real a usuarios

/**
 * Emite una notificacion a un usuario especifico
 * @param {Server} io - Instancia de Socket.io
 * @param {string} userId - ID del usuario destino
 * @param {Object} notification - Datos de la notificacion
 */
const emitNotification = (io, userId, notification) => {
  if (!io || !userId || !notification) return;

  io.to(`user:${userId}`).emit('notification:new', {
    id: notification.id,
    type: notification.notification_type || notification.type,
    title: notification.title,
    message: notification.message,
    priority: notification.priority || 'normal',
    referenceType: notification.reference_type || notification.referenceType,
    referenceId: notification.reference_id || notification.referenceId,
    actionUrl: notification.action_url || notification.actionUrl,
    isRead: notification.is_read || false,
    createdAt: notification.created_at?.toISOString() || new Date().toISOString()
  });
};

/**
 * Emite una notificacion a multiples usuarios
 * @param {Server} io - Instancia de Socket.io
 * @param {string[]} userIds - Array de IDs de usuarios
 * @param {Object} notification - Datos de la notificacion
 */
const emitNotificationToMany = (io, userIds, notification) => {
  if (!io || !userIds || !notification) return;

  for (const userId of userIds) {
    emitNotification(io, userId, notification);
  }
};

/**
 * Emite actualizacion de contador de notificaciones no leidas
 * @param {Server} io - Instancia de Socket.io
 * @param {string} userId - ID del usuario
 * @param {number} count - Contador de no leidas
 */
const emitUnreadNotificationCount = (io, userId, count) => {
  if (!io || !userId) return;

  io.to(`user:${userId}`).emit('notification:unread:count', {
    count,
    timestamp: new Date().toISOString()
  });
};

/**
 * Emite que una notificacion fue marcada como leida
 * @param {Server} io - Instancia de Socket.io
 * @param {string} userId - ID del usuario
 * @param {string} notificationId - ID de la notificacion
 */
const emitNotificationRead = (io, userId, notificationId) => {
  if (!io || !userId || !notificationId) return;

  io.to(`user:${userId}`).emit('notification:read', {
    notificationId,
    timestamp: new Date().toISOString()
  });
};

/**
 * Emite que todas las notificaciones fueron marcadas como leidas
 * @param {Server} io - Instancia de Socket.io
 * @param {string} userId - ID del usuario
 */
const emitAllNotificationsRead = (io, userId) => {
  if (!io || !userId) return;

  io.to(`user:${userId}`).emit('notification:all:read', {
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  emitNotification,
  emitNotificationToMany,
  emitUnreadNotificationCount,
  emitNotificationRead,
  emitAllNotificationsRead
};
