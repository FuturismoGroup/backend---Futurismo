// Handler de monitoreo GPS para Socket.io
// Maneja: ubicacion GPS de guias en tiempo real, join/leave de rooms de monitoreo

const prisma = require('../../config/db');

/**
 * Registra los handlers de monitoreo para un socket
 * @param {Server} io - Instancia de Socket.io
 * @param {Socket} socket - Socket del cliente
 */
const registerHandlers = (io, socket) => {
  const userId = socket.user.id;
  const userRole = socket.user.role;

  // Auto-join: admins y agencias se unen a la room de monitoreo
  if (userRole === 'admin' || userRole === 'administrator') {
    socket.join('monitoring:admin');
    console.log(`[Monitoring] Admin ${socket.user.firstName} unido a monitoring:admin`);
  }

  if (userRole === 'agency') {
    socket.join('monitoring:admin'); // Agencias tambien reciben updates
    // Buscar agencyId para room especifica
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

        // Buscar tour activo
        let activeTour;
        if (reservationId) {
          activeTour = await prisma.active_tours.findUnique({
            where: { reservation_id: reservationId }
          });
        } else {
          activeTour = await prisma.active_tours.findFirst({
            where: { guide_id: guide.id, status: 'in_progress' }
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

        // Broadcast a admins y agencias en la room de monitoreo
        io.to('monitoring:admin').emit('guide:location:updated', locationPayload);

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
 * Emite actualizacion de ubicacion desde el controller HTTP (fallback)
 * Se llama cuando el guia envia ubicacion via REST en vez de WebSocket
 * @param {Server} io - Instancia de Socket.io
 * @param {Object} locationData - Datos de ubicacion
 */
const emitLocationUpdate = (io, locationData) => {
  if (!io || !locationData) return;
  io.to('monitoring:admin').emit('guide:location:updated', locationData);
};

/**
 * Emite que un tour cambio de estado (inicio, completado, etc)
 * @param {Server} io - Instancia de Socket.io
 * @param {Object} tourData - Datos del tour
 */
const emitTourStatusChange = (io, tourData) => {
  if (!io || !tourData) return;
  io.to('monitoring:admin').emit('monitoring:tour:status', tourData);
};

module.exports = {
  registerHandlers,
  emitLocationUpdate,
  emitTourStatusChange
};
