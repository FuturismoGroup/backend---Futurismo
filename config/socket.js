// Configuracion de Socket.io para tiempo real
// Maneja autenticacion JWT, tracking de usuarios online y conexiones

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./db');
const { JWT_SECRET } = require('./env');

// Map para tracking de usuarios online: userId -> Set<socketId>
const onlineUsers = new Map();

/**
 * Inicializa el servidor Socket.io
 * @param {http.Server} httpServer - Servidor HTTP de Express
 * @returns {Server} Instancia de Socket.io
 */
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Middleware de autenticacion JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Token de autenticacion no proporcionado'));
      }

      // Verificar token JWT
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new Error('Token expirado'));
        }
        return next(new Error('Token invalido'));
      }

      // Obtener userId del token
      const userId = decoded.userId || decoded.id || decoded.sub;
      if (!userId) {
        return next(new Error('Token malformado - falta userId'));
      }

      // Buscar usuario en base de datos
      const user = await prisma.users.findUnique({
        where: { id: userId },
        include: {
          roles: true
        }
      });

      if (!user) {
        return next(new Error('Usuario no encontrado'));
      }

      if (user.deleted_at || user.status !== 'active') {
        return next(new Error('Usuario inactivo o eliminado'));
      }

      // Agregar datos del usuario al socket
      socket.user = {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.roles?.name?.toLowerCase(),
        profilePhoto: user.profile_photo
      };

      next();
    } catch (error) {
      console.error('Error en autenticacion WebSocket:', error);
      next(new Error('Error de autenticacion'));
    }
  });

  // Manejar conexiones
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userName = `${socket.user.firstName} ${socket.user.lastName}`;

    console.log(`[WebSocket] Usuario conectado: ${userName} (${userId})`);

    // Registrar usuario como online
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Unirse a room personal para notificaciones
    socket.join(`user:${userId}`);

    // Notificar a otros que el usuario esta online
    socket.broadcast.emit('user:online', {
      userId,
      userName,
      timestamp: new Date().toISOString()
    });

    // Registrar handlers de chat
    const chatHandler = require('../socket/handlers/chatHandler');
    chatHandler.registerHandlers(io, socket);

    // Registrar handlers de monitoreo GPS
    const monitoringHandler = require('../socket/handlers/monitoringHandler');
    monitoringHandler.registerHandlers(io, socket);

    // Manejar desconexion
    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Usuario desconectado: ${userName} (${reason})`);

      // Remover socket del tracking
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // Si no quedan sockets, el usuario esta offline
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);

          // Notificar a otros que el usuario esta offline
          socket.broadcast.emit('user:offline', {
            userId,
            userName,
            lastSeen: new Date().toISOString()
          });
        }
      }
    });

    // Manejar errores
    socket.on('error', (error) => {
      console.error(`[WebSocket] Error en socket ${socket.id}:`, error);
    });
  });

  return io;
};

/**
 * Verifica si un usuario esta online
 * @param {string} userId - ID del usuario
 * @returns {boolean}
 */
const isUserOnline = (userId) => {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
};

/**
 * Obtiene la lista de usuarios online
 * @returns {string[]} Array de userIds online
 */
const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

/**
 * Emite un evento a un usuario especifico (a todos sus sockets)
 * @param {Server} io - Instancia de Socket.io
 * @param {string} userId - ID del usuario destino
 * @param {string} event - Nombre del evento
 * @param {Object} data - Datos a enviar
 */
const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emite un evento a todos los participantes de un chat
 * @param {Server} io - Instancia de Socket.io
 * @param {string} chatId - ID del chat
 * @param {string} event - Nombre del evento
 * @param {Object} data - Datos a enviar
 */
const emitToChat = (io, chatId, event, data) => {
  io.to(`chat:${chatId}`).emit(event, data);
};

module.exports = {
  initializeSocket,
  isUserOnline,
  getOnlineUsers,
  emitToUser,
  emitToChat,
  onlineUsers
};
