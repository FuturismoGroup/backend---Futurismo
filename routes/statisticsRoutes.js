// Routes de Statistics
// API para estadísticas y tendencias de reservaciones
// Endpoint usado por useReservationStats hook en frontend

const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');
const { authenticate, authorize } = require('../middlewares/auth');

/**
 * GET /api/statistics/reservations/trends
 * Obtiene tendencias de reservaciones para dashboard
 * Roles permitidos: Admin, Agency
 */
router.get(
  '/reservations/trends',
  authenticate,
  authorize(['admin', 'agency']),
  statisticsController.getReservationTrends
);

module.exports = router;
