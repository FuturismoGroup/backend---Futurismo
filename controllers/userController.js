// Controller de Users
// API-021: ListUsers - GET /api/users
// API-022: GetUser - GET /api/users/:id
// API-023: CreateUser - POST /api/users
// API-024: UpdateUser - PUT /api/users/:id
// API-025: DeleteUser - DELETE /api/users/:id
// API-026: UpdateUserStatus - PATCH /api/users/:id/status
// API-027: ResetUserPassword - POST /api/users/:id/reset-password
// API-028: GetUserPermissions - GET /api/users/:id/permissions
// API-029: UpdateUserPermissions - PUT /api/users/:id/permissions
// API-030: GetUserStats - GET /api/users/stats
// Fuente: 04_apis_lista.md lineas 1630-2285

const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 10;

/**
 * API-021: ListUsers
 * GET /api/users
 * Lista paginada de usuarios
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 1630-1729
 */
const listUsers = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      role,
      status,
      guideType,
      searchTerm,
      includeDeleted = 'false' // Por defecto no incluir eliminados
    } = req.query;

    // Validaciones (líneas 1712-1714)
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

    // Construir filtros WHERE
    const where = {};

    // Filtrar usuarios eliminados (soft delete) por defecto
    // Utiliza el campo status (sincronizado con guides.status mediante triggers)
    if (includeDeleted !== 'true') {
      where.status = { not: 'deleted' };
      where.deleted_at = null;
    }

    // Filtro por rol
    if (role) {
      where.roles = {
        name: { equals: role, mode: 'insensitive' }
      };
    }

    // Filtro por status (sobreescribe el filtro por defecto si se especifica)
    if (status) {
      where.status = status;
    }

    // Filtro por guideType (requiere JOIN con guide)
    if (guideType) {
      where.guides = {
        guide_type: guideType.toUpperCase()
      };
    }

    // Filtro searchTerm
    if (searchTerm) {
      where.OR = [
        { username: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { first_name: { contains: searchTerm, mode: 'insensitive' } },
        { last_name: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    const skip = (pageNum - 1) * pageSizeNum;

    // Ejecutar consultas en paralelo
    const [users, total, roleStats] = await Promise.all([
      prisma.users.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { created_at: 'desc' },
        include: {
          roles: true,
          guides: {
            select: { id: true, guide_type: true, rating: true }
          },
          agencies: {
            select: {
              id: true,
              business_name: true,
              ruc: true,
              agency_address: true,
              agency_phone: true,
              agency_email: true,
              level: true
            }
          }
        }
      }),
      prisma.users.count({ where }),
      // roleStats (línea 1688) - solo usuarios no eliminados
      prisma.users.groupBy({
        by: ['role_id'],
        where: { deleted_at: null, status: { not: 'deleted' } },
        _count: { role_id: true }
      })
    ]);

    // Filtro para excluir usuarios eliminados (soft delete)
    const notDeletedFilter = { deleted_at: null, status: { not: 'deleted' } };

    // Obtener conteos de guías por tipo (solo de usuarios no eliminados)
    const guideStats = await prisma.guides.groupBy({
      by: ['guide_type'],
      where: {
        users: notDeletedFilter
      },
      _count: { guide_type: true }
    });

    // Procesar roleStats
    const roles = await prisma.roles.findMany();
    const roleMap = new Map(roles.map(r => [r.role_id, r.name.toLowerCase()]));

    const stats = {
      total: await prisma.users.count({ where: notDeletedFilter }),
      administradores: 0,
      agencias: 0,
      guias: 0,
      guiasPlanta: 0,
      guiasFreelance: 0
    };

    roleStats.forEach(item => {
      const roleName = roleMap.get(item.role_id);
      if (roleName === 'administrator') stats.administradores = item._count.role_id;
      if (roleName === 'agency') stats.agencias = item._count.role_id;
      if (roleName === 'guide') stats.guias = item._count.role_id;
    });

    guideStats.forEach(item => {
      // Guías de planta se guardan como 'AGENCY' en la BD
      if (item.guide_type === 'AGENCY') stats.guiasPlanta = item._count.guide_type;
      if (item.guide_type === 'FREELANCE') stats.guiasFreelance = item._count.guide_type;
    });

    const totalPages = Math.ceil(total / pageSizeNum);

    // Mapear respuesta (líneas 1683-1688)
    const data = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.roles ? { id: user.roles.role_id, name: user.roles.name } : null,
      status: user.status,
      profilePhoto: user.profile_photo,
      // Campos adicionales para guías freelance
      dni: user.document_number,
      city: user.city,
      guide: user.guides,
      agency: user.agencies,
      lastLogin: user.last_login_at,
      createdAt: user.created_at,
      deletedAt: user.deleted_at
    }));

    return res.status(200).json({
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages,
      roleStats: stats
    });

  } catch (error) {
    console.error('Error en listUsers:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener los usuarios'
    });
  }
};

