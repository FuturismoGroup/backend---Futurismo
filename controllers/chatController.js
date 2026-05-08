// Controller de Chat
// Tablas reales: chats, messages, chat_participants
// API-081 a API-084 + endpoints adicionales para frontend

const prisma = require('../config/db');

/**
 * API-081: ListChatConversations
 * GET /api/chat/conversations
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const listChatConversations = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      chatType,
      unreadOnly
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = Math.min(parseInt(pageSize, 10), 50);
    const skip = (pageNum - 1) * pageSizeNum;

    // Obtener chats donde el usuario es participante
    const where = {
      chat_participants: {
        some: {
          user_id: req.user.id,
          left_at: null // Solo participaciones activas
        }
      }
    };

    if (chatType) {
      where.chat_type = chatType;
    }

    const [chats, total] = await Promise.all([
      prisma.chats.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { last_message_at: 'desc' },
        include: {
          chat_participants: {
            where: { left_at: null },
            include: {
              users: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  profile_photo: true,
                  role_id: true
                }
              }
            }
          },
          messages: {
            take: 1,
            orderBy: { created_at: 'desc' },
            include: {
              users: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true
                }
              }
            }
          }
        }
      }),
      prisma.chats.count({ where })
    ]);

    // Mapear respuesta
    let items = chats.map(chat => {
      // Buscar participación del usuario actual para obtener unread_count
      const myParticipation = chat.chat_participants.find(p => p.user_id === req.user.id);
      const unreadCount = myParticipation?.unread_count || 0;

      return {
        id: chat.id,
        name: chat.name,
        chatType: chat.chat_type,
        isFromAgenda: chat.is_from_agenda,
        reservationId: chat.reservation_id,
        participants: chat.chat_participants.map(p => ({
          id: p.users.id,
          name: `${p.users.first_name || ''} ${p.users.last_name || ''}`.trim(),
          avatar: p.users.profile_photo,
          roleId: p.users.role_id,
          participantRole: p.role
        })),
        lastMessage: chat.messages[0] ? {
          id: chat.messages[0].id,
          content: chat.messages[0].content,
          messageType: chat.messages[0].message_type,
          senderId: chat.messages[0].sender_id,
          senderName: chat.messages[0].users ? `${chat.messages[0].users.first_name || ''} ${chat.messages[0].users.last_name || ''}`.trim() : null,
          createdAt: chat.messages[0].created_at
        } : null,
        unreadCount,
        lastMessageAt: chat.last_message_at,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at
      };
    });

    // Filtrar por unreadOnly si aplica
    if (unreadOnly === 'true') {
      items = items.filter(chat => chat.unreadCount > 0);
    }

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (error) {
    console.error('Error en listChatConversations:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar conversaciones'
    });
  }
};

/**
 * GET /api/chat/conversations/:id
 * Detalle de una conversación
 */
const getConversationDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que el usuario es participante
    const chat = await prisma.chats.findFirst({
      where: {
        id,
        chat_participants: {
          some: {
            user_id: req.user.id,
            left_at: null
          }
        }
      },
      include: {
        chat_participants: {
          where: { left_at: null },
          include: {
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                profile_photo: true,
                role_id: true,
                email: true
              }
            }
          }
        },
        reservations: {
          select: {
            id: true,
            reservation_number: true,
            date: true
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Conversación no encontrada o no tiene acceso'
      });
    }

    // Obtener unread count del usuario
    const myParticipation = chat.chat_participants.find(p => p.user_id === req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        id: chat.id,
        name: chat.name,
        chatType: chat.chat_type,
        isFromAgenda: chat.is_from_agenda,
        reservation: chat.reservations ? {
          id: chat.reservations.id,
          reservationNumber: chat.reservations.reservation_number,
          date: chat.reservations.date
        } : null,
        participants: chat.chat_participants.map(p => ({
          id: p.users.id,
          name: `${p.users.first_name || ''} ${p.users.last_name || ''}`.trim(),
          avatar: p.users.profile_photo,
          roleId: p.users.role_id,
          email: p.users.email,
          participantRole: p.role,
          isMuted: p.is_muted,
          joinedAt: p.joined_at
        })),
        unreadCount: myParticipation?.unread_count || 0,
        lastMessageAt: chat.last_message_at,
        createdAt: chat.created_at
      }
    });
  } catch (error) {
    console.error('Error en getConversationDetails:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener detalles de conversación'
    });
  }
};

