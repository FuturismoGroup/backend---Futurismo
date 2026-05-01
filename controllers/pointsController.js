// Controller de Points y Rewards
// Fuente: 04_apis_lista.md líneas 3010-3678
// API-041 a API-050: Points y Rewards

const prisma = require('../config/db');

// Niveles por defecto (fallback si no hay config en BD)
const DEFAULT_LEVELS = [
  { name: 'Bronze', minPoints: 0 },
  { name: 'Silver', minPoints: 1000 },
  { name: 'Gold', minPoints: 5000 },
  { name: 'Platinum', minPoints: 20000 }
];

/**
 * Lee la configuración de puntos desde tabla points_config.
 * Fuente única de verdad para points_per_sol, levels, expiration, etc.
 * @param {Object} tx - Prisma client o transaction
 */
const getPointsConfigFromDB = async (tx = prisma) => {
  const config = await tx.points_config.findFirst();
  return {
    pointsPerSol: config?.points_per_sol ?? 1,
    expirationMonths: config?.expiration_months ?? 12,
    levels: (Array.isArray(config?.levels) && config.levels.length === 4)
      ? config.levels
      : DEFAULT_LEVELS
  };
};

/**
 * Recalcula el nivel de una agencia basándose en total_points y los niveles configurados.
 * @param {Object} tx - Prisma transaction
 * @param {string} agencyId
 * @param {number} totalPoints
 * @param {Array} levels - Niveles ordenados por minPoints ascendente
 * @returns {string} nuevo nivel (lowercase)
 */
const recalculateAgencyLevel = async (tx, agencyId, totalPoints, levels) => {
  // Determinar nivel: recorrer de mayor a menor para encontrar el más alto que aplique
  const sorted = [...levels].sort((a, b) => b.minPoints - a.minPoints);
  let newLevel = sorted[sorted.length - 1].name.toLowerCase(); // fallback al menor
  for (const level of sorted) {
    if (totalPoints >= level.minPoints) {
      newLevel = level.name.toLowerCase();
      break;
    }
  }

  await tx.agencies.update({
    where: { id: agencyId },
    data: { level: newLevel }
  });

  return newLevel;
};

/**
 * API-041: GetAgencyPoints
 * GET /api/agencies/:id/points
 * Línea 04_apis_lista: 3010
 */
const getAgencyPoints = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de agencia inválido' });
    }

    // Verificar acceso
    if (req.user.role === 'agency' && req.user.agencyId !== id) {
      return res.status(403).json({ error: 'No autorizado para ver estos puntos' });
    }

    // Prisma usa 'agencies' (plural) segun schema.prisma
    const agency = await prisma.agencies.findUnique({
      where: { id }
    });

    if (!agency) {
      return res.status(404).json({ success: false, error: 'Agencia no encontrada' });
    }

    // Schema Prisma (agencies): available_points, total_points, level
    // total_points = puntos ganados historicos
    // available_points = puntos disponibles para canjear
    // La diferencia son los puntos canjeados
    const availablePoints = agency.available_points || 0;
    const totalPoints = agency.total_points || 0;
    const totalRedeemed = Math.max(0, totalPoints - availablePoints);

    // Leer niveles desde BD
    const config = await getPointsConfigFromDB();
    const levels = config.levels;
    const sortedLevels = [...levels].sort((a, b) => a.minPoints - b.minPoints);

    const currentLevel = (agency.level || 'bronze').toUpperCase();
    let pointsToNextLevel = 0;
    let levelProgress = 0;

    // Encontrar el índice del nivel actual
    const currentIdx = sortedLevels.findIndex(
      l => l.name.toUpperCase() === currentLevel
    );
    const isMaxLevel = currentIdx === sortedLevels.length - 1;

    if (isMaxLevel || currentIdx === -1) {
      pointsToNextLevel = 0;
      levelProgress = 100;
    } else {
      const currentMin = sortedLevels[currentIdx].minPoints;
      const nextMin = sortedLevels[currentIdx + 1].minPoints;
      pointsToNextLevel = nextMin - totalPoints;
      const range = nextMin - currentMin;
      levelProgress = range > 0 ? ((totalPoints - currentMin) / range) * 100 : 0;
    }

    res.json({
      success: true,
      data: {
        agencyId: agency.id,
        availablePoints: availablePoints,
        balance: availablePoints,
        totalPointsEarned: totalPoints,
        totalEarned: totalPoints,
        totalPointsRedeemed: totalRedeemed,
        totalRedeemed: totalRedeemed,
        currentLevel,
        tier: currentLevel,
        pointsToNextLevel: Math.max(0, pointsToNextLevel),
        levelProgress: Math.min(100, Math.max(0, levelProgress)),
        levels: sortedLevels
      }
    });
  } catch (error) {
    console.error('Error en getAgencyPoints:', error);
    res.status(500).json({ success: false, error: 'Error al obtener puntos de agencia' });
  }
};

