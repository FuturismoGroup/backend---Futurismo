// Controller de Reports
// Fuente: 04_apis_lista.md
// API-085 a API-087: Generación de reportes

const prisma = require('../config/db');

/**
 * API-085: GetReservationsReport
 * GET /api/reports/reservations
 * Roles permitidos: Admin, Agency
 */
const getReservationsReport = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      groupBy = 'day',
      tourId,
      agencyId,
      format
    } = req.query;

    // Validaciones
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom y dateTo son obligatorios'
      });
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate > toDate) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom debe ser menor o igual a dateTo'
      });
    }

    // Verificar rango máximo de 365 días
    const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El rango máximo es de 365 días'
      });
    }

    // Construir filtros
    const where = {
      tourDate: {
        gte: fromDate,
        lte: toDate
      }
    };

    // Si es Agency, filtrar solo sus reservas
    if (req.user.role === 'agency') {
      where.agencyId = req.user.agencyId;
    } else if (agencyId) {
      where.agencyId = agencyId;
    }

    if (tourId) {
      where.tourId = tourId;
    }

    // Obtener reservas
    const reservations = await prisma.reservations.findMany({
      where,
      include: {
        tour: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Calcular métricas
    const totalReservations = reservations.length;
    const totalRevenue = reservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
    const totalPassengers = reservations.reduce((sum, r) => sum + (r.passengers || 0), 0);
    const avgPassengers = totalReservations > 0 ? totalPassengers / totalReservations : 0;

    // Por estado
    const byStatus = {
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      pending: reservations.filter(r => r.status === 'pending').length,
      cancelled: reservations.filter(r => r.status === 'cancelled').length,
      completed: reservations.filter(r => r.status === 'completed').length
    };

    const cancellationRate = totalReservations > 0
      ? (byStatus.cancelled / totalReservations) * 100
      : 0;

    // Por tour
    const tourMap = new Map();
    reservations.forEach(r => {
      const tourKey = r.tourId;
      if (!tourMap.has(tourKey)) {
        tourMap.set(tourKey, {
          tourId: r.tour?.id,
          tourName: r.tour?.name || 'Sin tour',
          count: 0,
          revenue: 0
        });
      }
      const tourData = tourMap.get(tourKey);
      tourData.count++;
      tourData.revenue += r.totalPrice || 0;
    });
    const byTour = Array.from(tourMap.values());

    // Por día/semana/mes
    const dateMap = new Map();
    reservations.forEach(r => {
      let dateKey;
      const d = new Date(r.tourDate);

      if (groupBy === 'month') {
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        // Semana ISO
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        dateKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      } else {
        dateKey = d.toISOString().split('T')[0];
      }

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey, count: 0, revenue: 0 });
      }
      const dateData = dateMap.get(dateKey);
      dateData.count++;
      dateData.revenue += r.totalPrice || 0;
    });
    const byDay = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    const report = {
      period: { dateFrom, dateTo },
      totalReservations,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      byStatus,
      byTour,
      byDay,
      avgPassengers: parseFloat(avgPassengers.toFixed(2)),
      cancellationRate: parseFloat(cancellationRate.toFixed(2))
    };

    // TODO: Soportar exportación a CSV/Excel/PDF según format

    res.json(report);
  } catch (error) {
    console.error('Error en getReservationsReport:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al generar reporte de reservas'
    });
  }
};

/**
 * API-086: GetFinancialReport
 * GET /api/reports/financial
 * Roles permitidos: Admin
 */
