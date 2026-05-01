// Controller de Tour Progress
// Gestión del progreso de tours activos
// Tablas: active_tours, tour_progress, tour_stops

const prisma = require('../config/db');

/**
 * GetTourProgress
 * GET /api/tours/:tourId/progress
 * Obtiene el progreso de un tour activo
 * Roles permitidos: Admin, Agency, Guide
 */
const getTourProgress = async (req, res) => {
  try {
    // La ruta es /:id/progress, por eso usamos req.params.id
    const tourId = req.params.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tourId || !uuidRegex.test(tourId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId debe ser un UUID válido'
      });
    }

    // Obtener tour activo con sus paradas
    const activeTour = await prisma.active_tours.findUnique({
      where: { id: tourId },
      include: {
        reservations: {
          include: {
            tours: {
              include: {
                tour_stops: {
                  orderBy: { order_num: 'asc' }
                }
              }
            }
          }
        },
        guides: {
          include: {
            users: {
              select: { id: true, first_name: true, last_name: true, email: true }
            }
          }
        },
        tour_progress: {
          include: {
            tour_stops: true
          }
        }
      }
    });

    if (!activeTour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour activo no encontrado'
      });
    }

    // Combinar paradas con progreso
    const tour = activeTour.reservations?.tours;
    const stops = tour?.tour_stops || [];
    const progressMap = new Map(
      activeTour.tour_progress.map(p => [p.tour_stop_id, p])
    );

    const stopsWithProgress = stops.map(stop => {
      const progress = progressMap.get(stop.id);
      return {
        id: stop.id,
        name: stop.name,
        orderNum: stop.order_num,
        duration: stop.duration,
        description: stop.description,
        status: progress?.status || 'pending',
        arrivedAt: progress?.arrived_at || null,
        departedAt: progress?.departed_at || null,
        notes: progress?.notes || null
      };
    });

    // Calcular progreso general
    // Contar paradas completadas
    const completedStops = stopsWithProgress.filter(s => s.status === 'completed').length;
    // Contar paradas visitadas (completed + in_progress)
    const visitedStops = stopsWithProgress.filter(s => s.status === 'completed' || s.status === 'in_progress').length;
    const totalStops = stopsWithProgress.length;
    // El progreso se basa en paradas completadas, pero mostramos también las visitadas
    const progressPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

    // Encontrar parada actual (la última con status in_progress, o la primera pending)
    // Si hay múltiples in_progress (error de datos), tomar la de mayor orderNum
    const inProgressStops = stopsWithProgress.filter(s => s.status === 'in_progress');
    const currentStop = inProgressStops.length > 0
      ? inProgressStops.reduce((max, s) => s.orderNum > max.orderNum ? s : max, inProgressStops[0])
      : stopsWithProgress.find(s => s.status === 'pending');

    return res.status(200).json({
      success: true,
      data: {
        id: activeTour.id,
        tourName: tour?.name,
        status: activeTour.status,
        startedAt: activeTour.started_at,
        guide: activeTour.guides ? {
          id: activeTour.guides.id,
          name: `${activeTour.guides.users?.first_name || ''} ${activeTour.guides.users?.last_name || ''}`.trim()
        } : null,
        progress: {
          percent: progressPercent,
          completedStops,
          totalStops,
          currentStopId: currentStop?.id || null,
          currentStopName: currentStop?.name || null
        },
        stops: stopsWithProgress
      }
    });
  } catch (error) {
    console.error('Error en getTourProgress:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener progreso del tour'
    });
  }
};

/**
 * CheckInTourStop
 * POST /api/tours/:tourId/stops/:stopId/checkin
 * Marca llegada a una parada
 * Roles permitidos: Guide
 */
