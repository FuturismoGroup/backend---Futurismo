/**
 * Validador dinamico de metodos de pago
 * Consulta la base de datos para obtener los codigos validos
 */

const prisma = require('../config/db');

// Cache de metodos de pago (se actualiza cada 5 minutos)
let cachedPaymentMethods = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene los codigos de metodos de pago validos de la base de datos
 * @returns {Promise<string[]>} Array de codigos validos
 */
const getValidPaymentMethods = async () => {
  const now = Date.now();

  // Usar cache si es valido
  if (cachedPaymentMethods && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPaymentMethods;
  }

  try {
    const methods = await prisma.payment_methods.findMany({
      where: { is_active: true },
      select: { code: true }
    });

    cachedPaymentMethods = methods.map(m => m.code);
    cacheTimestamp = now;

    return cachedPaymentMethods;
  } catch (error) {
    console.error('Error obteniendo metodos de pago:', error);
    // Fallback a valores por defecto si falla la BD
    return ['cash', 'card', 'transfer', 'pending', 'yape', 'plin'];
  }
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida si un metodo de pago es valido.
 *
 * Acepta dos formatos:
 *   1) un codigo global de payment_methods (cash, yape, bank_transfer, ...)
 *   2) un UUID de agency_payment_methods. En ese caso resuelve a su `type`
 *      (que es un codigo global) para guardar un valor consistente en
 *      reservations.payment_method. Sin esto, las reservas fallan apenas la
 *      agencia configura un metodo de pago propio.
 *
 * @param {string} paymentMethod
 * @param {string} [agencyId] - opcional, requerido para validar UUIDs
 * @returns {Promise<{valid: boolean, validMethods: string[], useDefault?: boolean, resolvedMethod?: string}>}
 */
const validatePaymentMethod = async (paymentMethod, agencyId = null) => {
  const validMethods = await getValidPaymentMethods();

  // Permitir vacio o null (usara default 'pending')
  if (!paymentMethod || paymentMethod === '' || paymentMethod === null) {
    return { valid: true, validMethods, useDefault: true };
  }

  if (validMethods.includes(paymentMethod)) {
    return { valid: true, validMethods, useDefault: false, resolvedMethod: paymentMethod };
  }

  // Si parece UUID, intentar resolverlo contra los metodos de pago de la agencia
  if (UUID_REGEX.test(paymentMethod)) {
    try {
      const where = { id: paymentMethod, is_active: true };
      if (agencyId) where.agency_id = agencyId;
      const agencyMethod = await prisma.agency_payment_methods.findFirst({
        where,
        select: { id: true, type: true, agency_id: true }
      });
      if (agencyMethod && (!agencyId || agencyMethod.agency_id === agencyId)) {
        const resolved = validMethods.includes(agencyMethod.type) ? agencyMethod.type : agencyMethod.type;
        return { valid: true, validMethods, useDefault: false, resolvedMethod: resolved };
      }
    } catch (error) {
      console.error('Error resolviendo agency_payment_method:', error);
    }
  }

  return {
    valid: false,
    validMethods,
    useDefault: false
  };
};

/**
 * Limpia el cache (util para tests o cuando se actualizan metodos)
 */
const clearCache = () => {
  cachedPaymentMethods = null;
  cacheTimestamp = null;
};

module.exports = {
  getValidPaymentMethods,
  validatePaymentMethod,
  clearCache
};
