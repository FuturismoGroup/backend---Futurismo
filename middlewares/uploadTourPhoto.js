// Middleware para upload de fotos de tours hacia Wasabi
// Almacenamiento en memoria — el controller sube el buffer a Wasabi
// Las URLs almacenadas en BD son /api/files/tours/{activeTourId}/{filename}

const multer = require('multer');
const { uploadBuffer, deleteObject, generateFilename, buildKey, publicPath, extractKeyFromUrl } = require('../utils/wasabiStorage');

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

const uploadSingle = upload.single('photo');
const uploadMultiple = upload.array('photos', 5);

const handleSingleUpload = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'El archivo es muy grande. Máximo 10MB.' });
      }
      return res.status(400).json({ success: false, error: `Error al subir archivo: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

const handleMultipleUpload = (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Uno o más archivos son muy grandes. Máximo 10MB cada uno.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, error: 'Máximo 5 fotos por solicitud.' });
      }
      return res.status(400).json({ success: false, error: `Error al subir archivos: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

/**
 * Sube el buffer del file a Wasabi bajo tours/{activeTourId}/{filename}
 * Retorna { key, url, filename, size, contentType }
 */
async function uploadTourPhotoToStorage(activeTourId, file) {
  return uploadBuffer({
    prefix: `tours/${activeTourId}`,
    buffer: file.buffer,
    originalName: file.originalname,
    contentType: file.mimetype
  });
}

/**
 * Construye la URL pública (path /api/files/...) para una foto de tour.
 * Mantenida por compatibilidad con código existente.
 */
function getPhotoUrl(activeTourId, filename) {
  return publicPath(buildKey(`tours/${activeTourId}`, filename));
}

/**
 * Elimina una foto del bucket usando la URL almacenada en BD.
 * Acepta tanto URL completa como key.
 */
async function deletePhotoFile(activeTourIdOrUrl, filename) {
  // Compatibilidad: si vienen 2 args (id + filename) construimos la key
  let key;
  if (filename) {
    key = buildKey(`tours/${activeTourIdOrUrl}`, filename);
  } else {
    key = extractKeyFromUrl(activeTourIdOrUrl) || activeTourIdOrUrl;
  }
  await deleteObject(key);
}

/**
 * Compatibilidad con código existente: ya no aplica con Wasabi (no hay carpeta).
 * Si necesitas borrar todas las fotos de un tour usa s3 list+delete con prefix.
 */
async function deleteTourFolder(activeTourId) {
  // No implementado — dejado como no-op por compatibilidad.
  // Para un cleanup masivo, listar objetos con prefix tours/{activeTourId}/ y borrar uno a uno.
  return true;
}

module.exports = {
  handleSingleUpload,
  handleMultipleUpload,
  uploadTourPhotoToStorage,
  getPhotoUrl,
  deletePhotoFile,
  deleteTourFolder,
  generateFilename
};
