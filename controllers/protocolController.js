// Controller de Protocols
// CRUD para protocolos de emergencia
// Tablas: protocols, protocol_steps

const prisma = require('../config/db');

/**
 * GET /api/emergency/protocols
 * Lista todos los protocolos
 * Query params: status, category_id, search
 * Roles: Admin, Agency, Guide
 */
const listProtocols = async (req, res) => {
  try {
    const { status, category_id, search } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (category_id) {
      where.category_id = category_id;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const protocols = await prisma.protocols.findMany({
      where,
      include: {
        emergency_categories: true,
        protocol_steps: {
          orderBy: { step_number: 'asc' }
        }
      },
      orderBy: [
        { created_at: 'desc' }
      ]
    });

    const items = protocols.map(p => ({
      id: p.id,
      categoryId: p.category_id,
      category: p.emergency_categories ? {
        id: p.emergency_categories.id,
        name: p.emergency_categories.name,
        icon: p.emergency_categories.icon,
        color: p.emergency_categories.color,
        severityLevel: p.emergency_categories.severity_level
      } : null,
      title: p.title,
      description: p.description,
      version: p.version,
      status: p.status,
      priority: p.priority,
      icon: p.icon,
      contacts: (p.contacts || []).map(c => typeof c === 'string' ? JSON.parse(c) : c),
      materialIds: p.material_ids || [],
      createdById: p.created_by,
      approvedById: p.approved_by,
      approvedAt: p.approved_at,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      stepsCount: p.protocol_steps.length,
      steps: p.protocol_steps.map(s => ({
        id: s.id,
        stepNumber: s.step_number,
        title: s.title,
        description: s.description,
        isCritical: s.is_critical
      }))
    }));

    return res.status(200).json({
      success: true,
      data: items,
      total: items.length
    });
  } catch (error) {
    console.error('Error en listProtocols:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar protocolos'
    });
  }
};

/**
 * GET /api/emergency/protocols/:id
 * Obtiene un protocolo por ID con todos sus pasos
 * Roles: Admin, Agency, Guide
 */
const getProtocol = async (req, res) => {
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

    const protocol = await prisma.protocols.findUnique({
      where: { id },
      include: {
        emergency_categories: true,
        users_protocols_created_byTousers: {
          select: { id: true, name: true, email: true }
        },
        users_protocols_approved_byTousers: {
          select: { id: true, name: true, email: true }
        },
        protocol_steps: {
          orderBy: { step_number: 'asc' }
        }
      }
    });

    if (!protocol) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Protocolo no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: protocol.id,
        categoryId: protocol.category_id,
        category: protocol.emergency_categories ? {
          id: protocol.emergency_categories.id,
          name: protocol.emergency_categories.name,
          icon: protocol.emergency_categories.icon,
          color: protocol.emergency_categories.color,
          severityLevel: protocol.emergency_categories.severity_level
        } : null,
        title: protocol.title,
        description: protocol.description,
        version: protocol.version,
        status: protocol.status,
        priority: protocol.priority,
        icon: protocol.icon,
        contacts: (protocol.contacts || []).map(c => typeof c === 'string' ? JSON.parse(c) : c),
        materialIds: protocol.material_ids || [],
        createdBy: protocol.users_protocols_created_byTousers ? {
          id: protocol.users_protocols_created_byTousers.id,
          name: protocol.users_protocols_created_byTousers.name,
          email: protocol.users_protocols_created_byTousers.email
        } : null,
        approvedBy: protocol.users_protocols_approved_byTousers ? {
          id: protocol.users_protocols_approved_byTousers.id,
          name: protocol.users_protocols_approved_byTousers.name,
          email: protocol.users_protocols_approved_byTousers.email
        } : null,
        approvedAt: protocol.approved_at,
        createdAt: protocol.created_at,
        updatedAt: protocol.updated_at,
        steps: protocol.protocol_steps.map(s => ({
          id: s.id,
          stepNumber: s.step_number,
          title: s.title,
          description: s.description,
          isCritical: s.is_critical,
          createdAt: s.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error en getProtocol:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener protocolo'
    });
  }
};

/**
 * POST /api/emergency/protocols
 * Crea un nuevo protocolo con sus pasos
 * Roles: Admin
 */
