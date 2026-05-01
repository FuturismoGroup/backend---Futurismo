// Helpers de almacenamiento en Wasabi
// Centraliza upload/delete/presigned URL para todo el backend

const crypto = require('crypto');
const path = require('path');
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3, UPLOADS_BUCKET } = require('../config/wasabi');

const PRESIGNED_URL_EXPIRES = parseInt(process.env.WASABI_PRESIGNED_EXPIRES || '3600', 10); // 1h por defecto

/**
 * Genera un nombre de archivo único conservando la extensión.
 *   ej: "factura.pdf" -> "1714578123456-abc12345.pdf"
 */
function generateFilename(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const ts = Date.now();
  const rnd = crypto.randomBytes(6).toString('hex');
  return `${ts}-${rnd}${ext}`;
}

/**
 * Construye la key (ruta dentro del bucket) a partir de un prefix lógico
 * y un nombre de archivo. Limpia separadores duplicados.
 */
function buildKey(prefix, filename) {
  const clean = (prefix || '').replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/${filename}` : filename;
}

/**
 * URL pública que el frontend usa como src/href.
 * El endpoint /api/files/:key(*) responde con 302 a una presigned URL.
 *
 * Si BACKEND_PUBLIC_URL está definida (ej. en producción Railway), retorna
 * URL absoluta. En desarrollo retorna ruta relativa /api/files/<key>, que
 * el frontend resuelve contra VITE_API_URL.
 */
function publicPath(key) {
  const base = (process.env.BACKEND_PUBLIC_URL || '').replace(/\/+$/, '');
  return base ? `${base}/api/files/${key}` : `/api/files/${key}`;
}

/**
 * Sube un buffer al bucket de uploads.
 *   prefix:  carpeta lógica (ej. "tours/abcd-1234")
 *   buffer:  contenido binario (req.file.buffer de multer.memoryStorage)
 *   originalName: nombre original (para conservar extensión)
 *   contentType: MIME
 *   metadata: { key1: value1 } opcional
 *
 * Retorna { key, url, size, contentType }
 */
async function uploadBuffer({ prefix, buffer, originalName, contentType, metadata }) {
  const filename = generateFilename(originalName);
  const key = buildKey(prefix, filename);

  await s3.send(new PutObjectCommand({
    Bucket: UPLOADS_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata || undefined
  }));

  return {
    key,
    filename,
    url: publicPath(key),
    size: buffer.length,
    contentType
  };
}

/**
 * Elimina un objeto del bucket de uploads. Idempotente: no falla si no existe.
 */
async function deleteObject(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key }));
  } catch (e) {
    // Ignorar si el objeto no existe; loguear el resto
    if (e.name !== 'NoSuchKey' && e.$metadata?.httpStatusCode !== 404) {
      console.error('[wasabi] deleteObject', key, e.message);
    }
  }
}

/**
 * Genera una presigned URL temporal para descargar un objeto.
 *   expiresIn: segundos (default 3600)
 */
async function getPresignedDownloadUrl(key, expiresIn) {
  const command = new GetObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresIn || PRESIGNED_URL_EXPIRES });
}

/**
 * Verifica si un objeto existe en el bucket.
 */
async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key }));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Extrae la key a partir de una URL almacenada en BD.
 * Soporta:
 *   - "/api/files/tours/abc/foo.jpg"  -> "tours/abc/foo.jpg"
 *   - "https://.../api/files/tours/abc/foo.jpg" -> "tours/abc/foo.jpg"
 *   - "tours/abc/foo.jpg" (ya es una key)       -> "tours/abc/foo.jpg"
 *   - "/uploads/foo.jpg" (legacy disco)         -> null (no es Wasabi)
 */
function extractKeyFromUrl(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;

  // Quitar host si viene URL absoluta
  const noHost = urlOrPath.replace(/^https?:\/\/[^/]+/, '');

  // Match /api/files/<key>
  const m = noHost.match(/^\/?api\/files\/(.+)$/);
  if (m) return m[1];

  // Si empieza con /uploads/ es legacy disco, no es Wasabi
  if (noHost.startsWith('/uploads/') || noHost.startsWith('uploads/')) return null;

  // Asumir que ya es una key
  if (!noHost.startsWith('/')) return noHost;

  return null;
}

module.exports = {
  uploadBuffer,
  deleteObject,
  getPresignedDownloadUrl,
  objectExists,
  extractKeyFromUrl,
  publicPath,
  buildKey,
  generateFilename,
  PRESIGNED_URL_EXPIRES
};
