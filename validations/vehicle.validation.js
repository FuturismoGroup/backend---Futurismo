/**
 * Schemas de validacion para vehicles
 */

const Joi = require('joi');

const createVehicleSchema = Joi.object({
  plate: Joi.string()
    .min(6)
    .max(7)
    .pattern(/^[A-Z0-9]{3}-?[A-Z0-9]{3}$/)
    .required()
    .messages({
      'string.min': 'Placa debe tener al menos 6 caracteres',
      'string.max': 'Placa no puede exceder 7 caracteres',
      'string.pattern.base': 'Placa debe tener formato válido (ej: ABC-123 o ABC123)',
      'any.required': 'Placa es requerida'
    }),

  brand: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Marca debe tener al menos 2 caracteres',
    'string.max': 'Marca no puede exceder 50 caracteres',
    'any.required': 'Marca es requerida'
  }),

  model: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Modelo debe tener al menos 1 caracter',
    'string.max': 'Modelo no puede exceder 50 caracteres',
    'any.required': 'Modelo es requerido'
  }),

  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional().messages({
    'number.min': 'Año debe ser mayor o igual a 1900',
    'number.max': `Año no puede ser mayor a ${new Date().getFullYear() + 1}`
  }),

  capacity: Joi.number().integer().min(1).max(100).optional().messages({
    'number.min': 'Capacidad debe ser al menos 1',
    'number.max': 'Capacidad no puede exceder 100'
  }),
  seats: Joi.number().integer().min(1).max(100).optional(),

  vehicleType: Joi.string().valid('sedan', 'suv', 'van', 'bus', 'minivan', 'coaster', 'sprinter', 'otro').optional(),
  type: Joi.string().valid('sedan', 'suv', 'van', 'bus', 'minivan', 'coaster', 'sprinter', 'otro').optional(),

  color: Joi.string().min(2).max(30).optional().messages({
    'string.min': 'Color debe tener al menos 2 caracteres',
    'string.max': 'Color no puede exceder 30 caracteres'
  }),

  photoUrl: Joi.string().uri().max(500).optional().messages({
    'string.uri': 'URL de foto debe ser valida',
    'string.max': 'URL de foto no puede exceder 500 caracteres'
  }),
  photo_url: Joi.string().uri().max(500).optional(),
  photo: Joi.string().uri().max(500).optional(),
  image: Joi.string().uri().max(500).optional(),

  // Documentos del vehiculo (SOAT, Revision Tecnica, etc.)
  documents: Joi.object().pattern(
    Joi.string(), // clave del tipo de documento (ej: 'soat', 'technicalReview')
    Joi.object({
      number: Joi.string().max(50).optional().allow('', null),
      expiry: Joi.string().optional().allow('', null),
      fileUrl: Joi.string().uri().max(500).optional().allow('', null)
    })
  ).optional()
});

const updateVehicleSchema = Joi.object({
  plate: Joi.string()
    .min(6)
    .max(7)
    .pattern(/^[A-Z0-9]{3}-?[A-Z0-9]{3}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Placa debe tener formato válido (ej: ABC-123 o ABC123)'
    }),

  brand: Joi.string().min(2).max(50).optional(),

  model: Joi.string().min(1).max(50).optional(),

  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),

  capacity: Joi.number().integer().min(1).max(100).optional(),
  seats: Joi.number().integer().min(1).max(100).optional(),

  vehicleType: Joi.string().valid('sedan', 'suv', 'van', 'bus', 'minivan', 'coaster', 'sprinter', 'otro').optional(),
  type: Joi.string().valid('sedan', 'suv', 'van', 'bus', 'minivan', 'coaster', 'sprinter', 'otro').optional(),

  color: Joi.string().min(2).max(30).optional().allow(''),

  photoUrl: Joi.string().uri().max(500).optional().allow('', null),
  photo_url: Joi.string().uri().max(500).optional().allow('', null),
  photo: Joi.string().uri().max(500).optional().allow('', null),
  image: Joi.string().uri().max(500).optional().allow('', null),

  status: Joi.string().valid('active', 'inactive', 'maintenance').optional(),

  // Documentos del vehiculo (SOAT, Revision Tecnica, etc.)
  documents: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      number: Joi.string().max(50).optional().allow('', null),
      expiry: Joi.string().optional().allow('', null),
      fileUrl: Joi.string().uri().max(500).optional().allow('', null)
    })
  ).optional()
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

const registerMaintenanceSchema = Joi.object({
  type: Joi.string().valid('preventive', 'corrective', 'inspection', 'other').required().messages({
    'any.only': 'Tipo debe ser: preventive, corrective, inspection o other',
    'any.required': 'Tipo de mantenimiento es requerido'
  }),

  description: Joi.string().min(10).max(500).required().messages({
    'string.min': 'Descripcion debe tener al menos 10 caracteres',
    'string.max': 'Descripcion no puede exceder 500 caracteres',
    'any.required': 'Descripcion es requerida'
  }),

  cost: Joi.number().min(0).precision(2).optional().messages({
    'number.min': 'Costo no puede ser negativo'
  }),

  performedAt: Joi.date().max('now').optional().default(() => new Date()).messages({
    'date.max': 'Fecha de mantenimiento no puede ser futura'
  }),

  nextMaintenanceDate: Joi.date().min('now').optional().messages({
    'date.min': 'Fecha de proximo mantenimiento debe ser futura'
  })
});

module.exports = {
  createVehicleSchema,
  updateVehicleSchema,
  registerMaintenanceSchema
};
