// Handler de eventos de chat para Socket.io
// Maneja: join, leave, typing, mensajes en tiempo real

const prisma = require('../../config/db');
const { isUserOnline } = require('../../config/socket');

/**
 * Registra los handlers de chat para un socket
 * @param {Server} io - Instancia de Socket.io
 * @param {Socket} socket - Socket del cliente
 */
const registerHandlers = (io, socket) => {
  const userId = socket.user.id;

  // Unirse a un chat
  socket.on('chat:join', async (data) => {
    try {
      const { chatId } = data;

      if (!chatId) {
        socket.emit('error', { message: 'chatId es requerido' });
        return;
      }

      // Verificar que el usuario es participante del chat
      const participant = await prisma.chat_participants.findFirst({
        where: {
          chat_id: chatId,
          user_id: userId,
          left_at: null
        }
      });

      if (!participant) {
        socket.emit('error', { message: 'No tienes acceso a este chat' });
        return;
      }

      // Unirse a la room del chat
      socket.join(`chat:${chatId}`);
      console.log(`[Chat] Usuario ${socket.user.firstName} se unio al chat ${chatId}`);

      // Notificar a otros en el chat
      socket.to(`chat:${chatId}`).emit('chat:user:joined', {
        chatId,
        userId,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Chat] Error al unirse al chat:', error);
      socket.emit('error', { message: 'Error al unirse al chat' });
    }
  });

  // Salir de un chat
  socket.on('chat:leave', (data) => {
    try {
      const { chatId } = data;

      if (!chatId) return;

      socket.leave(`chat:${chatId}`);
      console.log(`[Chat] Usuario ${socket.user.firstName} salio del chat ${chatId}`);

      // Notificar a otros en el chat
      socket.to(`chat:${chatId}`).emit('chat:user:left', {
        chatId,
        userId,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Chat] Error al salir del chat:', error);
    }
  });

  // Indicador de escritura
  socket.on('chat:typing', (data) => {
    try {
      const { chatId, isTyping } = data;

      if (!chatId) return;

      // Broadcast a todos en el chat excepto el remitente
      socket.to(`chat:${chatId}`).emit('chat:typing', {
        chatId,
        userId,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        isTyping: !!isTyping,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Chat] Error en typing indicator:', error);
    }
  });

  // Marcar mensajes como leidos
  socket.on('chat:read', async (data) => {
    try {
      const { chatId } = data;

      if (!chatId) return;

      // Actualizar last_read_at y unread_count en la BD
      const now = new Date();
      await prisma.chat_participants.updateMany({
        where: {
          chat_id: chatId,
          user_id: userId,
          left_at: null
        },
        data: {
          last_read_at: now,
          unread_count: 0
        }
      });

      // Actualizar estado de mensajes a 'read'
      await prisma.messages.updateMany({
        where: {
          chat_id: chatId,
          sender_id: { not: userId },
          status: { not: 'read' },
          deleted_at: null
        },
        data: {
          status: 'read'
        }
      });

      // Notificar a otros en el chat que los mensajes fueron leidos
      socket.to(`chat:${chatId}`).emit('chat:read:update', {
        chatId,
        userId,
        userName: `${socket.user.firstName} ${socket.user.lastName}`,
        lastReadAt: now.toISOString()
      });

    } catch (error) {
      console.error('[Chat] Error al marcar como leido:', error);
    }
  });

  // Enviar mensaje (alternativa a REST)
  socket.on('chat:message:send', async (data) => {
    try {
      const { chatId, content, replyToId, tempId } = data;
      const messageType = 'text'; // Solo texto plano

      if (!chatId || !content) {
        socket.emit('error', { message: 'chatId y content son requeridos' });
        return;
      }

      // Verificar que el usuario es participante
      const participant = await prisma.chat_participants.findFirst({
        where: {
          chat_id: chatId,
          user_id: userId,
          left_at: null
        }
      });

      if (!participant) {
        socket.emit('error', { message: 'No tienes acceso a este chat' });
        return;
      }

      // Crear mensaje en la BD
      const message = await prisma.messages.create({
        data: {
          chat_id: chatId,
          sender_id: userId,
          content,
          message_type: messageType,
          reply_to_id: replyToId || null,
          status: 'sent'
        },
        include: {
          users: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
              profile_photo: true
            }
          }
        }
      });

      // Actualizar last_message_at del chat
      await prisma.chats.update({
        where: { id: chatId },
        data: { last_message_at: new Date() }
      });

      // Incrementar unread_count para otros participantes
      await prisma.chat_participants.updateMany({
        where: {
          chat_id: chatId,
          user_id: { not: userId },
          left_at: null
        },
        data: {
          unread_count: { increment: 1 }
        }
      });

      // Transformar mensaje para el frontend
      const transformedMessage = {
        id: message.id,
        chatId: message.chat_id,
        senderId: message.sender_id,
        senderName: `${message.users.first_name} ${message.users.last_name}`,
        senderUsername: message.users.username,
        senderAvatar: message.users.profile_photo,
        content: message.content,
        messageType: message.message_type,
        status: message.status,
        replyToId: message.reply_to_id,
        createdAt: message.created_at.toISOString()
      };

      // Emitir mensaje a todos en el chat (incluyendo al remitente)
      io.to(`chat:${chatId}`).emit('chat:message:new', {
        chatId,
        message: transformedMessage,
        tempId // Para que el cliente pueda reemplazar el mensaje optimista
      });

      // Emitir notificacion a participantes que no estan en el chat
      const participants = await prisma.chat_participants.findMany({
        where: {
          chat_id: chatId,
          user_id: { not: userId },
          left_at: null,
          is_muted: false
        },
        select: { user_id: true }
      });

      for (const p of participants) {
        // Emitir actualizacion de contador de no leidos + preview del mensaje
        io.to(`user:${p.user_id}`).emit('unread:update', {
          chatId,
          increment: 1,
          lastMessage: {
            content: transformedMessage.content,
            senderName: transformedMessage.senderName,
            createdAt: transformedMessage.createdAt
          }
        });

        // Emitir notificacion para la campana
        io.to(`user:${p.user_id}`).emit('notification:new', {
          id: `chat-msg-${transformedMessage.id}`,
          type: 'chat_message',
          title: transformedMessage.senderName,
          message: transformedMessage.content.length > 100
            ? transformedMessage.content.substring(0, 100) + '...'
            : transformedMessage.content,
          chatId,
          createdAt: transformedMessage.createdAt
        });
      }

    } catch (error) {
      console.error('[Chat] Error al enviar mensaje:', error);
      socket.emit('error', { message: 'Error al enviar mensaje' });
    }
  });
};

/**
 * Emite un nuevo mensaje a un chat (llamado desde chatController)
 * @param {Server} io - Instancia de Socket.io
 * @param {string} chatId - ID del chat
 * @param {Object} message - Mensaje transformado
 * @param {string} senderId - ID del remitente
 */
const emitNewMessage = (io, chatId, message, senderId) => {
  io.to(`chat:${chatId}`).emit('chat:message:new', {
    chatId,
    message
  });
};

/**
 * Emite actualizacion de estado de mensaje
 * @param {Server} io - Instancia de Socket.io
 * @param {string} chatId - ID del chat
 * @param {string} messageId - ID del mensaje
 * @param {string} status - Nuevo estado (sent/delivered/read)
 */
const emitMessageStatus = (io, chatId, messageId, status) => {
  io.to(`chat:${chatId}`).emit('chat:message:status', {
    chatId,
    messageId,
    status,
    timestamp: new Date().toISOString()
  });
};

/**
 * Emite actualizacion de contador de no leidos
 * @param {Server} io - Instancia de Socket.io
 * @param {string} userId - ID del usuario
 * @param {string} chatId - ID del chat
 * @param {number} count - Nuevo contador
 */
const emitUnreadUpdate = (io, userId, chatId, count) => {
  io.to(`user:${userId}`).emit('unread:update', {
    chatId,
    count
  });
};

module.exports = {
  registerHandlers,
  emitNewMessage,
  emitMessageStatus,
  emitUnreadUpdate
};
