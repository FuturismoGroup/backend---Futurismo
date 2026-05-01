// Controller de Emergencies
// Fuente: 04_apis_lista.md
// API-071 a API-075: Gestión de emergencias

const prisma = require('../config/db');

/**
 * API-071: ListEmergencies
 * GET /api/emergencies
 * Roles permitidos: Admin, Agency
 */
const listEmergencies = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      status,
      type,
      guideId,
      dateFrom,
      dateTo,
      priority
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = Math.min(parseInt(pageSize), 100);

    // Construir filtros
    const where = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (priority) {
      where.priority = priority;
    }

    if (guideId) {
      where.guideId = guideId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Si es Agency, filtrar solo emergencias de sus guías
    if (req.user.role === 'agency') {
      where.guide = {
        agencyId: req.user.agencyId
      };
    }

    const [emergencies, total] = await Promise.all([
      prisma.emergency.findMany({
        where,
        skip,
        take,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        include: {
          guide: {
            select: {
              id: true,
              name: true
            }
          },
          reservation: {
            select: {
              id: true,
              tourDate: true
            }
          }
        }
      }),
      prisma.emergency.count({ where })
    ]);

    const data = emergencies.map(e => ({
      id: e.id,
      type: e.type,
      status: e.status,
      priority: e.priority,
      description: e.description,
      location: e.location,
      guideName: e.guide?.name,
      reservationId: e.reservationId,
      createdAt: e.createdAt,
      resolvedAt: e.resolvedAt
    }));

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Error en listEmergencies:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al listar emergencias'
    });
  }
};

/**
 * API-072: GetEmergency
 * GET /api/emergencies/:id
 * Roles permitidos: Admin, Agency, Guide
 */
const getEmergency = async (req, res) => {
  try {
    const { id } = req.params;

    const emergency = await prisma.emergency.findUnique({
      where: { id },
      include: {
        guide: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            agencyId: true
          }
        },
        reservation: {
          select: {
            id: true,
            tourDate: true,
            passengers: true,
            tour: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        actions: {
          orderBy: { createdAt: 'asc' },
          include: {
            createdByUser: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!emergency) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Emergencia no encontrada'
      });
    }

    // Verificar permisos
    if (req.user.role === 'guide' && emergency.guideId !== req.user.guideId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No tiene permiso para ver esta emergencia'
      });
    }

    if (req.user.role === 'agency' && emergency.guide?.agencyId !== req.user.agencyId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No tiene permiso para ver esta emergencia'
      });
    }

    res.json({
      id: emergency.id,
      type: emergency.type,
      status: emergency.status,
      priority: emergency.priority,
      description: emergency.description,
      location: emergency.location,
      coordinates: emergency.coordinates,
      guide: emergency.guide,
      reservation: emergency.reservation,
      actions: emergency.actions.map(a => ({
        id: a.id,
        actionType: a.actionType,
        description: a.description,
        attachments: a.attachments,
        createdAt: a.createdAt,
        createdBy: a.createdByUser
      })),
      createdAt: emergency.createdAt,
      resolvedAt: emergency.resolvedAt,
      resolvedBy: emergency.resolvedBy,
      resolution: emergency.resolution
    });
  } catch (error) {
    console.error('Error en getEmergency:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener emergencia'
    });
  }
};

/**
 * API-073: CreateEmergency
 * POST /api/emergencies
 * Roles permitidos: Admin, Agency, Guide
 */
