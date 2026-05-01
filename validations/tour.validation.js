/**
 * Schemas de validacion para tours
 */

const Joi = require('joi');

const uuidSchema = Joi.string().uuid().messages({
  'string.guid': 'ID debe ser un UUID valido'
});

const createTourSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Nombre debe tener al menos 3 caracteres',
      'any.required': 'Nombre es requerido'
    }),
  description: Joi.string()
    .max(2000)
    .optional(),
  shortDescription: Joi.string()
    .max(300)
    .optional(),
  duration: Joi.number()
    .integer()
    .min(1)
    .max(1440) // 24 horas en minutos
    .optional()
    .messages({
      'number.min': 'Duracion minima es 1 minuto',
      'number.max': 'Duracion maxima es 24 horas'
    }),
  durationHours: Joi.number()
    .min(0.5)
    .max(24)
    .optional(),
  price: Joi.number()
    .min(0)
    .precision(2)
    .required()
    .messages({
      'number.min': 'Precio no puede ser negativo',
      'any.required': 'Precio es requerido'
    }),
  priceChildren: Joi.number()
    .min(0)
    .precision(2)
    .optional(),
  maxCapacity: Joi.number()
    .integer()
    .min(1)
    .max(500)
    .optional()
    .default(20)
    .messages({
      'number.min': 'Capacidad minima es 1 persona',
      'number.max': 'Capacidad maxima es 500 personas'
    }),
  minCapacity: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(1),
  categoryId: uuidSchema.optional(),
  difficulty: Joi.string()
    .valid('easy', 'moderate', 'challenging', 'difficult')
    .optional()
    .default('moderate'),
  languages: Joi.array()
    .items(Joi.string().max(50))
    .optional(),
  included: Joi.array()
    .items(Joi.string().max(200))
    .optional(),
  notIncluded: Joi.array()
    .items(Joi.string().max(200))
    .optional(),
  requirements: Joi.array()
    .items(Joi.string().max(200))
    .optional(),
  meetingPoint: Joi.string()
    .max(300)
    .optional(),
  meetingPointCoords: Joi.object({
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180)
  }).optional(),
  images: Joi.array()
    .items(Joi.string().uri())
    .optional(),
  status: Joi.string()
    .valid('active', 'inactive', 'draft')
    .optional()
    .default('draft'),
  isPublic: Joi.boolean().optional().default(false)
});

const updateTourSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .optional(),
  description: Joi.string()
    .max(2000)
    .optional()
    .allow(''),
  shortDescription: Joi.string()
    .max(300)
    .optional()
    .allow(''),
  duration: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .optional(),
  durationHours: Joi.number()
    .min(0.5)
    .max(24)
    .optional(),
  price: Joi.number()
    .min(0)
    .precision(2)
    .optional(),
  priceChildren: Joi.number()
    .min(0)
    .precision(2)
    .optional(),
  maxCapacity: Joi.number()
    .integer()
    .min(1)
    .max(500)
    .optional(),
  minCapacity: Joi.number()
    .integer()
    .min(1)
    .optional(),
  categoryId: uuidSchema.optional().allow(null),
  difficulty: Joi.string()
    .valid('easy', 'moderate', 'challenging', 'difficult')
    .optional(),
  languages: Joi.array()
    .items(Joi.string().max(50))
    .optional(),
  included: Joi.array()
    .items(Joi.string().max(200))
    .optional(),
  notIncluded: Joi.array()
    .items(Joi.string().max(200))
    .optional(),
  requirements: Joi.array()
    .items(Joi.string().max(200))
    .optional(),
  meetingPoint: Joi.string()
    .max(300)
    .optional()
    .allow(''),
  meetingPointCoords: Joi.object({
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180)
  }).optional().allow(null),
  images: Joi.array()
    .items(Joi.string().uri())
    .optional(),
  status: Joi.string()
    .valid('active', 'inactive', 'draft')
    .optional(),
  isPublic: Joi.boolean().optional()
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

const tourFiltersSchema = Joi.object({
  status: Joi.string()
    .valid('active', 'inactive', 'draft')
    .optional(),
  categoryId: uuidSchema.optional(),
  difficulty: Joi.string()
    .valid('easy', 'moderate', 'challenging', 'difficult')
    .optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  search: Joi.string().max(100).optional(),
  isPublic: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc')
});

const tourAvailabilitySchema = Joi.object({
  date: Joi.date().required().messages({
    'any.required': 'Fecha es requerida'
  }),
  time: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  touristsCount: Joi.number()
    .integer()
    .min(1)
    .max(200)
    .optional()
    .default(1)
});

module.exports = {
  createTourSchema,
  updateTourSchema,
  tourFiltersSchema,
  tourAvailabilitySchema
};
