// Controller de Agencies
// Fuente: 04_apis_lista.md líneas 2290-2588
// API-031 a API-035: Agencies CRUD y reservas

const prisma = require('../config/db');

/**
 * API-031: ListAgencies
 * GET /api/agencies
 * Línea 04_apis_lista: 2290
 *
 * Alineado con schema Prisma (tabla agencies):
 * - business_name, ruc, agency_phone, agency_email, agency_address, status, level
 */
const listAgencies = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      status,
      type,
      pointsLevel,
      level,
      searchTerm
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    // Construir filtros usando columnas reales del schema
    const where = {};

    // Filtrar por status - por defecto excluir agencias eliminadas
    if (status) {
      where.status = status;
    } else {
      // Si no se especifica status, excluir las eliminadas
      where.status = { not: 'deleted' };
    }

    // level en schema (bronze, silver, gold, platinum)
    if (pointsLevel || level) {
      where.level = pointsLevel || level;
    }

    if (searchTerm) {
      where.OR = [
        { business_name: { contains: searchTerm, mode: 'insensitive' } },
        { ruc: { contains: searchTerm } }
      ];
    }

    const [agencies, total] = await Promise.all([
      prisma.agencies.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          users: {
            select: {
              id: true,
              username: true,
              email: true,
              first_name: true,
              last_name: true,
              status: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.agencies.count({ where })
    ]);

    // Mapear respuesta con nombres compatibles para frontend
    const data = agencies.map(agency => ({
      id: agency.id,
      user_id: agency.user_id,
      // Nombres compatibles frontend
      name: agency.business_name,
      company_name: agency.business_name,
      businessName: agency.business_name,
      ruc: agency.ruc,
      tax_id: agency.ruc,
      // Address
      address: agency.agency_address,
      agencyAddress: agency.agency_address,
      // Phone
      phone: agency.agency_phone,
      contact_phone: agency.agency_phone,
      agencyPhone: agency.agency_phone,
      // Email
      email: agency.agency_email,
      contact_email: agency.agency_email,
      agencyEmail: agency.agency_email,
      // Otros campos
      whatsapp: agency.whatsapp,
      position: agency.position,
      status: agency.status,
      level: agency.level,
      pointsLevel: agency.level,
      verified: agency.verified,
      rating: agency.rating,
      total_reviews: agency.total_reviews,
      total_tours: agency.total_tours,
      available_points: agency.available_points,
      availablePoints: agency.available_points,
      total_points: agency.total_points,
      // Contactos de agencia (ELM-312 ContactDataSection)
      contacts: agency.contacts || [],
      // Usuario asociado
      user: agency.users ? {
        id: agency.users.id,
        username: agency.users.username,
        email: agency.users.email,
        first_name: agency.users.first_name,
        last_name: agency.users.last_name,
        status: agency.users.status
      } : null,
      createdAt: agency.created_at,
      created_at: agency.created_at
    }));

    res.json({
      success: true,
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error) {
    console.error('Error en listAgencies:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener agencias',
      details: error.message
    });
  }
};

/**
 * API-032: GetAgency
 * GET /api/agencies/:id
 * Línea 04_apis_lista: 2382
 *
 * Alineado con schema Prisma (tabla agencies):
 * - business_name, ruc, agency_phone, agency_email, agency_address, status, level
 */
const getAgency = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de agencia inválido' });
    }

    // Verificar acceso: Agency solo puede ver su propia agencia
    if (req.user.role === 'agency' && req.user.agencyId !== id) {
      return res.status(403).json({ success: false, error: 'No autorizado para ver esta agencia' });
    }

    const agency = await prisma.agencies.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            first_name: true,
            last_name: true,
            status: true,
            created_at: true
          }
        },
        agency_payment_methods: {
          orderBy: [{ is_main: 'desc' }, { sort_order: 'asc' }, { created_at: 'asc' }]
        }
      }
    });

    if (!agency) {
      return res.status(404).json({ success: false, error: 'Agencia no encontrada' });
    }

    // Mapear agency_payment_methods a camelCase
    const paymentMethods = (agency.agency_payment_methods || []).map(pm => ({
      id: pm.id,
      agencyId: pm.agency_id,
      type: pm.type,
      label: pm.label,
      bank: pm.bank,
      accountNumber: pm.account_number,
      cci: pm.cci,
      cardNumber: pm.card_number,
      phoneNumber: pm.phone_number,
      holderName: pm.holder_name,
      currency: pm.currency,
      accountType: pm.account_type,
      cardType: pm.card_type,
      expiryDate: pm.expiry_date,
      description: pm.description,
      isMain: pm.is_main,
      isActive: pm.is_active,
      sortOrder: pm.sort_order,
      createdAt: pm.created_at,
      updatedAt: pm.updated_at
    }));

    // Respuesta con nombres compatibles para frontend
    res.json({
      success: true,
      data: {
        id: agency.id,
        user_id: agency.user_id,
        // Nombres compatibles frontend
        name: agency.business_name,
        company_name: agency.business_name,
        businessName: agency.business_name,
        ruc: agency.ruc,
        tax_id: agency.ruc,
        // Address
        address: agency.agency_address,
        agencyAddress: agency.agency_address,
        // Phone
        phone: agency.agency_phone,
        contact_phone: agency.agency_phone,
        agencyPhone: agency.agency_phone,
        // Email
        email: agency.agency_email,
        contact_email: agency.agency_email,
        agencyEmail: agency.agency_email,
        // Otros campos
        whatsapp: agency.whatsapp,
        position: agency.position,
        status: agency.status,
        level: agency.level,
        pointsLevel: agency.level,
        verified: agency.verified,
        rating: agency.rating,
        total_reviews: agency.total_reviews,
        total_tours: agency.total_tours,
        available_points: agency.available_points,
        availablePoints: agency.available_points,
        total_points: agency.total_points,
        certifications: agency.certifications,
        specialties: agency.specialties,
        languages: agency.languages,
        // Contactos de agencia (ELM-312 ContactDataSection)
        contacts: agency.contacts || [],
        // Metodos de pago de agencia (tabla relacional agency_payment_methods)
        payment_methods: paymentMethods,
        // Usuario asociado
        user: agency.users ? {
          id: agency.users.id,
          username: agency.users.username,
          email: agency.users.email,
          first_name: agency.users.first_name,
          last_name: agency.users.last_name,
          status: agency.users.status,
          created_at: agency.users.created_at
        } : null,
        createdAt: agency.created_at,
        created_at: agency.created_at,
        updatedAt: agency.updated_at,
        updated_at: agency.updated_at
      }
    });
  } catch (error) {
    console.error('Error en getAgency:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener agencia',
      details: error.message
    });
  }
};

