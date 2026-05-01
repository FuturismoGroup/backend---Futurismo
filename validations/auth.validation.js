/**
 * Schemas de validacion para autenticacion
 */

const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email debe ser un correo valido',
      'any.required': 'Email es requerido'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password debe tener al menos 6 caracteres',
      'any.required': 'Password es requerido'
    })
});

const registerSchema = Joi.object({
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
  role: Joi.string()
    .valid('client', 'agency', 'guide')
    .optional()
    .default('client')
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Password actual es requerido'
    }),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Nuevo password debe tener al menos 8 caracteres',
      'string.pattern.base': 'Nuevo password debe contener mayusculas, minusculas y numeros',
      'any.required': 'Nuevo password es requerido'
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Las contraseñas no coinciden',
      'any.required': 'Confirmación de password es requerida'
    })
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email debe ser un correo valido',
      'any.required': 'Email es requerido'
    })
});

module.exports = {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema
};
