// Routes de Upload — almacena archivos en Wasabi

const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { authenticate, authorize } = require('../middlewares/auth');

// Almacenamiento en memoria — el controller sube el buffer a Wasabi
const memoryStorage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (uploadController.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
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

const uploadImage = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: { fileSize: uploadController.MAX_IMAGE_SIZE }
});

const uploadDocument = multer({
  storage: memoryStorage,
  fileFilter: documentFilter,
  limits: { fileSize: uploadController.MAX_DOCUMENT_SIZE }
});

const uploadMultiple = multer({
  storage: memoryStorage,
  fileFilter: documentFilter,
  limits: { fileSize: uploadController.MAX_DOCUMENT_SIZE, files: 10 }
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'El archivo excede el tamaño máximo permitido' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, error: 'Bad Request', message: 'Se excedió el número máximo de archivos (10)' });
    }
    return res.status(400).json({ success: false, error: 'Bad Request', message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, error: 'Bad Request', message: err.message });
  }
  next();
};

router.post('/image',    authenticate,                                  uploadImage.single('file'),    handleMulterError, uploadController.uploadImage);
router.post('/document', authenticate, authorize(['admin', 'agency']), uploadDocument.single('file'), handleMulterError, uploadController.uploadDocument);
router.post('/multiple', authenticate, authorize(['admin', 'agency']), uploadMultiple.array('files', 10), handleMulterError, uploadController.uploadMultiple);
router.delete('/:key(*)', authenticate, authorize(['admin']),          uploadController.deleteFile);

module.exports = router;
