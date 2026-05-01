// Middleware para upload de imágenes de rewards hacia Wasabi
// Almacenamiento en memoria — el controller sube el buffer a Wasabi

const multer = require('multer');
const { uploadBuffer, publicPath, buildKey } = require('../utils/wasabiStorage');

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WEBP).'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

const uploadRewardImage = upload.single('image');

const handleUpload = (req, res, next) => {
  uploadRewardImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'El archivo es muy grande. Máximo 5MB.' });
      }
      return res.status(400).json({ success: false, error: `Error al subir archivo: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

/**
 * Sube el buffer a Wasabi bajo rewards/{filename}
 */
async function uploadRewardImageToStorage(file) {
  return uploadBuffer({
    prefix: 'rewards',
    buffer: file.buffer,
    originalName: file.originalname,
    contentType: file.mimetype
  });
}

/**
 * URL pública (path /api/files/...) para una imagen de recompensa.
 */
function getRewardImageUrl(filename) {
  return publicPath(buildKey('rewards', filename));
}

module.exports = {
  handleUpload,
  uploadRewardImageToStorage,
  getRewardImageUrl
};