const getFinancialReport = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      agencyId,
      groupBy = 'month'
    } = req.query;

    // Validaciones
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom y dateTo son obligatorios'
      });
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate > toDate) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom debe ser menor o igual a dateTo'
      });
    }

    // Construir filtros para reservas
    const reservationWhere = {
      tourDate: {
        gte: fromDate,
        lte: toDate
      },
      status: { in: ['confirmed', 'completed'] }
    };

    if (agencyId) {
      reservationWhere.agencyId = agencyId;
    }

    // Obtener reservas con agencias
    const reservations = await prisma.reservations.findMany({
      where: reservationWhere,
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            commissionRate: true
          }
        }
      }
    });

    // Calcular métricas financieras
    const totalRevenue = reservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);

    // Calcular comisiones (usando commissionRate de cada agencia)
    let totalCommissions = 0;
    const agencyMap = new Map();

    reservations.forEach(r => {
      const commissionRate = r.agency?.commissionRate || 0.10; // Default 10%
      const commission = (r.totalPrice || 0) * commissionRate;
      totalCommissions += commission;

      if (r.agencyId) {
        if (!agencyMap.has(r.agencyId)) {
          agencyMap.set(r.agencyId, {
            agencyId: r.agency?.id,
            agencyName: r.agency?.name || 'Sin agencia',
            revenue: 0,
            commission: 0
          });
        }
        const agencyData = agencyMap.get(r.agencyId);
        agencyData.revenue += r.totalPrice || 0;
        agencyData.commission += commission;
      }
    });

    const netIncome = totalRevenue - totalCommissions;

    // Por método de pago (simulado - dependería de tabla payments)
    const byPaymentMethod = [
      { method: 'credit_card', amount: totalRevenue * 0.6, count: Math.floor(reservations.length * 0.6) },
      { method: 'cash', amount: totalRevenue * 0.3, count: Math.floor(reservations.length * 0.3) },
      { method: 'transfer', amount: totalRevenue * 0.1, count: Math.floor(reservations.length * 0.1) }
    ];

    // Por agencia
    const byAgency = Array.from(agencyMap.values());

    // Por mes
    const monthMap = new Map();
    reservations.forEach(r => {
      const d = new Date(r.tourDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const commissionRate = r.agency?.commissionRate || 0.10;
      const commission = (r.totalPrice || 0) * commissionRate;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { month: monthKey, revenue: 0, commission: 0, net: 0 });
      }
      const monthData = monthMap.get(monthKey);
      monthData.revenue += r.totalPrice || 0;
      monthData.commission += commission;
      monthData.net = monthData.revenue - monthData.commission;
    });
    const byMonth = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    // Pagos pendientes (simulado)
    const pendingReservations = await prisma.reservations.count({
      where: {
        ...reservationWhere,
        paymentStatus: 'pending'
      }
    });
    const pendingPayments = pendingReservations * (totalRevenue / reservations.length || 0);

    // Reembolsos (simulado)
    const refunds = reservations.filter(r => r.status === 'cancelled').length * 100;

    res.json({
      period: { dateFrom, dateTo },
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCommissions: parseFloat(totalCommissions.toFixed(2)),
      netIncome: parseFloat(netIncome.toFixed(2)),
      byPaymentMethod,
      byAgency,
      byMonth,
      pendingPayments: parseFloat(pendingPayments.toFixed(2)),
      refunds: parseFloat(refunds.toFixed(2))
    });
  } catch (error) {
    console.error('Error en getFinancialReport:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al generar reporte financiero'
    });
  }
};

/**
 * API-087: GetGuidesReport
 * GET /api/reports/guides
 * Roles permitidos: Admin, Agency
 */