/**
 * API-022: GetUser
 * GET /api/users/:id
 * Detalle completo de un usuario
 * Roles: Admin, Guide (solo su propio perfil), Agency (solo su propio perfil)
 * Fuente: 04_apis_lista.md líneas 1730-1806
 */
const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID (línea 1791)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Usuarios solo pueden ver su propio perfil (excepto admin) (línea 1794)
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Admin y administrator tienen acceso completo
    if (userRole !== 'admin' && userRole !== 'administrator' && id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede ver su propio perfil'
      });
    }

    const user = await prisma.users.findUnique({
      where: { id },
      include: {
        roles: true,
        guides: true,
        agencies: true
      }
    });

    // 404 si no existe (línea 1795)
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si el usuario fue eliminado (soft delete)
    if (user.deleted_at) {
      return res.status(410).json({
        error: 'Gone',
        message: 'Este usuario ha sido eliminado',
        deletedAt: user.deleted_at
      });
    }

    // Response según esquema UserDetail (líneas 1763-1778)
    const guide = user.guides ? {
      id: user.guides.id,
      guideType: user.guides.guide_type,
      licenseNumber: user.guides.license_number,
      yearsOfExperience: user.guides.years_of_experience,
      languages: user.guides.languages,
      specialties: user.guides.specialties,
      certifications: user.guides.certifications,
      museums: user.guides.museums,
      bio: user.guides.bio,
      education: user.guides.education,
      hourlyRate: user.guides.hourly_rate,
      guidePhoto: user.guides.guide_photo,
      rating: user.guides.rating,
      status: user.guides.status
    } : null;

    const agency = user.agencies ? {
      id: user.agencies.id,
      businessName: user.agencies.business_name,
      ruc: user.agencies.ruc,
      agencyAddress: user.agencies.agency_address,
      agencyPhone: user.agencies.agency_phone,
      agencyEmail: user.agencies.agency_email,
      level: user.agencies.level
    } : null;

    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.roles ? { id: user.roles.role_id, name: user.roles.name } : null,
      status: user.status,
      documentType: user.document_type,
      documentNumber: user.document_number,
      // Campos consistentes con listUsers para guías freelance
      dni: user.document_number,
      city: user.city,
      profilePhoto: user.profile_photo,
      guide,
      agency,
      lastLogin: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      deletedAt: user.deleted_at
    });

  } catch (error) {
    console.error('Error en getUser:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener el usuario'
    });
  }
};

/**
 * API-023: CreateUser
 * POST /api/users
 * Crea un nuevo usuario
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 1807-1885
 */