/**
 * API-042: GetPointsTransactions
 * GET /api/agencies/:id/points/transactions
 * Linea 04_apis_lista: 3073
 * Tabla: points_history (TBL-012)
 * Elementos: ELM-445 Seccion historial transacciones, ELM-446 Transaction card
 */
const getPointsTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      pageSize = 20,
      type,
      dateFrom,
      dateTo
    } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de agencia invalido' });
    }

    // Verificar acceso
    if (req.user.role === 'agency' && req.user.agencyId !== id) {
      return res.status(403).json({ success: false, error: 'No autorizado para ver estas transacciones' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    // Construir filtros - TBL-012 points_history
    const where = { agency_id: id };

    if (type) {
      // Frontend usa 'earned'/'redeemed', BD puede usar 'awarded'/'redeemed'
      // Aceptar ambos para compatibilidad
      if (type === 'earned') {
        where.type = { in: ['earned', 'awarded'] };
      } else {
        where.type = type;
      }
    }

    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at.gte = new Date(dateFrom);
      if (dateTo) where.created_at.lte = new Date(dateTo);
    }

    // Usar points_history (nombre real del modelo Prisma segun schema.prisma linea 513)
    const [transactionsRaw, total] = await Promise.all([
      prisma.points_history.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          agencies: {
            select: { id: true, business_name: true }
          },
          users: {
            select: { id: true, username: true }
          }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.points_history.count({ where })
    ]);

    // Mapear a formato esperado por frontend (ELM-445, ELM-446 AgencyPoints.jsx)
    const transactions = transactionsRaw.map(t => ({
      id: t.id,
      type: (t.type === 'awarded') ? 'earned' : t.type, // Normalizar a 'earned'/'redeemed' para frontend
      points: Math.abs(t.amount), // amount puede ser negativo para redeemed
      description: t.description,
      reason: t.description, // Alias para compatibilidad con exportHistory
      reservationId: t.reference_type === 'reservation' ? t.reference_id : null,
      referenceId: t.reference_id,
      referenceType: t.reference_type,
      createdAt: t.created_at,
      processedBy: t.created_by ? 'manual' : 'system',
      relatedReservation: t.reference_type === 'reservation' ? t.reference_id : null,
      // Campos adicionales para ELM-446 Transaction card serviceDetails
      serviceDetails: (t.type === 'awarded' || t.type === 'earned') ? {
        serviceName: t.description,
        date: t.created_at,
        reservationCode: t.reference_id ? t.reference_id.substring(0, 8).toUpperCase() : null,
        participants: null, // Se podria obtener de reservations si es necesario
        amount: null,
        status: 'confirmed'
      } : null
    }));

    const totalPages = Math.ceil(total / pageSizeNum);

    res.json({
      success: true,
      data: {
        transactions, // Frontend espera 'transactions'
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error en getPointsTransactions:', error);
    res.status(500).json({ success: false, error: 'Error al obtener transacciones de puntos' });
  }
};

/**
 * API-043: ListRewards
 * GET /api/rewards
 * Linea 04_apis_lista: 3165
 * Tabla: rewards (TBL-010)
 */
const listRewards = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      category,
      available = 'true'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    // Construir filtros - usar campos reales del schema Prisma (TBL-010)
    const where = {};

    if (available === 'true') {
      where.active = true; // Schema usa 'active' no 'available'
    }

    if (category) {
      where.category_id = category; // Schema usa 'category_id' no 'category'
    }

    const [rewards, total] = await Promise.all([
      prisma.rewards.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          reward_categories: {
            select: { id: true, name: true }
          }
        },
        orderBy: { points: 'asc' } // Schema usa 'points' no 'points_cost'
      }),
      prisma.rewards.count({ where })
    ]);

    const data = rewards.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      pointsCost: r.points, // Mapear points a pointsCost para frontend
      points: r.points,
      category: r.category_id,
      categoryName: r.reward_categories?.name || null,
      imageUrl: r.image,  // Schema usa 'image' no 'image_url'
      image: r.image,
      stock: r.stock,
      available: r.active, // Mapear active a available para frontend
      active: r.active
    }));

    res.json({
      success: true,
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error) {
    console.error('Error en listRewards:', error);
    res.status(500).json({ success: false, error: 'Error al obtener premios' });
  }
};

