/**
 * Schemas de validacion para emergency system
 */

const Joi = require('joi');

// Schema base para IDs UUID
const uuidSchema = Joi.string().uuid().messages({
  'string.guid': 'ID debe ser un UUID valido'
});

// Emergency Categories
const createEmergencyCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Nombre debe tener al menos 2 caracteres',
    'string.max': 'Nombre no puede exceder 100 caracteres',
    'any.required': 'Nombre es requerido'
  }),
  icon: Joi.string().max(10).optional().default('🚑'),
  description: Joi.string().max(500).optional().allow('', null),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().default('#EF4444').messages({
    'string.pattern.base': 'Color debe ser un codigo hexadecimal valido (ej: #EF4444)'
  }),
  severityLevel: Joi.number().integer().min(1).max(5).optional().default(1).messages({
    'number.min': 'Nivel de severidad debe ser entre 1 y 5',
    'number.max': 'Nivel de severidad debe ser entre 1 y 5'
  })
});

const updateEmergencyCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  icon: Joi.string().max(10).optional(),
  description: Joi.string().max(500).optional().allow('', null),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  severityLevel: Joi.number().integer().min(1).max(5).optional()
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

// Emergency Materials
const createEmergencyMaterialSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Nombre debe tener al menos 2 caracteres',
    'string.max': 'Nombre no puede exceder 100 caracteres',
    'any.required': 'Nombre es requerido'
  }),
  category: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Categoria debe tener al menos 2 caracteres',
    'string.max': 'Categoria no puede exceder 50 caracteres',
    'any.required': 'Categoria es requerida'
  }),
  description: Joi.string().max(500).optional().allow('', null),
  quantity: Joi.number().integer().min(0).optional().default(1),
  unit: Joi.string().max(20).optional().default('unidad'),
  isMandatory: Joi.boolean().optional().default(false),
  mandatory: Joi.boolean().optional(), // Alias para compatibilidad con frontend
  icon: Joi.string().max(10).optional(),
  notes: Joi.string().max(500).optional().allow('', null),
  items: Joi.array().items(Joi.string().max(200)).optional().default([]) // Items del material
});

const updateEmergencyMaterialSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  category: Joi.string().min(2).max(50).optional(),
  description: Joi.string().max(500).optional().allow('', null),
  quantity: Joi.number().integer().min(0).optional(),
  unit: Joi.string().max(20).optional(),
  isMandatory: Joi.boolean().optional(),
  mandatory: Joi.boolean().optional(), // Alias para compatibilidad con frontend
  icon: Joi.string().max(10).optional(),
  notes: Joi.string().max(500).optional().allow('', null),
  items: Joi.array().items(Joi.string().max(200)).optional() // Items del material
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

// Emergency Protocols
const protocolStepSchema = Joi.object({
  stepNumber: Joi.number().integer().min(1).optional().messages({
    'number.min': 'Numero de paso debe ser mayor a 0'
  }),
  title: Joi.string().min(3).max(200).required().messages({
    'string.min': 'Titulo debe tener al menos 3 caracteres',
    'string.max': 'Titulo no puede exceder 200 caracteres',
    'any.required': 'Titulo es requerido'
  }),
  description: Joi.string().max(1000).optional().allow('', null).messages({
    'string.max': 'Descripcion no puede exceder 1000 caracteres'
  }),
  isCritical: Joi.boolean().optional().default(false),
  estimatedDuration: Joi.number().integer().min(0).optional().allow(null)
});

const createProtocolSchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    'string.min': 'Titulo debe tener al menos 3 caracteres',
    'string.max': 'Titulo no puede exceder 200 caracteres',
    'any.required': 'Titulo es requerido'
  }),
  description: Joi.string().max(1000).optional().allow('', null).messages({
    'string.max': 'Descripcion no puede exceder 1000 caracteres'
  }),
  categoryId: uuidSchema.required().messages({
    'any.required': 'Category ID es requerido'
  }),
  category_id: uuidSchema.optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional().default('draft'),
  priority: Joi.string().valid('alta', 'media', 'baja').optional(),
  icon: Joi.string().max(10).optional(),
  content: Joi.object().optional(), // Permite campos adicionales como contacts, materials
  steps: Joi.array().items(protocolStepSchema).min(1).required().messages({
    'array.min': 'El protocolo debe tener al menos 1 paso',
    'any.required': 'Pasos del protocolo son requeridos'
  })
});

const updateProtocolSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  description: Joi.string().max(1000).optional().allow('', null),
  categoryId: uuidSchema.optional(),
  category_id: uuidSchema.optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
  priority: Joi.string().valid('alta', 'media', 'baja').optional(),
  icon: Joi.string().max(10).optional(),
  content: Joi.object().optional(),
  steps: Joi.array().items(protocolStepSchema).min(1).optional()
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

const updateProtocolStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'published', 'archived').required().messages({
    'any.only': 'Estado debe ser: draft, published o archived',
    'any.required': 'Estado es requerido'
  })
});

// Emergency Contact Types
const createContactTypeSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Nombre debe tener al menos 2 caracteres',
    'string.max': 'Nombre no puede exceder 50 caracteres',
    'any.required': 'Nombre es requerido'
  }),
  icon: Joi.string().max(10).optional(),
  description: Joi.string().max(200).optional().allow('', null),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().default('#6B7280').messages({
    'string.pattern.base': 'Color debe ser un codigo hexadecimal valido (ej: #6B7280)'
  }),
  priority: Joi.number().integer().min(1).max(999).optional().messages({
    'number.min': 'Prioridad debe ser entre 1 y 999',
    'number.max': 'Prioridad debe ser entre 1 y 999'
  })
});

const updateContactTypeSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  icon: Joi.string().max(10).optional(),
  description: Joi.string().max(200).optional().allow('', null),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().messages({
    'string.pattern.base': 'Color debe ser un codigo hexadecimal valido (ej: #6B7280)'
  }),
  priority: Joi.number().integer().min(1).max(999).optional().messages({
    'number.min': 'Prioridad debe ser entre 1 y 999',
    'number.max': 'Prioridad debe ser entre 1 y 999'
  })
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

// Emergency Reports
const createEmergencySchema = Joi.object({
  activeTourId: uuidSchema.required().messages({
    'any.required': 'Active Tour ID es requerido'
  }),
  active_tour_id: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  category_id: uuidSchema.optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required().messages({
    'any.only': 'Severidad debe ser: low, medium, high o critical',
    'any.required': 'Severidad es requerida'
  }),
  description: Joi.string().min(10).max(1000).required().messages({
    'string.min': 'Descripcion debe tener al menos 10 caracteres',
    'string.max': 'Descripcion no puede exceder 1000 caracteres',
    'any.required': 'Descripcion es requerida'
  }),
  location: Joi.string().max(200).optional().allow('', null),
  affectedPeople: Joi.number().integer().min(0).optional().default(0),
  affected_people: Joi.number().integer().min(0).optional()
});

const updateEmergencyStatusSchema = Joi.object({
  status: Joi.string().valid('reported', 'in_progress', 'resolved', 'cancelled').required().messages({
    'any.only': 'Estado debe ser: reported, in_progress, resolved o cancelled',
    'any.required': 'Estado es requerido'
  }),
  notes: Joi.string().max(500).optional().allow('', null)
});

const addEmergencyActionSchema = Joi.object({
  action: Joi.string().min(10).max(500).required().messages({
    'string.min': 'Accion debe tener al menos 10 caracteres',
    'string.max': 'Accion no puede exceder 500 caracteres',
    'any.required': 'Accion es requerida'
  }),
  takenBy: Joi.string().max(100).optional(),
  taken_by: Joi.string().max(100).optional()
});

module.exports = {
  // Categories
  createEmergencyCategorySchema,
  updateEmergencyCategorySchema,

  // Materials
  createEmergencyMaterialSchema,
  updateEmergencyMaterialSchema,

  // Protocols
  createProtocolSchema,
  updateProtocolSchema,
  updateProtocolStatusSchema,

  // Contact Types
  createContactTypeSchema,
  updateContactTypeSchema,

  // Emergencies
  createEmergencySchema,
  updateEmergencyStatusSchema,
  addEmergencyActionSchema
};
