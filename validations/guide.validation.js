/**
 * Schemas de validacion para guias
 */

const Joi = require('joi');

const uuidSchema = Joi.string().uuid().messages({
  'string.guid': 'ID debe ser un UUID valido'
});

const createGuideSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email debe ser un correo valido',
      'any.required': 'Email es requerido'
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password debe tener al menos 8 caracteres',
      'string.pattern.base': 'Password debe contener mayusculas, minusculas y numeros',
      'any.required': 'Password es requerido'
    }),
  firstName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Nombre debe tener al menos 2 caracteres',
      'any.required': 'Nombre es requerido'
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Apellido debe tener al menos 2 caracteres',
      'any.required': 'Apellido es requerido'
    }),
  phone: Joi.string()
    .pattern(/^[+]?[\d\s-]{8,15}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Telefono debe ser un numero valido'
    }),
  guideType: Joi.string()
    .valid('FREELANCE', 'AGENCY')
    .required()
    .messages({
      'any.only': 'Tipo de guia debe ser FREELANCE o AGENCY',
      'any.required': 'Tipo de guia es requerido'
    }),
  agencyId: Joi.when('guideType', {
    is: 'AGENCY',
    then: uuidSchema.required().messages({
      'any.required': 'Agency ID es requerido para guias de agencia'
    }),
    otherwise: Joi.forbidden()
  }),
  licenseNumber: Joi.string()
    .max(50)
    .optional(),
  languages: Joi.array()
    .items(Joi.string().max(50))
    .min(1)
    .optional()
    .messages({
      'array.min': 'Debe especificar al menos un idioma'
    }),
  specialties: Joi.array()
    .items(Joi.string().max(100))
    .optional(),
  certifications: Joi.array()
    .items(Joi.object({
      name: Joi.string().max(100).required(),
      issuer: Joi.string().max(100).optional(),
      date: Joi.date().optional(),
      expiryDate: Joi.date().optional()
    }))
    .optional(),
  experience: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .optional()
    .messages({
      'number.min': 'Experiencia no puede ser negativa',
      'number.max': 'Experiencia maxima es 50 anos'
    }),
  bio: Joi.string()
    .max(1000)
    .optional(),
  profileImage: Joi.string()
    .uri()
    .optional()
});

const updateGuideSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .optional(),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .optional(),
  phone: Joi.string()
    .pattern(/^[+]?[\d\s-]{8,15}$/)
    .optional()
    .allow(''),
  licenseNumber: Joi.string()
    .max(50)
    .optional()
    .allow(''),
  languages: Joi.array()
    .items(Joi.string().max(50))
    .optional(),
  specialties: Joi.array()
    .items(Joi.string().max(100))
    .optional(),
  certifications: Joi.array()
    .items(Joi.object({
      name: Joi.string().max(100).required(),
      issuer: Joi.string().max(100).optional(),
      date: Joi.date().optional(),
      expiryDate: Joi.date().optional()
    }))
    .optional(),
  experience: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .optional(),
  bio: Joi.string()
    .max(1000)
    .optional()
    .allow(''),
  profileImage: Joi.string()
    .uri()
    .optional()
    .allow('', null),
  status: Joi.string()
    .valid('active', 'inactive', 'suspended')
    .optional(),
  availability: Joi.object({
    monday: Joi.boolean(),
    tuesday: Joi.boolean(),
    wednesday: Joi.boolean(),
    thursday: Joi.boolean(),
    friday: Joi.boolean(),
    saturday: Joi.boolean(),
    sunday: Joi.boolean()
  }).optional()
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

const updateGuideStatusSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive', 'suspended')
    .required()
    .messages({
      'any.only': 'Estado debe ser: active, inactive o suspended',
      'any.required': 'Estado es requerido'
    }),
  reason: Joi.string()
    .max(500)
    .optional()
});

const checkGuideAvailabilitySchema = Joi.object({
  date: Joi.date()
    .required()
    .messages({
      'any.required': 'Fecha es requerida'
    }),
  time: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  duration: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(120)
});

const guideFiltersSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive', 'suspended')
    .optional(),
  guideType: Joi.string()
    .valid('FREELANCE', 'AGENCY')
    .optional(),
  agencyId: uuidSchema.optional(),
  language: Joi.string().max(50).optional(),
  specialty: Joi.string().max(100).optional(),
  search: Joi.string().max(100).optional(),
  available: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc')
});

module.exports = {
  createGuideSchema,
  updateGuideSchema,
  updateGuideStatusSchema,
  checkGuideAvailabilitySchema,
  guideFiltersSchema
};
