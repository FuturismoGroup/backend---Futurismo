// Controller de Services (provider_services)
// Soporta ELM-052 (ProviderAssignment)
// Tabla: provider_services

const prisma = require('../config/db');

/**
 * GET /api/services
 * Lista todos los servicios de proveedores
 * Roles: Admin, Agency
 */
const listServices = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 100,
      providerId,
      serviceType,
      isActive,
      search
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    // Construir filtros WHERE
    const where = {};

    // Filtro por proveedor
    if (providerId) {
      where.provider_id = providerId;
    }

    // Filtro por tipo de servicio
    if (serviceType) {
      where.service_type = serviceType;
    }

    // Filtro por estado activo (default: solo activos)
    if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    } else {
      where.is_active = true;
    }

    // Filtro de búsqueda
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (pageNum - 1) * pageSizeNum;

    const [services, total] = await Promise.all([
      prisma.provider_services.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { name: 'asc' },
        include: {
          providers: {
            select: {
              id: true,
              name: true,
              category_id: true
            }
          }
        }
      }),
      prisma.provider_services.count({ where })
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);

    // Mapear respuesta para frontend (ProviderAssignment espera estos campos)
    const items = services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      serviceType: service.service_type,
      type: service.service_type,
      price: service.price ? parseFloat(service.price) : null,
      priceType: service.price_type,
      currency: 'USD', // Default, podría venir del provider
      duration: service.duration_minutes ? service.duration_minutes / 60 : null, // Convertir a horas
      durationMinutes: service.duration_minutes,
      maxCapacity: service.max_capacity,
      isActive: service.is_active,
      providerId: service.provider_id,
      provider: service.providers ? {
        id: service.providers.id,
        name: service.providers.name,
        categoryId: service.providers.category_id
      } : null,
      createdAt: service.created_at
    }));

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error en listServices:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener los servicios'
    });
  }
};

/**
 * GET /api/services/:id
 * Detalle de un servicio
 * Roles: Admin, Agency
 */
const getService = async (req, res) => {
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

    const service = await prisma.provider_services.findUnique({
      where: { id },
      include: {
        providers: {
          select: {
            id: true,
            name: true,
            category_id: true,
            phone: true,
            email: true
          }
        }
      }
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Servicio no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: service.id,
        name: service.name,
        description: service.description,
        serviceType: service.service_type,
        price: service.price ? parseFloat(service.price) : null,
        priceType: service.price_type,
        currency: 'USD',
        duration: service.duration_minutes ? service.duration_minutes / 60 : null,
        durationMinutes: service.duration_minutes,
        maxCapacity: service.max_capacity,
        isActive: service.is_active,
        providerId: service.provider_id,
        provider: service.providers ? {
          id: service.providers.id,
          name: service.providers.name,
          categoryId: service.providers.category_id,
          phone: service.providers.phone,
          email: service.providers.email
        } : null,
        createdAt: service.created_at
      }
    });

  } catch (error) {
    console.error('Error en getService:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener el servicio'
    });
  }
};

/**
 * POST /api/services
 * Crear nuevo servicio
 * Roles: Admin
 */
const createService = async (req, res) => {
  try {
    const {
      providerId,
      name,
      description,
      serviceType,
      price,
      priceType = 'per_person',
      durationMinutes,
      maxCapacity
    } = req.body;

    // Validaciones requeridas
    if (!providerId || !name || !serviceType) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'providerId, name y serviceType son requeridos'
      });
    }

    // Verificar que el proveedor existe
    const provider = await prisma.providers.findUnique({
      where: { id: providerId }
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Proveedor no encontrado'
      });
    }

    const service = await prisma.provider_services.create({
      data: {
        provider_id: providerId,
        name,
        description,
        service_type: serviceType,
        price: price ? parseFloat(price) : null,
        price_type: priceType,
        duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
        is_active: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Servicio creado exitosamente',
      data: {
        id: service.id,
        name: service.name,
        description: service.description,
        serviceType: service.service_type,
        price: service.price ? parseFloat(service.price) : null,
        priceType: service.price_type,
        durationMinutes: service.duration_minutes,
        maxCapacity: service.max_capacity,
        isActive: service.is_active,
        providerId: service.provider_id
      }
    });

  } catch (error) {
    console.error('Error en createService:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear el servicio'
    });
  }
};

/**
 * PUT /api/services/:id
 * Actualizar servicio
 * Roles: Admin
 */
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    const existing = await prisma.provider_services.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Servicio no encontrado'
      });
    }

    // Preparar datos para actualizar
    const data = {};
    if (updateData.name) data.name = updateData.name;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.serviceType) data.service_type = updateData.serviceType;
    if (updateData.price !== undefined) {
      data.price = updateData.price ? parseFloat(updateData.price) : null;
    }
    if (updateData.priceType) data.price_type = updateData.priceType;
    if (updateData.durationMinutes !== undefined) {
      data.duration_minutes = updateData.durationMinutes ? parseInt(updateData.durationMinutes, 10) : null;
    }
    if (updateData.maxCapacity !== undefined) {
      data.max_capacity = updateData.maxCapacity ? parseInt(updateData.maxCapacity, 10) : null;
    }
    if (updateData.isActive !== undefined) data.is_active = updateData.isActive;

    const service = await prisma.provider_services.update({
      where: { id },
      data
    });

    return res.status(200).json({
      success: true,
      message: 'Servicio actualizado exitosamente',
      data: {
        id: service.id,
        name: service.name,
        description: service.description,
        serviceType: service.service_type,
        price: service.price ? parseFloat(service.price) : null,
        priceType: service.price_type,
        durationMinutes: service.duration_minutes,
        maxCapacity: service.max_capacity,
        isActive: service.is_active,
        providerId: service.provider_id
      }
    });

  } catch (error) {
    console.error('Error en updateService:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar el servicio'
    });
  }
};

