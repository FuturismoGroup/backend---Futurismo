/**
 * Schemas de validacion para drivers
 */

const Joi = require('joi');

// Schema base para IDs UUID
const uuidSchema = Joi.string().uuid().messages({
  'string.guid': 'ID debe ser un UUID valido'
});

const createDriverSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Nombre debe tener al menos 2 caracteres',
    'string.max': 'Nombre no puede exceder 50 caracteres',
    'any.required': 'Nombre es requerido'
  }),
  first_name: Joi.string().min(2).max(50).optional(),

  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Apellido debe tener al menos 2 caracteres',
    'string.max': 'Apellido no puede exceder 50 caracteres',
    'any.required': 'Apellido es requerido'
  }),
  last_name: Joi.string().min(2).max(50).optional(),

  documentType: Joi.string().valid('DNI', 'RUC', 'CE', 'PASSPORT').default('DNI'),
  document_type: Joi.string().valid('DNI', 'RUC', 'CE', 'PASSPORT').optional(),

  documentNumber: Joi.string().min(6).max(20).optional().messages({
    'string.min': 'Numero de documento debe tener al menos 6 caracteres',
    'string.max': 'Numero de documento no puede exceder 20 caracteres'
  }),
  document_number: Joi.string().min(6).max(20).optional(),
  dni: Joi.string().length(8).pattern(/^\d+$/).optional().messages({
    'string.length': 'DNI debe tener exactamente 8 dígitos',
    'string.pattern.base': 'DNI debe contener solo números'
  }),

  phone: Joi.string().pattern(/^[+]?[\d\s-]{8,15}$/).optional().messages({
    'string.pattern.base': 'Telefono debe ser un numero valido'
  }),

  email: Joi.string().email().optional().messages({
    'string.email': 'Email debe ser valido'
  }),

  licenseNumber: Joi.string().min(5).max(20).required().messages({
    'string.min': 'Numero de licencia debe tener al menos 5 caracteres',
    'string.max': 'Numero de licencia no puede exceder 20 caracteres',
    'any.required': 'Numero de licencia es requerido'
  }),
  license_number: Joi.string().min(5).max(20).optional(),

  licenseCategory: Joi.string().valid(
    'A-I', 'A-IIA', 'A-IIB', 'A-IIIA', 'A-IIIB', 'A-IIIC',
    'A-IIa', 'A-IIb', 'A-IIIa', 'A-IIIb', 'A-IIIc',
    'B-I', 'B-IIA', 'B-IIB', 'B-IIC',
    'B-IIa', 'B-IIb', 'B-IIc'
  ).required().messages({
    'any.only': 'Categoria de licencia no válida',
    'any.required': 'Categoria de licencia es requerida'
  }),
  license_category: Joi.string().valid(
    'A-I', 'A-IIA', 'A-IIB', 'A-IIIA', 'A-IIIB', 'A-IIIC',
    'A-IIa', 'A-IIb', 'A-IIIa', 'A-IIIb', 'A-IIIc',
    'B-I', 'B-IIA', 'B-IIB', 'B-IIC',
    'B-IIa', 'B-IIb', 'B-IIc'
  ).optional(),

  licenseExpiry: Joi.date().min('now').optional().messages({
    'date.min': 'Fecha de vencimiento de licencia debe ser futura'
  }),
  license_expiry: Joi.date().min('now').optional(),

  photoUrl: Joi.string().uri().max(500).optional().messages({
    'string.uri': 'URL de foto debe ser valida',
    'string.max': 'URL de foto no puede exceder 500 caracteres'
  }),
  photo_url: Joi.string().uri().max(500).optional()
}).or('documentNumber', 'document_number', 'dni').messages({
  'object.missing': 'Debe proporcionar DNI o número de documento'
});

const updateDriverSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  first_name: Joi.string().min(2).max(50).optional(),

  lastName: Joi.string().min(2).max(50).optional(),
  last_name: Joi.string().min(2).max(50).optional(),

  documentType: Joi.string().valid('DNI', 'RUC', 'CE', 'PASSPORT').optional(),
  document_type: Joi.string().valid('DNI', 'RUC', 'CE', 'PASSPORT').optional(),

  documentNumber: Joi.string().min(6).max(20).optional(),
  document_number: Joi.string().min(6).max(20).optional(),
  dni: Joi.string().min(6).max(20).optional(),

  phone: Joi.string().pattern(/^[+]?[\d\s-]{8,15}$/).optional().allow(''),

  email: Joi.string().email().optional().allow(''),

  licenseNumber: Joi.string().min(5).max(20).optional(),
  license_number: Joi.string().min(5).max(20).optional(),

  licenseCategory: Joi.string().valid(
    'A-I', 'A-IIA', 'A-IIB', 'A-IIIA', 'A-IIIB', 'A-IIIC',
    'A-IIa', 'A-IIb', 'A-IIIa', 'A-IIIb', 'A-IIIc',
    'B-I', 'B-IIA', 'B-IIB', 'B-IIC',
    'B-IIa', 'B-IIb', 'B-IIc'
  ).optional(),
  license_category: Joi.string().valid(
    'A-I', 'A-IIA', 'A-IIB', 'A-IIIA', 'A-IIIB', 'A-IIIC',
    'A-IIa', 'A-IIb', 'A-IIIa', 'A-IIIb', 'A-IIIc',
    'B-I', 'B-IIA', 'B-IIB', 'B-IIC',
    'B-IIa', 'B-IIb', 'B-IIc'
  ).optional(),

  licenseExpiry: Joi.date().min('now').optional().allow(null),
  license_expiry: Joi.date().min('now').optional().allow(null),

  photoUrl: Joi.string().uri().max(500).optional().allow('', null),
  photo_url: Joi.string().uri().max(500).optional().allow('', null),

  status: Joi.string().valid('active', 'inactive', 'suspended').optional()
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

const assignDriverSchema = Joi.object({
  tourId: Joi.string().uuid().optional().messages({
    'string.guid': 'tourId debe ser un UUID válido'
  }),
  reservationId: Joi.string().uuid().optional().messages({
    'string.guid': 'reservationId debe ser un UUID válido'
  }),
  tourCode: Joi.string().max(50).optional(),
  date: Joi.date().iso().optional().messages({
    'date.format': 'date debe ser una fecha ISO válida'
  }),
  vehicleId: Joi.string().uuid().optional().allow(null).messages({
    'string.guid': 'vehicleId debe ser un UUID válido'
  }),
  guideId: Joi.string().uuid().optional().allow(null).messages({
    'string.guid': 'guideId debe ser un UUID válido'
  }),
  pickupLocation: Joi.string().max(255).optional().allow('', null),
  pickupTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional().allow(null).messages({
    'string.pattern.base': 'pickupTime debe estar en formato HH:MM o HH:MM:SS'
  }),
  notes: Joi.string().max(500).optional().allow('', null)
}).or('tourId', 'reservationId').messages({
  'object.missing': 'Debe proporcionar tourId o reservationId'
});

module.exports = {
  createDriverSchema,
  updateDriverSchema,
  assignDriverSchema
};
