// Financial Routes - Rutas del módulo financiero para guías
const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financialController');
const { authenticate, authorize } = require('../middlewares/auth');

// ============================================
// CATEGORÍAS Y TIPOS
// ============================================

// GET /api/financial/expense-categories - Obtener categorías de gastos
router.get('/expense-categories', authenticate, financialController.getExpenseCategories);

// GET /api/financial/income-types - Obtener tipos de ingreso
router.get('/income-types', authenticate, financialController.getIncomeTypes);

// ============================================
// GASTOS (CRUD)
// ============================================

// GET /api/financial/expenses - Listar gastos
router.get('/expenses', authenticate, financialController.getExpenses);

// POST /api/financial/expenses - Crear gasto
router.post('/expenses', authenticate, financialController.createExpense);

// PUT /api/financial/expenses/:id - Actualizar gasto
router.put('/expenses/:id', authenticate, financialController.updateExpense);

// DELETE /api/financial/expenses/:id - Eliminar gasto
router.delete('/expenses/:id', authenticate, financialController.deleteExpense);

// ============================================
// INGRESOS (CRUD)
// ============================================

// GET /api/financial/income - Listar ingresos
router.get('/income', authenticate, financialController.getIncome);

// POST /api/financial/income - Crear ingreso
router.post('/income', authenticate, financialController.createIncome);

// PUT /api/financial/income/:id - Actualizar ingreso
router.put('/income/:id', authenticate, financialController.updateIncome);

// DELETE /api/financial/income/:id - Eliminar ingreso
router.delete('/income/:id', authenticate, financialController.deleteIncome);

// ============================================
// ESTADÍSTICAS Y ANÁLISIS
// ============================================

// GET /api/financial/stats - Obtener estadísticas financieras
router.get('/stats', authenticate, financialController.getFinancialStats);

// GET /api/financial/trends/:guideId - Obtener tendencias de rentabilidad
router.get('/trends/:guideId', authenticate, financialController.getProfitabilityTrends);

// GET /api/financial/budget-analysis/:guideId - Obtener análisis de presupuesto
router.get('/budget-analysis/:guideId', authenticate, financialController.getBudgetAnalysis);

// ============================================
// CALCULADORA
// ============================================

// GET /api/financial/calculations - Obtener cálculos guardados
router.get('/calculations', authenticate, financialController.getCalculations);

// POST /api/financial/calculations - Guardar cálculo
router.post('/calculations', authenticate, financialController.saveCalculation);

// DELETE /api/financial/calculations/:id - Eliminar cálculo
router.delete('/calculations/:id', authenticate, financialController.deleteCalculation);

module.exports = router;
