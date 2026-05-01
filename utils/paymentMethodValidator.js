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

/**
 * Valida si un metodo de pago es valido
 * @param {string} paymentMethod - Codigo del metodo de pago
 * @returns {Promise<{valid: boolean, validMethods: string[]}>}
 */
const validatePaymentMethod = async (paymentMethod) => {
  const validMethods = await getValidPaymentMethods();

  // Permitir vacio o null (usara default 'pending')
  if (!paymentMethod || paymentMethod === '' || paymentMethod === null) {
    return { valid: true, validMethods, useDefault: true };
  }

  const isValid = validMethods.includes(paymentMethod);

  return {
    valid: isValid,
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
