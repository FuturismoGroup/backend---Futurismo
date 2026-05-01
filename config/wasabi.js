// Cliente S3 configurado para Wasabi
// Usado por utils/wasabiStorage.js

const { S3Client } = require('@aws-sdk/client-s3');

const REGION = process.env.WASABI_REGION || 'us-east-1';
const ENDPOINT = process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com';
const ACCESS_KEY = process.env.WASABI_ACCESS_KEY;
const SECRET_KEY = process.env.WASABI_SECRET_KEY;
const UPLOADS_BUCKET = process.env.WASABI_UPLOADS_BUCKET || 'futurismo-uploads';
const BACKUPS_BUCKET = process.env.WASABI_BACKUPS_BUCKET || 'futurismo-backups';

if (!ACCESS_KEY || !SECRET_KEY) {
  console.warn('[wasabi] WASABI_ACCESS_KEY o WASABI_SECRET_KEY no definidas — uploads fallarán');
}

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY || '',
    secretAccessKey: SECRET_KEY || ''
  },
  forcePathStyle: true
});

module.exports = {
  s3,
  REGION,
  ENDPOINT,
  UPLOADS_BUCKET,
  BACKUPS_BUCKET
};
