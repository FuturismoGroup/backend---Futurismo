// Controller de Reservations
// API-001: ListReservations - GET /api/reservations
// Fuente: 04_apis_lista.md linea 10-149

const prisma = require('../config/db');
const { parseLocalDate, formatLocalDate, isDateTodayOrFuture } = require('../utils/dateUtils');
const { validatePaymentMethod } = require('../utils/paymentMethodValidator');
const { getPointsConfigFromDB, recalculateAgencyLevel } = require('./pointsController');

/**
 * API-001: ListReservations
 * GET /api/reservations
 * Obtiene lista paginada de reservas con filtros opcionales
 * Roles: Admin, Agency, Guide
 */
const listReservations = async (req, res) => {
  try {
    // Extraer parÃ¡metros de query
    const {
      page = 1,
      pageSize = 20,
      status,
      dateFrom,
      dateTo,
      agencyId: filterAgencyId,
      guideId,
      destination,
      tourType,
      searchTerm,
      minPassengers,
      maxPassengers,
      dateFilterType
    } = req.query;

    // Validaciones de request segÃºn 04_apis_lista.md lÃ­neas 128-132
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

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom debe ser menor o igual a dateTo'
      });
    }

    // Estados vÃ¡lidos segÃºn modelo (TBL-008 lÃ­nea 1432-1443)
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'in_progress'];
    // 'all' significa sin filtro de estado
    if (status && status !== 'all' && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // Construir filtros WHERE
    const where = {};

    // Reglas de negocio segÃºn rol (lÃ­neas 134-136)
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === 'agency') {
      // Agency solo ve sus propias reservas
      const agency = await prisma.agencies.findUnique({
        where: { user_id: userId }
      });
      if (agency) {
        where.agency_id = agency.id;
      } else {
        // Si no tiene agencia asociada, no ve nada
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: 0
        });
      }
    } else if (userRole === 'guide') {
      // Guide solo ve reservas asignadas a él
      const guide = await prisma.guides.findUnique({
        where: { user_id: userId }
      });
      if (guide) {
        where.guide_id = guide.id;
      } else {
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: 0
        });
      }
    }
    // Admin ve todas las reservas - no se aplica filtro adicional

    // Filtro por status (ignorar si es 'all')
    if (status && status !== 'all') {
      where.status = status;
    }

    // Filtros por fecha (usando utilidad que maneja timezone correctamente)
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = parseLocalDate(dateFrom);
      }
      if (dateTo) {
        where.date.lte = parseLocalDate(dateTo);
      }
    }

    // Filtro por agencyId (adicional al filtro implícito de rol)
    if (filterAgencyId && userRole !== 'agency') {
      where.agency_id = filterAgencyId;
    }

    // Filtro por guideId (adicional al filtro implÃ­cito de rol)
    if (guideId && userRole !== 'guide') {
      where.guideId = guideId;
    }

    // Filtro por tourType (requiere join con tour)
    // Filtro por destination (requiere join con tour)
    // Filtro por searchTerm (busca en mÃºltiples campos)
    // Estos se manejan en la relaciÃ³n tour

    let tourFilter = {};
    if (tourType) {
      tourFilter.tourType = tourType;
    }
    if (destination) {
      tourFilter.name = {
        contains: destination,
        mode: 'insensitive'
      };
    }

    if (Object.keys(tourFilter).length > 0) {
      where.tour = tourFilter;
    }

    // Filtro por cantidad de pasajeros
    if (minPassengers) {
      where.participants = {
        ...where.participants,
        gte: parseInt(minPassengers, 10)
      };
    }
    if (maxPassengers) {
      where.participants = {
        ...where.participants,
        lte: parseInt(maxPassengers, 10)
      };
    }

    // Filtro searchTerm - busca en agencia, tour, notas
    if (searchTerm) {
      where.OR = [
        {
          agencies: {
            business_name: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        },
        {
          tours: {
            name: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        },
        {
          notes: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          billing_name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Calcular skip para paginaciÃ³n
    const skip = (pageNum - 1) * pageSizeNum;

    // Ejecutar consultas en paralelo
    const [reservations, total] = await Promise.all([
      prisma.reservations.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { date: 'desc' },
        include: {
          tours: {
            select: {
              id: true,
              name: true,
              tour_type: true,
              duration: true,
              price: true,
              image: true
            }
          },
          guides: {
            select: {
              id: true,
              users: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true
                }
              }
            }
          },
          agencies: {
            select: {
              id: true,
              business_name: true,
              agency_phone: true,
              agency_email: true
            }
          },
          tour_assignments: {
            include: {
              guides: {
                include: {
                  users: {
                    select: { first_name: true, last_name: true }
                  }
                }
              },
              drivers: true,
              vehicles: true
            }
          },
          ratings: {
            select: {
              id: true,
              overall_rating: true,
              guide_rating: true,
              driver_rating: true,
              vehicle_rating: true,
              comment: true,
              created_at: true
            }
          },
          reservation_groups: {
            orderBy: { sort_order: 'asc' }
          }
        }
      }),
      prisma.reservations.count({ where })
    ]);

    // Calcular total de pÃ¡ginas
    const totalPages = Math.ceil(total / pageSizeNum);

    // Mapear respuesta
    const data = reservations.map(reservation => ({
      id: reservation.id,
      tourId: reservation.tour_id,
      agencyId: reservation.agency_id,
      guideId: reservation.guide_id,
      date: reservation.date,
      time: reservation.time,
      adults: reservation.adults,
      children: reservation.children,
      participants: reservation.participants,
      pickupLocation: reservation.pickup_location,
      specialRequirements: reservation.special_requirements,
      status: reservation.status,
      totalAmount: reservation.total_amount,
      paymentMethod: reservation.payment_method,
      paymentStatus: reservation.payment_status,
      billingName: reservation.billing_name,
      notes: reservation.notes,
      createdAt: reservation.created_at,
      updatedAt: reservation.updated_at,
      tour: reservation.tours ? {
        id: reservation.tours.id,
        name: reservation.tours.name,
        tourType: reservation.tours.tour_type,
        duration: reservation.tours.duration,
        price: reservation.tours.price,
        image: reservation.tours.image
      } : null,
      guide: reservation.guides ? {
        id: reservation.guides.id,
        firstName: reservation.guides.users?.first_name,
        lastName: reservation.guides.users?.last_name
      } : null,
      agency: reservation.agencies ? {
        id: reservation.agencies.id,
        businessName: reservation.agencies.business_name,
        phone: reservation.agencies.agency_phone,
        email: reservation.agencies.agency_email
      } : null,
      groups: (reservation.reservation_groups || []).map(g => ({
        id: g.id,
        representativeName: g.representative_name,
        representativePhone: g.representative_phone,
        adultsCount: g.adults_count,
        childrenCount: g.children_count
      })),
      rating: reservation.ratings?.overall_rating || null,
      ratingComment: reservation.ratings?.comment || null,
      ratingDate: reservation.ratings?.created_at || null,
      guideRating: reservation.ratings?.guide_rating || null,
      tourAssignment: reservation.tour_assignments ? {
        id: reservation.tour_assignments.id,
        guideId: reservation.tour_assignments.guide_id,
        guideName: reservation.tour_assignments.guides?.users
          ? `${reservation.tour_assignments.guides.users.first_name || ''} ${reservation.tour_assignments.guides.users.last_name || ''}`.trim()
          : null,
        guideLanguages: reservation.tour_assignments.guides?.languages || [],
        guideSpecialties: reservation.tour_assignments.guides?.specialties || [],
        driverId: reservation.tour_assignments.driver_id,
        driverName: reservation.tour_assignments.drivers
          ? `${reservation.tour_assignments.drivers.first_name} ${reservation.tour_assignments.drivers.last_name}`
          : null,
        driverLicense: reservation.tour_assignments.drivers?.license_number || null,
        driverCategory: reservation.tour_assignments.drivers?.license_category || null,
        vehicleId: reservation.tour_assignments.vehicle_id,
        vehiclePlate: reservation.tour_assignments.vehicles?.plate || null,
        vehicleInfo: reservation.tour_assignments.vehicles
          ? `${reservation.tour_assignments.vehicles.brand} ${reservation.tour_assignments.vehicles.model}`
          : null,
        vehicleBrand: reservation.tour_assignments.vehicles?.brand || null,
        vehicleCapacity: reservation.tour_assignments.vehicles?.capacity || null,
        status: reservation.tour_assignments.status
      } : null
    }));

    // Response segÃºn esquema PaginatedReservationsList (lÃ­neas 90-98)
    return res.status(200).json({
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages
    });

  } catch (error) {
    console.error('Error en listReservations:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener las reservas'
    });
  }
};

