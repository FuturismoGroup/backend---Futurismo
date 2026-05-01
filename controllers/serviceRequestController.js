// Controller de Service Requests
// CRUD de solicitudes de servicio entre agencias y guías freelance
// Tabla: service_requests, personal_events, reviews

const prisma = require('../config/db');
const { checkGuideAvailabilityForDate } = require('../utils/guideAvailability');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mensajes legibles por reason de indisponibilidad */
const AVAILABILITY_MESSAGES = {
  BLOCKED_BY_EVENT: 'El guía tiene un evento que bloquea su disponibilidad en esta fecha',
  EXISTING_REQUESTS: 'El guía ya tiene solicitudes pendientes o aceptadas en esta fecha',
  NON_WORKING_DAY: 'Este día no es laborable para el guía'
};

/**
 * POST /api/marketplace/service-requests
 * Crear solicitud de servicio
 * Roles: Agency, Admin
 */
const createServiceRequest = async (req, res) => {
  try {
    const {
      guideId,
      serviceDate,
      startTime,
      durationHours,
      groupSize,
      languages,
      message,
      location,
      specialRequirements,
      offeredTotalPrice
    } = req.body;

    // Validar campos requeridos
    if (!guideId || !UUID_REGEX.test(guideId)) {
      return res.status(400).json({ success: false, error: 'ID de guía inválido' });
    }
    if (!serviceDate) {
      return res.status(400).json({ success: false, error: 'La fecha del servicio es requerida' });
    }

    // Verificar que la fecha es futura
    const serviceDateObj = new Date(serviceDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (serviceDateObj < today) {
      return res.status(400).json({ success: false, error: 'La fecha del servicio debe ser futura' });
    }

    // Verificar guía existe y es freelance
    const guide = await prisma.guides.findUnique({
      where: { id: guideId },
      include: { users: { select: { first_name: true, last_name: true } } }
    });
    if (!guide) {
      return res.status(404).json({ success: false, error: 'Guía no encontrado' });
    }
    if (guide.guide_type !== 'FREELANCE') {
      return res.status(400).json({ success: false, error: 'Solo se pueden solicitar servicios a guías freelance' });
    }

    // Verificar disponibilidad del guía en la fecha solicitada
    const availability = await checkGuideAvailabilityForDate(prisma, guideId, serviceDateObj);
    if (!availability.available) {
      return res.status(409).json({
        success: false,
        error: AVAILABILITY_MESSAGES[availability.reason] || 'El guía no está disponible en esta fecha',
        reason: availability.reason,
        conflicts: availability.conflicts
      });
    }

    // Obtener agency_id del usuario
    const agencyId = req.user.agencyId;
    if (!agencyId && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, error: 'No se encontró la agencia del usuario' });
    }

    // Precio: usar oferta de la agencia si viene, sino calcular desde tarifa del guía
    const pricePerPerson = guide.price_per_person ? parseFloat(guide.price_per_person) : null;
    const size = parseInt(groupSize) || 1;
    const totalPrice = offeredTotalPrice
      ? parseFloat(offeredTotalPrice)
      : (pricePerPerson ? pricePerPerson * size : null);

    // Parsear start_time
    let parsedStartTime = null;
    if (startTime) {
      const [hours, minutes] = startTime.split(':');
      parsedStartTime = new Date(`1970-01-01T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00Z`);
    }

    // Crear solicitud
    const serviceRequest = await prisma.service_requests.create({
      data: {
        agency_id: agencyId || req.body.agencyId,
        guide_id: guideId,
        service_date: serviceDateObj,
        start_time: parsedStartTime,
        duration_hours: durationHours ? parseInt(durationHours) : null,
        group_size: size,
        languages: languages || null,
        message: message?.trim() || null,
        status: 'pending',
        total_price: totalPrice,
        price_per_person: pricePerPerson,
        location: location?.trim() || null,
        special_requirements: specialRequirements?.trim() || null
      },
      include: {
        guides: {
          include: { users: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } } }
        },
        agencies: {
          include: { users: { select: { first_name: true, last_name: true } } }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud creada exitosamente',
      data: formatServiceRequest(serviceRequest)
    });
  } catch (error) {
    console.error('Error en createServiceRequest:', error);
    res.status(500).json({ success: false, error: 'Error al crear solicitud de servicio' });
  }
};

