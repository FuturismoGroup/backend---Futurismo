// Routes de Emergencies
// Fuente: 04_apis_lista.md
// API-071 a API-075: Gestión de emergencias
// + Rutas para tipos de contacto de emergencia (emergency_contact_types)

const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const emergencyContactTypeController = require('../controllers/emergencyContactTypeController');
const emergencyCategoryController = require('../controllers/emergencyCategoryController');
const emergencyMaterialController = require('../controllers/emergencyMaterialController');
const protocolController = require('../controllers/protocolController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { emergency: ev } = require('../validations');

// ============================================================================
// RUTAS PARA TIPOS DE CONTACTO DE EMERGENCIA (emergency_contact_types)
// Tabla: emergency_contact_types
// IMPORTANTE: Estas rutas DEBEN ir ANTES de las rutas con /:id para evitar
// que Express interprete "contact-types" como un ID de emergencia.
// ============================================================================

/**
 * GET /api/emergency/contact-types
 * Lista todos los tipos de contacto de emergencia activos
 * Roles: Admin
 */
router.get(
  '/contact-types',
  authenticate,
  authorize(['admin']),
  emergencyContactTypeController.listContactTypes
);

/**
 * POST /api/emergency/contact-types
 * Crea un nuevo tipo de contacto
 * Roles: Admin
 */
router.post(
  '/contact-types',
  authenticate,
  authorize(['admin']),
  validate(ev.createContactTypeSchema),
  emergencyContactTypeController.createContactType
);

/**
 * GET /api/emergency/contact-types/:id
 * Obtiene un tipo de contacto por ID
 * Roles: Admin
 */
router.get(
  '/contact-types/:id',
  authenticate,
  authorize(['admin']),
  emergencyContactTypeController.getContactType
);

/**
 * PUT /api/emergency/contact-types/:id
 * Actualiza un tipo de contacto
 * Roles: Admin
 */
router.put(
  '/contact-types/:id',
  authenticate,
  authorize(['admin']),
  validate(ev.updateContactTypeSchema),
  emergencyContactTypeController.updateContactType
);

/**
 * DELETE /api/emergency/contact-types/:id
 * Elimina un tipo de contacto (soft delete)
 * Roles: Admin
 */
router.delete(
  '/contact-types/:id',
  authenticate,
  authorize(['admin']),
  emergencyContactTypeController.deleteContactType
);

// ============================================================================
// RUTAS PARA CATEGORÍAS DE EMERGENCIA (emergency_categories)
// Tabla: emergency_categories
// IMPORTANTE: Estas rutas DEBEN ir ANTES de las rutas con /:id
// ============================================================================

/**
 * GET /api/emergency/categories
 * Lista todas las categorías de emergencia activas
 * Roles: Admin, Agency, Guide
 * NOTA: Lectura permitida para todos los roles autenticados
 *       ya que se usa en filtros de EmergencyProtocols.jsx
 */
router.get(
  '/categories',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  emergencyCategoryController.listCategories
);

/**
 * POST /api/emergency/categories
 * Crea una nueva categoría de emergencia
 * Roles: Admin
 */
router.post(
  '/categories',
  authenticate,
  authorize(['admin']),
  validate(ev.createEmergencyCategorySchema),
  emergencyCategoryController.createCategory
);

/**
 * GET /api/emergency/categories/:id
 * Obtiene una categoría por ID
 * Roles: Admin
 */
router.get(
  '/categories/:id',
  authenticate,
  authorize(['admin']),
  emergencyCategoryController.getCategory
);

/**
 * PUT /api/emergency/categories/:id
 * Actualiza una categoría
 * Roles: Admin
 */
router.put(
  '/categories/:id',
  authenticate,
  authorize(['admin']),
  validate(ev.updateEmergencyCategorySchema),
  emergencyCategoryController.updateCategory
);

/**
 * DELETE /api/emergency/categories/:id
 * Elimina una categoría (soft delete)
 * Roles: Admin
 */
router.delete(
  '/categories/:id',
  authenticate,
  authorize(['admin']),
  emergencyCategoryController.deleteCategory
);

// ============================================================================
// RUTAS PARA MATERIALES DE EMERGENCIA (emergency_materials)
// Tabla: emergency_materials
// IMPORTANTE: Estas rutas DEBEN ir ANTES de las rutas con /:id
// ============================================================================

/**
 * GET /api/emergency/materials
 * Lista todos los materiales de emergencia activos
 * Query params: category, mandatory, search
 * Roles: Admin, Agency, Guide
 */
router.get(
  '/materials',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  emergencyMaterialController.listMaterials
);

/**
 * GET /api/emergency/materials/categories
 * Lista las categorías únicas de materiales
 * Roles: Admin, Agency, Guide
 */
router.get(
  '/materials/categories',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  emergencyMaterialController.listCategories
);

/**
 * POST /api/emergency/materials
 * Crea un nuevo material de emergencia
 * Roles: Admin
 */
router.post(
  '/materials',
  authenticate,
  authorize(['admin']),
  validate(ev.createEmergencyMaterialSchema),
  emergencyMaterialController.createMaterial
);

/**
 * GET /api/emergency/materials/:id
 * Obtiene un material por ID
 * Roles: Admin, Agency, Guide
 */
router.get(
  '/materials/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  emergencyMaterialController.getMaterial
);

/**
 * PUT /api/emergency/materials/:id
 * Actualiza un material
 * Roles: Admin
 */
router.put(
  '/materials/:id',
  authenticate,
  authorize(['admin']),
  validate(ev.updateEmergencyMaterialSchema),
  emergencyMaterialController.updateMaterial
);

/**
 * DELETE /api/emergency/materials/:id
 * Elimina un material (soft delete)
 * Roles: Admin
 */
router.delete(
  '/materials/:id',
  authenticate,
  authorize(['admin']),
  emergencyMaterialController.deleteMaterial
);

/**
 * POST /api/emergency/materials/:id/check
 * Registrar verificación de material
 * Roles: Admin, Guide
 */
router.post(
  '/materials/:id/check',
  authenticate,
  authorize(['admin', 'guide']),
  emergencyMaterialController.checkMaterial
);

// ============================================================================
// RUTAS PARA PROTOCOLOS DE EMERGENCIA (protocols, protocol_steps)
// Tablas: protocols, protocol_steps
// IMPORTANTE: Estas rutas DEBEN ir ANTES de las rutas con /:id
// ============================================================================

/**
 * GET /api/emergency/protocols
 * Lista todos los protocolos
 * Query params: status, category_id, search
 * Roles: Admin, Agency, Guide
 */
router.get(
  '/protocols',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  protocolController.listProtocols
);

/**
 * POST /api/emergency/protocols
 * Crea un nuevo protocolo con sus pasos
 * Roles: Admin
 */
router.post(
  '/protocols',
  authenticate,
  authorize(['admin']),
  validate(ev.createProtocolSchema),
  protocolController.createProtocol
);

/**
 * GET /api/emergency/protocols/:id
 * Obtiene un protocolo por ID con todos sus pasos
 * Roles: Admin, Agency, Guide
 */
router.get(
  '/protocols/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  protocolController.getProtocol
);

/**
 * PUT /api/emergency/protocols/:id
 * Actualiza un protocolo y sus pasos
 * Roles: Admin
 */
router.put(
  '/protocols/:id',
  authenticate,
  authorize(['admin']),
  validate(ev.updateProtocolSchema),
  protocolController.updateProtocol
);

/**
 * DELETE /api/emergency/protocols/:id
 * Elimina un protocolo y sus pasos
 * Roles: Admin
 */
router.delete(
  '/protocols/:id',
  authenticate,
  authorize(['admin']),
  protocolController.deleteProtocol
);

/**
 * PATCH /api/emergency/protocols/:id/status
 * Cambia el estado de un protocolo (draft, published, archived)
 * Roles: Admin
 */
router.patch(
  '/protocols/:id/status',
  authenticate,
  authorize(['admin']),
  validate(ev.updateProtocolStatusSchema),
  protocolController.updateProtocolStatus
);

/**
 * POST /api/emergency/protocols/:id/steps
 * Agrega un paso a un protocolo
 * Roles: Admin
 */
router.post(
  '/protocols/:id/steps',
  authenticate,
  authorize(['admin']),
  protocolController.addProtocolStep
);

/**
 * PUT /api/emergency/protocols/:protocolId/steps/:stepId
 * Actualiza un paso específico
 * Roles: Admin
 */
router.put(
  '/protocols/:protocolId/steps/:stepId',
  authenticate,
  authorize(['admin']),
  protocolController.updateProtocolStep
);

/**
 * DELETE /api/emergency/protocols/:protocolId/steps/:stepId
 * Elimina un paso y reordena los siguientes
 * Roles: Admin
 */
router.delete(
  '/protocols/:protocolId/steps/:stepId',
  authenticate,
  authorize(['admin']),
  protocolController.deleteProtocolStep
);

// ============================================================================
// RUTAS PARA EMERGENCIAS (tabla: emergencies / active_tours con emergencias)
// ============================================================================

/**
 * GET /api/emergency/stats
 * Estadísticas de emergencias
 * Roles: Admin
 */
router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  emergencyController.getEmergencyStats
);

