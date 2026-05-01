// Controller de Drivers
// Soporta ELM-039 (AssignmentManager) y gestión de choferes
// TBL-022: drivers

const prisma = require('../config/db');
const { parseLocalDate, formatLocalDate, toLocalISOString } = require('../utils/dateUtils');

/**
 * Mapea un driver de Prisma a formato de respuesta con fechas correctas
 * - license_expiry (DATE): se formatea como YYYY-MM-DD via formatLocalDate
 * - created_at/updated_at (TIMESTAMPTZ): se formatean en America/Lima via toLocalISOString
 */
const mapDriverResponse = (driver) => ({
  id: driver.id,
  firstName: driver.first_name,
  lastName: driver.last_name,
  first_name: driver.first_name,
  last_name: driver.last_name,
  name: `${driver.first_name} ${driver.last_name}`,
  fullName: `${driver.first_name} ${driver.last_name}`,
  documentType: driver.document_type,
  documentNumber: driver.document_number,
  dni: driver.document_number,
  phone: driver.phone,
  phoneNumber: driver.phone,
  email: driver.email,
  licenseNumber: driver.license_number,
  license_number: driver.license_number,
  license: driver.license_number,
  licenseCategory: driver.license_category,
  license_type: driver.license_category,
  // DATE: formatear como YYYY-MM-DD para evitar desfase de timezone
  licenseExpiry: formatLocalDate(driver.license_expiry),
  license_expiry: formatLocalDate(driver.license_expiry),
  photoUrl: driver.photo_url,
  photo: driver.photo_url,
  avatar: driver.photo_url,
  status: driver.status,
  // TIMESTAMPTZ: formatear en America/Lima para mostrar hora local real
  createdAt: toLocalISOString(driver.created_at),
  updatedAt: toLocalISOString(driver.updated_at)
});

/**
 * GET /api/drivers
 * Lista paginada de choferes con filtros
 * Roles: Admin
 */
const listDrivers = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      status,
      licenseCategory,
      search
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    if (pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'page debe ser >= 1'
      });
    }

    if (pageSizeNum < 1 || pageSizeNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'pageSize debe estar entre 1 y 100'
      });
    }

    // Construir filtros WHERE (usando snake_case del schema Prisma)
    const where = {};

    // Filtro por status (default: active)
    if (status) {
      where.status = status;
    } else {
      where.status = 'active';
    }

    // Filtro por license_category
    if (licenseCategory) {
      where.license_category = licenseCategory;
    }

    // Filtro de búsqueda (usando nombres snake_case del schema)
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { document_number: { contains: search, mode: 'insensitive' } },
        { license_number: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (pageNum - 1) * pageSizeNum;

    // Usar prisma.drivers (plural, como en el schema)
    const [driversData, total] = await Promise.all([
      prisma.drivers.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { created_at: 'desc' }
      }),
      prisma.drivers.count({ where })
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);

    // Mapear respuesta con fechas correctamente formateadas
    const items = driversData.map(mapDriverResponse);

    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Error en listDrivers:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener los choferes'
    });
  }
};

/**
 * GET /api/drivers/:id
 * Detalle de un chofer
 * Roles: Admin
 */
const getDriver = async (req, res) => {
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

    // Usar prisma.drivers (plural, como en el schema)
    const driver = await prisma.drivers.findUnique({
      where: { id },
      include: {
        tour_assignments: {
          take: 10,
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Chofer no encontrado'
      });
    }

    // Mapear con fechas correctamente formateadas
    return res.status(200).json({
      success: true,
      data: {
        ...mapDriverResponse(driver),
        recentAssignments: driver.tour_assignments
      }
    });

  } catch (error) {
    console.error('Error en getDriver:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener el chofer'
    });
  }
};

/**
 * POST /api/drivers
 * Crear nuevo chofer
 * Roles: Admin
 */
