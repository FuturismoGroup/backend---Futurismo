// Middleware para upload de fotos de tours
// Almacena las fotos en uploads/tours/{activeTourId}/

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Directorio base para fotos de tours
const TOURS_UPLOAD_BASE = path.join(__dirname, '..', 'uploads', 'tours');

// Crear el directorio base si no existe
if (!fs.existsSync(TOURS_UPLOAD_BASE)) {
  fs.mkdirSync(TOURS_UPLOAD_BASE, { recursive: true });
}

// Configuración de almacenamiento dinámico
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Obtener activeTourId del body o params
    const activeTourId = req.body.activeTourId || req.params.tourId;

    if (!activeTourId) {
      return cb(new Error('activeTourId es requerido'), null);
    }

    // Crear carpeta para este tour si no existe
    const tourDir = path.join(TOURS_UPLOAD_BASE, activeTourId);

    if (!fs.existsSync(tourDir)) {
      fs.mkdirSync(tourDir, { recursive: true });
    }

    cb(null, tourDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: {timestamp}-{random}.{ext}
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

// Configuración de multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo para fotos de tours
  }
});

// Middleware para un solo archivo con campo 'photo'
const uploadSingle = upload.single('photo');

// Middleware para múltiples archivos (hasta 5) con campo 'photos'
const uploadMultiple = upload.array('photos', 5);

// Wrapper para manejar errores de multer (single)
const handleSingleUpload = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'El archivo es muy grande. Máximo 10MB.'
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

// Wrapper para manejar errores de multer (multiple)
const handleMultipleUpload = (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Uno o más archivos son muy grandes. Máximo 10MB cada uno.'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Máximo 5 fotos por solicitud.'
        });
      }
      return res.status(400).json({
        success: false,
        error: `Error al subir archivos: ${err.message}`
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

// Función auxiliar para obtener la URL relativa de una foto
const getPhotoUrl = (activeTourId, filename) => {
  return `/uploads/tours/${activeTourId}/${filename}`;
};

// Función para eliminar una foto físicamente
const deletePhotoFile = async (activeTourId, filename) => {
  const filePath = path.join(TOURS_UPLOAD_BASE, activeTourId, filename);

  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
};

// Función para eliminar toda la carpeta de un tour
const deleteTourFolder = async (activeTourId) => {
  const tourDir = path.join(TOURS_UPLOAD_BASE, activeTourId);

  return new Promise((resolve, reject) => {
    fs.rm(tourDir, { recursive: true, force: true }, (err) => {
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
};

module.exports = {
  handleSingleUpload,
  handleMultipleUpload,
  getPhotoUrl,
  deletePhotoFile,
  deleteTourFolder,
  TOURS_UPLOAD_BASE
};
