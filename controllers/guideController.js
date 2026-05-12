// Controller de Guides
// API-013: ListGuides - GET /api/guides
// API-014: GetGuide - GET /api/guides/:id
// API-015: UpdateGuide - PUT /api/guides/:id
// API-016: GetGuideAvailability - GET /api/guides/:id/availability
// API-017: UpdateGuideAvailability - PUT /api/guides/:id/availability
// API-020: AssignTourToGuide - POST /api/guides/:guideId/tours
// Fuente: 04_apis_lista.md lineas 986-1627

const prisma = require('../config/db');

/**
 * API-013: ListGuides
 * GET /api/guides
 * Lista paginada de guías con filtros
 * Roles: Admin, Agency
 * Fuente: 04_apis_lista.md líneas 986-1087
 */
const listGuides = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      guideType,
      language,
      specialty,
      status,
      availableOn,
      searchTerm
    } = req.query;

    // Validaciones (líneas 1069-1072)
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    if (pageNum < 1) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'page debe ser >= 1'
      });
    }

    if (pageSizeNum < 1 || pageSizeNum > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'pageSize debe estar entre 1 y 100'
      });
    }

    // guideType puede ser PLANT, AGENCY o FREELANCE
    // PLANT y AGENCY son equivalentes (guía de planta = empleado interno)
    const validGuideTypes = ['PLANT', 'AGENCY', 'FREELANCE'];
    if (guideType && !validGuideTypes.includes(guideType.toUpperCase())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideType debe ser PLANT, AGENCY o FREELANCE'
      });
    }

    // Construir filtros WHERE
    // Usar snake_case para campos de Prisma
    const where = {};

    // Filtro por guideType - mapear PLANT a AGENCY (que es lo que guarda la BD)
    if (guideType) {
      const normalizedType = guideType.toUpperCase() === 'PLANT' ? 'AGENCY' : guideType.toUpperCase();
      where.guide_type = normalizedType;
    }

    // Filtro por language (busca en array)
    if (language) {
      where.languages = {
        has: language
      };
    }

    // Filtro por specialty (busca en array)
    if (specialty) {
      where.specialties = {
        has: specialty
      };
    }

    // Filtro por status - Filtrar a través de users.status
    // El status se sincroniza entre guides.status y users.status mediante triggers
    // Estados posibles: active, inactive, deleted, pending_approval, blocked
    // - active: visible, interactivo, puede iniciar sesión
    // - inactive: visible, interactivo, NO puede iniciar sesión
    // - deleted: NO visible, no interactivo, no puede iniciar sesión (soft delete)
    // - pending_approval: pendiente de aprobación
    // - blocked: bloqueado por administrador

    // Filtrar a través de users.status (relación con users)
    let userStatusFilter = {};
    if (status === 'inactive') {
      userStatusFilter = { status: 'inactive' };
    } else if (status === 'active') {
      userStatusFilter = { status: 'active' };
    } else if (status === 'deleted') {
      userStatusFilter = { status: 'deleted' };
    } else if (status === 'pending_approval') {
      userStatusFilter = { status: 'pending_approval' };
    } else if (status === 'blocked') {
      userStatusFilter = { status: 'blocked' };
    } else if (status === 'all') {
      // Mostrar todos los estados (para admin)
      // No aplicar filtro de status
      userStatusFilter = {};
    } else {
      // Por defecto: mostrar activos e inactivos, excluir deleted
      userStatusFilter = { status: { in: ['active', 'inactive'] } };
    }

    // Filtro searchTerm (usar snake_case para Prisma)
    // La relacion se llama 'users' en schema.prisma linea 336
    let searchFilter = {};
    if (searchTerm) {
      searchFilter = {
        OR: [
          { license_number: { contains: searchTerm, mode: 'insensitive' } },
          { bio: { contains: searchTerm, mode: 'insensitive' } },
          { users: { first_name: { contains: searchTerm, mode: 'insensitive' } } },
          { users: { last_name: { contains: searchTerm, mode: 'insensitive' } } }
        ]
      };
    }

    // Filtro por availableOn (linea 1075) - requiere JOIN con guide_availability
    // Tabla availability usa guide_id (snake_case)
    let availabilityFilter = {};
    if (availableOn) {
      const availDate = new Date(availableOn);
      // Buscar guias que tengan disponibilidad en esa fecha
      const availableGuideIds = await prisma.availability.findMany({
        where: {
          date: availDate,
          available: true
        },
        select: { guide_id: true }
      });
      const guideIds = availableGuideIds.map(a => a.guide_id);
      if (guideIds.length > 0) {
        availabilityFilter = { id: { in: guideIds } };
      } else {
        // No hay guías disponibles en esa fecha
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: 0
        });
      }
    }

    // Combinar todos los filtros
    // La relacion se llama 'users' en schema.prisma linea 336
    const finalWhere = {
      ...where,
      ...availabilityFilter,
      ...searchFilter,
      users: userStatusFilter
    };

    console.log('📋 listGuides - finalWhere:', JSON.stringify(finalWhere, null, 2));

    const skip = (pageNum - 1) * pageSizeNum;

    // Primero verificar cuántos guías hay en total (sin filtros)
    const totalGuidesNoFilter = await prisma.guides.count();
    console.log('📊 Total guías en BD (sin filtro):', totalGuidesNoFilter);

    // Ejecutar consultas
    // Usar 'guides' (nombre del modelo en schema.prisma linea 311)
    // Relacion 'users' (nombre de la relacion en schema.prisma linea 336)
    // Campos en snake_case segun schema.prisma
    const [guides, total] = await Promise.all([
      prisma.guides.findMany({
        where: finalWhere,
        skip,
        take: pageSizeNum,
        orderBy: { rating: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
              profile_photo: true,
              status: true,
              address: true,
              document_type: true,
              document_number: true
            }
          }
        }
      }),
      prisma.guides.count({ where: finalWhere })
    ]);

    const totalPages = Math.ceil(total / pageSizeNum);

    console.log('📊 Guías encontrados con filtro:', total);
    console.log('📊 Primer guía (raw):', JSON.stringify(guides[0], null, 2));

    // Mapear respuesta (lineas 1044-1048)
    // Mapear snake_case de Prisma a camelCase para el frontend
    // ELM-319 FreelancerProfessionalDataSection espera email a nivel de guide
    // La relacion se llama 'users' en schema.prisma linea 336
    const mappedGuides = guides.map(guide => {
      const firstName = guide.users?.first_name || '';
      const lastName = guide.users?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'Sin nombre';

      return {
        id: guide.id,
        // Campos de nombre para el frontend
        name: fullName,
        fullName: fullName,
        // Tipo de guía
        guideType: guide.guide_type,
        guide_type: guide.guide_type,
        type: guide.guide_type === 'AGENCY' ? 'planta' : 'freelance',
        // Datos profesionales
        licenseNumber: guide.license_number,
        license_number: guide.license_number,
        yearsOfExperience: guide.years_of_experience,
        experience_years: guide.years_of_experience,
        years_of_experience: guide.years_of_experience,
        languages: Array.isArray(guide.languages) ? guide.languages : [],
        museums: Array.isArray(guide.museums) ? guide.museums : [],
        specialties: Array.isArray(guide.specialties) ? guide.specialties : [],
        certifications: Array.isArray(guide.certifications) ? guide.certifications : [],
        bio: guide.bio,
        education: guide.education,
        rating: guide.rating,
        online: guide.online,
        hourlyRate: guide.hourly_rate,
        hourly_rate: guide.hourly_rate,
        // Campos de users a nivel de guide para compatibilidad con ELM-319
        email: guide.users?.email,
        first_name: firstName,
        last_name: lastName,
        phone: guide.users?.phone,
        profile_photo: guide.users?.profile_photo,
        status: guide.users?.status,
        address: guide.users?.address,
        dni: guide.users?.document_number,
        documents: {
          type: guide.users?.document_type,
          dni: guide.users?.document_number
        },
        // Datos bancarios (para admin)
        banking: guide.bank_name || guide.account_number ? {
          bank_name: guide.bank_name,
          account_type: guide.account_type,
          account_number: guide.account_number,
          interbank_code: guide.interbank_code,
          account_holder: guide.account_holder,
          identification_number: guide.users?.document_number,
          currency: guide.currency
        } : null,
        // Fechas
        createdAt: guide.created_at,
        updatedAt: guide.updated_at,
        // Objeto user completo (alias para compatibilidad)
        user: {
          id: guide.users?.id,
          firstName: firstName,
          lastName: lastName,
          email: guide.users?.email,
          phone: guide.users?.phone,
          profilePhoto: guide.users?.profile_photo,
          status: guide.users?.status
        }
      };
    });

    // Response compatible con frontend ELM-319: {success, data: {guides, total, page, ...}}
    return res.status(200).json({
      success: true,
      data: {
        guides: mappedGuides,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages
      }
    });

  } catch (error) {
    console.error('Error en listGuides:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener los guías'
    });
  }
};