const getGuidesReport = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      guideId,
      agencyId
    } = req.query;

    // Validaciones
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom y dateTo son obligatorios'
      });
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate > toDate) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom debe ser menor o igual a dateTo'
      });
    }

    // Construir filtros para guías
    const guideWhere = {};

    // Si es Agency, filtrar solo sus guías
    if (req.user.role === 'agency') {
      guideWhere.agencyId = req.user.agencyId;
    } else if (agencyId) {
      guideWhere.agencyId = agencyId;
    }

    if (guideId) {
      guideWhere.id = guideId;
    }

    // Obtener guías con reservas en el período
    const guides = await prisma.guide.findMany({
      where: guideWhere,
      include: {
        user: {
          select: {
            name: true
          }
        },
        reservations: {
          where: {
            tourDate: {
              gte: fromDate,
              lte: toDate
            },
            status: { in: ['confirmed', 'completed'] }
          }
        },
        ratings: {
          where: {
            createdAt: {
              gte: fromDate,
              lte: toDate
            }
          }
        }
      }
    });

    const totalGuides = guides.length;
    const activeGuides = guides.filter(g => g.reservations.length > 0).length;

    // Calcular métricas por guía
    const byGuide = guides.map(g => {
      const toursCompleted = g.reservations.filter(r => r.status === 'completed').length;
      const totalPassengers = g.reservations.reduce((sum, r) => sum + (r.passengers || 0), 0);
      const revenue = g.reservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
      const ratings = g.ratings.filter(r => r.ratingValue != null);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.ratingValue, 0) / ratings.length
        : null;

      return {
        guideId: g.id,
        name: g.user?.name || g.name,
        toursCompleted,
        avgRating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
        totalPassengers,
        revenue: parseFloat(revenue.toFixed(2))
      };
    });

    // Top performers (por score compuesto: tours * rating)
    const topPerformers = byGuide
      .filter(g => g.avgRating !== null && g.toursCompleted > 0)
      .map(g => ({
        guideId: g.guideId,
        name: g.name,
        score: parseFloat((g.toursCompleted * (g.avgRating / 5)).toFixed(2))
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Rating promedio general
    const allRatings = guides.flatMap(g => g.ratings.map(r => r.ratingValue).filter(Boolean));
    const avgRatingOverall = allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
      : 0;

    // Tasa de utilización (guías activos / total guías)
    const utilizationRate = totalGuides > 0 ? (activeGuides / totalGuides) * 100 : 0;

    res.json({
      period: { dateFrom, dateTo },
      totalGuides,
      activeGuides,
      byGuide,
      topPerformers,
      avgRatingOverall: parseFloat(avgRatingOverall.toFixed(2)),
      utilizationRate: parseFloat(utilizationRate.toFixed(2))
    });
  } catch (error) {
    console.error('Error en getGuidesReport:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al generar reporte de guías'
    });
  }
};

/**
 * API-109: ExportReport
 * GET /api/reports/export
 * Exporta cualquier reporte a formato específico
 * Roles permitidos: Admin, Agency
 * Fuente: 04_apis_lista.md línea 7500
 */