const checkInTourStop = async (req, res) => {
  try {
    // La ruta es /:id/stops/:stopId/checkin, por eso usamos req.params.id
    const tourId = req.params.id;
    const { stopId } = req.params;
    const { notes, latitude, longitude } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId) || !uuidRegex.test(stopId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId y stopId deben ser UUIDs válidos'
      });
    }

    // Verificar tour existe
    const activeTour = await prisma.active_tours.findUnique({
      where: { id: tourId }
    });

    if (!activeTour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour activo no encontrado'
      });
    }

    // Verificar parada existe
    const stop = await prisma.tour_stops.findUnique({
      where: { id: stopId }
    });

    if (!stop) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Parada no encontrada'
      });
    }

    const now = new Date();

    // Auto check-out de paradas anteriores que estén "in_progress"
    const autoCheckoutResult = await prisma.tour_progress.updateMany({
      where: {
        active_tour_id: tourId,
        status: 'in_progress',
        tour_stop_id: { not: stopId }
      },
      data: {
        status: 'completed',
        departed_at: now
      }
    });

    if (autoCheckoutResult.count > 0) {
      console.log(`[TOUR_PROGRESS] Auto check-out de ${autoCheckoutResult.count} parada(s) anterior(es) para tour ${tourId.substring(0, 8)}`);
    }

    // Buscar o crear registro de progreso
    let progress = await prisma.tour_progress.findFirst({
      where: {
        active_tour_id: tourId,
        tour_stop_id: stopId
      }
    });

    console.log(`[TOUR_PROGRESS] Check-in para stop ${stopId.substring(0, 8)}, estado actual: ${progress?.status || 'sin registro'}`);

    // Si ya está completado, no permitir re-check-in
    if (progress && progress.status === 'completed') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Esta parada ya fue completada'
      });
    }

    // Si ya está in_progress, actualizar el arrived_at (re-check-in permitido)
    if (progress) {
      progress = await prisma.tour_progress.update({
        where: { id: progress.id },
        data: {
          status: 'in_progress',
          arrived_at: now,
          notes: notes || progress.notes
        }
      });
      console.log(`[TOUR_PROGRESS] Check-in actualizado para stop ${stopId.substring(0, 8)}`);
    } else {
      progress = await prisma.tour_progress.create({
        data: {
          active_tour_id: tourId,
          tour_stop_id: stopId,
          status: 'in_progress',
          arrived_at: now,
          notes: notes || null
        }
      });
      console.log(`[TOUR_PROGRESS] Check-in creado para stop ${stopId.substring(0, 8)}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Check-in registrado',
      data: {
        stopId,
        stopName: stop.name,
        status: 'in_progress',
        arrivedAt: now
      }
    });
  } catch (error) {
    console.error('Error en checkInTourStop:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al registrar check-in'
    });
  }
};

/**
 * CheckOutTourStop
 * POST /api/tours/:tourId/stops/:stopId/checkout
 * Marca salida de una parada
 * Roles permitidos: Guide
 */
const checkOutTourStop = async (req, res) => {
  try {
    // La ruta es /:id/stops/:stopId/checkout, por eso usamos req.params.id
    const tourId = req.params.id;
    const { stopId } = req.params;
    const { notes } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId) || !uuidRegex.test(stopId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId y stopId deben ser UUIDs válidos'
      });
    }

    // Buscar registro de progreso
    const progress = await prisma.tour_progress.findFirst({
      where: {
        active_tour_id: tourId,
        tour_stop_id: stopId
      },
      include: {
        tour_stops: true
      }
    });

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'No se encontró check-in para esta parada'
      });
    }

    if (progress.status !== 'in_progress') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Debe hacer check-in antes de check-out'
      });
    }

    const now = new Date();

    const updated = await prisma.tour_progress.update({
      where: { id: progress.id },
      data: {
        status: 'completed',
        departed_at: now,
        notes: notes || progress.notes
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Check-out registrado',
      data: {
        stopId,
        stopName: progress.tour_stops?.name,
        status: 'completed',
        arrivedAt: progress.arrived_at,
        departedAt: now
      }
    });
  } catch (error) {
    console.error('Error en checkOutTourStop:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al registrar check-out'
    });
  }
};

/**
 * UpdateTourStopStatus
 * PATCH /api/tours/:tourId/stops/:stopId
 * Actualiza estado de una parada
 * Roles permitidos: Guide
 */
const updateTourStopStatus = async (req, res) => {
  try {
    // La ruta es /:id/stops/:stopId, por eso usamos req.params.id
    const tourId = req.params.id;
    const { stopId } = req.params;
    const { status, notes } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId) || !uuidRegex.test(stopId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId y stopId deben ser UUIDs válidos'
      });
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `status debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // Buscar o crear registro de progreso
    let progress = await prisma.tour_progress.findFirst({
      where: {
        active_tour_id: tourId,
        tour_stop_id: stopId
      }
    });

    const now = new Date();
    const updateData = {};

    if (status) {
      updateData.status = status;
      if (status === 'in_progress' && !progress?.arrived_at) {
        updateData.arrived_at = now;
      }
      if (status === 'completed' && !progress?.departed_at) {
        updateData.departed_at = now;
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (progress) {
      progress = await prisma.tour_progress.update({
        where: { id: progress.id },
        data: updateData,
        include: { tour_stops: true }
      });
    } else {
      progress = await prisma.tour_progress.create({
        data: {
          active_tour_id: tourId,
          tour_stop_id: stopId,
          status: status || 'pending',
          arrived_at: status === 'in_progress' || status === 'completed' ? now : null,
          departed_at: status === 'completed' ? now : null,
          notes: notes || null
        },
        include: { tour_stops: true }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Estado de parada actualizado',
      data: {
        stopId,
        stopName: progress.tour_stops?.name,
        status: progress.status,
        arrivedAt: progress.arrived_at,
        departedAt: progress.departed_at,
        notes: progress.notes
      }
    });
  } catch (error) {
    console.error('Error en updateTourStopStatus:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar estado de parada'
    });
  }
};

/**
 * ReportTourIncident
 * POST /api/tours/:tourId/incidents
 * Reporta un incidente durante el tour
 * Roles permitidos: Guide
 */
const reportTourIncident = async (req, res) => {
  try {
    // La ruta es /:id/incidents, por eso usamos req.params.id
    const tourId = req.params.id;
    const { type, severity, description, stopId, latitude, longitude } = req.body;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId debe ser un UUID válido'
      });
    }

    // Validar campos obligatorios
    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'type y description son obligatorios'
      });
    }

    // Verificar tour existe
    const activeTour = await prisma.active_tours.findUnique({
      where: { id: tourId }
    });

    if (!activeTour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour activo no encontrado'
      });
    }

    // Verificar si existe tabla tour_incidents
    // Si no existe, usamos monitoring_alerts como alternativa
    try {
      const incident = await prisma.tour_incidents.create({
        data: {
          active_tour_id: tourId,
          tour_stop_id: stopId || null,
          type,
          severity: severity || 'medium',
          description,
          reported_by: userId,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Incidente reportado',
        data: {
          id: incident.id,
          type: incident.type,
          severity: incident.severity,
          createdAt: incident.created_at
        }
      });
    } catch (prismaError) {
      // Si la tabla no existe, crear alerta de monitoreo
      if (prismaError.code === 'P2021' || prismaError.message.includes('does not exist')) {
        const alert = await prisma.monitoring_alerts.create({
          data: {
            active_tour_id: tourId,
            type: `incident_${type}`,
            severity: severity || 'medium',
            message: description,
            acknowledged: false
          }
        });

        return res.status(201).json({
          success: true,
          message: 'Incidente reportado como alerta',
          data: {
            id: alert.id,
            type: alert.type,
            severity: alert.severity,
            createdAt: alert.created_at
          }
        });
      }
      throw prismaError;
    }
  } catch (error) {
    console.error('Error en reportTourIncident:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al reportar incidente'
    });
  }
};

