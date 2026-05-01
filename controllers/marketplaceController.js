// Controller de Marketplace
// Gestiona el marketplace de guías freelance
// Tabla: guides, users, reviews

const prisma = require('../config/db');

/**
 * GET /api/marketplace/guides
 * Lista guías freelance disponibles con filtros
 * Query params: languages, workZones, tourTypes, groupTypes, priceRange, minRating, verified, instantBooking, availability, search, sortBy, page, pageSize
 * Roles: Admin, Agency
 */
const listFreelanceGuides = async (req, res) => {
  try {
    const {
      languages = '',
      workZones = '',
      tourTypes = '',
      groupTypes = '',
      minRating = 0,
      verified = false,
      instantBooking = false,
      availability = 'all',
      search = '',
      sortBy = 'rating',
      page = 1,
      pageSize = 12
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    // Construir filtros (solo guías activos y visibles aparecen en marketplace)
    const where = {
      guide_type: 'FREELANCE',
      status: 'active',
      online: true
    };

    // Filtro por rating mínimo
    if (minRating && parseFloat(minRating) > 0) {
      where.rating = {
        gte: parseFloat(minRating)
      };
    }

    // Filtro por verificado (tiene licencia)
    if (verified === 'true' || verified === true) {
      where.license_number = {
        not: null
      };
    }

    // Variables para filtrado post-query de campos JSON
    const filterLanguages = languages && languages.trim() ? languages.trim().toLowerCase() : null;
    const filterTourTypes = tourTypes && tourTypes.trim() ? tourTypes.trim().toLowerCase() : null;

    // Filtro por búsqueda (nombre o bio)
    if (search) {
      where.OR = [
        { bio: { contains: search, mode: 'insensitive' } },
        {
          users: {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } }
            ]
          }
        }
      ];
    }

    // Construir ordenamiento
    let orderBy = {};
    switch (sortBy) {
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'name':
        orderBy = { users: { first_name: 'asc' } };
        break;
      case 'experience':
        orderBy = { years_of_experience: 'desc' };
        break;
      case 'price-asc':
        orderBy = { price_per_person: 'asc' };
        break;
      case 'price-desc':
        orderBy = { price_per_person: 'desc' };
        break;
      default:
        orderBy = { created_at: 'desc' };
    }

    // Consultar guías (sin paginación si hay filtros JSON para aplicar post-query)
    const needsPostFiltering = filterLanguages || filterTourTypes;

    const guidesQuery = await prisma.guides.findMany({
      where,
      ...(needsPostFiltering ? {} : { skip, take: pageSizeNum }),
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            profile_photo: true,
            status: true
          }
        },
        _count: {
          select: {
            reviews: true,
            reservations: { where: { status: 'completed' } },
            service_requests: { where: { status: 'completed' } }
          }
        }
      },
      orderBy
    });

    // Aplicar filtros post-query para campos JSON
    let filteredGuides = guidesQuery;

    // Filtro por idiomas (campo JSON)
    if (filterLanguages) {
      filteredGuides = filteredGuides.filter(guide => {
        // Parsear languages si es string JSON
        let langs = guide.languages;
        if (typeof langs === 'string') {
          try {
            langs = JSON.parse(langs);
          } catch (e) {
            langs = [];
          }
        }
        langs = Array.isArray(langs) ? langs : [];

        return langs.some(lang => {
          const langStr = typeof lang === 'string' ? lang : (lang?.name || lang?.language || '');
          return langStr.toLowerCase().includes(filterLanguages);
        });
      });
    }

    if (filterTourTypes) {
      filteredGuides = filteredGuides.filter(guide => {
        const specs = Array.isArray(guide.specialties) ? guide.specialties : [];
        return specs.some(spec => {
          const specStr = typeof spec === 'string' ? spec : (spec?.name || spec?.specialty || '');
          return specStr.toLowerCase().includes(filterTourTypes);
        });
      });
    }

    // Calcular total después de filtrado
    const total = needsPostFiltering ? filteredGuides.length : await prisma.guides.count({ where });

    // Aplicar paginación manual si hubo filtrado post-query
    const paginatedGuides = needsPostFiltering
      ? filteredGuides.slice(skip, skip + pageSizeNum)
      : filteredGuides;

    // Formatear datos para el frontend
    const data = paginatedGuides.map(guide => {
      const completedCount = (guide._count.reservations || 0) + (guide._count.service_requests || 0);
      return {
        id: guide.id,
        userId: guide.user_id,
        name: `${guide.users?.first_name || ''} ${guide.users?.last_name || ''}`.trim(),
        firstName: guide.users?.first_name,
        lastName: guide.users?.last_name,
        email: guide.users?.email,
        phone: guide.users?.phone,
        profilePhoto: guide.users?.profile_photo,
        guideType: guide.guide_type,
        licenseNumber: guide.license_number,
        yearsOfExperience: guide.years_of_experience,
        languages: guide.languages,
        specialties: guide.specialties,
        certifications: guide.certifications,
        museums: guide.museums,
        bio: guide.bio,
        education: guide.education,
        pricePerPerson: guide.price_per_person ? parseFloat(guide.price_per_person) : null,
        guidePhoto: guide.guide_photo,
        rating: guide.rating,
        online: guide.online,
        reviewsCount: guide._count.reviews,
        toursCompleted: completedCount,
        reviewCount: guide._count.reviews,
        completedTours: completedCount,
        workZones: guide.work_zones || [],
        status: guide.users?.status,
        createdAt: guide.created_at,
        updatedAt: guide.updated_at
      };
    });

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
    console.error('Error en listFreelanceGuides:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener guías freelance'
    });
  }
};