const createDriver = async (req, res) => {
  try {
    console.log('📝 createDriver - Body recibido:', JSON.stringify(req.body, null, 2));

    // Soportar tanto camelCase (frontend) como snake_case
    const {
      firstName, first_name,
      lastName, last_name,
      documentType = 'DNI', document_type,
      documentNumber, document_number, dni,
      phone,
      email,
      licenseNumber, license_number,
      licenseCategory, license_category,
      licenseExpiry, license_expiry,
      photoUrl, photo_url
    } = req.body;

    // Normalizar campos (priorizar camelCase del frontend)
    const normalizedFirstName = firstName || first_name;
    const normalizedLastName = lastName || last_name;
    const normalizedDocType = documentType || document_type || 'DNI';
    const normalizedDocNumber = documentNumber || document_number || dni;
    const normalizedLicenseNumber = licenseNumber || license_number;
    const normalizedLicenseCategory = licenseCategory || license_category;
    const normalizedLicenseExpiry = licenseExpiry || license_expiry;
    const normalizedPhotoUrl = photoUrl || photo_url;

    // Validaciones requeridas
    if (!normalizedFirstName || !normalizedLastName || !normalizedDocNumber || !normalizedLicenseNumber || !normalizedLicenseCategory) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'firstName, lastName, documentNumber, licenseNumber y licenseCategory son requeridos'
      });
    }

    // Verificar document_number único (usar snake_case para Prisma)
    const existingDoc = await prisma.drivers.findUnique({
      where: { document_number: normalizedDocNumber }
    });
    if (existingDoc) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe un chofer con ese número de documento'
      });
    }

    // Verificar license_number único
    const existingLicense = await prisma.drivers.findUnique({
      where: { license_number: normalizedLicenseNumber }
    });
    if (existingLicense) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe un chofer con ese número de licencia'
      });
    }

    // Crear con snake_case (como espera Prisma segun el schema)
    const driver = await prisma.drivers.create({
      data: {
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        document_type: normalizedDocType,
        document_number: normalizedDocNumber,
        phone,
        email,
        license_number: normalizedLicenseNumber,
        license_category: normalizedLicenseCategory,
        license_expiry: normalizedLicenseExpiry ? parseLocalDate(normalizedLicenseExpiry) : null,
        photo_url: normalizedPhotoUrl,
        status: 'active'
      }
    });

    // Responder con fechas correctamente formateadas
    return res.status(201).json({
      success: true,
      message: 'Chofer creado exitosamente',
      data: mapDriverResponse(driver)
    });

  } catch (error) {
    console.error('Error en createDriver:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear el chofer'
    });
  }
};

/**
 * PUT /api/drivers/:id
 * Actualizar chofer
 * Roles: Admin
 */
const updateDriver = async (req, res) => {
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

    // Usar prisma.drivers (plural)
    const existing = await prisma.drivers.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Chofer no encontrado'
      });
    }

    // Preparar datos para actualizar (convertir camelCase a snake_case para Prisma)
    const data = {};

    // Soportar ambos formatos
    const firstName = updateData.firstName || updateData.first_name;
    const lastName = updateData.lastName || updateData.last_name;
    const documentType = updateData.documentType || updateData.document_type;
    const documentNumber = updateData.documentNumber || updateData.document_number || updateData.dni;
    const licenseNumber = updateData.licenseNumber || updateData.license_number;
    const licenseCategory = updateData.licenseCategory || updateData.license_category;
    const licenseExpiry = updateData.licenseExpiry || updateData.license_expiry;
    const photoUrl = updateData.photoUrl || updateData.photo_url;

    if (firstName) data.first_name = firstName;
    if (lastName) data.last_name = lastName;
    if (documentType) data.document_type = documentType;
    if (documentNumber) data.document_number = documentNumber;
    if (updateData.phone !== undefined) data.phone = updateData.phone;
    if (updateData.email !== undefined) data.email = updateData.email;
    if (licenseNumber) data.license_number = licenseNumber;
    if (licenseCategory) data.license_category = licenseCategory;
    if (licenseExpiry !== undefined) {
      const parsedDate = licenseExpiry ? parseLocalDate(licenseExpiry) : null;
      console.log('🔍 DEBUG fecha licencia:', {
        entrada: licenseExpiry,
        parseada: parsedDate,
        isoString: parsedDate?.toISOString()
      });
      data.license_expiry = parsedDate;
    }
    if (photoUrl !== undefined) data.photo_url = photoUrl;
    if (updateData.status) data.status = updateData.status;

    const driver = await prisma.drivers.update({
      where: { id },
      data
    });

    // Responder con fechas correctamente formateadas
    return res.status(200).json({
      success: true,
      message: 'Chofer actualizado exitosamente',
      data: mapDriverResponse(driver)
    });

  } catch (error) {
    console.error('Error en updateDriver:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar el chofer'
    });
  }
};

