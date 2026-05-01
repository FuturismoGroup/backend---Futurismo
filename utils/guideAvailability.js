/**
 * Utilidad para verificar disponibilidad de un guía freelance en una fecha.
 * Verifica: eventos bloqueantes, solicitudes existentes, horario laboral.
 */

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} guideId - UUID del guía
 * @param {Date} serviceDate - Fecha del servicio
 * @param {string} [excludeRequestId] - ID de solicitud a excluir (para validar al aceptar)
 * @returns {Promise<{available: boolean, reason?: string, conflicts?: object[]}>}
 */
async function checkGuideAvailabilityForDate(prisma, guideId, serviceDate, excludeRequestId) {
  // Normalizar fecha a inicio y fin del día (UTC)
  const dayStart = new Date(serviceDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(serviceDate);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  // 1. Verificar personal_events con blocks_availability=true que cubren ese día
  const blockingEvents = await prisma.personal_events.findMany({
    where: {
      guide_id: guideId,
      blocks_availability: true,
      start_datetime: { lt: nextDay },
      end_datetime: { gt: dayStart }
    },
    select: {
      id: true,
      title: true,
      start_datetime: true,
      end_datetime: true,
      event_type: true
    }
  });

  if (blockingEvents.length > 0) {
    return {
      available: false,
      reason: 'BLOCKED_BY_EVENT',
      conflicts: blockingEvents.map(e => ({
        id: e.id,
        title: e.title,
        type: e.event_type
      }))
    };
  }

  // 2. Verificar service_requests pendientes o aceptadas en la misma fecha
  const existingRequestsWhere = {
    guide_id: guideId,
    status: { in: ['pending', 'accepted'] },
    service_date: {
      gte: dayStart,
      lte: dayEnd
    }
  };
  if (excludeRequestId) {
    existingRequestsWhere.id = { not: excludeRequestId };
  }

  const existingRequests = await prisma.service_requests.findMany({
    where: existingRequestsWhere,
    select: {
      id: true,
      status: true,
      service_date: true,
      agencies: {
        include: { users: { select: { first_name: true, last_name: true } } }
      }
    }
  });

  if (existingRequests.length > 0) {
    return {
      available: false,
      reason: 'EXISTING_REQUESTS',
      conflicts: existingRequests.map(r => ({
        id: r.id,
        status: r.status
      }))
    };
  }

  // 3. Verificar working_hours - si el día de la semana tiene is_working_day=false
  const dayOfWeek = dayStart.getUTCDay(); // 0=Sunday, 1=Monday, ...
  const workingHour = await prisma.working_hours.findUnique({
    where: {
      working_hours_guide_day_unique: {
        guide_id: guideId,
        day_of_week: dayOfWeek
      }
    }
  });

  // Si hay registro y is_working_day es false -> no disponible
  // Si no hay registro -> asumir disponible
  if (workingHour && !workingHour.is_working_day) {
    return {
      available: false,
      reason: 'NON_WORKING_DAY'
    };
  }

  return { available: true };
}

module.exports = { checkGuideAvailabilityForDate };