/**
 * API-002: GetReservation
 * GET /api/reservations/:id
 * Obtiene detalle completo de una reserva especÃ­fica
 * Roles: Admin, Agency, Guide
 * Fuente: 04_apis_lista.md lÃ­neas 150-236
 */
const getReservation = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que id sea UUID vÃ¡lido (lÃ­nea 219)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID vÃ¡lido'
      });
    }

    // Obtener informaciÃ³n del usuario para validaciÃ³n de permisos
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Buscar la reserva con todas sus relaciones
    const reservation = await prisma.reservations.findUnique({
      where: { id },
      include: {
        tours: {
          select: {
            id: true,
            name: true,
            description: true,
            short_description: true,
            category: true,
            tour_type: true,
            duration: true,
            price: true,
            child_price: true,
            max_capacity: true,
            includes_guide: true,
            includes_transport: true,
            meeting_point: true,
            languages: true,
            image: true,
            active: true
          }
        },
        guides: {
          select: {
            id: true,
            guide_type: true,
            license_number: true,
            languages: true,
            specialties: true,
            rating: true,
            users: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                phone: true,
                profile_photo: true
              }
            }
          }
        },
        agencies: {
          select: {
            id: true,
            business_name: true,
            ruc: true,
            agency_phone: true,
            agency_email: true,
            agency_logo: true,
            level: true,
            verified: true
          }
        },
        reservation_groups: {
          orderBy: { sort_order: 'asc' }
        }
      }
    });

    // Validar existencia (lÃ­nea 220)
    if (!reservation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reserva no encontrada'
      });
    }

    // Reglas de estado segÃºn rol (lÃ­neas 221-224)
    if (userRole === 'agency') {
      // Agency solo puede ver reservas propias
      const agency = await prisma.agencies.findUnique({
        where: { user_id: userId }
      });
      if (!agency || reservation.agency_id !== agency.id) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Reserva no encontrada'
        });
      }
    } else if (userRole === 'guide') {
      // Guide solo puede ver reservas asignadas a él
      const guide = await prisma.guides.findUnique({
        where: { user_id: userId }
      });
      if (!guide || reservation.guide_id !== guide.id) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Reserva no encontrada'
        });
      }
    }
    // Admin puede ver todas - no hay restricciÃ³n adicional

    // Construir response
    const response = {
      id: reservation.id,
      tour: reservation.tours ? {
        id: reservation.tours.id,
        name: reservation.tours.name,
        description: reservation.tours.description,
        shortDescription: reservation.tours.short_description,
        category: reservation.tours.category,
        tourType: reservation.tours.tour_type,
        duration: reservation.tours.duration,
        price: reservation.tours.price,
        childPrice: reservation.tours.child_price,
        maxCapacity: reservation.tours.max_capacity,
        includesGuide: reservation.tours.includes_guide,
        includesTransport: reservation.tours.includes_transport,
        meetingPoint: reservation.tours.meeting_point,
        languages: reservation.tours.languages,
        image: reservation.tours.image,
        active: reservation.tours.active
      } : null,
      guide: reservation.guides ? {
        id: reservation.guides.id,
        guideType: reservation.guides.guide_type,
        licenseNumber: reservation.guides.license_number,
        languages: reservation.guides.languages,
        specialties: reservation.guides.specialties,
        rating: reservation.guides.rating,
        firstName: reservation.guides.users?.first_name,
        lastName: reservation.guides.users?.last_name,
        email: reservation.guides.users?.email,
        phone: reservation.guides.users?.phone,
        profilePhoto: reservation.guides.users?.profile_photo
      } : null,
      agency: reservation.agencies ? {
        id: reservation.agencies.id,
        businessName: reservation.agencies.business_name,
        ruc: reservation.agencies.ruc,
        phone: reservation.agencies.agency_phone,
        email: reservation.agencies.agency_email,
        logo: reservation.agencies.agency_logo,
        level: reservation.agencies.level,
        verified: reservation.agencies.verified
      } : null,
      date: reservation.date,
      time: reservation.time,
      adults: reservation.adults,
      children: reservation.children,
      participants: reservation.participants,
      status: reservation.status,
      totalAmount: reservation.total_amount,
      paymentMethod: reservation.payment_method,
      paymentStatus: reservation.payment_status,
      pickupLocation: reservation.pickup_location,
      specialRequirements: reservation.special_requirements,
      pointsAwarded: reservation.points_awarded,
      billingName: reservation.billing_name,
      billingDocument: reservation.billing_document,
      billingAddress: reservation.billing_address,
      notes: reservation.notes,
      groups: (reservation.reservation_groups || []).map(g => ({
        id: g.id,
        representativeName: g.representative_name,
        representativePhone: g.representative_phone,
        adultsCount: g.adults_count,
        childrenCount: g.children_count
      })),
      createdAt: reservation.created_at,
      updatedAt: reservation.updated_at
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error en getReservation:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener la reserva'
    });
  }
};

/**
 * API-003: CreateReservation
 * POST /api/reservations
 * Crea una nueva reserva de tour
 * Roles: Admin, Agency
 * Fuente: 04_apis_lista.md lÃ­neas 237-323
 */