/**
 * DELETE /api/drivers/:id
 * Eliminar chofer (soft delete - cambiar status a inactive)
 * Roles: Admin
 */
const deleteDriver = async (req, res) => {
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

    // Usar prisma.drivers (plural, segun schema)
    const existing = await prisma.drivers.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Chofer no encontrado'
      });
    }

    // Soft delete
    await prisma.drivers.update({
      where: { id },
      data: { status: 'inactive' }
    });

    return res.status(200).json({
      success: true,
      message: 'Chofer eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteDriver:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar el chofer'
    });
  }
};

/**
 * GET /api/drivers/available
 * Obtener choferes disponibles para una fecha (verificando que no tengan otra asignacion)
 * Roles: Admin
 */
const getAvailableDrivers = async (req, res) => {
  try {
    const { date, vehicleType, excludeReservationId } = req.query;

    // Obtener todos los choferes activos
    const allDrivers = await prisma.drivers.findMany({
      where: { status: 'active' },
      orderBy: { first_name: 'asc' }
    });

    // Si hay fecha, verificar disponibilidad real
    let busyDriverIds = new Set();
    if (date) {
      // Usar parseLocalDate para evitar desfase de timezone en columnas DATE
      const targetDate = parseLocalDate(date);
      if (targetDate) {
        // Buscar asignaciones existentes para esa fecha exacta
        const existingAssignments = await prisma.tour_assignments.findMany({
          where: {
            driver_id: { not: null },
            reservations: {
              date: targetDate,
              status: { in: ['pending', 'confirmed', 'active'] }
            },
            // Excluir la reserva actual si se esta editando
            ...(excludeReservationId && { reservation_id: { not: excludeReservationId } })
          },
          select: { driver_id: true }
        });

        busyDriverIds = new Set(existingAssignments.map(a => a.driver_id));
      }
    }

    // Mapear choferes con informacion de disponibilidad
    const items = allDrivers.map(driver => {
      const isBusy = busyDriverIds.has(driver.id);
      return {
        id: driver.id,
        firstName: driver.first_name,
        lastName: driver.last_name,
        first_name: driver.first_name,
        last_name: driver.last_name,
        name: `${driver.first_name} ${driver.last_name}`,
        fullName: `${driver.first_name} ${driver.last_name}`,
        phone: driver.phone,
        licenseNumber: driver.license_number,
        license_number: driver.license_number,
        licenseCategory: driver.license_category,
        license_category: driver.license_category,
        license_type: driver.license_category,
        photoUrl: driver.photo_url,
        photo_url: driver.photo_url,
        photo: driver.photo_url,
        available: !isBusy,
        status: isBusy ? 'busy' : 'available',
        warning: isBusy ? 'Ya tiene una asignacion para esta fecha' : null
      };
    });

    // Si se quiere solo los disponibles, filtrar
    const availableOnly = items.filter(d => d.available);

    return res.status(200).json({
      success: true,
      data: availableOnly,
      allDrivers: items,
      summary: {
        total: allDrivers.length,
        available: availableOnly.length,
        busy: allDrivers.length - availableOnly.length
      }
    });

  } catch (error) {
    console.error('Error en getAvailableDrivers:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener choferes disponibles'
    });
  }
};

/**
 * POST /api/drivers/:id/assignments
 * Asignar un chofer a un tour/reserva
 * Roles: Admin
 */
