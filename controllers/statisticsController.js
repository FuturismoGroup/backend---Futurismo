// Controller de Statistics
// Endpoint: GET /api/statistics/reservations/trends
// Usado por: useReservationStats hook (frontend_futurismo/src/hooks/useReservationStats.js)

const prisma = require('../config/db');

/**
 * GET /api/statistics/reservations/trends
 * Obtiene tendencias comparativas de reservaciones
 * Compara período actual vs período anterior para calcular % de cambio
 */
const getReservationTrends = async (req, res) => {
  try {
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Filtro por agencia si el rol es agency
    let agencyFilter = {};
    if (userRole === 'agency') {
      const agency = await prisma.agency.findUnique({
        where: { userId }
      });
      if (agency) {
        agencyFilter = { agencyId: agency.id };
      } else {
        return res.status(200).json({
          success: true,
          data: {
            totalClients: { current: 0, previous: 0, trendLabel: '0%' },
            totalTourists: { current: 0, previous: 0, trendLabel: '0%' },
            totalRevenue: { current: 0, previous: 0, trendLabel: '0%' },
            avgGroupSize: { current: 0, previous: 0, trendLabel: '0%' },
            avgRevenuePerClient: { current: 0, previous: 0, trendLabel: '0%' },
            activeDestinations: { current: 0, previous: 0, trendLabel: '0%' }
          }
        });
      }
    }

    // Definir períodos (mes actual vs mes anterior)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Filtros de período
    const currentFilter = {
      date: { gte: currentMonthStart, lte: currentMonthEnd },
      ...agencyFilter
    };

    const previousFilter = {
      date: { gte: previousMonthStart, lte: previousMonthEnd },
      ...agencyFilter
    };

    // Obtener métricas en paralelo
    const [
      currentReservations,
      previousReservations,
      currentAggregate,
      previousAggregate,
      currentDestinations,
      previousDestinations
    ] = await Promise.all([
      // Conteo de reservaciones actuales
      prisma.reservations.count({ where: currentFilter }),

      // Conteo de reservaciones anteriores
      prisma.reservations.count({ where: previousFilter }),

      // Agregados período actual
      prisma.reservations.aggregate({
        where: {
          ...currentFilter,
          status: { in: ['confirmed', 'completed'] }
        },
        _sum: { totalAmount: true, participants: true },
        _avg: { participants: true }
      }),

      // Agregados período anterior
      prisma.reservations.aggregate({
        where: {
          ...previousFilter,
          status: { in: ['confirmed', 'completed'] }
        },
        _sum: { totalAmount: true, participants: true },
        _avg: { participants: true }
      }),

      // Destinos únicos período actual
      prisma.reservations.groupBy({
        by: ['tourId'],
        where: currentFilter
      }),

      // Destinos únicos período anterior
      prisma.reservations.groupBy({
        by: ['tourId'],
        where: previousFilter
      })
    ]);

    // Función para calcular tendencia
    const calculateTrend = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? '+100%' : '0%';
      }
      const change = ((current - previous) / previous) * 100;
      const sign = change >= 0 ? '+' : '';
      return `${sign}${change.toFixed(1)}%`;
    };

    // Métricas calculadas
    const currentRevenue = parseFloat(currentAggregate._sum.totalAmount) || 0;
    const previousRevenue = parseFloat(previousAggregate._sum.totalAmount) || 0;

    const currentParticipants = currentAggregate._sum.participants || 0;
    const previousParticipants = previousAggregate._sum.participants || 0;

    const currentAvgGroup = parseFloat(currentAggregate._avg.participants) || 0;
    const previousAvgGroup = parseFloat(previousAggregate._avg.participants) || 0;

    const currentAvgPerClient = currentReservations > 0 ? currentRevenue / currentReservations : 0;
    const previousAvgPerClient = previousReservations > 0 ? previousRevenue / previousReservations : 0;

    const trends = {
      totalClients: {
        current: currentReservations,
        previous: previousReservations,
        trendLabel: calculateTrend(currentReservations, previousReservations)
      },
      totalTourists: {
        current: currentParticipants,
        previous: previousParticipants,
        trendLabel: calculateTrend(currentParticipants, previousParticipants)
      },
      totalRevenue: {
        current: currentRevenue,
        previous: previousRevenue,
        trendLabel: calculateTrend(currentRevenue, previousRevenue)
      },
      avgGroupSize: {
        current: currentAvgGroup,
        previous: previousAvgGroup,
        trendLabel: calculateTrend(currentAvgGroup, previousAvgGroup)
      },
      avgRevenuePerClient: {
        current: currentAvgPerClient,
        previous: previousAvgPerClient,
        trendLabel: calculateTrend(currentAvgPerClient, previousAvgPerClient)
      },
      activeDestinations: {
        current: currentDestinations.length,
        previous: previousDestinations.length,
        trendLabel: calculateTrend(currentDestinations.length, previousDestinations.length)
      }
    };

    return res.status(200).json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Error en getReservationTrends:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener tendencias de reservaciones'
    });
  }
};

module.exports = {
  getReservationTrends
};