/**
 * API-044: GetReward
 * GET /api/rewards/:id
 * Linea 04_apis_lista: 3249
 * Tabla: rewards (TBL-010)
 */
const getReward = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de premio invalido' });
    }

    const reward = await prisma.rewards.findUnique({
      where: { id },
      include: {
        reward_categories: {
          select: { id: true, name: true }
        }
      }
    });

    if (!reward) {
      return res.status(404).json({ success: false, error: 'Premio no encontrado' });
    }

    res.json({
      success: true,
      data: {
        id: reward.id,
        name: reward.name,
        description: reward.description,
        pointsCost: reward.points,
        points: reward.points,
        category: reward.category_id,
        categoryName: reward.reward_categories?.name || null,
        imageUrl: reward.image,
        image: reward.image,
        stock: reward.stock,
        available: reward.active,
        active: reward.active,
        createdAt: reward.created_at
      }
    });
  } catch (error) {
    console.error('Error en getReward:', error);
    res.status(500).json({ success: false, error: 'Error al obtener premio' });
  }
};

/**
 * API-045: RedeemReward
 * POST /api/agencies/:agencyId/points/redeem
 * Línea 04_apis_lista: 3312
 */
const redeemReward = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { rewardId, quantity = 1, notes } = req.body;

    // Validar UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(agencyId)) {
      return res.status(400).json({ error: 'ID de agencia inválido' });
    }
    if (!rewardId || !uuidRegex.test(rewardId)) {
      return res.status(400).json({ error: 'ID de premio requerido y válido' });
    }

    // Verificar acceso
    if (req.user.role === 'agency' && req.user.agencyId !== agencyId) {
      return res.status(403).json({ error: 'No autorizado para canjear en esta agencia' });
    }

    const qty = Math.max(1, parseInt(quantity));

    // Obtener agencia y reward (tablas: agencies TBL-003, rewards TBL-010)
    const [agency, reward] = await Promise.all([
      prisma.agencies.findUnique({ where: { id: agencyId } }),
      prisma.rewards.findUnique({ where: { id: rewardId } })
    ]);

    if (!agency) {
      return res.status(404).json({ error: 'Agencia no encontrada' });
    }
    if (!reward) {
      return res.status(404).json({ error: 'Premio no encontrado' });
    }
    if (!reward.active) { // Schema usa 'active' no 'available'
      return res.status(409).json({ error: 'Premio no disponible' });
    }

    // Verificar puntos suficientes
    const totalCost = reward.points * qty;
    if (agency.available_points < totalCost) {
      return res.status(409).json({ error: 'Puntos insuficientes' });
    }

    // Verificar stock
    if (reward.stock !== null && reward.stock < qty) {
      return res.status(409).json({ error: 'Stock insuficiente' });
    }

    // Transaccion atomica
    const result = await prisma.$transaction(async (tx) => {
      // Descontar puntos de agencia (tabla: agencies segun schema.prisma)
      // NOTA: Solo decrementar available_points, NO total_points
      // total_points es el historial acumulado (determina el nivel de la agencia)
      // available_points son los puntos disponibles para canjear
      const updatedAgency = await tx.agencies.update({
        where: { id: agencyId },
        data: {
          available_points: { decrement: totalCost }
          // NO decrementar total_points - es el acumulado histórico para calcular nivel
        }
      });

      // Decrementar stock si aplica (tabla: rewards segun schema.prisma)
      if (reward.stock !== null) {
        await tx.rewards.update({
          where: { id: rewardId },
          data: { stock: { decrement: qty } }
        });
      }

      // Crear transaccion de puntos (tabla: points_history segun schema.prisma TBL-012)
      await tx.points_history.create({
        data: {
          agency_id: agencyId,
          type: 'redeemed',
          amount: -totalCost, // Negativo para canjes
          description: `Canje: ${reward.name} x${qty}`,
          reference_type: 'redemption',
          reference_id: null // Se actualizara despues de crear redemption
        }
      });

      // Crear registro de canje (tabla: redemptions segun schema.prisma TBL-011)
      // Nota: schema no tiene campos 'quantity' ni 'notes', solo los campos basicos
      const redemption = await tx.redemptions.create({
        data: {
          agency_id: agencyId,
          reward_id: rewardId,
          points_used: totalCost,
          status: 'pending'
        }
      });

      return { redemption, newBalance: updatedAgency.available_points };
    });

    res.status(201).json({
      redemptionId: result.redemption.id,
      rewardName: reward.name,
      pointsDeducted: totalCost,
      newBalance: result.newBalance,
      status: 'pending',
      createdAt: result.redemption.created_at
    });
  } catch (error) {
    console.error('Error en redeemReward:', error);
    res.status(500).json({ error: 'Error al canjear premio' });
  }
};