const createUser = async (req, res) => {
  try {
    // Whitelist de campos permitidos para prevenir mass assignment
    const allowedFields = [
      'username', 'email', 'password', 'firstName', 'lastName',
      'phone', 'role', 'status', 'documentType', 'documentNumber',
      'profilePhoto', 'guideData', 'agencyData',
      'dni', 'city' // Campos adicionales para guías freelance
    ];

    const receivedFields = Object.keys(req.body);
    const invalidFields = receivedFields.filter(field => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Campos no permitidos: ${invalidFields.join(', ')}`
      });
    }

    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
      status = 'active',
      documentType,
      documentNumber,
      profilePhoto,
      guideData,
      agencyData,
      dni,
      city
    } = req.body;

    // Validaciones (líneas 1862-1868)

    // username único, min 3 chars (línea 1863)
    if (!username || username.length < 3) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'username es requerido y debe tener mínimo 3 caracteres'
      });
    }

    // email único, formato válido (línea 1864)
    if (!email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email es requerido'
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email debe tener formato válido'
      });
    }

    // password min 8 chars, mayúscula, minúscula, número (línea 1865)
    if (!password || password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'password es requerido y debe tener mínimo 8 caracteres'
      });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'password debe contener al menos una mayúscula, una minúscula y un número'
      });
    }

    // firstName y lastName requeridos
    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'firstName y lastName son requeridos'
      });
    }

    // phone pattern /^9\d{8}$/ si presente (línea 1866)
    if (phone) {
      const phoneRegex = /^9\d{8}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'phone debe ser un número peruano válido (9 dígitos comenzando con 9)'
        });
      }
    }

    // role requerido
    if (!role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'role es requerido'
      });
    }

    // Verificar unicidad de username y email (línea 1875)
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: email.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      // No revelar qué campo específico está duplicado por seguridad
      return res.status(409).json({
        error: 'Conflict',
        message: 'El username o email ya está en uso'
      });
    }

    // Obtener roleId
    const roleRecord = await prisma.roles.findFirst({
      where: { name: { equals: role, mode: 'insensitive' } }
    });

    if (!roleRecord) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'role no válido'
      });
    }

    const roleName = roleRecord.name.toLowerCase();

    // Si rol=agency, RUC requerido y 11 dígitos (línea 1867)
    if (roleName === 'agency') {
      if (!agencyData?.ruc || agencyData.ruc.length !== 11) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Para rol agency, RUC es requerido y debe tener 11 dígitos'
        });
      }
    }

    // Si rol=guide, guideType requerido (línea 1868)
    if (roleName === 'guide') {
      if (!guideData?.guideType || !['AGENCY', 'FREELANCE'].includes(guideData.guideType.toUpperCase())) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Para rol guide, guideType es requerido (AGENCY o FREELANCE)'
        });
      }
    }

    // Hash password con bcrypt (línea 1884)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Transacción atómica para user + guide/agency (línea 1884)
    const result = await prisma.$transaction(async (tx) => {
      // Crear usuario
      const user = await tx.users.create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          role_id: roleRecord.role_id,
          status: roleName === 'agency' ? 'active' : status, // Agencias siempre active (línea 1872)
          document_type: documentType || null,
          document_number: dni || documentNumber || null, // dni tiene prioridad (para guías freelance)
          city: city || null, // Ciudad para guías freelance
          profile_photo: profilePhoto || null
        }
      });

      // Si rol=agency, crear registro en agencies (línea 1870)
      if (roleName === 'agency') {
        await tx.agencies.create({
          data: {
            user_id: user.id,
            business_name: agencyData.businessName || `${firstName} ${lastName}`,
            ruc: agencyData.ruc,
            agency_phone: agencyData.agencyPhone || phone,
            agency_email: agencyData.agencyEmail || email,
            agency_address: agencyData.agencyAddress || null,
            agency_logo: agencyData.agencyLogo || null,
            level: 'bronze',
            total_points: 0,
            available_points: 0,
            verified: false
          }
        });
      }

      // Si rol=guide, crear registro en guides (línea 1871)
      if (roleName === 'guide') {
        await tx.guides.create({
          data: {
            user_id: user.id,
            agency_id: guideData.agencyId || null,
            guide_type: guideData.guideType.toUpperCase(),
            license_number: guideData.licenseNumber || null,
            years_of_experience: guideData.yearsOfExperience || 0,
            languages: guideData.languages || [],
            specialties: guideData.specialties || [],
            certifications: guideData.certifications || [],
            museums: guideData.museums || [], // Museos donde trabaja (freelance)
            bio: guideData.bio || null,
            education: guideData.education || null,
            hourly_rate: guideData.hourlyRate || null,
            rating: 0,
            online: false
          }
        });
      }

      // Obtener usuario completo con relaciones
      const fullUser = await tx.users.findUnique({
        where: { id: user.id },
        include: {
          roles: true,
          guides: true,
          agencies: true
        }
      });

      return fullUser;
    });

    // Response según esquema UserDetail (líneas 1850-1852)
    return res.status(201).json({
      id: result.id,
      username: result.username,
      email: result.email,
      firstName: result.first_name,
      lastName: result.last_name,
      phone: result.phone,
      role: result.roles ? { id: result.roles.role_id, name: result.roles.name } : null,
      status: result.status,
      documentType: result.document_type,
      documentNumber: result.document_number,
      profilePhoto: result.profile_photo,
      guide: result.guides,
      agency: result.agencies,
      createdAt: result.created_at
    });

  } catch (error) {
    console.error('Error en createUser:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al crear el usuario'
    });
  }
};

/**
 * API-024: UpdateUser
 * PUT /api/users/:id
 * Actualiza un usuario existente
 * Roles: Admin, Guide (solo su propio perfil), Agency (solo su propio perfil)
 * Fuente: 04_apis_lista.md líneas 1886-1959
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Whitelist de campos permitidos para prevenir mass assignment
    // FIX-B01: Agregados dni y city para guías freelance
    const allowedFields = [
      'email', 'firstName', 'lastName', 'phone', 'status',
      'documentType', 'documentNumber', 'profilePhoto',
      'guideData', 'agencyData',
      'dni', 'city'
    ];

    const receivedFields = Object.keys(req.body);
    const invalidFields = receivedFields.filter(field => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Campos no permitidos: ${invalidFields.join(', ')}`
      });
    }

    const {
      email,
      firstName,
      lastName,
      phone,
      status,
      documentType,
      documentNumber,
      profilePhoto,
      guideData,
      agencyData,
      dni,
      city
    } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // Usuario solo puede editar su propio perfil (excepto admin) (línea 1948)
    // NOTA: req.user.role ya es un string lowercase (establecido en auth.js middleware)
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Admin y administrator tienen acceso completo
    if (userRole !== 'admin' && userRole !== 'administrator' && id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo puede editar su propio perfil'
      });
    }

    // id debe existir (línea 1942)
    const existingUser = await prisma.users.findUnique({
      where: { id },
      include: { roles: true, guides: true, agencies: true }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que el usuario no esté eliminado (soft delete)
    if (existingUser.deleted_at) {
      return res.status(410).json({
        error: 'Gone',
        message: 'No se puede actualizar un usuario eliminado',
        deletedAt: existingUser.deleted_at
      });
    }

    // Validaciones (líneas 1941-1944)

    // email único si se cambia (línea 1943)
    if (email && email.toLowerCase() !== existingUser.email) {
      const emailExists = await prisma.users.findFirst({
        where: {
          email: email.toLowerCase(),
          id: { not: id }
        }
      });
      if (emailExists) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Email ya está en uso'
        });
      }
    }

    // phone pattern si se envía (línea 1944)
    if (phone) {
      const phoneRegex = /^9\d{8}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'phone debe ser un número peruano válido'
        });
      }
    }

    // Construir objeto de actualización (usando snake_case para Prisma)
    const updateData = {};

    if (email !== undefined) updateData.email = email.toLowerCase();
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (documentType !== undefined) updateData.document_type = documentType;
    if (documentNumber !== undefined) updateData.document_number = documentNumber;
    if (profilePhoto !== undefined) updateData.profile_photo = profilePhoto;
    // FIX-B01: Campos adicionales para guías freelance
    if (dni !== undefined) updateData.document_number = dni; // dni se mapea a document_number
    if (city !== undefined) updateData.city = city;

    // Solo admin puede cambiar status (línea 1946-1947 implícito)
    if (status !== undefined && (userRole === 'admin' || userRole === 'administrator')) {
      updateData.status = status;
    }

    // Transacción para actualizar user + guide/agency
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar usuario
      await tx.users.update({
        where: { id },
        data: updateData
      });

      // Actualizar datos de guía si existen
      if (guideData && existingUser.guides) {
        const guideUpdate = {};
        if (guideData.guideType !== undefined) guideUpdate.guide_type = guideData.guideType.toUpperCase();
        if (guideData.agencyId !== undefined) guideUpdate.agency_id = guideData.agencyId || null;
        if (guideData.licenseNumber !== undefined) guideUpdate.license_number = guideData.licenseNumber;
        if (guideData.yearsOfExperience !== undefined) guideUpdate.years_of_experience = guideData.yearsOfExperience;
        if (guideData.languages !== undefined) guideUpdate.languages = guideData.languages;
        if (guideData.specialties !== undefined) guideUpdate.specialties = guideData.specialties;
        if (guideData.certifications !== undefined) guideUpdate.certifications = guideData.certifications;
        if (guideData.bio !== undefined) guideUpdate.bio = guideData.bio;
        if (guideData.education !== undefined) guideUpdate.education = guideData.education;
        if (guideData.hourlyRate !== undefined) guideUpdate.hourly_rate = guideData.hourlyRate;
        // FIX-B02: Agregar procesamiento de museums
        if (guideData.museums !== undefined) guideUpdate.museums = guideData.museums;

        if (Object.keys(guideUpdate).length > 0) {
          await tx.guides.update({
            where: { id: existingUser.guides.id },
            data: guideUpdate
          });
        }
      }

      // Actualizar datos de agencia si existen
      if (agencyData && existingUser.agencies) {
        const agencyUpdate = {};
        if (agencyData.businessName !== undefined) agencyUpdate.business_name = agencyData.businessName;
        if (agencyData.ruc !== undefined) agencyUpdate.ruc = agencyData.ruc;
        if (agencyData.agencyPhone !== undefined) agencyUpdate.agency_phone = agencyData.agencyPhone;
        if (agencyData.agencyEmail !== undefined) agencyUpdate.agency_email = agencyData.agencyEmail;
        if (agencyData.agencyAddress !== undefined) agencyUpdate.agency_address = agencyData.agencyAddress;
        if (agencyData.agencyLogo !== undefined) agencyUpdate.agency_logo = agencyData.agencyLogo;
        if (agencyData.agencyType !== undefined) agencyUpdate.agency_type = agencyData.agencyType;

        if (Object.keys(agencyUpdate).length > 0) {
          await tx.agencies.update({
            where: { id: existingUser.agencies.id },
            data: agencyUpdate
          });
        }
      }

      // Obtener usuario actualizado
      return await tx.users.findUnique({
        where: { id },
        include: { roles: true, guides: true, agencies: true }
      });
    });

    // Response según esquema UserDetail (líneas 1927-1929)
    return res.status(200).json({
      id: result.id,
      username: result.username,
      email: result.email,
      firstName: result.first_name,
      lastName: result.last_name,
      phone: result.phone,
      role: result.roles ? { id: result.roles.role_id, name: result.roles.name } : null,
      status: result.status,
      documentType: result.document_type,
      documentNumber: result.document_number,
      profilePhoto: result.profile_photo,
      guide: result.guides,
      agency: result.agencies,
      updatedAt: result.updated_at
    });

  } catch (error) {
    console.error('Error en updateUser:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar el usuario'
    });
  }
};

