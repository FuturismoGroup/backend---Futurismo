// Controller de Monitoring
// Fuente: 04_apis_lista.md
// API-088 a API-090: Monitoreo de tours en tiempo real

const prisma = require('../config/db');

/**
 * API-088: GetActiveToursMonitoring
 * GET /api/monitoring/active-tours
 * Roles permitidos: Admin, Agency
 * Incluye: ubicación GPS, progreso real de paradas, fotos y notas
 */
const getActiveToursMonitoring = async (req, res) => {
  try {
    const { agencyId, status } = req.query;

    // Construir filtros - buscar reservas:
    // 1. Programadas para hoy con estado confirmed/in_progress
    // 2. Con tour activo en progreso (cualquier fecha, ya fueron iniciadas)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = {
      OR: [
        // Reservas de hoy confirmadas o en progreso
        {
          status: { in: ['confirmed', 'in_progress'] },
          date: { gte: today, lt: tomorrow }
        },
        // Reservas con tour activo en progreso (cualquier fecha)
        {
          status: 'in_progress',
          active_tours: { status: 'in_progress' }
        }
      ]
    };

    // Si es Agency, filtrar solo sus tours
    if (req.user?.role === 'agency') {
      // Buscar la agencia del usuario
      const userAgency = await prisma.agencies.findUnique({
        where: { user_id: req.user.id }
      });
      if (userAgency) {
        where.agency_id = userAgency.id;
      }
    } else if (agencyId) {
      where.agency_id = agencyId;
    }

    // Obtener reservas activas (tours en progreso) con TODOS los datos necesarios
    const activeReservations = await prisma.reservations.findMany({
      where,
      include: {
        tours: {
          select: {
            id: true,
            name: true,
            duration: true,
            tour_stops: {
              select: {
                id: true,
                name: true,
                order_num: true
              },
              orderBy: { order_num: 'asc' }
            }
          }
        },
        guides: {
          select: {
            id: true,
            users: {
              select: {
                first_name: true,
                last_name: true,
                phone: true
              }
            }
          }
        },
        active_tours: {
          select: {
            id: true,
            status: true,
            started_at: true,
            last_location_update: true,
            guide_locations: {
              orderBy: { recorded_at: 'desc' },
              take: 1,
              select: {
                latitude: true,
                longitude: true,
                accuracy: true,
                speed: true,
                recorded_at: true
              }
            },
            // Incluir progreso de paradas
            tour_progress: {
              select: {
                id: true,
                tour_stop_id: true,
                status: true,
                arrived_at: true,
                departed_at: true,
                notes: true,
                tour_stops: {
                  select: {
                    id: true,
                    name: true,
                    order_num: true
                  }
                }
              },
              orderBy: {
                tour_stops: { order_num: 'asc' }
              }
            },
            // Incluir fotos del tour
            tour_photos: {
              select: {
                id: true,
                photo_url: true,
                caption: true,
                taken_at: true,
                latitude: true,
                longitude: true,
                tour_stop_id: true,
                tour_stops: {
                  select: { name: true }
                }
              },
              orderBy: { taken_at: 'desc' },
              take: 10 // Últimas 10 fotos
            }
          }
        }
      },
      orderBy: { time: 'asc' }
    });

    // Procesar datos de monitoreo con información completa
    const data = activeReservations.map(r => {
      const now = new Date();
      // Combinar fecha y hora para obtener startTime
      const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date;
      const timeStr = r.time instanceof Date ? r.time.toISOString().split('T')[1] : r.time;
      const scheduledStartTime = new Date(`${dateStr}T${timeStr}`);

      // Usar hora de inicio real si el tour ya comenzó
      const actualStartTime = r.active_tours?.started_at
        ? new Date(r.active_tours.started_at)
        : scheduledStartTime;

      const duration = r.tours?.duration || 240; // minutos
      const endTime = new Date(actualStartTime.getTime() + duration * 60000);

      // Calcular progreso REAL basado en paradas completadas
      const totalStops = r.tours?.tour_stops?.length || 0;
      const tourProgress = r.active_tours?.tour_progress || [];
      const completedStops = tourProgress.filter(tp =>
        tp.status === 'completed'
      ).length;

      // Progreso basado en paradas (si hay paradas) o en tiempo (fallback)
      let progress;
      if (totalStops > 0 && r.active_tours?.status === 'in_progress') {
        progress = Math.round((completedStops / totalStops) * 100);
      } else {
        // Fallback a progreso por tiempo
        const elapsedMinutes = Math.max(0, (now - actualStartTime) / 60000);
        progress = Math.min(100, Math.round((elapsedMinutes / duration) * 100));
      }

      // Determinar parada actual (la última con status "in_progress")
      const currentStopProgress = tourProgress.find(tp => tp.status === 'in_progress');
      const currentStop = currentStopProgress?.tour_stops?.name ||
        (completedStops === totalStops && totalStops > 0 ? 'Tour completado' : 'En tránsito');

      // Determinar estado del tour
      let tourStatus = 'on_route';
      if (r.active_tours?.status === 'completed' || progress >= 100) {
        tourStatus = 'completed';
      } else if (r.active_tours?.status === 'in_progress') {
        tourStatus = 'enroute';
      } else if (!r.active_tours || r.active_tours.status === 'pending') {
        tourStatus = 'pending';
      }

      // Nombre completo del guía
      const guideName = r.guides?.users
        ? `${r.guides.users.first_name || ''} ${r.guides.users.last_name || ''}`.trim()
        : 'Sin guía asignado';

      // Obtener última ubicación del guía
      const lastGuideLocation = r.active_tours?.guide_locations?.[0];
      const guideLocation = lastGuideLocation ? {
        lat: parseFloat(lastGuideLocation.latitude),
        lng: parseFloat(lastGuideLocation.longitude),
        accuracy: lastGuideLocation.accuracy ? parseFloat(lastGuideLocation.accuracy) : null,
        speed: lastGuideLocation.speed ? parseFloat(lastGuideLocation.speed) : null,
        recordedAt: lastGuideLocation.recorded_at
      } : null;

      // Procesar fotos del tour
      const photos = (r.active_tours?.tour_photos || []).map(p => ({
        id: p.id,
        url: p.photo_url,
        caption: p.caption,
        stopName: p.tour_stops?.name || 'Sin parada',
        takenAt: p.taken_at,
        coordinates: p.latitude && p.longitude ? {
          lat: parseFloat(p.latitude),
          lng: parseFloat(p.longitude)
        } : null
      }));

      // Procesar progreso de paradas con detalles
      const stopsProgress = tourProgress.map(tp => ({
        stopId: tp.tour_stop_id,
        stopName: tp.tour_stops?.name,
        orderNum: tp.tour_stops?.order_num,
        status: tp.status,
        arrivedAt: tp.arrived_at,
        departedAt: tp.departed_at,
        notes: tp.notes
      }));

      return {
        reservationId: r.id,
        tourName: r.tours?.name || 'Tour no especificado',
        guideId: r.guides?.id || null,
        guideName,
        guidePhone: r.guides?.users?.phone || null,
        guideLocation,
        lastLocationUpdate: r.active_tours?.last_location_update || null,
        currentStop,
        progress,
        passengers: r.participants || (r.adults + r.children),
        billingName: r.billing_name || 'Sin nombre',
        status: tourStatus,
        startTime: actualStartTime,
        estimatedEndTime: endTime,
        activeTourId: r.active_tours?.id || null,
        activeTourStatus: r.active_tours?.status || null,
        // Nuevos campos para monitoreo detallado
        totalStops,
        completedStops,
        stopsProgress,
        photos,
        photosCount: photos.length
      };
    });

    // Filtrar por status si se especifica
    const filteredData = status
      ? data.filter(d => d.status === status)
      : data;

    res.json({
      data: filteredData,
      total: filteredData.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en getActiveToursMonitoring:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener monitoreo de tours activos'
    });
  }
};

