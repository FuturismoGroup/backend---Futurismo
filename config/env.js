// Configuracion centralizada de variables de entorno
// Este modulo es el UNICO lugar donde se definen las variables criticas
// Todos los demas archivos deben importar desde aqui

const config = {
  // JWT - Autenticacion
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',

  // Servidor
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 4025,

  // Base de datos (referencia, no se usa directamente aqui)
  DATABASE_URL: process.env.DATABASE_URL
};

// Validacion critica al iniciar el servidor
// Si no hay JWT_SECRET, el servidor NO debe arrancar
if (!config.JWT_SECRET) {
  console.error('==========================================');
  console.error('ERROR CRITICO: JWT_SECRET no configurado');
  console.error('==========================================');
  console.error('Agrega JWT_SECRET al archivo .env');
  console.error('Ejemplo: JWT_SECRET="tu_clave_secreta_aqui"');
  console.error('==========================================');
  throw new Error('JWT_SECRET es obligatorio. Configura el archivo .env');
}

module.exports = config;
