// Controller de Términos y Condiciones
// CRUD de términos + registro de aceptación de usuarios

const prisma = require('../config/db');

/**
 * GET /api/terms/:type/current
 * Obtiene los términos activos de un tipo (público)
 * @param type - 'terms', 'privacy', 'cookies'
 */
const getCurrentTerms = async (req, res) => {
  try {
    const { type } = req.params;

    // Validar tipo
    const validTypes = ['terms', 'privacy', 'cookies'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Tipo inválido. Debe ser: ${validTypes.join(', ')}`
      });
    }

    const terms = await prisma.terms_and_conditions.findFirst({
      where: {
        type,
        is_active: true
      },
      select: {
        id: true,
        type: true,
        version: true,
        title: true,
        content: true,
        effective_date: true,
        updated_at: true
      }
    });

    if (!terms) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `No hay ${type === 'terms' ? 'términos y condiciones' : 'política de privacidad'} activos`
      });
    }

    res.json({
      success: true,
      data: terms
    });
  } catch (error) {
    console.error('Error en getCurrentTerms:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener términos'
    });
  }
};

/**
 * GET /api/terms/:type/version/:version
 * Obtiene una versión específica de términos (público)
 */
const getTermsByVersion = async (req, res) => {
  try {
    const { type, version } = req.params;

    const terms = await prisma.terms_and_conditions.findFirst({
      where: { type, version },
      select: {
        id: true,
        type: true,
        version: true,
        title: true,
        content: true,
        is_active: true,
        effective_date: true,
        updated_at: true
      }
    });

    if (!terms) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Versión de términos no encontrada'
      });
    }

    res.json({
      success: true,
      data: terms
    });
  } catch (error) {
    console.error('Error en getTermsByVersion:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener términos'
    });
  }
};

/**
 * GET /api/terms
 * Lista todos los términos (Admin)
 */
const listAllTerms = async (req, res) => {
  try {
    const { type, page = 1, pageSize = 20 } = req.query;

    const where = {};
    if (type) where.type = type;

    const [terms, total] = await Promise.all([
      prisma.terms_and_conditions.findMany({
        where,
        orderBy: [{ type: 'asc' }, { created_at: 'desc' }],
        skip: (parseInt(page) - 1) * parseInt(pageSize),
        take: parseInt(pageSize)
      }),
      prisma.terms_and_conditions.count({ where })
    ]);

    res.json({
      success: true,
      data: terms,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('Error en listAllTerms:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar términos'
    });
  }
};

/**
 * POST /api/terms
 * Crear nuevos términos (Admin)
 */
const createTerms = async (req, res) => {
  try {
    const { type, version, title, content, effective_date, is_active } = req.body;
    const userId = req.user?.id;

    // Validaciones
    if (!type || !version || !title || !content || !effective_date) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'type, version, title, content y effective_date son obligatorios'
      });
    }

    const validTypes = ['terms', 'privacy', 'cookies'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Tipo inválido. Debe ser: ${validTypes.join(', ')}`
      });
    }

    // Verificar si ya existe esta versión
    const existing = await prisma.terms_and_conditions.findFirst({
      where: { type, version }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: `Ya existe la versión ${version} de ${type}`
      });
    }

    // Si se marca como activo, desactivar otros del mismo tipo
    if (is_active) {
      await prisma.terms_and_conditions.updateMany({
        where: { type, is_active: true },
        data: { is_active: false }
      });
    }

    const terms = await prisma.terms_and_conditions.create({
      data: {
        type,
        version,
        title,
        content,
        effective_date: new Date(effective_date),
        is_active: is_active || false,
        created_by: userId
      }
    });

    res.status(201).json({
      success: true,
      message: 'Términos creados exitosamente',
      data: terms
    });
  } catch (error) {
    console.error('Error en createTerms:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear términos'
    });
  }
};

/**
 * PUT /api/terms/:id
 * Actualizar términos (Admin)
 */
const updateTerms = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, effective_date } = req.body;

    // Verificar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'ID inválido'
      });
    }

    const existing = await prisma.terms_and_conditions.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Términos no encontrados'
      });
    }

    const updateData = { updated_at: new Date() };
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (effective_date) updateData.effective_date = new Date(effective_date);

    const terms = await prisma.terms_and_conditions.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Términos actualizados exitosamente',
      data: terms
    });
  } catch (error) {
    console.error('Error en updateTerms:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar términos'
    });
  }
};

/**
 * PUT /api/terms/:id/activate
 * Activar una versión de términos (Admin)
 */
const activateTerms = async (req, res) => {
  try {
    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'ID inválido'
      });
    }

    const existing = await prisma.terms_and_conditions.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Términos no encontrados'
      });
    }

    // Desactivar otros del mismo tipo y activar este
    await prisma.$transaction([
      prisma.terms_and_conditions.updateMany({
        where: { type: existing.type, is_active: true },
        data: { is_active: false }
      }),
      prisma.terms_and_conditions.update({
        where: { id },
        data: { is_active: true, updated_at: new Date() }
      })
    ]);

    res.json({
      success: true,
      message: `Versión ${existing.version} de ${existing.type} activada`
    });
  } catch (error) {
    console.error('Error en activateTerms:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al activar términos'
    });
  }
};

/**
 * POST /api/terms/accept
 * Registrar aceptación de términos (Usuario autenticado)
 */
const acceptTerms = async (req, res) => {
  try {
    const { terms_id } = req.body;
    const userId = req.user?.id;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (!terms_id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'terms_id es obligatorio'
      });
    }

    // Verificar que los términos existen y están activos
    const terms = await prisma.terms_and_conditions.findUnique({
      where: { id: terms_id }
    });

    if (!terms) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Términos no encontrados'
      });
    }

    // Verificar si ya aceptó esta versión
    const existing = await prisma.user_terms_acceptance.findFirst({
      where: { user_id: userId, terms_id }
    });

    if (existing) {
      return res.json({
        success: true,
        message: 'Ya habías aceptado estos términos',
        data: existing
      });
    }

    const acceptance = await prisma.user_terms_acceptance.create({
      data: {
        user_id: userId,
        terms_id,
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });

    res.status(201).json({
      success: true,
      message: 'Términos aceptados',
      data: acceptance
    });
  } catch (error) {
    console.error('Error en acceptTerms:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al registrar aceptación'
    });
  }
};

/**
 * GET /api/terms/acceptance/status
 * Verificar si el usuario aceptó los términos actuales
 */
const getAcceptanceStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { type } = req.query;

    // Obtener términos activos
    const where = { is_active: true };
    if (type) where.type = type;

    const activeTerms = await prisma.terms_and_conditions.findMany({
      where,
      select: { id: true, type: true, version: true }
    });

    // Verificar cuáles ha aceptado
    const acceptances = await prisma.user_terms_acceptance.findMany({
      where: {
        user_id: userId,
        terms_id: { in: activeTerms.map(t => t.id) }
      },
      select: { terms_id: true, accepted_at: true }
    });

    const acceptedIds = acceptances.map(a => a.terms_id);

    const status = activeTerms.map(term => ({
      type: term.type,
      version: term.version,
      accepted: acceptedIds.includes(term.id),
      accepted_at: acceptances.find(a => a.terms_id === term.id)?.accepted_at || null
    }));

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error en getAcceptanceStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al verificar aceptación'
    });
  }
};

module.exports = {
  getCurrentTerms,
  getTermsByVersion,
  listAllTerms,
  createTerms,
  updateTerms,
  activateTerms,
  acceptTerms,
  getAcceptanceStatus
};