/**
 * API-033: CreateAgency
 * POST /api/agencies
 * Línea 04_apis_lista: 2456
 *
 * Alineado con schema Prisma (tablas users y agencies):
 * - agencies: business_name, ruc, agency_phone, agency_email, agency_address, status, level
 * - users: username, email, password_hash, first_name, last_name, role_id
 */
const createAgency = async (req, res) => {
  try {
    const body = req.body;

    // Extraer con fallback para compatibilidad
    const businessName = body.businessName || body.name || body.company_name;
    const ruc = body.ruc || body.tax_id;
    const agencyPhone = body.phone || body.agencyPhone || body.contact_phone;
    const agencyEmail = body.email || body.agencyEmail || body.contact_email;
    const agencyAddress = body.address || body.agencyAddress;
    const firstName = body.firstName || body.first_name || body.contactName || 'Admin';
    const lastName = body.lastName || body.last_name || businessName || 'Agency';
    const username = body.username;
    const password = body.password;

    // Validaciones
    if (!businessName || !ruc || !agencyEmail || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: businessName, ruc, email, username, password'
      });
    }

    // Validar RUC (11 dígitos)
    if (!/^\d{11}$/.test(ruc)) {
      return res.status(400).json({ success: false, error: 'RUC debe tener 11 dígitos' });
    }

    // Validar password
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password debe tener al menos 8 caracteres' });
    }

    // Verificar duplicados
    const existingRuc = await prisma.agencies.findUnique({ where: { ruc } });
    if (existingRuc) {
      return res.status(409).json({ success: false, error: 'RUC ya registrado' });
    }

    const existingEmail = await prisma.agencies.findFirst({ where: { agency_email: agencyEmail } });
    if (existingEmail) {
      return res.status(409).json({ success: false, error: 'Email de agencia ya registrado' });
    }

    const existingUsername = await prisma.users.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ success: false, error: 'Username ya existe' });
    }

    // Buscar rol agency
    const agencyRole = await prisma.roles.findFirst({ where: { name: 'agency' } });
    if (!agencyRole) {
      return res.status(500).json({ success: false, error: 'Rol agency no encontrado en BD' });
    }

    // Hashear password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario y agencia en transacción
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          username,
          email: agencyEmail,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          role_id: agencyRole.role_id,
          status: 'active'
        }
      });

      const agency = await tx.agencies.create({
        data: {
          user_id: user.id,
          business_name: businessName,
          ruc,
          agency_address: agencyAddress,
          agency_phone: agencyPhone,
          agency_email: agencyEmail,
          status: 'active',
          level: 'bronze',
          available_points: 0,
          total_points: 0
        }
      });

      return { user, agency };
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.agency.id,
        user_id: result.user.id,
        name: result.agency.business_name,
        businessName: result.agency.business_name,
        ruc: result.agency.ruc,
        email: result.agency.agency_email,
        available_points: 0,
        level: 'bronze',
        createdAt: result.agency.created_at
      }
    });
  } catch (error) {
    console.error('Error en createAgency:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear agencia',
      details: error.message
    });
  }
};

