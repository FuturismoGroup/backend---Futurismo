// Controller de Tour Photos
// Maneja subida y gestión de fotos durante tours
// Almacena archivos físicos en uploads/tours/{activeTourId}/

const prisma = require('../config/db');
const { getPhotoUrl, deletePhotoFile } = require('../middlewares/uploadTourPhoto');

/**
 * UploadTourPhoto
 * POST /api/tours/:tourId/photos
 * Sube una foto a un tour activo (con archivo físico)
 * Roles permitidos: Guide
 */
const uploadTourPhoto = async (req, res) => {
  try {
    const { tourId } = req.params;
    const { tourStopId, caption, latitude, longitude } = req.body;
    const userId = req.user?.id;

    // Validar que se subió un archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No se proporcionó ninguna foto'
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId debe ser un UUID válido'
      });
    }

    // Verificar tour existe
    const tour = await prisma.active_tours.findUnique({
      where: { id: tourId }
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour activo no encontrado'
      });
    }

    // Validar coordenadas si se proporcionan
    if (latitude !== undefined && (parseFloat(latitude) < -90 || parseFloat(latitude) > 90)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'latitude debe estar entre -90 y 90'
      });
    }

    if (longitude !== undefined && (parseFloat(longitude) < -180 || parseFloat(longitude) > 180)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'longitude debe estar entre -180 y 180'
      });
    }

    // Construir URL de la foto
    const photoUrl = getPhotoUrl(tourId, req.file.filename);

    // Guardar en base de datos
    const photo = await prisma.tour_photos.create({
      data: {
        active_tour_id: tourId,
        tour_stop_id: tourStopId && uuidRegex.test(tourStopId) ? tourStopId : null,
        photo_url: photoUrl,
        caption: caption || null,
        taken_by: userId,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null
      }
    });

    console.log(`[PHOTO] Foto subida para tour ${tourId.substring(0, 8)}: ${req.file.filename}`);

    return res.status(201).json({
      success: true,
      message: 'Foto subida correctamente',
      data: {
        id: photo.id,
        photoUrl: photo.photo_url,
        caption: photo.caption,
        stopId: photo.tour_stop_id,
        takenAt: photo.taken_at
      }
    });
  } catch (error) {
    console.error('Error en uploadTourPhoto:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al subir foto del tour'
    });
  }
};

/**
 * UploadMultipleTourPhotos
 * POST /api/tours/:tourId/photos/batch
 * Sube múltiples fotos a un tour activo
 * Roles permitidos: Guide
 */
const uploadMultipleTourPhotos = async (req, res) => {
  try {
    const { tourId } = req.params;
    const { tourStopId, captions, latitude, longitude } = req.body;
    const userId = req.user?.id;

    // Validar que se subieron archivos
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No se proporcionaron fotos'
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId debe ser un UUID válido'
      });
    }

    // Verificar tour existe
    const tour = await prisma.active_tours.findUnique({
      where: { id: tourId }
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour activo no encontrado'
      });
    }

    // Parsear captions si viene como JSON string
    let captionArray = [];
    if (captions) {
      try {
        captionArray = typeof captions === 'string' ? JSON.parse(captions) : captions;
      } catch {
        captionArray = [];
      }
    }

    // Guardar cada foto
    const uploadedPhotos = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const photoUrl = getPhotoUrl(tourId, file.filename);
      const caption = captionArray[i] || null;

      const photo = await prisma.tour_photos.create({
        data: {
          active_tour_id: tourId,
          tour_stop_id: tourStopId && uuidRegex.test(tourStopId) ? tourStopId : null,
          photo_url: photoUrl,
          caption: caption,
          taken_by: userId,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null
        }
      });

      uploadedPhotos.push({
        id: photo.id,
        photoUrl: photo.photo_url,
        caption: photo.caption,
        takenAt: photo.taken_at
      });
    }

    console.log(`[PHOTO] ${uploadedPhotos.length} fotos subidas para tour ${tourId.substring(0, 8)}`);

    return res.status(201).json({
      success: true,
      message: `${uploadedPhotos.length} foto(s) subida(s) correctamente`,
      data: uploadedPhotos
    });
  } catch (error) {
    console.error('Error en uploadMultipleTourPhotos:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al subir fotos del tour'
    });
  }
};

/**
 * GetTourPhotos
 * GET /api/tours/:tourId/photos
 * Obtiene fotos de un tour activo
 * Roles permitidos: Admin, Agency, Guide
 */
