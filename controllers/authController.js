// Controller de Auth
// Fuente: 04_apis_lista.md
// API-091 a API-096, API-104, API-105: Autenticación y gestión de sesiones

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

const REFRESH_TOKEN_EXPIRES_DAYS = 7;

/**
 * API-091: Login
 * POST /api/auth/login
 * Público - sin autenticación
 */
const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email y password son obligatorios'
      });
    }

    // Buscar usuario
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        agencies: {
          select: {
            id: true,
            business_name: true
          }
        },
        roles: {
          select: {
            name: true
          }
        },
        guides: {
          select: {
            id: true,
            guide_type: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Credenciales inválidas'
      });
    }

    // Verificar si está bloqueado
    if (user.status === 'blocked') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cuenta bloqueada. Contacte al administrador.'
      });
    }

    if (user.status !== 'active') {
      const statusMessages = {
        pending_approval: 'Tu cuenta está pendiente de aprobación por un administrador. Te notificaremos cuando sea activada.',
        suspended: 'Tu cuenta ha sido suspendida. Contacta al administrador.',
        inactive: 'Tu cuenta está inactiva. Contacta al administrador.'
      };
      return res.status(403).json({
        error: 'Forbidden',
        message: statusMessages[user.status] || 'Cuenta no activa. Contacta al administrador.',
        accountStatus: user.status
      });
    }

    // Verificar contraseña (campo real: password_hash)
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Credenciales inválidas'
      });
    }

    // Obtener nombre del rol desde la relación
    const roleName = user.roles?.name || 'user';

    // Generar tokens
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: roleName,
        agencyId: user.agencies?.id || null
      },
      JWT_SECRET,
      { expiresIn: rememberMe ? '7d' : JWT_EXPIRES_IN }
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Actualizar último login
    await prisma.users.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date()
      }
    });

    res.json({
      accessToken,
      refreshToken,
      expiresIn: rememberMe ? 604800 : 3600, // 7 dias o 1 hora en segundos
      user: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: roleName,
        avatar: user.profile_photo,
        agencyId: user.agencies?.id || null,
        agencyName: user.agencies?.business_name || null,
        guideId: user.guides?.id || null,
        guideType: user.guides?.guide_type?.toLowerCase() || null
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al iniciar sesión'
    });
  }
};

/**
 * API-092: Logout
 * POST /api/auth/logout
 * Roles permitidos: Todos los autenticados
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Invalidar sesión actual
    if (refreshToken) {
      await prisma.session.updateMany({
        where: { refreshToken },
        data: { active: false }
      });
    }

    // También podríamos invalidar por userId del token actual
    // Aquí se podría agregar el token a una blacklist

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al cerrar sesión'
    });
  }
};

/**
 * API-093: RefreshToken
 * POST /api/auth/refresh
 * Público - requiere refresh token válido
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'refreshToken es obligatorio'
      });
    }

    // Buscar sesión
    const session = await prisma.session.findFirst({
      where: {
        refreshToken: token,
        active: true,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            agencyId: true,
            status: true
          }
        }
      }
    });

    if (!session) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token de refresco inválido o expirado'
      });
    }

    if (session.user.status !== 'active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cuenta inactiva'
      });
    }

    // Generar nuevo access token
    const accessToken = jwt.sign(
      {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        agencyId: session.user.agencyId
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      accessToken,
      expiresIn: 3600 // 1 hora
    });
  } catch (error) {
    console.error('Error en refreshToken:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al refrescar token'
    });
  }
};

/**
 * API-094: GetCurrentUser
 * GET /api/auth/me
 * Roles permitidos: Todos los autenticados
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      include: {
        agencies: {
          select: {
            id: true,
            business_name: true
          }
        },
        guides: {
          select: {
            id: true,
            guide_type: true,
            specialties: true
          }
        },
        roles: {
          select: {
            name: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.roles?.name || 'user',
      avatar: user.profile_photo,
      phone: user.phone,
      agencyId: user.agencies?.id || null,
      agencyName: user.agencies?.business_name || null,
      guideId: user.guides?.id || null,
      guideType: user.guides?.guide_type?.toLowerCase() || null,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Error en getCurrentUser:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al obtener usuario actual'
    });
  }
};

/**
 * API-095: UpdateProfile
 * PUT /api/auth/profile
 * Roles permitidos: Todos los autenticados
 */
const updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      avatar,
      preferences,
      language,
      timezone
    } = req.body;

    // Validaciones
    if (name && name.length < 2) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name debe tener al menos 2 caracteres'
      });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        phone,
        avatar,
        preferences,
        language,
        timezone,
        updatedAt: new Date()
      }
    });

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      preferences: user.preferences,
      language: user.language,
      timezone: user.timezone,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error('Error en updateProfile:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al actualizar perfil'
    });
  }
};

