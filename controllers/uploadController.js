// Controller de Upload — sube archivos a Wasabi
// Usa multer.memoryStorage(): los archivos llegan como Buffer en req.file.buffer

const { uploadBuffer, deleteObject, extractKeyFromUrl } = require('../utils/wasabiStorage');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;       // 5MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;   // 10MB

function monthFolder() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * POST /api/upload/image
 */
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'No se proporcionó ningún archivo' });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WEBP)' });
    }
    if (req.file.size > MAX_IMAGE_SIZE) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'El archivo excede el tamaño máximo permitido (5MB)' });
    }

    const result = await uploadBuffer({
      prefix: `images/${monthFolder()}`,
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      metadata: { uploadedBy: req.user?.id || 'anonymous' }
    });

    return res.status(201).json({
      success: true,
      message: 'Imagen subida exitosamente',
      data: {
        filename: result.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: result.size,
        key: result.key,
        url: result.url,
        path: result.url
      }
    });
  } catch (error) {
    console.error('Error en uploadImage:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al subir la imagen' });
  }
};

/**
 * POST /api/upload/document
 */
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'No se proporcionó ningún archivo' });
    }
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Tipo de archivo no permitido. Solo se permiten imágenes y documentos (PDF, Word, Excel)' });
    }
    if (req.file.size > MAX_DOCUMENT_SIZE) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'El archivo excede el tamaño máximo permitido (10MB)' });
    }

    const result = await uploadBuffer({
      prefix: `documents/${monthFolder()}`,
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      metadata: { uploadedBy: req.user?.id || 'anonymous' }
    });

    return res.status(201).json({
      success: true,
      message: 'Documento subido exitosamente',
      data: {
        filename: result.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: result.size,
        key: result.key,
        url: result.url,
        path: result.url
      }
    });
  } catch (error) {
    console.error('Error en uploadDocument:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al subir el documento' });
  }
};

/**
 * POST /api/upload/multiple
 */
const uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'No se proporcionaron archivos' });
    }
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
    const uploadedFiles = [];
    const errors = [];

    for (const file of req.files) {
      if (!allowedTypes.includes(file.mimetype)) {
        errors.push({ originalName: file.originalname, error: 'Tipo de archivo no permitido' });
        continue;
      }
      if (file.size > MAX_DOCUMENT_SIZE) {
        errors.push({ originalName: file.originalname, error: 'Archivo muy grande (máximo 10MB)' });
        continue;
      }

      try {
        const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
        const result = await uploadBuffer({
          prefix: `${isImage ? 'images' : 'documents'}/${monthFolder()}`,
          buffer: file.buffer,
          originalName: file.originalname,
          contentType: file.mimetype,
          metadata: { uploadedBy: req.user?.id || 'anonymous' }
        });
        uploadedFiles.push({
          filename: result.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: result.size,
          key: result.key,
          url: result.url,
          path: result.url
        });
      } catch (e) {
        errors.push({ originalName: file.originalname, error: 'Error al subir a Wasabi' });
      }
    }

    return res.status(201).json({
      success: true,
      message: `${uploadedFiles.length} archivo(s) subido(s) exitosamente`,
      data: {
        files: uploadedFiles,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error en uploadMultiple:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al subir los archivos' });
  }
};

/**
 * DELETE /api/upload/:key(*)
 * El parámetro key viene url-encoded.
 */
const deleteFile = async (req, res) => {
  try {
    const rawKey = req.params.key || req.params[0];
    if (!rawKey) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Key requerida' });
    }
    const key = extractKeyFromUrl(rawKey) || rawKey;
    if (key.includes('..') || key.includes('\\')) {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Key inválida' });
    }
    await deleteObject(key);
    return res.status(200).json({ success: true, message: 'Archivo eliminado exitosamente' });
  } catch (error) {
    console.error('Error en deleteFile:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al eliminar el archivo' });
  }
};

module.exports = {
  uploadImage,
  uploadDocument,
  uploadMultiple,
  deleteFile,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  MAX_IMAGE_SIZE,
  MAX_DOCUMENT_SIZE
};
