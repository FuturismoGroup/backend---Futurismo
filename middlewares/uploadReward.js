// Middleware para upload de imágenes de rewards
// Almacena las imágenes en uploads/rewards

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Directorio de destino
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'rewards');

// Crear el directorio si no existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: reward-{timestamp}-{random}.{ext}
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `reward-${uniqueSuffix}${ext}`);
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

// Configuración de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

// Middleware para un solo archivo con campo 'image'
const uploadRewardImage = upload.single('image');

// Wrapper para manejar errores de multer
const handleUpload = (req, res, next) => {
  uploadRewardImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'El archivo es muy grande. Máximo 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        error: `Error al subir archivo: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
};

module.exports = {
  handleUpload,
  UPLOAD_DIR
};
