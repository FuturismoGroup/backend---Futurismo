// Indice de handlers de Socket.io
// Exporta todos los handlers para uso en controladores

const chatHandler = require('./handlers/chatHandler');
const notificationHandler = require('./handlers/notificationHandler');
const monitoringHandler = require('./handlers/monitoringHandler');

module.exports = {
  // Chat handlers
  emitNewMessage: chatHandler.emitNewMessage,
  emitMessageStatus: chatHandler.emitMessageStatus,
  emitUnreadUpdate: chatHandler.emitUnreadUpdate,

  // Notification handlers
  emitNotification: notificationHandler.emitNotification,
  emitNotificationToMany: notificationHandler.emitNotificationToMany,
  emitUnreadNotificationCount: notificationHandler.emitUnreadNotificationCount,
  emitNotificationRead: notificationHandler.emitNotificationRead,
  emitAllNotificationsRead: notificationHandler.emitAllNotificationsRead,

  // Monitoring handlers
  emitLocationUpdate: monitoringHandler.emitLocationUpdate,
  emitTourStatusChange: monitoringHandler.emitTourStatusChange
};
