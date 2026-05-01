// Controller de Ratings
// Fuente: 04_apis_lista.md líneas 3684-4356
// API-051 a API-060: Ratings/Reviews

const prisma = require('../config/db');

/**
 * API-051: ListGuideRatings
 * GET /api/guides/:id/ratings
 * Línea 04_apis_lista: 3684
 */
const listGuideRatings = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      pageSize = 20,
      minRating,
      maxRating,
      dateFrom,
      dateTo
    } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de guía inválido' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    // Construir filtros
    const where = {
      guide_id: id,
      status: 'published'
    };

    if (minRating || maxRating) {
      where.guide_rating = {};
      if (minRating) where.guide_rating.gte = parseInt(minRating);
      if (maxRating) where.guide_rating.lte = parseInt(maxRating);
    }

    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at.gte = new Date(dateFrom);
      if (dateTo) where.created_at.lte = new Date(dateTo);
    }

    const [ratings, total, stats] = await Promise.all([
      prisma.rating.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          reservation: {
            include: {
              tour: { select: { id: true, name: true } },
              client: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.rating.count({ where }),
      prisma.rating.aggregate({
        where: { guide_id: id, status: 'published', guide_rating: { not: null } },
        _avg: { guide_rating: true }
      })
    ]);

    // Distribución de ratings
    const distribution = await prisma.rating.groupBy({
      by: ['guide_rating'],
      where: { guide_id: id, status: 'published', guide_rating: { not: null } },
      _count: { id: true }
    });

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(d => {
      if (d.guide_rating) ratingDistribution[d.guide_rating] = d._count.id;
    });

    const data = ratings.map(r => ({
      id: r.id,
      rating: r.guide_rating,
      comment: r.comment,
      clientName: r.anonymous ? 'Anónimo' : r.reservation?.client?.name,
      tourName: r.reservation?.tour?.name,
      date: r.created_at,
      response: r.response,
      tags: r.tags
    }));

    res.json({
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      averageRating: stats._avg.guide_rating || 0,
      ratingDistribution
    });
  } catch (error) {
    console.error('Error en listGuideRatings:', error);
    res.status(500).json({ error: 'Error al obtener calificaciones del guía' });
  }
};

/**
 * API-052: ListTourRatings
 * GET /api/tours/:id/ratings
 * Línea 04_apis_lista: 3786
 */
const listTourRatings = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      pageSize = 20,
      minRating
    } = req.query;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de tour inválido' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    const where = {
      tour_id: id,
      status: 'published',
      tour_rating: { not: null }
    };

    if (minRating) {
      where.tour_rating.gte = parseInt(minRating);
    }

    const [ratings, total, stats] = await Promise.all([
      prisma.rating.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          reservation: {
            include: {
              client: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.rating.count({ where }),
      prisma.rating.aggregate({
        where: { tour_id: id, status: 'published', tour_rating: { not: null } },
        _avg: { tour_rating: true }
      })
    ]);

    // Distribución
    const distribution = await prisma.rating.groupBy({
      by: ['tour_rating'],
      where: { tour_id: id, status: 'published', tour_rating: { not: null } },
      _count: { id: true }
    });

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(d => {
      if (d.tour_rating) ratingDistribution[d.tour_rating] = d._count.id;
    });

    const data = ratings.map(r => ({
      id: r.id,
      rating: r.tour_rating,
      comment: r.comment,
      clientName: r.anonymous ? 'Anónimo' : r.reservation?.client?.name,
      date: r.created_at
    }));

    res.json({
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      averageRating: stats._avg.tour_rating || 0,
      ratingDistribution
    });
  } catch (error) {
    console.error('Error en listTourRatings:', error);
    res.status(500).json({ error: 'Error al obtener calificaciones del tour' });
  }
};

/**
 * API-053: CreateRating
 * POST /api/reservations/:reservationId/rating
 * Linea 04_apis_lista: 3865
 *
 * NOTA: Adaptado al schema real de Prisma (tabla ratings):
 * - id, reservation_id, rated_by_id, guide_rating, driver_rating,
 *   vehicle_rating, overall_rating, comment, created_at
 */
