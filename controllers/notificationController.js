// Controller de Notifications
// Fuente: 04_apis_lista.md
// API-100 a API-102: Gestión de notificaciones
// IMPORTANTE: Los nombres de columnas siguen el schema Prisma (snake_case)

const prisma = require('../config/db');

/**
 * API-100: ListNotifications
 * GET /api/notifications
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const listNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      type,
      read
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = Math.min(parseInt(pageSize), 50);

    // Construir filtros - USAR nombres de columnas del schema Prisma
    const where = {
      user_id: req.user.id
    };

    if (type) {
      where.notification_type = type;
    }

    if (read !== undefined) {
      where.is_read = read === 'true';
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' }
      }),
      prisma.notifications.count({ where }),
      prisma.notifications.count({
        where: {
          user_id: req.user.id,
          is_read: false
        }
      })
    ]);

    // Mapear a formato de respuesta para el frontend
    const data = notifications.map(n => ({
      id: n.id,
      type: n.notification_type,
      title: n.title,
      message: n.message,
      read: n.is_read,
      actionUrl: n.action_url,
      priority: n.priority,
      referenceType: n.reference_type,
      referenceId: n.reference_id,
      createdAt: n.created_at
    }));

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error en listNotifications:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al listar notificaciones',
      debug: error.message
    });
  }
};

/**
 * API-101: MarkNotificationRead
 * PATCH /api/notifications/:id/read
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la notificación pertenece al usuario
    const notification = await prisma.notifications.findFirst({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Notificación no encontrada'
      });
    }

    // Marcar como leída
    await prisma.notifications.update({
      where: { id },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });

    // Obtener conteo de no leídas restantes
    const unreadCount = await prisma.notifications.count({
      where: {
        user_id: req.user.id,
        is_read: false
      }
    });

    // Emitir evento WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user.id}`).emit('notification:read', {
        notificationId: id,
        timestamp: new Date().toISOString()
      });
      io.to(`user:${req.user.id}`).emit('notification:unread:count', {
        count: unreadCount
      });
    }

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error en markNotificationRead:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al marcar notificación como leída',
      debug: error.message
    });
  }
};

/**
 * API-102: MarkAllNotificationsRead
 * POST /api/notifications/mark-all-read
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await prisma.notifications.updateMany({
      where: {
        user_id: req.user.id,
        is_read: false
      },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });

    // Emitir evento WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user.id}`).emit('notification:all:read', {
        timestamp: new Date().toISOString()
      });
      io.to(`user:${req.user.id}`).emit('notification:unread:count', {
        count: 0
      });
    }

    res.json({
      success: true,
      markedCount: result.count
    });
  } catch (error) {
    console.error('Error en markAllNotificationsRead:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al marcar todas las notificaciones como leídas',
      debug: error.message
    });
  }
};

/**
 * Función auxiliar: CreateNotification
 * Usado internamente para crear notificaciones
 */
const createNotification = async (userId, type, title, message, options = {}) => {
  try {
    const notification = await prisma.notifications.create({
      data: {
        user_id: userId,
        notification_type: type,
        title,
        message,
        action_url: options.actionUrl,
        priority: options.priority || 'normal',
        reference_type: options.referenceType,
        reference_id: options.referenceId,
        is_read: false
      }
    });

    // Emitir notificacion via WebSocket si io esta disponible
    if (options.io) {
      options.io.to(`user:${userId}`).emit('notification:new', {
        id: notification.id,
        type: notification.notification_type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        referenceType: notification.reference_type,
        referenceId: notification.reference_id,
        actionUrl: notification.action_url,
        isRead: notification.is_read,
        createdAt: notification.created_at?.toISOString() || new Date().toISOString()
      });
    }

    return notification;
  } catch (error) {
    console.error('Error creando notificación:', error.message);
    throw error;
  }
};

/**
 * Función auxiliar: GetUnreadCount
 * GET /api/notifications/unread-count
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await prisma.notifications.count({
      where: {
        user_id: req.user.id,
        is_read: false
      }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error en getUnreadCount:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener conteo de notificaciones',
      debug: error.message
    });
  }
};

/**
 * ClearAllNotifications
 * DELETE /api/notifications
 * Elimina todas las notificaciones del usuario
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const clearAllNotifications = async (req, res) => {
  try {
    const result = await prisma.notifications.deleteMany({
      where: {
        user_id: req.user.id
      }
    });

    res.json({
      success: true,
      message: 'Todas las notificaciones eliminadas',
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Error en clearAllNotifications:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar notificaciones',
      debug: error.message
    });
  }
};

/**
 * Función auxiliar: DeleteNotification
 * DELETE /api/notifications/:id
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la notificación pertenece al usuario
    const notification = await prisma.notifications.findFirst({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Notificación no encontrada'
      });
    }

    await prisma.notifications.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Notificación eliminada'
    });
  } catch (error) {
    console.error('Error en deleteNotification:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar notificación',
      debug: error.message
    });
  }
};

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
  createNotification,
  getUnreadCount,
  deleteNotification
};
