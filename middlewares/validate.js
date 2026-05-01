/**
 * Middleware de validacion con Joi
 * Uso: validate(schema) o validate(schema, 'query') para query params
 */

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];
    console.log(`🔍 Validate middleware [${req.method} ${req.originalUrl}] - datos recibidos:`, JSON.stringify(dataToValidate, null, 2));

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, '')
      }));

      console.log('❌ Validation Error:', JSON.stringify(errors, null, 2));

      return res.status(400).json({
        error: 'Validation Error',
        message: 'Datos de entrada invalidos',
        details: errors
      });
    }

    // Reemplazar datos con valores validados y convertidos
    req[source] = value;
    next();
  };
};

module.exports = { validate };