/**
 * API-089: UpdateGuideLocation
 * POST /api/monitoring/location
 * Roles permitidos: Guide
 */
const updateGuideLocation = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      reservationId
    } = req.body;

    // Validaciones
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'latitude y longitude son obligatorios'
      });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'latitude debe estar entre -90 y 90'
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'longitude debe estar entre -180 y 180'
      });
    }

    // Obtener guía del usuario actual
    const guide = await prisma.guides.findFirst({
      where: { user_id: req.user.id }
    });

    if (!guide) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Usuario no es un guía'
      });
    }

    const now = new Date();

    // Buscar tour activo del guía (puede venir reservationId específico o buscar el activo)
    let activeTour;

    if (reservationId) {
      // Buscar tour específico por reservación
      activeTour = await prisma.active_tours.findUnique({
        where: { reservation_id: reservationId }
      });

      if (!activeTour) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'No se encontró tour activo para esta reservación'
        });
      }

      // Verificar que el guía está asignado a este tour
      if (activeTour.guide_id !== guide.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No estás asignado a este tour'
        });
      }
    } else {
      // Buscar cualquier tour activo del guía
      activeTour = await prisma.active_tours.findFirst({
        where: {
          guide_id: guide.id,
          status: 'in_progress'
        }
      });

      if (!activeTour) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'No tienes ningún tour activo en progreso'
        });
      }
    }

    // Guardar ubicación en guide_locations
    // Limitar accuracy y speed al máximo permitido por Decimal(6,2) = 9999.99
    const maxDecimalValue = 9999.99;
    const safeAccuracy = accuracy ? Math.min(parseFloat(accuracy), maxDecimalValue) : null;
    const safeSpeed = speed ? Math.min(parseFloat(speed), maxDecimalValue) : null;

    const locationRecord = await prisma.guide_locations.create({
      data: {
        active_tour_id: activeTour.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: safeAccuracy,
        speed: safeSpeed,
        recorded_at: now
      }
    });

    // Actualizar last_location_update en active_tours
    await prisma.active_tours.update({
      where: { id: activeTour.id },
      data: { last_location_update: now }
    });

    console.log(`[GPS] Ubicación guardada para tour ${activeTour.id.substring(0, 8)}: (${latitude}, ${longitude})`);

    // Emitir ubicacion por WebSocket a admins/agencias en tiempo real
    const io = req.app.get('io');
    if (io) {
      const { emitLocationUpdate } = require('../socket/handlers/monitoringHandler');
      // Obtener nombre del guia para el payload
      const guideUser = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: { first_name: true, last_name: true }
      });
      emitLocationUpdate(io, {
        guideId: guide.id,
        guideName: guideUser ? `${guideUser.first_name} ${guideUser.last_name}` : 'Guía',
        activeTourId: activeTour.id,
        reservationId: activeTour.reservation_id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: safeAccuracy,
        speed: safeSpeed,
        recordedAt: now.toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Ubicación registrada correctamente',
      data: {
        locationId: locationRecord.id,
        activeTourId: activeTour.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        speed: speed ? parseFloat(speed) : null
      },
      timestamp: now
    });
  } catch (error) {
    console.error('Error en updateGuideLocation:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar ubicación'
    });
  }
};

