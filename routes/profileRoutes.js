// Routes de Profile
// Maneja documentos y otros datos del perfil de usuario
// Almacenamiento en Wasabi (vía utils/wasabiStorage)

const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentController = require('../controllers/documentController');
const { authenticate } = require('../middlewares/auth');
const uploadController = require('../controllers/uploadController');
const { uploadBuffer } = require('../utils/wasabiStorage');

// Almacenamiento en memoria — el handler sube el buffer a Wasabi
const memoryStorage = multer.memoryStorage();

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
  storage: memoryStorage,
  fileFilter: documentFilter,
  limits: { fileSize: uploadController.MAX_DOCUMENT_SIZE }
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El archivo excede el tamaño máximo permitido (10MB)'
      });
    }
    return res.status(400).json({ success: false, error: 'Bad Request', message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, error: 'Bad Request', message: err.message });
  }
  next();
};

function monthFolder() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * GET /api/profile/documents
 * Obtener documentos del usuario autenticado
 * Query params: category, status
 */
router.get('/documents', authenticate, documentController.getMyDocuments);

/**
 * GET /api/profile/documents/:id
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
 * Subir y crear documento en un solo paso (a Wasabi).
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
          message: 'No se proporcionó ningún archivo'
        });
      }

      const { document_type, name, expiry_date } = req.body;

      if (!document_type) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Se requiere document_type'
        });
      }

      // Subir a Wasabi bajo profile-documents/{userId}/{YYYY-MM}/
      const userPrefix = req.user?.id ? `profile-documents/${req.user.id}/${monthFolder()}` : `profile-documents/${monthFolder()}`;
      const uploaded = await uploadBuffer({
        prefix: userPrefix,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
        metadata: { uploadedBy: req.user?.id || 'anonymous' }
      });

      req.body = {
        name: name || req.file.originalname.replace(/\.[^/.]+$/, ''),
        document_type,
        file_url: uploaded.url,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        expiry_date: expiry_date || null
      };

      return documentController.createDocument(req, res);
    } catch (error) {
      console.error('Error en upload document:', error);
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
 */
router.delete('/documents/:id', authenticate, documentController.deleteDocument);

/**
 * GET /api/profile/document-templates
 * Alias de getMyDocuments para compatibilidad con frontend.
 */
router.get('/document-templates', authenticate, documentController.getMyDocuments);

module.exports = router;
