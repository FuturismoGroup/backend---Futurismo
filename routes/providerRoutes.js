// Routes de Providers
// Fuente: 04_apis_lista.md
// API-076 a API-080: Gestion de proveedores de servicios externos
// Proveedores son informativos: solo admin y guias tienen acceso

const express = require('express');
const router = express.Router();
const multer = require('multer');
const providerController = require('../controllers/providerController');
const { authenticate, authorize } = require('../middlewares/auth');

// Configurar multer para upload de archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'), false);
    }
  }
});

// ============================================
// LOCATIONS (rutas especificas ANTES de /:id)
// Para ELM-329 LocationTree y flujos FLW-039, FLW-093
// Tabla: locations (TBL-018)
// ============================================

/**
 * ListLocations
 * GET /api/providers/locations
 * Lista ubicaciones para arbol jerarquico
 * Usado por ELM-329 (LocationTree)
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/locations',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.listLocations
);

/**
 * CreateLocation
 * POST /api/providers/locations
 * Crea nueva ubicacion
 * Usado por ELM-331 (NewLocationModal)
 * Roles permitidos: Admin
 */
router.post(
  '/locations',
  authenticate,
  authorize(['admin']),
  providerController.createLocation
);

// ============================================
// CATEGORIES (categorias de proveedores)
// Para ELM-329, ELM-330 y flujos FLW-014, FLW-039
// Tabla: provider_categories
// ============================================

/**
 * ListCategories
 * GET /api/providers/categories
 * Lista categorias de proveedores
 * Usado por ELM-329 (LocationTree), ELM-330 (NewCategoryModal)
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/categories',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.listCategories
);

/**
 * CreateCategory
 * POST /api/providers/categories
 * Crea nueva categoria
 * Usado por ELM-330 (NewCategoryModal)
 * Roles permitidos: Admin
 */
router.post(
  '/categories',
  authenticate,
  authorize(['admin']),
  providerController.createCategory
);

// ============================================
// SERVICES (servicios de proveedores)
// Para flujos FLW-014, FLW-037
// Tabla: provider_services
// ============================================

/**
 * ListServices
 * GET /api/providers/services
 * Lista servicios de proveedores
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/services',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.listServices
);

/**
 * CreateService
 * POST /api/providers/services
 * Crea nuevo servicio
 * Roles permitidos: Admin
 */
router.post(
  '/services',
  authenticate,
  authorize(['admin']),
  providerController.createService
);

// ============================================
// RUTAS ADICIONALES (ANTES de /:id)
// ============================================

/**
 * SearchProviders
 * GET /api/providers/search
 * Búsqueda avanzada de proveedores
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/search',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.searchProviders
);

/**
 * GetProvidersStats
 * GET /api/providers/stats
 * Estadísticas de proveedores
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/stats',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.getProvidersStats
);

/**
 * ExportProviders
 * GET /api/providers/export
 * Exportar proveedores a CSV/JSON
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/export',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.exportProviders
);

/**
 * ImportProviders
 * POST /api/providers/import
 * Importar proveedores desde CSV/JSON
 * Roles permitidos: Admin
 */
router.post(
  '/import',
  authenticate,
  authorize(['admin']),
  upload.single('file'),
  providerController.importProviders
);

// ============================================
// PROVIDERS (CRUD basico)
// ============================================

/**
 * API-076: ListProviders
 * GET /api/providers
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.listProviders
);

/**
 * API-078: CreateProvider
 * POST /api/providers
 * Roles permitidos: Admin
 */
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  providerController.createProvider
);

/**
 * API-077: GetProvider
 * GET /api/providers/:id
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.getProvider
);

/**
 * API-079: UpdateProvider
 * PUT /api/providers/:id
 * Roles permitidos: Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  providerController.updateProvider
);

/**
 * API-080: DeleteProvider
 * DELETE /api/providers/:id
 * Roles permitidos: Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  providerController.deleteProvider
);

/**
 * ToggleProviderStatus
 * PATCH /api/providers/:id/status
 * Cambia el status de un proveedor
 * Roles permitidos: Admin
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  providerController.toggleProviderStatus
);

/**
 * CheckProviderAvailability
 * POST /api/providers/:id/check-availability
 * Verifica disponibilidad de un proveedor
 * Roles permitidos: Admin, Agency
 */
router.post(
  '/:id/check-availability',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.checkProviderAvailability
);

/**
 * RateProvider
 * POST /api/providers/:id/rate
 * Calificar un proveedor
 * Roles permitidos: Admin, Agency
 */
router.post(
  '/:id/rate',
  authenticate,
  authorize(['admin', 'guide']),
  providerController.rateProvider
);

/**
 * CloneProvider
 * POST /api/providers/:id/clone
 * Clonar un proveedor existente
 * Roles permitidos: Admin
 */
router.post(
  '/:id/clone',
  authenticate,
  authorize(['admin']),
  providerController.cloneProvider
);

module.exports = router;