/**
 * GET /api/marketplace/guides/:id
 * Obtiene perfil completo de un guía
 * Roles: Admin, Agency
 */
const getGuideProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de guía inválido'
      });
    }

    const guide = await prisma.guides.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            profile_photo: true,
            status: true
          }
        },
        reviews: {
          take: 10,
          orderBy: { created_at: 'desc' },
          include: {
            users: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        },
        _count: {
          select: {
            reviews: true,
            reservations: { where: { status: 'completed' } },
            service_requests: { where: { status: 'completed' } }
          }
        }
      }
    });

    if (!guide || guide.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrado'
      });
    }

    const completedCount = (guide._count.reservations || 0) + (guide._count.service_requests || 0);

    // Formatear respuesta
    const data = {
      id: guide.id,
      userId: guide.user_id,
      name: `${guide.users?.first_name || ''} ${guide.users?.last_name || ''}`.trim(),
      firstName: guide.users?.first_name,
      lastName: guide.users?.last_name,
      email: guide.users?.email,
      phone: guide.users?.phone,
      profilePhoto: guide.users?.profile_photo,
      guideType: guide.guide_type,
      licenseNumber: guide.license_number,
      yearsOfExperience: guide.years_of_experience,
      languages: guide.languages,
      specialties: guide.specialties,
      certifications: guide.certifications,
      museums: guide.museums,
      bio: guide.bio,
      education: guide.education,
      pricePerPerson: guide.price_per_person ? parseFloat(guide.price_per_person) : null,
      guidePhoto: guide.guide_photo,
      rating: guide.rating,
      online: guide.online,
      reviewsCount: guide._count.reviews,
      toursCompleted: completedCount,
      reviewCount: guide._count.reviews,
      completedTours: completedCount,
      joinedDate: guide.created_at,
      verified: !!guide.license_number,
      workZones: guide.work_zones || [],
      reviews: guide.reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        reviewerName: review.users ? `${review.users.first_name || ''} ${review.users.last_name || ''}`.trim() : 'Anónimo',
        createdAt: review.created_at
      })),
      status: guide.users?.status,
      createdAt: guide.created_at,
      updatedAt: guide.updated_at
    };

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error en getGuideProfile:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener perfil del guía'
    });
  }
};

/**
 * GET /api/marketplace/guides/:id/reviews
 * Obtiene las reseñas de un guía para el marketplace
 * Roles: Admin, Agency
 */
const getGuideReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID de guía inválido'
      });
    }

    // Verificar que el guía existe
    const guide = await prisma.guides.findUnique({
      where: { id }
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrado'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Obtener reviews con paginación
    const [reviews, totalCount] = await Promise.all([
      prisma.reviews.findMany({
        where: { guide_id: id },
        include: {
          users: {
            select: {
              first_name: true,
              last_name: true,
              profile_photo: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take
      }),
      prisma.reviews.count({ where: { guide_id: id } })
    ]);

    // Formatear respuesta para el frontend
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment || '',
      verified: review.is_verified || false,
      createdAt: review.created_at,
      reviewerName: review.users
        ? `${review.users.first_name || ''} ${review.users.last_name || ''}`.trim()
        : 'Anónimo',
      reviewerPhoto: review.users?.profile_photo
    }));

    res.json({
      success: true,
      data: {
        reviews: formattedReviews,
        pagination: {
          page: parseInt(page),
          limit: take,
          total: totalCount,
          totalPages: Math.ceil(totalCount / take)
        }
      }
    });
  } catch (error) {
    console.error('Error en getGuideReviews:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reseñas del guía'
    });
  }
};

/**
 * PUT /api/marketplace/guides/:guideId/rate
 * Actualizar tarifa por persona del guía freelance
 */
const updateGuideRate = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { pricePerPerson } = req.body;

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guideId || !UUID_REGEX.test(guideId)) {
      return res.status(400).json({ success: false, error: 'ID de guía inválido' });
    }

    const price = parseFloat(pricePerPerson);
    if (!price || price <= 0) {
      return res.status(400).json({ success: false, error: 'El precio por persona debe ser mayor a 0' });
    }

    const guide = await prisma.guides.findUnique({ where: { id: guideId } });
    if (!guide) {
      return res.status(404).json({ success: false, error: 'Guía no encontrado' });
    }
    if (guide.guide_type !== 'FREELANCE') {
      return res.status(400).json({ success: false, error: 'Solo guías freelance pueden configurar tarifa' });
    }

    // Verificar ownership
    if (req.user.role !== 'admin' && guide.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'No tiene permiso para modificar este guía' });
    }

    const updated = await prisma.guides.update({
      where: { id: guideId },
      data: { price_per_person: price, updated_at: new Date() }
    });

    res.json({
      success: true,
      message: 'Tarifa actualizada exitosamente',
      data: { pricePerPerson: parseFloat(updated.price_per_person) }
    });
  } catch (error) {
    console.error('Error en updateGuideRate:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar tarifa' });
  }
};

/**
 * PUT /api/marketplace/guides/:guideId/online
 * Toggle disponibilidad online/offline del guía freelance
 */
const toggleGuideOnline = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { online } = req.body;

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guideId || !UUID_REGEX.test(guideId)) {
      return res.status(400).json({ success: false, error: 'ID de guía inválido' });
    }

    if (typeof online !== 'boolean') {
      return res.status(400).json({ success: false, error: 'El campo online debe ser true o false' });
    }

    const guide = await prisma.guides.findUnique({ where: { id: guideId } });
    if (!guide) {
      return res.status(404).json({ success: false, error: 'Guía no encontrado' });
    }
    if (guide.guide_type !== 'FREELANCE') {
      return res.status(400).json({ success: false, error: 'Solo guías freelance pueden cambiar su disponibilidad' });
    }

    // Verificar ownership
    if (req.user.role !== 'admin' && guide.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'No tiene permiso para modificar este guía' });
    }

    const updated = await prisma.guides.update({
      where: { id: guideId },
      data: { online, updated_at: new Date() }
    });

    res.json({
      success: true,
      message: online ? 'Ahora estás disponible en el marketplace' : 'Te has marcado como no disponible',
      data: { online: updated.online }
    });
  } catch (error) {
    console.error('Error en toggleGuideOnline:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar disponibilidad' });
  }
};

module.exports = {
  listFreelanceGuides,
  getGuideProfile,
  getGuideReviews,
  updateGuideRate,
  toggleGuideOnline
};