/**
 * API-082: GetConversationMessages
 * GET /api/chat/conversations/:id/messages
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      pageSize = 50,
      before
    } = req.query;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    const pageNum = parseInt(page, 10);
    const pageSizeNum = Math.min(parseInt(pageSize, 10), 100);
    const skip = (pageNum - 1) * pageSizeNum;

    // Verificar que el usuario es participante
    const chat = await prisma.chats.findFirst({
      where: {
        id,
        chat_participants: {
          some: {
            user_id: req.user.id,
            left_at: null
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Conversación no encontrada o no tiene acceso'
      });
    }

    // Construir filtros
    const where = {
      chat_id: id,
      deleted_at: null
    };

    if (before) {
      where.created_at = { lt: new Date(before) };
    }

    const [messages, total] = await Promise.all([
      prisma.messages.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { created_at: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              profile_photo: true
            }
          },
          messages: { // reply_to message
            select: {
              id: true,
              content: true,
              sender_id: true
            }
          }
        }
      }),
      prisma.messages.count({ where })
    ]);

    const items = messages.map(m => ({
      id: m.id,
      chatId: m.chat_id,
      senderId: m.sender_id,
      senderName: m.users ? `${m.users.first_name || ''} ${m.users.last_name || ''}`.trim() : null,
      senderAvatar: m.users?.profile_photo,
      content: m.content,
      messageType: m.message_type,
      status: m.status,
      replyTo: m.messages ? {
        id: m.messages.id,
        content: m.messages.content,
        senderId: m.messages.sender_id
      } : null,
      editedAt: m.edited_at,
      createdAt: m.created_at
    }));

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (error) {
    console.error('Error en getConversationMessages:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener mensajes'
    });
  }
};

/**
 * API-083: SendMessage
 * POST /api/chat/conversations/:id/messages
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, replyToId } = req.body;
    const messageType = 'text'; // Solo texto plano

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Validaciones
    if (!content || content.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'content es obligatorio'
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'content no puede exceder 5000 caracteres'
      });
    }

    // Verificar que el usuario es participante
    const chat = await prisma.chats.findFirst({
      where: {
        id,
        chat_participants: {
          some: {
            user_id: req.user.id,
            left_at: null
          }
        }
      },
      include: {
        chat_participants: {
          where: { left_at: null },
          select: { user_id: true }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Conversación no encontrada o no tiene acceso'
      });
    }

    // Crear mensaje en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear mensaje
      const message = await tx.messages.create({
        data: {
          chat_id: id,
          sender_id: req.user.id,
          content,
          message_type: messageType,
          reply_to_id: replyToId || null,
          status: 'sent'
        },
        include: {
          users: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              profile_photo: true
            }
          }
        }
      });

      // Actualizar last_message_at del chat
      await tx.chats.update({
        where: { id },
        data: { last_message_at: new Date() }
      });

      // Incrementar unread_count para otros participantes
      await tx.chat_participants.updateMany({
        where: {
          chat_id: id,
          user_id: { not: req.user.id },
          left_at: null
        },
        data: {
          unread_count: { increment: 1 }
        }
      });

      return message;
    });

    // Preparar datos del mensaje para respuesta y WebSocket
    const messageData = {
      id: result.id,
      chatId: result.chat_id,
      senderId: result.sender_id,
      senderName: result.users ? `${result.users.first_name || ''} ${result.users.last_name || ''}`.trim() : null,
      senderAvatar: result.users?.profile_photo,
      content: result.content,
      messageType: result.message_type,
      status: result.status,
      createdAt: result.created_at
    };

    // Emitir mensaje via WebSocket a todos los participantes del chat
    const io = req.app.get('io');
    if (io) {
      // Emitir nuevo mensaje a la room del chat
      io.to(`chat:${id}`).emit('chat:message:new', {
        chatId: id,
        message: messageData
      });

      // Emitir actualizacion de unread + preview a participantes
      for (const participant of chat.chat_participants) {
        if (participant.user_id !== req.user.id) {
          io.to(`user:${participant.user_id}`).emit('unread:update', {
            chatId: id,
            increment: 1,
            lastMessage: {
              content: messageData.content,
              senderName: messageData.senderName,
              createdAt: messageData.createdAt
            }
          });

          // Emitir notificacion para la campana
          io.to(`user:${participant.user_id}`).emit('notification:new', {
            id: `chat-msg-${messageData.id}`,
            type: 'chat_message',
            title: messageData.senderName,
            message: messageData.content.length > 100
              ? messageData.content.substring(0, 100) + '...'
              : messageData.content,
            chatId: id,
            createdAt: messageData.createdAt
          });
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      data: messageData
    });
  } catch (error) {
    console.error('Error en sendMessage:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al enviar mensaje'
    });
  }
};

/**
 * API-084: CreateConversation
 * POST /api/chat/conversations
 * Roles permitidos: Admin, Agency, Guide, Client
 */