/**
 * API-046: GetRedemptions
 * GET /api/agencies/:id/redemptions
 * Línea 04_apis_lista: 3385
 */
const getRedemptions = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      pageSize = 20,
      status
    } = req.query;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de agencia inválido' });
    }

    // Verificar acceso
    if (req.user.role === 'agency' && req.user.agencyId !== id) {
      return res.status(403).json({ error: 'No autorizado para ver estos canjes' });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    const where = { agency_id: id };
    if (status) {
      where.status = status;
    }

    const [redemptions, total] = await Promise.all([
      prisma.redemptions.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          rewards: {
            select: { id: true, name: true, image: true }
          }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.redemptions.count({ where })
    ]);

    const data = redemptions.map(r => ({
      id: r.id,
      reward: {
        id: r.rewards.id,
        name: r.rewards.name,
        imageUrl: r.rewards.image
      },
      pointsUsed: r.points_used,
      quantity: 1, // Campo no existe en schema, default 1
      status: r.status,
      requestedAt: r.created_at,
      deliveredAt: r.delivered_at
    }));

    res.json({
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error) {
    console.error('Error en getRedemptions:', error);
    res.status(500).json({ error: 'Error al obtener canjes' });
  }
};

/**
 * API-047: CreateReward
 * POST /api/rewards
 * Linea 04_apis_lista: 3459
 * Tabla: rewards (TBL-010)
 * Elemento: ELM-412 Formulario de Premio
 * Soporta upload de imagen via multipart/form-data
 */
const createReward = async (req, res) => {
  try {
    const {
      name,
      description,
      pointsCost,
      points,  // Frontend puede enviar 'points' o 'pointsCost'
      category,
      imageUrl,
      image,   // Frontend puede enviar 'image' o 'imageUrl'
      stock,
      available,
      active   // Frontend puede enviar 'active' o 'available'
    } = req.body;

    // Resolver campos (el frontend puede enviar diferentes nombres)
    const finalPoints = pointsCost || points;

    // Si hay archivo subido, persistirlo en Wasabi; sino usar URL proporcionada
    let finalImage = null;
    if (req.file) {
      const { uploadRewardImageToStorage } = require('../middlewares/uploadReward');
      const uploaded = await uploadRewardImageToStorage(req.file);
      finalImage = uploaded.url;
    } else {
      finalImage = imageUrl || image || null;
    }

    // Convertir a boolean (FormData envía strings)
    const parseBoolean = (val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return true; // default
    };
    const finalActive = available !== undefined ? parseBoolean(available) : (active !== undefined ? parseBoolean(active) : true);

    // Validaciones
    if (!name) {
      return res.status(400).json({ success: false, error: 'El nombre es requerido' });
    }

    if (!finalPoints || finalPoints < 100) {
      return res.status(400).json({ success: false, error: 'Los puntos deben ser al menos 100' });
    }

    if (!stock || stock < 1) {
      return res.status(400).json({ success: false, error: 'El stock debe ser al menos 1' });
    }

    // Validar que la categoria existe si se proporciona
    if (category) {
      const categoryExists = await prisma.reward_categories.findUnique({
        where: { id: category }
      });
      if (!categoryExists) {
        return res.status(400).json({ success: false, error: 'La categoria no existe' });
      }
    }

    const reward = await prisma.rewards.create({
      data: {
        name: name.trim(),
        description: description || null,
        points: parseInt(finalPoints),
        category_id: category || null,
        image: finalImage,
        stock: parseInt(stock),
        active: finalActive
      },
      include: {
        reward_categories: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Premio creado correctamente',
      data: {
        id: reward.id,
        name: reward.name,
        description: reward.description,
        pointsCost: reward.points,
        points: reward.points,
        category: reward.category_id,
        categoryName: reward.reward_categories?.name || null,
        imageUrl: reward.image,
        image: reward.image,
        stock: reward.stock,
        available: reward.active,
        active: reward.active,
        createdAt: reward.created_at
      }
    });
  } catch (error) {
    console.error('Error en createReward:', error);
    res.status(500).json({ success: false, error: 'Error al crear premio' });
  }
};

/**
 * API-048: UpdateReward
 * PUT /api/rewards/:id
 * Linea 04_apis_lista: 3517
 * Tabla: rewards (TBL-010)
 * Elemento: ELM-412 Formulario de Premio
 * Soporta upload de imagen via multipart/form-data
 */
const updateReward = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      pointsCost,
      points,
      category,
      imageUrl,
      image,
      stock,
      available,
      active
    } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de premio invalido' });
    }

    const existingReward = await prisma.rewards.findUnique({ where: { id } });
    if (!existingReward) {
      return res.status(404).json({ success: false, error: 'Premio no encontrado' });
    }

    // Resolver campos
    const finalPoints = pointsCost || points;

    // Si hay archivo subido, persistirlo en Wasabi; sino mantener existente o usar URL
    let finalImage;
    if (req.file) {
      const { uploadRewardImageToStorage } = require('../middlewares/uploadReward');
      const uploaded = await uploadRewardImageToStorage(req.file);
      finalImage = uploaded.url;
    } else if (imageUrl !== undefined) {
      finalImage = imageUrl;
    } else if (image !== undefined) {
      finalImage = image;
    } else {
      finalImage = undefined; // No actualizar si no se proporciona
    }

    // Convertir a boolean (FormData envía strings)
    const parseBoolean = (val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return undefined;
    };
    const finalActive = available !== undefined ? parseBoolean(available) : (active !== undefined ? parseBoolean(active) : undefined);

    if (finalPoints !== undefined && finalPoints < 100) {
      return res.status(400).json({ success: false, error: 'Los puntos deben ser al menos 100' });
    }

    // Validar categoria si se proporciona
    if (category) {
      const categoryExists = await prisma.reward_categories.findUnique({
        where: { id: category }
      });
      if (!categoryExists) {
        return res.status(400).json({ success: false, error: 'La categoria no existe' });
      }
    }

    const updateData = { updated_at: new Date() };
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (finalPoints !== undefined) updateData.points = parseInt(finalPoints);
    if (category !== undefined) updateData.category_id = category || null;
    if (finalImage !== undefined) updateData.image = finalImage;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (finalActive !== undefined) updateData.active = finalActive;

    const reward = await prisma.rewards.update({
      where: { id },
      data: updateData,
      include: {
        reward_categories: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Premio actualizado correctamente',
      data: {
        id: reward.id,
        name: reward.name,
        description: reward.description,
        pointsCost: reward.points,
        points: reward.points,
        category: reward.category_id,
        categoryName: reward.reward_categories?.name || null,
        imageUrl: reward.image,
        image: reward.image,
        stock: reward.stock,
        available: reward.active,
        active: reward.active,
        updatedAt: reward.updated_at
      }
    });
  } catch (error) {
    console.error('Error en updateReward:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar premio' });
  }
};

