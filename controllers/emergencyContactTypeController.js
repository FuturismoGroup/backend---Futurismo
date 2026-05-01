// Controller de Emergency Contact Types
// CRUD para tipos de contacto de emergencia
// Tabla: emergency_contact_types

const prisma = require('../config/db');

/**
 * GET /api/emergency/contact-types
 * Lista todos los tipos de contacto de emergencia
 * Roles: Admin
 */
const listContactTypes = async (req, res) => {
  try {
    const types = await prisma.emergency_contact_types.findMany({
      where: { is_active: true },
      orderBy: { priority: 'asc' }
    });

    const items = types.map(t => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      description: t.description,
      color: t.color,
      priority: t.priority,
      isActive: t.is_active,
      createdAt: t.created_at
    }));

    return res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error en listContactTypes:', error);

    // Si la tabla no existe, devolver array vacío con mensaje
    if (error.code === 'P2021' || error.message.includes('does not exist')) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Tabla emergency_contact_types no existe. Ejecutar migración.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar tipos de contacto'
    });
  }
};

/**
 * GET /api/emergency/contact-types/:id
 * Obtiene un tipo de contacto por ID
 * Roles: Admin
 */
const getContactType = async (req, res) => {
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

    const type = await prisma.emergency_contact_types.findUnique({
      where: { id }
    });

    if (!type) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tipo de contacto no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: type.id,
        name: type.name,
        icon: type.icon,
        description: type.description,
        color: type.color,
        priority: type.priority,
        isActive: type.is_active,
        createdAt: type.created_at
      }
    });
  } catch (error) {
    console.error('Error en getContactType:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener tipo de contacto'
    });
  }
};

/**
 * POST /api/emergency/contact-types
 * Crea un nuevo tipo de contacto
 * Roles: Admin
 */
const createContactType = async (req, res) => {
  try {
    const { name, icon, description, color, priority } = req.body;

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name es requerido'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'description es requerida'
      });
    }

    // Verificar que el nombre no exista
    const existing = await prisma.emergency_contact_types.findFirst({
      where: { name: name.trim() }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe un tipo de contacto con ese nombre'
      });
    }

    // Determinar prioridad si no se proporciona
    let finalPriority = priority;
    if (!priority) {
      const maxPriority = await prisma.emergency_contact_types.aggregate({
        _max: { priority: true }
      });
      finalPriority = (maxPriority._max.priority || 0) + 1;
    }

    const type = await prisma.emergency_contact_types.create({
      data: {
        name: name.trim(),
        icon: icon || '📞',
        description: description.trim(),
        color: color || '#6B7280',
        priority: finalPriority,
        is_active: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Tipo de contacto creado exitosamente',
      data: {
        id: type.id,
        name: type.name,
        icon: type.icon,
        description: type.description,
        color: type.color,
        priority: type.priority,
        isActive: type.is_active
      }
    });
  } catch (error) {
    console.error('Error en createContactType:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear tipo de contacto'
    });
  }
};

/**
 * PUT /api/emergency/contact-types/:id
 * Actualiza un tipo de contacto
 * Roles: Admin
 */
const updateContactType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, description, color, priority } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que existe
    const existing = await prisma.emergency_contact_types.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tipo de contacto no encontrado'
      });
    }

    // Si se cambia el nombre, verificar que no exista otro con ese nombre
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.emergency_contact_types.findFirst({
        where: {
          name: name.trim(),
          id: { not: id }
        }
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Ya existe un tipo de contacto con ese nombre'
        });
      }
    }

    // Construir datos de actualización
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (icon !== undefined) data.icon = icon;
    if (description !== undefined) data.description = description.trim();
    if (color !== undefined) data.color = color;
    if (priority !== undefined) data.priority = priority;

    const type = await prisma.emergency_contact_types.update({
      where: { id },
      data
    });

    return res.status(200).json({
      success: true,
      message: 'Tipo de contacto actualizado exitosamente',
      data: {
        id: type.id,
        name: type.name,
        icon: type.icon,
        description: type.description,
        color: type.color,
        priority: type.priority,
        isActive: type.is_active
      }
    });
  } catch (error) {
    console.error('Error en updateContactType:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar tipo de contacto'
    });
  }
};

/**
 * DELETE /api/emergency/contact-types/:id
 * Elimina un tipo de contacto (soft delete)
 * Roles: Admin
 */
const deleteContactType = async (req, res) => {
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
    const existing = await prisma.emergency_contact_types.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tipo de contacto no encontrado'
      });
    }

    // Soft delete
    await prisma.emergency_contact_types.update({
      where: { id },
      data: { is_active: false }
    });

    return res.status(200).json({
      success: true,
      message: 'Tipo de contacto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteContactType:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar tipo de contacto'
    });
  }
};

module.exports = {
  listContactTypes,
  getContactType,
  createContactType,
  updateContactType,
  deleteContactType
};