/**
 * API-025: DeleteUser
 * DELETE /api/users/:id
 * Elimina (soft delete) un usuario
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 1960-2014
 *
 * IMPORTANTE: Utiliza el sistema de sincronización bidireccional implementado con triggers
 * Al actualizar users.status = 'deleted', el trigger sincronizará automáticamente:
 * - guides.status = 'deleted' (si el usuario es guía)
 * - users.deleted_at = CURRENT_TIMESTAMP
 */
const deleteUser = async (req, res) => {
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

    // id debe existir (línea 2000)
    const existingUser = await prisma.users.findUnique({
      where: { id },
      include: { roles: true, guides: true, agencies: true }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    const roleName = existingUser.roles?.name?.toLowerCase();

    // No eliminar si es guía con reservas pending/confirmed (línea 2002)
    if (roleName === 'guide' && existingUser.guides) {
      const activeReservations = await prisma.reservations.count({
        where: {
          guide_id: existingUser.guides.id,
          status: { in: ['pending', 'confirmed'] }
        }
      });

      if (activeReservations > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: `No se puede eliminar el guía porque tiene ${activeReservations} reserva(s) activa(s)`
        });
      }
    }

    // No eliminar si es agencia con reservas activas (línea 2003)
    if (roleName === 'agency' && existingUser.agencies) {
      const activeReservations = await prisma.reservations.count({
        where: {
          agency_id: existingUser.agencies.id,
          status: { in: ['pending', 'confirmed'] }
        }
      });

      if (activeReservations > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: `No se puede eliminar la agencia porque tiene ${activeReservations} reserva(s) activa(s)`
        });
      }
    }

    // Soft delete: marcar usuario y entidades asociadas como deleted
    // Usamos una transacción para garantizar la integridad de los datos
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar el usuario
      await tx.users.update({
        where: { id },
        data: {
          status: 'deleted',
          deleted_at: now,
          updated_at: now
        }
      });

      // 2. Si el usuario tiene un guía asociado, también marcarlo como deleted
      if (existingUser.guides) {
        await tx.guides.update({
          where: { id: existingUser.guides.id },
          data: {
            status: 'deleted',
            updated_at: now
          }
        });
      }

      // 3. Si el usuario tiene una agencia asociada, también marcarla como deleted
      if (existingUser.agencies) {
        await tx.agencies.update({
          where: { id: existingUser.agencies.id },
          data: {
            status: 'deleted',
            updated_at: now
          }
        });
      }
    });

    // Response según esquema DeleteResult (líneas 1987-1989)
    return res.status(200).json({
      success: true,
      message: 'Usuario eliminado correctamente',
      deletedAt: now.toISOString()
    });

  } catch (error) {
    console.error('Error en deleteUser:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al eliminar el usuario'
    });
  }
};

