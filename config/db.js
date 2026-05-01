// Configuración de base de datos (Prisma Client)
// Fuente: 03_tablas_modelo.md, 04_schema_postgres.sql

const { PrismaClient } = require('@prisma/client');

// Configuración de logging:
// - En producción: solo errores
// - En desarrollo: warn + error (menos ruido)
// - Para debug de queries: set PRISMA_LOG_QUERIES=true
const getLogConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    return ['error'];
  }
  if (process.env.PRISMA_LOG_QUERIES === 'true') {
    return ['query', 'info', 'warn', 'error'];
  }
  return ['warn', 'error'];
};

/**
 * Fuerza timezone UTC en la sesion PostgreSQL via connection URL.
 * Esto previene que PostgreSQL convierta timestamps usando su timezone local
 * (ej. America/Bogota) al escribir/leer columnas DATE, lo cual causaba
 * desfase de 1 dia (ej. 2026-03-01 → 2026-02-28).
 *
 * Funciona tanto en desarrollo local como en Railway (produccion).
 */
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return url;

  // Si ya tiene options configurado, respetar la config del usuario
  if (url.includes('options=')) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}options=-c%20timezone%3DUTC`;
};

const prisma = new PrismaClient({
  log: getLogConfig(),
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
});

// Log de conexion en desarrollo
if (process.env.NODE_ENV !== 'production') {
  const dbUrl = process.env.DATABASE_URL || '';
  const dbName = dbUrl.match(/\/([^/?]+)(\?|$)/)?.[1] || 'unknown';
  const dbHost = dbUrl.match(/@([^:\/]+)/)?.[1] || 'unknown';
  console.log(`[DB] Conectando a: ${dbName} @ ${dbHost}`);
}

// Manejo de conexión graceful
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
