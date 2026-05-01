// Controller de Emergency Materials
// CRUD para materiales de emergencia
// Tablas: emergency_materials, emergency_material_items

const prisma = require('../config/db');

/**
 * Helper: Mapea un material de BD a formato de respuesta API
 * @param {Object} material - Material de la BD
 * @param {Array} items - Items del material (opcional)
 * @returns {Object} Material formateado para API
 */
const mapMaterialToResponse = (material, items = []) => ({
  id: material.id,
  name: material.name,
  category: material.category,
  description: material.description,
  quantity: material.quantity,
  unit: material.unit,
  isMandatory: material.is_mandatory,
  mandatory: material.is_mandatory, // Alias para frontend
  icon: material.icon,
  notes: material.notes,
  items: items.map(item => item.name), // Array de strings para el frontend
  isActive: material.is_active,
  createdAt: material.created_at,
  updatedAt: material.updated_at
});

/**
 * GET /api/emergency/materials
 * Lista todos los materiales de emergencia activos
 * Query params: category, mandatory, search
 * Roles: Admin, Agency, Guide
 */
const listMaterials = async (req, res) => {
  try {
    const { category, mandatory, search } = req.query;

    const where = { is_active: true };

    if (category) {
      where.category = category;
    }

    if (mandatory !== undefined) {
      where.is_mandatory = mandatory === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const materials = await prisma.emergency_materials.findMany({
      where,
      orderBy: [
        { is_mandatory: 'desc' },
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    // Obtener los items de todos los materiales
    const materialIds = materials.map(m => m.id);
    let allItems = [];

    // Verificar si la tabla emergency_material_items existe
    try {
      allItems = await prisma.emergency_material_items.findMany({
        where: { material_id: { in: materialIds } },
        orderBy: { order_index: 'asc' }
      });
    } catch (e) {
      // La tabla puede no existir aún, continuar sin items
      console.log('Tabla emergency_material_items no disponible aún');
    }

    // Agrupar items por material_id
    const itemsByMaterial = {};
    allItems.forEach(item => {
      if (!itemsByMaterial[item.material_id]) {
        itemsByMaterial[item.material_id] = [];
      }
      itemsByMaterial[item.material_id].push(item);
    });

    // Mapear materiales con sus items
    const mappedMaterials = materials.map(m =>
      mapMaterialToResponse(m, itemsByMaterial[m.id] || [])
    );

    // Estadísticas para MaterialStats
    const allMaterialsForStats = await prisma.emergency_materials.findMany({
      where: { is_active: true }
    });

    const categories = [...new Set(allMaterialsForStats.map(m => m.category))];
    const mandatoryCount = allMaterialsForStats.filter(m => m.is_mandatory).length;

    return res.status(200).json({
      success: true,
      data: mappedMaterials,
      stats: {
        total: allMaterialsForStats.length,
        mandatory: mandatoryCount,
        categories: categories.length,
        filtered: mappedMaterials.length
      }
    });
  } catch (error) {
    console.error('Error en listMaterials:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar materiales de emergencia'
    });
  }
};

/**
 * GET /api/emergency/materials/categories
 * Lista las categorías únicas de materiales
 * Roles: Admin, Agency, Guide
 */
const listCategories = async (req, res) => {
  try {
    const materials = await prisma.emergency_materials.findMany({
      where: { is_active: true },
      select: { category: true },
      distinct: ['category']
    });

    const categories = materials.map(m => m.category).sort();

    return res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error en listCategories:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar categorías'
    });
  }
};

/**
 * GET /api/emergency/materials/:id
 * Obtiene un material por ID
 * Roles: Admin, Agency, Guide
 */
const getMaterial = async (req, res) => {
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

    const material = await prisma.emergency_materials.findUnique({
      where: { id }
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Material no encontrado'
      });
    }

    // Obtener los items del material
    let items = [];
    try {
      items = await prisma.emergency_material_items.findMany({
        where: { material_id: id },
        orderBy: { order_index: 'asc' }
      });
    } catch (e) {
      // La tabla puede no existir aún
    }

    return res.status(200).json({
      success: true,
      data: mapMaterialToResponse(material, items)
    });
  } catch (error) {
    console.error('Error en getMaterial:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener material'
    });
  }
};

/**
 * POST /api/emergency/materials
 * Crea un nuevo material de emergencia
 * Roles: Admin
 */
const createMaterial = async (req, res) => {
  try {
    const { name, category, description, quantity, unit, isMandatory, mandatory, icon, notes, items } = req.body;

    // Resolver mandatory vs isMandatory (frontend envía "mandatory", backend espera "isMandatory")
    const isMandatoryValue = isMandatory !== undefined ? isMandatory : (mandatory || false);

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name es requerido'
      });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'category es requerido'
      });
    }

    // Verificar que el nombre no exista en la misma categoría
    const existing = await prisma.emergency_materials.findFirst({
      where: {
        name: name.trim(),
        category: category.trim()
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe un material con ese nombre en esa categoría'
      });
    }

    // Usar transacción para crear material e items
    const result = await prisma.$transaction(async (tx) => {
      // Crear el material
      const material = await tx.emergency_materials.create({
        data: {
          name: name.trim(),
          category: category.trim(),
          description: description ? description.trim() : null,
          quantity: quantity || 1,
          unit: unit || 'unidad',
          is_mandatory: isMandatoryValue,
          icon: icon || '📦',
          notes: notes ? notes.trim() : null,
          is_active: true
        }
      });

      // Crear los items si existen y la tabla está disponible
      let createdItems = [];
      if (items && Array.isArray(items) && items.length > 0) {
        try {
          const itemsData = items
            .filter(item => item && item.trim())
            .map((item, index) => ({
              material_id: material.id,
              name: item.trim(),
              order_index: index
            }));

          if (itemsData.length > 0) {
            await tx.emergency_material_items.createMany({
              data: itemsData
            });

            createdItems = await tx.emergency_material_items.findMany({
              where: { material_id: material.id },
              orderBy: { order_index: 'asc' }
            });
          }
        } catch (e) {
          console.log('Tabla emergency_material_items no disponible aún, items no guardados:', e.message);
        }
      }

      return { material, items: createdItems };
    });

    return res.status(201).json({
      success: true,
      message: 'Material creado exitosamente',
      data: mapMaterialToResponse(result.material, result.items)
    });
  } catch (error) {
    console.error('Error en createMaterial:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear material'
    });
  }
};