const createRating = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const {
      overallRating,
      guideRating,
      driverRating,
      vehicleRating,
      comment
    } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(reservationId)) {
      return res.status(400).json({ error: 'ID de reserva invalido' });
    }

    // overallRating es requerido segun schema
    if (!overallRating) {
      return res.status(400).json({ error: 'Se requiere overallRating' });
    }

    // Validar rangos (1-5)
    if (overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ error: 'overallRating debe estar entre 1 y 5' });
    }
    if (guideRating && (guideRating < 1 || guideRating > 5)) {
      return res.status(400).json({ error: 'guideRating debe estar entre 1 y 5' });
    }
    if (driverRating && (driverRating < 1 || driverRating > 5)) {
      return res.status(400).json({ error: 'driverRating debe estar entre 1 y 5' });
    }
    if (vehicleRating && (vehicleRating < 1 || vehicleRating > 5)) {
      return res.status(400).json({ error: 'vehicleRating debe estar entre 1 y 5' });
    }
    if (comment && comment.length > 1000) {
      return res.status(400).json({ error: 'comment maximo 1000 caracteres' });
    }

    // Verificar reserva existe
    const reservation = await prisma.reservations.findUnique({
      where: { id: reservationId }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    // Permitir calificar reservas completadas o confirmadas
    if (reservation.status !== 'completed' && reservation.status !== 'confirmed') {
      return res.status(400).json({ error: 'Solo se puede calificar reservas completadas o confirmadas' });
    }

    // Verificar si ya existe rating para esta reserva (constraint unique en schema)
    const existingRating = await prisma.ratings.findUnique({
      where: { reservation_id: reservationId }
    });
    if (existingRating) {
      return res.status(409).json({ error: 'Ya existe una calificacion para esta reserva' });
    }

    // Obtener el usuario que califica (del token JWT)
    const ratedById = req.user.id;

    // Crear rating con campos del schema real
    const rating = await prisma.ratings.create({
      data: {
        reservation_id: reservationId,
        rated_by_id: ratedById,
        overall_rating: overallRating,
        guide_rating: guideRating || null,
        driver_rating: driverRating || null,
        vehicle_rating: vehicleRating || null,
        comment: comment || null
      }
    });

    // Actualizar rating promedio del guia si aplica
    if (guideRating && reservation.guide_id) {
      await updateGuideRating(reservation.guide_id);
    }

    res.status(201).json({
      success: true,
      data: {
        id: rating.id,
        overallRating: rating.overall_rating,
        createdAt: rating.created_at
      }
    });
  } catch (error) {
    console.error('Error en createRating:', error);
    res.status(500).json({ error: 'Error al crear calificacion' });
  }
};

// Helper para actualizar rating promedio del guia
// Usa tabla ratings y calcula promedio de guide_rating para reservas del guia
async function updateGuideRating(guideId) {
  try {
    // Obtener todas las reservas del guia con ratings
    const reservationsWithRatings = await prisma.reservations.findMany({
      where: { guide_id: guideId },
      select: { id: true }
    });

    const reservationIds = reservationsWithRatings.map(r => r.id);

    if (reservationIds.length === 0) return;

    const stats = await prisma.ratings.aggregate({
      where: {
        reservation_id: { in: reservationIds },
        guide_rating: { not: null }
      },
      _avg: { guide_rating: true },
      _count: { id: true }
    });

    // Actualizar en tabla guides si existe columna rating
    await prisma.guides.update({
      where: { id: guideId },
      data: {
        rating: stats._avg.guide_rating || 0
      }
    });
  } catch (error) {
    console.error('Error actualizando rating del guia:', error);
  }
}

/**
 * API-054: UpdateRating
 * PUT /api/ratings/:id
 * Línea 04_apis_lista: 3939
 */
const updateRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { guideRating, tourRating, comment, tags } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de rating inválido' });
    }

    const rating = await prisma.rating.findUnique({ where: { id } });
    if (!rating) {
      return res.status(404).json({ error: 'Rating no encontrado' });
    }

    // Solo editable dentro de 7 días
    const daysSinceCreation = (Date.now() - new Date(rating.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 7) {
      return res.status(400).json({ error: 'Solo se puede editar dentro de 7 días de creación' });
    }

    // Validaciones
    if (guideRating && (guideRating < 1 || guideRating > 5)) {
      return res.status(400).json({ error: 'guideRating debe estar entre 1 y 5' });
    }
    if (tourRating && (tourRating < 1 || tourRating > 5)) {
      return res.status(400).json({ error: 'tourRating debe estar entre 1 y 5' });
    }

    const updateData = { updated_at: new Date() };
    if (guideRating !== undefined) updateData.guide_rating = guideRating;
    if (tourRating !== undefined) updateData.tour_rating = tourRating;
    if (comment !== undefined) updateData.comment = comment;
    if (tags !== undefined) updateData.tags = tags;

    const updated = await prisma.rating.update({
      where: { id },
      data: updateData
    });

    // Recalcular promedios
    if (rating.guide_id) await updateGuideRating(rating.guide_id);
    if (rating.tour_id) await updateTourRating(rating.tour_id);

    res.json({
      id: updated.id,
      guideRating: updated.guide_rating,
      tourRating: updated.tour_rating,
      comment: updated.comment,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    console.error('Error en updateRating:', error);
    res.status(500).json({ error: 'Error al actualizar rating' });
  }
};

/**
 * API-055: DeleteRating
 * DELETE /api/ratings/:id
 * Línea 04_apis_lista: 3996
 */
const deleteRating = async (req, res) => {
  try {
    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de rating inválido' });
    }

    const rating = await prisma.rating.findUnique({ where: { id } });
    if (!rating) {
      return res.status(404).json({ error: 'Rating no encontrado' });
    }

    const guideId = rating.guide_id;
    const tourId = rating.tour_id;

    await prisma.rating.delete({ where: { id } });

    // Recalcular promedios
    if (guideId) await updateGuideRating(guideId);
    if (tourId) await updateTourRating(tourId);

    res.json({
      success: true,
      message: 'Rating eliminado correctamente'
    });
  } catch (error) {
    console.error('Error en deleteRating:', error);
    res.status(500).json({ error: 'Error al eliminar rating' });
  }
};

/**
 * API-056: RespondToRating
 * POST /api/ratings/:id/response
 * Línea 04_apis_lista: 4051
 */
const respondToRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de rating inválido' });
    }

    if (!response || response.length > 500) {
      return res.status(400).json({ error: 'response requerido, máximo 500 caracteres' });
    }

    const rating = await prisma.rating.findUnique({ where: { id } });
    if (!rating) {
      return res.status(404).json({ error: 'Rating no encontrado' });
    }

    // Verificar que el guía puede responder
    if (req.user.role === 'guide' && rating.guide_id !== req.user.guideId) {
      return res.status(403).json({ error: 'No autorizado para responder este rating' });
    }

    if (rating.response) {
      return res.status(409).json({ error: 'Ya existe una respuesta para este rating' });
    }

    const updated = await prisma.rating.update({
      where: { id },
      data: {
        response,
        response_date: new Date()
      }
    });

    res.json({
      id: updated.id,
      response: updated.response,
      responseDate: updated.response_date
    });
  } catch (error) {
    console.error('Error en respondToRating:', error);
    res.status(500).json({ error: 'Error al responder rating' });
  }
};

/**
 * API-057: ListPendingRatings
 * GET /api/ratings/pending-moderation
 * Línea 04_apis_lista: 4112
 */
const listPendingRatings = async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    const where = { status: 'pending_moderation' };

    const [ratings, total] = await Promise.all([
      prisma.rating.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          reservation: {
            include: {
              guide: { select: { id: true, name: true } },
              client: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { created_at: 'asc' }
      }),
      prisma.rating.count({ where })
    ]);

    const data = ratings.map(r => ({
      id: r.id,
      guideRating: r.guide_rating,
      tourRating: r.tour_rating,
      comment: r.comment,
      guideName: r.reservation?.guide?.name,
      clientName: r.reservation?.client?.name,
      createdAt: r.created_at
    }));

    res.json({
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error) {
    console.error('Error en listPendingRatings:', error);
    res.status(500).json({ error: 'Error al obtener ratings pendientes' });
  }
};

/**
 * API-058: ModerateRating
 * PATCH /api/ratings/:id/moderate
 * Línea 04_apis_lista: 4172
 */
const moderateRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, moderationNote } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de rating inválido' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action debe ser approve o reject' });
    }

    const rating = await prisma.rating.findUnique({ where: { id } });
    if (!rating) {
      return res.status(404).json({ error: 'Rating no encontrado' });
    }

    const newStatus = action === 'approve' ? 'published' : 'rejected';

    const updated = await prisma.rating.update({
      where: { id },
      data: {
        status: newStatus,
        moderation_note: moderationNote,
        moderated_at: new Date(),
        moderated_by: req.user.id
      }
    });

    // Si se aprueba, actualizar promedios
    if (newStatus === 'published') {
      if (rating.guide_id) await updateGuideRating(rating.guide_id);
      if (rating.tour_id) await updateTourRating(rating.tour_id);
    }

    res.json({
      id: updated.id,
      status: updated.status,
      moderatedAt: updated.moderated_at,
      moderatedBy: updated.moderated_by
    });
  } catch (error) {
    console.error('Error en moderateRating:', error);
    res.status(500).json({ error: 'Error al moderar rating' });
  }
};

/**
 * API-059: GetRatingSummary
 * GET /api/ratings/summary
 * Línea 04_apis_lista: 4228
 */
const getRatingSummary = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const where = { status: 'published' };
    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at.gte = new Date(dateFrom);
      if (dateTo) where.created_at.lte = new Date(dateTo);
    }

    const [totalRatings, guideAvg, tourAvg, pendingCount] = await Promise.all([
      prisma.rating.count({ where }),
      prisma.rating.aggregate({
        where: { ...where, guide_rating: { not: null } },
        _avg: { guide_rating: true }
      }),
      prisma.rating.aggregate({
        where: { ...where, tour_rating: { not: null } },
        _avg: { tour_rating: true }
      }),
      prisma.rating.count({ where: { status: 'pending_moderation' } })
    ]);

    // Top guías
    const topGuides = await prisma.guide.findMany({
      where: { rating: { gt: 0 } },
      orderBy: { rating: 'desc' },
      take: 5,
      select: { id: true, name: true, rating: true, rating_count: true }
    });

    // Top tours
    const topTours = await prisma.tour.findMany({
      where: { rating: { gt: 0 } },
      orderBy: { rating: 'desc' },
      take: 5,
      select: { id: true, name: true, rating: true, rating_count: true }
    });

    res.json({
      totalRatings,
      averageGuideRating: guideAvg._avg.guide_rating || 0,
      averageTourRating: tourAvg._avg.tour_rating || 0,
      pendingModeration: pendingCount,
      topRatedGuides: topGuides.map(g => ({
        guideId: g.id,
        name: g.name,
        rating: g.rating,
        count: g.rating_count
      })),
      topRatedTours: topTours.map(t => ({
        tourId: t.id,
        name: t.name,
        rating: t.rating,
        count: t.rating_count
      })),
      ratingTrend: []
    });
  } catch (error) {
    console.error('Error en getRatingSummary:', error);
    res.status(500).json({ error: 'Error al obtener resumen de ratings' });
  }
};

/**
 * API-060: GetGuideRatingStats
 * GET /api/guides/:id/rating-stats
 * Línea 04_apis_lista: 4297
 */
