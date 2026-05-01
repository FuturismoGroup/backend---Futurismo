// Financial Controller - Módulo financiero para guías
// Maneja gastos, ingresos, estadísticas y calculadora financiera

const prisma = require('../config/db');
const { formatPrice, formatPercentage, safePercentage } = require('../utils/numberFormatter');
const { parseLocalDate, formatLocalDate, buildDateFilter, buildTimestampFilter } = require('../utils/dateUtils');

// ============================================
// CATEGORÍAS DE GASTOS
// ============================================

const getExpenseCategories = async (req, res) => {
  try {
    const categories = await prisma.expense_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    // Si no hay categorías, crear las predeterminadas
    if (categories.length === 0) {
      const defaultCategories = [
        { name: 'Transporte', value: 'transport', icon: 'truck', color: '#3B82F6' },
        { name: 'Alimentación', value: 'food', icon: 'utensils', color: '#10B981' },
        { name: 'Materiales', value: 'materials', icon: 'box', color: '#F59E0B' },
        { name: 'Equipamiento', value: 'equipment', icon: 'briefcase', color: '#8B5CF6' },
        { name: 'Comunicaciones', value: 'communications', icon: 'phone', color: '#EC4899' },
        { name: 'Mantenimiento', value: 'maintenance', icon: 'wrench', color: '#6B7280' },
        { name: 'Seguros', value: 'insurance', icon: 'shield', color: '#14B8A6' },
        { name: 'Otros', value: 'other', icon: 'ellipsis', color: '#9CA3AF' }
      ];

      await prisma.expense_categories.createMany({ data: defaultCategories });

      const newCategories = await prisma.expense_categories.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' }
      });

      return res.json({
        success: true,
        data: newCategories.map(c => ({
          id: c.id,
          label: c.name,
          value: c.value,
          icon: c.icon,
          color: c.color
        }))
      });
    }

    res.json({
      success: true,
      data: categories.map(c => ({
        id: c.id,
        label: c.name,
        value: c.value,
        icon: c.icon,
        color: c.color
      }))
    });
  } catch (error) {
    console.error('Error getting expense categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// TIPOS DE INGRESO
// ============================================

const getIncomeTypes = async (req, res) => {
  try {
    const types = await prisma.income_types.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    // Si no hay tipos, crear los predeterminados
    if (types.length === 0) {
      const defaultTypes = [
        { name: 'Tour Guiado', value: 'guided_tour', icon: 'map', color: '#3B82F6' },
        { name: 'Propina', value: 'tip', icon: 'gift', color: '#10B981' },
        { name: 'Tour Privado', value: 'private_tour', icon: 'star', color: '#F59E0B' },
        { name: 'Servicio Extra', value: 'extra_service', icon: 'plus-circle', color: '#8B5CF6' },
        { name: 'Comisión', value: 'commission', icon: 'percent', color: '#EC4899' },
        { name: 'Reembolso', value: 'refund', icon: 'refresh', color: '#14B8A6' },
        { name: 'Servicio Marketplace', value: 'marketplace_freelance', icon: 'briefcase', color: '#8B5CF6', description: 'Ingreso por servicio freelance del marketplace' },
        { name: 'Otros', value: 'other', icon: 'ellipsis', color: '#9CA3AF' }
      ];

      await prisma.income_types.createMany({ data: defaultTypes });

      const newTypes = await prisma.income_types.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' }
      });

      return res.json({
        success: true,
        data: newTypes.map(t => ({
          id: t.id,
          label: t.name,
          value: t.value,
          icon: t.icon,
          color: t.color
        }))
      });
    }

    res.json({
      success: true,
      data: types.map(t => ({
        id: t.id,
        label: t.name,
        value: t.value,
        icon: t.icon,
        color: t.color
      }))
    });
  } catch (error) {
    console.error('Error getting income types:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// GASTOS (CRUD)
// ============================================

const getExpenses = async (req, res) => {
  try {
    const { guideId, category, tourId, startDate, endDate, search, page = 1, limit = 10 } = req.query;

    const where = {};

    if (guideId) where.guide_id = guideId;
    if (category && category !== 'all') {
      const cat = await prisma.expense_categories.findUnique({ where: { value: category } });
      if (cat) where.category_id = cat.id;
    }
    if (tourId) where.tour_id = tourId;
    // Usar buildDateFilter para manejar correctamente timezone
    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter) where.date = dateFilter;
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [expenses, total] = await Promise.all([
      prisma.expenses.findMany({
        where,
        include: {
          expense_categories: true,
          tours: { select: { id: true, name: true } },
          reservations: { select: { id: true } }
        },
        orderBy: { date: 'desc' },
        skip,
        take
      }),
      prisma.expenses.count({ where })
    ]);

    res.json({
      success: true,
      data: expenses.map(e => ({
        id: e.id,
        guideId: e.guide_id,
        category: e.expense_categories?.value || 'other',
        categoryName: e.expense_categories?.name || 'Otros',
        tourId: e.tour_id,
        tourName: e.tours?.name,
        reservationId: e.reservation_id,
        amount: formatPrice(e.amount),
        description: e.description,
        date: formatDateOnly(e.date),
        receiptUrl: e.receipt_url,
        notes: e.notes,
        createdAt: e.created_at,
        updatedAt: e.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting expenses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    const { guideId, category, tourId, tourName, reservationId, amount, description, date, receiptUrl, notes } = req.body;

    if (!guideId || !amount || !date) {
      return res.status(400).json({ success: false, error: 'guideId, amount y date son requeridos' });
    }

    // Validar UUIDs
    const validTourId = isValidUUID(tourId) ? tourId : null;
    const validReservationId = isValidUUID(reservationId) ? reservationId : null;

    // Si no hay tourId válido pero hay tourName, guardar en notes
    const effectiveNotes = !validTourId && tourName ? `Tour: ${tourName}${notes ? ` | ${notes}` : ''}` : notes;

    // Buscar categoría por value
    let categoryId = null;
    if (category) {
      const cat = await prisma.expense_categories.findUnique({ where: { value: category } });
      if (cat) categoryId = cat.id;
    }

    // Si no se encontró, buscar categoría genérica (acepta 'other', 'otros' o la primera disponible)
    if (!categoryId) {
      const fallbackCat = await prisma.expense_categories.findFirst({
        where: { value: { in: ['other', 'otros'] } }
      });
      if (fallbackCat) {
        categoryId = fallbackCat.id;
      } else {
        // Último recurso: usar la primera categoría existente
        const anyCat = await prisma.expense_categories.findFirst({ where: { is_active: true } });
        categoryId = anyCat?.id;
      }
    }

    if (!categoryId) {
      return res.status(400).json({ success: false, error: 'No se encontró ninguna categoría de gastos válida' });
    }

    const expense = await prisma.expenses.create({
      data: {
        guide_id: guideId,
        category_id: categoryId,
        tour_id: validTourId,
        reservation_id: validReservationId,
        amount: parseFloat(amount),
        description,
        date: parseLocalDate(date),
        receipt_url: receiptUrl,
        notes: effectiveNotes
      },
      include: { expense_categories: true, tours: { select: { id: true, name: true } } }
    });

    res.status(201).json({
      success: true,
      data: {
        id: expense.id,
        guideId: expense.guide_id,
        category: expense.expense_categories?.value || 'other',
        categoryName: expense.expense_categories?.name || 'Otros',
        tourId: expense.tour_id,
        tourName: expense.tours?.name || tourName || null,
        amount: parseFloat(expense.amount),
        description: expense.description,
        date: formatDateOnly(expense.date),
        receiptUrl: expense.receipt_url,
        notes: expense.notes,
        createdAt: expense.created_at
      }
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, tourId, tourName, reservationId, amount, description, date, receiptUrl, notes } = req.body;

    const updateData = { updated_at: new Date() };

    if (category) {
      const cat = await prisma.expense_categories.findUnique({ where: { value: category } });
      if (cat) updateData.category_id = cat.id;
    }

    // Validar UUIDs
    const validTourId = isValidUUID(tourId) ? tourId : null;
    if (tourId !== undefined) updateData.tour_id = validTourId;
    if (reservationId !== undefined) updateData.reservation_id = isValidUUID(reservationId) ? reservationId : null;

    // Si hay tourName pero no tourId válido, incluir en notes
    if (tourName && !validTourId) {
      const tourNote = `Tour: ${tourName}`;
      updateData.notes = notes ? `${tourNote} | ${notes}` : tourNote;
    } else if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (description !== undefined) updateData.description = description;
    if (date) updateData.date = parseLocalDate(date);
    if (receiptUrl !== undefined) updateData.receipt_url = receiptUrl;

    const expense = await prisma.expenses.update({
      where: { id },
      data: updateData,
      include: { expense_categories: true, tours: { select: { id: true, name: true } } }
    });

    res.json({
      success: true,
      data: {
        id: expense.id,
        guideId: expense.guide_id,
        category: expense.expense_categories?.value || 'other',
        categoryName: expense.expense_categories?.name || 'Otros',
        tourId: expense.tour_id,
        tourName: expense.tours?.name || tourName || null,
        amount: parseFloat(expense.amount),
        description: expense.description,
        date: formatDateOnly(expense.date),
        receiptUrl: expense.receipt_url,
        notes: expense.notes,
        updatedAt: expense.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.expenses.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// INGRESOS (CRUD)
// ============================================

const getIncome = async (req, res) => {
  try {
    const { guideId, type, tourId, startDate, endDate, search, page = 1, limit = 10 } = req.query;

    const where = {};

    if (guideId) where.guide_id = guideId;
    if (type && type !== 'all') {
      const incType = await prisma.income_types.findUnique({ where: { value: type } });
      if (incType) where.type_id = incType.id;
    }
    if (tourId) where.tour_id = tourId;
    // Usar buildDateFilter para manejar correctamente timezone
    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter) where.date = dateFilter;
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [income, total] = await Promise.all([
      prisma.income.findMany({
        where,
        include: {
          income_types: true,
          tours: { select: { id: true, name: true } },
          reservations: { select: { id: true } },
          service_requests: { select: { id: true, status: true } }
        },
        orderBy: { date: 'desc' },
        skip,
        take
      }),
      prisma.income.count({ where })
    ]);

    res.json({
      success: true,
      data: income.map(i => ({
        id: i.id,
        guideId: i.guide_id,
        type: i.income_types?.value || 'other',
        typeName: i.income_types?.name || 'Otros',
        tourId: i.tour_id,
        tourName: i.tours?.name || i.source || null,
        reservationId: i.reservation_id,
        serviceRequestId: i.service_request_id,
        amount: formatPrice(i.amount),
        description: i.description,
        date: formatDateOnly(i.date),
        source: i.source,
        notes: i.notes,
        createdAt: i.created_at,
        updatedAt: i.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting income:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Función para validar UUID
const isValidUUID = (str) => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Alias para compatibilidad - usar funciones centralizadas de dateUtils
const formatDateOnly = formatLocalDate;

const createIncome = async (req, res) => {
  try {
    const { guideId, type, tourId, tourName, reservationId, serviceRequestId, amount, description, date, source, notes } = req.body;

    if (!guideId || !amount || !date) {
      return res.status(400).json({ success: false, error: 'guideId, amount y date son requeridos' });
    }

    // Validar que tourId, reservationId y serviceRequestId sean UUIDs válidos o null
    const validTourId = isValidUUID(tourId) ? tourId : null;
    const validReservationId = isValidUUID(reservationId) ? reservationId : null;
    const validServiceRequestId = isValidUUID(serviceRequestId) ? serviceRequestId : null;

    // Si no hay tourId válido pero hay tourName, guardar tourName en source
    const effectiveSource = !validTourId && tourName ? tourName : source;

    // Buscar tipo por value
    let typeId = null;
    if (type) {
      const incType = await prisma.income_types.findUnique({ where: { value: type } });
      if (incType) typeId = incType.id;
    }

    // Si no se encontró, buscar tipo genérico (acepta 'other', 'otros' o el primero disponible)
    if (!typeId) {
      const fallbackType = await prisma.income_types.findFirst({
        where: { value: { in: ['other', 'otros'] } }
      });
      if (fallbackType) {
        typeId = fallbackType.id;
      } else {
        const anyType = await prisma.income_types.findFirst({ where: { is_active: true } });
        typeId = anyType?.id;
      }
    }

    const income = await prisma.income.create({
      data: {
        guide_id: guideId,
        type_id: typeId,
        tour_id: validTourId,
        reservation_id: validReservationId,
        service_request_id: validServiceRequestId,
        amount: parseFloat(amount),
        description,
        date: parseLocalDate(date),
        source: effectiveSource,
        notes
      },
      include: { income_types: true, tours: { select: { id: true, name: true } } }
    });

    res.status(201).json({
      success: true,
      data: {
        id: income.id,
        guideId: income.guide_id,
        type: income.income_types?.value || 'other',
        typeName: income.income_types?.name || 'Otros',
        tourId: income.tour_id,
        tourName: income.tours?.name || income.source || null,
        serviceRequestId: income.service_request_id,
        amount: parseFloat(income.amount),
        description: income.description,
        date: formatDateOnly(income.date),
        source: income.source,
        notes: income.notes,
        createdAt: income.created_at
      }
    });
  } catch (error) {
    console.error('Error creating income:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateIncome = async (req, res) => {
  try {
    const { id } = req.params;

    // Proteger ingresos generados por marketplace (no editables)
    const existing = await prisma.income.findUnique({ where: { id } });
    if (existing?.service_request_id) {
      return res.status(403).json({ success: false, error: 'Los ingresos generados por servicios del marketplace no pueden ser editados' });
    }

    const { type, tourId, tourName, reservationId, amount, description, date, source, notes } = req.body;

    const updateData = { updated_at: new Date() };

    if (type) {
      const incType = await prisma.income_types.findUnique({ where: { value: type } });
      if (incType) updateData.type_id = incType.id;
    }

    // Manejar tourId y tourName
    const validTourId = isValidUUID(tourId) ? tourId : null;
    if (tourId !== undefined) updateData.tour_id = validTourId;

    // Si hay tourName pero no tourId válido, guardar en source
    if (tourName && !validTourId) {
      updateData.source = tourName;
    } else if (source !== undefined) {
      updateData.source = source;
    }

    if (reservationId !== undefined) updateData.reservation_id = isValidUUID(reservationId) ? reservationId : null;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (description !== undefined) updateData.description = description;
    if (date) updateData.date = parseLocalDate(date);
    if (notes !== undefined) updateData.notes = notes;

    const income = await prisma.income.update({
      where: { id },
      data: updateData,
      include: { income_types: true, tours: { select: { id: true, name: true } } }
    });

    res.json({
      success: true,
      data: {
        id: income.id,
        guideId: income.guide_id,
        type: income.income_types?.value || 'other',
        typeName: income.income_types?.name || 'Otros',
        tourId: income.tour_id,
        tourName: income.tours?.name || income.source || null,
        amount: parseFloat(income.amount),
        description: income.description,
        date: formatDateOnly(income.date),
        source: income.source,
        notes: income.notes,
        updatedAt: income.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating income:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;

    // Proteger ingresos generados por marketplace (no eliminables)
    const existing = await prisma.income.findUnique({ where: { id } });
    if (existing?.service_request_id) {
      return res.status(403).json({ success: false, error: 'Los ingresos generados por servicios del marketplace no pueden ser eliminados' });
    }

    await prisma.income.delete({ where: { id } });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting income:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// ESTADÍSTICAS FINANCIERAS
// ============================================

const getFinancialStats = async (req, res) => {
  try {
    const { guideId, startDate, endDate } = req.query;

    if (!guideId) {
      return res.status(400).json({ success: false, error: 'guideId es requerido' });
    }

    // Usar buildDateFilter para manejar correctamente timezone
    const dateFilter = buildDateFilter(startDate, endDate);
    const hasDateFilter = dateFilter !== null;

    // Totales de gastos e ingresos
    const [expensesTotal, incomeTotal, expensesByCategory, incomeByType] = await Promise.all([
      prisma.expenses.aggregate({
        where: { guide_id: guideId, ...(hasDateFilter && { date: dateFilter }) },
        _sum: { amount: true },
        _count: true
      }),
      prisma.income.aggregate({
        where: { guide_id: guideId, ...(hasDateFilter && { date: dateFilter }) },
        _sum: { amount: true },
        _count: true
      }),
      prisma.expenses.groupBy({
        by: ['category_id'],
        where: { guide_id: guideId, ...(hasDateFilter && { date: dateFilter }) },
        _sum: { amount: true },
        _count: true
      }),
      prisma.income.groupBy({
        by: ['type_id'],
        where: { guide_id: guideId, ...(hasDateFilter && { date: dateFilter }) },
        _sum: { amount: true },
        _count: true
      })
    ]);

    // Obtener nombres de categorías y tipos
    const [categories, types] = await Promise.all([
      prisma.expense_categories.findMany(),
      prisma.income_types.findMany()
    ]);

    const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const typeMap = Object.fromEntries(types.map(t => [t.id, t]));

    const totalExpenses = formatPrice(expensesTotal._sum.amount || 0);
    const totalIncome = formatPrice(incomeTotal._sum.amount || 0);
    const netProfit = formatPrice(totalIncome - totalExpenses);
    const profitMargin = safePercentage(netProfit, totalIncome);

    res.json({
      success: true,
      data: {
        summary: {
          totalIncome,
          totalExpenses,
          netProfit,
          profitMargin,
          incomeCount: incomeTotal._count,
          expenseCount: expensesTotal._count
        },
        expensesByCategory: expensesByCategory.map(e => ({
          category: categoryMap[e.category_id]?.value || 'other',
          categoryName: categoryMap[e.category_id]?.name || 'Otros',
          color: categoryMap[e.category_id]?.color || '#9CA3AF',
          total: formatPrice(e._sum.amount || 0),
          count: e._count
        })),
        incomeByType: incomeByType.map(i => ({
          type: typeMap[i.type_id]?.value || 'other',
          typeName: typeMap[i.type_id]?.name || 'Otros',
          color: typeMap[i.type_id]?.color || '#9CA3AF',
          total: formatPrice(i._sum.amount || 0),
          count: i._count
        }))
      }
    });
  } catch (error) {
    console.error('Error getting financial stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// CALCULADORA FINANCIERA
// ============================================

const saveCalculation = async (req, res) => {
  try {
    const { guideId, tourPrice, participants, guideCommission, estimatedExpenses, grossIncome, netIncome, profitMargin, notes } = req.body;

    if (!guideId) {
      return res.status(400).json({ success: false, error: 'guideId es requerido' });
    }

    const calculation = await prisma.financial_calculations.create({
      data: {
        guide_id: guideId,
        tour_price: parseFloat(tourPrice || 0),
        participants: parseInt(participants || 1),
        guide_commission: parseFloat(guideCommission || 30),
        estimated_expenses: parseFloat(estimatedExpenses || 0),
        gross_income: parseFloat(grossIncome || 0),
        net_income: parseFloat(netIncome || 0),
        profit_margin: parseFloat(profitMargin || 0),
        notes
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: calculation.id,
        guideId: calculation.guide_id,
        tourPrice: formatPrice(calculation.tour_price),
        participants: calculation.participants,
        guideCommission: formatPercentage(calculation.guide_commission),
        estimatedExpenses: formatPrice(calculation.estimated_expenses),
        grossIncome: formatPrice(calculation.gross_income),
        netIncome: formatPrice(calculation.net_income),
        profitMargin: formatPercentage(calculation.profit_margin),
        notes: calculation.notes,
        createdAt: calculation.created_at
      }
    });
  } catch (error) {
    console.error('Error saving calculation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET - Obtener cálculos guardados
const getCalculations = async (req, res) => {
  try {
    const { guideId, page = 1, limit = 10, startDate, endDate } = req.query;

    if (!guideId) {
      return res.status(400).json({ success: false, error: 'guideId es requerido' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtro de fechas
    const whereClause = { guide_id: guideId };
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.created_at.lte = end;
      }
    }

    const [calculations, total] = await Promise.all([
      prisma.financial_calculations.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.financial_calculations.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: calculations.map(calc => ({
        id: calc.id,
        guideId: calc.guide_id,
        tourPrice: Number(calc.tour_price),
        participants: calc.participants,
        guideCommission: Number(calc.guide_commission),
        estimatedExpenses: Number(calc.estimated_expenses),
        grossIncome: Number(calc.gross_income),
        netIncome: Number(calc.net_income),
        profitMargin: Number(calc.profit_margin),
        notes: calc.notes,
        createdAt: calc.created_at
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error getting calculations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE - Eliminar cálculo
const deleteCalculation = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.financial_calculations.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Cálculo eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting calculation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// TENDENCIAS Y ANÁLISIS
// ============================================

const getProfitabilityTrends = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { months = 6 } = req.query;

    if (!guideId) {
      return res.status(400).json({ success: false, error: 'guideId es requerido' });
    }

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const [expenses, income] = await Promise.all([
      prisma.expenses.findMany({
        where: { guide_id: guideId, date: { gte: startDate } },
        select: { amount: true, date: true }
      }),
      prisma.income.findMany({
        where: { guide_id: guideId, date: { gte: startDate } },
        select: { amount: true, date: true }
      })
    ]);

    // Agrupar por mes
    const monthlyData = {};

    expenses.forEach(e => {
      const monthKey = e.date.toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expenses: 0 };
      monthlyData[monthKey].expenses += Number(e.amount);
    });

    income.forEach(i => {
      const monthKey = i.date.toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expenses: 0 };
      monthlyData[monthKey].income += Number(i.amount);
    });

    const trends = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => {
        const profit = data.income - data.expenses;
        const profitMargin = safePercentage(profit, data.income);
        return {
          period,
          income: formatPrice(data.income),
          expenses: formatPrice(data.expenses),
          profit: formatPrice(profit),
          profitMargin
        };
      });

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Error getting profitability trends:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBudgetAnalysis = async (req, res) => {
  try {
    const { guideId } = req.params;
    const { period = 'month' } = req.query;

    if (!guideId) {
      return res.status(400).json({ success: false, error: 'guideId es requerido' });
    }

    const now = new Date();
    let startDate;

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'quarter') {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const expenses = await prisma.expenses.findMany({
      where: { guide_id: guideId, date: { gte: startDate } },
      include: { expense_categories: true }
    });

    // Calcular por categoría
    const categoryTotals = {};
    let totalActual = 0;

    expenses.forEach(e => {
      const catName = e.expense_categories?.name || 'Otros';
      if (!categoryTotals[catName]) categoryTotals[catName] = { budget: 0, actual: 0, variance: 0 };
      const amount = Number(e.amount);
      categoryTotals[catName].actual += amount;
      totalActual += amount;
    });

    // Presupuesto estimado (se podría parametrizar por guía)
    const estimatedBudget = 1000; // Default

    res.json({
      success: true,
      data: {
        period,
        budget: estimatedBudget,
        actualExpenses: formatPrice(totalActual),
        variance: formatPrice(estimatedBudget - totalActual),
        variancePercent: safePercentage(estimatedBudget - totalActual, estimatedBudget),
        categoryBreakdown: categoryTotals
      }
    });
  } catch (error) {
    console.error('Error getting budget analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getExpenseCategories,
  getIncomeTypes,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
  getFinancialStats,
  saveCalculation,
  getCalculations,
  deleteCalculation,
  getProfitabilityTrends,
  getBudgetAnalysis
};
