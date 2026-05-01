// Controller de Upload
// Maneja subida de archivos (imágenes, documentos)
// Usa multer para procesamiento de multipart/form-data

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configuración de tipos permitidos
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

// Límites de tamaño
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/upload/image
 * Sube una imagen
 * Roles permitidos: Todos los autenticados
 */
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No se proporcionó ningún archivo'
      });
    }

    const file = req.file;

    // Validar tipo de archivo
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      // Eliminar archivo temporal
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WEBP)'
      });
    }

    // Validar tamaño
    if (file.size > MAX_IMAGE_SIZE) {
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El archivo excede el tamaño máximo permitido (5MB)'
      });
    }

    // Devolver solo la ruta relativa - el frontend construirá la URL completa
    const relativePath = `/uploads/${file.filename}`;

    return res.status(201).json({
      success: true,
      message: 'Imagen subida exitosamente',
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: relativePath,
        path: relativePath
      }
    });
  } catch (error) {
    console.error('Error en uploadImage:', error);
    // Intentar limpiar archivo si existe
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al subir la imagen'
    });
  }
};

/**
 * POST /api/upload/document
 * Sube un documento
 * Roles permitidos: Admin, Agency
 */
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No se proporcionó ningún archivo'
      });
    }

    const file = req.file;

    // Validar tipo de archivo (imágenes + documentos)
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
    if (!allowedTypes.includes(file.mimetype)) {
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Tipo de archivo no permitido. Solo se permiten imágenes y documentos (PDF, Word, Excel)'
      });
    }

    // Validar tamaño
    if (file.size > MAX_DOCUMENT_SIZE) {
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El archivo excede el tamaño máximo permitido (10MB)'
      });
    }

    // Devolver solo la ruta relativa - el frontend construirá la URL completa
    const relativePath = `/uploads/${file.filename}`;

    return res.status(201).json({
      success: true,
      message: 'Documento subido exitosamente',
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: relativePath,
        path: relativePath
      }
    });
  } catch (error) {
    console.error('Error en uploadDocument:', error);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al subir el documento'
    });
  }
};

/**
 * POST /api/upload/multiple
 * Sube múltiples archivos
 * Roles permitidos: Admin, Agency
 */
const uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No se proporcionaron archivos'
      });
    }

    const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
    const uploadedFiles = [];
    const errors = [];

    for (const file of req.files) {
      // Validar tipo
      if (!allowedTypes.includes(file.mimetype)) {
        await fs.unlink(file.path).catch(() => {});
        errors.push({
          originalName: file.originalname,
          error: 'Tipo de archivo no permitido'
        });
        continue;
      }

      // Validar tamaño
      if (file.size > MAX_DOCUMENT_SIZE) {
        await fs.unlink(file.path).catch(() => {});
        errors.push({
          originalName: file.originalname,
          error: 'Archivo muy grande (máximo 10MB)'
        });
        continue;
      }

      const relativePath = `/uploads/${file.filename}`;
      uploadedFiles.push({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: relativePath,
        path: relativePath
      });
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
    // Limpiar archivos subidos
    if (req.files) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al subir los archivos'
    });
  }
};

/**
 * DELETE /api/upload/:filename
 * Elimina un archivo subido
 * Roles permitidos: Admin
 */
const deleteFile = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validar que el filename no intente path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Nombre de archivo inválido'
      });
    }

    const uploadDir = path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadDir, filename);

    // Verificar que el archivo existe
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Archivo no encontrado'
      });
    }

    // Eliminar archivo
    await fs.unlink(filePath);

    return res.status(200).json({
      success: true,
      message: 'Archivo eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteFile:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar el archivo'
    });
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