/**
 * API-026: UpdateUserStatus
 * PATCH /api/users/:id/status
 * Actualiza el estado de un usuario
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 2015-2068
 */
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // status debe ser valor válido (línea 2056)
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    // id debe existir (línea 2055)
    const existingUser = await prisma.users.findUnique({
      where: { id },
      include: { roles: true, agencies: true, guides: true }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    // Agencias siempre active (no se puede desactivar) (línea 2058)
    const roleName = existingUser.roles?.name?.toLowerCase();
    if (roleName === 'agency' && status !== 'active') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Las agencias no pueden ser desactivadas'
      });
    }

    // Actualizar status del usuario y entidades asociadas usando transacción
    const now = new Date();

    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Actualizar el usuario
      const user = await tx.users.update({
        where: { id },
        data: { status, updated_at: now }
      });

      // 2. Si tiene un guía asociado, sincronizar su status
      if (existingUser.guides) {
        await tx.guides.update({
          where: { id: existingUser.guides.id },
          data: { status, updated_at: now }
        });
      }

      // 3. Si tiene una agencia asociada, sincronizar su status
      if (existingUser.agencies) {
        await tx.agencies.update({
          where: { id: existingUser.agencies.id },
          data: { status, updated_at: now }
        });
      }

      return user;
    });

    // Response según esquema UserStatusResult (líneas 2041-2044)
    return res.status(200).json({
      id: updatedUser.id,
      status: updatedUser.status,
      updatedAt: updatedUser.updated_at
    });

  } catch (error) {
    console.error('Error en updateUserStatus:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar el estado del usuario'
    });
  }
};

