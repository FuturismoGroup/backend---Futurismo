// Controller de Dashboard
// API-018: GetDashboardSummary - GET /api/dashboard/summary
// Fuente: 04_apis_lista.md lineas 1377-1464

const prisma = require('../config/db');
const { formatPrice, formatAverage, safeAverage, safePercentage } = require('../utils/numberFormatter');

/**
 * API-018: GetDashboardSummary
 * GET /api/dashboard/summary
 * Métricas consolidadas del dashboard principal
 * Roles: Admin, Agency
 * Fuente: 04_apis_lista.md líneas 1377-1464
 */
const getDashboardSummary = async (req, res) => {
  try {
    let { dateFrom, dateTo } = req.query;

    // Defaults: inicio del mes y hoy (lineas 1403-1407)
    const now = new Date();
    if (!dateFrom) {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }
    if (!dateTo) {
      dateTo = now.toISOString().split('T')[0];
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);

    // dateFrom <= dateTo (linea 1447)
    if (fromDate > toDate) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom debe ser menor o igual a dateTo'
      });
    }

    // Determinar filtro segun rol (lineas 1449-1450)
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let agencyFilter = {};

    // Agency solo ve sus propias metricas (linea 1449)
    if (userRole === 'agency') {
      // Prisma schema: agencies.user_id
      const agency = await prisma.agencies.findFirst({
        where: { user_id: userId }
      });
      if (agency) {
        agencyFilter = { agency_id: agency.id };
      } else {
        // Sin agencia, retornar datos vacios
        return res.status(200).json({
          totalReservations: 0,
          totalRevenue: 0,
          totalAgencies: 0,
          totalGuides: 0,
          pendingReservations: 0,
          confirmedReservations: 0,
          completedReservations: 0,
          averageGroupSize: 0,
          topDestinations: [],
          topGuides: [],
          revenueByMonth: [],
          reservationsByStatus: { pending: 0, confirmed: 0, cancelled: 0, completed: 0 }
        });
      }
    }

    // Filtro base de fechas + agencia
    // Prisma schema: reservations.date, reservations.agency_id
    const dateFilter = {
      date: {
        gte: fromDate,
        lte: toDate
      },
      ...agencyFilter
    };

    // Obtener metricas en paralelo
    // Prisma schema: model reservations, agencies, guides
    const [
      totalReservations,
      reservationsByStatus,
      totalRevenueResult,
      totalAgencies,
      totalGuides,
      averageGroupResult,
      topDestinations,
      topGuides
    ] = await Promise.all([
      // Total reservations (linea 1416)
      prisma.reservations.count({ where: dateFilter }),

      // Reservations by status (lineas 1420-1422, 1427)
      prisma.reservations.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { status: true }
      }),

      // Total revenue (linea 1417)
      // Prisma schema: reservations.total_amount
      prisma.reservations.aggregate({
        where: {
          ...dateFilter,
          status: { in: ['confirmed', 'completed'] }
        },
        _sum: { total_amount: true }
      }),

      // Total agencies (antes era clients, ahora agencies son los clientes)
      prisma.agencies.count({
        where: agencyFilter.agency_id ? { id: agencyFilter.agency_id } : {}
      }),

      // Total guides (linea 1419) - solo para admin
      // NOTA: el rol en BD es 'administrator', no 'admin'
      (userRole === 'administrator' || userRole === 'admin')
        ? prisma.guides.count()
        : Promise.resolve(0),

      // Average group size (linea 1423)
      // Prisma schema: reservations.participants
      prisma.reservations.aggregate({
        where: dateFilter,
        _avg: { participants: true }
      }),

      // Top destinations (linea 1424)
      // Prisma schema: reservations.tour_id
      prisma.reservations.groupBy({
        by: ['tour_id'],
        where: dateFilter,
        _count: { tour_id: true },
        orderBy: { _count: { tour_id: 'desc' } },
        take: 5
      }),

      // Top guides (linea 1425)
      // Prisma schema: reservations.guide_id
      prisma.reservations.groupBy({
        by: ['guide_id'],
        where: {
          ...dateFilter,
          guide_id: { not: null }
        },
        _count: { guide_id: true },
        orderBy: { _count: { guide_id: 'desc' } },
        take: 5
      })
    ]);

    // Procesar reservations by status
    const statusCounts = { pending: 0, confirmed: 0, cancelled: 0, completed: 0 };
    reservationsByStatus.forEach(item => {
      if (statusCounts.hasOwnProperty(item.status)) {
        statusCounts[item.status] = item._count.status;
      }
    });

    // Obtener nombres de tours para top destinations
    // Prisma schema: tours.id, tours.name
    const tourIds = topDestinations.map(d => d.tour_id);
    const tours = await prisma.tours.findMany({
      where: { id: { in: tourIds } },
      select: { id: true, name: true }
    });
    const tourMap = new Map(tours.map(t => [t.id, t.name]));

    const topDestinationsFormatted = topDestinations.map(d => ({
      name: tourMap.get(d.tour_id) || 'Tour desconocido',
      count: d._count.tour_id
    }));

    // Obtener nombres de guias para top guides
    // Prisma schema: guides.id, guides.rating, guides.user_id -> users.first_name, users.last_name
    const guideIds = topGuides.map(g => g.guide_id).filter(Boolean);
    const guides = await prisma.guides.findMany({
      where: { id: { in: guideIds } },
      select: {
        id: true,
        rating: true,
        users: { select: { first_name: true, last_name: true } }
      }
    });
    const guideMap = new Map(guides.map(g => [
      g.id,
      {
        name: `${g.users?.first_name || ''} ${g.users?.last_name || ''}`.trim(),
        rating: g.rating
      }
    ]));

    const topGuidesFormatted = topGuides
      .filter(g => g.guide_id)
      .map(g => ({
        name: guideMap.get(g.guide_id)?.name || 'Guia desconocido',
        tours: g._count.guide_id,
        rating: guideMap.get(g.guide_id)?.rating || 0
      }));

    // Revenue by month (linea 1426) - obtener datos de los ultimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Prisma schema: reservations.date, reservations.total_amount
    const monthlyRevenue = await prisma.reservations.groupBy({
      by: ['date'],
      where: {
        date: { gte: sixMonthsAgo },
        status: { in: ['confirmed', 'completed'] },
        ...agencyFilter
      },
      _sum: { total_amount: true }
    });

    // Agrupar por mes
    const revenueByMonthMap = new Map();
    monthlyRevenue.forEach(item => {
      const monthKey = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`;
      const current = revenueByMonthMap.get(monthKey) || 0;
      revenueByMonthMap.set(monthKey, formatPrice(current + (parseFloat(item._sum.total_amount) || 0)));
    });

    const revenueByMonth = Array.from(revenueByMonthMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Response segun esquema DashboardSummary (lineas 1415-1427)
    return res.status(200).json({
      totalReservations,
      totalRevenue: formatPrice(totalRevenueResult._sum.total_amount),
      totalAgencies,
      totalGuides,
      pendingReservations: statusCounts.pending,
      confirmedReservations: statusCounts.confirmed,
      completedReservations: statusCounts.completed,
      averageGroupSize: formatAverage(averageGroupResult._avg.participants),
      topDestinations: topDestinationsFormatted,
      topGuides: topGuidesFormatted,
      revenueByMonth,
      reservationsByStatus: statusCounts
    });

  } catch (error) {
    console.error('Error en getDashboardSummary:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener el resumen del dashboard'
    });
  }
};

/**
 * GET /api/dashboard/stats
 * Estadisticas del dashboard segun rol del usuario
 * Usado por: useDashboard hook (frontend)
 */
const getDashboardStats = async (req, res) => {
  try {
    const { userId, role } = req.query;
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = role || req.user?.role;
    const currentUserId = userId || req.user?.id;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // Inicio de semana (lunes)
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - mondayOffset);
    startOfWeek.setHours(0, 0, 0, 0);
    // Fin de semana (domingo 23:59:59)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    let stats = {};

    if (userRole === 'guide') {
      // Obtener el guia asociado al usuario
      // Prisma schema: guides.user_id
      const guide = await prisma.guides.findFirst({
        where: { user_id: currentUserId }
      });

      if (!guide) {
        return res.status(200).json({
          success: true,
          data: {
            toursThisWeek: 0,
            nextTour: null,
            personalRating: 0,
            monthlyIncome: 0,
            toursCompleted: 0
          }
        });
      }

      const isFreelance = guide.guide_type === 'FREELANCE';

      // Tours esta semana (reservas siempre, marketplace solo freelance)
      const toursThisWeekReservations = await prisma.reservations.count({
        where: {
          guide_id: guide.id,
          date: { gte: startOfWeek, lte: endOfWeek },
          status: { in: ['confirmed', 'completed'] }
        }
      });
      let toursThisWeekMarketplace = 0;
      if (isFreelance) {
        toursThisWeekMarketplace = await prisma.service_requests.count({
          where: {
            guide_id: guide.id,
            service_date: { gte: startOfWeek, lte: endOfWeek },
            status: { in: ['accepted', 'completed'] }
          }
        });
      }
      const toursThisWeek = toursThisWeekReservations + toursThisWeekMarketplace;

      // Proximo tour (buscar en reservas, y marketplace solo si freelance)
      const nextTourReservation = await prisma.reservations.findFirst({
        where: {
          guide_id: guide.id,
          date: { gt: now },
          status: 'confirmed'
        },
        orderBy: { date: 'asc' }
      });
      let nextTourMarketplace = null;
      if (isFreelance) {
        nextTourMarketplace = await prisma.service_requests.findFirst({
          where: {
            guide_id: guide.id,
            service_date: { gt: now },
            status: 'accepted'
          },
          orderBy: { service_date: 'asc' }
        });
      }
      // Elegir la fecha mas cercana entre ambas fuentes
      const nextReservationDate = nextTourReservation?.date || null;
      const nextMarketplaceDate = nextTourMarketplace?.service_date || null;
      let nextTourDate = null;
      if (nextReservationDate && nextMarketplaceDate) {
        nextTourDate = nextReservationDate < nextMarketplaceDate ? nextReservationDate : nextMarketplaceDate;
      } else {
        nextTourDate = nextReservationDate || nextMarketplaceDate;
      }

      // Ingresos mensuales (comisiones del guia por reservas)
      // SOLO se cuentan servicios completados, no los confirmados pendientes
      // Prisma schema: reservations.total_amount
      const monthlyReservations = await prisma.reservations.aggregate({
        where: {
          guide_id: guide.id,
          date: { gte: startOfMonth },
          status: 'completed'
        },
        _sum: { total_amount: true }
      });

      // Ingresos mensuales por servicios freelance del marketplace (solo freelance)
      let monthlyMarketplace = { _sum: { total_price: null } };
      if (isFreelance) {
        monthlyMarketplace = await prisma.service_requests.aggregate({
          where: {
            guide_id: guide.id,
            service_date: { gte: startOfMonth },
            status: 'completed'
          },
          _sum: { total_price: true }
        });
      }

      // Tours completados este mes (reservas + servicios marketplace si freelance)
      const toursCompleted = await prisma.reservations.count({
        where: {
          guide_id: guide.id,
          date: { gte: startOfMonth },
          status: 'completed'
        }
      });
      let marketplaceCompleted = 0;
      if (isFreelance) {
        marketplaceCompleted = await prisma.service_requests.count({
          where: {
            guide_id: guide.id,
            service_date: { gte: startOfMonth },
            status: 'completed'
          }
        });
      }

      // Calcular comision del guia (30% de reservas) + 100% de marketplace freelance
      const reservationRevenue = formatPrice(monthlyReservations._sum.total_amount);
      const guideCommission = formatPrice(reservationRevenue * 0.30);
      const marketplaceIncome = formatPrice(monthlyMarketplace._sum.total_price);
      const totalMonthlyIncome = formatPrice(guideCommission + marketplaceIncome);

      stats = {
        toursThisWeek,
        nextTour: nextTourDate,
        personalRating: formatAverage(guide.rating),
        monthlyIncome: totalMonthlyIncome,
        toursCompleted: toursCompleted + marketplaceCompleted
      };

    } else if (userRole === 'agency') {
      // Obtener la agencia asociada al usuario
      // Prisma schema: agencies.user_id
      const agency = await prisma.agencies.findFirst({
        where: { user_id: currentUserId }
      });

      if (!agency) {
        return res.status(200).json({
          success: true,
          data: {
            activeServices: 0,
            completedToday: 0,
            monthlyReservations: 0
          }
        });
      }

      // Servicios activos (reservaciones confirmadas futuras)
      // Prisma schema: reservations.agency_id
      const activeServices = await prisma.reservations.count({
        where: {
          agency_id: agency.id,
          date: { gte: now },
          status: 'confirmed'
        }
      });

      // Completados hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const completedToday = await prisma.reservations.count({
        where: {
          agency_id: agency.id,
          date: { gte: today, lt: tomorrow },
          status: 'completed'
        }
      });

      // Total reservaciones del mes (todas las del mes actual)
      const totalMonthlyReservations = await prisma.reservations.count({
        where: {
          agency_id: agency.id,
          date: { gte: startOfMonth }
        }
      });

      stats = {
        activeServices,
        completedToday,
        monthlyReservations: totalMonthlyReservations
      };

    } else {
      // Admin - estadisticas globales
      const [activeServices, totalAgencies, totalGuides, monthlyRevenue] = await Promise.all([
        prisma.reservations.count({
          where: {
            date: { gte: now },
            status: 'confirmed'
          }
        }),
        prisma.agencies.count({
          where: { status: 'active' }
        }),
        prisma.guides.count(),
        prisma.reservations.aggregate({
          where: {
            date: { gte: startOfMonth },
            status: { in: ['confirmed', 'completed'] }
          },
          _sum: { total_amount: true }
        })
      ]);

      stats = {
        activeServices,
        totalAgencies,
        totalGuides,
        totalRevenue: formatPrice(monthlyRevenue._sum.total_amount)
      };
    }

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error en getDashboardStats:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener estadisticas del dashboard'
    });
  }
};

/**
 * GET /api/dashboard/monthly-data
 * Datos mensuales para graficos
 * Usado por: useDashboard hook (frontend)
 */
const getMonthlyData = async (req, res) => {
  try {
    const { userId, role, months = 6 } = req.query;
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = role || req.user?.role;
    const currentUserId = userId || req.user?.id;

    const monthsBack = parseInt(months);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const monthlyMap = new Map();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Helper para acumular en el mapa mensual
    const addToMonthlyMap = (dateValue, amount, count) => {
      const date = new Date(dateValue);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
      const current = monthlyMap.get(monthKey) || { month: monthLabel, revenue: 0, count: 0 };
      current.revenue = formatPrice(current.revenue + (parseFloat(amount) || 0));
      current.count += count;
      monthlyMap.set(monthKey, current);
    };

    if (userRole === 'guide') {
      // Para guías: comisión 30% de reservas + 100% marketplace (solo freelance)
      const guide = await prisma.guides.findFirst({
        where: { user_id: currentUserId }
      });

      if (guide) {
        const isFreelance = guide.guide_type === 'FREELANCE';

        // Reservas completadas (30% comisión)
        const reservations = await prisma.reservations.groupBy({
          by: ['date'],
          where: {
            guide_id: guide.id,
            date: { gte: startDate },
            status: 'completed'
          },
          _sum: { total_amount: true },
          _count: { id: true }
        });

        reservations.forEach(item => {
          const commission = formatPrice((parseFloat(item._sum.total_amount) || 0) * 0.30);
          addToMonthlyMap(item.date, commission, item._count.id);
        });

        // Servicios marketplace completados (100%) - solo para guías freelance
        if (isFreelance) {
          const marketplaceRequests = await prisma.service_requests.groupBy({
            by: ['service_date'],
            where: {
              guide_id: guide.id,
              service_date: { gte: startDate },
              status: 'completed'
            },
            _sum: { total_price: true },
            _count: { id: true }
          });

          marketplaceRequests.forEach(item => {
            addToMonthlyMap(item.service_date, item._sum.total_price, item._count.id);
          });
        }
      }

    } else if (userRole === 'agency') {
      const agency = await prisma.agencies.findFirst({
        where: { user_id: currentUserId }
      });
      if (agency) {
        const reservations = await prisma.reservations.groupBy({
          by: ['date'],
          where: {
            agency_id: agency.id,
            date: { gte: startDate },
            status: { in: ['confirmed', 'completed'] }
          },
          _sum: { total_amount: true },
          _count: { id: true }
        });
        reservations.forEach(item => {
          addToMonthlyMap(item.date, item._sum.total_amount, item._count.id);
        });
      }

    } else {
      // Admin: todos los confirmados y completados
      const reservations = await prisma.reservations.groupBy({
        by: ['date'],
        where: {
          date: { gte: startDate },
          status: { in: ['confirmed', 'completed'] }
        },
        _sum: { total_amount: true },
        _count: { id: true }
      });
      reservations.forEach(item => {
        addToMonthlyMap(item.date, item._sum.total_amount, item._count.id);
      });
    }

    // Convertir a array ordenado
    const monthlyData = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);

    return res.status(200).json({
      success: true,
      data: monthlyData
    });

  } catch (error) {
    console.error('Error en getMonthlyData:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener datos mensuales'
    });
  }
};

/**
 * GET /api/dashboard/kpis
 * KPIs para graficos del dashboard
 * Usado por: useServiceChart hook (frontend)
 */
const getKPIs = async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Calcular fechas segun rango
    const now = new Date();
    let currentStart, previousStart, previousEnd;

    switch (timeRange) {
      case 'week':
        currentStart = new Date(now);
        currentStart.setDate(now.getDate() - 7);
        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);
        previousEnd = new Date(currentStart);
        break;
      case 'quarter':
        currentStart = new Date(now);
        currentStart.setMonth(now.getMonth() - 3);
        previousStart = new Date(currentStart);
        previousStart.setMonth(previousStart.getMonth() - 3);
        previousEnd = new Date(currentStart);
        break;
      case 'year':
        currentStart = new Date(now);
        currentStart.setFullYear(now.getFullYear() - 1);
        previousStart = new Date(currentStart);
        previousStart.setFullYear(previousStart.getFullYear() - 1);
        previousEnd = new Date(currentStart);
        break;
      default: // month
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    // Filtro por agencia si corresponde
    // Prisma schema: agencies.user_id
    let agencyFilter = {};
    if (userRole === 'agency') {
      const agency = await prisma.agencies.findFirst({
        where: { user_id: userId }
      });
      if (agency) {
        agencyFilter = { agency_id: agency.id };
      }
    }

    // Obtener metricas en paralelo
    // Prisma schema: reservations.total_amount, reservations.participants
    const [
      currentReservations,
      previousReservations,
      currentAggregate,
      previousAggregate
    ] = await Promise.all([
      prisma.reservations.count({
        where: {
          date: { gte: currentStart, lte: now },
          ...agencyFilter
        }
      }),
      prisma.reservations.count({
        where: {
          date: { gte: previousStart, lte: previousEnd },
          ...agencyFilter
        }
      }),
      prisma.reservations.aggregate({
        where: {
          date: { gte: currentStart, lte: now },
          status: { in: ['confirmed', 'completed'] },
          ...agencyFilter
        },
        _sum: { total_amount: true, participants: true }
      }),
      prisma.reservations.aggregate({
        where: {
          date: { gte: previousStart, lte: previousEnd },
          status: { in: ['confirmed', 'completed'] },
          ...agencyFilter
        },
        _sum: { total_amount: true, participants: true }
      })
    ]);

    const calcGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return formatAverage((current - previous) / previous * 100);
    };

    const currentRevenue = formatPrice(currentAggregate._sum.total_amount);
    const previousRevenue = formatPrice(previousAggregate._sum.total_amount);
    const currentTourists = currentAggregate._sum.participants || 0;
    const previousTourists = previousAggregate._sum.participants || 0;

    const kpiData = {
      totalReservas: {
        actual: currentReservations,
        anterior: previousReservations,
        crecimiento: calcGrowth(currentReservations, previousReservations)
      },
      totalTuristas: {
        actual: currentTourists,
        anterior: previousTourists,
        crecimiento: calcGrowth(currentTourists, previousTourists)
      }
    };

    // Agencias no generan ingresos - solo admin ve esta métrica
    if (userRole !== 'agency') {
      kpiData.ingresosTotales = {
        actual: currentRevenue,
        anterior: previousRevenue,
        crecimiento: calcGrowth(currentRevenue, previousRevenue)
      };
    }

    return res.status(200).json({
      success: true,
      data: kpiData
    });

  } catch (error) {
    console.error('Error en getKPIs:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener KPIs'
    });
  }
};

/**
 * GET /api/dashboard/chart-data
 * Datos para graficos del dashboard
 * Usado por: useServiceChart hook (frontend)
 */
const getChartData = async (req, res) => {
  try {
    const { type = 'line', timeRange = 'month' } = req.query;
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Calcular fechas segun rango
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Filtro por agencia si corresponde
    // Prisma schema: agencies.user_id
    let agencyFilter = {};
    if (userRole === 'agency') {
      const agency = await prisma.agencies.findFirst({
        where: { user_id: userId }
      });
      if (agency) {
        agencyFilter = { agency_id: agency.id };
      }
    }

    // Obtener datos segun tipo de grafico
    // Prisma schema: reservations.total_amount, participants
    // Solo mostrar datos hasta hoy (no incluir fechas futuras)
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Fin del día actual

    const reservations = await prisma.reservations.groupBy({
      by: ['date'],
      where: {
        date: {
          gte: startDate,
          lte: today // Limitar hasta hoy para no mostrar fechas futuras
        },
        ...agencyFilter
      },
      _sum: { total_amount: true, participants: true },
      _count: { id: true }
    });

    // Formatear datos segun tipo
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    let chartData;

    if (type === 'bar') {
      // Agrupar por tour para grafico de barras
      const byTour = await prisma.reservations.groupBy({
        by: ['tour_id'],
        where: {
          date: {
            gte: startDate,
            lte: today // Limitar hasta hoy para no mostrar fechas futuras
          },
          ...agencyFilter
        },
        _sum: { total_amount: true },
        _count: { id: true }
      });

      // Obtener nombres de tours
      const tourIds = byTour.map(item => item.tour_id);
      const tours = await prisma.tours.findMany({
        where: { id: { in: tourIds } },
        select: { id: true, name: true }
      });
      const tourMap = new Map(tours.map(t => [t.id, t.name]));

      chartData = byTour.map(item => {
        const entry = {
          tour: tourMap.get(item.tour_id) || 'Tour desconocido',
          reservas: item._count.id
        };
        if (userRole !== 'agency') {
          entry.ingresos = formatPrice(item._sum.total_amount);
        }
        return entry;
      }).sort((a, b) => b.reservas - a.reservas).slice(0, 10); // Top 10 tours
    } else {
      // Grafico de lineas - datos por dia/mes
      const dataMap = new Map();

      reservations.forEach(item => {
        const date = new Date(item.date);
        let key, label;

        if (timeRange === 'week') {
          key = date.toISOString().split('T')[0];
          label = `${dayNames[date.getDay()]} ${date.getDate()}`;
        } else if (timeRange === 'year') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          label = monthNames[date.getMonth()];
        } else {
          key = date.toISOString().split('T')[0];
          label = `${date.getDate()} ${monthNames[date.getMonth()]}`;
        }

        const defaultEntry = { name: label, reservas: 0, turistas: 0 };
        if (userRole !== 'agency') defaultEntry.ingresos = 0;
        const current = dataMap.get(key) || defaultEntry;
        current.reservas += item._count.id;
        current.turistas += item._sum.participants || 0;
        if (userRole !== 'agency') {
          current.ingresos = formatPrice((current.ingresos || 0) + (parseFloat(item._sum.total_amount) || 0));
        }
        dataMap.set(key, current);
      });

      chartData = Array.from(dataMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, data]) => data);
    }

    return res.status(200).json({
      success: true,
      data: chartData
    });

  } catch (error) {
    console.error('Error en getChartData:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener datos del grafico'
    });
  }
};

/**
 * GET /api/dashboard/summary-data
 * Resumen para el panel de exportacion
 * Usado por: useServiceChart hook (frontend)
 */
const getSummaryData = async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const now = new Date();
    let startDate;

    switch (timeRange) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Filtro por agencia si corresponde
    // Prisma schema: agencies.user_id
    let agencyFilter = {};
    if (userRole === 'agency') {
      const agency = await prisma.agencies.findFirst({
        where: { user_id: userId }
      });
      if (agency) {
        agencyFilter = { agency_id: agency.id };
      }
    }

    // Tour mas popular
    // Prisma schema: reservations.tour_id
    const popularTourResult = await prisma.reservations.groupBy({
      by: ['tour_id'],
      where: {
        date: { gte: startDate },
        ...agencyFilter
      },
      _count: { tour_id: true },
      orderBy: { _count: { tour_id: 'desc' } },
      take: 1
    });

    let popularTour = 'Sin datos';
    if (popularTourResult.length > 0) {
      const tour = await prisma.tours.findUnique({
        where: { id: popularTourResult[0].tour_id },
        select: { name: true }
      });
      popularTour = tour?.name || 'Tour desconocido';
    }

    // Promedio por reserva
    // Prisma schema: reservations.total_amount
    const avgResult = await prisma.reservations.aggregate({
      where: {
        date: { gte: startDate },
        status: { in: ['confirmed', 'completed'] },
        ...agencyFilter
      },
      _avg: { total_amount: true },
      _count: { id: true }
    });

    // Mejor dia de la semana
    const reservations = await prisma.reservations.findMany({
      where: {
        date: { gte: startDate },
        ...agencyFilter
      },
      select: { date: true }
    });

    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    reservations.forEach(r => {
      const day = new Date(r.date).getDay();
      dayCount[day]++;
    });

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const maxDay = dayCount.indexOf(Math.max(...dayCount));
    const bestDay = dayCount[maxDay] > 0 ? dayNames[maxDay] : 'Sin datos';

    // Tasa de conversion (confirmadas/total)
    const totalRes = avgResult._count.id || 0;
    const confirmedRes = await prisma.reservations.count({
      where: {
        date: { gte: startDate },
        status: { in: ['confirmed', 'completed'] },
        ...agencyFilter
      }
    });

    const conversionRate = safePercentage(confirmedRes, totalRes);

    return res.status(200).json({
      success: true,
      data: {
        popularTour,
        avgPerBooking: formatPrice(avgResult._avg.total_amount),
        bestDay,
        conversionRate
      }
    });

  } catch (error) {
    console.error('Error en getSummaryData:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener resumen'
    });
  }
};

module.exports = {
  getDashboardSummary,
  getDashboardStats,
  getMonthlyData,
  getKPIs,
  getChartData,
  getSummaryData
};