const createProtocol = async (req, res) => {
  try {
    const { categoryId, title, description, version, steps, priority, icon, content } = req.body;
    const userId = req.user?.id;

    // Extraer contacts y materials de content
    const contacts = content?.contacts || [];
    const materialIds = content?.materials || [];

    // Validaciones
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'categoryId es requerido'
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'title es requerido'
      });
    }

    // Verificar que la categoría existe
    const category = await prisma.emergency_categories.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'La categoría especificada no existe'
      });
    }

    // Crear protocolo con transaction
    const protocol = await prisma.$transaction(async (tx) => {
      // Crear el protocolo con metadata adicional
      const newProtocol = await tx.protocols.create({
        data: {
          category_id: categoryId,
          title: title.trim(),
          description: description ? description.trim() : null,
          version: version || '1.0',
          status: 'draft',
          created_by: userId,
          priority: priority || 'media',
          icon: icon || '🚨',
          contacts: contacts.map(c => JSON.stringify(c)),
          material_ids: materialIds
        }
      });

      // Crear los pasos si existen
      if (steps && Array.isArray(steps) && steps.length > 0) {
        const stepsData = steps.map((step, index) => ({
          protocol_id: newProtocol.id,
          step_number: index + 1,
          title: step.title?.trim() || `Paso ${index + 1}`,
          description: step.description?.trim() || '',
          is_critical: step.isCritical || false
        }));

        await tx.protocol_steps.createMany({
          data: stepsData
        });
      }

      return newProtocol;
    });

    // Obtener el protocolo completo
    const fullProtocol = await prisma.protocols.findUnique({
      where: { id: protocol.id },
      include: {
        emergency_categories: true,
        protocol_steps: {
          orderBy: { step_number: 'asc' }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Protocolo creado exitosamente',
      data: {
        id: fullProtocol.id,
        categoryId: fullProtocol.category_id,
        category: fullProtocol.emergency_categories ? {
          id: fullProtocol.emergency_categories.id,
          name: fullProtocol.emergency_categories.name
        } : null,
        title: fullProtocol.title,
        description: fullProtocol.description,
        version: fullProtocol.version,
        status: fullProtocol.status,
        priority: fullProtocol.priority,
        icon: fullProtocol.icon,
        contacts: (fullProtocol.contacts || []).map(c => typeof c === 'string' ? JSON.parse(c) : c),
        materialIds: fullProtocol.material_ids || [],
        steps: fullProtocol.protocol_steps.map(s => ({
          id: s.id,
          stepNumber: s.step_number,
          title: s.title,
          description: s.description,
          isCritical: s.is_critical
        }))
      }
    });
  } catch (error) {
    console.error('Error en createProtocol:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear protocolo'
    });
  }
};

/**
 * PUT /api/emergency/protocols/:id
 * Actualiza un protocolo y sus pasos
 * Roles: Admin
 */