/**
 * GET /api/marketplace/service-requests
 * Listar solicitudes filtradas por rol
 */
const listServiceRequests = async (req, res) => {
  try {
    const { status, dateFrom, dateTo, page = 1, pageSize = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    // Construir filtro según rol
    const where = {};

    if (req.user.role === 'agency') {
      where.agency_id = req.user.agencyId;
    } else if (req.user.role === 'guide') {
      where.guide_id = req.user.guideId;
    }
    // admin: sin filtro de ownership

    if (status && status !== 'all') {
      where.status = status;
    }
    if (dateFrom) {
      where.service_date = { ...where.service_date, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.service_date = { ...where.service_date, lte: new Date(dateTo) };
    }

    const [requests, total] = await Promise.all([
      prisma.service_requests.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { created_at: 'desc' },
        include: {
          guides: {
            include: { users: { select: { first_name: true, last_name: true, profile_photo: true } } }
          },
          agencies: {
            include: { users: { select: { first_name: true, last_name: true } } }
          },
          reviews: { take: 1 }
        }
      }),
      prisma.service_requests.count({ where })
    ]);

    const data = requests.map(formatServiceRequest);

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (error) {
    console.error('Error en listServiceRequests:', error);
    res.status(500).json({ success: false, error: 'Error al listar solicitudes' });
  }
};

/**
 * GET /api/marketplace/service-requests/:id
 * Detalle de solicitud
 */
const getServiceRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const request = await prisma.service_requests.findUnique({
      where: { id },
      include: {
        guides: {
          include: { users: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } } }
        },
        agencies: {
          include: { users: { select: { first_name: true, last_name: true, email: true, phone: true } } }
        },
        reviews: true
      }
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    // Verificar acceso según rol
    if (req.user.role === 'agency' && request.agency_id !== req.user.agencyId) {
      return res.status(403).json({ success: false, error: 'No tiene acceso a esta solicitud' });
    }
    if (req.user.role === 'guide' && request.guide_id !== req.user.guideId) {
      return res.status(403).json({ success: false, error: 'No tiene acceso a esta solicitud' });
    }

    res.json({ success: true, data: formatServiceRequest(request) });
  } catch (error) {
    console.error('Error en getServiceRequestById:', error);
    res.status(500).json({ success: false, error: 'Error al obtener solicitud' });
  }
};

/**
 * POST /api/marketplace/service-requests/:id/respond
 * Guía acepta o rechaza solicitud
 * Body: { accepted: boolean, message?: string }
 */
const respondToServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { accepted, message } = req.body;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    if (typeof accepted !== 'boolean') {
      return res.status(400).json({ success: false, error: 'El campo accepted (true/false) es requerido' });
    }

    const request = await prisma.service_requests.findUnique({
      where: { id },
      include: {
        guides: {
          include: { users: { select: { first_name: true, last_name: true } } }
        },
        agencies: {
          include: { users: { select: { first_name: true, last_name: true } } }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: `No se puede responder a una solicitud con status '${request.status}'` });
    }

    // Verificar que es el guía asignado
    if (req.user.role !== 'admin' && request.guide_id !== req.user.guideId) {
      return res.status(403).json({ success: false, error: 'Solo el guía asignado puede responder a esta solicitud' });
    }

    if (accepted) {
      // Verificar disponibilidad antes de aceptar (excluir la propia solicitud)
      const availability = await checkGuideAvailabilityForDate(prisma, request.guide_id, request.service_date, id);
      if (!availability.available) {
        return res.status(409).json({
          success: false,
          error: AVAILABILITY_MESSAGES[availability.reason] || 'Ya no estás disponible en esta fecha',
          reason: availability.reason,
          conflicts: availability.conflicts
        });
      }

      // Crear evento en calendario del guía
      const agencyName = request.agencies?.users
        ? `${request.agencies.users.first_name} ${request.agencies.users.last_name}`.trim()
        : 'Agencia';
      const eventTitle = `Marketplace: Servicio Freelance - ${agencyName}`;

      // Calcular start/end datetime
      const startDatetime = new Date(request.service_date);
      if (request.start_time) {
        const time = new Date(request.start_time);
        startDatetime.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0, 0);
      } else {
        startDatetime.setUTCHours(9, 0, 0, 0);
      }

      const endDatetime = new Date(startDatetime);
      const durationMs = (request.duration_hours || 4) * 60 * 60 * 1000;
      endDatetime.setTime(endDatetime.getTime() + durationMs);

      // Transaction: actualizar request + crear evento
      const result = await prisma.$transaction(async (tx) => {
        const calendarEvent = await tx.personal_events.create({
          data: {
            guide_id: request.guide_id,
            title: eventTitle,
            description: `Solicitud de servicio del marketplace. ${request.message || ''}`.trim(),
            start_datetime: startDatetime,
            end_datetime: endDatetime,
            all_day: false,
            event_type: 'marketplace_service',
            color: '#8B5CF6',
            blocks_availability: true
          }
        });

        const updated = await tx.service_requests.update({
          where: { id },
          data: {
            status: 'accepted',
            responded_at: new Date(),
            guide_response_message: message?.trim() || null,
            calendar_event_id: calendarEvent.id
          },
          include: {
            guides: {
              include: { users: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } } }
            },
            agencies: {
              include: { users: { select: { first_name: true, last_name: true, email: true, phone: true } } }
            },
            reviews: true
          }
        });

        return updated;
      });

      res.json({
        success: true,
        message: 'Solicitud aceptada exitosamente',
        data: formatServiceRequest(result)
      });
    } else {
      // Rechazar
      const updated = await prisma.service_requests.update({
        where: { id },
        data: {
          status: 'rejected',
          responded_at: new Date(),
          guide_response_message: message?.trim() || null
        },
        include: {
          guides: {
            include: { users: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } } }
          },
          agencies: {
            include: { users: { select: { first_name: true, last_name: true, email: true, phone: true } } }
          },
          reviews: true
        }
      });

      res.json({
        success: true,
        message: 'Solicitud rechazada',
        data: formatServiceRequest(updated)
      });
    }
  } catch (error) {
    console.error('Error en respondToServiceRequest:', error);
    res.status(500).json({ success: false, error: 'Error al responder a la solicitud' });
  }
};

/**
 * POST /api/marketplace/service-requests/:id/cancel
 * Agencia cancela solicitud
 */
const cancelServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const request = await prisma.service_requests.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    if (req.user.role !== 'admin' && request.agency_id !== req.user.agencyId) {
      return res.status(403).json({ success: false, error: 'No tiene permiso para cancelar esta solicitud' });
    }

    if (!['pending', 'accepted'].includes(request.status)) {
      return res.status(400).json({ success: false, error: `No se puede cancelar una solicitud con status '${request.status}'` });
    }

    // Si tenía evento en calendario, eliminarlo
    await prisma.$transaction(async (tx) => {
      if (request.calendar_event_id) {
        await tx.personal_events.delete({
          where: { id: request.calendar_event_id }
        }).catch(() => {}); // Ignorar si ya no existe
      }

      await tx.service_requests.update({
        where: { id },
        data: {
          status: 'cancelled',
          calendar_event_id: null
        }
      });
    });

    const updated = await prisma.service_requests.findUnique({
      where: { id },
      include: {
        guides: {
          include: { users: { select: { first_name: true, last_name: true, profile_photo: true } } }
        },
        agencies: {
          include: { users: { select: { first_name: true, last_name: true } } }
        },
        reviews: true
      }
    });

    res.json({
      success: true,
      message: 'Solicitud cancelada exitosamente',
      data: formatServiceRequest(updated)
    });
  } catch (error) {
    console.error('Error en cancelServiceRequest:', error);
    res.status(500).json({ success: false, error: 'Error al cancelar solicitud' });
  }
};

