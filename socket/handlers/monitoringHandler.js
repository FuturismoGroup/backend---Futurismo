// Handler de monitoreo GPS para Socket.io
// Maneja: ubicacion GPS de guias en tiempo real, join/leave de rooms de monitoreo

const prisma = require('../../config/db');

/**
 * Resuelve el agency_id asociado a un active_tour a través de su reservation.
 * Se usa para enviar el broadcast SOLO a la agencia que tiene el servicio asignado,
 * evitando filtrar ubicaciones GPS entre agencias.
 *
 * @param {string} activeTourId - ID del active_tour
 * @returns {Promise<string|null>} agency_id o null si no se encuentra
 */
const getAgencyIdForActiveTour = async (activeTourId) => {
  if (!activeTourId) return null;
  try {
    const activeTour = await prisma.active_tours.findUnique({
      where: { id: activeTourId },
      select: {
        reservations: {
          select: { agency_id: true }
        }
      }
    });
    return activeTour?.reservations?.agency_id || null;
  } catch (err) {
    console.error('[Monitoring] Error resolviendo agency_id:', err?.message);
    return null;
  }
};

/**
 * Registra los handlers de monitoreo para un socket
 * @param {Server} io - Instancia de Socket.io
 * @param {Socket} socket - Socket del cliente
 */
const registerHandlers = (io, socket) => {
  const userId = socket.user.id;
  const userRole = socket.user.role;

  // Auto-join: admins ven TODAS las ubicaciones (room global)
  if (userRole === 'admin' || userRole === 'administrator') {
    socket.join('monitoring:admin');
    console.log(`[Monitoring] Admin ${socket.user.firstName} unido a monitoring:admin`);
  }

  // Agencias ven SOLO ubicaciones de guías asignados a sus servicios
  // IMPORTANTE: NO unir a monitoring:admin para preservar la privacidad entre agencias
  if (userRole === 'agency') {
    prisma.agencies.findUnique({ where: { user_id: userId } })
      .then(agency => {
        if (agency) {
          socket.join(`monitoring:agency:${agency.id}`);
          console.log(`[Monitoring] Agencia ${socket.user.firstName} unida a monitoring:agency:${agency.id}`);
        }
      })
      .catch(err => console.error('[Monitoring] Error buscando agencia:', err));
  }

  // Guia: escuchar envio de ubicacion GPS via WebSocket
  if (userRole === 'guide') {
    socket.on('guide:location:send', async (data) => {
      try {
        const { latitude, longitude, accuracy, speed, reservationId } = data;

        // Validaciones basicas
        if (latitude === undefined || longitude === undefined) {
          socket.emit('guide:location:error', { message: 'latitude y longitude son obligatorios' });
          return;
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          socket.emit('guide:location:error', { message: 'Coordenadas fuera de rango' });
          return;
        }

        // Obtener guia
        const guide = await prisma.guides.findFirst({
          where: { user_id: userId }
        });

        if (!guide) {
          socket.emit('guide:location:error', { message: 'Usuario no es un guia' });
          return;
        }

        // Buscar tour activo incluyendo la reservación para obtener agency_id
        // (necesario para broadcast dirigido a la agencia correspondiente).
        let activeTour;
        if (reservationId) {
          activeTour = await prisma.active_tours.findUnique({
            where: { reservation_id: reservationId },
            include: { reservations: { select: { agency_id: true } } }
          });
        } else {
          activeTour = await prisma.active_tours.findFirst({
            where: { guide_id: guide.id, status: 'in_progress' },
            include: { reservations: { select: { agency_id: true } } }
          });
        }

        if (!activeTour) {
          socket.emit('guide:location:error', { message: 'No hay tour activo' });
          return;
        }

        const now = new Date();
        const maxDecimalValue = 9999.99;
        const safeAccuracy = accuracy ? Math.min(parseFloat(accuracy), maxDecimalValue) : null;
        const safeSpeed = speed ? Math.min(parseFloat(speed), maxDecimalValue) : null;

        // Guardar en BD
        await prisma.guide_locations.create({
          data: {
            active_tour_id: activeTour.id,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            accuracy: safeAccuracy,
            speed: safeSpeed,
            recorded_at: now
          }
        });

        // Actualizar last_location_update
        await prisma.active_tours.update({
          where: { id: activeTour.id },
          data: { last_location_update: now }
        });

        // Construir payload de ubicacion
        const locationPayload = {
          guideId: guide.id,
          guideName: `${socket.user.firstName} ${socket.user.lastName}`,
          activeTourId: activeTour.id,
          reservationId: activeTour.reservation_id,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          accuracy: safeAccuracy,
          speed: safeSpeed,
          recordedAt: now.toISOString()
        };

        // Broadcast a admins (room global)
        io.to('monitoring:admin').emit('guide:location:updated', locationPayload);

        // Broadcast SOLO a la agencia dueña del servicio (privacidad entre agencias)
        const agencyId = activeTour.reservations?.agency_id;
        if (agencyId) {
          io.to(`monitoring:agency:${agencyId}`).emit('guide:location:updated', locationPayload);
        }

        // También emitir a la room específica del tour (admins/agencias suscritos
        // al detalle de un servicio puntual via monitoring:tour:join).
        io.to(`tour:${activeTour.id}`).emit('guide:location:updated', locationPayload);

        // Confirmar al guia
        socket.emit('guide:location:ack', {
          success: true,
          timestamp: now.toISOString()
        });

      } catch (error) {
        console.error('[Monitoring] Error procesando ubicacion GPS:', error);
        socket.emit('guide:location:error', { message: 'Error al procesar ubicacion' });
      }
    });

    // Guia solicita unirse a room de su tour para recibir mensajes
    socket.on('guide:tour:join', (data) => {
      const { activeTourId } = data;
      if (activeTourId) {
        socket.join(`tour:${activeTourId}`);
        console.log(`[Monitoring] Guia ${socket.user.firstName} unido a tour:${activeTourId}`);
      }
    });
  }

  // Admin/Agency: solicitar unirse a monitoreo de tour especifico
  socket.on('monitoring:tour:join', (data) => {
    const { activeTourId } = data;
    if (activeTourId && (userRole === 'admin' || userRole === 'administrator' || userRole === 'agency')) {
      socket.join(`tour:${activeTourId}`);
      console.log(`[Monitoring] ${socket.user.firstName} monitoreando tour:${activeTourId}`);
    }
  });

  socket.on('monitoring:tour:leave', (data) => {
    const { activeTourId } = data;
    if (activeTourId) {
      socket.leave(`tour:${activeTourId}`);
    }
  });
};

