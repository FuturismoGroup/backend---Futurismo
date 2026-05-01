// Controller de Vehicles
// Soporta ELM-039 (AssignmentManager) y gestión de vehículos
// TBL-023: vehicles

const prisma = require('../config/db');

const transformDocuments = (vehicleDocuments) => {
  const documents = {};
  if (vehicleDocuments) {
    vehicleDocuments.forEach(doc => {
      documents[doc.document_type] = {
        number: doc.document_number,
        expiry: doc.expiry_date,
        fileUrl: doc.file_url,
        isValid: doc.is_valid
      };
    });
  }
  return documents;
};

const saveVehicleDocuments = async (vehicleId, documents) => {
  if (!documents) return;
  for (const [docType, docData] of Object.entries(documents)) {
    if (!docData.expiry) continue;
    const existingDoc = await prisma.vehicle_documents.findFirst({
      where: { vehicle_id: vehicleId, document_type: docType }
    });
    if (existingDoc) {
      await prisma.vehicle_documents.update({
        where: { id: existingDoc.id },
        data: {
          document_number: docData.number || null,
          expiry_date: new Date(docData.expiry),
          file_url: docData.fileUrl || null,
          is_valid: true,
          updated_at: new Date()
        }
      });
    } else {
      await prisma.vehicle_documents.create({
        data: {
          vehicle_id: vehicleId,
          document_type: docType,
          document_number: docData.number || null,
          expiry_date: new Date(docData.expiry),
          file_url: docData.fileUrl || null,
          is_valid: true
        }
      });
    }
  }
};

const listVehicles = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, vehicleType, search } = req.query;
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    if (pageNum < 1) return res.status(400).json({ success: false, error: 'Bad Request', message: 'page debe ser >= 1' });
    if (pageSizeNum < 1 || pageSizeNum > 100) return res.status(400).json({ success: false, error: 'Bad Request', message: 'pageSize debe estar entre 1 y 100' });

    const where = {};
    if (status) where.status = status;
    else where.status = 'active';
    if (vehicleType) where.vehicle_type = vehicleType;
    if (search) {
      where.OR = [
        { plate: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (pageNum - 1) * pageSizeNum;
    const [vehicles, total] = await Promise.all([
      prisma.vehicles.findMany({ where, skip, take: pageSizeNum, orderBy: { created_at: 'desc' }, include: { vehicle_documents: true } }),
      prisma.vehicles.count({ where })
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);
    const items = vehicles.map(vehicle => ({
      id: vehicle.id, plate: vehicle.plate, licensePlate: vehicle.plate,
      brand: vehicle.brand, model: vehicle.model, year: vehicle.year,
      capacity: vehicle.capacity, seats: vehicle.capacity,
      vehicleType: vehicle.vehicle_type, type: vehicle.vehicle_type,
      color: vehicle.color, photoUrl: vehicle.photo_url, photo: vehicle.photo_url, image: vehicle.photo_url,
      status: vehicle.status, documents: transformDocuments(vehicle.vehicle_documents),
      createdAt: vehicle.created_at, updatedAt: vehicle.updated_at
    }));

    return res.status(200).json({ success: true, data: { items, pagination: { total, page: pageNum, pageSize: pageSizeNum, totalPages } } });
  } catch (error) {
    console.error('Error en listVehicles:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al obtener los vehículos' });
  }
};

const getVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return res.status(400).json({ success: false, error: 'Bad Request', message: 'id debe ser un UUID válido' });

    const vehicle = await prisma.vehicles.findUnique({
      where: { id },
      include: { vehicle_documents: true, tour_assignments: { take: 10, orderBy: { created_at: 'desc' } } }
    });

    if (!vehicle) return res.status(404).json({ success: false, error: 'Not Found', message: 'Vehículo no encontrado' });

    return res.status(200).json({
      success: true,
      data: {
        id: vehicle.id, plate: vehicle.plate, licensePlate: vehicle.plate,
        brand: vehicle.brand, model: vehicle.model, year: vehicle.year,
        capacity: vehicle.capacity, seats: vehicle.capacity,
        vehicleType: vehicle.vehicle_type, type: vehicle.vehicle_type,
        color: vehicle.color, photoUrl: vehicle.photo_url, photo: vehicle.photo_url, status: vehicle.status,
        createdAt: vehicle.created_at, updatedAt: vehicle.updated_at,
        documents: transformDocuments(vehicle.vehicle_documents),
        recentAssignments: vehicle.tour_assignments
      }
    });
  } catch (error) {
    console.error('Error en getVehicle:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al obtener el vehículo' });
  }
};