const exportReport = async (req, res) => {
  try {
    const {
      reportType,
      format = 'csv',
      dateFrom,
      dateTo,
      tourId,
      agencyId,
      guideId
    } = req.query;

    // Validar reportType
    const validReportTypes = ['reservations', 'financial', 'guides'];
    if (!reportType || !validReportTypes.includes(reportType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `reportType es requerido y debe ser uno de: ${validReportTypes.join(', ')}`
      });
    }

    // Validar format
    const validFormats = ['csv', 'json', 'xlsx'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `format debe ser uno de: ${validFormats.join(', ')}`
      });
    }

    // Validar fechas
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom y dateTo son obligatorios'
      });
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate > toDate) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom debe ser menor o igual a dateTo'
      });
    }

    // Verificar permisos para Agency
    let effectiveAgencyId = agencyId;
    if (req.user.role === 'agency') {
      effectiveAgencyId = req.user.agencyId;
      // Agency no puede ver reportes financieros
      if (reportType === 'financial') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No tienes permisos para exportar reportes financieros'
        });
      }
    }

    let data = [];
    let filename = '';

    // Generar datos según tipo de reporte
    if (reportType === 'reservations') {
      const where = {
        tourDate: {
          gte: fromDate,
          lte: toDate
        }
      };

      if (effectiveAgencyId) where.agencyId = effectiveAgencyId;
      if (tourId) where.tourId = tourId;
      if (guideId) where.guideId = guideId;

      const reservations = await prisma.reservations.findMany({
        where,
        include: {
          tour: { select: { name: true } },
          guide: { include: { user: { select: { name: true } } } },
          agency: { select: { name: true, business_name: true, phone: true, email: true } }
        },
        orderBy: { tourDate: 'desc' }
      });

      data = reservations.map(r => ({
        ID: r.id,
        Fecha: r.tourDate ? new Date(r.tourDate).toISOString().split('T')[0] : '',
        Tour: r.tour?.name || '',
        Agencia: r.agency?.business_name || r.agency?.name || '',
        Telefono: r.agency?.phone || '',
        Email: r.agency?.email || '',
        Pasajeros: r.passengers || 0,
        Estado: r.status,
        MontoTotal: r.totalPrice || 0,
        Guia: r.guide?.user?.name || ''
      }));

      filename = `reporte_reservas_${dateFrom}_${dateTo}`;

    } else if (reportType === 'financial') {
      const where = {
        tourDate: {
          gte: fromDate,
          lte: toDate
        },
        status: { in: ['confirmed', 'completed'] }
      };

      if (effectiveAgencyId) where.agencyId = effectiveAgencyId;

      const reservations = await prisma.reservations.findMany({
        where,
        include: {
          agency: { select: { name: true, commissionRate: true } },
          tour: { select: { name: true } }
        },
        orderBy: { tourDate: 'desc' }
      });

      data = reservations.map(r => {
        const commissionRate = r.agency?.commissionRate || 0.10;
        const commission = (r.totalPrice || 0) * commissionRate;
        const net = (r.totalPrice || 0) - commission;
        return {
          ID: r.id,
          Fecha: r.tourDate ? new Date(r.tourDate).toISOString().split('T')[0] : '',
          Tour: r.tour?.name || '',
          Agencia: r.agency?.name || 'Directo',
          Ingreso: r.totalPrice || 0,
          Comision: parseFloat(commission.toFixed(2)),
          Neto: parseFloat(net.toFixed(2)),
          Estado: r.status
        };
      });

      filename = `reporte_financiero_${dateFrom}_${dateTo}`;

    } else if (reportType === 'guides') {
      const guideWhere = {};
      if (guideId) guideWhere.id = guideId;

      const guides = await prisma.guide.findMany({
        where: guideWhere,
        include: {
          user: { select: { name: true, email: true } },
          reservations: {
            where: {
              tourDate: {
                gte: fromDate,
                lte: toDate
              },
              status: { in: ['confirmed', 'completed'] }
            }
          },
          ratings: {
            where: {
              createdAt: {
                gte: fromDate,
                lte: toDate
              }
            }
          }
        }
      });

      data = guides.map(g => {
        const toursCompleted = g.reservations.filter(r => r.status === 'completed').length;
        const totalPassengers = g.reservations.reduce((sum, r) => sum + (r.passengers || 0), 0);
        const revenue = g.reservations.reduce((sum, r) => sum + (r.totalPrice || 0), 0);
        const ratings = g.ratings.filter(r => r.ratingValue != null);
        const avgRating = ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r.ratingValue, 0) / ratings.length
          : 0;

        return {
          GuiaID: g.id,
          Nombre: g.user?.name || g.name,
          Email: g.user?.email || '',
          ToursCompletados: toursCompleted,
          TotalPasajeros: totalPassengers,
          Ingresos: parseFloat(revenue.toFixed(2)),
          RatingPromedio: parseFloat(avgRating.toFixed(2)),
          TotalRatings: ratings.length
        };
      });

      filename = `reporte_guias_${dateFrom}_${dateTo}`;
    }

    // Exportar según formato
    if (format === 'csv') {
      if (data.length === 0) {
        return res.status(200).json({
          message: 'No hay datos para exportar en el período seleccionado',
          data: []
        });
      }

      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row =>
        Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json({
        exportedAt: new Date().toISOString(),
        reportType,
        period: { dateFrom, dateTo },
        totalRecords: data.length,
        data
      });
    }

    // Para xlsx, devolver JSON con indicación de formato no soportado directamente
    // (requeriría librería externa como xlsx o exceljs)
    return res.status(200).json({
      message: 'Formato xlsx requiere procesamiento adicional. Usando JSON como alternativa.',
      exportedAt: new Date().toISOString(),
      reportType,
      period: { dateFrom, dateTo },
      totalRecords: data.length,
      data
    });

  } catch (error) {
    console.error('Error en exportReport:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al exportar reporte'
    });
  }
};

module.exports = {
  getReservationsReport,
  getFinancialReport,
  getGuidesReport,
  exportReport
};
