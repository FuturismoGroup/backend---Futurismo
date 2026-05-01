// Routes de Profile
// Maneja documentos y otros datos del perfil de usuario

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const documentController = require('../controllers/documentController');
const { authenticate } = require('../middlewares/auth');
const uploadController = require('../controllers/uploadController');

// Asegurar que el directorio de uploads existe
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuracion de almacenamiento para documentos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc-${timestamp}-${randomBytes}${ext}`);
  }
});

// Filtro de archivos para documentos
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

const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: {
    fileSize: uploadController.MAX_DOCUMENT_SIZE
  }
});

// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El archivo excede el tamano maximo permitido (10MB)'
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
 * GET /api/profile/documents
 * Obtener documentos del usuario autenticado
 * Query params: category, status
 */
router.get('/documents', authenticate, documentController.getMyDocuments);

/**
 * GET /api/profile/documents/:id
 * Obtener un documento especifico
 */
router.get('/documents/:id', authenticate, documentController.getDocumentById);

/**
 * POST /api/profile/documents
 * Crear documento (archivo ya subido previamente)
 * Body: { name, document_type, file_url, file_type?, file_size?, expiry_date? }
 */
router.post('/documents', authenticate, documentController.createDocument);

/**
 * POST /api/profile/documents/upload
 * Subir y crear documento en un solo paso
 * FormData: file, document_type, name?, expiry_date?
 */
router.post(
  '/documents/upload',
  authenticate,
  uploadDocument.single('file'),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'No se proporciono ningun archivo'
        });
      }

      const { document_type, name, expiry_date } = req.body;

      if (!document_type) {
        // Eliminar archivo si falta document_type
        const fsPromises = require('fs').promises;
        await fsPromises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Se requiere document_type'
        });
      }

      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

      // Guardar en BD usando el controller
      req.body = {
        name: name || req.file.originalname.replace(/\.[^/.]+$/, ''),
        document_type,
        file_url: fileUrl,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        expiry_date: expiry_date || null
      };

      return documentController.createDocument(req, res);
    } catch (error) {
      console.error('Error en upload document:', error);
      if (req.file) {
        const fsPromises = require('fs').promises;
        await fsPromises.unlink(req.file.path).catch(() => {});
      }
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Error al subir documento'
      });
    }
  }
);

/**
 * DELETE /api/profile/documents/:id
 * Eliminar documento del usuario
 */
router.delete('/documents/:id', authenticate, documentController.deleteDocument);

/**
 * GET /api/profile/document-templates
 * Obtener documentos del usuario (alias para compatibilidad con frontend existente)
 */
router.get('/document-templates', authenticate, documentController.getMyDocuments);

module.exports = router;
