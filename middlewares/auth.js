// Middleware de Autenticación y Autorización
// Soporta JWT para APIs protegidas

const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { JWT_SECRET } = require('../config/env');

/**
 * Middleware de autenticación
 * Verifica el token JWT y carga el usuario en req.user
 */
const authenticate = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token de autenticación no proporcionado'
      });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token expirado'
        });
      }
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token inválido'
      });
    }

    // Validar que el token contenga userId
    // El token puede tener userId o id dependiendo de cómo fue generado
    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      console.error('Token sin userId válido. Decoded:', decoded);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token malformado - falta userId'
      });
    }

    // Buscar usuario en base de datos
    // Nota: El modelo Prisma es 'users' (plural) y la relación es 'roles'
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        agencies: true,
        guides: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si el usuario fue eliminado (soft delete)
    if (user.deleted_at) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Esta cuenta ha sido eliminada'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario inactivo'
      });
    }

    // Agregar usuario a la request
    // Agregar alias 'role' para compatibilidad con código existente que usa req.user.role
    req.user = {
      ...user,
      role: user.roles?.name?.toLowerCase(), // Para comparaciones directas como req.user.role === 'agency'
      agency: user.agencies,
      guide: user.guides,
      agencyId: user.agencies?.id,
      guideId: user.guides?.id
    };
    next();

  } catch (error) {
    console.error('Error en authenticate:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error de autenticación'
    });
  }
};

/**
 * Mapeo de alias de roles para compatibilidad
 * Permite usar 'admin' como alias de 'administrator' en el código
 */
const ROLE_ALIASES = {
  'admin': 'administrator',
  'administrator': 'administrator',
  'agency': 'agency',
  'guide': 'guide',
  'client': 'client',
  'tourist': 'tourist'
};

/**
 * Middleware de autorización por roles
 * @param {string[]} allowedRoles - Array de roles permitidos (lowercase)
 *
 * Los roles permitidos se comparan contra el nombre del rol en la tabla 'roles' de la BD.
 * Se soportan alias: 'admin' es equivalente a 'administrator'
 *
 * IMPORTANTE: El rol 'administrator' tiene acceso TOTAL a todos los endpoints.
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No autenticado'
      });
    }

    // req.user.role ya es un string lowercase (establecido en authenticate)
    const userRole = req.user.role;

    // También normalizar el rol del usuario
    const normalizedUserRole = ROLE_ALIASES[userRole] || userRole;

    // ADMINISTRADOR TIENE ACCESO TOTAL A TODOS LOS ENDPOINTS
    if (normalizedUserRole === 'administrator') {
      return next();
    }

    // Normalizar los roles permitidos usando el mapeo de alias
    const normalizedAllowedRoles = allowedRoles.map(role => {
      const lowerRole = role.toLowerCase();
      return ROLE_ALIASES[lowerRole] || lowerRole;
    });

    if (!normalizedUserRole || !normalizedAllowedRoles.includes(normalizedUserRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No tiene permisos para acceder a este recurso'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  JWT_SECRET
};