const createVehicle = async (req, res) => {
  try {
    const { plate, brand, model, year, capacity, vehicleType, color, photoUrl, documents } = req.body;
    if (!plate || !brand || !model) return res.status(400).json({ success: false, error: 'Bad Request', message: 'plate, brand y model son requeridos' });

    const existingPlate = await prisma.vehicles.findUnique({ where: { plate } });
    if (existingPlate) return res.status(409).json({ success: false, error: 'Conflict', message: 'Ya existe un vehículo con esa placa' });

    const vehicle = await prisma.vehicles.create({
      data: { plate, brand, model, year: year ? parseInt(year, 10) : null, capacity: capacity ? parseInt(capacity, 10) : null, vehicle_type: vehicleType || null, color: color || null, photo_url: photoUrl || null, status: 'active' }
    });

    if (documents) await saveVehicleDocuments(vehicle.id, documents);

    const vehicleWithDocs = await prisma.vehicles.findUnique({ where: { id: vehicle.id }, include: { vehicle_documents: true } });

    return res.status(201).json({
      success: true, message: 'Vehículo creado exitosamente',
      data: { id: vehicleWithDocs.id, plate: vehicleWithDocs.plate, brand: vehicleWithDocs.brand, model: vehicleWithDocs.model, year: vehicleWithDocs.year, capacity: vehicleWithDocs.capacity, vehicleType: vehicleWithDocs.vehicle_type, color: vehicleWithDocs.color, photoUrl: vehicleWithDocs.photo_url, status: vehicleWithDocs.status, documents: transformDocuments(vehicleWithDocs.vehicle_documents) }
    });
  } catch (error) {
    console.error('Error en createVehicle:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al crear el vehículo' });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return res.status(400).json({ success: false, error: 'Bad Request', message: 'id debe ser un UUID válido' });

    const existing = await prisma.vehicles.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Not Found', message: 'Vehículo no encontrado' });

    const data = {};
    if (updateData.plate) data.plate = updateData.plate;
    if (updateData.brand) data.brand = updateData.brand;
    if (updateData.model) data.model = updateData.model;
    if (updateData.year !== undefined) data.year = updateData.year ? parseInt(updateData.year, 10) : null;
    if (updateData.capacity !== undefined) data.capacity = updateData.capacity ? parseInt(updateData.capacity, 10) : null;
    if (updateData.vehicleType !== undefined) data.vehicle_type = updateData.vehicleType;
    if (updateData.color !== undefined) data.color = updateData.color;
    if (updateData.photoUrl !== undefined) data.photo_url = updateData.photoUrl;
    if (updateData.status) data.status = updateData.status;

    await prisma.vehicles.update({ where: { id }, data });
    if (updateData.documents) await saveVehicleDocuments(id, updateData.documents);

    const vehicleWithDocs = await prisma.vehicles.findUnique({ where: { id }, include: { vehicle_documents: true } });

    return res.status(200).json({
      success: true, message: 'Vehículo actualizado exitosamente',
      data: { id: vehicleWithDocs.id, plate: vehicleWithDocs.plate, brand: vehicleWithDocs.brand, model: vehicleWithDocs.model, year: vehicleWithDocs.year, capacity: vehicleWithDocs.capacity, vehicleType: vehicleWithDocs.vehicle_type, color: vehicleWithDocs.color, photoUrl: vehicleWithDocs.photo_url, status: vehicleWithDocs.status, documents: transformDocuments(vehicleWithDocs.vehicle_documents) }
    });
  } catch (error) {
    console.error('Error en updateVehicle:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al actualizar el vehículo' });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return res.status(400).json({ success: false, error: 'Bad Request', message: 'id debe ser un UUID válido' });

    const existing = await prisma.vehicles.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Not Found', message: 'Vehículo no encontrado' });

    await prisma.vehicles.update({ where: { id }, data: { status: 'inactive' } });
    return res.status(200).json({ success: true, message: 'Vehículo eliminado exitosamente' });
  } catch (error) {
    console.error('Error en deleteVehicle:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al eliminar el vehículo' });
  }
};