const createEmergency = async (req, res) => {
  try {
    const {
      type,
      priority,
      description,
      location,
      coordinates,
      reservationId,
      guideId
    } = req.body;

    // Validaciones
    if (!type || !priority || !description) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'type, priority y description son obligatorios'
      });
    }

    const validTypes = ['medical', 'security', 'weather', 'vehicle', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `type debe ser uno de: ${validTypes.join(', ')}`
      });
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `priority debe ser uno de: ${validPriorities.join(', ')}`
      });
    }

    if (description.length < 10) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'description debe tener al menos 10 caracteres'
      });
    }

    // Determinar guideId
    let finalGuideId = guideId;
    if (req.user.role === 'guide') {
      finalGuideId = req.user.guideId;
    }

    // Verificar que reservationId existe si se proporciona
    if (reservationId) {
      const reservation = await prisma.reservations.findUnique({
        where: { id: reservationId }
      });
      if (!reservation) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Reserva no encontrada'
        });
      }
    }

    const emergency = await prisma.emergency.create({
      data: {
        type,
        priority,
        description,
        location,
        coordinates,
        status: 'active',
        reservationId,
        guideId: finalGuideId,
        createdById: req.user.id
      },
      include: {
        guide: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // TODO: Si priority='critical', enviar notificación push a admin

    res.status(201).json({
      id: emergency.id,
      type: emergency.type,
      status: emergency.status,
      priority: emergency.priority,
      description: emergency.description,
      location: emergency.location,
      coordinates: emergency.coordinates,
      guide: emergency.guide,
      createdAt: emergency.createdAt
    });
  } catch (error) {
    console.error('Error en createEmergency:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear emergencia'
    });
  }
};

/**
 * API-074: UpdateEmergencyStatus
 * PATCH /api/emergencies/:id/status
 * Roles permitidos: Admin, Agency
 */
const updateEmergencyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, notes } = req.body;

    // Validaciones
    if (!status) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'status es obligatorio'
      });
    }

    const validStatuses = ['active', 'escalated', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // Verificar que existe
    const emergency = await prisma.emergency.findUnique({
      where: { id }
    });

    if (!emergency) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Emergencia no encontrada'
      });
    }

    // Validar transiciones
    const validTransitions = {
      'active': ['escalated', 'resolved'],
      'escalated': ['resolved'],
      'resolved': []
    };

    if (!validTransitions[emergency.status]?.includes(status)) {
      return res.status(409).json({
        error: 'Conflict',
        message: `No se puede cambiar de ${emergency.status} a ${status}`
      });
    }

    // Si se resuelve, resolution es obligatorio
    if (status === 'resolved' && !resolution) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'resolution es obligatorio al resolver una emergencia'
      });
    }

    // Actualizar en transacción
    const [updatedEmergency] = await prisma.$transaction([
      prisma.emergency.update({
        where: { id },
        data: {
          status,
          resolution: status === 'resolved' ? resolution : undefined,
          resolvedAt: status === 'resolved' ? new Date() : undefined,
          resolvedBy: status === 'resolved' ? req.user.id : undefined
        }
      }),
      // Registrar acción en historial
      prisma.emergencyAction.create({
        data: {
          emergencyId: id,
          actionType: status === 'escalated' ? 'escalation' : 'status_change',
          description: notes || `Estado cambiado a ${status}`,
          createdById: req.user.id
        }
      })
    ]);

    res.json({
      id: updatedEmergency.id,
      status: updatedEmergency.status,
      resolvedAt: updatedEmergency.resolvedAt,
      resolvedBy: updatedEmergency.resolvedBy
    });
  } catch (error) {
    console.error('Error en updateEmergencyStatus:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar estado de emergencia'
    });
  }
};

/**
 * API-075: AddEmergencyAction
 * POST /api/emergencies/:id/actions
 * Roles permitidos: Admin, Agency, Guide
 */
const addEmergencyAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType, description, attachments } = req.body;

    // Validaciones
    if (!actionType || !description) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'actionType y description son obligatorios'
      });
    }

    const validActionTypes = ['call', 'message', 'intervention', 'note'];
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `actionType debe ser uno de: ${validActionTypes.join(', ')}`
      });
    }

    if (description.length < 5) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'description debe tener al menos 5 caracteres'
      });
    }

    // Verificar que existe y no está resuelta
    const emergency = await prisma.emergency.findUnique({
      where: { id }
    });

    if (!emergency) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Emergencia no encontrada'
      });
    }

    if (emergency.status === 'resolved') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'No se pueden añadir acciones a una emergencia resuelta'
      });
    }

    const action = await prisma.emergencyAction.create({
      data: {
        emergencyId: id,
        actionType,
        description,
        attachments: attachments || [],
        createdById: req.user.id
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      id: action.id,
      emergencyId: action.emergencyId,
      actionType: action.actionType,
      description: action.description,
      attachments: action.attachments,
      createdAt: action.createdAt,
      createdBy: action.createdByUser
    });
  } catch (error) {
    console.error('Error en addEmergencyAction:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al añadir acción a emergencia'
    });
  }
};

/**
 * GET /api/emergency/stats
 * Estadísticas de emergencias
 * Roles: Admin
 */
const getEmergencyStats = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const where = {};
    if (dateFrom) where.created_at = { ...where.created_at, gte: new Date(dateFrom) };
    if (dateTo) where.created_at = { ...where.created_at, lte: new Date(dateTo) };

    const [total, active, resolved, byCategory] = await Promise.all([
      prisma.emergencies.count({ where }),
      prisma.emergencies.count({ where: { ...where, status: 'active' } }),
      prisma.emergencies.count({ where: { ...where, status: 'resolved' } }),
      prisma.emergencies.groupBy({
        by: ['category'],
        where,
        _count: { id: true }
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        active,
        resolved,
        pending: total - active - resolved,
        byCategory: byCategory.map(c => ({ category: c.category, count: c._count.id }))
      }
    });
  } catch (error) {
    console.error('Error en getEmergencyStats:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener estadísticas' });
  }
};

/**
 * POST /api/emergency/:id/close
 * Cierra una emergencia
 * Roles: Admin
 */
const closeEmergency = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, notes } = req.body;

    const emergency = await prisma.emergencies.findUnique({ where: { id } });
    if (!emergency) {
      return res.status(404).json({ error: 'Not Found', message: 'Emergencia no encontrada' });
    }

    const updated = await prisma.emergencies.update({
      where: { id },
      data: {
        status: 'resolved',
        resolution: resolution || null,
        resolution_notes: notes || null,
        resolved_at: new Date(),
        updated_at: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      data: { id: updated.id, status: updated.status, resolvedAt: updated.resolved_at }
    });
  } catch (error) {
    console.error('Error en closeEmergency:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al cerrar emergencia' });
  }
};

/**
 * GET /api/emergency/:id/timeline
 * Timeline de acciones de una emergencia
 * Roles: Admin
 */
const getEmergencyTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    const emergency = await prisma.emergencies.findUnique({
      where: { id },
      include: {
        emergency_actions: {
          orderBy: { created_at: 'asc' },
          include: {
            users: { select: { first_name: true, last_name: true } }
          }
        }
      }
    });

    if (!emergency) {
      return res.status(404).json({ error: 'Not Found', message: 'Emergencia no encontrada' });
    }

    const timeline = [
      { type: 'created', timestamp: emergency.created_at, description: 'Emergencia creada' },
      ...(emergency.emergency_actions || []).map(a => ({
        type: a.action_type,
        timestamp: a.created_at,
        description: a.description,
        user: a.users ? `${a.users.first_name} ${a.users.last_name}` : null
      }))
    ];

    if (emergency.resolved_at) {
      timeline.push({ type: 'resolved', timestamp: emergency.resolved_at, description: 'Emergencia resuelta' });
    }

    return res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('Error en getEmergencyTimeline:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener timeline' });
  }
};

module.exports = {
  listEmergencies,
  getEmergency,
  createEmergency,
  updateEmergencyStatus,
  addEmergencyAction,
  getEmergencyStats,
  closeEmergency,
  getEmergencyTimeline
};