/**
 * API-014: GetGuide
 * GET /api/guides/:id
 * Detalle completo de un guía
 * Roles: Admin, Agency, Guide
 * Fuente: 04_apis_lista.md líneas 1088-1160
 */
const getGuide = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID (línea 1144)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Usar 'guides' (nombre del modelo) y 'users' (nombre de la relacion) segun schema.prisma
    const guide = await prisma.guides.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            profile_photo: true,
            status: true,
            document_type: true,
            document_number: true,
            city: true
          }
        }
      }
    });

    // 404 si no existe (linea 1148)
    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guia no encontrado'
      });
    }

    // Determinar si se muestran datos bancarios (linea 1147)
    // bankInfo solo visible para el propio guia o admin
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = guide.user_id === userId;
    const showBankInfo = userRole === 'admin' || isOwnProfile;

    // Response segun esquema GuideDetail (lineas 1117-1131)
    // Mapear snake_case de Prisma a camelCase para el frontend
    // La relacion se llama 'users' segun schema.prisma linea 336
    const response = {
      id: guide.id,
      user: {
        id: guide.users?.id,
        firstName: guide.users?.first_name,
        lastName: guide.users?.last_name,
        email: guide.users?.email,
        phone: guide.users?.phone,
        profilePhoto: guide.users?.profile_photo,
        documentType: guide.users?.document_type,
        documentNumber: guide.users?.document_number
      },
      // Alias para compatibilidad con FreelancerPersonalDataSection
      documents: {
        type: guide.users?.document_type,
        dni: guide.users?.document_number
      },
      // Campos adicionales a nivel raíz para compatibilidad con FreelancerPersonalDataSection
      dni: guide.users?.document_number,
      phone: guide.users?.phone,
      contact_phone: guide.users?.phone,
      first_name: guide.users?.first_name,
      last_name: guide.users?.last_name,
      email: guide.users?.email,
      profile_photo: guide.users?.profile_photo,
      avatar: guide.users?.profile_photo,
      city: guide.users?.city,
      guideType: guide.guide_type,
      licenseNumber: guide.license_number,
      yearsOfExperience: guide.years_of_experience,
      languages: Array.isArray(guide.languages) ? guide.languages : [],
      specialties: Array.isArray(guide.specialties) ? guide.specialties : [],
      certifications: Array.isArray(guide.certifications) ? guide.certifications : [],
      museums: Array.isArray(guide.museums) ? guide.museums : [],
      workZones: Array.isArray(guide.work_zones) ? guide.work_zones : [],
      bio: guide.bio,
      education: guide.education,
      hourlyRate: guide.hourly_rate,
      rating: guide.rating,
      online: guide.online
    };

    // Datos bancarios solo si autorizado
    // Prisma usa snake_case segun schema.prisma lineas 326-331
    if (showBankInfo) {
      response.bankInfo = {
        bankName: guide.bank_name,
        accountType: guide.account_type,
        accountNumber: guide.account_number,
        interbankCode: guide.interbank_code,
        accountHolder: guide.account_holder,
        currency: guide.currency
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error en getGuide:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener el guía'
    });
  }
};

/**
 * API-015: UpdateGuide
 * PUT /api/guides/:id
 * Actualiza perfil de guía (datos profesionales en guides + datos personales en users)
 * Roles: Admin, Guide (solo su propio perfil)
 * Fuente: 04_apis_lista.md líneas 1161-1239
 * Integrado para ELM-318: FreelancerPersonalDataSection
 */