const getAvailableVehicles = async (req, res) => {
  try {
    const { date, vehicleType, minCapacity, excludeReservationId } = req.query;
    const where = { status: 'active' };
    if (vehicleType) where.vehicle_type = vehicleType;
    if (minCapacity) where.capacity = { gte: parseInt(minCapacity, 10) };

    // Obtener todos los vehiculos activos
    const allVehicles = await prisma.vehicles.findMany({ where, orderBy: { brand: 'asc' }, include: { vehicle_documents: true } });

    // Si hay fecha, verificar disponibilidad real
    let busyVehicleIds = new Set();
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Buscar asignaciones existentes para esa fecha
      const existingAssignments = await prisma.tour_assignments.findMany({
        where: {
          vehicle_id: { not: null },
          reservations: {
            date: { gte: targetDate, lt: nextDay },
            status: { in: ['pending', 'confirmed', 'active'] }
          },
          ...(excludeReservationId && { reservation_id: { not: excludeReservationId } })
        },
        select: { vehicle_id: true }
      });

      busyVehicleIds = new Set(existingAssignments.map(a => a.vehicle_id));
    }

    // Mapear vehiculos con informacion de disponibilidad
    const items = allVehicles.map(vehicle => {
      const isBusy = busyVehicleIds.has(vehicle.id);
      return {
        id: vehicle.id, plate: vehicle.plate, licensePlate: vehicle.plate,
        brand: vehicle.brand, model: vehicle.model, year: vehicle.year,
        capacity: vehicle.capacity, seats: vehicle.capacity,
        vehicleType: vehicle.vehicle_type, type: vehicle.vehicle_type,
        color: vehicle.color, photoUrl: vehicle.photo_url, photo: vehicle.photo_url,
        documents: transformDocuments(vehicle.vehicle_documents),
        available: !isBusy,
        status: isBusy ? 'busy' : 'available',
        warning: isBusy ? 'Ya tiene una asignacion para esta fecha' : null
      };
    });

    // Filtrar solo los disponibles
    const availableOnly = items.filter(v => v.available);

    return res.status(200).json({
      success: true,
      data: availableOnly,
      allVehicles: items,
      summary: {
        total: allVehicles.length,
        available: availableOnly.length,
        busy: allVehicles.length - availableOnly.length
      }
    });
  } catch (error) {
    console.error('Error en getAvailableVehicles:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al obtener vehículos disponibles' });
  }
};

const registerMaintenance = async (req, res) => {
  try {
    const { id } = req.params;
    const { maintenanceType, description, date, cost } = req.body;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return res.status(400).json({ success: false, error: 'Bad Request', message: 'id debe ser un UUID válido' });

    const vehicle = await prisma.vehicles.findUnique({ where: { id } });
    if (!vehicle) return res.status(404).json({ success: false, error: 'Not Found', message: 'Vehículo no encontrado' });

    return res.status(200).json({ success: true, message: 'Mantenimiento registrado', data: { vehicleId: id, maintenanceType, description, date, cost } });
  } catch (error) {
    console.error('Error en registerMaintenance:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al registrar mantenimiento' });
  }
};

const assignVehicle = async (req, res) => {
  try {
    const { id: vehicleId } = req.params;
    const { tourId, tourCode, date, passengers, driverId, reservationId: bodyReservationId } = req.body;

    const vehicle = await prisma.vehicles.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ success: false, error: 'Not Found', message: 'Vehículo no encontrado' });

    if (passengers && vehicle.capacity && vehicle.capacity < passengers) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Capacidad insuficiente. El vehículo tiene ' + vehicle.capacity + ' plazas, se requieren ' + passengers });
    }

    // Usar reservationId del body si se proporciona, sino buscarlo por tourId
    let reservationId = bodyReservationId || null;
    if (!reservationId && tourId) {
      const reservation = await prisma.reservations.findFirst({ where: { tour_id: tourId, status: { in: ['pending', 'confirmed', 'active'] } }, orderBy: { date: 'asc' } });
      if (reservation) reservationId = reservation.id;
    }

    if (!reservationId) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Se requiere reservationId o tourId válido para asignar vehículo' });
    }

    let assignment;
    const existing = await prisma.tour_assignments.findUnique({ where: { reservation_id: reservationId } });
    if (existing) {
      assignment = await prisma.tour_assignments.update({
        where: { reservation_id: reservationId },
        data: {
          vehicle_id: vehicleId,
          driver_id: driverId || existing.driver_id,
          updated_at: new Date()
        },
        include: { vehicles: true, drivers: true }
      });
    } else {
      assignment = await prisma.tour_assignments.create({
        data: {
          reservation_id: reservationId,
          vehicle_id: vehicleId,
          driver_id: driverId || null
        },
        include: { vehicles: true, drivers: true }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Vehículo asignado exitosamente',
      data: {
        assignmentId: assignment.id,
        reservationId: reservationId,
        vehicleId,
        vehiclePlate: vehicle.plate,
        vehicleModel: vehicle.brand + ' ' + vehicle.model,
        capacity: vehicle.capacity,
        tourId,
        tourCode,
        driverId: assignment.driver_id,
        driverName: assignment.drivers ? `${assignment.drivers.first_name} ${assignment.drivers.last_name}` : null
      }
    });
  } catch (error) {
    console.error('Error en assignVehicle:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al asignar vehículo' });
  }
};

module.exports = { listVehicles, getVehicle, createVehicle, updateVehicle, deleteVehicle, getAvailableVehicles, registerMaintenance, assignVehicle };
