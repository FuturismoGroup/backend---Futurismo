// Helper para edición no retroactiva de tours.
//
// Cuando un tour se edita, tourController.updateTour congela un snapshot del
// tour en cada reserva existente (campo reservations.tour_snapshot). Las nuevas
// reservas no llevan snapshot y siguen viendo el tour vigente vía JOIN.
//
// resolveTourView toma una reserva (con su `tours` ya incluida por Prisma) y
// devuelve la vista de tour que debe mostrarse: prioriza el snapshot si existe;
// si no, cae a los datos actuales del tour. Sirve para que el listado de
// reservas, el detalle, el monitoreo y la vista del guía no muestren los
// cambios futuros aplicados a la plantilla del tour.

/**
 * Devuelve un objeto con los campos comunes del tour aplicando snapshot si la
 * reserva lo tiene. El consumidor proyecta sólo las claves que necesita.
 *
 * @param {object} reservation - Reserva con `tours` incluida y `tour_snapshot`.
 * @returns {object|null} Vista normalizada del tour o null si no hay datos.
 */
function resolveTourView(reservation) {
  if (!reservation) return null;

  const snapshot = reservation.tour_snapshot;
  const tour = reservation.tours;

  if (snapshot && typeof snapshot === 'object') {
    return {
      id: snapshot.id ?? tour?.id ?? reservation.tour_id ?? null,
      code: snapshot.code ?? tour?.code ?? null,
      name: snapshot.name ?? tour?.name ?? null,
      description: snapshot.description ?? tour?.description ?? null,
      shortDescription: snapshot.shortDescription ?? tour?.short_description ?? null,
      category: snapshot.category ?? tour?.category ?? null,
      tourType: snapshot.tourType ?? tour?.tour_type ?? null,
      duration: snapshot.duration ?? tour?.duration ?? null,
      price: snapshot.price ?? tour?.price ?? null,
      childPrice: snapshot.childPrice ?? tour?.child_price ?? null,
      maxCapacity: snapshot.maxCapacity ?? tour?.max_capacity ?? null,
      includesGuide: snapshot.includesGuide ?? tour?.includes_guide ?? null,
      includesTransport: snapshot.includesTransport ?? tour?.includes_transport ?? null,
      meetingPoint: snapshot.meetingPoint ?? tour?.meeting_point ?? null,
      languages: snapshot.languages ?? tour?.languages ?? null,
      image: snapshot.image ?? tour?.image ?? null,
      includes: snapshot.includes ?? tour?.includes ?? null,
      excludes: snapshot.excludes ?? tour?.excludes ?? null,
      notes: snapshot.notes ?? tour?.notes ?? null,
      active: snapshot.active ?? tour?.active ?? null,
      fromSnapshot: true
    };
  }

  if (!tour) return null;

  return {
    id: tour.id,
    code: tour.code ?? null,
    name: tour.name ?? null,
    description: tour.description ?? null,
    shortDescription: tour.short_description ?? null,
    category: tour.category ?? null,
    tourType: tour.tour_type ?? null,
    duration: tour.duration ?? null,
    price: tour.price ?? null,
    childPrice: tour.child_price ?? null,
    maxCapacity: tour.max_capacity ?? null,
    includesGuide: tour.includes_guide ?? null,
    includesTransport: tour.includes_transport ?? null,
    meetingPoint: tour.meeting_point ?? null,
    languages: tour.languages ?? null,
    image: tour.image ?? null,
    includes: tour.includes ?? null,
    excludes: tour.excludes ?? null,
    notes: tour.notes ?? null,
    active: tour.active ?? null,
    fromSnapshot: false
  };
}

/**
 * Devuelve la lista de paradas a mostrar para una reserva. Prioriza las
 * paradas del snapshot (congeladas al momento de la edición) y cae al tour
 * vigente sólo si la reserva no tiene snapshot.
 *
 * Salida normalizada al shape { id, name, description, duration, order_num }
 * para que el llamador no necesite distinguir entre snapshot y JOIN.
 *
 * @param {object} reservation - Reserva con `tours.tour_stops` y `tour_snapshot`.
 * @returns {Array<object>}
 */
function resolveTourStops(reservation) {
  if (!reservation) return [];

  const snapshot = reservation.tour_snapshot;
  if (snapshot && Array.isArray(snapshot.stops)) {
    return snapshot.stops
      .map(stop => ({
        id: stop.id,
        name: stop.name,
        description: stop.description ?? null,
        duration: stop.duration ?? null,
        order_num: stop.order ?? stop.order_num ?? 0
      }))
      .sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  }

  const stops = reservation.tours?.tour_stops || [];
  return stops
    .filter(stop => !stop.replaced_at)
    .map(stop => ({
      id: stop.id,
      name: stop.name,
      description: stop.description ?? null,
      duration: stop.duration ?? null,
      order_num: stop.order_num ?? 0
    }))
    .sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
}

module.exports = { resolveTourView, resolveTourStops };
