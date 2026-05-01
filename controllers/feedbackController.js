// Controller de Feedback
// CRUD para feedback de usuarios
// Tabla: feedback

const prisma = require('../config/db');

/**
 * GET /api/feedback
 * Lista todos los feedbacks con filtros
 * Query params: type, status, priority, search, from, to
 * Roles: Admin
 */
const listFeedback = async (req, res) => {
  try {
    const { type, status, priority, search, from, to } = req.query;

    const where = {};

    if (type && type !== 'all') {
      where.feedback_type = type;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (priority && priority !== 'all') {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (from || to) {
      where.created_at = {};
      if (from) {
        where.created_at.gte = new Date(from);
      }
      if (to) {
        where.created_at.lte = new Date(to);
      }
    }

    const feedbacks = await prisma.feedback.findMany({
      where,
      include: {
        users_feedback_user_idTousers: {
          select: { id: true, first_name: true, last_name: true, email: true }
        },
        users_feedback_responded_byTousers: {
          select: { id: true, first_name: true, last_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const items = feedbacks.map(f => {
      const feedbackUser = f.users_feedback_user_idTousers;
      const responder = f.users_feedback_responded_byTousers;
      return {
        id: f.id,
        userId: f.user_id,
        user: feedbackUser ? {
          id: feedbackUser.id,
          name: `${feedbackUser.first_name} ${feedbackUser.last_name}`.trim(),
          email: feedbackUser.email
        } : null,
        feedbackType: f.feedback_type,
        subject: f.subject,
        message: f.message,
        rating: f.rating,
        status: f.status,
        priority: f.priority,
        response: f.response,
        respondedBy: responder ? {
          id: responder.id,
          name: `${responder.first_name} ${responder.last_name}`.trim()
        } : null,
        respondedAt: f.responded_at,
        createdAt: f.created_at
      };
    });

    // Estadísticas para dashboard
    const allFeedback = await prisma.feedback.findMany();
    const stats = {
      total: allFeedback.length,
      pending: allFeedback.filter(f => f.status === 'pending').length,
      inProgress: allFeedback.filter(f => f.status === 'in_progress').length,
      resolved: allFeedback.filter(f => f.status === 'resolved').length,
      byType: {
        service: allFeedback.filter(f => f.feedback_type === 'service').length,
        staff: allFeedback.filter(f => f.feedback_type === 'staff').length,
        general: allFeedback.filter(f => f.feedback_type === 'general').length,
        complaint: allFeedback.filter(f => f.feedback_type === 'complaint').length,
        suggestion: allFeedback.filter(f => f.feedback_type === 'suggestion').length
      },
      byPriority: {
        low: allFeedback.filter(f => f.priority === 'low').length,
        normal: allFeedback.filter(f => f.priority === 'normal').length,
        high: allFeedback.filter(f => f.priority === 'high').length,
        urgent: allFeedback.filter(f => f.priority === 'urgent').length
      }
    };

    return res.status(200).json({
      success: true,
      data: items,
      stats,
      total: items.length
    });
  } catch (error) {
    console.error('Error en listFeedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar feedback'
    });
  }
};

/**
 * GET /api/feedback/:id
 * Obtiene un feedback por ID
 * Roles: Admin
 */
const getFeedback = async (req, res) => {
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

    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        users_feedback_user_idTousers: {
          select: { id: true, first_name: true, last_name: true, email: true }
        },
        users_feedback_responded_byTousers: {
          select: { id: true, first_name: true, last_name: true, email: true }
        }
      }
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Feedback no encontrado'
      });
    }

    const feedbackUser = feedback.users_feedback_user_idTousers;
    const responder = feedback.users_feedback_responded_byTousers;

    return res.status(200).json({
      success: true,
      data: {
        id: feedback.id,
        userId: feedback.user_id,
        user: feedbackUser ? {
          id: feedbackUser.id,
          name: `${feedbackUser.first_name} ${feedbackUser.last_name}`.trim(),
          email: feedbackUser.email
        } : null,
        feedbackType: feedback.feedback_type,
        subject: feedback.subject,
        message: feedback.message,
        rating: feedback.rating,
        status: feedback.status,
        priority: feedback.priority,
        response: feedback.response,
        respondedBy: responder ? {
          id: responder.id,
          name: `${responder.first_name} ${responder.last_name}`.trim(),
          email: responder.email
        } : null,
        respondedAt: feedback.responded_at,
        createdAt: feedback.created_at
      }
    });
  } catch (error) {
    console.error('Error en getFeedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener feedback'
    });
  }
};

/**
 * POST /api/feedback
 * Crea un nuevo feedback
 * Roles: Admin, Agency, Guide, Tourist
 */
