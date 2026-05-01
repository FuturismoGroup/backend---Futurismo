/**
 * Controlador para métodos de pago del sistema (admin/Futurismo Tours)
 * CRUD completo para gestionar los métodos de pago propios de la empresa
 */

const prisma = require('../config/db');

// Tipos de pago válidos
const VALID_TYPES = ['credit_card', 'debit_card', 'bank_transfer', 'cash', 'yape', 'plin'];

/**
 * Mapear campos de BD (snake_case) a respuesta API (camelCase)
 */
const mapToResponse = (pm) => ({
  id: pm.id,
  type: pm.type,
  label: pm.label,
  bank: pm.bank,
  accountNumber: pm.account_number,
  cci: pm.cci,
  cardNumber: pm.card_number,
  phoneNumber: pm.phone_number,
  holderName: pm.holder_name,
  currency: pm.currency,
  accountType: pm.account_type,
  cardType: pm.card_type,
  expiryDate: pm.expiry_date,
  description: pm.description,
  isMain: pm.is_main,
  isActive: pm.is_active,
  sortOrder: pm.sort_order,
  createdAt: pm.created_at,
  updatedAt: pm.updated_at
});

/**
 * Validar campos requeridos según el tipo de método
 */
const validateRequiredFields = (type, data) => {
  const errors = [];

  switch (type) {
    case 'bank_transfer':
      if (!data.bank) errors.push('El banco es requerido para transferencia bancaria');
      if (!data.accountNumber && !data.account_number) errors.push('El número de cuenta es requerido');
      break;
    case 'credit_card':
    case 'debit_card':
      if (!data.cardNumber && !data.card_number) errors.push('El número de tarjeta es requerido');
      break;
    case 'yape':
    case 'plin':
      if (!data.phoneNumber && !data.phone_number) errors.push('El número de teléfono es requerido');
      break;
    case 'cash':
      // Cash no requiere campos adicionales
      break;
  }

  return errors;
};

/**
 * GET /api/system/payment-methods
 * Listar todos los métodos de pago del sistema
 */
const listSystemPaymentMethods = async (req, res) => {
  try {
    const methods = await prisma.system_payment_methods.findMany({
      orderBy: [
        { is_main: 'desc' },
        { sort_order: 'asc' },
        { created_at: 'asc' }
      ]
    });

    return res.json({
      success: true,
      data: methods.map(mapToResponse)
    });
  } catch (error) {
    console.error('Error al listar métodos de pago del sistema:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * POST /api/system/payment-methods
 * Crear nuevo método de pago del sistema
 */
const createSystemPaymentMethod = async (req, res) => {
  try {
    const {
      type,
      label,
      bank,
      accountNumber,
      cci,
      cardNumber,
      phoneNumber,
      holderName,
      currency = 'PEN',
      accountType,
      cardType,
      expiryDate,
      description,
      isMain = false
    } = req.body;

    // Validar tipo
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Tipo inválido. Tipos permitidos: ${VALID_TYPES.join(', ')}`
      });
    }

    // Validar campos requeridos según tipo
    const validationErrors = validateRequiredFields(type, req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: validationErrors.join('. ')
      });
    }

    // Si es main, desactivar el flag en los demás
    if (isMain) {
      await prisma.system_payment_methods.updateMany({
        where: { is_main: true },
        data: { is_main: false }
      });
    }

    // Obtener el máximo sort_order actual
    const maxSort = await prisma.system_payment_methods.aggregate({
      _max: { sort_order: true }
    });
    const nextSortOrder = (maxSort._max.sort_order || 0) + 1;

    // Crear el método de pago
    const newMethod = await prisma.system_payment_methods.create({
      data: {
        type,
        label: label || null,
        bank: bank || null,
        account_number: accountNumber || null,
        cci: cci || null,
        card_number: cardNumber || null,
        phone_number: phoneNumber || null,
        holder_name: holderName || null,
        currency,
        account_type: accountType || null,
        card_type: cardType || null,
        expiry_date: expiryDate || null,
        description: description || null,
        is_main: isMain,
        is_active: true,
        sort_order: nextSortOrder
      }
    });

    return res.status(201).json({
      success: true,
      data: mapToResponse(newMethod)
    });
  } catch (error) {
    console.error('Error al crear método de pago del sistema:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * PUT /api/system/payment-methods/:id
 * Actualizar método de pago del sistema
 */
const updateSystemPaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      label,
      bank,
      accountNumber,
      cci,
      cardNumber,
      phoneNumber,
      holderName,
      currency,
      accountType,
      cardType,
      expiryDate,
      description,
      isMain,
      isActive,
      sortOrder
    } = req.body;

    // Verificar que existe
    const existing = await prisma.system_payment_methods.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Método de pago no encontrado'
      });
    }

    // Validar tipo si se proporciona
    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Tipo inválido. Tipos permitidos: ${VALID_TYPES.join(', ')}`
      });
    }

    // Si se marca como main, desactivar los demás
    if (isMain === true) {
      await prisma.system_payment_methods.updateMany({
        where: {
          is_main: true,
          id: { not: id }
        },
        data: { is_main: false }
      });
    }

    // Preparar datos de actualización
    const updateData = {
      updated_at: new Date()
    };

    if (type !== undefined) updateData.type = type;
    if (label !== undefined) updateData.label = label;
    if (bank !== undefined) updateData.bank = bank;
    if (accountNumber !== undefined) updateData.account_number = accountNumber;
    if (cci !== undefined) updateData.cci = cci;
    if (cardNumber !== undefined) updateData.card_number = cardNumber;
    if (phoneNumber !== undefined) updateData.phone_number = phoneNumber;
    if (holderName !== undefined) updateData.holder_name = holderName;
    if (currency !== undefined) updateData.currency = currency;
    if (accountType !== undefined) updateData.account_type = accountType;
    if (cardType !== undefined) updateData.card_type = cardType;
    if (expiryDate !== undefined) updateData.expiry_date = expiryDate;
    if (description !== undefined) updateData.description = description;
    if (isMain !== undefined) updateData.is_main = isMain;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;

    const updated = await prisma.system_payment_methods.update({
      where: { id },
      data: updateData
    });

    return res.json({
      success: true,
      data: mapToResponse(updated)
    });
  } catch (error) {
    console.error('Error al actualizar método de pago del sistema:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * DELETE /api/system/payment-methods/:id
 * Eliminar método de pago del sistema
 */
const deleteSystemPaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existing = await prisma.system_payment_methods.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Método de pago no encontrado'
      });
    }

    await prisma.system_payment_methods.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: 'Método de pago eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar método de pago del sistema:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * PATCH /api/system/payment-methods/:id/toggle
 * Activar/desactivar método de pago del sistema
 */
const toggleSystemPaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existing = await prisma.system_payment_methods.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Método de pago no encontrado'
      });
    }

    const updated = await prisma.system_payment_methods.update({
      where: { id },
      data: {
        is_active: !existing.is_active,
        updated_at: new Date()
      }
    });

    return res.json({
      success: true,
      data: mapToResponse(updated)
    });
  } catch (error) {
    console.error('Error al cambiar estado del método de pago:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

module.exports = {
  listSystemPaymentMethods,
  createSystemPaymentMethod,
  updateSystemPaymentMethod,
  deleteSystemPaymentMethod,
  toggleSystemPaymentMethod
};