const createConversation = async (req, res) => {
  try {
    const { participantIds, name, chatType = 'direct', reservationId } = req.body;

    // Validaciones
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'participantIds es obligatorio y debe tener al menos un participante'
      });
    }

    // Agregar el usuario actual si no está incluido
    const allParticipantIds = [...new Set([req.user.id, ...participantIds])];

    // Verificar que todos los usuarios existen
    const users = await prisma.users.findMany({
      where: { id: { in: allParticipantIds } }
    });

    if (users.length !== allParticipantIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Uno o más participantes no existen'
      });
    }

    // Para conversaciones directas, verificar si ya existe
    if (chatType === 'direct' && allParticipantIds.length === 2) {
      const existingChat = await prisma.chats.findFirst({
        where: {
          chat_type: 'direct',
          chat_participants: {
            every: {
              user_id: { in: allParticipantIds },
              left_at: null
            }
          }
        },
        include: {
          chat_participants: {
            where: { left_at: null },
            include: {
              users: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  profile_photo: true,
                  role_id: true
                }
              }
            }
          }
        }
      });

      // Verificar que tiene exactamente los mismos participantes
      if (existingChat && existingChat.chat_participants.length === 2) {
        return res.status(200).json({
          success: true,
          data: {
            id: existingChat.id,
            name: existingChat.name,
            chatType: existingChat.chat_type,
            participants: existingChat.chat_participants.map(p => ({
              id: p.users.id,
              name: `${p.users.first_name || ''} ${p.users.last_name || ''}`.trim(),
              avatar: p.users.profile_photo,
              roleId: p.users.role_id
            })),
            createdAt: existingChat.created_at,
            existing: true
          }
        });
      }
    }

    // Crear nueva conversación
    const chat = await prisma.chats.create({
      data: {
        name,
        chat_type: chatType,
        created_by: req.user.id,
        reservation_id: reservationId || null,
        is_from_agenda: !!reservationId,
        chat_participants: {
          create: allParticipantIds.map(userId => ({
            user_id: userId,
            role: userId === req.user.id ? 'admin' : 'member'
          }))
        }
      },
      include: {
        chat_participants: {
          include: {
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                profile_photo: true,
                role_id: true
              }
            }
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Conversación creada exitosamente',
      data: {
        id: chat.id,
        name: chat.name,
        chatType: chat.chat_type,
        isFromAgenda: chat.is_from_agenda,
        participants: chat.chat_participants.map(p => ({
          id: p.users.id,
          name: `${p.users.first_name || ''} ${p.users.last_name || ''}`.trim(),
          avatar: p.users.profile_photo,
          roleId: p.users.role_id,
          participantRole: p.role
        })),
        createdAt: chat.created_at
      }
    });
  } catch (error) {
    console.error('Error en createConversation:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear conversación'
    });
  }
};