const updateGuide = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Campos de tabla guides (profesionales)
      guideType,
      licenseNumber,
      yearsOfExperience,
      languages,
      specialties,
      certifications,
      bio,
      education,
      hourlyRate,
      bankName,
      accountType,
      accountNumber,
      interbankCode,
      accountHolder,
      currency,
      // Campos de tabla users (personales) - ELM-318 FreelancerPersonalDataSection
      first_name,
      last_name,
      email,
      phone,
      contact_phone,
      address,
      documents,
      dni,
      profile_photo,
      avatar,
      document_type,
      document_number,
      // Campos adicionales para museos con detalles
      museums,
      // Ciudad del usuario
      city,
      // Zonas de trabajo
      work_zones
    } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // id debe existir (línea 1221)
    // Include 'users' segun nombre de relacion en schema.prisma linea 336
    const existingGuide = await prisma.guides.findUnique({
      where: { id },
      include: { users: true }
    });

    if (!existingGuide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Guide solo puede editar su propio perfil (linea 1226)
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = existingGuide.user_id === userId;
    const isAdmin = userRole === 'admin' || userRole === 'administrator';

    if (!isAdmin && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede editar su propio perfil'
      });
    }

    // Validaciones (líneas 1220-1224)

    // guideType puede ser PLANT, AGENCY o FREELANCE
    // PLANT y AGENCY son equivalentes (guía de planta = empleado interno)
    const validGuideTypes = ['PLANT', 'AGENCY', 'FREELANCE'];
    if (guideType && !validGuideTypes.includes(guideType.toUpperCase())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideType debe ser PLANT, AGENCY o FREELANCE'
      });
    }

    // yearsOfExperience >= 0 (línea 1223)
    if (yearsOfExperience !== undefined && yearsOfExperience < 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'yearsOfExperience debe ser >= 0'
      });
    }

    // hourlyRate >= 0 (línea 1224)
    if (hourlyRate !== undefined && parseFloat(hourlyRate) < 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'hourlyRate debe ser >= 0'
      });
    }

    // Construir objeto de actualización para tabla guides
    // Prisma usa snake_case segun schema.prisma modelo guides lineas 311-348
    const guideUpdateData = {};

    if (guideType !== undefined) {
      // Mapear PLANT a AGENCY (que es lo que guarda la BD)
      const normalizedType = guideType.toUpperCase() === 'PLANT' ? 'AGENCY' : guideType.toUpperCase();
      guideUpdateData.guide_type = normalizedType;
    }
    if (licenseNumber !== undefined) guideUpdateData.license_number = licenseNumber;
    if (yearsOfExperience !== undefined) guideUpdateData.years_of_experience = parseInt(yearsOfExperience, 10);
    if (languages !== undefined) guideUpdateData.languages = languages;
    if (specialties !== undefined) guideUpdateData.specialties = specialties;
    if (certifications !== undefined) guideUpdateData.certifications = certifications;
    if (bio !== undefined) guideUpdateData.bio = bio;
    if (education !== undefined) guideUpdateData.education = education;
    if (hourlyRate !== undefined) guideUpdateData.hourly_rate = parseFloat(hourlyRate);
    if (bankName !== undefined) guideUpdateData.bank_name = bankName;
    if (accountType !== undefined) guideUpdateData.account_type = accountType;
    if (accountNumber !== undefined) guideUpdateData.account_number = accountNumber;
    if (interbankCode !== undefined) guideUpdateData.interbank_code = interbankCode;
    if (accountHolder !== undefined) guideUpdateData.account_holder = accountHolder;
    if (currency !== undefined) guideUpdateData.currency = currency;
    if (work_zones !== undefined) guideUpdateData.work_zones = work_zones;
    if (museums !== undefined) guideUpdateData.museums = museums;

    // Construir objeto de actualización para tabla users (datos personales)
    // Usado por ELM-318 FreelancerPersonalDataSection
    const userUpdateData = {};

    if (first_name !== undefined) userUpdateData.first_name = first_name;
    if (last_name !== undefined) userUpdateData.last_name = last_name;
    if (email !== undefined) userUpdateData.email = email;
    // phone puede venir como phone o contact_phone
    if (phone !== undefined) userUpdateData.phone = phone;
    else if (contact_phone !== undefined) userUpdateData.phone = contact_phone;
    // profile_photo puede venir como profile_photo o avatar
    if (profile_photo !== undefined) userUpdateData.profile_photo = profile_photo;
    else if (avatar !== undefined) userUpdateData.profile_photo = avatar;
    // document_type y document_number pueden venir directos o dentro de documents
    if (document_type !== undefined) userUpdateData.document_type = document_type;
    else if (documents?.type !== undefined) userUpdateData.document_type = documents.type;
    if (document_number !== undefined) userUpdateData.document_number = document_number;
    else if (dni !== undefined) userUpdateData.document_number = dni;
    else if (documents?.dni !== undefined) userUpdateData.document_number = documents.dni;
    // address para dirección del guía
    if (address !== undefined) userUpdateData.address = address;
    // city para ciudad del guía
    if (city !== undefined) userUpdateData.city = city;

    // Usar transacción para actualizar ambas tablas atomicamente
    // Los nombres de modelo en Prisma Client coinciden con los del schema.prisma (guides, users)
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar usuario si hay datos personales
      // La relacion en guides se llama 'users' segun schema.prisma linea 336
      let updatedUser = existingGuide.users;
      if (Object.keys(userUpdateData).length > 0) {
        updatedUser = await tx.users.update({
          where: { id: existingGuide.user_id },
          data: userUpdateData
        });
      }

      // Actualizar guía si hay datos profesionales
      let updatedGuide = existingGuide;
      if (Object.keys(guideUpdateData).length > 0) {
        updatedGuide = await tx.guides.update({
          where: { id },
          data: guideUpdateData
        });
      }

      return { guide: updatedGuide, user: updatedUser };
    });

    // Response segun esquema GuideDetail (lineas 1206-1209)
    // Mapear snake_case de Prisma a camelCase para el frontend
    // Incluir campos de users para compatibilidad con FreelancerPersonalDataSection
    return res.status(200).json({
      success: true,
      data: {
        id: result.guide.id,
        // Datos de usuario (personales)
        user: {
          id: result.user.id,
          firstName: result.user.first_name,
          lastName: result.user.last_name,
          email: result.user.email,
          phone: result.user.phone,
          profilePhoto: result.user.profile_photo,
          documentType: result.user.document_type,
          documentNumber: result.user.document_number
        },
        // Campos planos para compatibilidad con frontend
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        email: result.user.email,
        phone: result.user.phone,
        contact_phone: result.user.phone,
        profile_photo: result.user.profile_photo,
        avatar: result.user.profile_photo,
        documents: {
          type: result.user.document_type,
          dni: result.user.document_number
        },
        dni: result.user.document_number,
        address: result.user.address,
        city: result.user.city,
        // Datos de guía (profesionales)
        guideType: result.guide.guide_type,
        guide_type: result.guide.guide_type,
        licenseNumber: result.guide.license_number,
        license_number: result.guide.license_number,
        yearsOfExperience: result.guide.years_of_experience,
        years_of_experience: result.guide.years_of_experience,
        languages: result.guide.languages,
        museums: result.guide.museums,
        specialties: result.guide.specialties,
        certifications: result.guide.certifications,
        bio: result.guide.bio,
        education: result.guide.education,
        hourlyRate: result.guide.hourly_rate,
        hourly_rate: result.guide.hourly_rate,
        rating: result.guide.rating,
        online: result.guide.online,
        bankInfo: {
          bankName: result.guide.bank_name,
          accountType: result.guide.account_type,
          accountNumber: result.guide.account_number,
          interbankCode: result.guide.interbank_code,
          accountHolder: result.guide.account_holder,
          currency: result.guide.currency
        },
        bank_name: result.guide.bank_name,
        account_type: result.guide.account_type,
        account_number: result.guide.account_number,
        interbank_code: result.guide.interbank_code,
        account_holder: result.guide.account_holder,
        currency: result.guide.currency,
        updatedAt: result.guide.updated_at
      }
    });

  } catch (error) {
    console.error('Error en updateGuide:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar el guía'
    });
  }
};

/**
 * API-020: AssignTourToGuide
 * POST /api/guides/:guideId/tours
 * Asigna un tour/evento a un guía
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 1553-1627
 */
const assignTourToGuide = async (req, res) => {
  try {
    const { guideId } = req.params;
    const {
      date,
      time,
      duration,
      title,
      client,
      location,
      tourId,
      reservationId
    } = req.body;

    // Validar UUID guideId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    // Usar nombre de modelo 'guides' segun schema.prisma linea 312
    const guide = await prisma.guides.findUnique({
      where: { id: guideId }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Validaciones de campos requeridos
    if (!date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'date es requerido'
      });
    }

    if (!time) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'time es requerido'
      });
    }

    // Si se proporciona reservationId, crear/actualizar tour_assignment
    if (reservationId) {
      if (!uuidRegex.test(reservationId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'reservationId debe ser un UUID válido'
        });
      }

      // Verificar que la reserva existe (usar nombre correcto: reservations)
      const reservation = await prisma.reservations.findUnique({
        where: { id: reservationId },
        include: { tours: true }
      });

      if (!reservation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Reserva no encontrada'
        });
      }

      // Verificar si ya existe una asignación para esta reserva
      const existingAssignment = await prisma.tour_assignments.findUnique({
        where: { reservation_id: reservationId }
      });

      const userId = req.user?.id;
      let assignment;

      if (existingAssignment) {
        // Actualizar la asignación existente con el nuevo guía
        assignment = await prisma.tour_assignments.update({
          where: { id: existingAssignment.id },
          data: {
            guide_id: guideId,
            status: 'assigned',
            updated_at: new Date()
          },
          include: {
            guides: {
              include: {
                users: { select: { first_name: true, last_name: true } }
              }
            },
            reservations: {
              include: { tours: true }
            }
          }
        });
      } else {
        // Crear nueva asignación
        assignment = await prisma.tour_assignments.create({
          data: {
            reservation_id: reservationId,
            guide_id: guideId,
            status: 'assigned'
          },
          include: {
            guides: {
              include: {
                users: { select: { first_name: true, last_name: true } }
              }
            },
            reservations: {
              include: { tours: true }
            }
          }
        });
      }

      // También actualizar guide_id en reservations para compatibilidad
      await prisma.reservations.update({
        where: { id: reservationId },
        data: { guide_id: guideId }
      });

      const guideName = assignment.guides?.users
        ? `${assignment.guides.users.first_name} ${assignment.guides.users.last_name}`.trim()
        : null;

      return res.status(200).json({
        success: true,
        message: existingAssignment ? 'Guía reasignado a la reserva' : 'Guía asignado a la reserva',
        data: {
          assignmentId: assignment.id,
          reservationId: assignment.reservation_id,
          guideId: assignment.guide_id,
          guideName: guideName,
          tourId: assignment.reservations?.tour_id,
          tourName: assignment.reservations?.tours?.name,
          status: assignment.status
        }
      });
    }

    // Si no hay reservationId, guardar como evento personal (agenda independiente)
    // Esto permite a las agencias registrar tours de guías freelance sin una reserva formal

    // Parsear fecha y hora como componentes numéricos (sin conversión de zona horaria)
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);

    // Crear datetime en UTC usando los valores exactos del usuario
    // Esto evita conversiones de zona horaria del servidor
    const startDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

    // Calcular datetime de fin basado en duración (en horas, default 4)
    const durationHours = parseInt(duration) || 4;
    const endDateTime = new Date(startDateTime.getTime() + (durationHours * 60 * 60 * 1000));

    // Calcular hora de fin en formato HH:MM
    const endHours = (hours + durationHours) % 24;
    const endTimeString = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Crear evento personal con tipo 'assigned_tour'
    const personalEvent = await prisma.personal_events.create({
      data: {
        guide_id: guideId,
        title: title || 'Tour asignado',
        description: [
          client ? `Cliente: ${client}` : null,
          location ? `Ubicación: ${location}` : null
        ].filter(Boolean).join('\n') || null,
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        all_day: false,
        event_type: 'assigned_tour', // Tipo especial para tours asignados por empresa
        color: '#10B981', // Verde para tours de empresa
        blocks_availability: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Tour asignado al guía exitosamente',
      data: {
        id: personalEvent.id,
        guideId: personalEvent.guide_id,
        title: personalEvent.title,
        description: personalEvent.description,
        date: date,
        time: time,
        duration: durationHours,
        startTime: time,
        endTime: endTimeString,
        client: client || null,
        location: location || null,
        tourId: tourId || null,
        eventType: personalEvent.event_type,
        color: personalEvent.color
      }
    });

  } catch (error) {
    console.error('Error en assignTourToGuide:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al asignar tour al guía'
    });
  }
};