/**
 * API-027: ResetUserPassword
 * POST /api/users/:id/reset-password
 * Genera nueva contraseña aleatoria para un usuario
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 2069-2120
 */
const resetUserPassword = async (req, res) => {
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

    // id debe existir (línea 2108)
    const existingUser = await prisma.users.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    // Genera password aleatorio de 12 chars (línea 2110)
    const newPassword = crypto.randomBytes(6).toString('hex') + 'A1!'; // 12 chars + garantiza complejidad

    // Hash y guarda en password_hash (línea 2111)
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.users.update({
      where: { id },
      data: { password_hash: passwordHash }
    });

    // Response según esquema ResetPasswordResult (líneas 2094-2097)
    return res.status(200).json({
      id,
      newPassword,
      message: 'Contraseña reseteada correctamente'
    });

  } catch (error) {
    console.error('Error en resetUserPassword:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al resetear la contraseña'
    });
  }
};

/**
 * API-028: GetUserPermissions
 * GET /api/users/:id/permissions
 * Obtiene los permisos asignados a un usuario
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 2121-2176
 */
const getUserPermissions = async (req, res) => {
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

    // id debe existir (línea 2165)
    const existingUser = await prisma.users.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    // Obtener todos los permisos
    const allPermissions = await prisma.permissions.findMany({
      orderBy: { module: 'asc' }
    });

    // Obtener permisos del usuario
    const userPermissions = await prisma.user_permissions.findMany({
      where: { user_id: id },
      include: { permissions: true }
    });

    // Agrupar por módulo (línea 2167)
    const permissionsByModule = {};
    allPermissions.forEach(p => {
      if (!permissionsByModule[p.module]) {
        permissionsByModule[p.module] = [];
      }
      permissionsByModule[p.module].push({
        id: p.id,
        name: p.name,
        description: p.description
      });
    });

    // IDs de permisos seleccionados
    const selectedPermissions = userPermissions.map(up => up.permission_id);

    // Response según esquema UserPermissionsResponse (líneas 2151-2154)
    return res.status(200).json({
      userId: id,
      permissionsByModule,
      selectedPermissions
    });

  } catch (error) {
    console.error('Error en getUserPermissions:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener los permisos del usuario'
    });
  }
};

