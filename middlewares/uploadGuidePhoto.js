// Middleware para upload de foto de perfil de guías freelance
// Almacena las fotos en uploads/guias-freelance/

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Directorio para fotos de guías freelance
const GUIDES_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'guias-freelance');

// Crear el directorio si no existe
if (!fs.existsSync(GUIDES_UPLOAD_DIR)) {
  fs.mkdirSync(GUIDES_UPLOAD_DIR, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, GUIDES_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Filtro de archivos - solo imágenes
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WEBP).'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

const uploadSingle = upload.single('photo');

// Wrapper para manejar errores de multer
const handleGuidePhotoUpload = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'El archivo es muy grande. Máximo 5MB.'
        });
      }
      return res.status(400).json({
        error: 'Bad Request',
        message: `Error al subir archivo: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        error: 'Bad Request',
        message: err.message
      });
    }
    next();
  });
};

// Obtener URL relativa de la foto
const getGuidePhotoUrl = (filename) => {
  return `/uploads/guias-freelance/${filename}`;
};

module.exports = {
  handleGuidePhotoUpload,
  getGuidePhotoUrl,
  GUIDES_UPLOAD_DIR
};