const getGuideRatingStats = async (req, res) => {
  try {
    const { id } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de guía inválido' });
    }

    const guide = await prisma.guide.findUnique({ where: { id } });
    if (!guide) {
      return res.status(404).json({ error: 'Guía no encontrado' });
    }

    const where = { guide_id: id, status: 'published', guide_rating: { not: null } };

    const [totalRatings, avgRating, distribution, withResponse] = await Promise.all([
      prisma.rating.count({ where }),
      prisma.rating.aggregate({
        where,
        _avg: { guide_rating: true }
      }),
      prisma.rating.groupBy({
        by: ['guide_rating'],
        where,
        _count: { id: true }
      }),
      prisma.rating.count({
        where: { ...where, response: { not: null } }
      })
    ]);

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(d => {
      if (d.guide_rating) ratingDistribution[d.guide_rating] = d._count.id;
    });

    // Tag counts
    const ratingsWithTags = await prisma.rating.findMany({
      where,
      select: { tags: true }
    });
    const tagCounts = {};
    ratingsWithTags.forEach(r => {
      (r.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    res.json({
      guideId: id,
      totalRatings,
      averageRating: avgRating._avg.guide_rating || 0,
      ratingDistribution,
      tagCounts,
      recentTrend: 0,
      responseRate: totalRatings > 0 ? (withResponse / totalRatings) * 100 : 0
    });
  } catch (error) {
    console.error('Error en getGuideRatingStats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de rating' });
  }
};

/**
 * ELM-352: GetDashboardStats
 * GET /api/ratings/dashboard/stats
 * Estadisticas generales para RatingDashboard
 * Usa tabla ratings con relacion a reservations y guides
 */
const getDashboardStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    // Calcular rango de fechas segun periodo
    const now = new Date();
    let dateFrom;
    switch (period) {
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        dateFrom = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        dateFrom = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const where = {
      created_at: { gte: dateFrom }
    };

    // Estadisticas generales
    const [totalRatings, avgStats, guidesWithRatings, ratingDistributionRaw] = await Promise.all([
      prisma.ratings.count({ where }),
      prisma.ratings.aggregate({
        where,
        _avg: {
          overall_rating: true,
          guide_rating: true
        }
      }),
      prisma.ratings.groupBy({
        by: ['rated_by_id'],
        where: { ...where, guide_rating: { not: null } },
        _count: { id: true }
      }),
      // ELM-353: Distribucion de ratings agrupada por overall_rating (1-5)
      prisma.ratings.groupBy({
        by: ['overall_rating'],
        where,
        _count: { id: true }
      })
    ]);

    // Calcular tendencia comparando con periodo anterior
    const previousPeriodStart = new Date(dateFrom.getTime() - (now.getTime() - dateFrom.getTime()));
    const previousStats = await prisma.ratings.aggregate({
      where: {
        created_at: {
          gte: previousPeriodStart,
          lt: dateFrom
        }
      },
      _avg: { overall_rating: true },
      _count: { id: true }
    });

    const currentAvg = avgStats._avg.overall_rating || 0;
    const previousAvg = previousStats._avg.overall_rating || 0;
    const trend = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg * 100).toFixed(1) : '0';

    // ELM-353: Construir distribucion de ratings con count y percentage
    const ratingDistribution = {};
    for (let i = 1; i <= 5; i++) {
      const found = ratingDistributionRaw.find(r => r.overall_rating === i);
      const count = found ? found._count.id : 0;
      const percentage = totalRatings > 0 ? Math.round((count / totalRatings) * 100) : 0;
      ratingDistribution[i] = { count, percentage };
    }

    res.json({
      success: true,
      data: {
        totalRatings,
        averageRating: currentAvg.toFixed(1),
        staffEvaluated: guidesWithRatings.length,
        improvementTrend: `${trend > 0 ? '+' : ''}${trend}%`,
        ratingDistribution
      }
    });
  } catch (error) {
    console.error('Error en getDashboardStats:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadisticas del dashboard' });
  }
};

/**
 * ELM-352: GetRatingAreas
 * GET /api/ratings/areas
 * Estadisticas por area de servicio (basado en tours y sus categorias)
 */