/**
 * API-049: DeleteReward
 * DELETE /api/rewards/:id
 * Linea 04_apis_lista: 3578
 * Tabla: rewards (TBL-010)
 * Elemento: ELM-412 Formulario de Premio
 */
const deleteReward = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de premio invalido' });
    }

    const reward = await prisma.rewards.findUnique({
      where: { id },
      include: {
        redemptions: {
          where: { status: 'pending' }
        }
      }
    });

    if (!reward) {
      return res.status(404).json({ success: false, error: 'Premio no encontrado' });
    }

    // No eliminar si tiene canjes pendientes
    if (reward.redemptions.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'No se puede eliminar premio con canjes pendientes'
      });
    }

    // Soft delete: marcar como inactivo (schema usa 'active' no 'available')
    await prisma.rewards.update({
      where: { id },
      data: { active: false }
    });

    res.json({
      success: true,
      message: 'Premio eliminado correctamente'
    });
  } catch (error) {
    console.error('Error en deleteReward:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar premio' });
  }
};

/**
 * API-050: GetPointsConfig
 * GET /api/config/points
 * Linea 04_apis_lista: 3630
 * Tabla: points_config (fuente unica de verdad)
 */
const getPointsConfig = async (req, res) => {
  try {
    const config = await getPointsConfigFromDB();

    res.json({
      pointsPerSol: config.pointsPerSol,
      levels: config.levels,
      expirationMonths: config.expirationMonths
    });
  } catch (error) {
    console.error('Error en getPointsConfig:', error);
    res.status(500).json({ error: 'Error al obtener configuracion de puntos' });
  }
};

