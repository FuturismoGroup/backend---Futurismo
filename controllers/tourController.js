// Controller de Tours
// API-008: ListTours - GET /api/tours
// API-009: GetTour - GET /api/tours/:id
// API-010: CreateTour - POST /api/tours
// API-011: UpdateTour - PUT /api/tours/:id
// API-012: DeleteTour - DELETE /api/tours/:id
// Fuente: 04_apis_lista.md lineas 619-985

const prisma = require('../config/db');

/**
 * API-008: ListTours
 * GET /api/tours
 * Obtiene lista de tours/servicios disponibles con filtros
 * Roles: Admin, Agency, Guide
 * Fuente: 04_apis_lista.md líneas 619-709
 */
const listTours = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      active,
      category,
      tourType,
      searchTerm
    } = req.query;

    // Validaciones (líneas 694-695)
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    if (pageNum < 1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'page debe ser >= 1'
      });
    }

    if (pageSizeNum < 1 || pageSizeNum > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'pageSize debe estar entre 1 y 100'
      });
    }

    // Construir filtros WHERE
    const where = {};

    // Por defecto solo muestra tours activos (línea 697)
    // Admin puede ver inactivos con active=false (línea 698)
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;

    if (active === undefined || active === 'true') {
      where.active = true;
    } else if (active === 'false' && userRole === 'admin') {
      where.active = false;
    } else if (active === 'false') {
      // Non-admin trying to see inactive tours
      where.active = true; // Force active only
    } else if (active === 'all' && userRole === 'admin') {
      // Admin puede ver todos
      // No filter on active
    }

    // Filtro por category
    if (category) {
      where.category = category;
    }

    // Filtro por tourType (columna tour_type en TBL-005)
    if (tourType) {
      where.tour_type = tourType;
    }

    // Filtro searchTerm (columnas name, description en TBL-005)
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    const skip = (pageNum - 1) * pageSizeNum;

    // Ejecutar consultas en paralelo
    // Tabla: TBL-005 (tours) - Fuente: 03_tablas_modelo.md lineas 865-977
    const [tours, total] = await Promise.all([
      prisma.tours.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: { tour_stops: true }
          }
        }
      }),
      prisma.tours.count({ where })
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);

    // Mapear respuesta según esquema (líneas 667-671)
    // Columnas de TBL-005 (tours) usan snake_case en BD
    const data = tours.map(tour => ({
      id: tour.id,
      code: tour.code,
      name: tour.name,
      description: tour.description,
      category: tour.category,
      tourType: tour.tour_type,
      duration: tour.duration,
      price: tour.price,
      childPrice: tour.child_price,
      maxCapacity: tour.max_capacity,
      includesGuide: tour.includes_guide,
      includesTransport: tour.includes_transport,
      meetingPoint: tour.meeting_point,
      meeting_point: tour.meeting_point,
      image: tour.image,
      includes: tour.includes,
      excludes: tour.excludes,
      notes: tour.notes,
      languages: tour.languages,
      active: tour.active,
      stopsCount: tour._count?.tour_stops || 0,
      createdAt: tour.created_at,
      updatedAt: tour.updated_at
    }));

    return res.status(200).json({
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages
    });

  } catch (error) {
    console.error('Error en listTours:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener los tours'
    });
  }
};

/**
 * API-009: GetTour
 * GET /api/tours/:id
 * Obtiene detalle completo de un tour incluyendo paradas
 * Roles: Admin, Agency, Guide
 * Fuente: 04_apis_lista.md líneas 710-780
 */
const getTour = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID (línea 767)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Buscar tour con paradas ordenadas por order_num (línea 779)
    // Tabla: TBL-005 (tours), TBL-006 (tour_stops)
    const tour = await prisma.tours.findUnique({
      where: { id },
      include: {
        tour_stops: {
          orderBy: { order_num: 'asc' }
        }
      }
    });

    // Retornar 404 si no existe (línea 770)
    if (!tour) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    // Response según esquema TourDetail (líneas 738-754)
    // Mapeo de snake_case (BD) a camelCase (API)
    return res.status(200).json({
      id: tour.id,
      code: tour.code,
      name: tour.name,
      description: tour.description,
      shortDescription: tour.short_description,
      category: tour.category,
      tourType: tour.tour_type,
      duration: tour.duration,
      price: tour.price,
      childPrice: tour.child_price,
      maxCapacity: tour.max_capacity,
      includesGuide: tour.includes_guide,
      includesTransport: tour.includes_transport,
      meetingPoint: tour.meeting_point,
      languages: tour.languages,
      image: tour.image,
      includes: tour.includes,
      excludes: tour.excludes,
      notes: tour.notes,
      active: tour.active,
      stops: (tour.tour_stops || []).map(stop => ({
        id: stop.id,
        name: stop.name,
        description: stop.description,
        duration: stop.duration,
        order: stop.order_num
      })),
      createdAt: tour.created_at,
      updatedAt: tour.updated_at
    });

  } catch (error) {
    console.error('Error en getTour:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener el tour'
    });
  }
};

/**
 * API-010: CreateTour
 * POST /api/tours
 * Crea un nuevo tour/servicio con su itinerario
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 781-852
 */