const createReservation = async (req, res) => {
  try {
    const {
      tourId,
      date,
      time,
      adults,
      children = 0,
      groups,
      pickupLocation,
      specialRequirements,
      paymentMethod,
      billingName,
      billingDocument,
      billingAddress,
      notes
    } = req.body;

    // Parsear fecha sin problemas de timezone
    const parsedDate = parseLocalDate(date);

    // Validaciones de request

    // tourId requerido
    if (!tourId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tourId es requerido'
      });
    }

    // date requerido
    if (!date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'date es requerido'
      });
    }

    // Validar date >= hoy (usando utilidad que maneja timezone correctamente)
    if (!isDateTodayOrFuture(date)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'date debe ser igual o posterior a hoy'
      });
    }

    // time requerido
    if (!time) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'time es requerido'
      });
    }

    // Validar formato time HH:mm
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(time)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'time debe estar en formato HH:mm'
      });
    }

    // Calcular adults/children desde grupos (fuente unica de verdad)
    let adultsNum, childrenNum;
    if (groups && Array.isArray(groups) && groups.length > 0) {
      adultsNum = groups.reduce((sum, g) => sum + (parseInt(g.adultsCount, 10) || 0), 0);
      childrenNum = groups.reduce((sum, g) => sum + (parseInt(g.childrenCount, 10) || 0), 0);
    } else {
      // Fallback para compatibilidad: usar campos directos
      adultsNum = parseInt(adults, 10) || 0;
      childrenNum = parseInt(children, 10) || 0;
    }

    if (adultsNum < 1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Debe haber al menos 1 adulto en total'
      });
    }

    // Validar que tour existe y está activo
    const tour = await prisma.tours.findUnique({
      where: { id: tourId }
    });

    if (!tour) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    if (!tour.active) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El tour no está activo'
      });
    }

    // Obtener datos del usuario autenticado
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Determinar agency_id - REQUERIDO para crear reserva
    let agencyId = null;
    if (userRole === 'agency') {
      const agency = await prisma.agencies.findUnique({
        where: { user_id: userId }
      });
      if (agency) {
        agencyId = agency.id;
      }
    } else if (userRole === 'administrator' || userRole === 'admin') {
      // Admin puede crear para cualquier agencia si se proporciona
      agencyId = req.body.agencyId || null;
    }

    // Si admin no proporciona agencyId, buscar la primera agencia activa
    if (!agencyId && (userRole === 'administrator' || userRole === 'admin')) {
      const defaultAgency = await prisma.agencies.findFirst({
        where: { status: 'active' },
        orderBy: { created_at: 'asc' }
      });
      if (defaultAgency) {
        agencyId = defaultAgency.id;
      }
    }

    if (!agencyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Se requiere una agencia para crear la reserva'
      });
    }

    // Validar paymentMethod contra codigos globales O metodos de pago propios
    // de la agencia (UUID en agency_payment_methods). El frontend manda el UUID
    // del metodo cuando la agencia configura sus propias cuentas.
    const paymentValidation = await validatePaymentMethod(paymentMethod, agencyId);
    let validatedPaymentMethod = paymentMethod;
    if (paymentValidation.useDefault) {
      validatedPaymentMethod = 'pending';
    } else if (!paymentValidation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `paymentMethod debe ser uno de: ${paymentValidation.validMethods.join(', ')}`
      });
    } else {
      validatedPaymentMethod = paymentValidation.resolvedMethod || paymentMethod;
    }

    // Calcular totalAmount (precio unico por persona, sin diferencia adulto/nino)
    const pricePerPerson = parseFloat(tour.price) || 0;
    const totalAmount = (adultsNum + childrenNum) * pricePerPerson;

    // Convertir time string a Date para Prisma (usar UTC para consistencia entre servidores)
    const [hours, minutes] = time.split(':');
    const timeDate = new Date(Date.UTC(1970, 0, 1, parseInt(hours, 10), parseInt(minutes, 10), 0, 0));

    // Crear reserva + grupos en transaccion
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservations.create({
        data: {
          tour_id: tourId,
          agency_id: agencyId,
          date: parseLocalDate(date),
          time: timeDate,
          adults: adultsNum,
          children: childrenNum,
          participants: adultsNum + childrenNum,
          pickup_location: pickupLocation || null,
          special_requirements: specialRequirements || null,
          status: 'pending',
          total_amount: totalAmount,
          payment_method: validatedPaymentMethod,
          payment_status: 'pending',
          billing_name: billingName || null,
          billing_document: billingDocument || null,
          billing_address: billingAddress || null,
          notes: notes || null,
          created_by: userId
        },
        include: {
          tours: {
            select: {
              id: true,
              name: true,
              tour_type: true,
              duration: true,
              price: true,
              child_price: true,
              image: true
            }
          },
          agencies: {
            select: {
              id: true,
              business_name: true,
              agency_phone: true,
              agency_email: true
            }
          }
        }
      });

      // Crear grupos en reservation_groups
      let createdGroups = [];
      if (groups && Array.isArray(groups) && groups.length > 0) {
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          const created = await tx.reservation_groups.create({
            data: {
              reservation_id: reservation.id,
              representative_name: g.representativeName || '',
              representative_phone: g.representativePhone || '',
              adults_count: parseInt(g.adultsCount, 10) || 1,
              children_count: parseInt(g.childrenCount, 10) || 0,
              sort_order: i
            }
          });
          createdGroups.push(created);
        }
      }

      return { reservation, createdGroups };
    });

    const { reservation, createdGroups } = result;

    // Response
    return res.status(201).json({
      id: reservation.id,
      tourId: reservation.tour_id,
      agencyId: reservation.agency_id,
      date: reservation.date,
      time: reservation.time,
      adults: reservation.adults,
      children: reservation.children,
      participants: reservation.participants,
      pickupLocation: reservation.pickup_location,
      specialRequirements: reservation.special_requirements,
      status: reservation.status,
      totalAmount: reservation.total_amount,
      paymentMethod: reservation.payment_method,
      paymentStatus: reservation.payment_status,
      billingName: reservation.billing_name,
      billingDocument: reservation.billing_document,
      billingAddress: reservation.billing_address,
      notes: reservation.notes,
      createdAt: reservation.created_at,
      groups: createdGroups.map(g => ({
        id: g.id,
        representativeName: g.representative_name,
        representativePhone: g.representative_phone,
        adultsCount: g.adults_count,
        childrenCount: g.children_count
      })),
      tour: reservation.tours ? {
        id: reservation.tours.id,
        name: reservation.tours.name,
        tourType: reservation.tours.tour_type,
        duration: reservation.tours.duration,
        price: reservation.tours.price,
        childPrice: reservation.tours.child_price,
        image: reservation.tours.image
      } : null,
      agency: reservation.agencies ? {
        id: reservation.agencies.id,
        businessName: reservation.agencies.business_name,
        phone: reservation.agencies.agency_phone,
        email: reservation.agencies.agency_email
      } : null
    });

  } catch (error) {
    console.error('Error en createReservation:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear la reserva'
    });
  }
};

/**
 * API-004: UpdateReservation
 * PATCH /api/reservations/:id
 * Actualiza una reserva existente
 * Roles: Admin, Agency
 * Fuente: 04_apis_lista.md lÃ­neas 324-394
 */
const updateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date,
      time,
      adults,
      children,
      groups,
      pickupLocation,
      specialRequirements,
      billingName,
      billingDocument,
      billingAddress,
      notes,
      paymentMethod
    } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Buscar reserva existente
    const existingReservation = await prisma.reservations.findUnique({
      where: { id },
      include: {
        tours: true
      }
    });

    if (!existingReservation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reserva no encontrada'
      });
    }

    // Reglas de estado: solo editar si status IN ('pending', 'confirmed')
    if (!['pending', 'confirmed'].includes(existingReservation.status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No se puede editar una reserva cancelada o completada'
      });
    }

    // Validar permisos por rol
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === 'agency') {
      const agency = await prisma.agencies.findUnique({
        where: { user_id: userId }
      });
      if (!agency || existingReservation.agency_id !== agency.id) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Reserva no encontrada'
        });
      }
    }

    // Construir objeto de actualización
    const updateData = {};

    // Validar date >= hoy si se modifica (usando utilidad que maneja timezone correctamente)
    if (date !== undefined) {
      if (!isDateTodayOrFuture(date)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'date debe ser igual o posterior a hoy'
        });
      }
      updateData.date = parseLocalDate(date);
    }

    // Validar time formato HH:mm
    if (time !== undefined) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'time debe estar en formato HH:mm'
        });
      }
      const [hours, minutes] = time.split(':');
      const timeDate = new Date(Date.UTC(1970, 0, 1, parseInt(hours, 10), parseInt(minutes, 10), 0, 0));
      updateData.time = timeDate;
    }

    // Calcular adults/children desde grupos si se envian
    let newAdults = existingReservation.adults;
    let newChildren = existingReservation.children;

    if (groups && Array.isArray(groups) && groups.length > 0) {
      // Grupos como fuente unica de verdad
      newAdults = groups.reduce((sum, g) => sum + (parseInt(g.adultsCount, 10) || 0), 0);
      newChildren = groups.reduce((sum, g) => sum + (parseInt(g.childrenCount, 10) || 0), 0);
      if (newAdults < 1) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Debe haber al menos 1 adulto en total'
        });
      }
      updateData.adults = newAdults;
      updateData.children = newChildren;
      updateData.participants = newAdults + newChildren;
      const pricePerPerson = parseFloat(existingReservation.tours?.price) || 0;
      updateData.total_amount = (newAdults + newChildren) * pricePerPerson;
    } else {
      // Fallback: campos directos adults/children
      if (adults !== undefined) {
        const adultsNum = parseInt(adults, 10);
        if (adultsNum < 1) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'adults debe ser >= 1'
          });
        }
        newAdults = adultsNum;
        updateData.adults = adultsNum;
      }

      if (children !== undefined) {
        newChildren = parseInt(children, 10) || 0;
        updateData.children = newChildren;
      }

      if (adults !== undefined || children !== undefined) {
        updateData.participants = newAdults + newChildren;
        const pricePerPerson = parseFloat(existingReservation.tours?.price) || 0;
        updateData.total_amount = (newAdults + newChildren) * pricePerPerson;
      }
    }

    // pickupLocation
    if (pickupLocation !== undefined) {
      updateData.pickup_location = pickupLocation;
    }

    // specialRequirements max 500 caracteres
    if (specialRequirements !== undefined) {
      if (specialRequirements && specialRequirements.length > 500) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'specialRequirements no puede exceder 500 caracteres'
        });
      }
      updateData.special_requirements = specialRequirements;
    }

    // Billing info
    if (billingName !== undefined) {
      updateData.billing_name = billingName;
    }
    if (billingDocument !== undefined) {
      updateData.billing_document = billingDocument;
    }
    if (billingAddress !== undefined) {
      updateData.billing_address = billingAddress;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Validar y actualizar paymentMethod: acepta codigos globales o UUIDs de
    // agency_payment_methods (resolviendo al type para guardar un codigo valido).
    if (paymentMethod !== undefined) {
      const paymentValidation = await validatePaymentMethod(paymentMethod, existingReservation.agency_id);

      if (paymentValidation.useDefault) {
        // Si es vacio/null, no cambiar el valor actual
      } else if (!paymentValidation.valid) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `paymentMethod debe ser uno de: ${paymentValidation.validMethods.join(', ')}`
        });
      } else {
        updateData.payment_method = paymentValidation.resolvedMethod || paymentMethod;
      }
    }

    // Actualizar reserva + grupos en transaccion
    const result = await prisma.$transaction(async (tx) => {
      const updatedReservation = await tx.reservations.update({
        where: { id },
        data: updateData,
        include: {
          tours: {
            select: {
              id: true,
              name: true,
              tour_type: true,
              duration: true,
              price: true,
              child_price: true,
              image: true
            }
          },
          guides: {
            select: {
              id: true,
              users: {
                select: {
                  first_name: true,
                  last_name: true
                }
              }
            }
          },
          agencies: {
            select: {
              id: true,
              business_name: true,
              agency_phone: true,
              agency_email: true
            }
          }
        }
      });

      // Si se enviaron grupos, reemplazar todos
      let updatedGroups = [];
      if (groups && Array.isArray(groups) && groups.length > 0) {
        // Eliminar grupos anteriores
        await tx.reservation_groups.deleteMany({
          where: { reservation_id: id }
        });
        // Crear nuevos grupos
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          const created = await tx.reservation_groups.create({
            data: {
              reservation_id: id,
              representative_name: g.representativeName || '',
              representative_phone: g.representativePhone || '',
              adults_count: parseInt(g.adultsCount, 10) || 1,
              children_count: parseInt(g.childrenCount, 10) || 0,
              sort_order: i
            }
          });
          updatedGroups.push(created);
        }
      } else {
        // Cargar grupos existentes
        updatedGroups = await tx.reservation_groups.findMany({
          where: { reservation_id: id },
          orderBy: { sort_order: 'asc' }
        });
      }

      return { updatedReservation, updatedGroups };
    });

    const { updatedReservation, updatedGroups } = result;

    // Response
    return res.status(200).json({
      id: updatedReservation.id,
      tourId: updatedReservation.tour_id,
      agencyId: updatedReservation.agency_id,
      guideId: updatedReservation.guide_id,
      date: updatedReservation.date,
      time: updatedReservation.time,
      adults: updatedReservation.adults,
      children: updatedReservation.children,
      participants: updatedReservation.participants,
      pickupLocation: updatedReservation.pickup_location,
      specialRequirements: updatedReservation.special_requirements,
      status: updatedReservation.status,
      totalAmount: updatedReservation.total_amount,
      paymentMethod: updatedReservation.payment_method,
      paymentStatus: updatedReservation.payment_status,
      billingName: updatedReservation.billing_name,
      billingDocument: updatedReservation.billing_document,
      billingAddress: updatedReservation.billing_address,
      notes: updatedReservation.notes,
      groups: updatedGroups.map(g => ({
        id: g.id,
        representativeName: g.representative_name,
        representativePhone: g.representative_phone,
        adultsCount: g.adults_count,
        childrenCount: g.children_count
      })),
      createdAt: updatedReservation.created_at,
      updatedAt: updatedReservation.updated_at,
      tour: updatedReservation.tours ? {
        id: updatedReservation.tours.id,
        name: updatedReservation.tours.name,
        tourType: updatedReservation.tours.tour_type,
        duration: updatedReservation.tours.duration,
        price: updatedReservation.tours.price,
        childPrice: updatedReservation.tours.child_price,
        image: updatedReservation.tours.image
      } : null,
      guide: updatedReservation.guides ? {
        id: updatedReservation.guides.id,
        firstName: updatedReservation.guides.users?.first_name,
        lastName: updatedReservation.guides.users?.last_name
      } : null,
      agency: updatedReservation.agencies ? {
        id: updatedReservation.agencies.id,
        businessName: updatedReservation.agencies.business_name,
        phone: updatedReservation.agencies.agency_phone,
        email: updatedReservation.agencies.agency_email
      } : null
    });

  } catch (error) {
    console.error('Error en updateReservation:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar la reserva'
    });
  }
};

/**
 * API-005: UpdateReservationStatus
 * PATCH /api/reservations/:id/status
 * Actualiza el estado de una reserva
 * Roles: Admin
 * Fuente: 04_apis_lista.md lÃ­neas 395-463
 */