// =============================================================================
// PERSONAL EVENTS CRUD - ELM-031, ELM-032, ELM-033
// Endpoints para gestionar eventos personales del guía (agenda independiente)
// Tabla: personal_events (schema.prisma: PersonalEvent)
// =============================================================================

/**
 * GET /api/guides/:guideId/personal-events
 * Lista eventos personales de un guía
 * Roles: Admin, Guide (solo sus propios eventos)
 */
const getPersonalEvents = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { startDate, endDate, eventType } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    // Usar nombre de modelo 'guides' segun schema.prisma linea 312
    const guide = await prisma.guides.findUnique({
      where: { id: guideId }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar permisos: Guide solo puede ver sus propios eventos
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = guide.user_id === userId;

    if (userRole === 'guide' && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede ver sus propios eventos'
      });
    }

    // Construir filtros
    // Usar nombres de columna snake_case segun schema.prisma lineas 491-511
    const where = { guide_id: guideId };

    if (startDate) {
      where.start_datetime = { gte: new Date(startDate) };
    }

    if (endDate) {
      where.end_datetime = { ...(where.end_datetime || {}), lte: new Date(endDate) };
    }

    if (eventType) {
      where.event_type = eventType;
    }

    // Usar nombre de modelo 'personal_events' segun schema.prisma linea 491
    const events = await prisma.personal_events.findMany({
      where,
      orderBy: { start_datetime: 'asc' }
    });

    // Transformar respuesta para compatibilidad con frontend
    // Mapear snake_case de BD a camelCase para el frontend
    const data = events.map(event => ({
      id: event.id,
      guideId: event.guide_id,
      title: event.title,
      description: event.description,
      date: event.start_datetime.toISOString().split('T')[0],
      startTime: event.start_datetime.toISOString().split('T')[1].substring(0, 5),
      endTime: event.end_datetime.toISOString().split('T')[1].substring(0, 5),
      startDatetime: event.start_datetime.toISOString(),
      endDatetime: event.end_datetime.toISOString(),
      allDay: event.all_day,
      eventType: event.event_type,
      type: event.event_type, // Alias para frontend
      color: event.color,
      blocksAvailability: event.blocks_availability,
      visibility: event.blocks_availability ? 'occupied' : 'private',
      recurrenceRule: event.recurrence_rule,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    }));

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error en getPersonalEvents:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener eventos personales'
    });
  }
};

/**
 * POST /api/guides/:guideId/personal-events
 * Crea un nuevo evento personal para el guía
 * Roles: Admin, Guide (solo sus propios eventos)
 */
const createPersonalEvent = async (req, res) => {
  try {
    const { guideId } = req.params;
    const {
      title,
      description,
      date,
      startTime,
      endTime,
      allDay = false,
      eventType = 'personal',
      type, // Alias
      color,
      blocksAvailability = true,
      visibility,
      recurrenceRule
    } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    // Usar nombre de modelo 'guides' segun schema.prisma linea 312
    const guide = await prisma.guides.findUnique({
      where: { id: guideId }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar permisos
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = guide.user_id === userId;

    if (userRole === 'guide' && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede crear eventos en su propia agenda'
      });
    }

    // Validaciones
    if (!title || title.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'title es requerido'
      });
    }

    if (!date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'date es requerido'
      });
    }

    // Construir datetime en UTC (para consistencia en cualquier zona horaria)
    // Nota: cuando allDay=true, el frontend envía startTime='' y endTime=''
    const effectiveStartTime = (startTime && startTime.trim() !== '') ? startTime : '00:00';
    const effectiveEndTime = (endTime && endTime.trim() !== '') ? endTime : '23:59';

    // Parsear componentes de fecha y hora
    const [year, month, day] = date.split('-').map(Number);
    const [startHours, startMinutes] = effectiveStartTime.split(':').map(Number);
    const [endHours, endMinutes] = effectiveEndTime.split(':').map(Number);

    // Crear fechas en UTC usando los valores exactos del usuario
    const startDatetime = new Date(Date.UTC(year, month - 1, day, startHours, startMinutes, 0));
    const endDatetime = new Date(Date.UTC(year, month - 1, day, endHours, endMinutes, 0));

    if (isNaN(startDatetime.getTime()) || isNaN(endDatetime.getTime())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Formato de fecha/hora inválido'
      });
    }

    if (endDatetime <= startDatetime) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'endTime debe ser posterior a startTime'
      });
    }

    // Determinar tipo de evento y si bloquea disponibilidad
    const finalEventType = type || eventType;
    const shouldBlock = visibility === 'occupied' || blocksAvailability;

    // Usar nombre de modelo 'personal_events' y campos snake_case segun schema.prisma lineas 491-511
    const event = await prisma.personal_events.create({
      data: {
        guide_id: guideId,
        title: title.trim(),
        description: description?.trim() || null,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        all_day: allDay,
        event_type: finalEventType,
        color: color || null,
        blocks_availability: shouldBlock,
        recurrence_rule: recurrenceRule || null
      }
    });

    // Respuesta compatible con frontend - mapear snake_case a camelCase
    const responseData = {
      id: event.id,
      guideId: event.guide_id,
      title: event.title,
      description: event.description,
      date: event.start_datetime.toISOString().split('T')[0],
      startTime: event.start_datetime.toISOString().split('T')[1].substring(0, 5),
      endTime: event.end_datetime.toISOString().split('T')[1].substring(0, 5),
      startDatetime: event.start_datetime.toISOString(),
      endDatetime: event.end_datetime.toISOString(),
      allDay: event.all_day,
      eventType: event.event_type,
      type: event.event_type,
      color: event.color,
      blocksAvailability: event.blocks_availability,
      visibility: event.blocks_availability ? 'occupied' : 'private',
      recurrenceRule: event.recurrence_rule,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    };

    return res.status(201).json({
      success: true,
      data: responseData
    });

  } catch {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear evento personal'
    });
  }
};

/**
 * PUT /api/guides/:guideId/personal-events/:eventId
 * Actualiza un evento personal existente
 * Roles: Admin, Guide (solo sus propios eventos)
 */
