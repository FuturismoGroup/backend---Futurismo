// Controller de Evaluaciones de Staff
// ELM-361: StaffEvaluation
// FLW-035: Evaluar personal de la agencia
// APIs: GET /api/evaluations/criteria, GET /api/evaluations/recommendations, POST /api/evaluations/staff

const prisma = require('../config/db');

/**
 * GET /api/evaluations/criteria
 * Obtiene los criterios de evaluacion activos
 * Usado por: useStaffEvaluation hook (linea 52)
 */
const getCriteria = async (req, res) => {
  try {
    // Intentar obtener de la tabla evaluation_criteria
    let criteria = await prisma.evaluation_criteria.findMany({
      where: { is_active: true },
      orderBy: { order_index: 'asc' }
    });

    // Si no hay datos en BD, retornar criterios por defecto
    if (criteria.length === 0) {
      criteria = [
        { key: 'punctuality', label: 'Puntualidad', description: 'Cumplimiento de horarios' },
        { key: 'knowledge', label: 'Conocimiento', description: 'Dominio del tema y destinos' },
        { key: 'communication', label: 'Comunicacion', description: 'Claridad y efectividad al comunicarse' },
        { key: 'professionalism', label: 'Profesionalismo', description: 'Conducta y presentacion profesional' },
        { key: 'problemSolving', label: 'Resolucion de Problemas', description: 'Capacidad para manejar imprevistos' }
      ];
    }

    return res.json({
      success: true,
      data: criteria
    });
  } catch (error) {
    console.error('Error obteniendo criterios de evaluacion:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener criterios de evaluacion'
    });
  }
};

/**
 * GET /api/evaluations/recommendations
 * Obtiene las opciones de recomendacion activas
 * Usado por: useStaffEvaluation hook (linea 53)
 */
const getRecommendations = async (req, res) => {
  try {
    // Intentar obtener de la tabla recommendation_options
    let options = await prisma.recommendation_options.findMany({
      where: { is_active: true },
      orderBy: { order_index: 'asc' }
    });

    // Si no hay datos en BD, retornar opciones por defecto
    if (options.length === 0) {
      options = [
        { value: 'highly-recommend', label: 'Altamente Recomendado', color: 'green' },
        { value: 'recommend', label: 'Recomendado', color: 'blue' },
        { value: 'neutral', label: 'Neutral', color: 'gray' },
        { value: 'not-recommend', label: 'No Recomendado', color: 'red' }
      ];
    }

    return res.json({
      success: true,
      data: options
    });
  } catch (error) {
    console.error('Error obteniendo opciones de recomendacion:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener opciones de recomendacion'
    });
  }
};

/**
 * POST /api/evaluations/staff
 * Crea una nueva evaluacion de staff
 * Usado por: handleSubmit en useStaffEvaluation (linea 104-116)
 * Request body: {
 *   staffMemberId: string (guide_id),
 *   evaluation: { punctuality, knowledge, communication, professionalism, problemSolving },
 *   feedback: { strengths, improvements, additionalComments },
 *   recommendation: string,
 *   averageRating: number
 * }
 */
const createStaffEvaluation = async (req, res) => {
  try {
    const { staffMemberId, evaluation, feedback, recommendation, averageRating } = req.body;
    const evaluatorId = req.user.id; // Usuario autenticado

    // Validar que el guia existe
    const guide = await prisma.guides.findUnique({
      where: { id: staffMemberId }
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        error: 'El miembro de staff no existe'
      });
    }

    // Crear la evaluacion
    const newEvaluation = await prisma.staff_evaluations.create({
      data: {
        guide_id: staffMemberId,
        evaluator_id: evaluatorId,
        punctuality: evaluation.punctuality || 0,
        knowledge: evaluation.knowledge || 0,
        communication: evaluation.communication || 0,
        professionalism: evaluation.professionalism || 0,
        problem_solving: evaluation.problemSolving || 0,
        average_rating: averageRating,
        strengths: feedback?.strengths || null,
        improvements: feedback?.improvements || null,
        additional_comments: feedback?.additionalComments || null,
        recommendation: recommendation
      },
      include: {
        guides: {
          include: {
            users: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        }
      }
    });

    // Actualizar el rating promedio del guia si es necesario
    const allEvaluations = await prisma.staff_evaluations.findMany({
      where: { guide_id: staffMemberId },
      select: { average_rating: true }
    });

    if (allEvaluations.length > 0) {
      const totalRating = allEvaluations.reduce((sum, ev) => sum + parseFloat(ev.average_rating), 0);
      const newAvgRating = totalRating / allEvaluations.length;

      await prisma.guides.update({
        where: { id: staffMemberId },
        data: { rating: newAvgRating }
      });
    }

    return res.status(201).json({
      success: true,
      data: newEvaluation,
      message: 'Evaluacion guardada exitosamente'
    });
  } catch (error) {
    console.error('Error creando evaluacion de staff:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al guardar la evaluacion'
    });
  }
};

/**
 * GET /api/evaluations/staff/:guideId
 * Obtiene las evaluaciones de un guia especifico
 */
const getStaffEvaluations = async (req, res) => {
  try {
    const { guideId } = req.params;

    const evaluations = await prisma.staff_evaluations.findMany({
      where: { guide_id: guideId },
      include: {
        users: {
          select: {
            first_name: true,
            last_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return res.json({
      success: true,
      data: evaluations
    });
  } catch (error) {
    console.error('Error obteniendo evaluaciones:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener evaluaciones'
    });
  }
};

/**
 * GET /api/evaluations/staff/:guideId/summary
 * Obtiene resumen de evaluaciones de un guia
 */
const getStaffEvaluationSummary = async (req, res) => {
  try {
    const { guideId } = req.params;

    const evaluations = await prisma.staff_evaluations.findMany({
      where: { guide_id: guideId },
      select: {
        punctuality: true,
        knowledge: true,
        communication: true,
        professionalism: true,
        problem_solving: true,
        average_rating: true,
        recommendation: true
      }
    });

    if (evaluations.length === 0) {
      return res.json({
        success: true,
        data: {
          totalEvaluations: 0,
          averageRating: 0,
          criteriaAverages: {},
          recommendationBreakdown: {}
        }
      });
    }

    // Calcular promedios por criterio
    const criteriaAverages = {
      punctuality: evaluations.reduce((sum, e) => sum + e.punctuality, 0) / evaluations.length,
      knowledge: evaluations.reduce((sum, e) => sum + e.knowledge, 0) / evaluations.length,
      communication: evaluations.reduce((sum, e) => sum + e.communication, 0) / evaluations.length,
      professionalism: evaluations.reduce((sum, e) => sum + e.professionalism, 0) / evaluations.length,
      problemSolving: evaluations.reduce((sum, e) => sum + e.problem_solving, 0) / evaluations.length
    };

    // Breakdown de recomendaciones
    const recommendationBreakdown = evaluations.reduce((acc, e) => {
      acc[e.recommendation] = (acc[e.recommendation] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        totalEvaluations: evaluations.length,
        averageRating: evaluations.reduce((sum, e) => sum + parseFloat(e.average_rating), 0) / evaluations.length,
        criteriaAverages,
        recommendationBreakdown
      }
    });
  } catch (error) {
    console.error('Error obteniendo resumen de evaluaciones:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener resumen de evaluaciones'
    });
  }
};

module.exports = {
  getCriteria,
  getRecommendations,
  createStaffEvaluation,
  getStaffEvaluations,
  getStaffEvaluationSummary
};