const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID vÃ¡lido'
      });
    }

    // Validar status requerido (lÃ­nea 444)
    const validStatuses = ['confirmed', 'in_progress', 'cancelled', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status es requerido y debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // cancellationReason requerido si status='cancelled' (lÃ­nea 445)
    if (status === 'cancelled' && (!cancellationReason || cancellationReason.trim() === '')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'cancellationReason es requerido cuando status es cancelled'
      });
    }

    // Buscar reserva existente
    const existingReservation = await prisma.reservations.findUnique({
      where: { id },
      include: {
        agencies: true,
        tours: true,
        guides: {
          select: {
            id: true,
            users: { select: { first_name: true, last_name: true } }
          }
        }
      }
    });

    if (!existingReservation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reserva no encontrada'
      });
    }

    // Validación especial para agencias: solo pueden CANCELAR sus propias reservas.
    // Cualquier otro cambio de estado queda reservado para admin/guía.
    if (req.user?.role === 'agency') {
      if (status !== 'cancelled') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Las agencias solo pueden cancelar reservas, no cambiar otros estados'
        });
      }
      if (req.user.agencyId && existingReservation.agency_id !== req.user.agencyId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Solo puedes cancelar reservas de tu propia agencia'
        });
      }
    }

    // Validación especial para guías: solo pueden cambiar estado de sus propios tours
    if (req.user?.role === 'guide') {
      // Buscar el perfil de guía del usuario
      const guide = await prisma.guides.findFirst({
        where: { user_id: req.user.id }
      });

      if (!guide || existingReservation.guide_id !== guide.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Solo puedes cambiar el estado de tours asignados a ti'
        });
      }

      // Guías pueden: pending|confirmed → in_progress (iniciar), in_progress → completed (finalizar)
      // Iniciar desde 'pending' auto-confirma la reserva implícitamente (admin ya asignó al guía)
      const guideAllowedTransitions = {
        'pending': ['in_progress'],
        'confirmed': ['in_progress'],
        'in_progress': ['completed']
      };

      if (!guideAllowedTransitions[existingReservation.status]?.includes(status)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Como guía, solo puedes iniciar tours pendientes o confirmados, o completar tours en progreso`
        });
      }
    }

    // Validar que tenga guía asignado si el estado requiere un guía activo
    if ((status === 'in_progress' || status === 'completed') && !existingReservation.guide_id) {
      const statusLabel = status === 'in_progress' ? 'En Progreso' : 'Completado';
      return res.status(400).json({
        error: 'Bad Request',
        message: `No se puede cambiar el estado a '${statusLabel}' sin tener un guía asignado. Por favor, asigne un guía primero usando el endpoint PUT /api/reservations/${id}/assign-guide`
      });
    }

    // Reglas de transiciÃ³n de estado (lÃ­neas 447-450)
    const currentStatus = existingReservation.status;
    const allowedTransitions = {
      'pending': ['confirmed', 'in_progress', 'cancelled'],
      'confirmed': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'cancelled': [],  // Estado final
      'completed': []   // Estado final
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(409).json({
        error: 'Conflict',
        message: `No se puede cambiar de '${currentStatus}' a '${status}'. Transiciones permitidas: ${allowedTransitions[currentStatus]?.join(', ') || 'ninguna'}`
      });
    }

    // Si el estado actual ya es el solicitado (idempotencia)
    if (currentStatus === status) {
      return res.status(200).json({
        id: existingReservation.id,
        status: existingReservation.status,
        pointsAwarded: existingReservation.pointsAwarded,
        updatedAt: existingReservation.updatedAt
      });
    }

    const userId = req.user?.id;

    // Ejecutar en transacción
    const result = await prisma.$transaction(async (tx) => {
      let pointsAwarded = existingReservation.points_awarded || 0;

      // Al confirmar reserva de agencia (o saltar pending→in_progress), calcular y asignar puntos
      const isConfirmingTransition = status === 'confirmed' ||
        (status === 'in_progress' && currentStatus === 'pending');
      if (isConfirmingTransition && existingReservation.agency_id && !existingReservation.points_awarded) {
        const pointsConfig = await getPointsConfigFromDB(tx);
        const pointsToAward = Math.floor(parseFloat(existingReservation.total_amount) * pointsConfig.pointsPerSol);

        if (pointsToAward > 0) {
          const updatedAgency = await tx.agencies.update({
            where: { id: existingReservation.agency_id },
            data: {
              available_points: { increment: pointsToAward },
              total_points: { increment: pointsToAward }
            }
          });

          await tx.points_history.create({
            data: {
              agency_id: existingReservation.agency_id,
              type: 'earned',
              amount: pointsToAward,
              description: `Puntos por reserva confirmada #${id.substring(0, 8)}`,
              reference_type: 'reservation',
              reference_id: id,
              created_by: userId
            }
          });

          // Recalcular nivel de la agencia
          await recalculateAgencyLevel(tx, existingReservation.agency_id, updatedAgency.total_points, pointsConfig.levels);

          pointsAwarded = pointsToAward;
        }
      }

      // Al iniciar tour (in_progress), crear registro en active_tours para habilitar tracking
      if (status === 'in_progress') {
        // Verificar si ya existe un active_tour para esta reserva
        const existingActiveTour = await tx.active_tours.findUnique({
          where: { reservation_id: id }
        });

        if (!existingActiveTour) {
          // Crear nuevo registro de tour activo
          await tx.active_tours.create({
            data: {
              reservation_id: id,
              guide_id: existingReservation.guide_id,
              status: 'in_progress',
              current_stop_index: 0,
              started_at: new Date()
            }
          });
          console.log(`[TOUR] Active tour creado para reserva ${id.substring(0, 8)}`);
        } else {
          // Actualizar el tour existente
          await tx.active_tours.update({
            where: { reservation_id: id },
            data: {
              status: 'in_progress',
              started_at: existingActiveTour.started_at || new Date()
            }
          });
          console.log(`[TOUR] Active tour actualizado para reserva ${id.substring(0, 8)}`);
        }
      }

      // Al completar tour, actualizar active_tours con ended_at
      if (status === 'completed') {
        const activeTour = await tx.active_tours.findUnique({
          where: { reservation_id: id }
        });

        if (activeTour) {
          await tx.active_tours.update({
            where: { reservation_id: id },
            data: {
              status: 'completed',
              ended_at: new Date()
            }
          });
          console.log(`[TOUR] Tour completado para reserva ${id.substring(0, 8)}`);
        }
      }

      // Al cancelar, también marcar active_tours como cancelado si existe
      if (status === 'cancelled') {
        const activeTour = await tx.active_tours.findUnique({
          where: { reservation_id: id }
        });

        if (activeTour) {
          await tx.active_tours.update({
            where: { reservation_id: id },
            data: {
              status: 'cancelled',
              ended_at: new Date()
            }
          });
          console.log(`[TOUR] Tour cancelado para reserva ${id.substring(0, 8)}`);
        }
      }

      // Construir datos de actualización
      const updateData = {
        status,
        points_awarded: pointsAwarded
      };

      // Si es cancelaciÃ³n, guardar el motivo en notes
      if (status === 'cancelled' && cancellationReason) {
        const existingNotes = existingReservation.notes || '';
        updateData.notes = existingNotes
          ? `${existingNotes}\n[CANCELACIÃ“N] ${cancellationReason}`
          : `[CANCELACIÃ“N] ${cancellationReason}`;
      }

      // Actualizar reserva
      const updatedReservation = await tx.reservations.update({
        where: { id },
        data: updateData
      });

      return { ...updatedReservation, points_awarded: pointsAwarded };
    });

    // Response según esquema ReservationStatusResult (líneas 426-432)
    return res.status(200).json({
      id: result.id,
      status: result.status,
      pointsAwarded: result.points_awarded,
      updatedAt: result.updated_at
    });

  } catch (error) {
    console.error('Error en updateReservationStatus:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar el estado de la reserva'
    });
  }
};

/**
 * API-006: ExportReservations
 * GET /api/reservations/export
 * Exporta reservas filtradas a formato Excel/CSV
 * Roles: Admin, Agency
 * Fuente: 04_apis_lista.md lÃ­neas 464-555
 */
const exportReservations = async (req, res) => {
  try {
    const {
      status,
      dateFrom,
      dateTo,
      guideId,
      format = 'xlsx'
    } = req.query;

    // Validaciones
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom debe ser menor o igual a dateTo'
      });
    }

    // Construir filtros WHERE
    const where = {};

    // Filtro por rol (lÃ­neas 543-544)
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === 'agency') {
      const agency = await prisma.agencies.findUnique({
        where: { user_id: userId }
      });
      if (agency) {
        where.agency_id = agency.id;
      } else {
        return res.status(200).json({ data: [], message: 'Sin reservas para exportar' });
      }
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = parseLocalDate(dateFrom);
      if (dateTo) where.date.lte = parseLocalDate(dateTo);
    }

    if (guideId) {
      where.guideId = guideId;
    }

    // Obtener reservas (limite 10,000 - linea 541)
    const reservations = await prisma.reservations.findMany({
      where,
      take: 10000,
      orderBy: { date: 'desc' },
      include: {
        tours: { select: { name: true, tour_type: true } },
        agencies: { select: { business_name: true, agency_phone: true, agency_email: true } },
        guides: {
          select: {
            users: { select: { first_name: true, last_name: true } }
          }
        }
      }
    });

    // Mapas de traducción para exportación
    const statusLabels = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      in_progress: 'En Progreso',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    const paymentStatusLabels = {
      pending: 'Pendiente',
      paid: 'Pagado',
      partial: 'Parcial',
      refunded: 'Reembolsado',
      failed: 'Fallido'
    };
    const paymentMethodLabels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      yape: 'Yape',
      plin: 'Plin',
      paypal: 'PayPal'
    };

    // Preparar datos para exportacion
    const exportData = reservations.map(r => ({
      ID: r.id ? r.id.substring(0, 8).toUpperCase() : '',
      Fecha: formatLocalDate(r.date) || '',
      Hora: r.time ? new Date(r.time).toISOString().substring(11, 16) : '',
      Tour: r.tours?.name || '',
      TipoTour: r.tours?.tour_type || '',
      Agencia: r.agencies?.business_name || '',
      TelefonoAgencia: r.agencies?.agency_phone || '',
      EmailAgencia: r.agencies?.agency_email || '',
      Adultos: r.adults,
      Ninos: r.children,
      TotalPasajeros: r.participants,
      Estado: statusLabels[r.status] || r.status || 'Desconocido',
      MontoTotal: `S/. ${(parseFloat(r.total_amount) || 0).toFixed(2)}`,
      MetodoPago: paymentMethodLabels[r.payment_method] || r.payment_method || 'No especificado',
      EstadoPago: paymentStatusLabels[r.payment_status] || r.payment_status || 'Desconocido',
      Guia: r.guides?.users ? `${r.guides.users.first_name} ${r.guides.users.last_name}` : 'Sin asignar',
      LugarRecojo: r.pickup_location || '',
      FechaCreacion: formatLocalDate(r.created_at) || ''
    }));

    // Si formato CSV
    if (format === 'csv') {
      const headers = Object.keys(exportData[0] || {}).join(',');
      const rows = exportData.map(row =>
        Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      const filename = `reservas_${dateFrom || 'inicio'}_${dateTo || 'fin'}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    // Formato JSON (simplificado, sin librerÃ­a xlsx)
    const filename = `reservas_${dateFrom || 'inicio'}_${dateTo || 'fin'}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.json({
      exportedAt: new Date().toISOString(),
      totalRecords: exportData.length,
      filters: { status, dateFrom, dateTo, guideId },
      data: exportData
    });

  } catch (error) {
    console.error('Error en exportReservations:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al exportar reservas'
    });
  }
};

