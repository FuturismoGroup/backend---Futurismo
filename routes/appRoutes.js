// Routes de App Init
// Endpoint para inicializacion de la aplicacion frontend
// Soporta ELM-497: Recent Activity Section (Dashboard.migrated.jsx)

const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const { authenticate } = require('../middlewares/auth');

/**
 * GET /api/app/init
 * Endpoint de inicializacion de la aplicacion
 * Devuelve datos iniciales segun rol del usuario
 *
 * Query params:
 *   - role: string (admin|agency|guide|client)
 *   - userId: string (UUID del usuario)
 *
 * Response:
 *   - user: datos basicos del usuario
 *   - permissions: permisos segun rol
 *   - constants: constantes del sistema
 *   - recent_data: datos recientes (reservaciones, etc.)
 *
 * Soporta:
 *   - ELM-497: Recent Activity Section (recent_data.recent_reservations)
 */
router.get('/init', authenticate, async (req, res) => {
  try {
    const { role, userId } = req.query;
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = role || req.user?.role;
    const currentUserId = userId || req.user?.id;

    // Obtener datos del usuario actual
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { name: true } },
        status: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Usuario no encontrado'
      });
    }

    // Determinar filtro segun rol
    let reservationFilter = {};

    if (userRole === 'agency') {
      const agency = await prisma.agency.findUnique({
        where: { userId: currentUserId }
      });
      if (agency) {
        reservationFilter.agencyId = agency.id;
      }
    } else if (userRole === 'guide') {
      const guide = await prisma.guide.findUnique({
        where: { userId: currentUserId }
      });
      if (guide) {
        reservationFilter.guideId = guide.id;
      }
    }
    // Admin ve todas las reservaciones (sin filtro adicional)

    // Obtener ultimas 5 reservaciones recientes
    // Usado por ELM-497: Recent Activity Section
    const recentReservations = await prisma.reservations.findMany({
      where: reservationFilter,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        date: true,
        totalAmount: true,
        participants: true,
        tour: {
          select: {
            id: true,
            name: true
          }
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Formatear reservaciones para el frontend
    const formattedReservations = recentReservations.map(r => ({
      id: r.id,
      status: r.status,
      created_at: r.createdAt,
      date: r.date,
      total_amount: r.totalAmount,
      participants: r.participants,
      tour_name: r.tour?.name || 'Tour no especificado',
      agency_name: r.agency?.business_name || r.agency?.name || 'Agencia no especificada'
    }));

    // Definir permisos segun rol
    const permissions = {
      can_export_data: userRole === 'admin' || userRole === 'agency',
      can_view_advanced_stats: userRole === 'admin',
      can_manage_users: userRole === 'admin',
      can_manage_tours: userRole === 'admin' || userRole === 'agency',
      can_manage_reservations: userRole === 'admin' || userRole === 'agency',
      can_view_reports: userRole === 'admin' || userRole === 'agency'
    };

    // Constantes del sistema
    const constants = {
      GREETING_MESSAGES: {
        MORNING: 'Buenos dias',
        AFTERNOON: 'Buenas tardes',
        EVENING: 'Buenas noches'
      },
      RESERVATION_STATUS: {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
      },
      USER_ROLES: {
        ADMIN: 'admin',
        AGENCY: 'agency',
        GUIDE: 'guide',
        CLIENT: 'client'
      }
    };

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email,
          role: user.role?.name?.toLowerCase() || userRole,
          status: user.status
        },
        permissions,
        constants,
        recent_data: {
          recent_reservations: formattedReservations
        }
      }
    });

  } catch (error) {
    console.error('Error en GET /api/app/init:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al inicializar la aplicacion'
    });
  }
});

/**
 * GET /api/app/role-data/:role
 * Datos especificos segun rol
 *
 * Path params:
 *   - role: string (admin|agency|guide|client)
 *
 * Query params:
 *   - userId: string (UUID del usuario)
 */