/**
 * API-090: GetMonitoringAlerts
 * GET /api/monitoring/alerts
 * Roles permitidos: Admin, Agency
 * NOTA: La tabla monitoring_alerts no existe aún - devuelve array vacío
 */
const getMonitoringAlerts = async (req, res) => {
  try {
    // TODO: Crear tabla monitoring_alerts si se necesita sistema de alertas
    // Por ahora devolvemos array vacío
    res.json({
      data: [],
      total: 0,
      timestamp: new Date(),
      message: 'Sistema de alertas pendiente de implementación'
    });
  } catch (error) {
    console.error('Error en getMonitoringAlerts:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener alertas de monitoreo'
    });
  }
};

// NOTA: Las funciones getTourPhotos y uploadTourPhoto fueron movidas a tourPhotoController.js
// Ahora las fotos se manejan en /api/tours/:tourId/photos con almacenamiento físico

/**
 * Función auxiliar: AcknowledgeAlert
 * PATCH /api/monitoring/alerts/:id/acknowledge
 * NOTA: La tabla monitoring_alerts no existe aún
 */
const acknowledgeAlert = async (req, res) => {
  try {
    // TODO: Implementar cuando exista tabla monitoring_alerts
    return res.status(404).json({
      error: 'Not Found',
      message: 'Sistema de alertas pendiente de implementación'
    });
  } catch (error) {
    console.error('Error en acknowledgeAlert:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al reconocer alerta'
    });
  }
};

module.exports = {
  getActiveToursMonitoring,
  updateGuideLocation,
  getMonitoringAlerts,
  acknowledgeAlert
};