/**
 * POST /api/marketplace/service-requests/:id/complete
 * Marcar servicio como completado y registrar ingreso al guía
 */
const completeServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const request = await prisma.service_requests.findUnique({
      where: { id },
      include: {
        agencies: {
          include: { users: { select: { first_name: true, last_name: true } } }
        }
      }
    });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    if (req.user.role !== 'admin' && request.agency_id !== req.user.agencyId) {
      return res.status(403).json({ success: false, error: 'No tiene permiso para completar esta solicitud' });
    }

    if (request.status !== 'accepted') {
      return res.status(400).json({ success: false, error: 'Solo se pueden completar solicitudes aceptadas' });
    }

    // Transaction: completar servicio + registrar ingreso al guía
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Actualizar status a completed
      const completedRequest = await tx.service_requests.update({
        where: { id },
        data: { status: 'completed' },
        include: {
          guides: {
            include: { users: { select: { first_name: true, last_name: true, profile_photo: true } } }
          },
          agencies: {
            include: { users: { select: { first_name: true, last_name: true } } }
          },
          reviews: true
        }
      });

      // 2. Registrar ingreso al guía (si tiene precio y no existe ya)
      if (request.total_price && parseFloat(request.total_price) > 0) {
        // Verificar que no exista ingreso duplicado para este service_request
        const existingIncome = await tx.income.findFirst({
          where: { service_request_id: id }
        });

        if (!existingIncome) {
          // Obtener o crear income_type para marketplace
          let incomeType = await tx.income_types.findUnique({
            where: { value: 'marketplace_freelance' }
          });
          if (!incomeType) {
            incomeType = await tx.income_types.create({
              data: {
                name: 'Servicio Marketplace',
                value: 'marketplace_freelance',
                icon: 'briefcase',
                color: '#8B5CF6',
                description: 'Ingreso por servicio freelance del marketplace',
                is_active: true
              }
            });
          }

          const agencyName = request.agencies?.business_name
            || (request.agencies?.users
              ? `${request.agencies.users.first_name} ${request.agencies.users.last_name}`.trim()
              : 'Agencia');

          await tx.income.create({
            data: {
              guide_id: request.guide_id,
              type_id: incomeType.id,
              service_request_id: id,
              amount: parseFloat(request.total_price),
              description: `Servicio freelance marketplace - ${agencyName}`,
              date: request.service_date,
              source: agencyName
            }
          });
        }
      }

      return completedRequest;
    });

    res.json({
      success: true,
      message: 'Servicio marcado como completado',
      data: formatServiceRequest(updated)
    });
  } catch (error) {
    console.error('Error en completeServiceRequest:', error);
    res.status(500).json({ success: false, error: 'Error al completar solicitud' });
  }
};

/**
 * POST /api/marketplace/reviews
 * Crear review para servicio completado
 */
const createReview = async (req, res) => {
  try {
    const { serviceRequestId, rating, comment } = req.body;

    if (!serviceRequestId || !UUID_REGEX.test(serviceRequestId)) {
      return res.status(400).json({ success: false, error: 'ID de solicitud inválido' });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'El rating debe estar entre 1 y 5' });
    }

    const request = await prisma.service_requests.findUnique({ where: { id: serviceRequestId } });
    if (!request) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }
    if (request.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Solo se pueden reseñar servicios completados' });
    }

    // Verificar no existe review previa
    const existingReview = await prisma.reviews.findFirst({
      where: { service_request_id: serviceRequestId }
    });
    if (existingReview) {
      return res.status(409).json({ success: false, error: 'Ya existe una reseña para esta solicitud' });
    }

    // Crear review y actualizar rating del guía en transacción
    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.reviews.create({
        data: {
          guide_id: request.guide_id,
          reviewer_id: req.user.id,
          service_request_id: serviceRequestId,
          rating: parseInt(rating),
          comment: comment?.trim() || null
        }
      });

      // Recalcular rating promedio del guía
      const avgResult = await tx.reviews.aggregate({
        where: { guide_id: request.guide_id },
        _avg: { rating: true }
      });

      if (avgResult._avg.rating !== null) {
        await tx.guides.update({
          where: { id: request.guide_id },
          data: { rating: Math.round(avgResult._avg.rating * 100) / 100 }
        });
      }

      return review;
    });

    res.status(201).json({
      success: true,
      message: 'Reseña creada exitosamente',
      data: {
        id: result.id,
        guideId: result.guide_id,
        reviewerId: result.reviewer_id,
        serviceRequestId: result.service_request_id,
        rating: result.rating,
        comment: result.comment,
        createdAt: result.created_at
      }
    });
  } catch (error) {
    console.error('Error en createReview:', error);
    res.status(500).json({ success: false, error: 'Error al crear reseña' });
  }
};