const createFeedback = async (req, res) => {
  try {
    const { feedbackType, category, subject, message, priority, rating, suggestions } = req.body;
    const userId = req.user?.id;

    // feedbackType o category (el frontend puede enviar category)
    const type = feedbackType || category;

    // Validaciones
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'feedbackType o category es requerido'
      });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'subject es requerido'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'message es requerido'
      });
    }

    // Tipos validos ampliados para compatibilidad con frontend
    const validTypes = ['service', 'staff', 'general', 'complaint', 'suggestion',
                        'funcionalidad', 'interfaz', 'rendimiento', 'soporte',
                        'documentacion', 'integracion', 'otro'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `feedbackType debe ser uno de: ${validTypes.join(', ')}`
      });
    }

    // Validar rating si se proporciona
    if (rating !== undefined && rating !== null) {
      const ratingNum = parseInt(rating, 10);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'rating debe ser un numero entre 1 y 5'
        });
      }
    }

    const feedback = await prisma.feedback.create({
      data: {
        user_id: userId,
        feedback_type: type,
        subject: subject.trim(),
        message: message.trim(),
        rating: rating ? parseInt(rating, 10) : null,
        suggestions_text: suggestions ? suggestions.trim() : null,
        priority: priority || 'medium',
        status: 'pending'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Feedback enviado exitosamente',
      data: {
        id: feedback.id,
        feedbackType: feedback.feedback_type,
        category: feedback.feedback_type,
        subject: feedback.subject,
        rating: feedback.rating,
        status: feedback.status,
        createdAt: feedback.created_at
      }
    });
  } catch (error) {
    console.error('Error en createFeedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear feedback'
    });
  }
};

/**
 * PUT /api/feedback/:id
 * Actualiza un feedback
 * Roles: Admin
 */
const updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, response } = req.body;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    const existing = await prisma.feedback.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Feedback no encontrado'
      });
    }

    const data = {};
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (response !== undefined) {
      data.response = response;
      data.responded_by = userId;
      data.responded_at = new Date();
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data
    });

    return res.status(200).json({
      success: true,
      message: 'Feedback actualizado exitosamente',
      data: {
        id: feedback.id,
        status: feedback.status,
        priority: feedback.priority,
        response: feedback.response,
        respondedAt: feedback.responded_at
      }
    });
  } catch (error) {
    console.error('Error en updateFeedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar feedback'
    });
  }
};

/**
 * PATCH /api/feedback/:id/respond
 * Responde a un feedback
 * Roles: Admin
 */
const respondToFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    if (!response || !response.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'response es requerido'
      });
    }

    const existing = await prisma.feedback.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Feedback no encontrado'
      });
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        response: response.trim(),
        responded_by: userId,
        responded_at: new Date(),
        status: 'resolved'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Respuesta enviada exitosamente',
      data: {
        id: feedback.id,
        response: feedback.response,
        status: feedback.status,
        respondedAt: feedback.responded_at
      }
    });
  } catch (error) {
    console.error('Error en respondToFeedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al responder feedback'
    });
  }
};

/**
 * DELETE /api/feedback/:id
 * Elimina un feedback
 * Roles: Admin
 */
const deleteFeedback = async (req, res) => {
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

    const existing = await prisma.feedback.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Feedback no encontrado'
      });
    }

    await prisma.feedback.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Feedback eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteFeedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar feedback'
    });
  }
};

/**
 * GET /api/feedback/stats
 * Obtiene estadísticas de feedback
 * Roles: Admin
 */
const getFeedbackStats = async (req, res) => {
  try {
    const allFeedback = await prisma.feedback.findMany();

    const stats = {
      total: allFeedback.length,
      pending: allFeedback.filter(f => f.status === 'pending').length,
      inProgress: allFeedback.filter(f => f.status === 'in_progress').length,
      resolved: allFeedback.filter(f => f.status === 'resolved').length,
      byType: {
        service: allFeedback.filter(f => f.feedback_type === 'service').length,
        staff: allFeedback.filter(f => f.feedback_type === 'staff').length,
        general: allFeedback.filter(f => f.feedback_type === 'general').length,
        complaint: allFeedback.filter(f => f.feedback_type === 'complaint').length,
        suggestion: allFeedback.filter(f => f.feedback_type === 'suggestion').length
      },
      byPriority: {
        low: allFeedback.filter(f => f.priority === 'low').length,
        normal: allFeedback.filter(f => f.priority === 'normal').length,
        high: allFeedback.filter(f => f.priority === 'high').length,
        urgent: allFeedback.filter(f => f.priority === 'urgent').length
      }
    };

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error en getFeedbackStats:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener estadísticas'
    });
  }
};

/**
 * GET /api/feedback/my
 * Obtiene los feedbacks del usuario autenticado
 * Roles: Admin, Agency, Guide, Tourist
 */
const getMyFeedback = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Usuario no autenticado'
      });
    }

    const feedbacks = await prisma.feedback.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    const items = feedbacks.map(f => ({
      id: f.id,
      date: f.created_at.toISOString().split('T')[0],
      category: f.feedback_type,
      feedbackType: f.feedback_type,
      subject: f.subject,
      message: f.message,
      rating: f.rating || 0,
      suggestions: f.suggestions_text,
      priority: f.priority,
      status: f.status,
      response: f.response,
      respondedAt: f.responded_at,
      createdAt: f.created_at
    }));

    return res.status(200).json({
      success: true,
      data: items,
      total: items.length
    });
  } catch (error) {
    console.error('Error en getMyFeedback:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener mis feedbacks'
    });
  }
};

module.exports = {
  listFeedback,
  getFeedback,
  createFeedback,
  updateFeedback,
  respondToFeedback,
  deleteFeedback,
  getFeedbackStats,
  getMyFeedback
};