const createTour = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      category,
      tourType,
      duration,
      price,
      childPrice,
      maxCapacity,
      includesGuide = false,
      includesTransport = false,
      meetingPoint,
      languages = [],
      image,
      includes = [],
      excludes = [],
      notes,
      stops = []
    } = req.body;

    // Validaciones (líneas 834-839)

    // name es requerido (línea 835)
    if (!name || name.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name es requerido'
      });
    }

    // price es requerido y >= 0 (línea 836)
    if (price === undefined || price === null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'price es requerido'
      });
    }
    const priceNum = parseFloat(price);
    if (priceNum < 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'price debe ser >= 0'
      });
    }

    // duration > 0 si presente (línea 837)
    if (duration !== undefined && duration !== null && parseInt(duration, 10) <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'duration debe ser > 0'
      });
    }

    // maxCapacity > 0 si presente (línea 838)
    if (maxCapacity !== undefined && maxCapacity !== null && parseInt(maxCapacity, 10) <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'maxCapacity debe ser > 0'
      });
    }

    // Si stops presente, cada stop debe tener name (línea 839)
    if (stops && Array.isArray(stops)) {
      for (let i = 0; i < stops.length; i++) {
        if (!stops[i].name || stops[i].name.trim() === '') {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Stop ${i + 1}: name es requerido`
          });
        }
      }
    }

    const userId = req.user?.id;

    // Transacción atómica para tour + paradas (línea 851)
    // Tabla: TBL-005 (tours), TBL-006 (tour_stops)
    const result = await prisma.$transaction(async (tx) => {
      // Generar código único para el tour (SRV-001, SRV-002, etc.)
      const lastTour = await tx.tours.findFirst({
        where: { code: { not: null } },
        orderBy: { code: 'desc' },
        select: { code: true }
      });

      let nextNumber = 1;
      if (lastTour && lastTour.code) {
        // Extraer número del último código (SRV-001 -> 1)
        const match = lastTour.code.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0], 10) + 1;
        }
      }

      const tourCode = `SRV-${String(nextNumber).padStart(3, '0')}`;

      // Crear tour con active=true por defecto (línea 841)
      // Nota: El schema no tiene campo created_by, omitido
      const tour = await tx.tours.create({
        data: {
          code: tourCode,
          name: name.trim(),
          description: description || null,
          short_description: shortDescription || null,
          category: category || null,
          tour_type: tourType || null,
          duration: duration ? parseInt(duration, 10) : null,
          price: priceNum,
          child_price: childPrice ? parseFloat(childPrice) : null,
          max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
          includes_guide: includesGuide,
          includes_transport: includesTransport,
          meeting_point: meetingPoint || null,
          languages: languages || [],
          image: image || null,
          includes: Array.isArray(includes) ? includes : [],
          excludes: Array.isArray(excludes) ? excludes : [],
          notes: notes || null,
          active: true
        }
      });

      // Crear paradas con order_num secuencial (línea 842)
      if (stops && Array.isArray(stops) && stops.length > 0) {
        const stopsData = stops.map((stop, index) => ({
          tour_id: tour.id,
          name: stop.name.trim(),
          description: stop.description || null,
          duration: stop.duration ? parseInt(stop.duration, 10) : null,
          order_num: stop.order !== undefined ? stop.order : index + 1
        }));

        await tx.tour_stops.createMany({
          data: stopsData
        });
      }

      // Obtener tour con paradas creadas
      const tourWithStops = await tx.tours.findUnique({
        where: { id: tour.id },
        include: {
          tour_stops: {
            orderBy: { order_num: 'asc' }
          }
        }
      });

      return tourWithStops;
    });

    // Response según esquema TourDetail (líneas 820-824)
    // Mapeo de snake_case (BD) a camelCase (API)
    return res.status(201).json({
      id: result.id,
      code: result.code,
      name: result.name,
      description: result.description,
      shortDescription: result.short_description,
      category: result.category,
      tourType: result.tour_type,
      duration: result.duration,
      price: result.price,
      childPrice: result.child_price,
      maxCapacity: result.max_capacity,
      includesGuide: result.includes_guide,
      includesTransport: result.includes_transport,
      meetingPoint: result.meeting_point,
      languages: result.languages,
      image: result.image,
      includes: result.includes,
      excludes: result.excludes,
      notes: result.notes,
      active: result.active,
      stops: (result.tour_stops || []).map(stop => ({
        id: stop.id,
        name: stop.name,
        description: stop.description,
        duration: stop.duration,
        order: stop.order_num
      })),
      createdAt: result.created_at
    });

  } catch (error) {
    console.error('Error en createTour:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear el tour'
    });
  }
};

/**
 * API-011: UpdateTour
 * PUT /api/tours/:id
 * Actualiza un tour existente incluyendo reemplazo completo de paradas
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 857-931
 */
const updateTour = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      shortDescription,
      category,
      tourType,
      duration,
      price,
      childPrice,
      maxCapacity,
      includesGuide,
      includesTransport,
      meetingPoint,
      languages,
      image,
      includes,
      excludes,
      notes,
      active,
      stops
    } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // id debe existir (línea 915)
    // Tabla: TBL-005 (tours)
    const existingTour = await prisma.tours.findUnique({
      where: { id }
    });

    if (!existingTour) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    // Validaciones (líneas 914-917)

    // name no vacío si se envía (línea 916)
    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name no puede estar vacío'
      });
    }

    // price >= 0 si se envía (línea 917)
    if (price !== undefined && parseFloat(price) < 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'price debe ser >= 0'
      });
    }

    // duration > 0 si se envía
    if (duration !== undefined && duration !== null && parseInt(duration, 10) <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'duration debe ser > 0'
      });
    }

    // Construir objeto de actualización con nombres snake_case (TBL-005)
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (shortDescription !== undefined) updateData.short_description = shortDescription;
    if (category !== undefined) updateData.category = category;
    if (tourType !== undefined) updateData.tour_type = tourType;
    if (duration !== undefined) updateData.duration = duration ? parseInt(duration, 10) : null;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (childPrice !== undefined) updateData.child_price = childPrice ? parseFloat(childPrice) : null;
    if (maxCapacity !== undefined) updateData.max_capacity = maxCapacity ? parseInt(maxCapacity, 10) : null;
    if (includesGuide !== undefined) updateData.includes_guide = includesGuide;
    if (includesTransport !== undefined) updateData.includes_transport = includesTransport;
    if (meetingPoint !== undefined) updateData.meeting_point = meetingPoint;
    if (languages !== undefined) updateData.languages = languages;
    if (image !== undefined) updateData.image = image;
    if (includes !== undefined) updateData.includes = Array.isArray(includes) ? includes : [];
    if (excludes !== undefined) updateData.excludes = Array.isArray(excludes) ? excludes : [];
    if (notes !== undefined) updateData.notes = notes;
    if (active !== undefined) updateData.active = active;

    // Transacción atómica (línea 930)
    // Tabla: TBL-005 (tours), TBL-006 (tour_stops)
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar tour
      await tx.tours.update({
        where: { id },
        data: updateData
      });

      // Paradas se reemplazan completamente (delete + insert) (línea 919)
      if (stops !== undefined && Array.isArray(stops)) {
        // Eliminar paradas antiguas
        await tx.tour_stops.deleteMany({
          where: { tour_id: id }
        });

        // Crear nuevas paradas
        if (stops.length > 0) {
          const stopsData = stops.map((stop, index) => ({
            tour_id: id,
            name: stop.name.trim(),
            description: stop.description || null,
            duration: stop.duration ? parseInt(stop.duration, 10) : null,
            order_num: stop.order !== undefined ? stop.order : index + 1
          }));

          await tx.tour_stops.createMany({
            data: stopsData
          });
        }
      }

      // Obtener tour actualizado con paradas
      const updatedTour = await tx.tours.findUnique({
        where: { id },
        include: {
          tour_stops: {
            orderBy: { order_num: 'asc' }
          }
        }
      });

      return updatedTour;
    });

    // Response según esquema TourDetail (líneas 901-904)
    // Mapeo de snake_case (BD) a camelCase (API)
    return res.status(200).json({
      id: result.id,
      name: result.name,
      description: result.description,
      shortDescription: result.short_description,
      category: result.category,
      tourType: result.tour_type,
      duration: result.duration,
      price: result.price,
      childPrice: result.child_price,
      maxCapacity: result.max_capacity,
      includesGuide: result.includes_guide,
      includesTransport: result.includes_transport,
      meetingPoint: result.meeting_point,
      languages: result.languages,
      image: result.image,
      includes: result.includes,
      excludes: result.excludes,
      notes: result.notes,
      active: result.active,
      stops: (result.tour_stops || []).map(stop => ({
        id: stop.id,
        name: stop.name,
        description: stop.description,
        duration: stop.duration,
        order: stop.order_num
      })),
      updatedAt: result.updated_at
    });

  } catch (error) {
    console.error('Error en updateTour:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar el tour'
    });
  }
};

/**
 * API-012: DeleteTour
 * DELETE /api/tours/:id
 * Elimina (soft delete) un tour
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 932-985
 */
const deleteTour = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // id debe existir (línea 972)
    // Tabla: TBL-005 (tours)
    const existingTour = await prisma.tours.findUnique({
      where: { id }
    });

    if (!existingTour) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    // No eliminar si tiene reservas pending o confirmed (línea 974, 978)
    // Tabla: TBL-001 (reservations) - relacion tour_id -> tours.id
    const activeReservations = await prisma.reservations.count({
      where: {
        tour_id: id,
        status: { in: ['pending', 'confirmed'] }
      }
    });

    if (activeReservations > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: `No se puede eliminar el tour porque tiene ${activeReservations} reserva(s) activa(s)`
      });
    }

    // Soft delete: active = false (línea 975)
    await prisma.tours.update({
      where: { id },
      data: { active: false }
    });

    // Response según esquema DeleteResult (líneas 958-961)
    return res.status(200).json({
      success: true,
      message: 'Tour eliminado correctamente'
    });

  } catch (error) {
    console.error('Error en deleteTour:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar el tour'
    });
  }
};

/**
 * GET /api/tours/categories
 * Obtiene categorías de tours disponibles desde la BD
 * Roles: Admin, Agency, Guide
 */
const getTourCategories = async (req, res) => {
  try {
    const categories = await prisma.tour_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        color: true
      }
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error en getTourCategories:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener categorías de tours'
    });
  }
};

/**
 * PUT /api/tours/:id/toggle-status
 * Activa/desactiva un tour
 * Roles: Admin
 */
const toggleTourStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const tour = await prisma.tours.findUnique({ where: { id } });
    if (!tour) {
      return res.status(404).json({ error: 'Not Found', message: 'Tour no encontrado' });
    }

    const updated = await prisma.tours.update({
      where: { id },
      data: { active: !tour.active }
    });

    return res.status(200).json({
      success: true,
      data: { id: updated.id, active: updated.active }
    });
  } catch (error) {
    console.error('Error en toggleTourStatus:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al cambiar estado' });
  }
};

/**
 * GET /api/tours/statistics
 * Estadísticas de tours
 * Roles: Admin, Agency
 */
const getTourStatistics = async (req, res) => {
  try {
    const [totalTours, activeTours, totalReservations, topTours] = await Promise.all([
      prisma.tours.count(),
      prisma.tours.count({ where: { active: true } }),
      prisma.reservations.count({ where: { status: { in: ['confirmed', 'completed'] } } }),
      prisma.reservations.groupBy({
        by: ['tour_id'],
        _count: { id: true },
        _sum: { total_amount: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      })
    ]);

    // Enriquecer top tours con nombres
    const topToursWithNames = await Promise.all(
      topTours.map(async (t) => {
        const tour = await prisma.tours.findUnique({ where: { id: t.tour_id }, select: { name: true } });
        return { tourId: t.tour_id, tourName: tour?.name, reservations: t._count.id, revenue: t._sum.total_amount };
      })
    );

    return res.status(200).json({
      success: true,
      data: { totalTours, activeTours, inactiveTours: totalTours - activeTours, totalReservations, topTours: topToursWithNames }
    });
  } catch (error) {
    console.error('Error en getTourStatistics:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener estadísticas' });
  }
};

/**
 * GET /api/tours/available
 * Tours activos disponibles
 * Roles: Admin, Agency, Guide
 */
const getAvailableTours = async (req, res) => {
  try {
    const { date, category } = req.query;
    const where = { active: true };
    if (category) where.category = category;

    const tours = await prisma.tours.findMany({
      where,
      select: { id: true, name: true, price: true, duration: true, max_capacity: true, category: true, image: true }
    });

    return res.status(200).json({ success: true, data: tours });
  } catch (error) {
    console.error('Error en getAvailableTours:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener tours' });
  }
};

/**
 * POST /api/tours/:id/duplicate
 * Duplicar un tour
 * Roles: Admin
 */
const duplicateTour = async (req, res) => {
  try {
    const { id } = req.params;

    const original = await prisma.tours.findUnique({ where: { id }, include: { tour_stops: true } });
    if (!original) {
      return res.status(404).json({ error: 'Not Found', message: 'Tour no encontrado' });
    }

    const newTour = await prisma.$transaction(async (tx) => {
      const tour = await tx.tours.create({
        data: {
          name: `${original.name} (copia)`,
          description: original.description,
          short_description: original.short_description,
          category: original.category,
          tour_type: original.tour_type,
          duration: original.duration,
          price: original.price,
          child_price: original.child_price,
          max_capacity: original.max_capacity,
          includes_guide: original.includes_guide,
          includes_transport: original.includes_transport,
          meeting_point: original.meeting_point,
          languages: original.languages,
          image: original.image,
          includes: original.includes,
          excludes: original.excludes,
          notes: original.notes,
          active: false
        }
      });

      if (original.tour_stops?.length > 0) {
        await tx.tour_stops.createMany({
          data: original.tour_stops.map(stop => ({
            tour_id: tour.id,
            name: stop.name,
            description: stop.description,
            duration: stop.duration,
            order_num: stop.order_num
          }))
        });
      }

      return tour;
    });

    return res.status(201).json({ success: true, data: { id: newTour.id, originalId: id } });
  } catch (error) {
    console.error('Error en duplicateTour:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al duplicar tour' });
  }
};

/**
 * GET /api/tours/search
 * Buscar tours
 * Roles: Admin, Agency, Guide
 */
const searchTours = async (req, res) => {
  try {
    const { q, category, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Bad Request', message: 'Búsqueda requiere al menos 2 caracteres' });
    }

    const where = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { short_description: { contains: q, mode: 'insensitive' } }
      ]
    };
    if (category) where.category = category;

    const tours = await prisma.tours.findMany({
      where,
      take: parseInt(limit),
      select: { id: true, name: true, category: true, price: true, active: true, image: true }
    });

    return res.status(200).json({ success: true, data: tours });
  } catch (error) {
    console.error('Error en searchTours:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al buscar tours' });
  }
};

/**
 * GET /api/tours/:id/availability
 * Disponibilidad de un tour para un rango de fechas
 * Roles: Admin, Agency
 */
const getTourAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateFrom, dateTo } = req.query;

    const tour = await prisma.tours.findUnique({ where: { id } });
    if (!tour) {
      return res.status(404).json({ error: 'Not Found', message: 'Tour no encontrado' });
    }

    const reservations = await prisma.reservations.findMany({
      where: {
        tour_id: id,
        date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        status: { in: ['pending', 'confirmed'] }
      },
      select: { date: true, participants: true }
    });

    // Agrupar por fecha
    const byDate = {};
    reservations.forEach(r => {
      const dateStr = r.date.toISOString().split('T')[0];
      byDate[dateStr] = (byDate[dateStr] || 0) + r.participants;
    });

    const availability = Object.entries(byDate).map(([date, booked]) => ({
      date,
      booked,
      available: (tour.max_capacity || 999) - booked
    }));

    return res.status(200).json({
      success: true,
      data: { tourId: id, maxCapacity: tour.max_capacity, availability }
    });
  } catch (error) {
    console.error('Error en getTourAvailability:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener disponibilidad' });
  }
};

/**
 * GET /api/tours/:id/available-guides
 * Guías disponibles para un tour
 * Roles: Admin
 */
const getAvailableGuidesForTour = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, reservationId, includeCurrentGuide } = req.query;

    const tour = await prisma.tours.findUnique({ where: { id } });
    if (!tour) {
      return res.status(404).json({ error: 'Not Found', message: 'Tour no encontrado' });
    }

    // Obtener guías activos
    const guides = await prisma.guides.findMany({
      where: { users: { status: 'active' } },
      include: { users: { select: { first_name: true, last_name: true, email: true } } }
    });

    // Si hay fecha, verificar disponibilidad
    let availableGuides = guides;
    if (date) {
      // Construir filtro excluyendo la reserva actual si se proporciona
      const busyFilter = {
        date: new Date(date),
        guide_id: { not: null },
        status: { in: ['pending', 'confirmed'] }
      };

      // Excluir la reserva actual de la búsqueda de guías ocupados
      if (reservationId) {
        busyFilter.id = { not: reservationId };
      }

      const busyGuides = await prisma.reservations.findMany({
        where: busyFilter,
        select: { guide_id: true }
      });
      const busyIds = new Set(busyGuides.map(r => r.guide_id));
      availableGuides = guides.filter(g => !busyIds.has(g.id));

      // Si se solicita incluir el guía actual asignado, asegurarse de que esté en la lista
      if (includeCurrentGuide && reservationId) {
        const currentReservation = await prisma.reservations.findUnique({
          where: { id: reservationId },
          select: { guide_id: true }
        });
        if (currentReservation?.guide_id) {
          const currentGuide = guides.find(g => g.id === currentReservation.guide_id);
          if (currentGuide && !availableGuides.find(g => g.id === currentGuide.id)) {
            availableGuides.unshift(currentGuide); // Agregar al inicio
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: availableGuides.map(g => ({
        id: g.id,
        name: `${g.users?.first_name} ${g.users?.last_name}`.trim(),
        email: g.users?.email,
        rating: g.rating,
        languages: g.languages || [],
        museums: g.museums || [],
        specialties: g.specialties || []
      }))
    });
  } catch (error) {
    console.error('Error en getAvailableGuidesForTour:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener guías' });
  }
};

/**
 * PUT /api/tours/:id/status
 * Actualizar estado de un tour
 * Roles: Admin
 */
const updateTourStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const tour = await prisma.tours.findUnique({ where: { id } });
    if (!tour) {
      return res.status(404).json({ error: 'Not Found', message: 'Tour no encontrado' });
    }

    const updated = await prisma.tours.update({
      where: { id },
      data: { active: active === true || active === 'true' }
    });

    return res.status(200).json({ success: true, data: { id: updated.id, active: updated.active } });
  } catch (error) {
    console.error('Error en updateTourStatus:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al actualizar estado' });
  }
};

/**
 * GET /api/tours/languages
 * Idiomas disponibles para tours
 * Roles: Admin, Agency, Guide
 */
const getTourLanguages = async (req, res) => {
  try {
    const languages = [
      { code: 'es', name: 'Español', flag: '🇪🇸' },
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'pt', name: 'Português', flag: '🇧🇷' },
      { code: 'fr', name: 'Français', flag: '🇫🇷' },
      { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
      { code: 'it', name: 'Italiano', flag: '🇮🇹' },
      { code: 'ja', name: '日本語', flag: '🇯🇵' },
      { code: 'zh', name: '中文', flag: '🇨🇳' }
    ];
    return res.status(200).json({ success: true, data: languages });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener idiomas' });
  }
};

/**
 * GET /api/tours/guide-tours
 * Tours asignados al guía actual
 * Roles: Guide
 */
const getGuideTours = async (req, res) => {
  try {
    // Permitir guideId desde query params (para admin) o usar el del usuario autenticado
    const { guideId: queryGuideId } = req.query;
    const userId = req.user?.id;

    let guide;
    if (queryGuideId) {
      // Si viene guideId en query, buscar ese guía
      guide = await prisma.guides.findUnique({ where: { id: queryGuideId } });
    } else {
      // Si no, buscar el guía del usuario autenticado
      guide = await prisma.guides.findFirst({ where: { user_id: userId } });
    }

    if (!guide) {
      return res.status(404).json({ error: 'Not Found', message: 'Perfil de guía no encontrado' });
    }

    // Filtro de estado: por defecto activos, opcionalmente completados
    const { includeCompleted } = req.query;
    const statusFilter = includeCompleted === 'true'
      ? ['confirmed', 'pending', 'in_progress', 'completed']
      : ['confirmed', 'pending', 'in_progress'];

    const reservations = await prisma.reservations.findMany({
      where: {
        guide_id: guide.id,
        status: { in: statusFilter }
      },
      include: {
        tours: { select: { id: true, name: true, duration: true, meeting_point: true } },
        agencies: { select: { id: true, business_name: true, agency_phone: true } },
        active_tours: { select: { id: true, status: true, started_at: true } },
        reservation_groups: {
          select: {
            id: true,
            representative_name: true,
            representative_phone: true,
            adults_count: true,
            children_count: true
          },
          orderBy: { created_at: 'asc' }
        }
      },
      orderBy: { date: 'asc' }
    });

    return res.status(200).json({
      success: true,
      data: reservations.map(r => ({
        reservationId: r.id,
        tour: r.tours,
        date: r.date ? r.date.toISOString().split('T')[0] : null,
        time: r.time ? r.time.toISOString().substring(11, 16) : null,
        participants: r.participants,
        status: r.status,
        agency: r.agencies,
        pickupLocation: r.pickup_location || null,
        location: r.pickup_location || r.tours?.meeting_point || r.meeting_point || '',
        activeTour: r.active_tours || null,
        groups: (r.reservation_groups || []).map(g => ({
          id: g.id,
          representativeName: g.representative_name,
          representativePhone: g.representative_phone,
          adultsCount: g.adults_count,
          childrenCount: g.children_count
        }))
      }))
    });
  } catch (error) {
    console.error('Error en getGuideTours:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener tours' });
  }
};

/**
 * POST /api/tours/:id/assign-guide
 * Asigna un guía a un tour (actualiza tour_assignments de las reservaciones del tour)
 * Roles: Admin
 */
const assignGuideToTour = async (req, res) => {
  try {
    const { id: tourId } = req.params;
    const { guideId, validateCompetences = false } = req.body;

    if (!guideId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'guideId es requerido'
      });
    }

    // Verificar que el tour existe
    const tour = await prisma.tours.findUnique({
      where: { id: tourId }
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    // Verificar que el guía existe
    const guide = await prisma.guides.findUnique({
      where: { id: guideId },
      include: { users: { select: { first_name: true, last_name: true } } }
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Buscar reservaciones activas/pendientes del tour
    const reservations = await prisma.reservations.findMany({
      where: {
        tour_id: tourId,
        status: { in: ['pending', 'confirmed', 'active'] }
      }
    });

    if (reservations.length === 0) {
      // Si no hay reservaciones, crear una asignación temporal
      // O simplemente retornar éxito indicando que no hay reservaciones a asignar
      return res.status(200).json({
        success: true,
        message: 'Guía asignado exitosamente (sin reservaciones activas)',
        data: {
          tourId,
          guideId,
          guideName: `${guide.users?.first_name || ''} ${guide.users?.last_name || ''}`.trim(),
          reservationsUpdated: 0
        }
      });
    }

    // Actualizar o crear tour_assignments para cada reservación
    const results = await Promise.all(
      reservations.map(async (reservation) => {
        const existing = await prisma.tour_assignments.findUnique({
          where: { reservation_id: reservation.id }
        });

        if (existing) {
          return prisma.tour_assignments.update({
            where: { reservation_id: reservation.id },
            data: {
              guide_id: guideId,
              updated_at: new Date()
            }
          });
        } else {
          return prisma.tour_assignments.create({
            data: {
              reservation_id: reservation.id,
              guide_id: guideId
            }
          });
        }
      })
    );

    // También actualizar guide_id en las reservaciones
    await prisma.reservations.updateMany({
      where: { id: { in: reservations.map(r => r.id) } },
      data: { guide_id: guideId }
    });

    return res.status(200).json({
      success: true,
      message: 'Guía asignado exitosamente',
      data: {
        tourId,
        guideId,
        guideName: `${guide.users?.first_name || ''} ${guide.users?.last_name || ''}`.trim(),
        reservationsUpdated: results.length
      }
    });
  } catch (error) {
    console.error('Error en assignGuideToTour:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al asignar guía al tour'
    });
  }
};

/**
 * POST /api/tours/:id/assign-driver
 * Asigna un chofer a un tour
 * Roles: Admin
 */
const assignDriverToTour = async (req, res) => {
  try {
    const { id: tourId } = req.params;
    const { driverId, vehicleId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'driverId es requerido'
      });
    }

    // Verificar que el tour existe
    const tour = await prisma.tours.findUnique({
      where: { id: tourId }
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    // Verificar que el chofer existe
    const driver = await prisma.drivers.findUnique({
      where: { id: driverId }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Chofer no encontrado'
      });
    }

    // Buscar reservaciones activas/pendientes del tour
    const reservations = await prisma.reservations.findMany({
      where: {
        tour_id: tourId,
        status: { in: ['pending', 'confirmed', 'active'] }
      }
    });

    if (reservations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Chofer asignado exitosamente (sin reservaciones activas)',
        data: {
          tourId,
          driverId,
          driverName: driver.name,
          reservationsUpdated: 0
        }
      });
    }

    // Actualizar o crear tour_assignments para cada reservación
    const results = await Promise.all(
      reservations.map(async (reservation) => {
        const existing = await prisma.tour_assignments.findUnique({
          where: { reservation_id: reservation.id }
        });

        const updateData = {
          driver_id: driverId,
          updated_at: new Date()
        };
        if (vehicleId) updateData.vehicle_id = vehicleId;

        if (existing) {
          return prisma.tour_assignments.update({
            where: { reservation_id: reservation.id },
            data: updateData
          });
        } else {
          return prisma.tour_assignments.create({
            data: {
              reservation_id: reservation.id,
              driver_id: driverId,
              vehicle_id: vehicleId || null
            }
          });
        }
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Chofer asignado exitosamente',
      data: {
        tourId,
        driverId,
        driverName: driver.name,
        reservationsUpdated: results.length
      }
    });
  } catch (error) {
    console.error('Error en assignDriverToTour:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al asignar chofer al tour'
    });
  }
};

/**
 * POST /api/tours/:id/assign-vehicle
 * Asigna un vehículo a un tour
 * Roles: Admin
 */
const assignVehicleToTour = async (req, res) => {
  try {
    const { id: tourId } = req.params;
    const { vehicleId, driverId } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'vehicleId es requerido'
      });
    }

    // Verificar que el tour existe
    const tour = await prisma.tours.findUnique({
      where: { id: tourId }
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    // Verificar que el vehículo existe
    const vehicle = await prisma.vehicles.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Vehículo no encontrado'
      });
    }

    // Buscar reservaciones activas/pendientes del tour
    const reservations = await prisma.reservations.findMany({
      where: {
        tour_id: tourId,
        status: { in: ['pending', 'confirmed', 'active'] }
      }
    });

    if (reservations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Vehículo asignado exitosamente (sin reservaciones activas)',
        data: {
          tourId,
          vehicleId,
          vehiclePlate: vehicle.plate,
          reservationsUpdated: 0
        }
      });
    }

    // Actualizar o crear tour_assignments para cada reservación
    const results = await Promise.all(
      reservations.map(async (reservation) => {
        const existing = await prisma.tour_assignments.findUnique({
          where: { reservation_id: reservation.id }
        });

        const updateData = {
          vehicle_id: vehicleId,
          updated_at: new Date()
        };
        if (driverId) updateData.driver_id = driverId;

        if (existing) {
          return prisma.tour_assignments.update({
            where: { reservation_id: reservation.id },
            data: updateData
          });
        } else {
          return prisma.tour_assignments.create({
            data: {
              reservation_id: reservation.id,
              vehicle_id: vehicleId,
              driver_id: driverId || null
            }
          });
        }
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Vehículo asignado exitosamente',
      data: {
        tourId,
        vehicleId,
        vehiclePlate: vehicle.plate,
        reservationsUpdated: results.length
      }
    });
  } catch (error) {
    console.error('Error en assignVehicleToTour:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al asignar vehículo al tour'
    });
  }
};

/**
 * DELETE /api/tours/:id/assignments/:type
 * Remueve una asignación del tour
 * Roles: Admin
 */
const removeAssignment = async (req, res) => {
  try {
    const { id: tourId, type } = req.params;

    // Buscar reservaciones del tour
    const reservations = await prisma.reservations.findMany({
      where: { tour_id: tourId },
      select: { id: true }
    });

    if (reservations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay reservaciones para este tour'
      });
    }

    const reservationIds = reservations.map(r => r.id);

    switch (type) {
      case 'guide':
        await prisma.tour_assignments.updateMany({
          where: { reservation_id: { in: reservationIds } },
          data: { guide_id: null }
        });
        await prisma.reservations.updateMany({
          where: { id: { in: reservationIds } },
          data: { guide_id: null }
        });
        break;
      case 'driver':
        await prisma.tour_assignments.updateMany({
          where: { reservation_id: { in: reservationIds } },
          data: { driver_id: null }
        });
        break;
      case 'vehicle':
        await prisma.tour_assignments.updateMany({
          where: { reservation_id: { in: reservationIds } },
          data: { vehicle_id: null }
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Tipo de asignación inválido. Use: guide, driver, vehicle'
        });
    }

    return res.status(200).json({
      success: true,
      message: `Asignación de ${type} removida exitosamente`
    });
  } catch (error) {
    console.error('Error en removeAssignment:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al remover asignación'
    });
  }
};

/**
 * GET /api/tours/reservations/:reservationId/assignment-pdf
 * Genera PDF con la ficha de asignación completa de una reserva
 * Roles: Admin
 */
const generateAssignmentPDF = async (req, res) => {
  try {
    const { reservationId } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(reservationId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'reservationId debe ser un UUID válido'
      });
    }

    // Obtener la reserva con todas las relaciones necesarias
    const reservation = await prisma.reservations.findUnique({
      where: { id: reservationId },
      include: {
        tours: true,
        agencies: {
          include: {
            users: { select: { first_name: true, last_name: true, email: true, phone: true } }
          }
        },
        guides: {
          include: {
            users: { select: { first_name: true, last_name: true, email: true, phone: true } }
          }
        },
        tour_assignments: {
          include: {
            guides: {
              include: {
                users: { select: { first_name: true, last_name: true, email: true, phone: true } }
              }
            },
            drivers: true,
            vehicles: true
          }
        }
      }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reserva no encontrada'
      });
    }

    const assignment = reservation.tour_assignments;
    const tour = reservation.tours;
    const agency = reservation.agencies;
    const guide = assignment?.guides || reservation.guides;
    const driver = assignment?.drivers;
    const vehicle = assignment?.vehicles;

    // Formatear datos para el PDF
    const pdfData = {
      reservation: {
        id: reservation.id,
        code: `RES-${reservation.id.substring(0, 8).toUpperCase()}`,
        date: reservation.date,
        time: reservation.time,
        adults: reservation.adults || 0,
        children: reservation.children || 0,
        participants: reservation.participants || (reservation.adults + reservation.children),
        pickupLocation: assignment?.pickup_location || reservation.pickup_location || 'Por confirmar',
        pickupTime: assignment?.pickup_time || reservation.time,
        specialRequirements: reservation.special_requirements,
        notes: assignment?.notes || reservation.notes,
        status: reservation.status
      },
      tour: tour ? {
        id: tour.id,
        code: tour.code,
        name: tour.name,
        duration: tour.duration,
        meetingPoint: tour.meeting_point,
        category: tour.category,
        includesGuide: tour.includes_guide,
        includesTransport: tour.includes_transport
      } : null,
      agency: agency ? {
        id: agency.id,
        name: agency.business_name,
        phone: agency.agency_phone,
        email: agency.agency_email,
        contactName: agency.users ? `${agency.users.first_name} ${agency.users.last_name}` : null
      } : null,
      guide: guide ? {
        id: guide.id,
        name: guide.users ? `${guide.users.first_name} ${guide.users.last_name}` : 'N/A',
        phone: guide.users?.phone || 'N/A',
        email: guide.users?.email || 'N/A',
        languages: guide.languages || [],
        specialties: guide.specialties || [],
        museums: guide.museums || [],
        licenseNumber: guide.license_number
      } : null,
      driver: driver ? {
        id: driver.id,
        name: `${driver.first_name} ${driver.last_name}`,
        phone: driver.phone || 'N/A',
        licenseNumber: driver.license_number,
        licenseCategory: driver.license_category
      } : null,
      vehicle: vehicle ? {
        id: vehicle.id,
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        capacity: vehicle.capacity,
        vehicleType: vehicle.vehicle_type
      } : null,
      assignment: assignment ? {
        id: assignment.id,
        status: assignment.status,
        createdAt: assignment.created_at
      } : null,
      generatedAt: new Date().toISOString()
    };

    // Verificar que la asignación esté completa
    const isComplete = pdfData.guide && pdfData.driver && pdfData.vehicle;

    // Actualizar pdf_generated_at si hay asignación
    if (assignment) {
      await prisma.tour_assignments.update({
        where: { id: assignment.id },
        data: { pdf_generated_at: new Date() }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Datos de asignación obtenidos exitosamente',
      data: pdfData,
      isComplete,
      warnings: !isComplete ? {
        missingGuide: !pdfData.guide,
        missingDriver: !pdfData.driver,
        missingVehicle: !pdfData.vehicle
      } : null
    });

  } catch (error) {
    console.error('Error en generateAssignmentPDF:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al generar datos para el PDF de asignación'
    });
  }
};

/**
 * GET /api/tours/assignments/pending
 * Lista reservas con asignaciones pendientes o parciales
 * Roles: Admin
 */
const getPendingAssignments = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, date, status } = req.query;
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    // Construir filtros base para reservaciones
    const reservationWhere = {
      status: { in: ['pending', 'confirmed'] }
    };

    if (date) {
      reservationWhere.date = new Date(date);
    }

    // Obtener reservaciones con sus asignaciones
    const [reservations, total] = await Promise.all([
      prisma.reservations.findMany({
        where: reservationWhere,
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        include: {
          tours: { select: { id: true, code: true, name: true, duration: true, category: true } },
          agencies: { select: { id: true, business_name: true } },
          tour_assignments: {
            include: {
              guides: {
                include: { users: { select: { first_name: true, last_name: true } } }
              },
              drivers: { select: { id: true, first_name: true, last_name: true } },
              vehicles: { select: { id: true, plate: true, brand: true, model: true, capacity: true } }
            }
          }
        }
      }),
      prisma.reservations.count({ where: reservationWhere })
    ]);

    // Filtrar según el estado de asignación si se especifica
    let filteredReservations = reservations;
    if (status === 'pending') {
      filteredReservations = reservations.filter(r => {
        const a = r.tour_assignments;
        return !a || !a.guide_id || !a.driver_id || !a.vehicle_id;
      });
    } else if (status === 'complete') {
      filteredReservations = reservations.filter(r => {
        const a = r.tour_assignments;
        return a && a.guide_id && a.driver_id && a.vehicle_id;
      });
    }

    // Mapear respuesta
    const items = filteredReservations.map(r => {
      const a = r.tour_assignments;
      const isComplete = a && a.guide_id && a.driver_id && a.vehicle_id;

      return {
        id: r.id,
        code: `RES-${r.id.substring(0, 8).toUpperCase()}`,
        date: r.date,
        time: r.time,
        participants: r.participants,
        adults: r.adults,
        children: r.children,
        status: r.status,
        pickupLocation: a?.pickup_location || r.pickup_location,
        tour: r.tours,
        agency: r.agencies ? { id: r.agencies.id, name: r.agencies.business_name } : null,
        assignmentStatus: isComplete ? 'complete' : 'pending',
        assignment: a ? {
          id: a.id,
          guide: a.guides ? {
            id: a.guides.id,
            name: `${a.guides.users?.first_name || ''} ${a.guides.users?.last_name || ''}`.trim()
          } : null,
          driver: a.drivers ? {
            id: a.drivers.id,
            name: `${a.drivers.first_name} ${a.drivers.last_name}`
          } : null,
          vehicle: a.vehicles ? {
            id: a.vehicles.id,
            plate: a.vehicles.plate,
            description: `${a.vehicles.brand} ${a.vehicles.model} (${a.vehicles.capacity} pax)`
          } : null,
          pdfGeneratedAt: a.pdf_generated_at
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: Math.ceil(total / pageSizeNum)
        },
        summary: {
          total: items.length,
          complete: items.filter(i => i.assignmentStatus === 'complete').length,
          pending: items.filter(i => i.assignmentStatus === 'pending').length
        }
      }
    });

  } catch (error) {
    console.error('Error en getPendingAssignments:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener asignaciones pendientes'
    });
  }
};

module.exports = {
  listTours,
  getTour,
  createTour,
  updateTour,
  deleteTour,
  getTourCategories,
  toggleTourStatus,
  getTourStatistics,
  getAvailableTours,
  duplicateTour,
  searchTours,
  getTourAvailability,
  getAvailableGuidesForTour,
  updateTourStatus,
  getTourLanguages,
  getGuideTours,
  assignGuideToTour,
  assignDriverToTour,
  assignVehicleToTour,
  removeAssignment,
  generateAssignmentPDF,
  getPendingAssignments
};