/**
 * DELETE /api/services/:id
 * Eliminar servicio (soft delete - cambiar is_active a false)
 * Roles: Admin
 */
const deleteService = async (req, res) => {
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

    const existing = await prisma.provider_services.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Servicio no encontrado'
      });
    }

    // Soft delete
    await prisma.provider_services.update({
      where: { id },
      data: { is_active: false }
    });

    return res.status(200).json({
      success: true,
      message: 'Servicio eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteService:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar el servicio'
    });
  }
};

/**
 * GET /api/services/types
 * Lista tipos de servicio disponibles (usa tour_categories como tabla unificada)
 * Roles: Admin, Agency
 */
const listServiceTypes = async (req, res) => {
  try {
    const types = await prisma.tour_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    const items = types.map(type => ({
      id: type.id,
      name: type.name,
      code: type.code,
      description: type.description,
      icon: type.icon,
      color: type.color,
      isActive: type.is_active
    }));

    return res.status(200).json({
      success: true,
      data: items
    });

  } catch (error) {
    console.error('Error en listServiceTypes:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener tipos de servicio'
    });
  }
};

/**
 * GET /api/services/by-provider/:providerId
 * Lista servicios de un proveedor específico
 * Roles: Admin, Agency
 */
const listServicesByProvider = async (req, res) => {
  try {
    const { providerId } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(providerId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'providerId debe ser un UUID válido'
      });
    }

    const services = await prisma.provider_services.findMany({
      where: {
        provider_id: providerId,
        is_active: true
      },
      orderBy: { name: 'asc' }
    });

    const items = services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      serviceType: service.service_type,
      price: service.price ? parseFloat(service.price) : null,
      priceType: service.price_type,
      currency: 'USD',
      duration: service.duration_minutes ? service.duration_minutes / 60 : null,
      durationMinutes: service.duration_minutes,
      maxCapacity: service.max_capacity,
      isActive: service.is_active
    }));

    return res.status(200).json({
      success: true,
      data: items
    });

  } catch (error) {
    console.error('Error en listServicesByProvider:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener servicios del proveedor'
    });
  }
};

/**
 * GET /api/services/history
 * Lista historial de servicios (service_requests)
 * Query params: status, from, to, guideId, agencyId
 * Roles: Admin, Agency, Guide
 */
const getServiceHistory = async (req, res) => {
  try {
    const { status, from, to, guideId, agencyId } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const where = {};

    // Filtro por estado
    if (status && status !== 'all') {
      where.status = status;
    }

    // Filtro por rango de fechas
    if (from || to) {
      where.service_date = {};
      if (from) {
        where.service_date.gte = new Date(from);
      }
      if (to) {
        where.service_date.lte = new Date(to);
      }
    }

    // Filtro según rol
    if (userRole === 'guide' && userId) {
      // Guía solo ve sus propios servicios
      const guide = await prisma.guides.findFirst({ where: { user_id: userId } });
      if (guide) {
        where.guide_id = guide.id;
      }
    } else if (guideId) {
      where.guide_id = guideId;
    }

    if (agencyId) {
      where.agency_id = agencyId;
    }

    const requests = await prisma.service_requests.findMany({
      where,
      include: {
        guides: {
          select: {
            id: true,
            user_id: true,
            users: { select: { first_name: true, last_name: true } }
          }
        },
        agencies: {
          select: { id: true, business_name: true }
        },
        reviews: {
          select: { id: true, rating: true, comment: true }
        }
      },
      orderBy: { service_date: 'desc' }
    });

    const items = requests.map(r => {
      // Construir nombre completo del guía
      const guideName = r.guides?.users
        ? `${r.guides.users.first_name} ${r.guides.users.last_name}`.trim()
        : null;

      return {
        id: r.id,
        date: r.service_date,
        startTime: r.start_time,
        durationHours: r.duration_hours,
        groupSize: r.group_size,
        languages: r.languages,
        message: r.message,
        status: r.status,
        respondedAt: r.responded_at,
        createdAt: r.created_at,
        guide: r.guides ? {
          id: r.guides.id,
          name: guideName
        } : null,
        agency: r.agencies ? {
          id: r.agencies.id,
          name: r.agencies.business_name
        } : null,
        serviceName: r.agencies?.business_name || 'Servicio',
        rating: r.reviews.length > 0 ? r.reviews[0].rating : null,
        review: r.reviews.length > 0 ? {
          id: r.reviews[0].id,
          rating: r.reviews[0].rating,
          comment: r.reviews[0].comment
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      data: items,
      total: items.length
    });
  } catch (error) {
    console.error('Error en getServiceHistory:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener historial de servicios'
    });
  }
};

module.exports = {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
  listServiceTypes,
  listServicesByProvider,
  getServiceHistory
};