/**
 * API-034: UpdateAgency
 * PUT /api/agencies/:id
 * Línea 04_apis_lista: 2526
 *
 * Alineado con schema Prisma (tabla agencies):
 * - business_name, ruc, agency_phone, agency_email, agency_address, whatsapp, position
 *
 * Acepta nombres frontend duplicados para compatibilidad:
 * - businessName/name/company_name -> business_name
 * - phone/contact_phone/agencyPhone -> agency_phone
 * - email/contact_email/agencyEmail -> agency_email
 * - address/agencyAddress -> agency_address
 */
const updateAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de agencia inválido' });
    }

    // Verificar acceso
    if (req.user.role === 'agency' && req.user.agencyId !== id) {
      return res.status(403).json({ error: 'No autorizado para editar esta agencia' });
    }

    const existingAgency = await prisma.agencies.findUnique({ where: { id } });
    if (!existingAgency) {
      return res.status(404).json({ error: 'Agencia no encontrada' });
    }

    // Extraer valores con fallback para compatibilidad frontend
    const businessName = body.businessName || body.name || body.company_name;
    const agencyPhone = body.phone || body.contact_phone || body.agencyPhone;
    const agencyEmail = body.email || body.contact_email || body.agencyEmail;
    const agencyAddress = body.address || body.agencyAddress;
    const whatsapp = body.whatsapp;
    const position = body.position;
    const contacts = body.contacts; // Array de contactos de la agencia (FLW-083)

    // Verificar email único si se cambia
    if (agencyEmail && agencyEmail !== existingAgency.agency_email) {
      const emailExists = await prisma.agencies.findFirst({
        where: { agency_email: agencyEmail, id: { not: id } }
      });
      if (emailExists) {
        return res.status(409).json({ error: 'Email ya registrado por otra agencia' });
      }
    }

    // Construir objeto de actualización con columnas reales del schema
    const updateData = {};
    if (businessName) updateData.business_name = businessName;
    if (agencyAddress !== undefined) updateData.agency_address = agencyAddress;
    if (agencyPhone !== undefined) updateData.agency_phone = agencyPhone;
    if (agencyEmail) updateData.agency_email = agencyEmail;
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
    if (position !== undefined) updateData.position = position;
    // Contactos de la agencia (FLW-083 - ELM-312 ContactDataSection)
    if (contacts !== undefined) {
      // Validar que sea un array y normalizar estructura
      if (Array.isArray(contacts)) {
        updateData.contacts = contacts.map(c => ({
          id: c.id || Date.now(),
          name: c.name || '',
          position: c.position || '',
          department: c.department || '',
          phone: c.phone || '',
          email: c.email || ''
        }));
      }
    }
    updateData.updated_at = new Date();

    const agency = await prisma.agencies.update({
      where: { id },
      data: updateData
    });

    // Respuesta con nombres compatibles para frontend
    res.json({
      success: true,
      data: {
        id: agency.id,
        user_id: agency.user_id,
        // Nombres para compatibilidad frontend
        name: agency.business_name,
        company_name: agency.business_name,
        businessName: agency.business_name,
        ruc: agency.ruc,
        tax_id: agency.ruc,
        // Address
        address: agency.agency_address,
        agencyAddress: agency.agency_address,
        // Phone
        phone: agency.agency_phone,
        contact_phone: agency.agency_phone,
        agencyPhone: agency.agency_phone,
        // Email
        email: agency.agency_email,
        contact_email: agency.agency_email,
        agencyEmail: agency.agency_email,
        // Otros
        whatsapp: agency.whatsapp,
        position: agency.position,
        status: agency.status,
        level: agency.level,
        verified: agency.verified,
        rating: agency.rating,
        available_points: agency.available_points,
        total_points: agency.total_points,
        // Contactos de agencia (ELM-312 ContactDataSection)
        contacts: agency.contacts || [],
        updatedAt: agency.updated_at,
        updated_at: agency.updated_at
      }
    });
  } catch (error) {
    console.error('Error en updateAgency:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar agencia',
      details: error.message
    });
  }
};