/**
 * PUT /api/emergency/materials/:id
 * Actualiza un material de emergencia
 * Roles: Admin
 */
const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, quantity, unit, isMandatory, mandatory, icon, notes, items } = req.body;

    // Resolver mandatory vs isMandatory
    const isMandatoryValue = isMandatory !== undefined ? isMandatory : mandatory;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que existe
    const existing = await prisma.emergency_materials.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Material no encontrado'
      });
    }

    // Si se cambia nombre+categoría, verificar que no exista otro
    if ((name && name.trim() !== existing.name) || (category && category.trim() !== existing.category)) {
      const duplicate = await prisma.emergency_materials.findFirst({
        where: {
          name: name ? name.trim() : existing.name,
          category: category ? category.trim() : existing.category,
          id: { not: id }
        }
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Ya existe un material con ese nombre en esa categoría'
        });
      }
    }

    // Usar transacción para actualizar material e items
    const result = await prisma.$transaction(async (tx) => {
      // Construir datos de actualización
      const data = { updated_at: new Date() };
      if (name !== undefined) data.name = name.trim();
      if (category !== undefined) data.category = category.trim();
      if (description !== undefined) data.description = description ? description.trim() : null;
      if (quantity !== undefined) data.quantity = quantity;
      if (unit !== undefined) data.unit = unit;
      if (isMandatoryValue !== undefined) data.is_mandatory = isMandatoryValue;
      if (icon !== undefined) data.icon = icon;
      if (notes !== undefined) data.notes = notes ? notes.trim() : null;

      const material = await tx.emergency_materials.update({
        where: { id },
        data
      });

      // Actualizar items si se proporcionaron
      let updatedItems = [];
      if (items !== undefined && Array.isArray(items)) {
        try {
          // Eliminar items existentes
          await tx.emergency_material_items.deleteMany({
            where: { material_id: id }
          });

          // Crear nuevos items
          if (items.length > 0) {
            const itemsData = items
              .filter(item => item && item.trim())
              .map((item, index) => ({
                material_id: id,
                name: item.trim(),
                order_index: index
              }));

            if (itemsData.length > 0) {
              await tx.emergency_material_items.createMany({
                data: itemsData
              });
            }
          }

          updatedItems = await tx.emergency_material_items.findMany({
            where: { material_id: id },
            orderBy: { order_index: 'asc' }
          });
        } catch (e) {
          console.log('Tabla emergency_material_items no disponible aún:', e.message);
        }
      } else {
        // Si no se envían items, mantener los existentes
        try {
          updatedItems = await tx.emergency_material_items.findMany({
            where: { material_id: id },
            orderBy: { order_index: 'asc' }
          });
        } catch (e) {
          // Tabla no existe
        }
      }

      return { material, items: updatedItems };
    });

    return res.status(200).json({
      success: true,
      message: 'Material actualizado exitosamente',
      data: mapMaterialToResponse(result.material, result.items)
    });
  } catch (error) {
    console.error('Error en updateMaterial:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar material'
    });
  }
};

/**
 * DELETE /api/emergency/materials/:id
 * Elimina un material (soft delete)
 * Roles: Admin
 */
const deleteMaterial = async (req, res) => {
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
    const existing = await prisma.emergency_materials.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Material no encontrado'
      });
    }

    // Soft delete
    await prisma.emergency_materials.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() }
    });

    return res.status(200).json({
      success: true,
      message: 'Material eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteMaterial:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar material'
    });
  }
};

/**
 * POST /api/emergency/materials/:id/check
 * Registra una verificación de material
 * Roles: Admin, Guide
 */
const checkMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user?.id;

    const material = await prisma.emergency_materials.findUnique({ where: { id } });
    if (!material) {
      return res.status(404).json({ error: 'Not Found', message: 'Material no encontrado' });
    }

    // Actualizar material con fecha de última verificación y estado
    const updated = await prisma.emergency_materials.update({
      where: { id },
      data: {
        last_check: new Date(),
        check_status: status || 'ok',
        check_notes: notes || null,
        checked_by: userId,
        updated_at: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        id: updated.id,
        lastCheck: updated.last_check,
        checkStatus: status || 'ok',
        checkedBy: userId
      }
    });
  } catch (error) {
    console.error('Error en checkMaterial:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al registrar verificación' });
  }
};

module.exports = {
  listMaterials,
  listCategories,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  checkMaterial
};