/**
 * API-029: UpdateUserPermissions
 * PUT /api/users/:id/permissions
 * Actualiza los permisos asignados a un usuario
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 2177-2231
 */
const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'id debe ser un UUID válido'
      });
    }

    // id debe existir (línea 2219)
    const existingUser = await prisma.users.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    // permissions debe ser array
    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'permissions debe ser un array de IDs'
      });
    }

    // Cada permission ID debe existir (línea 2220)
    if (permissions.length > 0) {
      const existingPermissions = await prisma.permissions.findMany({
        where: { id: { in: permissions } }
      });
      if (existingPermissions.length !== permissions.length) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Algunos permission IDs no existen'
        });
      }
    }

    // Reemplaza permisos existentes completamente (línea 2222)
    // Delete + Insert
    await prisma.$transaction(async (tx) => {
      // Eliminar permisos existentes
      await tx.user_permissions.deleteMany({
        where: { user_id: id }
      });

      // Insertar nuevos permisos
      if (permissions.length > 0) {
        await tx.user_permissions.createMany({
          data: permissions.map(permissionId => ({
            user_id: id,
            permission_id: permissionId
          }))
        });
      }
    });

    // Response según esquema UserPermissionsResponse (líneas 2206-2208)
    return res.status(200).json({
      userId: id,
      updated: permissions.length
    });

  } catch (error) {
    console.error('Error en updateUserPermissions:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar los permisos del usuario'
    });
  }
};

/**
 * ListRoles
 * GET /api/users/roles/list
 * Lista todos los roles disponibles en el sistema
 * Roles: Admin
 * Integrado para ELM-389 UserBasicInfoForm
 */
const listRoles = async (req, res) => {
  try {
    const roles = await prisma.roles.findMany({
      orderBy: { name: 'asc' }
    });

    // Mapear respuesta
    const data = roles.map(role => ({
      id: role.role_id,
      name: role.name,
      displayName: role.display_name,
      description: role.description || ''
    }));

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error en listRoles:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener los roles'
    });
  }
};

/**
 * API-030: GetUserStats
 * GET /api/users/stats
 * Estadísticas agregadas de usuarios por rol
 * Roles: Admin
 * Fuente: 04_apis_lista.md líneas 2232-2285
 */
const getUserStats = async (req, res) => {
  try {
    // Filtro para excluir usuarios eliminados (soft delete)
    const notDeletedFilter = { deleted_at: null, status: { not: 'deleted' } };

    // Obtener conteos por rol (solo usuarios no eliminados)
    const [roleStats, guideStats, totalUsers] = await Promise.all([
      prisma.users.groupBy({
        by: ['role_id'],
        where: notDeletedFilter,
        _count: { role_id: true }
      }),
      prisma.guides.groupBy({
        by: ['guide_type'],
        where: {
          users: notDeletedFilter
        },
        _count: { guide_type: true }
      }),
      prisma.users.count({ where: notDeletedFilter })
    ]);

    // Obtener roles
    const roles = await prisma.roles.findMany();
    const roleMap = new Map(roles.map(r => [r.role_id, r.name.toLowerCase()]));

    // Procesar stats (líneas 2258-2264)
    const stats = {
      total: totalUsers,
      administradores: 0,
      agencias: 0,
      guias: 0,
      guiasPlanta: 0,
      guiasFreelance: 0
    };

    roleStats.forEach(item => {
      const roleName = roleMap.get(item.role_id);
      if (roleName === 'administrator') stats.administradores = item._count.role_id;
      if (roleName === 'agency') stats.agencias = item._count.role_id;
      if (roleName === 'guide') stats.guias = item._count.role_id;
    });

    guideStats.forEach(item => {
      // Guías de planta se guardan como 'AGENCY' en la BD
      if (item.guide_type === 'AGENCY') stats.guiasPlanta = item._count.guide_type;
      if (item.guide_type === 'FREELANCE') stats.guiasFreelance = item._count.guide_type;
    });

    // Response según esquema UserStatsResponse (líneas 2258-2264)
    return res.status(200).json(stats);

  } catch (error) {
    console.error('Error en getUserStats:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener las estadísticas de usuarios'
    });
  }
};