/**
 * API-035: GetAgencyReservations
 * GET /api/agencies/:id/reservations
 * Línea 04_apis_lista: 2589
 *
 * Alineado con schema Prisma (tabla reservations):
 * - date, time, status, total_amount, adults, children, participants
 */
const getAgencyReservations = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      pageSize = 20,
      status,
      dateFrom,
      dateTo
    } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de agencia inválido' });
    }

    // Verificar acceso
    if (req.user.role === 'agency' && req.user.agencyId !== id) {
      return res.status(403).json({ success: false, error: 'No autorizado para ver estas reservas' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    // Construir filtros usando columnas reales del schema
    const where = { agency_id: id };

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [reservations, total, stats] = await Promise.all([
      prisma.reservations.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          tours: {
            select: { id: true, name: true }
          }
        },
        orderBy: { date: 'desc' }
      }),
      prisma.reservations.count({ where }),
      prisma.reservations.aggregate({
        where: { agency_id: id },
        _sum: { total_amount: true },
        _count: { id: true }
      })
    ]);

    // Contar por estado
    const statusCounts = await prisma.reservations.groupBy({
      by: ['status'],
      where: { agency_id: id },
      _count: { id: true }
    });

    const pendingCount = statusCounts.find(s => s.status === 'pending')?._count?.id || 0;
    const confirmedCount = statusCounts.find(s => s.status === 'confirmed')?._count?.id || 0;

    // Mapear respuesta con nombres compatibles para frontend
    const data = reservations.map(r => ({
      id: r.id,
      // Fechas
      date: r.date,
      tourDate: r.date,
      tour_date: r.date,
      time: r.time,
      // Estado
      status: r.status,
      // Precios
      total_amount: r.total_amount,
      totalAmount: r.total_amount,
      totalPrice: r.total_amount,
      // Participantes
      adults: r.adults,
      adultsCount: r.adults,
      children: r.children,
      childrenCount: r.children,
      participants: r.participants,
      // Relaciones
      tour: r.tours,
      billingName: r.billing_name,
      // Otros
      pickup_location: r.pickup_location,
      special_requirements: r.special_requirements,
      payment_status: r.payment_status,
      payment_method: r.payment_method,
      notes: r.notes,
      createdAt: r.created_at,
      created_at: r.created_at
    }));

    res.json({
      success: true,
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      stats: {
        totalReservations: stats._count.id,
        totalRevenue: stats._sum.total_amount || 0,
        pendingCount,
        confirmedCount
      }
    });
  } catch (error) {
    console.error('Error en getAgencyReservations:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener reservas de agencia',
      details: error.message
    });
  }
};

