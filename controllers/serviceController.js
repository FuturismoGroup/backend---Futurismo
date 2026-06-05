// Controller de Services (provider_services)
// Soporta ELM-052 (ProviderAssignment)
// Tabla: provider_services (vinculada a provider_categories, NO a providers)

const prisma = require('../config/db');

/**
 * GET /api/services
 * Lista todos los servicios
 * Roles: Admin, Agency
 */
const listServices = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 100,
      categoryId,
      serviceType,
      isActive,
      search
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    const where = {};

    if (categoryId) {
      where.category_id = categoryId;
    }

    if (serviceType) {
      where.service_type = serviceType;
    }

    if (isActive !== undefined) {
      where.is_active = isActive === 'true';
    } else {
      where.is_active = true;
    }

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
          provider_categories: {
            select: { id: true, name: true, color: true }
          }
        }
      }),
      prisma.provider_services.count({ where })
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);

    const items = services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      serviceType: service.service_type,
      type: service.service_type,
      duration: service.duration_minutes ? service.duration_minutes / 60 : null,
      durationMinutes: service.duration_minutes,
      maxCapacity: service.max_capacity,
      isActive: service.is_active,
      categoryId: service.category_id,
      category: service.provider_categories ? {
        id: service.provider_categories.id,
        name: service.provider_categories.name,
        color: service.provider_categories.color
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
        provider_categories: {
          select: { id: true, name: true, color: true, icon: true }
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
        duration: service.duration_minutes ? service.duration_minutes / 60 : null,
        durationMinutes: service.duration_minutes,
        maxCapacity: service.max_capacity,
        isActive: service.is_active,
        categoryId: service.category_id,
        category: service.provider_categories ? {
          id: service.provider_categories.id,
          name: service.provider_categories.name,
          color: service.provider_categories.color,
          icon: service.provider_categories.icon
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
 * Crear nuevo servicio (asociado a una categoría)
 * Roles: Admin
 */
const createService = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      description,
      serviceType,
      durationMinutes,
      maxCapacity
    } = req.body;

    if (!categoryId || !name || !serviceType) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'categoryId, name y serviceType son requeridos'
      });
    }

    const category = await prisma.provider_categories.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Categoría no encontrada'
      });
    }

    const service = await prisma.provider_services.create({
      data: {
        category_id: categoryId,
        name,
        description,
        service_type: serviceType,
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
        durationMinutes: service.duration_minutes,
        maxCapacity: service.max_capacity,
        isActive: service.is_active,
        categoryId: service.category_id
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

    const data = {};
    if (updateData.name) data.name = updateData.name;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.serviceType) data.service_type = updateData.serviceType;
    if (updateData.categoryId) data.category_id = updateData.categoryId;
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
        durationMinutes: service.duration_minutes,
        maxCapacity: service.max_capacity,
        isActive: service.is_active,
        categoryId: service.category_id
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
 * GET /api/services/by-category/:categoryId
 * Lista servicios de una categoría específica
 * (reemplaza a by-provider/:providerId — la tabla provider_services
 *  ahora se vincula a categoría, no a proveedor)
 * Roles: Admin, Agency
 */
const listServicesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(categoryId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'categoryId debe ser un UUID válido'
      });
    }

    const services = await prisma.provider_services.findMany({
      where: {
        category_id: categoryId,
        is_active: true
      },
      orderBy: { name: 'asc' }
    });

    const items = services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      serviceType: service.service_type,
      duration: service.duration_minutes ? service.duration_minutes / 60 : null,
      durationMinutes: service.duration_minutes,
      maxCapacity: service.max_capacity,
      isActive: service.is_active,
      categoryId: service.category_id
    }));

    return res.status(200).json({
      success: true,
      data: items
    });

  } catch (error) {
    console.error('Error en listServicesByCategory:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener servicios de la categoría'
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

    if (status && status !== 'all') {
      where.status = status;
    }

    if (from || to) {
      where.service_date = {};
      if (from) {
        where.service_date.gte = new Date(from);
      }
      if (to) {
        where.service_date.lte = new Date(to);
      }
    }

    if (userRole === 'guide' && userId) {
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
  listServicesByCategory,
  getServiceHistory
};
