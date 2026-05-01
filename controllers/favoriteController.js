// Controller de Favorites
// Gestión de guías favoritos para marketplace
// Tabla: user_favorites

const prisma = require('../config/db');

/**
 * GET /api/marketplace/favorites
 * Lista los guías favoritos del usuario actual
 * Roles: Admin, Agency
 */
const listFavorites = async (req, res) => {
  try {
    const userId = req.user?.id;

    const favorites = await prisma.user_favorites.findMany({
      where: { user_id: userId },
      include: {
        guides: {
          include: {
            users: {
              select: { id: true, first_name: true, last_name: true, email: true }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const items = favorites.map(f => ({
      id: f.id,
      guideId: f.guide_id,
      guide: f.guides ? {
        id: f.guides.id,
        userId: f.guides.user_id,
        name: f.guides.users ? `${f.guides.users.first_name || ''} ${f.guides.users.last_name || ''}`.trim() : null,
        email: f.guides.users?.email,
        rating: f.guides.rating ? parseFloat(f.guides.rating) : null,
        reviewCount: f.guides.review_count
      } : null,
      createdAt: f.created_at
    }));

    return res.status(200).json({
      success: true,
      data: items,
      total: items.length
    });
  } catch (error) {
    console.error('Error en listFavorites:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar favoritos'
    });
  }
};

/**
 * POST /api/marketplace/favorites/:guideId
 * Añade un guía a favoritos
 * Roles: Admin, Agency
 */
const addFavorite = async (req, res) => {
  try {
    const { guideId } = req.params;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    const guide = await prisma.guides.findUnique({
      where: { id: guideId }
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Verificar si ya es favorito
    const existing = await prisma.user_favorites.findFirst({
      where: {
        user_id: userId,
        guide_id: guideId
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Este guía ya está en favoritos'
      });
    }

    const favorite = await prisma.user_favorites.create({
      data: {
        user_id: userId,
        guide_id: guideId
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Guía añadido a favoritos',
      data: {
        id: favorite.id,
        guideId: favorite.guide_id
      }
    });
  } catch (error) {
    console.error('Error en addFavorite:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al añadir favorito'
    });
  }
};

/**
 * DELETE /api/marketplace/favorites/:guideId
 * Elimina un guía de favoritos
 * Roles: Admin, Agency
 */
const removeFavorite = async (req, res) => {
  try {
    const { guideId } = req.params;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Buscar el favorito
    const existing = await prisma.user_favorites.findFirst({
      where: {
        user_id: userId,
        guide_id: guideId
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Favorito no encontrado'
      });
    }

    await prisma.user_favorites.delete({
      where: { id: existing.id }
    });

    return res.status(200).json({
      success: true,
      message: 'Guía eliminado de favoritos'
    });
  } catch (error) {
    console.error('Error en removeFavorite:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar favorito'
    });
  }
};

/**
 * POST /api/marketplace/favorites/:guideId/toggle
 * Toggle favorito (añade si no existe, elimina si existe)
 * Roles: Admin, Agency
 */
const toggleFavorite = async (req, res) => {
  try {
    const { guideId } = req.params;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    // Verificar que el guía existe
    const guide = await prisma.guides.findUnique({
      where: { id: guideId }
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Guía no encontrado'
      });
    }

    // Buscar si ya es favorito
    const existing = await prisma.user_favorites.findFirst({
      where: {
        user_id: userId,
        guide_id: guideId
      }
    });

    if (existing) {
      // Eliminar favorito
      await prisma.user_favorites.delete({
        where: { id: existing.id }
      });

      return res.status(200).json({
        success: true,
        message: 'Guía eliminado de favoritos',
        data: {
          isFavorite: false,
          guideId
        }
      });
    } else {
      // Añadir favorito
      const favorite = await prisma.user_favorites.create({
        data: {
          user_id: userId,
          guide_id: guideId
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Guía añadido a favoritos',
        data: {
          isFavorite: true,
          guideId,
          favoriteId: favorite.id
        }
      });
    }
  } catch (error) {
    console.error('Error en toggleFavorite:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al toggle favorito'
    });
  }
};

/**
 * GET /api/marketplace/favorites/check/:guideId
 * Verifica si un guía es favorito
 * Roles: Admin, Agency
 */
const checkFavorite = async (req, res) => {
  try {
    const { guideId } = req.params;
    const userId = req.user?.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(guideId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'guideId debe ser un UUID válido'
      });
    }

    const existing = await prisma.user_favorites.findFirst({
      where: {
        user_id: userId,
        guide_id: guideId
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        isFavorite: !!existing,
        guideId
      }
    });
  } catch (error) {
    console.error('Error en checkFavorite:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al verificar favorito'
    });
  }
};

module.exports = {
  listFavorites,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  checkFavorite
};