/**
 * GET /api/marketplace/guides/:guideId/check-date-availability?date=YYYY-MM-DD
 * Verificar disponibilidad de un guía en una fecha
 * Roles: Agency, Admin
 */
const checkDateAvailability = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { date } = req.query;

    if (!guideId || !UUID_REGEX.test(guideId)) {
      return res.status(400).json({ success: false, error: 'ID de guía inválido' });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Fecha inválida. Formato requerido: YYYY-MM-DD' });
    }

    const dateObj = new Date(date + 'T00:00:00Z');
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ success: false, error: 'Fecha inválida' });
    }

    const availability = await checkGuideAvailabilityForDate(prisma, guideId, dateObj);

    res.json({
      success: true,
      data: {
        available: availability.available,
        reason: availability.reason || null,
        message: availability.reason ? (AVAILABILITY_MESSAGES[availability.reason] || null) : null,
        date
      }
    });
  } catch (error) {
    console.error('Error en checkDateAvailability:', error);
    res.status(500).json({ success: false, error: 'Error al verificar disponibilidad' });
  }
};

// =============================================================================
// HELPERS
// =============================================================================

function formatServiceRequest(r) {
  const guideName = r.guides?.users
    ? `${r.guides.users.first_name || ''} ${r.guides.users.last_name || ''}`.trim()
    : null;
  const agencyName = r.agencies?.users
    ? `${r.agencies.users.first_name || ''} ${r.agencies.users.last_name || ''}`.trim()
    : null;

  return {
    id: r.id,
    agencyId: r.agency_id,
    guideId: r.guide_id,
    serviceDate: r.service_date,
    startTime: r.start_time,
    durationHours: r.duration_hours,
    groupSize: r.group_size,
    languages: r.languages,
    message: r.message,
    status: r.status,
    respondedAt: r.responded_at,
    createdAt: r.created_at,
    totalPrice: r.total_price ? parseFloat(r.total_price) : null,
    pricePerPerson: r.price_per_person ? parseFloat(r.price_per_person) : null,
    location: r.location,
    specialRequirements: r.special_requirements,
    guideResponseMessage: r.guide_response_message,
    calendarEventId: r.calendar_event_id,
    guide: r.guides ? {
      id: r.guides.id,
      name: guideName,
      profilePhoto: r.guides.users?.profile_photo || r.guides.guide_photo,
      email: r.guides.users?.email,
      phone: r.guides.users?.phone,
      rating: r.guides.rating ? parseFloat(r.guides.rating) : null
    } : null,
    agency: r.agencies ? {
      id: r.agencies.id,
      businessName: r.agencies.business_name,
      contactName: agencyName,
      email: r.agencies.users?.email,
      phone: r.agencies.users?.phone
    } : null,
    hasReview: r.reviews && r.reviews.length > 0,
    review: r.reviews && r.reviews[0] ? {
      id: r.reviews[0].id,
      rating: r.reviews[0].rating,
      comment: r.reviews[0].comment,
      createdAt: r.reviews[0].created_at
    } : null
  };
}

module.exports = {
  createServiceRequest,
  listServiceRequests,
  getServiceRequestById,
  respondToServiceRequest,
  cancelServiceRequest,
  completeServiceRequest,
  createReview,
  checkDateAvailability
};
