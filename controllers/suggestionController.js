// Controller de Suggestions
// CRUD para sugerencias
// Tabla: suggestions

const prisma = require('../config/db');

/**
 * GET /api/suggestions
 * Lista todas las sugerencias con filtros
 * Query params: status, category, search
 * Roles: Admin, Agency
 */
const listSuggestions = async (req, res) => {
  try {
    const { status, category, search } = req.query;

    const where = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const suggestions = await prisma.suggestions.findMany({
      where,
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        feedback: {
          select: { id: true, subject: true, feedback_type: true }
        }
      },
      orderBy: [
        { votes_count: 'desc' },
        { created_at: 'desc' }
      ]
    });

    const items = suggestions.map(s => ({
      id: s.id,
      feedbackId: s.feedback_id,
      feedback: s.feedback ? {
        id: s.feedback.id,
        subject: s.feedback.subject,
        type: s.feedback.feedback_type
      } : null,
      title: s.title,
      description: s.description,
      category: s.category,
      status: s.status,
      votesCount: s.votes_count,
      createdBy: s.users ? {
        id: s.users.id,
        name: s.users.name,
        email: s.users.email
      } : null,
      createdAt: s.created_at
    }));

    // Estadísticas
    const allSuggestions = await prisma.suggestions.findMany();
    const stats = {
      total: allSuggestions.length,
      pending: allSuggestions.filter(s => s.status === 'pending' || s.status === 'submitted').length,
      reviewed: allSuggestions.filter(s => s.status === 'reviewed').length,
      inProgress: allSuggestions.filter(s => s.status === 'in_progress').length,
      implemented: allSuggestions.filter(s => s.status === 'implemented').length,
      rejected: allSuggestions.filter(s => s.status === 'rejected').length
    };

    return res.status(200).json({
      success: true,
      data: items,
      stats,
      total: items.length
    });
  } catch (error) {
    console.error('Error en listSuggestions:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar sugerencias'
    });
  }
};

/**
 * GET /api/suggestions/:id
 * Obtiene una sugerencia por ID
 * Roles: Admin, Agency
 */
const getSuggestion = async (req, res) => {
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

    const suggestion = await prisma.suggestions.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        feedback: {
          select: { id: true, subject: true, feedback_type: true, message: true }
        }
      }
    });

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Sugerencia no encontrada'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: suggestion.id,
        feedbackId: suggestion.feedback_id,
        feedback: suggestion.feedback ? {
          id: suggestion.feedback.id,
          subject: suggestion.feedback.subject,
          type: suggestion.feedback.feedback_type,
          message: suggestion.feedback.message
        } : null,
        title: suggestion.title,
        description: suggestion.description,
        category: suggestion.category,
        status: suggestion.status,
        votesCount: suggestion.votes_count,
        createdBy: suggestion.users ? {
          id: suggestion.users.id,
          name: suggestion.users.name,
          email: suggestion.users.email
        } : null,
        createdAt: suggestion.created_at
      }
    });
  } catch (error) {
    console.error('Error en getSuggestion:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener sugerencia'
    });
  }
};

/**
 * POST /api/suggestions
 * Crea una nueva sugerencia
 * Roles: Admin, Agency, Guide, Tourist
 */
const createSuggestion = async (req, res) => {
  try {
    const { feedbackId, title, description, category } = req.body;
    const userId = req.user?.id;

    // Validaciones
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'title es requerido'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'description es requerido'
      });
    }

    // Si hay feedbackId, verificar que existe
    if (feedbackId) {
      const feedback = await prisma.feedback.findUnique({
        where: { id: feedbackId }
      });

      if (!feedback) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'El feedback asociado no existe'
        });
      }
    }

    const suggestion = await prisma.suggestions.create({
      data: {
        feedback_id: feedbackId || null,
        title: title.trim(),
        description: description.trim(),
        category: category || 'general',
        status: 'submitted',
        votes_count: 0,
        created_by: userId
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Sugerencia creada exitosamente',
      data: {
        id: suggestion.id,
        title: suggestion.title,
        status: suggestion.status
      }
    });
  } catch (error) {
    console.error('Error en createSuggestion:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear sugerencia'
    });
  }
};

/**
 * PATCH /api/suggestions/:id/status
 * Actualiza el estado de una sugerencia
 * Roles: Admin
 */
const updateSuggestionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    const validStatuses = ['pending', 'submitted', 'reviewed', 'in_progress', 'implemented', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `status debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    const existing = await prisma.suggestions.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Sugerencia no encontrada'
      });
    }

    const suggestion = await prisma.suggestions.update({
      where: { id },
      data: { status }
    });

    return res.status(200).json({
      success: true,
      message: 'Estado actualizado exitosamente',
      data: {
        id: suggestion.id,
        status: suggestion.status
      }
    });
  } catch (error) {
    console.error('Error en updateSuggestionStatus:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar estado'
    });
  }
};

/**
 * POST /api/suggestions/:id/vote
 * Vota por una sugerencia
 * Roles: Admin, Agency, Guide, Tourist
 */
const voteSuggestion = async (req, res) => {
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

    const existing = await prisma.suggestions.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Sugerencia no encontrada'
      });
    }

    const suggestion = await prisma.suggestions.update({
      where: { id },
      data: { votes_count: { increment: 1 } }
    });

    return res.status(200).json({
      success: true,
      message: 'Voto registrado',
      data: {
        id: suggestion.id,
        votesCount: suggestion.votes_count
      }
    });
  } catch (error) {
    console.error('Error en voteSuggestion:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al votar'
    });
  }
};

/**
 * DELETE /api/suggestions/:id
 * Elimina una sugerencia
 * Roles: Admin
 */
const deleteSuggestion = async (req, res) => {
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

    const existing = await prisma.suggestions.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Sugerencia no encontrada'
      });
    }

    await prisma.suggestions.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Sugerencia eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteSuggestion:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar sugerencia'
    });
  }
};

module.exports = {
  listSuggestions,
  getSuggestion,
  createSuggestion,
  updateSuggestionStatus,
  voteSuggestion,
  deleteSuggestion
};
