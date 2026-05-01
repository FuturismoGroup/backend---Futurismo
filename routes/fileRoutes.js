// Routes de archivos almacenados en Wasabi
// Genera presigned URLs al vuelo y redirige al cliente.
// Esto permite mantener URLs estables en BD sin exponer credenciales ni
// requerir bucket público.

const express = require('express');
const router = express.Router();
const { getPresignedDownloadUrl, objectExists, PRESIGNED_URL_EXPIRES } = require('../utils/wasabiStorage');

/**
 * GET /api/files/*
 * Cualquier path después de /files/ se trata como key del bucket.
 *   ej: /api/files/tours/abc-123/photo.jpg
 *       -> presigned para "tours/abc-123/photo.jpg"
 *
 * Responde 302 con la presigned URL (válida por PRESIGNED_URL_EXPIRES segundos).
 * El navegador sigue el redirect y carga el contenido directo de Wasabi.
 *
 * Cache-Control: el cliente puede cachear el redirect un poco menos que la
 * expiración de la presigned URL para evitar URLs caducadas en cache.
 */
router.get('/*', async (req, res) => {
  try {
    const key = req.params[0];

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Falta la key del archivo'
      });
    }

    // Prevenir path traversal: rechazar ".." y backslash
    if (key.includes('..') || key.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Key inválida'
      });
    }

    const url = await getPresignedDownloadUrl(key);

    // Cachear el redirect ligeramente menos que la presigned URL
    const cacheSeconds = Math.max(60, PRESIGNED_URL_EXPIRES - 600);
    res.set('Cache-Control', `private, max-age=${cacheSeconds}`);
    return res.redirect(302, url);
  } catch (error) {
    console.error('Error sirviendo archivo:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener el archivo'
    });
  }
});

module.exports = router;