const getRatingAreas = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const now = new Date();
    let dateFrom;
    switch (period) {
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Obtener ratings con info de reservas y tours
    const ratingsWithTours = await prisma.ratings.findMany({
      where: { created_at: { gte: dateFrom } },
      include: {
        reservations: {
          include: {
            tours: { select: { id: true, name: true, tour_type: true } }
          }
        }
      }
    });

    // Agrupar por tipo de tour (area de servicio)
    const areaStats = {};
    ratingsWithTours.forEach(r => {
      const tourType = r.reservations?.tours?.tour_type || 'general';
      if (!areaStats[tourType]) {
        areaStats[tourType] = { count: 0, totalRating: 0 };
      }
      areaStats[tourType].count++;
      areaStats[tourType].totalRating += r.overall_rating || 0;
    });

    const data = Object.entries(areaStats).map(([area, stats]) => ({
      area,
      averageRating: stats.count > 0 ? (stats.totalRating / stats.count).toFixed(1) : 0,
      totalRatings: stats.count
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getRatingAreas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadisticas por area' });
  }
};

/**
 * ELM-352: GetRatingStaff
 * GET /api/ratings/staff
 * Estadisticas de rendimiento de staff/guias
 */
const getRatingStaff = async (req, res) => {
  try {
    const { period = 'month', limit = 10 } = req.query;

    const now = new Date();
    let dateFrom;
    switch (period) {
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Obtener guias con sus ratings
    const guides = await prisma.guides.findMany({
      take: parseInt(limit),
      orderBy: { rating: 'desc' },
      select: {
        id: true,
        user_id: true,
        rating: true,
        users: {
          select: { name: true, email: true }
        }
      }
    });

    // Para cada guia, contar ratings en el periodo
    const staffStats = await Promise.all(guides.map(async (guide) => {
      // Obtener reservas del guia
      const reservations = await prisma.reservations.findMany({
        where: { guide_id: guide.id },
        select: { id: true }
      });

      const reservationIds = reservations.map(r => r.id);

      const periodRatings = await prisma.ratings.count({
        where: {
          reservation_id: { in: reservationIds },
          created_at: { gte: dateFrom },
          guide_rating: { not: null }
        }
      });

      return {
        id: guide.id,
        name: guide.users?.name || 'Sin nombre',
        averageRating: guide.rating || 0,
        totalRatings: periodRatings,
        trend: '+0%' // Simplificado por ahora
      };
    }));

    res.json({ success: true, data: staffStats });
  } catch (error) {
    console.error('Error en getRatingStaff:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadisticas de staff' });
  }
};

/**
 * ELM-352: GetServiceAreas
 * GET /api/ratings/service-areas
 * Lista de areas de servicio disponibles para filtros
 */
const getServiceAreas = async (req, res) => {
  try {
    // Obtener tipos de tour unicos como areas de servicio
    const tourTypes = await prisma.tours.findMany({
      distinct: ['tour_type'],
      where: { tour_type: { not: null } },
      select: { tour_type: true }
    });

    const data = tourTypes.map(t => ({
      key: t.tour_type,
      label: t.tour_type
    }));

    // Agregar area generica si no hay datos
    if (data.length === 0) {
      data.push({ key: 'general', label: 'General' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getServiceAreas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener areas de servicio' });
  }
};

/**
 * ELM-352: GetPeriods
 * GET /api/ratings/periods
 * Lista de periodos disponibles para filtros
 */
const getPeriods = async (req, res) => {
  try {
    // Periodos estaticos para filtros
    const data = [
      { value: 'week', label: 'Esta semana' },
      { value: 'month', label: 'Este mes' },
      { value: 'quarter', label: 'Este trimestre' },
      { value: 'year', label: 'Este ano' }
    ];

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error en getPeriods:', error);
    res.status(500).json({ success: false, error: 'Error al obtener periodos' });
  }
};

/**
 * ELM-358: CreateServiceAreaRating
 * POST /api/ratings/service-areas
 * Crea una calificacion por areas de servicio (6 areas: customerService, operations, punctuality, communication, logistics, safety)
 * FLW-101: Calificar areas de servicio post-tour
 */
const createServiceAreaRating = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const { serviceId, reservationId, ratings, comments } = req.body;

    // Validar que ratings tenga las 6 areas requeridas
    const requiredAreas = ['customerService', 'operations', 'punctuality', 'communication', 'logistics', 'safety'];
    for (const area of requiredAreas) {
      if (ratings[area] === undefined || ratings[area] < 1 || ratings[area] > 5) {
        return res.status(400).json({
          success: false,
          error: `Rating invalido para area ${area}. Debe ser un valor entre 1 y 5.`
        });
      }
    }

    // Calcular promedio
    const ratingValues = requiredAreas.map(area => ratings[area]);
    const averageRating = ratingValues.reduce((sum, val) => sum + val, 0) / ratingValues.length;

    // Crear registro en BD
    const newRating = await prisma.service_area_ratings.create({
      data: {
        reservation_id: reservationId || null,
        service_id: serviceId || null,
        rated_by_id: userId,
        customer_service: ratings.customerService,
        operations: ratings.operations,
        punctuality: ratings.punctuality,
        communication: ratings.communication,
        logistics: ratings.logistics,
        safety: ratings.safety,
        average_rating: averageRating,
        comment_customer_service: comments?.customerService || null,
        comment_operations: comments?.operations || null,
        comment_punctuality: comments?.punctuality || null,
        comment_communication: comments?.communication || null,
        comment_logistics: comments?.logistics || null,
        comment_safety: comments?.safety || null
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: newRating.id,
        averageRating: parseFloat(newRating.average_rating),
        ratings: {
          customerService: newRating.customer_service,
          operations: newRating.operations,
          punctuality: newRating.punctuality,
          communication: newRating.communication,
          logistics: newRating.logistics,
          safety: newRating.safety
        },
        createdAt: newRating.created_at
      },
      message: 'Calificacion por areas de servicio creada exitosamente'
    });
  } catch (error) {
    console.error('Error en createServiceAreaRating:', error);
    res.status(500).json({ success: false, error: 'Error al crear calificacion por areas de servicio' });
  }
};

/**
 * ELM-363: CreateTouristRating
 * POST /api/ratings/tourists
 * Crea una valoracion de experiencia de turista individual
 * FLW-034, FLW-102: Evaluar experiencia de turistas post-tour
 * Valores permitidos: excellent, good, poor
 */
const createTouristRating = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const { touristId, serviceId, reservationId, rating, comments, touristName } = req.body;

    // Validar touristId requerido
    if (!touristId) {
      return res.status(400).json({ success: false, error: 'touristId es requerido' });
    }

    // Validar rating requerido y valores permitidos
    const validRatings = ['excellent', 'good', 'poor'];
    if (!rating || !validRatings.includes(rating)) {
      return res.status(400).json({
        success: false,
        error: `rating es requerido y debe ser uno de: ${validRatings.join(', ')}`
      });
    }

    // Validar longitud de comentarios
    if (comments && comments.length > 500) {
      return res.status(400).json({ success: false, error: 'comments maximo 500 caracteres' });
    }

    // Crear registro en BD
    const newRating = await prisma.tourist_ratings.create({
      data: {
        tourist_id: touristId,
        service_id: serviceId || null,
        reservation_id: reservationId || null,
        rating: rating,
        comments: comments?.trim() || null,
        rated_by_id: userId,
        tourist_name: touristName || null
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: newRating.id,
        touristId: newRating.tourist_id,
        serviceId: newRating.service_id,
        rating: newRating.rating,
        comments: newRating.comments,
        touristName: newRating.tourist_name,
        ratedBy: newRating.rated_by_id,
        ratedAt: newRating.created_at
      },
      message: 'Valoracion de turista creada exitosamente'
    });
  } catch (error) {
    console.error('Error en createTouristRating:', error);
    res.status(500).json({ success: false, error: 'Error al crear valoracion de turista' });
  }
};

/**
 * ELM-363: GetTouristRatings
 * GET /api/ratings/tourists
 * Lista valoraciones de turistas con filtros opcionales
 */
const getTouristRatings = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, serviceId, reservationId, rating } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    const where = {};
    if (serviceId) where.service_id = serviceId;
    if (reservationId) where.reservation_id = reservationId;
    if (rating) where.rating = rating;

    const [ratings, total] = await Promise.all([
      prisma.tourist_ratings.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          users: { select: { first_name: true, last_name: true } }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.tourist_ratings.count({ where })
    ]);

    const data = ratings.map(r => ({
      id: r.id,
      touristId: r.tourist_id,
      touristName: r.tourist_name,
      serviceId: r.service_id,
      reservationId: r.reservation_id,
      rating: r.rating,
      comments: r.comments,
      ratedBy: r.users ? `${r.users.first_name} ${r.users.last_name}` : null,
      ratedAt: r.created_at
    }));

    res.json({
      success: true,
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error) {
    console.error('Error en getTouristRatings:', error);
    res.status(500).json({ success: false, error: 'Error al obtener valoraciones de turistas' });
  }
};

module.exports = {
  listGuideRatings,
  listTourRatings,
  createRating,
  updateRating,
  deleteRating,
  respondToRating,
  listPendingRatings,
  moderateRating,
  getRatingSummary,
  getGuideRatingStats,
  // Nuevas funciones para ELM-352 RatingDashboard
  getDashboardStats,
  getRatingAreas,
  getRatingStaff,
  getServiceAreas,
  getPeriods,
  // ELM-358 ServiceAreaRating - FLW-101
  createServiceAreaRating,
  // ELM-363 TouristRating - FLW-034, FLW-102
  createTouristRating,
  getTouristRatings
};
