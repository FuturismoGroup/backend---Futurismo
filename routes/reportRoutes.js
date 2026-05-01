// Routes de Reports
// Fuente: 04_apis_lista.md
// API-085 a API-087: Generación de reportes

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * API-085: GetReservationsReport
 * GET /api/reports/reservations
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/reservations',
  authenticate,
  authorize(['admin', 'agency']),
  reportController.getReservationsReport
);

/**
 * API-086: GetFinancialReport
 * GET /api/reports/financial
 * Roles permitidos: Admin
 */
router.get(
  '/financial',
  authenticate,
  authorize(['admin']),
  reportController.getFinancialReport
);

/**
 * API-087: GetGuidesReport
 * GET /api/reports/guides
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/guides',
  authenticate,
  authorize(['admin', 'agency']),
  reportController.getGuidesReport
);

/**
 * API-109: ExportReport
 * GET /api/reports/export
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/export',
  authenticate,
  authorize(['admin', 'agency']),
  reportController.exportReport
);

module.exports = router;