/**
 * API-071: ListEmergencies
 * GET /api/emergencies
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'agency']),
  emergencyController.listEmergencies
);

/**
 * API-073: CreateEmergency
 * POST /api/emergencies
 * Roles permitidos: Admin, Agency, Guide
 */
router.post(
  '/',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  validate(ev.createEmergencySchema),
  emergencyController.createEmergency
);

/**
 * API-074: UpdateEmergencyStatus
 * PATCH /api/emergencies/:id/status
 * Roles permitidos: Admin, Agency
 * NOTA: Debe ir ANTES de /:id genérico
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin', 'agency']),
  validate(ev.updateEmergencyStatusSchema),
  emergencyController.updateEmergencyStatus
);

/**
 * API-075: AddEmergencyAction
 * POST /api/emergencies/:id/actions
 * Roles permitidos: Admin, Agency, Guide
 * NOTA: Debe ir ANTES de /:id genérico
 */
router.post(
  '/:id/actions',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  validate(ev.addEmergencyActionSchema),
  emergencyController.addEmergencyAction
);

/**
 * POST /api/emergency/:id/close
 * Cerrar emergencia
 * Roles: Admin
 */
router.post(
  '/:id/close',
  authenticate,
  authorize(['admin']),
  emergencyController.closeEmergency
);

/**
 * GET /api/emergency/:id/timeline
 * Timeline de una emergencia
 * Roles: Admin, Agency
 */
router.get(
  '/:id/timeline',
  authenticate,
  authorize(['admin', 'agency']),
  emergencyController.getEmergencyTimeline
);

/**
 * API-072: GetEmergency
 * GET /api/emergencies/:id
 * Roles permitidos: Admin, Agency, Guide
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  emergencyController.getEmergency
);

module.exports = router;