router.get('/role-data/:role', authenticate, async (req, res) => {
  try {
    const { role } = req.params;
    const { userId } = req.query;
    const currentUserId = userId || req.user?.id;

    let roleData = {};

    switch (role) {
      case 'admin':
        // Obtener estadisticas globales para admin
        const [totalUsers, totalAgencies, totalGuides, totalTours] = await Promise.all([
          prisma.user.count({ where: { status: 'active' } }),
          prisma.agency.count({ where: { status: 'active' } }),
          prisma.guide.count({ where: { status: 'active' } }),
          prisma.tour.count({ where: { status: 'active' } })
        ]);
        roleData = { totalUsers, totalAgencies, totalGuides, totalTours };
        break;

      case 'agency':
        // Obtener datos de la agencia
        const agency = await prisma.agency.findUnique({
          where: { userId: currentUserId },
          include: {
            _count: {
              select: {
                reservations: true,
                tours: true,
                guides: true
              }
            }
          }
        });
        if (agency) {
          roleData = {
            agencyId: agency.id,
            agencyName: agency.name,
            totalReservations: agency._count.reservations,
            totalTours: agency._count.tours,
            totalGuides: agency._count.guides
          };
        }
        break;

      case 'guide':
        // Obtener datos del guia
        const guide = await prisma.guide.findUnique({
          where: { userId: currentUserId },
          select: {
            id: true,
            rating: true,
            completedTours: true,
            status: true,
            _count: {
              select: {
                reservations: true
              }
            }
          }
        });
        if (guide) {
          roleData = {
            guideId: guide.id,
            rating: guide.rating,
            completedTours: guide.completedTours || 0,
            status: guide.status,
            totalAssignments: guide._count.reservations
          };
        }
        break;

      default:
        roleData = {};
    }

    return res.status(200).json({
      success: true,
      data: roleData
    });

  } catch (error) {
    console.error('Error en GET /api/app/role-data:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener datos del rol'
    });
  }
});

// =============================================================================
// DATA SECTION ROUTES
// Endpoints para obtener datos por seccion (usado por historyStore)
// Soporta ELM-547: History, ELM-548: Quick Stats Cards
// =============================================================================

/**
 * GET /api/data/section/:section
 * Obtiene datos de una seccion especifica
 * Secciones soportadas: tours, guides, drivers, vehicles
 */
router.get('/data/section/:section', authenticate, async (req, res) => {
  try {
    const { section } = req.params;
    const { page = 1, pageSize = 50, status, searchTerm } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    let data = [];
    let total = 0;

    switch (section) {
      case 'tours':
        // Obtener tours
        const toursWhere = { active: true };
        if (searchTerm) {
          toursWhere.OR = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } }
          ];
        }

        [data, total] = await Promise.all([
          prisma.tours.findMany({
            where: toursWhere,
            skip,
            take: pageSizeNum,
            orderBy: { created_at: 'desc' },
            select: {
              id: true,
              name: true,
              description: true,
              duration: true,
              price: true,
              active: true,
              category: true,
              created_at: true
            }
          }),
          prisma.tours.count({ where: toursWhere })
        ]);

        data = data.map(tour => ({
          id: tour.id,
          name: tour.name,
          description: tour.description,
          duration: tour.duration,
          price: tour.price,
          active: tour.active,
          category: tour.category,
          createdAt: tour.created_at
        }));
        break;

      case 'guides':
        // Obtener guias
        const guidesWhere = {};

        [data, total] = await Promise.all([
          prisma.guides.findMany({
            where: guidesWhere,
            skip,
            take: pageSizeNum,
            orderBy: { created_at: 'desc' },
            include: {
              users: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  status: true
                }
              }
            }
          }),
          prisma.guides.count({ where: guidesWhere })
        ]);

        data = data.map(guide => ({
          id: guide.id,
          name: `${guide.users?.first_name || ''} ${guide.users?.last_name || ''}`.trim(),
          email: guide.users?.email,
          status: guide.users?.status || 'active',
          guideType: guide.guide_type,
          rating: guide.rating,
          languages: guide.languages,
          createdAt: guide.created_at
        }));
        break;

      case 'drivers':
        // Obtener conductores
        const driversWhere = {};

        [data, total] = await Promise.all([
          prisma.drivers.findMany({
            where: driversWhere,
            skip,
            take: pageSizeNum,
            orderBy: { created_at: 'desc' }
          }),
          prisma.drivers.count({ where: driversWhere })
        ]);

        data = data.map(driver => ({
          id: driver.id,
          name: `${driver.first_name || ''} ${driver.last_name || ''}`.trim(),
          email: driver.email,
          status: driver.status,
          licenseNumber: driver.license_number,
          licenseExpiry: driver.license_expiry,
          phone: driver.phone,
          createdAt: driver.created_at
        }));
        break;

      case 'vehicles':
        // Obtener vehiculos
        const vehiclesWhere = {};
        if (status) {
          vehiclesWhere.status = status;
        }

        [data, total] = await Promise.all([
          prisma.vehicles.findMany({
            where: vehiclesWhere,
            skip,
            take: pageSizeNum,
            orderBy: { created_at: 'desc' }
          }),
          prisma.vehicles.count({ where: vehiclesWhere })
        ]);

        data = data.map(vehicle => ({
          id: vehicle.id,
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          capacity: vehicle.capacity,
          status: vehicle.status,
          vehicleType: vehicle.vehicle_type,
          createdAt: vehicle.created_at
        }));
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Seccion '${section}' no soportada. Secciones validas: tours, guides, drivers, vehicles`
        });
    }

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });

  } catch (error) {
    console.error(`Error en GET /api/data/section/${req.params.section}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener datos de la seccion'
    });
  }
});

module.exports = router;
