// Controller de Agency Payment Methods
// CRUD para métodos de pago por agencia (tabla agency_payment_methods)

const prisma = require('../config/db');

const VALID_TYPES = ['credit_card', 'debit_card', 'bank_transfer', 'cash', 'yape', 'plin'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mapeo snake_case (DB) -> camelCase (response)
const mapToResponse = (row) => ({
  id: row.id,
  agencyId: row.agency_id,
  type: row.type,
  label: row.label,
  bank: row.bank,
  accountNumber: row.account_number,
  cci: row.cci,
  cardNumber: row.card_number,
  phoneNumber: row.phone_number,
  holderName: row.holder_name,
  currency: row.currency,
  accountType: row.account_type,
  cardType: row.card_type,
  expiryDate: row.expiry_date,
  description: row.description,
  isMain: row.is_main,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Validar campos requeridos según tipo
const validateRequiredFields = (type, data) => {
  const errors = [];

  switch (type) {
    case 'bank_transfer':
      if (!data.holderName) errors.push('holderName es requerido para transferencia bancaria');
      break;
    case 'credit_card':
    case 'debit_card':
      if (!data.holderName) errors.push('holderName es requerido para tarjeta');
      break;
    case 'yape':
    case 'plin':
      if (!data.phoneNumber) errors.push('phoneNumber es requerido para ' + type);
      if (!data.holderName) errors.push('holderName es requerido para ' + type);
      break;
    case 'cash':
      break;
  }

  return errors;
};

/**
 * GET /api/agencies/:agencyId/payment-methods
 * Lista métodos de pago de una agencia
 */
const listAgencyPaymentMethods = async (req, res) => {
  try {
    const { agencyId } = req.params;

    if (!UUID_REGEX.test(agencyId)) {
      return res.status(400).json({ success: false, error: 'ID de agencia inválido' });
    }

    // Verificar acceso
    if (req.user.role === 'agency' && req.user.agencyId !== agencyId) {
      return res.status(403).json({ success: false, error: 'No autorizado para ver estos métodos de pago' });
    }

    const methods = await prisma.agency_payment_methods.findMany({
      where: { agency_id: agencyId },
      orderBy: [{ is_main: 'desc' }, { sort_order: 'asc' }, { created_at: 'asc' }]
    });

    res.json({
      success: true,
      data: methods.map(mapToResponse)
    });
  } catch (error) {
    console.error('Error en listAgencyPaymentMethods:', error);
    res.status(500).json({ success: false, error: 'Error al obtener métodos de pago' });
  }
};

/**
 * POST /api/agencies/:agencyId/payment-methods
 * Crear método de pago para una agencia
 */
const createAgencyPaymentMethod = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const body = req.body;

    if (!UUID_REGEX.test(agencyId)) {
      return res.status(400).json({ success: false, error: 'ID de agencia inválido' });
    }

    if (req.user.role === 'agency' && req.user.agencyId !== agencyId) {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    // Validar type
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return res.status(400).json({
        success: false,
        error: `type debe ser uno de: ${VALID_TYPES.join(', ')}`
      });
    }

    // Validar campos requeridos según tipo
    const validationErrors = validateRequiredFields(body.type, body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, error: validationErrors.join('; ') });
    }

    // Verificar que la agencia existe
    const agency = await prisma.agencies.findUnique({ where: { id: agencyId } });
    if (!agency) {
      return res.status(404).json({ success: false, error: 'Agencia no encontrada' });
    }

    // Calcular sort_order
    const maxOrder = await prisma.agency_payment_methods.aggregate({
      where: { agency_id: agencyId },
      _max: { sort_order: true }
    });
    const nextOrder = (maxOrder._max.sort_order ?? -1) + 1;

    // Si isMain=true, desactivar flag en los demás
    const createData = {
      agency_id: agencyId,
      type: body.type,
      label: body.label || null,
      bank: body.bank || null,
      account_number: body.accountNumber || null,
      cci: body.cci || null,
      card_number: body.cardNumber || null,
      phone_number: body.phoneNumber || null,
      holder_name: body.holderName || null,
      currency: body.currency || 'PEN',
      account_type: body.accountType || null,
      card_type: body.cardType || null,
      expiry_date: body.expiryDate || null,
      description: body.description || null,
      is_main: body.isMain || false,
      is_active: body.isActive !== false,
      sort_order: nextOrder
    };

    let method;
    if (createData.is_main) {
      method = await prisma.$transaction(async (tx) => {
        await tx.agency_payment_methods.updateMany({
          where: { agency_id: agencyId, is_main: true },
          data: { is_main: false }
        });
        return tx.agency_payment_methods.create({ data: createData });
      });
    } else {
      method = await prisma.agency_payment_methods.create({ data: createData });
    }

    res.status(201).json({
      success: true,
      data: mapToResponse(method)
    });
  } catch (error) {
    console.error('Error en createAgencyPaymentMethod:', error);
    res.status(500).json({ success: false, error: 'Error al crear método de pago' });
  }
};