/**
 * CompleteTour
 * POST /api/tours/:tourId/complete
 * Marca un tour activo como completado
 * Roles permitidos: Guide
 */
const completeTour = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, rating, feedback } = req.body;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Buscar tour activo
    const activeTour = await prisma.active_tours.findUnique({
      where: { id },
      include: {
        reservations: {
          include: {
            tours: true
          }
        },
        guides: {
          include: {
            users: {
              select: { id: true, first_name: true, last_name: true }
            }
          }
        },
        tour_progress: true
      }
    });

    if (!activeTour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour activo no encontrado'
      });
    }

    // Verificar que no esté ya completado
    if (activeTour.status === 'completed') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'El tour ya está completado'
      });
    }

    const now = new Date();

    // Actualizar tour activo a completado
    const updatedTour = await prisma.active_tours.update({
      where: { id },
      data: {
        status: 'completed',
        ended_at: now
      }
    });

    // Actualizar la reserva asociada si existe
    if (activeTour.reservation_id) {
      await prisma.reservations.update({
        where: { id: activeTour.reservation_id },
        data: {
          status: 'completed'
        }
      });
    }

    // Calcular estadísticas del tour
    const totalStops = activeTour.tour_progress?.length || 0;
    const completedStops = activeTour.tour_progress?.filter(p => p.status === 'completed').length || 0;
    const duration = activeTour.started_at
      ? Math.round((now - new Date(activeTour.started_at)) / 60000) // minutos
      : null;

    return res.status(200).json({
      success: true,
      message: 'Tour completado exitosamente',
      data: {
        id: updatedTour.id,
        tourName: activeTour.reservations?.tours?.name,
        status: 'completed',
        startedAt: activeTour.started_at,
        completedAt: now,
        durationMinutes: duration,
        stats: {
          totalStops,
          completedStops,
          completionRate: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 100
        },
        guide: activeTour.guides ? {
          id: activeTour.guides.id,
          name: `${activeTour.guides.users?.first_name || ''} ${activeTour.guides.users?.last_name || ''}`.trim()
        } : null
      }
    });
  } catch (error) {
    console.error('Error en completeTour:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al completar el tour'
    });
  }
};

module.exports = {
  getTourProgress,
  checkInTourStop,
  checkOutTourStop,
  updateTourStopStatus,
  reportTourIncident,
  completeTour
};