/**
 * POST /api/chat/conversations/:id/read
 * Marcar conversación como leída
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que el usuario es participante
    const participation = await prisma.chat_participants.findFirst({
      where: {
        chat_id: id,
        user_id: req.user.id,
        left_at: null
      }
    });

    if (!participation) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Conversación no encontrada o no tiene acceso'
      });
    }

    // Actualizar participación
    const now = new Date();
    await prisma.chat_participants.update({
      where: { id: participation.id },
      data: {
        last_read_at: now,
        unread_count: 0
      }
    });

    // Actualizar estado de mensajes no leídos a 'read'
    await prisma.messages.updateMany({
      where: {
        chat_id: id,
        sender_id: { not: req.user.id },
        status: { not: 'read' },
        deleted_at: null
      },
      data: { status: 'read' }
    });

    // Emitir evento WebSocket para notificar que los mensajes fueron leídos
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('chat:read:update', {
        chatId: id,
        userId: req.user.id,
        userName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
        lastReadAt: now.toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversación marcada como leída'
    });
  } catch (error) {
    console.error('Error en markAsRead:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al marcar como leída'
    });
  }
};

/**
 * PUT /api/chat/messages/:id
 * Editar mensaje
 */
const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    if (!content || content.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'content es obligatorio'
      });
    }

    // Verificar que el mensaje existe y pertenece al usuario
    const message = await prisma.messages.findFirst({
      where: {
        id,
        sender_id: req.user.id,
        deleted_at: null
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Mensaje no encontrado o no tiene permisos para editarlo'
      });
    }

    // Actualizar mensaje
    const updated = await prisma.messages.update({
      where: { id },
      data: {
        content,
        edited_at: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Mensaje editado exitosamente',
      data: {
        id: updated.id,
        content: updated.content,
        editedAt: updated.edited_at
      }
    });
  } catch (error) {
    console.error('Error en editMessage:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al editar mensaje'
    });
  }
};

/**
 * DELETE /api/chat/messages/:id
 * Eliminar mensaje (soft delete)
 */
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que el mensaje existe y pertenece al usuario
    const message = await prisma.messages.findFirst({
      where: {
        id,
        sender_id: req.user.id,
        deleted_at: null
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Mensaje no encontrado o no tiene permisos para eliminarlo'
      });
    }

    // Soft delete
    await prisma.messages.update({
      where: { id },
      data: { deleted_at: new Date() }
    });

    return res.status(200).json({
      success: true,
      message: 'Mensaje eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteMessage:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar mensaje'
    });
  }
};

/**
 * POST /api/chat/conversations/:id/participants
 * Agregar participante a conversación grupal
 */
const addParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role = 'member' } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) || !uuidRegex.test(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id y userId deben ser UUIDs válidos'
      });
    }

    // Verificar que el chat existe y el usuario actual es admin del chat
    const chat = await prisma.chats.findFirst({
      where: {
        id,
        chat_participants: {
          some: {
            user_id: req.user.id,
            role: 'admin',
            left_at: null
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Conversación no encontrada o no tiene permisos de administrador'
      });
    }

    // Solo permitir agregar participantes a grupos
    if (chat.chat_type === 'direct') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No se pueden agregar participantes a conversaciones directas'
      });
    }

    // Verificar que el usuario a agregar existe
    const userToAdd = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si ya es participante
    const existingParticipation = await prisma.chat_participants.findFirst({
      where: {
        chat_id: id,
        user_id: userId
      }
    });

    if (existingParticipation) {
      if (existingParticipation.left_at === null) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'El usuario ya es participante de esta conversación'
        });
      }

      // Reactivar participación
      await prisma.chat_participants.update({
        where: { id: existingParticipation.id },
        data: {
          left_at: null,
          role,
          unread_count: 0
        }
      });
    } else {
      // Crear nueva participación
      await prisma.chat_participants.create({
        data: {
          chat_id: id,
          user_id: userId,
          role
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Participante agregado exitosamente',
      data: {
        userId,
        name: userToAdd.name,
        role
      }
    });
  } catch (error) {
    console.error('Error en addParticipant:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al agregar participante'
    });
  }
};