const assignDriverToTour = async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const {
      tourId,
      reservationId,
      tourCode,
      date,
      vehicleId,
      guideId,
      pickupLocation,
      pickupTime,
      notes
    } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validar driverId
    if (!uuidRegex.test(driverId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'driverId debe ser un UUID válido'
      });
    }

    // Verificar que el driver existe y está activo
    const driver = await prisma.drivers.findUnique({ where: { id: driverId } });
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Chofer no encontrado'
      });
    }

    if (driver.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El chofer no está activo'
      });
    }

    // Determinar el reservation_id
    let targetReservationId = reservationId;

    // Si viene tourId en lugar de reservationId, buscar la reserva asociada
    if (!targetReservationId && tourId) {
      // Buscar reserva por tour_id y fecha
      const reservation = await prisma.reservations.findFirst({
        where: {
          tour_id: tourId,
          ...(date && { date: parseLocalDate(date) })
        },
        orderBy: { created_at: 'desc' }
      });

      if (reservation) {
        targetReservationId = reservation.id;
      }
    }

    if (!targetReservationId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Se requiere reservationId o tourId válido'
      });
    }

    // Validar que la reserva existe
    const reservation = await prisma.reservations.findUnique({
      where: { id: targetReservationId },
      include: { tours: true }
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Reserva no encontrada'
      });
    }

    // Verificar si ya existe una asignación para esta reserva
    const existingAssignment = await prisma.tour_assignments.findUnique({
      where: { reservation_id: targetReservationId }
    });

    const userId = req.user?.id;
    let assignment;

    if (existingAssignment) {
      // Actualizar la asignación existente con el nuevo driver
      assignment = await prisma.tour_assignments.update({
        where: { id: existingAssignment.id },
        data: {
          driver_id: driverId,
          vehicle_id: vehicleId || existingAssignment.vehicle_id,
          guide_id: guideId || existingAssignment.guide_id,
          pickup_location: pickupLocation || existingAssignment.pickup_location,
          pickup_time: pickupTime ? new Date(`1970-01-01T${pickupTime}`) : existingAssignment.pickup_time,
          notes: notes || existingAssignment.notes,
          status: 'assigned',
          updated_at: new Date()
        },
        include: {
          drivers: true,
          vehicles: true,
          guides: {
            include: {
              users: { select: { first_name: true, last_name: true } }
            }
          },
          reservations: {
            include: { tours: true }
          }
        }
      });
    } else {
      // Crear nueva asignación
      assignment = await prisma.tour_assignments.create({
        data: {
          reservation_id: targetReservationId,
          driver_id: driverId,
          vehicle_id: vehicleId || null,
          guide_id: guideId || null,
          pickup_location: pickupLocation || null,
          pickup_time: pickupTime ? new Date(`1970-01-01T${pickupTime}`) : null,
          notes: notes || null,
          status: 'assigned'
        },
        include: {
          drivers: true,
          vehicles: true,
          guides: {
            include: {
              users: { select: { first_name: true, last_name: true } }
            }
          },
          reservations: {
            include: { tours: true }
          }
        }
      });
    }

    // Formatear respuesta
    return res.status(201).json({
      success: true,
      message: existingAssignment ? 'Chofer reasignado exitosamente' : 'Chofer asignado exitosamente',
      data: {
        id: assignment.id,
        reservationId: assignment.reservation_id,
        driverId: assignment.driver_id,
        vehicleId: assignment.vehicle_id,
        guideId: assignment.guide_id,
        pickupLocation: assignment.pickup_location,
        pickupTime: assignment.pickup_time,
        notes: assignment.notes,
        status: assignment.status,
        createdAt: assignment.created_at,
        updatedAt: assignment.updated_at,
        driver: assignment.drivers ? {
          id: assignment.drivers.id,
          name: `${assignment.drivers.first_name} ${assignment.drivers.last_name}`,
          phone: assignment.drivers.phone,
          licenseNumber: assignment.drivers.license_number,
          licenseCategory: assignment.drivers.license_category
        } : null,
        vehicle: assignment.vehicles ? {
          id: assignment.vehicles.id,
          plate: assignment.vehicles.plate,
          brand: assignment.vehicles.brand,
          model: assignment.vehicles.model,
          capacity: assignment.vehicles.capacity
        } : null,
        guide: assignment.guides ? {
          id: assignment.guides.id,
          name: `${assignment.guides.users?.first_name || ''} ${assignment.guides.users?.last_name || ''}`.trim()
        } : null,
        tour: assignment.reservations?.tours ? {
          id: assignment.reservations.tours.id,
          name: assignment.reservations.tours.name,
          code: tourCode || assignment.reservations.tours.id
        } : null,
        reservation: {
          id: assignment.reservations?.id,
          date: assignment.reservations?.date,
          status: assignment.reservations?.status
        }
      }
    });

  } catch (error) {
    console.error('Error en assignDriverToTour:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al asignar el chofer'
    });
  }
};

