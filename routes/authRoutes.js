// Routes de Auth
// Fuente: 04_apis_lista.md
// API-091 a API-096, API-104, API-105: Autenticación

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { auth: authValidation } = require('../validations');
const { handleGuidePhotoUpload } = require('../middlewares/uploadGuidePhoto');

/**
 * API-091: Login
 * POST /api/auth/login
 * Público - sin autenticación
 */
router.post('/login', validate(authValidation.loginSchema), authController.login);

/**
 * API-092: Logout
 * POST /api/auth/logout
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.post(
  '/logout',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  authController.logout
);

/**
 * API-093: RefreshToken
 * POST /api/auth/refresh
 * Público - requiere refresh token válido
 */
router.post('/refresh', authController.refreshToken);

/**
 * API-094: GetCurrentUser
 * GET /api/auth/me
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.get(
  '/me',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  authController.getCurrentUser
);

/**
 * API-095: UpdateProfile
 * PUT /api/auth/profile
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.put(
  '/profile',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  authController.updateProfile
);

/**
 * API-096: ChangePassword
 * POST /api/auth/change-password
 * Roles permitidos: Admin, Agency, Guide, Client
 */
router.post(
  '/change-password',
  authenticate,
  authorize(['admin', 'agency', 'guide', 'client']),
  validate(authValidation.changePasswordSchema),
  authController.changePassword
);

/**
 * API-104: ForgotPassword
 * POST /api/auth/forgot-password
 * Público - sin autenticación
 */
router.post('/forgot-password', validate(authValidation.forgotPasswordSchema), authController.forgotPassword);

/**
 * API-105: ResetPassword
 * POST /api/auth/reset-password
 * Público - con token válido
 */
router.post('/reset-password', authController.resetPassword);

/**
 * API-NEW: RegisterFreelancer
 * POST /api/auth/register-freelancer
 * Público - sin autenticación
 * Registra un nuevo guía freelance
 */
router.post('/register-freelancer', handleGuidePhotoUpload, authController.registerFreelancer);

module.exports = router;