/**
 * DELETE /api/chat/conversations/:id/participants/:userId
 * Remover participante de conversación grupal
 */
const removeParticipant = async (req, res) => {
  try {
    const { id, participantId } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) || !uuidRegex.test(participantId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id y participantId deben ser UUIDs válidos'
      });
    }

    // Verificar que el chat existe y el usuario actual es admin del chat o se está removiendo a sí mismo
    const chat = await prisma.chats.findFirst({
      where: {
        id,
        chat_participants: {
          some: {
            user_id: req.user.id,
            left_at: null
          }
        }
      },
      include: {
        chat_participants: {
          where: { user_id: req.user.id, left_at: null }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Conversación no encontrada'
      });
    }

    const isAdmin = chat.chat_participants[0]?.role === 'admin';
    const isSelfRemoval = participantId === req.user.id;

    if (!isAdmin && !isSelfRemoval) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'No tiene permisos para remover participantes'
      });
    }

    // Solo permitir remover participantes de grupos
    if (chat.chat_type === 'direct') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No se pueden remover participantes de conversaciones directas'
      });
    }

    // Encontrar la participación
    const participation = await prisma.chat_participants.findFirst({
      where: {
        chat_id: id,
        user_id: participantId,
        left_at: null
      }
    });

    if (!participation) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Participante no encontrado en esta conversación'
      });
    }

    // Soft delete de participación
    await prisma.chat_participants.update({
      where: { id: participation.id },
      data: { left_at: new Date() }
    });

    return res.status(200).json({
      success: true,
      message: 'Participante removido exitosamente'
    });
  } catch (error) {
    console.error('Error en removeParticipant:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al remover participante'
    });
  }
};

/**
 * PUT /api/chat/conversations/:id/mute
 * Silenciar/desilenciar notificaciones de una conversación
 */
const toggleMute = async (req, res) => {
  try {
    const { id } = req.params;
    const { muted } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    if (typeof muted !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'muted debe ser un booleano'
      });
    }

    // Verificar participación
    const participation = await prisma.chat_participants.findFirst({
      where: {
        chat_id: id,
        user_id: req.user.id,
        left_at: null
      }
    });

    if (!participation) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Conversación no encontrada o no tiene acceso'
      });
    }

    // Actualizar estado de mute
    await prisma.chat_participants.update({
      where: { id: participation.id },
      data: { is_muted: muted }
    });

    return res.status(200).json({
      success: true,
      message: muted ? 'Conversación silenciada' : 'Notificaciones activadas',
      data: { muted }
    });
  } catch (error) {
    console.error('Error en toggleMute:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al cambiar estado de notificaciones'
    });
  }
};

/**
 * GET /api/chat/contacts
 * Retorna contactos disponibles para chat según el rol del usuario
 * - Admin: guías + agencias
 * - Agency: guías + admins
 * - Guide: admins + agencias
 */
