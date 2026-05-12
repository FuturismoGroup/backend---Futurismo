/**
 * Schemas de validacion para reservaciones
 */

const Joi = require('joi');

// Schema base para IDs UUID
const uuidSchema = Joi.string().uuid().messages({
  'string.guid': 'ID debe ser un UUID valido'
});

const groupSchema = Joi.object({
  representativeName: Joi.string().max(200).required().messages({
    'any.required': 'Nombre del representante es requerido',
    'string.max': 'Nombre del representante no puede exceder 200 caracteres'
  }),
  representativePhone: Joi.string().max(20).required().messages({
    'any.required': 'Telefono del representante es requerido'
  }),
  adultsCount: Joi.number().integer().min(0).required().messages({
    'any.required': 'Numero de adultos es requerido',
    'number.min': 'Numero de adultos no puede ser negativo'
  }),
  childrenCount: Joi.number().integer().min(0).default(0).messages({
    'number.min': 'Numero de ninos no puede ser negativo'
  })
});

const createReservationSchema = Joi.object({
  tourId: uuidSchema.required().messages({
    'any.required': 'Tour ID es requerido'
  }),
  clientId: uuidSchema.optional(),
  agencyId: uuidSchema.optional(),
  guideId: uuidSchema.optional(),
  // Fecha como string YYYY-MM-DD para evitar problemas de timezone
  // Joi.date() convierte a objeto Date causando desfase
  date: Joi.alternatives()
    .try(
      Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
      Joi.string().isoDate(),
      Joi.date()
    )
    .required()
    .messages({
      'any.required': 'Fecha es requerida',
      'alternatives.match': 'Fecha debe ser valida'
    }),
  time: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'Hora debe estar en formato HH:mm'
    }),
  groups: Joi.array().items(groupSchema).min(1).required().messages({
    'any.required': 'Debe incluir al menos un grupo',
    'array.min': 'Debe incluir al menos un grupo'
  }),
  adults: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.min': 'Debe haber al menos 1 adulto',
      'number.max': 'Maximo 100 adultos por reserva'
    }),
  children: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .optional()
    .default(0)
    .messages({
      'number.min': 'Numero de ninos no puede ser negativo',
      'number.max': 'Maximo 100 ninos por reserva'
    }),
  clientName: Joi.string()
    .max(100)
    .optional()
    .allow('', null),
  clientPhone: Joi.string()
    .max(20)
    .optional()
    .allow('', null),
  clientEmail: Joi.string()
    .email()
    .optional()
    .allow('', null)
    .messages({
      'string.email': 'Email debe ser valido'
    }),
  notes: Joi.string()
    .max(1000)
    .optional()
    .allow('', null),
  specialRequirements: Joi.string()
    .max(500)
    .optional()
    .allow('', null),
  pickupLocation: Joi.string()
    .max(200)
    .optional()
    .allow('', null),
  dropoffLocation: Joi.string()
    .max(200)
    .optional()
    .allow('', null),
  // paymentMethod se valida dinamicamente en el controlador contra la BD
  paymentMethod: Joi.string()
    .optional()
    .allow('', null),
  billingName: Joi.string()
    .max(200)
    .optional()
    .allow('', null),
  billingDocument: Joi.string()
    .max(50)
    .optional()
    .allow('', null),
  billingAddress: Joi.string()
    .max(300)
    .optional()
    .allow('', null),
  totalPrice: Joi.number()
    .min(0)
    .precision(2)
    .optional()
});

const updateReservationSchema = Joi.object({
  groups: Joi.array().items(groupSchema).min(1).optional(),
  // Fecha como string YYYY-MM-DD para evitar problemas de timezone
  date: Joi.alternatives()
    .try(
      Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
      Joi.string().isoDate(),
      Joi.date()
    )
    .optional(),
  time: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  adults: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional(),
  children: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .optional(),
  guideId: uuidSchema.optional().allow(null),
  driverId: uuidSchema.optional().allow(null),
  vehicleId: uuidSchema.optional().allow(null),
  notes: Joi.string()
    .max(1000)
    .optional()
    .allow(''),
  specialRequirements: Joi.string()
    .max(500)
    .optional()
    .allow(''),
  pickupLocation: Joi.string()
    .max(200)
    .optional()
    .allow(''),
  dropoffLocation: Joi.string()
    .max(200)
    .optional()
    .allow(''),
  // paymentMethod se valida dinamicamente en el controlador contra la BD
  paymentMethod: Joi.string()
    .optional()
    .allow('', null),
  totalPrice: Joi.number()
    .min(0)
    .precision(2)
    .optional()
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')
    .required()
    .messages({
      'any.only': 'Estado debe ser: pending, confirmed, in_progress, completed, cancelled o no_show',
      'any.required': 'Estado es requerido'
    }),
  reason: Joi.string().max(500).optional(),
  // El frontend envía `cancellationReason` (clave usada por el controller).
  // stripUnknown la descartaba antes de llegar al controller, por eso fallaba
  // la cancelación. Se acepta explícitamente.
  cancellationReason: Joi.string().max(500).optional().allow('', null)
});

const assignGuideSchema = Joi.object({
  guideId: uuidSchema.required().messages({
    'any.required': 'Guide ID es requerido'
  })
});

const cancelReservationSchema = Joi.object({
  reason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'Razon de cancelacion debe tener al menos 10 caracteres',
      'any.required': 'Razon de cancelacion es requerida'
    })
});

const checkAvailabilitySchema = Joi.object({
  serviceType: Joi.string().optional(),
  tourId: uuidSchema.optional(),
  date: Joi.date()
    .required()
    .messages({
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

const reservationFiltersSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')
    .optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  tourId: uuidSchema.optional(),
  agencyId: uuidSchema.optional(),
  guideId: uuidSchema.optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
  createReservationSchema,
  updateReservationSchema,
  updateStatusSchema,
  assignGuideSchema,
  cancelReservationSchema,
  checkAvailabilitySchema,
  reservationFiltersSchema
};
