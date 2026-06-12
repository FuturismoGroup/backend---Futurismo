// Utilidad central para crear y emitir notificaciones desde la logica de negocio.
// Envuelve createNotification (que persiste en BD y emite por WebSocket) y anade
// helpers de alto nivel para los destinatarios comunes: un usuario concreto, el
// dueno de una agencia, o todos los administradores.
//
// IMPORTANTE: todas las funciones son "best-effort": capturan sus errores y nunca
// lanzan, para que un fallo al notificar jamas rompa la operacion de negocio
// principal (crear una reserva, canjear un premio, etc.).

const prisma = require('../config/db');
const { createNotification } = require('../controllers/notificationController');

/**
 * Crea y emite una notificacion para un unico usuario.
 * @param {import('socket.io').Server} io - Instancia de Socket.io (req.app.get('io'))
 * @param {string} userId - ID del usuario destinatario
 * @param {Object} payload - { type, title, message, actionUrl?, priority?, referenceType?, referenceId? }
 */
async function notifyUser(io, userId, { type, title, message, ...options } = {}) {
  if (!userId) return;
  try {
    await createNotification(userId, type, title, message, { ...options, io });
  } catch (err) {
    console.error('[notify] notifyUser fallo:', err.message);
  }
}

/**
 * Crea y emite una notificacion para todos los administradores activos.
 * @param {import('socket.io').Server} io
 * @param {Object} payload - Misma forma que notifyUser
 */
async function notifyAdmins(io, payload = {}) {
  try {
    const admins = await prisma.users.findMany({
      where: { status: 'active', roles: { name: 'administrator' } },
      select: { id: true }
    });
    await Promise.all(admins.map((a) => notifyUser(io, a.id, payload)));
  } catch (err) {
    console.error('[notify] notifyAdmins fallo:', err.message);
  }
}

/**
 * Resuelve el user_id dueno de una agencia (las notificaciones se dirigen a usuarios).
 * @param {string} agencyId
 * @returns {Promise<string|null>}
 */
async function getAgencyUserId(agencyId) {
  if (!agencyId) return null;
  try {
    const agency = await prisma.agencies.findUnique({
      where: { id: agencyId },
      select: { user_id: true }
    });
    return agency?.user_id || null;
  } catch (err) {
    console.error('[notify] getAgencyUserId fallo:', err.message);
    return null;
  }
}

/**
 * Resuelve el user_id de un guia (las notificaciones se dirigen a usuarios).
 * @param {string} guideId
 * @returns {Promise<string|null>}
 */
async function getGuideUserId(guideId) {
  if (!guideId) return null;
  try {
    const guide = await prisma.guides.findUnique({
      where: { id: guideId },
      select: { user_id: true }
    });
    return guide?.user_id || null;
  } catch (err) {
    console.error('[notify] getGuideUserId fallo:', err.message);
    return null;
  }
}

module.exports = { notifyUser, notifyAdmins, getAgencyUserId, getGuideUserId };
