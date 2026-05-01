// Controller de Emergency Categories
// CRUD para categorías de emergencia
// Tabla: emergency_categories

const prisma = require('../config/db');

/**
 * GET /api/emergency/categories
 * Lista todas las categorías de emergencia activas
 * Roles: Admin
 */
const listCategories = async (req, res) => {
  try {
    const categories = await prisma.emergency_categories.findMany({
      where: { is_active: true },
      orderBy: { severity_level: 'desc' }
    });

    const items = categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      description: c.description,
      color: c.color,
      severityLevel: c.severity_level,
      isActive: c.is_active,
      createdAt: c.created_at
    }));

    return res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error en listCategories:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar categorías de emergencia'
    });
  }
};

/**
 * GET /api/emergency/categories/:id
 * Obtiene una categoría por ID
 * Roles: Admin
 */
const getCategory = async (req, res) => {
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

    const category = await prisma.emergency_categories.findUnique({
      where: { id }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Categoría no encontrada'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        description: category.description,
        color: category.color,
        severityLevel: category.severity_level,
        isActive: category.is_active,
        createdAt: category.created_at
      }
    });
  } catch (error) {
    console.error('Error en getCategory:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener categoría'
    });
  }
};

/**
 * POST /api/emergency/categories
 * Crea una nueva categoría de emergencia
 * Roles: Admin
 */
const createCategory = async (req, res) => {
  try {
    const { name, icon, description, color, severityLevel } = req.body;

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name es requerido'
      });
    }

    // Verificar que el nombre no exista
    const existing = await prisma.emergency_categories.findFirst({
      where: { name: name.trim() }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe una categoría con ese nombre'
      });
    }

    const category = await prisma.emergency_categories.create({
      data: {
        name: name.trim(),
        icon: icon || '🚑',
        description: description ? description.trim() : null,
        color: color || '#EF4444',
        severity_level: severityLevel || 1,
        is_active: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        description: category.description,
        color: category.color,
        severityLevel: category.severity_level,
        isActive: category.is_active
      }
    });
  } catch (error) {
    console.error('Error en createCategory:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear categoría'
    });
  }
};

/**
 * PUT /api/emergency/categories/:id
 * Actualiza una categoría de emergencia
 * Roles: Admin
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, description, color, severityLevel } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que existe
    const existing = await prisma.emergency_categories.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Categoría no encontrada'
      });
    }

    // Si se cambia el nombre, verificar que no exista otro con ese nombre
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.emergency_categories.findFirst({
        where: {
          name: name.trim(),
          id: { not: id }
        }
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Ya existe una categoría con ese nombre'
        });
      }
    }

    // Construir datos de actualización
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (icon !== undefined) data.icon = icon;
    if (description !== undefined) data.description = description ? description.trim() : null;
    if (color !== undefined) data.color = color;
    if (severityLevel !== undefined) data.severity_level = severityLevel;

    const category = await prisma.emergency_categories.update({
      where: { id },
      data
    });

    return res.status(200).json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        description: category.description,
        color: category.color,
        severityLevel: category.severity_level,
        isActive: category.is_active
      }
    });
  } catch (error) {
    console.error('Error en updateCategory:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar categoría'
    });
  }
};

/**
 * DELETE /api/emergency/categories/:id
 * Elimina una categoría (soft delete)
 * Roles: Admin
 */
const deleteCategory = async (req, res) => {
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
    const existing = await prisma.emergency_categories.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Categoría no encontrada'
      });
    }

    // Verificar si tiene protocolos asociados
    const protocolCount = await prisma.protocols.count({
      where: { category_id: id }
    });

    if (protocolCount > 0) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: `No se puede eliminar: tiene ${protocolCount} protocolo(s) asociado(s)`
      });
    }

    // Soft delete
    await prisma.emergency_categories.update({
      where: { id },
      data: { is_active: false }
    });

    return res.status(200).json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteCategory:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar categoría'
    });
  }
};

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
};