/**
 * API-007: AssignGuideToReservation
 * PATCH /api/reservations/:id/assign-guide
 * Asigna un guÃ­a a una reserva
 * Roles: Admin
 * Fuente: 04_apis_lista.md lÃ­neas 556-618
 */
const assignGuideToReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const { guideId } = req.body;

    // Validar UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID vÃ¡lido'
      });
    }

    // guideId puede ser null para desasignar
    if (guideId && !uuidRegex.test(guideId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId debe ser un UUID vÃ¡lido'
      });
    }

    // Verificar que la reserva existe
    const reservation = await prisma.reservations.findUnique({
      where: { id }
    });

    if (!reservation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reserva no encontrada'
      });
    }

    // Si se proporciona guideId, verificar que el guÃ­a existe
    if (guideId) {
      const guide = await prisma.guides.findUnique({
        where: { id: guideId }
      });

      if (!guide) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'GuÃ­a no encontrado'
        });
      }
    }

    // Actualizar reserva
    const updatedReservation = await prisma.reservations.update({
      where: { id },
      data: { guide_id: guideId || null },
      include: {
        tours: { select: { id: true, name: true } },
        guides: {
          select: {
            id: true,
            users: { select: { first_name: true, last_name: true } }
          }
        }
      }
    });

    return res.status(200).json({
      id: updatedReservation.id,
      guideId: updatedReservation.guide_id,
      guide: updatedReservation.guides ? {
        id: updatedReservation.guides.id,
        firstName: updatedReservation.guides.users?.first_name,
        lastName: updatedReservation.guides.users?.last_name
      } : null,
      updatedAt: updatedReservation.updated_at
    });

  } catch (error) {
    console.error('Error en assignGuideToReservation:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al asignar guÃ­a'
    });
  }
};

/**
 * API-108: BulkUpdateReservationStatus
 * POST /api/reservations/bulk-status
 * Actualiza el estado de mÃºltiples reservas en lote
 * Roles: Admin
 * Fuente: 04_apis_lista.md lÃ­nea 7428
 */
const bulkUpdateReservationStatus = async (req, res) => {
  try {
    const { reservationIds, newStatus, reason } = req.body;

    // Validar reservationIds (requerido, array, max 100)
    if (!reservationIds || !Array.isArray(reservationIds)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'reservationIds es requerido y debe ser un array'
      });
    }

    if (reservationIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'reservationIds no puede estar vacÃ­o'
      });
    }

    if (reservationIds.length > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El mÃ¡ximo de reservas por lote es 100'
      });
    }

    // Validar newStatus
    const validStatuses = ['confirmed', 'in_progress', 'cancelled', 'completed'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `newStatus es requerido y debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // Validar UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = reservationIds.filter(id => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `IDs invÃ¡lidos: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''}`
      });
    }

    // reason requerido si newStatus es cancelled
    if (newStatus === 'cancelled' && (!reason || reason.trim() === '')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'reason es requerido cuando newStatus es cancelled'
      });
    }

    const userId = req.user?.id;
    const results = {
      success: [],
      failed: []
    };

    // Reglas de transiciÃ³n de estado
    const allowedTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'cancelled': [],
      'completed': []
    };

    // Leer config de puntos una vez antes del loop
    const pointsConfig = await getPointsConfigFromDB();

    // Procesar cada reserva en transacciÃ³n
    await prisma.$transaction(async (tx) => {
      for (const reservationId of reservationIds) {
        try {
          // Buscar reserva
          const reservation = await tx.reservations.findUnique({
            where: { id: reservationId },
            include: {
              agencies: true,
              tours: true
            }
          });

          if (!reservation) {
            results.failed.push({
              id: reservationId,
              error: 'Reserva no encontrada'
            });
            continue;
          }

          // Validar transiciÃ³n de estado
          const currentStatus = reservation.status;
          if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
            results.failed.push({
              id: reservationId,
              error: `No se puede cambiar de '${currentStatus}' a '${newStatus}'`
            });
            continue;
          }

          // Validar que tenga guía asignado si el estado requiere un guía activo
          if ((newStatus === 'in_progress' || newStatus === 'completed') && !reservation.guide_id) {
            const statusLabel = newStatus === 'in_progress' ? 'En Progreso' : 'Completado';
            results.failed.push({
              id: reservationId,
              error: `No se puede cambiar a '${statusLabel}' sin guía asignado`
            });
            continue;
          }

          // Construir datos de actualización
          const updateData = { status: newStatus };
          let pointsAwarded = reservation.points_awarded || 0;

          // Si es confirmación y tiene agencia, asignar puntos desde points_config
          if (newStatus === 'confirmed' && reservation.agency_id && !reservation.points_awarded) {
            const pointsToAward = Math.floor(parseFloat(reservation.total_amount) * pointsConfig.pointsPerSol);
            if (pointsToAward > 0) {
              const updatedAgency = await tx.agencies.update({
                where: { id: reservation.agency_id },
                data: {
                  available_points: { increment: pointsToAward },
                  total_points: { increment: pointsToAward }
                }
              });

              await tx.points_history.create({
                data: {
                  agency_id: reservation.agency_id,
                  type: 'earned',
                  amount: pointsToAward,
                  description: `Puntos por reserva confirmada (bulk) #${reservationId.substring(0, 8)}`,
                  reference_type: 'reservation',
                  reference_id: reservationId,
                  created_by: userId
                }
              });

              await recalculateAgencyLevel(tx, reservation.agency_id, updatedAgency.total_points, pointsConfig.levels);

              pointsAwarded = pointsToAward;
              updateData.points_awarded = pointsAwarded;
            }
          }

          // Si es cancelaciÃ³n, guardar motivo
          if (newStatus === 'cancelled' && reason) {
            const existingNotes = reservation.notes || '';
            updateData.notes = existingNotes
              ? `${existingNotes}\n[CANCELACIÃ“N BULK] ${reason}`
              : `[CANCELACIÃ“N BULK] ${reason}`;
          }

          // Actualizar reserva
          await tx.reservations.update({
            where: { id: reservationId },
            data: updateData
          });

          results.success.push({
            id: reservationId,
            previousStatus: currentStatus,
            newStatus,
            pointsAwarded: pointsAwarded || 0
          });

        } catch (error) {
          results.failed.push({
            id: reservationId,
            error: error.message || 'Error desconocido'
          });
        }
      }
    });

    // Response
    return res.status(200).json({
      success: true,
      processed: reservationIds.length,
      updated: results.success.length,
      failed: results.failed.length,
      results: {
        success: results.success,
        failed: results.failed
      }
    });

  } catch (error) {
    console.error('Error en bulkUpdateReservationStatus:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar reservas en lote'
    });
  }
};