/**
 * CheckUnique
 * POST /api/users/check-unique
 * Verifica si un username o email ya está en uso
 * Roles: Admin
 * Útil para validaciones en tiempo real en formularios
 */
const checkUnique = async (req, res) => {
  try {
    const { username, email, excludeUserId } = req.body;

    // Al menos uno de los campos debe estar presente
    if (!username && !email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Debe proporcionar username o email para verificar'
      });
    }

    const conditions = [];

    if (username) {
      conditions.push({ username: username.toLowerCase() });
    }

    if (email) {
      conditions.push({ email: email.toLowerCase() });
    }

    const where = {
      OR: conditions
    };

    // Si se proporciona excludeUserId, excluir ese usuario de la búsqueda
    // (útil para validar al editar un usuario existente)
    if (excludeUserId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(excludeUserId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'excludeUserId debe ser un UUID válido'
        });
      }
      where.id = { not: excludeUserId };
    }

    const existingUser = await prisma.users.findFirst({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        deleted_at: true
      }
    });

    if (!existingUser) {
      return res.status(200).json({
        available: true,
        message: 'El username y email están disponibles'
      });
    }

    // Determinar qué campo está duplicado
    const conflicts = [];
    if (username && existingUser.username === username.toLowerCase()) {
      conflicts.push('username');
    }
    if (email && existingUser.email === email.toLowerCase()) {
      conflicts.push('email');
    }

    return res.status(200).json({
      available: false,
      conflicts,
      message: `${conflicts.join(' y ')} ya ${conflicts.length > 1 ? 'están' : 'está'} en uso`,
      isDeleted: !!existingUser.deleted_at
    });

  } catch (error) {
    console.error('Error en checkUnique:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al verificar unicidad'
    });
  }
};

/**
 * RestoreUser
 * POST /api/users/:id/restore
 * Restaura un usuario eliminado (soft delete)
 * Roles: Admin
 */
const restoreUser = async (req, res) => {
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

    // Verificar que el usuario existe (incluir relaciones)
    const existingUser = await prisma.users.findUnique({
      where: { id },
      include: { guides: true, agencies: true }
    });

    if (!existingUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que el usuario está eliminado
    if (!existingUser.deleted_at) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El usuario no está eliminado'
      });
    }

    // Restaurar usuario y entidades asociadas usando transacción
    const now = new Date();

    const restoredUser = await prisma.$transaction(async (tx) => {
      // 1. Restaurar el usuario
      const user = await tx.users.update({
        where: { id },
        data: {
          deleted_at: null,
          status: 'active',
          updated_at: now
        }
      });

      // 2. Si tiene un guía asociado, también restaurarlo
      if (existingUser.guides && existingUser.guides.status === 'deleted') {
        await tx.guides.update({
          where: { id: existingUser.guides.id },
          data: {
            status: 'active',
            updated_at: now
          }
        });
      }

      // 3. Si tiene una agencia asociada, también restaurarla
      if (existingUser.agencies && existingUser.agencies.status === 'deleted') {
        await tx.agencies.update({
          where: { id: existingUser.agencies.id },
          data: {
            status: 'active',
            updated_at: now
          }
        });
      }

      return user;
    });

    return res.status(200).json({
      success: true,
      message: 'Usuario restaurado correctamente',
      id: restoredUser.id,
      status: restoredUser.status
    });

  } catch (error) {
    console.error('Error en restoreUser:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al restaurar el usuario'
    });
  }
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  resetUserPassword,
  getUserPermissions,
  updateUserPermissions,
  getUserStats,
  listRoles,
  restoreUser,
  checkUnique
};
