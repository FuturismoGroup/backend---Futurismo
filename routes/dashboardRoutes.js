// Routes de Dashboard
// Fuente: 04_apis_lista.md
// API-018: GET /api/dashboard/summary (GetDashboardSummary)
// Endpoints adicionales para Dashboard.jsx y componentes relacionados

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * API-018: GetDashboardSummary
 * GET /api/dashboard/summary
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/summary',
  authenticate,
  authorize(['admin', 'agency']),
  dashboardController.getDashboardSummary
);

/**
 * GET /api/dashboard/stats
 * Estadisticas del dashboard segun rol
 * Usado por: useDashboard hook (Dashboard.jsx)
 * Roles: Admin, Agency, Guide
 */
router.get(
  '/stats',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  dashboardController.getDashboardStats
);

/**
 * GET /api/dashboard/monthly-data
 * Datos mensuales para graficos
 * Usado por: useDashboard hook (Dashboard.jsx - grafico de ingresos guide)
 * Roles: Admin, Agency, Guide
 */
router.get(
  '/monthly-data',
  authenticate,
  authorize(['admin', 'agency', 'guide']),
  dashboardController.getMonthlyData
);

/**
 * GET /api/dashboard/kpis
 * KPIs para graficos del dashboard
 * Usado por: useServiceChart hook (ServiceChart.jsx)
 * Roles: Admin, Agency
 */
router.get(
  '/kpis',
  authenticate,
  authorize(['admin', 'agency']),
  dashboardController.getKPIs
);

/**
 * GET /api/dashboard/chart-data
 * Datos para graficos del dashboard
 * Usado por: useServiceChart hook (ServiceChart.jsx)
 * Roles: Admin, Agency
 */
router.get(
  '/chart-data',
  authenticate,
  authorize(['admin', 'agency']),
  dashboardController.getChartData
);

/**
 * GET /api/dashboard/summary-data
 * Resumen para el panel de exportacion
 * Usado por: useServiceChart hook (ServiceChart.jsx)
 * Roles: Admin, Agency
 */
router.get(
  '/summary-data',
  authenticate,
  authorize(['admin', 'agency']),
  dashboardController.getSummaryData
);

module.exports = router;
