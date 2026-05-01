/**
 * Schemas de validacion para languages
 */

const Joi = require('joi');

// Schema base para IDs UUID
const uuidSchema = Joi.string().uuid().messages({
  'string.guid': 'ID debe ser un UUID valido'
});

/**
 * Schema para crear idioma
 */
const createLanguageSchema = Joi.object({
  code: Joi.string().length(2).pattern(/^[a-z]{2}$/i).required().messages({
    'string.length': 'code debe tener exactamente 2 caracteres (ISO 639-1)',
    'string.pattern.base': 'code debe contener solo letras (ej: "es", "en")',
    'any.required': 'code es requerido'
  }),
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'name debe tener al menos 2 caracteres',
    'string.max': 'name no puede exceder 100 caracteres',
    'any.required': 'name es requerido'
  }),
  nativeName: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'nativeName debe tener al menos 2 caracteres',
    'string.max': 'nativeName no puede exceder 100 caracteres'
  })
});

/**
 * Schema para actualizar idioma
 */
const updateLanguageSchema = Joi.object({
  code: Joi.string().length(2).pattern(/^[a-z]{2}$/i).optional().messages({
    'string.length': 'code debe tener exactamente 2 caracteres (ISO 639-1)',
    'string.pattern.base': 'code debe contener solo letras (ej: "es", "en")'
  }),
  name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'name debe tener al menos 2 caracteres',
    'string.max': 'name no puede exceder 100 caracteres'
  }),
  nativeName: Joi.string().min(2).max(100).optional().allow('', null).messages({
    'string.min': 'nativeName debe tener al menos 2 caracteres',
    'string.max': 'nativeName no puede exceder 100 caracteres'
  })
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

module.exports = {
  createLanguageSchema,
  updateLanguageSchema
};
