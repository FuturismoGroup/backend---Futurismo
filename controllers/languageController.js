// Controller de Languages
// CRUD para idiomas del sistema
// Tabla: languages
// Los idiomas se usan en guides y agencies (specializations)

const prisma = require('../config/db');

/**
 * GET /api/languages
 * Lista todos los idiomas (público, para formularios)
 * Roles: Todos (sin autenticación para formularios públicos)
 */
const getAllLanguages = async (req, res) => {
  try {
    const languages = await prisma.languages.findMany({
      orderBy: { name: 'asc' }
    });

    const items = languages.map(lang => ({
      id: lang.id,
      code: lang.code,
      name: lang.name,
      nativeName: lang.native_name,
      isActive: lang.is_active,
      createdAt: lang.created_at
    }));

    return res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error en getAllLanguages:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar idiomas'
    });
  }
};

/**
 * GET /api/languages/active
 * Lista solo idiomas activos (público, para formularios)
 * Roles: Todos
 */
const getActiveLanguages = async (req, res) => {
  try {
    const languages = await prisma.languages.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    const items = languages.map(lang => ({
      id: lang.id,
      code: lang.code,
      name: lang.name,
      nativeName: lang.native_name
    }));

    return res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error en getActiveLanguages:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar idiomas activos'
    });
  }
};

/**
 * GET /api/languages/:id
 * Obtiene un idioma por ID
 * Roles: Admin
 */
const getLanguageById = async (req, res) => {
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

    const language = await prisma.languages.findUnique({
      where: { id }
    });

    if (!language) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Idioma no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: language.id,
        code: language.code,
        name: language.name,
        nativeName: language.native_name,
        isActive: language.is_active,
        createdAt: language.created_at
      }
    });
  } catch (error) {
    console.error('Error en getLanguageById:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener idioma'
    });
  }
};

/**
 * POST /api/languages
 * Crea un nuevo idioma
 * Roles: Admin
 */
const createLanguage = async (req, res) => {
  try {
    const { code, name, nativeName } = req.body;

    // Validaciones
    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'code es requerido'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name es requerido'
      });
    }

    // Validar formato de code (ISO 639-1: 2 letras)
    if (!/^[a-z]{2}$/i.test(code.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'code debe ser un código ISO 639-1 válido (2 letras, ej: "es", "en")'
      });
    }

    // Verificar que el código no exista
    const existingCode = await prisma.languages.findUnique({
      where: { code: code.trim().toLowerCase() }
    });

    if (existingCode) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe un idioma con ese código'
      });
    }

    // Verificar que el nombre no exista
    const existingName = await prisma.languages.findFirst({
      where: { name: name.trim() }
    });

    if (existingName) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe un idioma con ese nombre'
      });
    }

    const language = await prisma.languages.create({
      data: {
        code: code.trim().toLowerCase(),
        name: name.trim(),
        native_name: nativeName ? nativeName.trim() : name.trim(),
        is_active: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Idioma creado exitosamente',
      data: {
        id: language.id,
        code: language.code,
        name: language.name,
        nativeName: language.native_name,
        isActive: language.is_active
      }
    });
  } catch (error) {
    console.error('Error en createLanguage:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear idioma'
    });
  }
};

/**
 * PUT /api/languages/:id
 * Actualiza un idioma
 * Roles: Admin
 */
const updateLanguage = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, nativeName } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que existe
    const existing = await prisma.languages.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Idioma no encontrado'
      });
    }

    // Si se cambia el código, validar formato y duplicados
    const newCode = code ? code.trim().toLowerCase() : null;
    if (newCode && newCode !== existing.code) {
      if (!/^[a-z]{2}$/.test(newCode)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'code debe ser un código ISO 639-1 válido (2 letras)'
        });
      }

      const duplicateCode = await prisma.languages.findFirst({
        where: { code: newCode, id: { not: id } }
      });

      if (duplicateCode) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Ya existe un idioma con ese código'
        });
      }
    }

    // Si se cambia el nombre, verificar que no exista otro con ese nombre
    if (name && name.trim() !== existing.name) {
      const duplicateName = await prisma.languages.findFirst({
        where: {
          name: name.trim(),
          id: { not: id }
        }
      });

      if (duplicateName) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Ya existe un idioma con ese nombre'
        });
      }
    }

    // Construir datos de actualización
    const data = {};
    if (code !== undefined) data.code = code.trim().toLowerCase();
    if (name !== undefined) data.name = name.trim();
    if (nativeName !== undefined) {
      const trimmed = nativeName ? nativeName.trim() : '';
      // native_name es NOT NULL: si viene vacío, usar el name nuevo o el actual
      data.native_name = trimmed || (name ? name.trim() : existing.name);
    }

    const language = await prisma.languages.update({
      where: { id },
      data
    });

    return res.status(200).json({
      success: true,
      message: 'Idioma actualizado exitosamente',
      data: {
        id: language.id,
        code: language.code,
        name: language.name,
        nativeName: language.native_name,
        isActive: language.is_active
      }
    });
  } catch (error) {
    console.error('Error en updateLanguage:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar idioma'
    });
  }
};

/**
 * DELETE /api/languages/:id
 * Elimina un idioma (soft delete)
 * Roles: Admin
 */
const deleteLanguage = async (req, res) => {
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
    const existing = await prisma.languages.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Idioma no encontrado'
      });
    }

    // Verificar si está siendo usado por guías o agencias
    // Nota: languages en guides y agencies es un campo JSON
    // No podemos hacer un count directo, pero podemos sugerir al admin que verifique
    // antes de eliminar idiomas que podrían estar en uso

    // Soft delete
    await prisma.languages.update({
      where: { id },
      data: { is_active: false }
    });

    return res.status(200).json({
      success: true,
      message: 'Idioma eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteLanguage:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar idioma'
    });
  }
};

/**
 * PATCH /api/languages/:id/toggle
 * Alterna el estado activo/inactivo de un idioma
 * Roles: Admin
 */
const toggleLanguageStatus = async (req, res) => {
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
    const existing = await prisma.languages.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Idioma no encontrado'
      });
    }

    // Alternar estado
    const language = await prisma.languages.update({
      where: { id },
      data: { is_active: !existing.is_active }
    });

    return res.status(200).json({
      success: true,
      message: `Idioma ${language.is_active ? 'activado' : 'desactivado'} exitosamente`,
      data: {
        id: language.id,
        code: language.code,
        name: language.name,
        nativeName: language.native_name,
        isActive: language.is_active
      }
    });
  } catch (error) {
    console.error('Error en toggleLanguageStatus:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al cambiar estado del idioma'
    });
  }
};

module.exports = {
  getAllLanguages,
  getActiveLanguages,
  getLanguageById,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  toggleLanguageStatus
};