/**
 * ELM-414: Modal Asignar Puntos (RewardsManagement)
 * FLW-021, FLW-125: Gestionar sistema de premios - Asignar puntos manualmente
 * POST /api/agencies/:id/points
 *
 * Permite al admin asignar puntos manualmente a una agencia.
 * Registra la transaccion en points_history y actualiza available_points/total_points de la agencia.
 *
 * Tablas: agencies (TBL-003), points_history
 */
const addPointsToAgency = async (req, res) => {
  try {
    const { id } = req.params;
    const { points, reason } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de agencia invalido' });
    }

    // Validar campos requeridos
    if (!points || points <= 0) {
      return res.status(400).json({ success: false, error: 'Los puntos deben ser mayores a 0' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'El motivo es requerido' });
    }

    const pointsAmount = parseInt(points);

    // Verificar que la agencia existe
    const agency = await prisma.agencies.findUnique({
      where: { id }
    });

    if (!agency) {
      return res.status(404).json({ success: false, error: 'Agencia no encontrada' });
    }

    // Transaccion atomica: actualizar agencia y crear registro en points_history
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar puntos de la agencia
      const updatedAgency = await tx.agencies.update({
        where: { id },
        data: {
          available_points: { increment: pointsAmount },
          total_points: { increment: pointsAmount },
          updated_at: new Date()
        }
      });

      // Registrar en historial de puntos (tabla points_history)
      const pointsRecord = await tx.points_history.create({
        data: {
          agency_id: id,
          type: 'awarded',
          amount: pointsAmount,
          description: reason.trim(),
          reference_type: 'manual_assignment',
          reference_id: null,
          created_by: req.user.id
        }
      });

      return { agency: updatedAgency, record: pointsRecord };
    });

    // Recalcular nivel basado en puntos totales y config de BD
    const config = await getPointsConfigFromDB();
    const newLevel = await recalculateAgencyLevel(
      prisma, id, result.agency.total_points, config.levels
    );

    res.status(201).json({
      success: true,
      data: {
        agencyId: id,
        pointsAdded: pointsAmount,
        newAvailablePoints: result.agency.available_points,
        newTotalPoints: result.agency.total_points,
        newLevel: newLevel,
        reason: reason.trim(),
        transactionId: result.record.id,
        createdAt: result.record.created_at
      },
      message: `${pointsAmount} puntos asignados exitosamente`
    });
  } catch (error) {
    console.error('Error en addPointsToAgency:', error);
    res.status(500).json({
      success: false,
      error: 'Error al asignar puntos',
      details: error.message
    });
  }
};