const getTourPhotos = async (req, res) => {
  try {
    const { tourId } = req.params;
    const { stopId, limit = 50, offset = 0 } = req.query;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId debe ser un UUID válido'
      });
    }

    // Verificar que el tour existe
    const tour = await prisma.active_tours.findUnique({
      where: { id: tourId }
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Tour no encontrado'
      });
    }

    // Construir filtro
    const where = { active_tour_id: tourId };
    if (stopId && uuidRegex.test(stopId)) {
      where.tour_stop_id = stopId;
    }

    const photos = await prisma.tour_photos.findMany({
      where,
      orderBy: { taken_at: 'desc' },
      skip: parseInt(offset),
      take: parseInt(limit),
      include: {
        users: {
          select: { id: true, first_name: true, last_name: true }
        },
        tour_stops: {
          select: { id: true, name: true }
        }
      }
    });

    const total = await prisma.tour_photos.count({ where });

    const data = photos.map(p => ({
      id: p.id,
      photoUrl: p.photo_url,
      thumbnailUrl: p.thumbnail_url,
      caption: p.caption,
      takenBy: p.users ? {
        id: p.users.id,
        name: `${p.users.first_name || ''} ${p.users.last_name || ''}`.trim()
      } : null,
      stopId: p.tour_stop_id,
      stopName: p.tour_stops?.name,
      location: p.latitude && p.longitude ? {
        lat: parseFloat(p.latitude),
        lng: parseFloat(p.longitude)
      } : null,
      takenAt: p.taken_at
    }));

    return res.status(200).json({
      success: true,
      data,
      total,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error en getTourPhotos:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener fotos del tour'
    });
  }
};

/**
 * DeleteTourPhoto
 * DELETE /api/tours/:tourId/photos/:photoId
 * Elimina una foto de un tour
 * Roles permitidos: Guide (propia), Admin
 */
const deleteTourPhoto = async (req, res) => {
  try {
    const { tourId, photoId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId) || !uuidRegex.test(photoId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId y photoId deben ser UUIDs válidos'
      });
    }

    // Buscar la foto
    const photo = await prisma.tour_photos.findFirst({
      where: {
        id: photoId,
        active_tour_id: tourId
      }
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Foto no encontrada'
      });
    }

    // Verificar permisos (solo el autor o admin pueden eliminar)
    if (userRole !== 'admin' && photo.taken_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'No tienes permiso para eliminar esta foto'
      });
    }

    // Extraer nombre de archivo de la URL
    const filename = photo.photo_url.split('/').pop();

    // Eliminar archivo físico
    try {
      await deletePhotoFile(tourId, filename);
    } catch (err) {
      console.error('Error eliminando archivo físico:', err);
      // Continuar con eliminación de BD aunque falle el archivo
    }

    // Eliminar de base de datos
    await prisma.tour_photos.delete({
      where: { id: photoId }
    });

    console.log(`[PHOTO] Foto ${photoId.substring(0, 8)} eliminada del tour ${tourId.substring(0, 8)}`);

    return res.status(200).json({
      success: true,
      message: 'Foto eliminada correctamente'
    });
  } catch (error) {
    console.error('Error en deleteTourPhoto:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar foto del tour'
    });
  }
};

/**
 * AddStopComment
 * POST /api/tours/:tourId/stops/:stopId/comments
 * Agrega un comentario/nota a una parada
 * Roles permitidos: Guide
 */
const addStopComment = async (req, res) => {
  try {
    const { tourId, stopId } = req.params;
    const { comment } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tourId) || !uuidRegex.test(stopId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'tourId y stopId deben ser UUIDs válidos'
      });
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El comentario es requerido'
      });
    }

    // Buscar registro de progreso existente
    let progress = await prisma.tour_progress.findFirst({
      where: {
        active_tour_id: tourId,
        tour_stop_id: stopId
      }
    });

    if (!progress) {
      // Crear registro si no existe
      progress = await prisma.tour_progress.create({
        data: {
          active_tour_id: tourId,
          tour_stop_id: stopId,
          status: 'pending',
          notes: comment.trim()
        }
      });
    } else {
      // Agregar al comentario existente
      const existingNotes = progress.notes || '';
      const newNotes = existingNotes
        ? `${existingNotes}\n---\n${comment.trim()}`
        : comment.trim();

      progress = await prisma.tour_progress.update({
        where: { id: progress.id },
        data: { notes: newNotes }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Comentario agregado',
      data: {
        stopId,
        notes: progress.notes
      }
    });
  } catch (error) {
    console.error('Error en addStopComment:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al agregar comentario'
    });
  }
};

module.exports = {
  uploadTourPhoto,
  uploadMultipleTourPhotos,
  getTourPhotos,
  deleteTourPhoto,
  addStopComment
};