const updatePersonalEvent = async (req, res) => {
  try {
    const { guideId, eventId } = req.params;
    const {
      title,
      description,
      date,
      startTime,
      endTime,
      allDay,
      eventType,
      type,
      color,
      blocksAvailability,
      visibility,
      recurrenceRule
    } = req.body;

    // Validar UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId) || !uuidRegex.test(eventId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId y eventId deben ser UUIDs válidos'
      });
    }

    // Verificar que el evento existe y pertenece al guía
    // Usar nombre de modelo 'personal_events' y campos snake_case segun schema.prisma lineas 491-511
    const existingEvent = await prisma.personal_events.findFirst({
      where: {
        id: eventId,
        guide_id: guideId
      },
      include: {
        guides: true
      }
    });

    if (!existingEvent) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Evento no encontrado'
      });
    }

    // Verificar permisos
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = existingEvent.guides.user_id === userId;

    if (userRole === 'guide' && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede editar sus propios eventos'
      });
    }

    // Construir objeto de actualización con campos snake_case
    const updateData = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (allDay !== undefined) updateData.all_day = allDay;
    if (color !== undefined) updateData.color = color || null;
    if (recurrenceRule !== undefined) updateData.recurrence_rule = recurrenceRule || null;

    // Tipo de evento
    const finalEventType = type || eventType;
    if (finalEventType !== undefined) updateData.event_type = finalEventType;

    // Bloqueo de disponibilidad
    if (visibility !== undefined) {
      updateData.blocks_availability = visibility === 'occupied';
    } else if (blocksAvailability !== undefined) {
      updateData.blocks_availability = blocksAvailability;
    }

    // Actualizar fechas si se proporcionan (usando UTC para consistencia)
    if (date || startTime || endTime) {
      const baseDate = date || existingEvent.start_datetime.toISOString().split('T')[0];
      const baseStartTime = startTime || existingEvent.start_datetime.toISOString().split('T')[1].substring(0, 5);
      const baseEndTime = endTime || existingEvent.end_datetime.toISOString().split('T')[1].substring(0, 5);

      // Parsear componentes para crear en UTC
      const [year, month, day] = baseDate.split('-').map(Number);
      const [startHours, startMinutes] = baseStartTime.split(':').map(Number);
      const [endHours, endMinutes] = baseEndTime.split(':').map(Number);

      updateData.start_datetime = new Date(Date.UTC(year, month - 1, day, startHours, startMinutes, 0));
      updateData.end_datetime = new Date(Date.UTC(year, month - 1, day, endHours, endMinutes, 0));

      if (updateData.end_datetime <= updateData.start_datetime) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'endTime debe ser posterior a startTime'
        });
      }
    }

    const event = await prisma.personal_events.update({
      where: { id: eventId },
      data: updateData
    });

    // Respuesta compatible con frontend - mapear snake_case a camelCase
    const responseData = {
      id: event.id,
      guideId: event.guide_id,
      title: event.title,
      description: event.description,
      date: event.start_datetime.toISOString().split('T')[0],
      startTime: event.start_datetime.toISOString().split('T')[1].substring(0, 5),
      endTime: event.end_datetime.toISOString().split('T')[1].substring(0, 5),
      startDatetime: event.start_datetime.toISOString(),
      endDatetime: event.end_datetime.toISOString(),
      allDay: event.all_day,
      eventType: event.event_type,
      type: event.event_type,
      color: event.color,
      blocksAvailability: event.blocks_availability,
      visibility: event.blocks_availability ? 'occupied' : 'private',
      recurrenceRule: event.recurrence_rule,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    };

    return res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error en updatePersonalEvent:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar evento personal'
    });
  }
};

/**
 * DELETE /api/guides/:guideId/personal-events/:eventId
 * Elimina un evento personal - ELM-031
 * Roles: Admin, Guide (solo sus propios eventos)
 */
const deletePersonalEvent = async (req, res) => {
  try {
    const { guideId, eventId } = req.params;

    // Validar UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId) || !uuidRegex.test(eventId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId y eventId deben ser UUIDs válidos'
      });
    }

    // Verificar que el evento existe y pertenece al guía
    // Usar nombre de modelo 'personal_events' y campos snake_case segun schema.prisma lineas 491-511
    const existingEvent = await prisma.personal_events.findFirst({
      where: {
        id: eventId,
        guide_id: guideId
      },
      include: {
        guides: true
      }
    });

    if (!existingEvent) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Evento no encontrado'
      });
    }

    // Verificar permisos
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = existingEvent.guides.user_id === userId;

    if (userRole === 'guide' && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede eliminar sus propios eventos'
      });
    }

    await prisma.personal_events.delete({
      where: { id: eventId }
    });

    return res.status(200).json({
      success: true,
      message: 'Evento eliminado correctamente'
    });

  } catch (error) {
    console.error('Error en deletePersonalEvent:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar evento personal'
    });
  }
};

/**
 * POST /api/guides/:guideId/occupied-time
 * Marca un bloque de tiempo como ocupado (sin mostrar detalles)
 * Roles: Admin, Guide (solo su propio tiempo)
 */
const markTimeAsOccupied = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { date, startTime, endTime, notes } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    // Usar nombre de modelo 'guides' segun schema.prisma linea 312
    const guide = await prisma.guides.findUnique({
      where: { id: guideId }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar permisos
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = guide.user_id === userId;

    if (userRole === 'guide' && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede marcar su propio tiempo como ocupado'
      });
    }

    // Validaciones
    if (!date) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'date es requerido'
      });
    }

    // Parsear fecha y hora en UTC para consistencia
    const [year, month, day] = date.split('-').map(Number);
    const effectiveStartTime = startTime || '00:00';
    const effectiveEndTime = endTime || '23:59';
    const [startHours, startMinutes] = effectiveStartTime.split(':').map(Number);
    const [endHours, endMinutes] = effectiveEndTime.split(':').map(Number);

    const startDatetime = new Date(Date.UTC(year, month - 1, day, startHours, startMinutes, 0));
    const endDatetime = new Date(Date.UTC(year, month - 1, day, endHours, endMinutes, 0));

    // Usar nombre de modelo 'personal_events' y campos snake_case segun schema.prisma lineas 491-511
    const event = await prisma.personal_events.create({
      data: {
        guide_id: guideId,
        title: 'Tiempo ocupado',
        description: notes?.trim() || null,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        all_day: !startTime && !endTime,
        event_type: 'occupied',
        blocks_availability: true
      }
    });

    // Respuesta compatible con frontend - mapear snake_case a camelCase
    const responseData = {
      id: event.id,
      guideId: event.guide_id,
      title: event.title,
      description: event.description,
      date: event.start_datetime.toISOString().split('T')[0],
      startTime: event.start_datetime.toISOString().split('T')[1].substring(0, 5),
      endTime: event.end_datetime.toISOString().split('T')[1].substring(0, 5),
      allDay: event.all_day,
      eventType: event.event_type,
      type: 'occupied',
      visibility: 'occupied',
      blocksAvailability: true,
      createdAt: event.created_at
    };

    return res.status(201).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error en markTimeAsOccupied:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al marcar tiempo como ocupado'
    });
  }
};

/**
 * API-107: GetGuideSchedule
 * GET /api/guides/:id/schedule
 * Agenda completa del guía con asignaciones y disponibilidad
 * Roles: Admin, Agency, Guide
 * Fuente: 04_apis_lista.md líneas 7385-7462
 */
const getGuideSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateFrom, dateTo, view = 'month' } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Validar fechas requeridas
    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'dateFrom y dateTo son requeridos'
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

    // Rango máximo 90 días
    const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El rango máximo es de 90 días'
      });
    }

    // Verificar que el guía existe
    // Usar nombre de modelo 'guides' y relacion 'users' segun schema.prisma lineas 312-342
    const guide = await prisma.guides.findUnique({
      where: { id },
      include: {
        users: {
          select: { first_name: true, last_name: true }
        }
      }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar permisos: Guide solo puede ver su propia agenda
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    if (req.user?.role === 'guide') {
      const userGuide = await prisma.guides.findFirst({
        where: { user_id: req.user.id }
      });
      if (!userGuide || userGuide.id !== id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Solo puede ver su propia agenda'
        });
      }
    }

    // Obtener asignaciones (reservas asignadas al guía)
    // Usar nombre de modelo 'reservations' y campos snake_case segun schema.prisma
    const reservations = await prisma.reservations.findMany({
      where: {
        guide_id: id,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      include: {
        tours: {
          select: { name: true, duration: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Obtener disponibilidad
    // Usar nombre de modelo 'availability' y campos snake_case segun schema.prisma lineas 92-107
    const availability = await prisma.availability.findMany({
      where: {
        guide_id: id,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: { date: 'asc' }
    });

    // Calcular fechas bloqueadas
    const blockedDates = availability
      .filter(a => !a.is_available)
      .map(a => a.date.toISOString().split('T')[0]);

    // Calcular estadísticas
    const toursThisPeriod = reservations.filter(r =>
      ['confirmed', 'completed'].includes(r.status)
    ).length;

    const hoursWorked = reservations
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + (r.tours?.duration || 0), 0) / 60; // minutos a horas

    return res.status(200).json({
      guideId: id,
      guideName: `${guide.users?.first_name || ''} ${guide.users?.last_name || ''}`.trim(),
      assignments: reservations.map(r => ({
        date: r.date.toISOString().split('T')[0],
        tourName: r.tours?.name,
        startTime: r.time,
        endTime: null, // Calculable con duration
        passengers: r.participants,
        status: r.status
      })),
      availability: availability.map(a => ({
        date: a.date.toISOString().split('T')[0],
        available: a.is_available,
        reason: a.notes
      })),
      blockedDates,
      stats: {
        toursThisPeriod,
        hoursWorked: parseFloat(hoursWorked.toFixed(1)),
        rating: guide.rating || 0
      }
    });

  } catch (error) {
    console.error('Error en getGuideSchedule:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener agenda del guía'
    });
  }
};

/**
 * GET /api/guides/:guideId/working-hours
 * Obtiene el horario laboral del guía
 * Roles: Admin, Guide (solo su propio horario)
 * ELM-080: WorkingHoursModal
 */
const getWorkingHours = async (req, res) => {
  try {
    const { guideId } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    // Usar nombre de modelo 'guides' segun schema.prisma linea 312
    // Nota: workingHours no existe en el schema actual, usar campo JSON si se agrega
    const guide = await prisma.guides.findUnique({
      where: { id: guideId },
      select: { id: true, user_id: true }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar permisos: Guide solo puede ver su propio horario
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = guide.user_id === userId;

    if (userRole === 'guide' && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede ver su propio horario laboral'
      });
    }

    // Consultar working_hours de la BD
    let workingHoursRows = await prisma.working_hours.findMany({
      where: { guide_id: guideId },
      orderBy: { day_of_week: 'asc' }
    });

    // Si no existen, crear los 7 días con defaults
    if (workingHoursRows.length === 0) {
      const defaults = [
        { day: 0, enabled: false, start: '10:00', end: '14:00' }, // domingo
        { day: 1, enabled: true, start: '09:00', end: '17:00' },
        { day: 2, enabled: true, start: '09:00', end: '17:00' },
        { day: 3, enabled: true, start: '09:00', end: '17:00' },
        { day: 4, enabled: true, start: '09:00', end: '17:00' },
        { day: 5, enabled: true, start: '09:00', end: '17:00' },
        { day: 6, enabled: false, start: '10:00', end: '14:00' }  // sabado
      ];

      await prisma.$transaction(
        defaults.map(d => prisma.working_hours.create({
          data: {
            guide_id: guideId,
            day_of_week: d.day,
            is_working_day: d.enabled,
            start_time: new Date(`1970-01-01T${d.start}:00Z`),
            end_time: new Date(`1970-01-01T${d.end}:00Z`)
          }
        }))
      );

      workingHoursRows = await prisma.working_hours.findMany({
        where: { guide_id: guideId },
        orderBy: { day_of_week: 'asc' }
      });
    }

    // Mapear a formato frontend (día español -> config)
    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const formatTime = (dt) => {
      if (!dt) return null;
      const d = new Date(dt);
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    };

    const data = {};
    for (const row of workingHoursRows) {
      const dayName = dayNames[row.day_of_week] || `day_${row.day_of_week}`;
      data[dayName] = {
        enabled: row.is_working_day,
        start: formatTime(row.start_time) || '09:00',
        end: formatTime(row.end_time) || '17:00',
        breakStart: formatTime(row.break_start),
        breakEnd: formatTime(row.break_end),
        // Aliases para frontend
        isWorkingDay: row.is_working_day,
        is_working_day: row.is_working_day,
        startTime: formatTime(row.start_time) || '09:00',
        endTime: formatTime(row.end_time) || '17:00'
      };
    }

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error en getWorkingHours:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener horario laboral'
    });
  }
};

/**
 * PUT /api/guides/:guideId/working-hours
 * Actualiza el horario laboral del guía
 * Roles: Admin, Guide (solo su propio horario)
 * ELM-080, ELM-082: WorkingHoursModal
 */
const updateWorkingHours = async (req, res) => {
  try {
    const { guideId } = req.params;
    const schedule = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    // Usar nombre de modelo 'guides' segun schema.prisma linea 312
    const guide = await prisma.guides.findUnique({
      where: { id: guideId }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar permisos
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = guide.user_id === userId;

    if (userRole === 'guide' && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede editar su propio horario laboral'
      });
    }

    // Validar estructura del horario
    const validDays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    for (const [day, config] of Object.entries(schedule)) {
      if (!validDays.includes(day)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Día inválido: ${day}. Días válidos: ${validDays.join(', ')}`
        });
      }

      if (typeof config.enabled !== 'boolean') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `${day}.enabled debe ser boolean`
        });
      }

      if (config.enabled) {
        if (!config.start || !timeRegex.test(config.start)) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `${day}.start debe tener formato HH:mm`
          });
        }
        if (!config.end || !timeRegex.test(config.end)) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `${day}.end debe tener formato HH:mm`
          });
        }
      }
    }

    // Mapear días en español a day_of_week (0=domingo .. 6=sábado)
    const dayMap = {
      domingo: 0, lunes: 1, martes: 2, miercoles: 3,
      jueves: 4, viernes: 5, sabado: 6
    };

    // Upsert cada día en la tabla working_hours
    const upserts = Object.entries(schedule).map(([day, config]) => {
      const dayOfWeek = dayMap[day];
      if (dayOfWeek === undefined) return null;

      const startTime = config.start ? new Date(`1970-01-01T${config.start}:00Z`) : null;
      const endTime = config.end ? new Date(`1970-01-01T${config.end}:00Z`) : null;
      const breakStart = config.breakStart ? new Date(`1970-01-01T${config.breakStart}:00Z`) : null;
      const breakEnd = config.breakEnd ? new Date(`1970-01-01T${config.breakEnd}:00Z`) : null;

      return prisma.working_hours.upsert({
        where: {
          guide_id_day_of_week: {
            guide_id: guideId,
            day_of_week: dayOfWeek
          }
        },
        update: {
          is_working_day: Boolean(config.enabled),
          start_time: startTime,
          end_time: endTime,
          break_start: breakStart,
          break_end: breakEnd,
          updated_at: new Date()
        },
        create: {
          guide_id: guideId,
          day_of_week: dayOfWeek,
          is_working_day: Boolean(config.enabled),
          start_time: startTime,
          end_time: endTime,
          break_start: breakStart,
          break_end: breakEnd
        }
      });
    }).filter(Boolean);

    await prisma.$transaction(upserts);

    // Retornar el horario actualizado
    const updatedRows = await prisma.working_hours.findMany({
      where: { guide_id: guideId },
      orderBy: { day_of_week: 'asc' }
    });

    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const formatTime = (dt) => {
      if (!dt) return null;
      const d = new Date(dt);
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    };

    const data = {};
    for (const row of updatedRows) {
      const dayName = dayNames[row.day_of_week] || `day_${row.day_of_week}`;
      data[dayName] = {
        enabled: row.is_working_day,
        start: formatTime(row.start_time) || '09:00',
        end: formatTime(row.end_time) || '17:00',
        breakStart: formatTime(row.break_start),
        breakEnd: formatTime(row.break_end)
      };
    }

    return res.status(200).json({
      success: true,
      data,
      message: 'Horario laboral actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error en updateWorkingHours:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar horario laboral'
    });
  }
};

/**
 * GET /api/guides/:guideId/complete-agenda
 * Obtiene la agenda completa del guía para una fecha o rango
 * Roles: Admin, Guide (solo su propia agenda)
 * ELM-090: DayView, ELM-095: MonthView, ELM-100: WeekView
 */
const getCompleteAgenda = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { startDate, endDate, date } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    // Usar nombre de modelo 'guides' y relacion 'users' segun schema.prisma lineas 312-342
    const guide = await prisma.guides.findUnique({
      where: { id: guideId },
      include: {
        users: { select: { first_name: true, last_name: true } }
      }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar permisos
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwnProfile = guide.user_id === userId;

    if (userRole === 'guide' && !isOwnProfile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede ver su propia agenda'
      });
    }

    // Determinar rango de fechas (usar UTC para consistencia con almacenamiento)
    let fromDate, toDate;

    // Helper para crear fechas UTC desde string yyyy-MM-dd
    const parseToUTCDate = (dateStr, startOfDay = true) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (startOfDay) {
        return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      } else {
        return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      }
    };

    if (date) {
      // Single date: start and end of that day in UTC
      fromDate = parseToUTCDate(date, true);
      toDate = parseToUTCDate(date, false);
    } else if (startDate && endDate) {
      fromDate = parseToUTCDate(startDate, true);
      toDate = parseToUTCDate(endDate, false);
    } else {
      // Default: today in UTC
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // yyyy-MM-dd
      fromDate = parseToUTCDate(todayStr, true);
      toDate = parseToUTCDate(todayStr, false);
    }

    // Obtener eventos personales
    // Usar nombre de modelo 'personal_events' y campos snake_case segun schema.prisma lineas 491-511
    const personalEvents = await prisma.personal_events.findMany({
      where: {
        guide_id: guideId,
        start_datetime: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: { start_datetime: 'asc' }
    });

    // Obtener reservas/tours asignados
    // Usar nombre de modelo 'reservations' y relacion 'tours' segun schema.prisma
    const assignedTours = await prisma.reservations.findMany({
      where: {
        guide_id: guideId,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      include: {
        tours: { select: { name: true, duration: true } }
      },
      orderBy: { date: 'asc' }
    });

    // Obtener service_requests del marketplace (pending, accepted, completed)
    const serviceRequests = await prisma.service_requests.findMany({
      where: {
        guide_id: guideId,
        service_date: {
          gte: fromDate,
          lte: toDate
        },
        status: { notIn: ['rejected', 'cancelled'] }
      },
      include: {
        agencies: {
          include: { users: { select: { first_name: true, last_name: true } } }
        }
      },
      orderBy: { service_date: 'asc' }
    });

    // Excluir personal_events que ya están representados por service_requests (evitar duplicados)
    const linkedEventIds = new Set(
      serviceRequests.filter(sr => sr.calendar_event_id).map(sr => sr.calendar_event_id)
    );

    // Combinar y transformar eventos - mapear snake_case a camelCase
    const allEvents = [
      ...personalEvents
        .filter(event => !linkedEventIds.has(event.id))
        .map(event => ({
          id: event.id,
          type: event.event_type,
          eventType: event.event_type,
          title: event.title,
          description: event.description,
          // start_datetime/end_datetime son @db.Timestamptz: convertir a Lima
          // para que el día y la hora coincidan con la zona del usuario,
          // sin importar si el server corre en UTC (Railway) o local.
          date: toLimaDateString(event.start_datetime),
          startTime: toLimaTimeString(event.start_datetime),
          endTime: toLimaTimeString(event.end_datetime),
          allDay: event.all_day,
          color: event.color,
          visibility: event.blocks_availability ? 'occupied' : 'private',
          source: 'personal'
        })),
      ...assignedTours.map(tour => {
        // tour.date es @db.Date (sin tz): usar la parte ISO directamente.
        // tour.time es @db.Time (sin tz): tomar la hora UTC tal cual viene.
        const timeStr = tour.time
          ? `${String(tour.time.getUTCHours()).padStart(2, '0')}:${String(tour.time.getUTCMinutes()).padStart(2, '0')}`
          : '09:00';
        return {
          id: tour.id,
          type: 'company_tour',
          eventType: 'company_tour',
          title: tour.tours?.name || 'Tour asignado',
          description: `${tour.participants} pasajeros`,
          date: toLimaDateString(tour.date),
          startTime: timeStr,
          endTime: calculateEndTime(timeStr, tour.tours?.duration || 120),
          allDay: false,
          color: '#3B82F6',
          visibility: 'company',
          source: 'assigned',
          passengers: tour.participants,
          status: tour.status
        };
      }),
      ...serviceRequests.map(sr => {
        const agencyName = sr.agencies?.users
          ? `${sr.agencies.users.first_name} ${sr.agencies.users.last_name}`.trim()
          : 'Agencia';
        // service_date es @db.Date (sin tz) y start_time es @db.Time (sin tz).
        // Para @db.Date Prisma devuelve medianoche UTC, así que toLimaDateString
        // sobre un Date Prisma podría correrlo. Usar la parte ISO de UTC mantiene
        // intacto el día almacenado.
        const dateStr = sr.service_date instanceof Date
          ? sr.service_date.toISOString().split('T')[0]
          : sr.service_date;
        const timeStr = sr.start_time
          ? `${String(sr.start_time.getUTCHours()).padStart(2, '0')}:${String(sr.start_time.getUTCMinutes()).padStart(2, '0')}`
          : '09:00';
        const durationMinutes = (sr.duration_hours || 4) * 60;
        const isPending = sr.status === 'pending';
        return {
          id: sr.id,
          type: 'marketplace_service',
          eventType: isPending ? 'marketplace_pending' : 'marketplace_service',
          title: isPending
            ? `Solicitud pendiente - ${agencyName}`
            : `Servicio Marketplace - ${agencyName}`,
          description: sr.message || sr.location || '',
          date: dateStr,
          startTime: timeStr,
          endTime: calculateEndTime(timeStr, durationMinutes),
          allDay: false,
          color: isPending ? '#F59E0B' : '#8B5CF6',
          visibility: 'company',
          source: 'marketplace',
          status: sr.status,
          agency: agencyName,
          price: sr.total_price ? Number(sr.total_price) : null,
          location: sr.location,
          groupSize: sr.group_size
        };
      })
    ].sort((a, b) => {
      // Sort by date, then by time
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    return res.status(200).json({
      success: true,
      data: {
        guideId,
        guideName: `${guide.users?.first_name || ''} ${guide.users?.last_name || ''}`.trim(),
        dateRange: {
          from: fromDate.toISOString().split('T')[0],
          to: toDate.toISOString().split('T')[0]
        },
        allEvents,
        stats: {
          totalEvents: allEvents.length,
          personalEvents: personalEvents.length,
          assignedTours: assignedTours.length,
          serviceRequests: serviceRequests.length
        }
      }
    });

  } catch (error) {
    console.error('Error en getCompleteAgenda:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener agenda completa'
    });
  }
};

// Helper para calcular hora de fin
function calculateEndTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

// =============================================================================
// HELPERS DE TIMEZONE
// =============================================================================
// La app opera en Lima (America/Lima, UTC-5). Railway corre en UTC, local puede
// estar en otra tz. Estos helpers fuerzan el formato Lima en cualquier entorno.
const LIMA_TZ = 'America/Lima';

// Formato YYYY-MM-DD del Date en Lima (en-CA usa formato ISO en toLocaleDateString)
function toLimaDateString(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    // Si ya viene "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm..." con la parte de fecha,
    // confiar en esa porción solo si no trae info de timezone que valga la pena convertir.
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    date = new Date(date);
  }
  if (isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

// Formato HH:mm del Date en Lima
function toLimaTimeString(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    const m = date.match(/^(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    date = new Date(date);
  }
  if (isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LIMA_TZ,
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

/**
 * DeleteGuide
 * DELETE /api/guides/:id
 * Elimina (soft delete) un guía
 * Roles: Admin
 *
 * IMPORTANTE: Utiliza el sistema de sincronización bidireccional implementado con triggers
 * Al actualizar guides.status = 'deleted', el trigger sincronizará automáticamente users.status = 'deleted'
 */
const deleteGuide = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    const guide = await prisma.guides.findUnique({
      where: { id },
      include: {
        users: true
      }
    });

    if (!guide) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar que no tenga reservas activas
    const activeReservations = await prisma.reservations.count({
      where: {
        guide_id: id,
        status: { in: ['pending', 'confirmed'] }
      }
    });

    if (activeReservations > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: `No se puede eliminar el guía porque tiene ${activeReservations} reserva(s) activa(s)`
      });
    }

    // Soft delete: marcar tanto el guía como el usuario asociado como deleted
    // Usamos una transacción para garantizar la integridad de los datos
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar el guía
      await tx.guides.update({
        where: { id },
        data: {
          status: 'deleted',
          updated_at: now
        }
      });

      // 2. Actualizar el usuario asociado
      if (guide.user_id) {
        await tx.users.update({
          where: { id: guide.user_id },
          data: {
            status: 'deleted',
            deleted_at: now,
            updated_at: now
          }
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Guía y usuario asociado eliminados correctamente'
    });

  } catch (error) {
    console.error('Error en deleteGuide:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar el guía'
    });
  }
};

/**
 * POST /api/guides
 * Crea un nuevo guía
 * Roles: Admin
 */
const createGuide = async (req, res) => {
  try {
    const {
      email, password, firstName, lastName, phone,
      guideType, licenseNumber, yearsOfExperience,
      languages, specialties, bio, education, hourlyRate
    } = req.body;

    // Validaciones
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email, password, firstName y lastName son requeridos'
      });
    }

    // Verificar email único
    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'El email ya está registrado'
      });
    }

    // Obtener rol de guía
    const guideRole = await prisma.roles.findFirst({ where: { name: 'guide' } });
    if (!guideRole) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Rol guide no encontrado' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Crear usuario
      const user = await tx.users.create({
        data: {
          email,
          password_hash: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          role_id: guideRole.id,
          status: 'active'
        }
      });

      // Crear perfil de guía
      const guide = await tx.guides.create({
        data: {
          user_id: user.id,
          guide_type: (guideType || 'FREELANCE').toUpperCase(),
          license_number: licenseNumber || null,
          years_of_experience: yearsOfExperience ? parseInt(yearsOfExperience) : 0,
          languages: languages || ['es'],
          specialties: specialties || [],
          bio: bio || null,
          education: education || null,
          hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
          rating: 0
        }
      });

      return { user, guide };
    });

    return res.status(201).json({
      success: true,
      data: {
        id: result.guide.id,
        userId: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        guideType: result.guide.guide_type
      }
    });
  } catch (error) {
    console.error('Error en createGuide:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al crear guía' });
  }
};

/**
 * PATCH /api/guides/:id/status
 * Actualiza el estado de un guía
 * Roles: Admin
 */
const updateGuideStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'status debe ser active, inactive o pending'
      });
    }

    const guide = await prisma.guides.findUnique({ where: { id } });
    if (!guide) {
      return res.status(404).json({ error: 'Not Found', message: 'Guía no encontrado' });
    }

    // Actualizar tanto el guía como el usuario en una transacción
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // 1. Actualizar el guía
      await tx.guides.update({
        where: { id },
        data: { status, updated_at: now }
      });

      // 2. Actualizar el usuario asociado
      await tx.users.update({
        where: { id: guide.user_id },
        data: { status, updated_at: now }
      });
    });

    return res.status(200).json({ success: true, data: { id, status } });
  } catch (error) {
    console.error('Error en updateGuideStatus:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al actualizar estado' });
  }
};

/**
 * GET /api/guides/:id/stats
 * Estadísticas del guía
 * Roles: Admin, Agency, Guide
 */
const getGuideStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateFrom, dateTo } = req.query;

    const guide = await prisma.guides.findUnique({
      where: { id },
      include: { users: { select: { first_name: true, last_name: true } } }
    });

    if (!guide) {
      return res.status(404).json({ error: 'Not Found', message: 'Guía no encontrado' });
    }

    const where = { guide_id: id };
    if (dateFrom) where.date = { ...where.date, gte: new Date(dateFrom) };
    if (dateTo) where.date = { ...where.date, lte: new Date(dateTo) };

    const [totalTours, completedTours, totalPassengers, avgRating] = await Promise.all([
      prisma.reservations.count({ where }),
      prisma.reservations.count({ where: { ...where, status: 'completed' } }),
      prisma.reservations.aggregate({ where: { ...where, status: 'completed' }, _sum: { participants: true } }),
      prisma.ratings.aggregate({ where: { guide_id: id }, _avg: { score: true } })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        guideId: id,
        guideName: `${guide.users?.first_name} ${guide.users?.last_name}`.trim(),
        totalTours,
        completedTours,
        totalPassengers: totalPassengers._sum.participants || 0,
        averageRating: avgRating._avg.score || guide.rating || 0,
        completionRate: totalTours > 0 ? ((completedTours / totalTours) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Error en getGuideStats:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener estadísticas' });
  }
};

/**
 * GET /api/guides/summary
 * Resumen de guías
 * Roles: Admin, Agency
 */
const getGuidesSummary = async (req, res) => {
  try {
    const [total, active, freelance, agency] = await Promise.all([
      prisma.guides.count(),
      prisma.guides.count({ where: { users: { status: 'active' } } }),
      prisma.guides.count({ where: { guide_type: 'FREELANCE' } }),
      prisma.guides.count({ where: { guide_type: 'AGENCY' } })
    ]);

    // Top guías por rating
    const topGuides = await prisma.guides.findMany({
      where: { users: { status: 'active' } },
      orderBy: { rating: 'desc' },
      take: 5,
      include: { users: { select: { first_name: true, last_name: true } } }
    });

    return res.status(200).json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        byType: { freelance, agency },
        topGuides: topGuides.map(g => ({
          id: g.id,
          name: `${g.users?.first_name} ${g.users?.last_name}`.trim(),
          rating: g.rating,
          type: g.guide_type
        }))
      }
    });
  } catch (error) {
    console.error('Error en getGuidesSummary:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener resumen' });
  }
};

/**
 * POST /api/guides/check-availability
 * Verifica disponibilidad de guías
 * Roles: Admin, Agency
 */
const checkGuidesAvailability = async (req, res) => {
  try {
    const { date, time, guideIds } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Bad Request', message: 'date es requerido' });
    }

    // Parsear fecha en UTC para consistencia
    const [year, month, day] = date.split('-').map(Number);
    const searchDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Mediodía UTC

    // Obtener guías ocupados
    const busyGuides = await prisma.reservations.findMany({
      where: {
        date: searchDate,
        guide_id: { not: null },
        status: { in: ['pending', 'confirmed'] }
      },
      select: { guide_id: true, time: true }
    });

    const busyIds = new Set(busyGuides.map(r => r.guide_id));

    // Si se especifican guías, filtrar
    let guidesToCheck = guideIds;
    if (!guidesToCheck) {
      const allGuides = await prisma.guides.findMany({
        where: { users: { status: 'active' } },
        select: { id: true }
      });
      guidesToCheck = allGuides.map(g => g.id);
    }

    const availability = guidesToCheck.map(id => ({
      guideId: id,
      available: !busyIds.has(id),
      date
    }));

    return res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    console.error('Error en checkGuidesAvailability:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al verificar disponibilidad' });
  }
};

/**
 * GET /api/guides/:id/ratings
 * Calificaciones del guía
 * Roles: Admin, Agency, Guide
 */
const getGuideRatings = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const guide = await prisma.guides.findUnique({ where: { id } });
    if (!guide) {
      return res.status(404).json({ error: 'Not Found', message: 'Guía no encontrado' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [ratings, total, avg] = await Promise.all([
      prisma.ratings.findMany({
        where: { guide_id: id },
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' }
      }),
      prisma.ratings.count({ where: { guide_id: id } }),
      prisma.ratings.aggregate({ where: { guide_id: id }, _avg: { score: true } })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ratings,
        total,
        averageRating: avg._avg.score || 0,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error en getGuideRatings:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Error al obtener calificaciones' });
  }
};

module.exports = {
  listGuides,
  getGuide,
  updateGuide,
  deleteGuide,
  assignTourToGuide,
  getGuideSchedule,
  // Personal Events CRUD
  getPersonalEvents,
  createPersonalEvent,
  updatePersonalEvent,
  deletePersonalEvent,
  markTimeAsOccupied,
  // Working Hours
  getWorkingHours,
  updateWorkingHours,
  // Complete Agenda
  getCompleteAgenda,
  // New endpoints
  createGuide,
  updateGuideStatus,
  getGuideStats,
  getGuidesSummary,
  checkGuidesAvailability,
  getGuideRatings
};