/**
 * GET /api/rewards/redemptions (Admin only)
 * Lista todos los canjes del sistema para panel admin
 * ELM-411 RewardsManagement - Tab Canjes
 * Tabla: redemptions (TBL-011)
 */
const listAllRedemptions = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 50,
      status
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize)));
    const skip = (pageNum - 1) * pageSizeNum;

    const where = {};
    if (status) {
      where.status = status;
    }

    const [redemptions, total] = await Promise.all([
      prisma.redemptions.findMany({
        where,
        skip,
        take: pageSizeNum,
        include: {
          rewards: {
            select: { id: true, name: true, image: true, points: true }
          },
          agencies: {
            select: { id: true, business_name: true }
          }
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.redemptions.count({ where })
    ]);

    const data = redemptions.map(r => ({
      id: r.id,
      agencyId: r.agency_id,
      agencyName: r.agencies?.business_name || 'Agencia desconocida',
      rewardId: r.reward_id,
      rewardName: r.rewards?.name || 'Premio desconocido',
      points: r.points_used,
      status: r.status,
      requestDate: r.created_at,
      approvedAt: r.approved_at,
      deliveredAt: r.delivered_at
    }));

    res.json({
      success: true,
      data,
      total,
      page: pageNum,
      pageSize: pageSizeNum
    });
  } catch (error) {
    console.error('Error en listAllRedemptions:', error);
    res.status(500).json({ success: false, error: 'Error al obtener canjes' });
  }
};

/**
 * PATCH /api/rewards/redemptions/:id
 * Actualiza el estado de un canje (Admin only)
 * ELM-411 RewardsManagement - Aprobar/Rechazar/Entregar canjes
 * Tabla: redemptions (TBL-011)
 */
const updateRedemptionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, error: 'ID de canje invalido' });
    }

    // Validar status
    const validStatuses = ['pending', 'approved', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado invalido. Debe ser: pending, approved, delivered, cancelled' });
    }

    const existingRedemption = await prisma.redemptions.findUnique({
      where: { id },
      include: {
        agencies: true,
        rewards: true
      }
    });

    if (!existingRedemption) {
      return res.status(404).json({ success: false, error: 'Canje no encontrado' });
    }

    const updateData = { status };

    // Agregar timestamps segun el nuevo estado
    if (status === 'approved') {
      updateData.approved_by = req.user.id;
      updateData.approved_at = new Date();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date();
    } else if (status === 'cancelled' && existingRedemption.status !== 'delivered') {
      // Devolver puntos a la agencia si se cancela
      await prisma.agencies.update({
        where: { id: existingRedemption.agency_id },
        data: {
          available_points: { increment: existingRedemption.points_used },
          total_points: { increment: existingRedemption.points_used }
        }
      });
      // Devolver stock al premio
      await prisma.rewards.update({
        where: { id: existingRedemption.reward_id },
        data: { stock: { increment: 1 } }
      });
    }

    const updatedRedemption = await prisma.redemptions.update({
      where: { id },
      data: updateData,
      include: {
        rewards: { select: { name: true } },
        agencies: { select: { business_name: true } }
      }
    });

    res.json({
      success: true,
      message: `Canje ${status === 'approved' ? 'aprobado' : status === 'delivered' ? 'entregado' : status === 'cancelled' ? 'cancelado' : 'actualizado'}`,
      data: {
        id: updatedRedemption.id,
        status: updatedRedemption.status,
        approvedAt: updatedRedemption.approved_at,
        deliveredAt: updatedRedemption.delivered_at
      }
    });
  } catch (error) {
    console.error('Error en updateRedemptionStatus:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar canje' });
  }
};

module.exports = {
  getAgencyPoints,
  getPointsTransactions,
  listRewards,
  getReward,
  redeemReward,
  getRedemptions,
  createReward,
  updateReward,
  deleteReward,
  getPointsConfig,
  addPointsToAgency,
  listAllRedemptions,
  updateRedemptionStatus,
  // Helpers exportados para uso en reservationController
  getPointsConfigFromDB,
  recalculateAgencyLevel
};
