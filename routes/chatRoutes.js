// Routes de Chat
// Tablas: chats, messages, chat_participants
// API-081 a API-084 + endpoints adicionales para frontend

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate, authorize } = require('../middlewares/auth');

// Roles permitidos para chat
const chatRoles = ['admin', 'agency', 'guide', 'client'];

/**
 * GET /api/chat/contacts
 * Retorna contactos disponibles para iniciar chat según rol del usuario
 */
router.get(
  '/contacts',
  authenticate,
  authorize(chatRoles),
  chatController.getChatContacts
);

/**
 * API-081: ListChatConversations
 * GET /api/chat/conversations
 * Lista todas las conversaciones del usuario
 */
router.get(
  '/conversations',
  authenticate,
  authorize(chatRoles),
  chatController.listChatConversations
);

/**
 * API-084: CreateConversation
 * POST /api/chat/conversations
 * Crea una nueva conversación
 */
router.post(
  '/conversations',
  authenticate,
  authorize(chatRoles),
  chatController.createConversation
);

/**
 * GET /api/chat/conversations/:id
 * Obtiene detalles de una conversación específica
 */
router.get(
  '/conversations/:id',
  authenticate,
  authorize(chatRoles),
  chatController.getConversationDetails
);

/**
 * API-082: GetConversationMessages
 * GET /api/chat/conversations/:id/messages
 * Obtiene mensajes de una conversación
 */
router.get(
  '/conversations/:id/messages',
  authenticate,
  authorize(chatRoles),
  chatController.getConversationMessages
);

/**
 * API-083: SendMessage
 * POST /api/chat/conversations/:id/messages
 * Envía un mensaje a una conversación
 */
router.post(
  '/conversations/:id/messages',
  authenticate,
  authorize(chatRoles),
  chatController.sendMessage
);

/**
 * POST /api/chat/conversations/:id/read
 * Marca una conversación como leída
 */
router.post(
  '/conversations/:id/read',
  authenticate,
  authorize(chatRoles),
  chatController.markAsRead
);

/**
 * PUT /api/chat/conversations/:id/mute
 * Silenciar/desilenciar notificaciones de una conversación
 */
router.put(
  '/conversations/:id/mute',
  authenticate,
  authorize(chatRoles),
  chatController.toggleMute
);

/**
 * POST /api/chat/conversations/:id/participants
 * Agrega un participante a una conversación grupal
 */
router.post(
  '/conversations/:id/participants',
  authenticate,
  authorize(['admin', 'agency']),
  chatController.addParticipant
);

/**
 * DELETE /api/chat/conversations/:id/participants/:participantId
 * Remueve un participante de una conversación grupal
 */
router.delete(
  '/conversations/:id/participants/:participantId',
  authenticate,
  authorize(chatRoles),
  chatController.removeParticipant
);

/**
 * PUT /api/chat/messages/:id
 * Edita un mensaje existente
 */
router.put(
  '/messages/:id',
  authenticate,
  authorize(chatRoles),
  chatController.editMessage
);

/**
 * DELETE /api/chat/messages/:id
 * Elimina un mensaje (soft delete)
 */
router.delete(
  '/messages/:id',
  authenticate,
  authorize(chatRoles),
  chatController.deleteMessage
);

module.exports = router;