/**
 * API-096: ChangePassword
 * POST /api/auth/change-password
 * Roles permitidos: Todos los autenticados
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Todos los campos son obligatorios'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Las contraseñas no coinciden'
      });
    }

    // Validar política de contraseña (mínimo 8 caracteres, mayúsculas, números)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número'
      });
    }

    // Verificar contraseña actual
    const user = await prisma.users.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Contraseña actual incorrecta'
      });
    }

    // Actualizar contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.users.update({
      where: { id: req.user.id },
      data: {
        password_hash: hashedPassword,
        updated_at: new Date()
      }
    });

    // TODO: Enviar email de notificación

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    console.error('Error en changePassword:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al cambiar contraseña'
    });
  }
};

/**
 * API-104: ForgotPassword
 * POST /api/auth/forgot-password
 * Público - sin autenticación
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email es obligatorio'
      });
    }

    // Siempre responder igual (por seguridad)
    const genericResponse = {
      success: true,
      message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
    };

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // No revelar si el email existe
      return res.json(genericResponse);
    }

    // Generar token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expira en 1 hora

    // Guardar token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt
      }
    });

    // TODO: Enviar email con resetToken (no el hash)
    console.log(`Reset token para ${email}: ${resetToken}`);

    res.json(genericResponse);
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al procesar solicitud'
    });
  }
};

/**
 * API-NEW: RegisterFreelancer
 * POST /api/auth/register-freelancer
 * Público - sin autenticación
 * Registra un nuevo guía freelance con estado pending_approval
 */
const registerFreelancer = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      documentType,
      documentNumber,
      password,
      languages,
      licenseNumber,
      experience,
      specialties,
      museums,
      city
    } = req.body;

    // Foto subida por multer (si existe)
    const photo = req.file ? `/uploads/guias-freelance/${req.file.filename}` : null;

    // Validaciones obligatorias
    if (!firstName || !lastName || !email || !phone || !documentType || !documentNumber || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Todos los campos obligatorios deben ser completados'
      });
    }

    // Validar formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Formato de email inválido'
      });
    }

    // Validar teléfono peruano (9 dígitos empezando con 9)
    const phoneRegex = /^9\d{8}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El teléfono debe tener 9 dígitos y empezar con 9'
      });
    }

    // Validar documento según tipo
    if (documentType === 'dni' && !/^\d{8}$/.test(documentNumber)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'DNI debe tener 8 dígitos'
      });
    }

    // Validar contraseña (mínimo 8 caracteres, mayúsculas, minúsculas, números)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'La contraseña debe tener al menos 8 caracteres, mayúsculas, minúsculas y números'
      });
    }

    // Verificar email no duplicado
    const existingUser = await prisma.users.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Ya existe un usuario registrado con este email'
      });
    }

    // Verificar documento no duplicado
    const existingDocument = await prisma.users.findFirst({
      where: {
        document_type: documentType,
        document_number: documentNumber
      }
    });

    if (existingDocument) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Ya existe un usuario registrado con este documento'
      });
    }

    // Buscar role_id para 'guide'
    const guideRole = await prisma.roles.findFirst({
      where: { name: 'guide' }
    });

    if (!guideRole) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Rol de guía no configurado en el sistema'
      });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generar username único
    const baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/\s+/g, '');
    let username = baseUsername;
    let counter = 1;
    while (await prisma.users.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Crear usuario y guía en transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear usuario con status pending_approval
      const newUser = await tx.users.create({
        data: {
          username,
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          phone,
          role_id: guideRole.role_id,
          status: 'pending_approval',
          document_type: documentType,
          document_number: documentNumber,
          city: city || null,
          profile_photo: photo || null
        }
      });

      // Crear registro de guía freelance
      const newGuide = await tx.guides.create({
        data: {
          user_id: newUser.id,
          guide_type: 'FREELANCE',
          license_number: licenseNumber || null,
          languages: (() => {
            const langs = typeof languages === 'string' ? JSON.parse(languages) : (Array.isArray(languages) ? languages : []);
            return langs.map(lang => ({ code: lang, level: 'fluent' }));
          })(),
          specialties: (() => {
            const specs = typeof specialties === 'string' ? JSON.parse(specialties) : (Array.isArray(specialties) ? specialties : []);
            return specs;
          })(),
          museums: (() => {
            const m = typeof museums === 'string' ? JSON.parse(museums) : (Array.isArray(museums) ? museums : []);
            return m;
          })(),
          bio: null,
          years_of_experience: typeof experience === 'number' ? experience : parseInt(experience) || 0
        }
      });

      return { user: newUser, guide: newGuide };
    });

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Registro exitoso. Tu solicitud está pendiente de aprobación.',
      data: {
        userId: result.user.id,
        guideId: result.guide.id,
        email: result.user.email,
        status: 'pending_approval'
      }
    });

  } catch (error) {
    console.error('Error en registerFreelancer:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al procesar el registro'
    });
  }
};

/**
 * API-105: ResetPassword
 * POST /api/auth/reset-password
 * Público - con token válido
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    // Validaciones
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Todos los campos son obligatorios'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Las contraseñas no coinciden'
      });
    }

    // Validar política de contraseña
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número'
      });
    }

    // Buscar token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetTokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        token: tokenHash,
        used: false,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!resetTokenRecord) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Token inválido o expirado'
      });
    }

    // Actualizar contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      // Actualizar contraseña
      prisma.user.update({
        where: { id: resetTokenRecord.userId },
        data: {
          passwordHash: hashedPassword,
          updatedAt: new Date()
        }
      }),
      // Marcar token como usado
      prisma.passwordResetToken.update({
        where: { id: resetTokenRecord.id },
        data: { used: true }
      }),
      // Invalidar todas las sesiones
      prisma.session.updateMany({
        where: { userId: resetTokenRecord.userId },
        data: { active: false }
      })
    ]);

    res.json({
      success: true,
      message: 'Contraseña restablecida correctamente'
    });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error al restablecer contraseña'
    });
  }
};

module.exports = {
  login,
  logout,
  refreshToken,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  registerFreelancer
};