/**
 * PUT /api/agencies/:agencyId/payment-methods/:id
 * Actualizar método de pago
 */
const updateAgencyPaymentMethod = async (req, res) => {
  try {
    const { agencyId, id } = req.params;
    const body = req.body;

    if (!UUID_REGEX.test(agencyId) || !UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    if (req.user.role === 'agency' && req.user.agencyId !== agencyId) {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    const existing = await prisma.agency_payment_methods.findFirst({
      where: { id, agency_id: agencyId }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Método de pago no encontrado' });
    }

    // Validar type si se envía
    if (body.type && !VALID_TYPES.includes(body.type)) {
      return res.status(400).json({
        success: false,
        error: `type debe ser uno de: ${VALID_TYPES.join(', ')}`
      });
    }

    const updateData = { updated_at: new Date() };
    if (body.type !== undefined) updateData.type = body.type;
    if (body.label !== undefined) updateData.label = body.label;
    if (body.bank !== undefined) updateData.bank = body.bank;
    if (body.accountNumber !== undefined) updateData.account_number = body.accountNumber;
    if (body.cci !== undefined) updateData.cci = body.cci;
    if (body.cardNumber !== undefined) updateData.card_number = body.cardNumber;
    if (body.phoneNumber !== undefined) updateData.phone_number = body.phoneNumber;
    if (body.holderName !== undefined) updateData.holder_name = body.holderName;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.accountType !== undefined) updateData.account_type = body.accountType;
    if (body.cardType !== undefined) updateData.card_type = body.cardType;
    if (body.expiryDate !== undefined) updateData.expiry_date = body.expiryDate;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.sortOrder !== undefined) updateData.sort_order = body.sortOrder;

    let method;
    if (body.isMain === true) {
      method = await prisma.$transaction(async (tx) => {
        await tx.agency_payment_methods.updateMany({
          where: { agency_id: agencyId, is_main: true },
          data: { is_main: false }
        });
        updateData.is_main = true;
        return tx.agency_payment_methods.update({ where: { id }, data: updateData });
      });
    } else {
      if (body.isMain === false) updateData.is_main = false;
      method = await prisma.agency_payment_methods.update({ where: { id }, data: updateData });
    }

    res.json({
      success: true,
      data: mapToResponse(method)
    });
  } catch (error) {
    console.error('Error en updateAgencyPaymentMethod:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar método de pago' });
  }
};

/**
 * DELETE /api/agencies/:agencyId/payment-methods/:id
 * Eliminar método de pago
 */
const deleteAgencyPaymentMethod = async (req, res) => {
  try {
    const { agencyId, id } = req.params;

    if (!UUID_REGEX.test(agencyId) || !UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    if (req.user.role === 'agency' && req.user.agencyId !== agencyId) {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    const existing = await prisma.agency_payment_methods.findFirst({
      where: { id, agency_id: agencyId }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Método de pago no encontrado' });
    }

    await prisma.agency_payment_methods.delete({ where: { id } });

    res.json({ success: true, message: 'Método de pago eliminado' });
  } catch (error) {
    console.error('Error en deleteAgencyPaymentMethod:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar método de pago' });
  }
};

/**
 * PATCH /api/agencies/:agencyId/payment-methods/:id/toggle
 * Toggle activar/desactivar método de pago
 */
const toggleAgencyPaymentMethod = async (req, res) => {
  try {
    const { agencyId, id } = req.params;

    if (!UUID_REGEX.test(agencyId) || !UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    if (req.user.role === 'agency' && req.user.agencyId !== agencyId) {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    const existing = await prisma.agency_payment_methods.findFirst({
      where: { id, agency_id: agencyId }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Método de pago no encontrado' });
    }

    const method = await prisma.agency_payment_methods.update({
      where: { id },
      data: {
        is_active: !existing.is_active,
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      data: mapToResponse(method)
    });
  } catch (error) {
    console.error('Error en toggleAgencyPaymentMethod:', error);
    res.status(500).json({ success: false, error: 'Error al cambiar estado del método de pago' });
  }
};

module.exports = {
  listAgencyPaymentMethods,
  createAgencyPaymentMethod,
  updateAgencyPaymentMethod,
  deleteAgencyPaymentMethod,
  toggleAgencyPaymentMethod
};
