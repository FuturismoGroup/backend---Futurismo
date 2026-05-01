// Controller de Reward Categories
// Fuente: ELM-378 CategoryManager
// Tabla: reward_categories (TBL-009)
// Flujo: FLW-107 Gestionar categorias de premios

const prisma = require('../config/db');

/**
 * GET /api/rewards/categories
 * Lista todas las categorias de premios activas
 * Roles: Admin
 */
const listCategories = async (req, res) => {
  try {
    const categories = await prisma.reward_categories.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        icon: cat.icon || 'gift',
        color: cat.color || '#3B82F6'
      }))
    });
  } catch (error) {
    console.error('Error en listCategories:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener categorias'
    });
  }
};

/**
 * GET /api/rewards/categories/:id
 * Obtiene una categoria por ID
 * Roles: Admin
 */
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de categoria invalido'
      });
    }

    const category = await prisma.reward_categories.findUnique({
      where: { id }
    });

    if (!category || !category.active) {
      return res.status(404).json({
        success: false,
        error: 'Categoria no encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon || 'gift',
        color: category.color || '#3B82F6'
      }
    });
  } catch (error) {
    console.error('Error en getCategory:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener categoria'
    });
  }
};

/**
 * POST /api/rewards/categories
 * Crea una nueva categoria de premios
 * Roles: Admin
 */
const createCategory = async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido'
      });
    }

    // Verificar nombre unico
    const existing = await prisma.reward_categories.findFirst({
      where: {
        name: name.trim(),
        active: true
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una categoria con ese nombre'
      });
    }

    const category = await prisma.reward_categories.create({
      data: {
        name: name.trim(),
        description: description || null,
        icon: icon || 'gift',
        color: color || '#3B82F6',
        active: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Categoria creada correctamente',
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color
      }
    });
  } catch (error) {
    console.error('Error en createCategory:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear categoria'
    });
  }
};

/**
 * PUT /api/rewards/categories/:id
 * Actualiza una categoria
 * Roles: Admin
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de categoria invalido'
      });
    }

    // Validar nombre
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El nombre es requerido'
      });
    }

    // Verificar que existe
    const existing = await prisma.reward_categories.findUnique({
      where: { id }
    });

    if (!existing || !existing.active) {
      return res.status(404).json({
        success: false,
        error: 'Categoria no encontrada'
      });
    }

    // Verificar nombre unico (excluyendo la actual)
    const duplicate = await prisma.reward_categories.findFirst({
      where: {
        name: name.trim(),
        active: true,
        NOT: { id }
      }
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe otra categoria con ese nombre'
      });
    }

    const category = await prisma.reward_categories.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description !== undefined ? description : existing.description,
        icon: icon || existing.icon || 'gift',
        color: color || existing.color || '#3B82F6'
      }
    });

    res.json({
      success: true,
      message: 'Categoria actualizada correctamente',
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color
      }
    });
  } catch (error) {
    console.error('Error en updateCategory:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar categoria'
    });
  }
};

/**
 * DELETE /api/rewards/categories/:id
 * Elimina una categoria (soft delete)
 * Roles: Admin
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de categoria invalido'
      });
    }

    // Verificar que existe
    const existing = await prisma.reward_categories.findUnique({
      where: { id },
      include: {
        rewards: {
          where: { active: true }
        }
      }
    });

    if (!existing || !existing.active) {
      return res.status(404).json({
        success: false,
        error: 'Categoria no encontrada'
      });
    }

    // Verificar que no tiene premios activos
    if (existing.rewards && existing.rewards.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'No se puede eliminar una categoria con premios asociados'
      });
    }

    // Soft delete
    await prisma.reward_categories.update({
      where: { id },
      data: { active: false }
    });

    res.json({
      success: true,
      message: 'Categoria eliminada correctamente'
    });
  } catch (error) {
    console.error('Error en deleteCategory:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar categoria'
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
