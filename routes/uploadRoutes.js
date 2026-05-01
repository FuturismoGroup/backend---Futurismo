// Routes de Upload
// Maneja subida de archivos con multer

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const uploadController = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middlewares/auth');

// Asegurar que el directorio de uploads existe
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: timestamp-random-extension
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${timestamp}-${randomBytes}${ext}`);
  }
});

// Filtro de archivos
const imageFilter = (req, file, cb) => {
  const allowedTypes = uploadController.ALLOWED_IMAGE_TYPES;
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'), false);
  }
};

const documentFilter = (req, file, cb) => {
  const allowedTypes = [
    ...uploadController.ALLOWED_IMAGE_TYPES,
    ...uploadController.ALLOWED_DOCUMENT_TYPES
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'), false);
  }
};

// Instancias de multer
const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: uploadController.MAX_IMAGE_SIZE
  }
});

const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: uploadController.MAX_DOCUMENT_SIZE
  }
});

const uploadMultiple = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: uploadController.MAX_DOCUMENT_SIZE,
    files: 10 // Máximo 10 archivos a la vez
  }
});

// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El archivo excede el tamaño máximo permitido'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Se excedió el número máximo de archivos (10)'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: err.message
    });
  }
  next();
};

/**
 * POST /api/upload/image
 * Sube una imagen
 * Roles: Todos los autenticados
 */
router.post(
  '/image',
  authenticate,
  uploadImage.single('file'),
  handleMulterError,
  uploadController.uploadImage
);

/**
 * POST /api/upload/document
 * Sube un documento o imagen
 * Roles: Admin, Agency
 */
router.post(
  '/document',
  authenticate,
  authorize(['admin', 'agency']),
  uploadDocument.single('file'),
  handleMulterError,
  uploadController.uploadDocument
);

/**
 * POST /api/upload/multiple
 * Sube múltiples archivos
 * Roles: Admin, Agency
 */
router.post(
  '/multiple',
  authenticate,
  authorize(['admin', 'agency']),
  uploadMultiple.array('files', 10),
  handleMulterError,
  uploadController.uploadMultiple
);

/**
 * DELETE /api/upload/:filename
 * Elimina un archivo
 * Roles: Admin
 */
router.delete(
  '/:filename',
  authenticate,
  authorize(['admin']),
  uploadController.deleteFile
);

module.exports = router;