/**
 * GET /api/reservations/stats
 * Obtiene estadísticas de reservaciones
 * Roles: Admin, Agency
 */
const getReservationStats = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const where = {};

    // Filtro por rol
    if (userRole === 'agency') {
      const agency = await prisma.agencies.findUnique({
        where: { user_id: userId }
      });
      if (agency) {
        where.agency_id = agency.id;
      }
    }

    // Filtro por fechas (usando utilidad que maneja timezone correctamente)
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = parseLocalDate(dateFrom);
      if (dateTo) where.date.lte = parseLocalDate(dateTo);
    }

    // Estadísticas
    const [total, pending, confirmed, completed, cancelled, revenue] = await Promise.all([
      prisma.reservations.count({ where }),
      prisma.reservations.count({ where: { ...where, status: 'pending' } }),
      prisma.reservations.count({ where: { ...where, status: 'confirmed' } }),
      prisma.reservations.count({ where: { ...where, status: 'completed' } }),
      prisma.reservations.count({ where: { ...where, status: 'cancelled' } }),
      prisma.reservations.aggregate({
        where: { ...where, status: { in: ['confirmed', 'completed'] } },
        _sum: { total_amount: true }
      })
    ]);

    // Estadísticas por tour
    const byTour = await prisma.reservations.groupBy({
      by: ['tour_id'],
      where,
      _count: { id: true },
      _sum: { participants: true }
    });

    return res.status(200).json({
      success: true,
      data: {
        total,
        byStatus: { pending, confirmed, completed, cancelled },
        revenue: revenue._sum.total_amount || 0,
        byTour: byTour.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Error en getReservationStats:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener estadísticas'
    });
  }
};

/**
 * GET /api/reservations/search
 * Busca reservaciones por término
 * Roles: Admin, Agency, Guide
 */
const searchReservations = async (req, res) => {
  try {
    const { q, status, limit = 20 } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El término de búsqueda debe tener al menos 2 caracteres'
      });
    }

    const where = {
      OR: [
        { agencies: { business_name: { contains: q, mode: 'insensitive' } } },
        { tours: { name: { contains: q, mode: 'insensitive' } } },
        { billing_name: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } }
      ]
    };

    if (status && status !== 'all') where.status = status;

    // Filtro por rol
    if (userRole === 'agency') {
      const agency = await prisma.agencies.findUnique({ where: { user_id: userId } });
      if (agency) where.agency_id = agency.id;
    } else if (userRole === 'guide') {
      const guide = await prisma.guides.findUnique({ where: { user_id: userId } });
      if (guide) where.guide_id = guide.id;
    }

    const reservations = await prisma.reservations.findMany({
      where,
      take: parseInt(limit),
      orderBy: { date: 'desc' },
      include: {
        tours: { select: { id: true, name: true } },
        agencies: { select: { id: true, business_name: true, agency_phone: true } }
      }
    });

    return res.status(200).json({
      success: true,
      data: reservations.map(r => ({
        id: r.id,
        date: r.date,
        status: r.status,
        tour: r.tours,
        agency: r.agencies ? {
          id: r.agencies.id,
          businessName: r.agencies.business_name,
          phone: r.agencies.agency_phone
        } : null,
        billingName: r.billing_name,
        participants: r.participants
      }))
    });
  } catch (error) {
    console.error('Error en searchReservations:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al buscar reservaciones'
    });
  }
};

/**
 * GET /api/reservations/:id/voucher
 * Genera datos del voucher para una reservación
 * Roles: Admin, Agency
 */
const getVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservations.findUnique({
      where: { id },
      include: {
        tours: true,
        guides: { include: { users: { select: { first_name: true, last_name: true } } } },
        agencies: true,
        reservation_groups: { orderBy: { sort_order: 'asc' } }
      }
    });

    if (!reservation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reservación no encontrada'
      });
    }

    const voucher = {
      voucherNumber: `VCH-${reservation.id.substring(0, 8).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      reservation: {
        id: reservation.id,
        date: reservation.date,
        time: reservation.time,
        status: reservation.status,
        adults: reservation.adults,
        children: reservation.children,
        totalAmount: reservation.total_amount,
        pickupLocation: reservation.pickup_location,
        specialRequirements: reservation.special_requirements,
        groups: (reservation.reservation_groups || []).map(g => ({
          representativeName: g.representative_name,
          representativePhone: g.representative_phone,
          adultsCount: g.adults_count,
          childrenCount: g.children_count
        }))
      },
      tour: reservation.tours ? {
        name: reservation.tours.name,
        duration: reservation.tours.duration,
        meetingPoint: reservation.tours.meeting_point
      } : null,
      billingName: reservation.billing_name,
      guide: reservation.guides ? {
        name: `${reservation.guides.users?.first_name} ${reservation.guides.users?.last_name}`.trim()
      } : null,
      agency: reservation.agencies ? {
        name: reservation.agencies.business_name,
        phone: reservation.agencies.agency_phone
      } : null
    };

    return res.status(200).json({
      success: true,
      data: voucher
    });
  } catch (error) {
    console.error('Error en getVoucher:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al generar voucher'
    });
  }
};

/**
 * POST /api/reservations/:id/duplicate
 * Duplica una reservación existente
 * Roles: Admin, Agency
 */
const duplicateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;

    const original = await prisma.reservations.findUnique({
      where: { id },
      include: {
        reservation_groups: {
          orderBy: { sort_order: 'asc' }
        }
      }
    });

    if (!original) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Reservación no encontrada'
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newReservation = await tx.reservations.create({
        data: {
          tour_id: original.tour_id,
          agency_id: original.agency_id,
          date: date ? parseLocalDate(date) : original.date,
          time: time || original.time,
          adults: original.adults,
          children: original.children,
          participants: original.participants,
          pickup_location: original.pickup_location,
          special_requirements: original.special_requirements,
          status: 'pending',
          total_amount: original.total_amount,
          payment_method: original.payment_method,
          payment_status: 'pending',
          billing_name: original.billing_name,
          billing_document: original.billing_document,
          billing_address: original.billing_address,
          notes: `Duplicado de reservación ${id.substring(0, 8)}`
        }
      });

      // Duplicar grupos
      if (original.reservation_groups && original.reservation_groups.length > 0) {
        for (const g of original.reservation_groups) {
          await tx.reservation_groups.create({
            data: {
              reservation_id: newReservation.id,
              representative_name: g.representative_name,
              representative_phone: g.representative_phone,
              adults_count: g.adults_count,
              children_count: g.children_count,
              sort_order: g.sort_order
            }
          });
        }
      }

      return newReservation;
    });

    return res.status(201).json({
      success: true,
      data: { id: result.id, originalId: id }
    });
  } catch (error) {
    console.error('Error en duplicateReservation:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al duplicar reservación'
    });
  }
};

/**
 * POST /api/reservations/check-availability
 * Verifica disponibilidad para una reservación
 * Roles: Admin, Agency
 */
const checkAvailability = async (req, res) => {
  try {
    const { tourId, date, time, participants } = req.body;

    if (!tourId || !date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tourId y date son requeridos'
      });
    }

    const tour = await prisma.tours.findUnique({
      where: { id: tourId }
    });

    if (!tour) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    // Contar reservaciones existentes para esa fecha
    const existingReservations = await prisma.reservations.aggregate({
      where: {
        tour_id: tourId,
        date: parseLocalDate(date),
        status: { in: ['pending', 'confirmed'] }
      },
      _sum: { participants: true }
    });

    const currentParticipants = existingReservations._sum.participants || 0;
    const maxCapacity = tour.max_capacity || 999;
    const requestedParticipants = participants || 1;
    const availableSpots = maxCapacity - currentParticipants;
    const isAvailable = availableSpots >= requestedParticipants;

    return res.status(200).json({
      success: true,
      data: {
        tourId,
        date,
        maxCapacity,
        currentParticipants,
        availableSpots,
        requestedParticipants,
        isAvailable
      }
    });
  } catch (error) {
    console.error('Error en checkAvailability:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al verificar disponibilidad'
    });
  }
};

/**
 * GET /api/reservations/available-tours
 * Obtiene tours disponibles para una fecha
 * Roles: Admin, Agency
 */
const getAvailableTours = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'date es requerido'
      });
    }

    const tours = await prisma.tours.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        price: true,
        max_capacity: true,
        duration: true
      }
    });

    // Calcular disponibilidad para cada tour
    const toursWithAvailability = await Promise.all(
      tours.map(async (tour) => {
        const reserved = await prisma.reservations.aggregate({
          where: {
            tour_id: tour.id,
            date: parseLocalDate(date),
            status: { in: ['pending', 'confirmed'] }
          },
          _sum: { participants: true }
        });

        const currentParticipants = reserved._sum.participants || 0;
        const availableSpots = (tour.max_capacity || 999) - currentParticipants;

        return {
          ...tour,
          currentParticipants,
          availableSpots,
          isAvailable: availableSpots > 0
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: toursWithAvailability.filter(t => t.isAvailable)
    });
  } catch (error) {
    console.error('Error en getAvailableTours:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener tours disponibles'
    });
  }
};

/**
 * GetExecutionHistory
 * GET /api/reservations/:id/execution-history
 * Obtiene el historial completo de ejecución de un servicio
 * Incluye: progreso de paradas, fotos, notas del guía
 * Roles: Admin, Agency
 */
const getExecutionHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'ID de reservación inválido'
      });
    }

    // Obtener la reservación con su tour activo
    const reservation = await prisma.reservations.findUnique({
      where: { id },
      include: {
        tours: {
          include: {
            tour_stops: {
              orderBy: { order_num: 'asc' }
            }
          }
        },
        guides: {
          include: {
            users: {
              select: { id: true, first_name: true, last_name: true }
            }
          }
        },
        agencies: {
          select: { id: true, business_name: true }
        },
        active_tours: {
          include: {
            tour_progress: {
              include: {
                tour_stops: true
              },
              orderBy: { arrived_at: 'asc' }
            },
            tour_photos: {
              include: {
                users: {
                  select: { id: true, first_name: true, last_name: true }
                },
                tour_stops: {
                  select: { id: true, name: true }
                }
              },
              orderBy: { taken_at: 'asc' }
            }
          }
        }
      }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reservación no encontrada'
      });
    }

    // Verificar permisos por rol
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (userRole === 'agency') {
      const agency = await prisma.agencies.findUnique({ where: { user_id: userId } });
      if (!agency || reservation.agency_id !== agency.id) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'No tienes acceso a esta reservación'
        });
      }
    }

    const activeTour = reservation.active_tours;
    const tourStops = reservation.tours?.tour_stops || [];

    // Construir timeline de ejecución
    let executionTimeline = [];

    if (activeTour) {
      // Agregar inicio del tour
      if (activeTour.started_at) {
        executionTimeline.push({
          type: 'tour_start',
          timestamp: activeTour.started_at,
          title: 'Tour iniciado',
          description: `El guía inició el servicio`
        });
      }

      // Agregar progreso de paradas
      const progressByStop = new Map(
        (activeTour.tour_progress || []).map(p => [p.tour_stop_id, p])
      );

      for (const stop of tourStops) {
        const progress = progressByStop.get(stop.id);

        if (progress?.arrived_at) {
          executionTimeline.push({
            type: 'stop_checkin',
            timestamp: progress.arrived_at,
            title: `Check-in: ${stop.name}`,
            description: stop.description || '',
            stopId: stop.id,
            stopOrder: stop.order_num,
            notes: progress.notes || null
          });
        }

        if (progress?.departed_at) {
          executionTimeline.push({
            type: 'stop_checkout',
            timestamp: progress.departed_at,
            title: `Check-out: ${stop.name}`,
            description: `Parada completada`,
            stopId: stop.id,
            stopOrder: stop.order_num
          });
        }
      }

      // Agregar fotos al timeline
      for (const photo of (activeTour.tour_photos || [])) {
        executionTimeline.push({
          type: 'photo',
          timestamp: photo.taken_at,
          title: photo.caption || 'Foto del tour',
          description: photo.tour_stops ? `En: ${photo.tour_stops.name}` : 'Foto general',
          photoId: photo.id,
          photoUrl: photo.photo_url,
          stopId: photo.tour_stop_id,
          takenBy: photo.users
            ? `${photo.users.first_name || ''} ${photo.users.last_name || ''}`.trim()
            : null
        });
      }

      // Agregar fin del tour
      if (activeTour.ended_at) {
        executionTimeline.push({
          type: 'tour_end',
          timestamp: activeTour.ended_at,
          title: 'Tour finalizado',
          description: `Servicio completado exitosamente`
        });
      }

      // Ordenar por timestamp
      executionTimeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Construir resumen de paradas
    const stopsProgress = tourStops.map(stop => {
      const progress = activeTour?.tour_progress?.find(p => p.tour_stop_id === stop.id);
      const photos = (activeTour?.tour_photos || []).filter(p => p.tour_stop_id === stop.id);

      return {
        id: stop.id,
        name: stop.name,
        orderNum: stop.order_num,
        duration: stop.duration,
        description: stop.description,
        status: progress?.status || 'pending',
        arrivedAt: progress?.arrived_at || null,
        departedAt: progress?.departed_at || null,
        notes: progress?.notes || null,
        photos: photos.map(p => ({
          id: p.id,
          url: p.photo_url,
          caption: p.caption,
          takenAt: p.taken_at
        }))
      };
    });

    // Calcular estadísticas
    const completedStops = stopsProgress.filter(s => s.status === 'completed').length;
    const totalStops = stopsProgress.length;
    const totalPhotos = activeTour?.tour_photos?.length || 0;

    let durationMinutes = null;
    if (activeTour?.started_at && activeTour?.ended_at) {
      durationMinutes = Math.round(
        (new Date(activeTour.ended_at) - new Date(activeTour.started_at)) / 60000
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        reservation: {
          id: reservation.id,
          date: reservation.date,
          time: reservation.time,
          status: reservation.status,
          participants: reservation.participants
        },
        tour: {
          id: reservation.tours?.id,
          name: reservation.tours?.name,
          duration: reservation.tours?.duration
        },
        guide: reservation.guides ? {
          id: reservation.guides.id,
          name: `${reservation.guides.users?.first_name || ''} ${reservation.guides.users?.last_name || ''}`.trim()
        } : null,
        agency: reservation.agencies ? {
          id: reservation.agencies.id,
          name: reservation.agencies.business_name
        } : null,
        execution: activeTour ? {
          id: activeTour.id,
          status: activeTour.status,
          startedAt: activeTour.started_at,
          endedAt: activeTour.ended_at,
          durationMinutes
        } : null,
        stats: {
          completedStops,
          totalStops,
          completionRate: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
          totalPhotos
        },
        stops: stopsProgress,
        timeline: executionTimeline,
        photos: (activeTour?.tour_photos || []).map(p => ({
          id: p.id,
          url: p.photo_url,
          caption: p.caption,
          stopId: p.tour_stop_id,
          stopName: p.tour_stops?.name,
          takenAt: p.taken_at,
          takenBy: p.users
            ? `${p.users.first_name || ''} ${p.users.last_name || ''}`.trim()
            : null
        }))
      }
    });
  } catch (error) {
    console.error('Error en getExecutionHistory:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener historial de ejecución'
    });
  }
};

module.exports = {
  listReservations,
  getReservation,
  createReservation,
  updateReservation,
  updateReservationStatus,
  exportReservations,
  assignGuideToReservation,
  bulkUpdateReservationStatus,
  getReservationStats,
  searchReservations,
  getVoucher,
  duplicateReservation,
  checkAvailability,
  getAvailableTours,
  getExecutionHistory
};