/**
 * GET /api/agencies/:id/reports/monthly
 * Genera reporte mensual de ventas para una agencia
 * Usado por ELM-450 (Date Navigation Panel) y FLW-132 (Generar reportes de ventas para agencia)
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
const getAgencyMonthlyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { year, month } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de agencia invalido' });
    }

    // Verificar acceso: Agency solo puede ver su propia agencia
    if (req.user.role === 'agency' && req.user.agencyId !== id) {
      return res.status(403).json({ success: false, error: 'No autorizado para ver este reporte' });
    }

    // Validar parametros
    const yearNum = parseInt(year) || new Date().getFullYear();
    const monthNum = parseInt(month) || (new Date().getMonth() + 1);

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ success: false, error: 'Mes invalido (1-12)' });
    }

    // Calcular rango de fechas del mes
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

    // Buscar reservas de la agencia en el mes
    const reservations = await prisma.reservations.findMany({
      where: {
        agency_id: id,
        date: {
          gte: startDate,
          lte: endDate
        },
        status: { in: ['confirmed', 'completed', 'pending'] }
      },
      include: {
        tours: {
          select: { id: true, name: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Calcular resumen
    const totalReservations = reservations.length;
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalParticipants = reservations.reduce((sum, r) => {
      return sum + (r.participants || (r.adults || 0) + (r.children || 0));
    }, 0);
    const averageOrderValue = totalReservations > 0 ? totalRevenue / totalReservations : 0;

    // Generar datos diarios
    const dailyMap = new Map();
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    // Inicializar todos los dias del mes con 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dailyMap.set(dateKey, {
        date: dateKey,
        revenue: 0,
        reservations: 0,
        participants: 0
      });
    }

    // Llenar con datos reales
    reservations.forEach(r => {
      const dateKey = r.date.toISOString().split('T')[0];
      if (dailyMap.has(dateKey)) {
        const dayData = dailyMap.get(dateKey);
        dayData.revenue += parseFloat(r.total_amount) || 0;
        dayData.reservations += 1;
        dayData.participants += r.participants || (r.adults || 0) + (r.children || 0);
      }
    });

    const dailyData = Array.from(dailyMap.values());

    // Desglose por servicio/tour
    const serviceMap = new Map();
    reservations.forEach(r => {
      const serviceName = r.tours?.name || 'Otros';
      if (!serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, {
          revenue: 0,
          count: 0,
          participants: 0
        });
      }
      const serviceData = serviceMap.get(serviceName);
      serviceData.revenue += parseFloat(r.total_amount) || 0;
      serviceData.count += 1;
      serviceData.participants += r.participants || (r.adults || 0) + (r.children || 0);
    });

    const serviceBreakdown = Object.fromEntries(serviceMap);

    res.json({
      success: true,
      data: {
        summary: {
          totalReservations,
          totalRevenue,
          totalParticipants,
          averageOrderValue
        },
        dailyData,
        serviceBreakdown,
        period: {
          year: yearNum,
          month: monthNum,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error en getAgencyMonthlyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar reporte mensual',
      details: error.message
    });
  }
};

/**
 * DELETE /api/agencies/:id
 * Elimina (soft delete) una agencia
 * ELM-480: Delete Confirmation Modal - Modal de confirmacion destructiva antes de eliminar agencia
 * FLW-139: Eliminar cliente (aplica tambien a agencias)
 * API-040 adaptada para agencies: No se puede eliminar si tiene reservas activas (pending/confirmed)
 * Roles permitidos: Admin
 */
const deleteAgency = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de agencia invalido' });
    }

    // Verificar que la agencia existe
    const agency = await prisma.agencies.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, username: true } }
      }
    });

    if (!agency) {
      return res.status(404).json({ success: false, error: 'Agencia no encontrada' });
    }

    // Verificar si tiene reservas activas (pending o confirmed)
    const activeReservations = await prisma.reservations.count({
      where: {
        agency_id: id,
        status: { in: ['pending', 'confirmed'] }
      }
    });

    if (activeReservations > 0) {
      return res.status(409).json({
        success: false,
        error: `No se puede eliminar la agencia. Tiene ${activeReservations} reserva(s) activa(s).`,
        details: {
          activeReservations,
          suggestion: 'Cancele o complete las reservas activas antes de eliminar la agencia.'
        }
      });
    }

    // Soft delete: cambiar status a 'deleted' en lugar de eliminar fisicamente
    // Tambien desactivar el usuario asociado
    await prisma.$transaction(async (tx) => {
      // Marcar agencia como eliminada
      await tx.agencies.update({
        where: { id },
        data: {
          status: 'deleted',
          updated_at: new Date()
        }
      });

      // Desactivar usuario asociado
      if (agency.user_id) {
        await tx.users.update({
          where: { id: agency.user_id },
          data: {
            status: 'inactive',
            updated_at: new Date()
          }
        });
      }
    });

    res.json({
      success: true,
      message: `Agencia "${agency.business_name}" eliminada exitosamente`,
      data: {
        id: agency.id,
        businessName: agency.business_name,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error en deleteAgency:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar agencia',
      details: error.message
    });
  }
};

/**
 * GET /api/agencies/:id/reports/yearly
 * Genera reporte anual de ventas para una agencia (comparativo mensual)
 * Usado por ELM-450 (Date Navigation Panel) y FLW-132 (Generar reportes de ventas para agencia)
 * Roles permitidos: Admin, Agency (solo su propia agencia)
 */
const getAgencyYearlyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { year } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de agencia invalido' });
    }

    // Verificar acceso: Agency solo puede ver su propia agencia
    if (req.user.role === 'agency' && req.user.agencyId !== id) {
      return res.status(403).json({ success: false, error: 'No autorizado para ver este reporte' });
    }

    // Validar parametros
    const yearNum = parseInt(year) || new Date().getFullYear();

    // Calcular rango de fechas del anio
    const startDate = new Date(yearNum, 0, 1);
    const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);

    // Buscar reservas de la agencia en el anio
    const reservations = await prisma.reservations.findMany({
      where: {
        agency_id: id,
        date: {
          gte: startDate,
          lte: endDate
        },
        status: { in: ['confirmed', 'completed', 'pending'] }
      },
      orderBy: { date: 'asc' }
    });

    // Nombres de meses en espaniol
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Inicializar datos mensuales
    const yearlyData = monthNames.map((name, index) => ({
      month: index + 1,
      monthName: name,
      totalReservations: 0,
      totalRevenue: 0,
      totalParticipants: 0,
      averageOrderValue: 0
    }));

    // Llenar con datos reales
    reservations.forEach(r => {
      const monthIndex = r.date.getMonth();
      yearlyData[monthIndex].totalReservations += 1;
      yearlyData[monthIndex].totalRevenue += parseFloat(r.total_amount) || 0;
      yearlyData[monthIndex].totalParticipants += r.participants || (r.adults || 0) + (r.children || 0);
    });

    // Calcular promedios
    yearlyData.forEach(monthData => {
      if (monthData.totalReservations > 0) {
        monthData.averageOrderValue = monthData.totalRevenue / monthData.totalReservations;
      }
    });

    res.json({
      success: true,
      data: yearlyData
    });

  } catch (error) {
    console.error('Error en getAgencyYearlyReport:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar reporte anual',
      details: error.message
    });
  }
};

/**
 * GET /api/agencies/:id/stats
 * Estadísticas de la agencia
 * Roles: Admin, Agency
 */
const getAgencyStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateFrom, dateTo } = req.query;

    const agency = await prisma.agencies.findUnique({ where: { id } });
    if (!agency) {
      return res.status(404).json({ error: 'Not Found', message: 'Agencia no encontrada' });
    }

    const where = { agency_id: id };
    if (dateFrom) where.date = { ...where.date, gte: new Date(dateFrom) };
    if (dateTo) where.date = { ...where.date, lte: new Date(dateTo) };

    // Obtener estadísticas de reservaciones
    const [totalReservations, completedReservations, totalRevenue] = await Promise.all([
      prisma.reservations.count({ where }),
      prisma.reservations.count({ where: { ...where, status: 'completed' } }),
      prisma.reservations.aggregate({ where: { ...where, status: 'completed' }, _sum: { total_amount: true } })
    ]);

    // Obtener rating promedio desde las reservaciones completadas de la agencia
    // ratings está vinculado a reservations via reservation_id
    const reservationIds = await prisma.reservations.findMany({
      where: { agency_id: id, status: 'completed' },
      select: { id: true }
    });

    let averageRating = agency.rating ? parseFloat(agency.rating) : 0;

    if (reservationIds.length > 0) {
      const ratingsResult = await prisma.ratings.aggregate({
        where: {
          reservation_id: { in: reservationIds.map(r => r.id) }
        },
        _avg: { overall_rating: true }
      });
      if (ratingsResult._avg.overall_rating) {
        averageRating = ratingsResult._avg.overall_rating;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        agencyId: id,
        agencyName: agency.business_name,
        totalReservations,
        completedReservations,
        pendingReservations: totalReservations - completedReservations,
        totalRevenue: totalRevenue._sum.total_amount || 0,
        averageRating,
        level: agency.level,
        availablePoints: agency.available_points || 0,
        totalPoints: agency.total_points || 0
      }
    });
  } catch (error) {
    console.error('Error en getAgencyStats:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener estadísticas' });
  }
};

/**
 * PATCH /api/agencies/:id/status
 * Actualiza el estado de la agencia
 * Roles: Admin
 */
const updateAgencyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'pending', 'suspended'].includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'status debe ser active, inactive, pending o suspended'
      });
    }

    const agency = await prisma.agencies.findUnique({ where: { id } });
    if (!agency) {
      return res.status(404).json({ error: 'Not Found', message: 'Agencia no encontrada' });
    }

    const updated = await prisma.agencies.update({
      where: { id },
      data: { status }
    });

    return res.status(200).json({ success: true, data: { id, status: updated.status } });
  } catch (error) {
    console.error('Error en updateAgencyStatus:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al actualizar estado' });
  }
};

module.exports = {
  listAgencies,
  getAgency,
  createAgency,
  updateAgency,
  deleteAgency,
  getAgencyReservations,
  getAgencyMonthlyReport,
  getAgencyYearlyReport,
  getAgencyStats,
  updateAgencyStatus
};