const getChatContacts = async (req, res) => {
  try {
    const rawRole = req.user.role;
    const userRole = rawRole === 'administrator' ? 'admin' : rawRole;
    const userId = req.user.id;
    const { searchTerm } = req.query;

    const contacts = { guides: [], agencies: [], admins: [] };

    // Construir filtro de búsqueda para users
    const userSearchFilter = searchTerm ? {
      OR: [
        { first_name: { contains: searchTerm, mode: 'insensitive' } },
        { last_name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } }
      ]
    } : {};

    // Admin ve todos los guías; Agency solo los guías asignados (planta + freelance contratados)
    if (userRole === 'admin' || userRole === 'agency') {
      const guideWhere = {
        users: {
          status: 'active',
          id: { not: userId },
          ...userSearchFilter
        }
      };

      let shouldQueryGuides = true;

      if (userRole === 'agency') {
        const agencyId = req.user.agencyId || req.user.agency?.id;

        if (!agencyId) {
          shouldQueryGuides = false;
        } else {
          // Guías asignados: planta (guides.agency_id) + los que tienen
          // service_requests o reservations con esta agencia
          const [serviceRequestGuides, reservationGuides] = await Promise.all([
            prisma.service_requests.findMany({
              where: { agency_id: agencyId },
              select: { guide_id: true },
              distinct: ['guide_id']
            }),
            prisma.reservations.findMany({
              where: { agency_id: agencyId, guide_id: { not: null } },
              select: { guide_id: true },
              distinct: ['guide_id']
            })
          ]);

          const assignedGuideIds = Array.from(new Set([
            ...serviceRequestGuides.map(s => s.guide_id).filter(Boolean),
            ...reservationGuides.map(r => r.guide_id).filter(Boolean)
          ]));

          guideWhere.OR = [
            { agency_id: agencyId },
            ...(assignedGuideIds.length > 0 ? [{ id: { in: assignedGuideIds } }] : [])
          ];
        }
      }

      if (shouldQueryGuides) {
        const guides = await prisma.guides.findMany({
          where: guideWhere,
          include: {
            users: {
              select: { id: true, first_name: true, last_name: true, email: true, profile_photo: true, status: true }
            }
          },
          orderBy: { created_at: 'desc' }
        });

        contacts.guides = guides.map(g => ({
          id: g.users.id,
          name: `${g.users.first_name || ''} ${g.users.last_name || ''}`.trim() || 'Sin nombre',
          email: g.users.email,
          avatar: g.users.profile_photo || null,
          role: 'guide',
          guideType: g.guide_type
        }));
      }
    }

    // Admin puede ver agencias
    if (userRole === 'admin') {
      const agencies = await prisma.agencies.findMany({
        where: {
          status: { not: 'deleted' },
          users: {
            status: 'active',
            id: { not: userId },
            ...userSearchFilter
          }
        },
        include: {
          users: {
            select: { id: true, first_name: true, last_name: true, email: true, profile_photo: true }
          }
        },
        orderBy: { business_name: 'asc' }
      });

      contacts.agencies = agencies.map(a => ({
        id: a.users.id,
        name: a.business_name || `${a.users.first_name || ''} ${a.users.last_name || ''}`.trim(),
        email: a.users.email || a.agency_email,
        avatar: a.users.profile_photo || null,
        role: 'agency'
      }));
    }

    // Agency y Guide pueden ver admins
    if (userRole === 'agency' || userRole === 'guide') {
      const admins = await prisma.users.findMany({
        where: {
          role: 'admin',
          status: 'active',
          id: { not: userId },
          ...userSearchFilter
        },
        select: { id: true, first_name: true, last_name: true, email: true, profile_photo: true }
      });

      contacts.admins = admins.map(a => ({
        id: a.id,
        name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Administrador',
        email: a.email,
        avatar: a.profile_photo || null,
        role: 'admin'
      }));
    }

    // Guide puede ver agencias
    if (userRole === 'guide') {
      const agencies = await prisma.agencies.findMany({
        where: {
          status: { not: 'deleted' },
          users: {
            status: 'active',
            id: { not: userId },
            ...userSearchFilter
          }
        },
        include: {
          users: {
            select: { id: true, first_name: true, last_name: true, email: true, profile_photo: true }
          }
        },
        orderBy: { business_name: 'asc' }
      });

      contacts.agencies = agencies.map(a => ({
        id: a.users.id,
        name: a.business_name || `${a.users.first_name || ''} ${a.users.last_name || ''}`.trim(),
        email: a.users.email || a.agency_email,
        avatar: a.users.profile_photo || null,
        role: 'agency'
      }));
    }

    return res.status(200).json({
      success: true,
      data: contacts
    });
  } catch (error) {
    console.error('Error en getChatContacts:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener contactos'
    });
  }
};

module.exports = {
  listChatConversations,
  getConversationDetails,
  getConversationMessages,
  sendMessage,
  createConversation,
  markAsRead,
  editMessage,
  deleteMessage,
  addParticipant,
  removeParticipant,
  toggleMute,
  getChatContacts
};