const updateProtocol = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, title, description, version, status, steps, priority, icon, content } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que existe
    const existing = await prisma.protocols.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Protocolo no encontrado'
      });
    }

    // Si se cambia la categoría, verificar que existe
    if (categoryId && categoryId !== existing.category_id) {
      const category = await prisma.emergency_categories.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'La categoría especificada no existe'
        });
      }
    }

    // Actualizar con transaction
    await prisma.$transaction(async (tx) => {
      // Actualizar protocolo
      const data = { updated_at: new Date() };
      if (categoryId !== undefined) data.category_id = categoryId;
      if (title !== undefined) data.title = title.trim();
      if (description !== undefined) data.description = description ? description.trim() : null;
      if (version !== undefined) data.version = version;
      if (status !== undefined) data.status = status;
      if (priority !== undefined) data.priority = priority;
      if (icon !== undefined) data.icon = icon;
      // Manejar contacts y materials desde content
      if (content?.contacts !== undefined) {
        data.contacts = content.contacts.map(c => JSON.stringify(c));
      }
      if (content?.materials !== undefined) {
        data.material_ids = content.materials;
      }

      await tx.protocols.update({
        where: { id },
        data
      });

      // Si se enviaron pasos, reemplazar todos
      if (steps && Array.isArray(steps)) {
        // Eliminar pasos existentes
        await tx.protocol_steps.deleteMany({
          where: { protocol_id: id }
        });

        // Crear nuevos pasos
        if (steps.length > 0) {
          const stepsData = steps.map((step, index) => ({
            protocol_id: id,
            step_number: index + 1,
            title: step.title?.trim() || `Paso ${index + 1}`,
            description: step.description?.trim() || '',
            is_critical: step.isCritical || false
          }));

          await tx.protocol_steps.createMany({
            data: stepsData
          });
        }
      }
    });

    // Obtener el protocolo actualizado
    const updatedProtocol = await prisma.protocols.findUnique({
      where: { id },
      include: {
        emergency_categories: true,
        protocol_steps: {
          orderBy: { step_number: 'asc' }
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Protocolo actualizado exitosamente',
      data: {
        id: updatedProtocol.id,
        categoryId: updatedProtocol.category_id,
        category: updatedProtocol.emergency_categories ? {
          id: updatedProtocol.emergency_categories.id,
          name: updatedProtocol.emergency_categories.name
        } : null,
        title: updatedProtocol.title,
        description: updatedProtocol.description,
        version: updatedProtocol.version,
        status: updatedProtocol.status,
        priority: updatedProtocol.priority,
        icon: updatedProtocol.icon,
        contacts: (updatedProtocol.contacts || []).map(c => typeof c === 'string' ? JSON.parse(c) : c),
        materialIds: updatedProtocol.material_ids || [],
        steps: updatedProtocol.protocol_steps.map(s => ({
          id: s.id,
          stepNumber: s.step_number,
          title: s.title,
          description: s.description,
          isCritical: s.is_critical
        }))
      }
    });
  } catch (error) {
    console.error('Error en updateProtocol:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar protocolo'
    });
  }
};

/**
 * DELETE /api/emergency/protocols/:id
 * Elimina un protocolo y sus pasos
 * Roles: Admin
 */
const deleteProtocol = async (req, res) => {
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

    // Verificar que existe
    const existing = await prisma.protocols.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Protocolo no encontrado'
      });
    }

    // Verificar si está asociado a tours activos
    const activeTourCount = await prisma.active_tours.count({
      where: { emergency_protocol_id: id }
    });

    if (activeTourCount > 0) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: `No se puede eliminar: está asignado a ${activeTourCount} tour(es) activo(s)`
      });
    }

    // Eliminar con transaction (pasos + protocolo)
    await prisma.$transaction(async (tx) => {
      await tx.protocol_steps.deleteMany({
        where: { protocol_id: id }
      });

      await tx.protocols.delete({
        where: { id }
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Protocolo eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteProtocol:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar protocolo'
    });
  }
};

/**
 * PATCH /api/emergency/protocols/:id/status
 * Cambia el estado de un protocolo (draft, published, archived)
 * Roles: Admin
 */
const updateProtocolStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    const validStatuses = ['draft', 'published', 'archived'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `status debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // Verificar que existe
    const existing = await prisma.protocols.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Protocolo no encontrado'
      });
    }

    // Datos de actualización
    const data = {
      status,
      updated_at: new Date()
    };

    // Si se publica, registrar aprobación
    if (status === 'published' && existing.status !== 'published') {
      data.approved_by = userId;
      data.approved_at = new Date();
    }

    const protocol = await prisma.protocols.update({
      where: { id },
      data
    });

    return res.status(200).json({
      success: true,
      message: `Protocolo ${status === 'published' ? 'publicado' : status === 'archived' ? 'archivado' : 'guardado como borrador'} exitosamente`,
      data: {
        id: protocol.id,
        status: protocol.status,
        approvedAt: protocol.approved_at
      }
    });
  } catch (error) {
    console.error('Error en updateProtocolStatus:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar estado del protocolo'
    });
  }
};

/**
 * POST /api/emergency/protocols/:id/steps
 * Agrega un paso a un protocolo
 * Roles: Admin
 */
const addProtocolStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, isCritical, position } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'title es requerido'
      });
    }

    // Verificar que el protocolo existe
    const protocol = await prisma.protocols.findUnique({
      where: { id },
      include: {
        protocol_steps: {
          orderBy: { step_number: 'asc' }
        }
      }
    });

    if (!protocol) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Protocolo no encontrado'
      });
    }

    // Determinar el número de paso
    const currentMaxStep = protocol.protocol_steps.length > 0
      ? Math.max(...protocol.protocol_steps.map(s => s.step_number))
      : 0;

    let stepNumber = currentMaxStep + 1;

    // Si se especifica posición, reordenar
    if (position !== undefined && position >= 1 && position <= currentMaxStep + 1) {
      stepNumber = position;

      // Incrementar step_number de los pasos siguientes
      await prisma.protocol_steps.updateMany({
        where: {
          protocol_id: id,
          step_number: { gte: position }
        },
        data: {
          step_number: { increment: 1 }
        }
      });
    }

    const step = await prisma.protocol_steps.create({
      data: {
        protocol_id: id,
        step_number: stepNumber,
        title: title.trim(),
        description: description?.trim() || '',
        is_critical: isCritical || false
      }
    });

    // Actualizar timestamp del protocolo
    await prisma.protocols.update({
      where: { id },
      data: { updated_at: new Date() }
    });

    return res.status(201).json({
      success: true,
      message: 'Paso agregado exitosamente',
      data: {
        id: step.id,
        stepNumber: step.step_number,
        title: step.title,
        description: step.description,
        isCritical: step.is_critical
      }
    });
  } catch (error) {
    console.error('Error en addProtocolStep:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al agregar paso'
    });
  }
};

/**
 * PUT /api/emergency/protocols/:protocolId/steps/:stepId
 * Actualiza un paso específico
 * Roles: Admin
 */
const updateProtocolStep = async (req, res) => {
  try {
    const { protocolId, stepId } = req.params;
    const { title, description, isCritical } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(protocolId) || !uuidRegex.test(stepId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'IDs deben ser UUIDs válidos'
      });
    }

    // Verificar que el paso existe y pertenece al protocolo
    const existing = await prisma.protocol_steps.findFirst({
      where: {
        id: stepId,
        protocol_id: protocolId
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Paso no encontrado en este protocolo'
      });
    }

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || '';
    if (isCritical !== undefined) data.is_critical = isCritical;

    const step = await prisma.protocol_steps.update({
      where: { id: stepId },
      data
    });

    // Actualizar timestamp del protocolo
    await prisma.protocols.update({
      where: { id: protocolId },
      data: { updated_at: new Date() }
    });

    return res.status(200).json({
      success: true,
      message: 'Paso actualizado exitosamente',
      data: {
        id: step.id,
        stepNumber: step.step_number,
        title: step.title,
        description: step.description,
        isCritical: step.is_critical
      }
    });
  } catch (error) {
    console.error('Error en updateProtocolStep:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar paso'
    });
  }
};

/**
 * DELETE /api/emergency/protocols/:protocolId/steps/:stepId
 * Elimina un paso y reordena los siguientes
 * Roles: Admin
 */
const deleteProtocolStep = async (req, res) => {
  try {
    const { protocolId, stepId } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(protocolId) || !uuidRegex.test(stepId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'IDs deben ser UUIDs válidos'
      });
    }

    // Verificar que el paso existe y pertenece al protocolo
    const existing = await prisma.protocol_steps.findFirst({
      where: {
        id: stepId,
        protocol_id: protocolId
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Paso no encontrado en este protocolo'
      });
    }

    await prisma.$transaction(async (tx) => {
      // Eliminar el paso
      await tx.protocol_steps.delete({
        where: { id: stepId }
      });

      // Decrementar step_number de los pasos siguientes
      await tx.protocol_steps.updateMany({
        where: {
          protocol_id: protocolId,
          step_number: { gt: existing.step_number }
        },
        data: {
          step_number: { decrement: 1 }
        }
      });

      // Actualizar timestamp del protocolo
      await tx.protocols.update({
        where: { id: protocolId },
        data: { updated_at: new Date() }
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Paso eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteProtocolStep:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar paso'
    });
  }
};

module.exports = {
  listProtocols,
  getProtocol,
  createProtocol,
  updateProtocol,
  deleteProtocol,
  updateProtocolStatus,
  addProtocolStep,
  updateProtocolStep,
  deleteProtocolStep
};