/**
 * Emite actualizacion de ubicacion desde el controller HTTP (fallback).
 * Se llama cuando el guia envia ubicacion via REST en vez de WebSocket.
 *
 * Envia a:
 *   - monitoring:admin (todos los admins ven todo)
 *   - monitoring:agency:<agencyId> (SOLO la agencia que tiene el servicio)
 *   - tour:<activeTourId> (suscriptores del detalle de tour específico)
 *
 * Si locationData incluye agencyId lo usa directo; si no, resuelve buscando
 * la reservación del activeTourId. Esto evita filtrar ubicaciones GPS entre
 * agencias distintas.
 *
 * @param {Server} io - Instancia de Socket.io
 * @param {Object} locationData - Datos de ubicacion (incluye activeTourId)
 */
const emitLocationUpdate = async (io, locationData) => {
  if (!io || !locationData) return;

  // Siempre emitir a admins
  io.to('monitoring:admin').emit('guide:location:updated', locationData);

  // Resolver agency_id si no viene en el payload
  let agencyId = locationData.agencyId;
  if (!agencyId && locationData.activeTourId) {
    agencyId = await getAgencyIdForActiveTour(locationData.activeTourId);
  }

  if (agencyId) {
    io.to(`monitoring:agency:${agencyId}`).emit('guide:location:updated', locationData);
  }

  // Emitir también a la room específica del tour (admins/agencias en detalle)
  if (locationData.activeTourId) {
    io.to(`tour:${locationData.activeTourId}`).emit('guide:location:updated', locationData);
  }
};

/**
 * Emite que un tour cambio de estado (inicio, completado, etc).
 * Notifica a admins y a la agencia dueña del servicio.
 *
 * @param {Server} io - Instancia de Socket.io
 * @param {Object} tourData - Datos del tour (debe incluir activeTourId o agencyId)
 */
const emitTourStatusChange = async (io, tourData) => {
  if (!io || !tourData) return;

  // Siempre emitir a admins
  io.to('monitoring:admin').emit('monitoring:tour:status', tourData);

  // Resolver agency_id si no viene en el payload
  let agencyId = tourData.agencyId;
  if (!agencyId && tourData.activeTourId) {
    agencyId = await getAgencyIdForActiveTour(tourData.activeTourId);
  }

  if (agencyId) {
    io.to(`monitoring:agency:${agencyId}`).emit('monitoring:tour:status', tourData);
  }
};

module.exports = {
  registerHandlers,
  emitLocationUpdate,
  emitTourStatusChange,
  getAgencyIdForActiveTour
};