/**
 * GET /api/drivers/:id/assignments
 * Obtener asignaciones de un chofer
 * Roles: Admin
 */
const getDriverAssignments = async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const { status, from, to, limit = 20 } = req.query;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(driverId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'driverId debe ser un UUID válido'
      });
    }

    // Verificar que el driver existe
    const driver = await prisma.drivers.findUnique({ where: { id: driverId } });
    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Chofer no encontrado'
      });
    }

    // Construir filtros
    const where = { driver_id: driverId };

    if (status) {
      where.status = status;
    }

    // Filtrar por rango de fechas de la reserva (usando parseLocalDate para DATE columns)
    if (from || to) {
      where.reservations = {
        date: {}
      };
      if (from) {
        where.reservations.date.gte = parseLocalDate(from);
      }
      if (to) {
        where.reservations.date.lte = parseLocalDate(to);
      }
    }

    const assignments = await prisma.tour_assignments.findMany({
      where,
      take: parseInt(limit),
      orderBy: { created_at: 'desc' },
      include: {
        vehicles: true,
        guides: {
          include: {
            users: { select: { first_name: true, last_name: true } }
          }
        },
        reservations: {
          include: {
            tours: true,
            agencies: { select: { id: true, business_name: true } }
          }
        }
      }
    });

    const items = assignments.map(a => ({
      id: a.id,
      reservationId: a.reservation_id,
      driverId: a.driver_id,
      vehicleId: a.vehicle_id,
      guideId: a.guide_id,
      pickupLocation: a.pickup_location,
      pickupTime: a.pickup_time,
      notes: a.notes,
      status: a.status,
      pdfGeneratedAt: a.pdf_generated_at,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      vehicle: a.vehicles ? {
        id: a.vehicles.id,
        plate: a.vehicles.plate,
        brand: a.vehicles.brand,
        model: a.vehicles.model,
        capacity: a.vehicles.capacity,
        vehicleType: a.vehicles.vehicle_type
      } : null,
      guide: a.guides ? {
        id: a.guides.id,
        name: `${a.guides.users?.first_name || ''} ${a.guides.users?.last_name || ''}`.trim()
      } : null,
      reservation: a.reservations ? {
        id: a.reservations.id,
        date: a.reservations.date,
        time: a.reservations.time,
        status: a.reservations.status,
        participants: a.reservations.participants
      } : null,
      tour: a.reservations?.tours ? {
        id: a.reservations.tours.id,
        name: a.reservations.tours.name,
        duration: a.reservations.tours.duration
      } : null,
      agency: a.reservations?.agencies ? {
        id: a.reservations.agencies.id,
        name: a.reservations.agencies.business_name
      } : null
    }));

    return res.status(200).json({
      success: true,
      data: items,
      total: items.length,
      driver: {
        id: driver.id,
        name: `${driver.first_name} ${driver.last_name}`,
        licenseNumber: driver.license_number
      }
    });

  } catch (error) {
    console.error('Error en getDriverAssignments:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener asignaciones del chofer'
    });
  }
};

/**
 * DELETE /api/drivers/:id/assignments/:assignmentId
 * Remover asignación de chofer
 * Roles: Admin
 */
const removeDriverAssignment = async (req, res) => {
  try {
    const { id: driverId, assignmentId } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(driverId) || !uuidRegex.test(assignmentId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'driverId y assignmentId deben ser UUIDs válidos'
      });
    }

    // Verificar que la asignación existe y pertenece al driver
    const assignment = await prisma.tour_assignments.findFirst({
      where: {
        id: assignmentId,
        driver_id: driverId
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Asignación no encontrada para este chofer'
      });
    }

    // Actualizar para remover el driver (no eliminar la asignación completa)
    await prisma.tour_assignments.update({
      where: { id: assignmentId },
      data: {
        driver_id: null,
        status: 'pending',
        updated_at: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Chofer removido de la asignación exitosamente'
    });

  } catch (error) {
    console.error('Error en removeDriverAssignment:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al remover la asignación del chofer'
    });
  }
};

module.exports = {
  listDrivers,
  getDriver,
  createDriver,
  updateDriver,
  deleteDriver,
  getAvailableDrivers,
  assignDriverToTour,
  getDriverAssignments,
  removeDriverAssignment
};
