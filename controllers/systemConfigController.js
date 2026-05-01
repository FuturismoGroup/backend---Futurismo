// Controller de System Config
// Fuente: 04_apis_lista.md líneas 4362-4918
// API-061 a API-070: Configuration

const prisma = require('../config/db');

/**
 * API-061: GetSystemConfig
 * GET /api/config/system
 * Soporta ELM-382 (GeneralSettings)
 * Linea 04_apis_lista: 4362
 */
const getSystemConfig = async (req, res) => {
  try {
    let config = await prisma.system_config.findFirst();

    if (!config) {
      // Valores por defecto si no existe registro en BD
      config = {
        company_name: 'Futurismo Tours',
        company_logo: null,
        company_phone: '',
        company_email: '',
        company_website: '',
        company_address: '',
        company_ruc: '',
        account_number: '',
        account_cci: '',
        admin_personal_phone: '',
        admin_office_phone: '',
        admin_emergency_phone: '',
        admin_email: '',
        timezone: 'America/Lima',
        currency: 'PEN',
        language: 'es',
        date_format: 'DD/MM/YYYY',
        time_format: 'HH:mm',
        theme: { primaryColor: '#1976d2', secondaryColor: '#dc004e' }
      };
    }

    res.json({
      companyName: config.company_name,
      companyLogo: config.company_logo,
      companyPhone: config.company_phone,
      companyEmail: config.company_email,
      companyWebsite: config.company_website || '',
      companyAddress: config.company_address,
      companyRuc: config.company_ruc || '',
      accountNumber: config.account_number || '',
      accountCCI: config.account_cci || '',
      adminPersonalPhone: config.admin_personal_phone || '',
      adminOfficePhone: config.admin_office_phone || '',
      adminEmergencyPhone: config.admin_emergency_phone || '',
      adminEmail: config.admin_email || '',
      timezone: config.timezone,
      currency: config.currency,
      language: config.language,
      dateFormat: config.date_format,
      timeFormat: config.time_format,
      theme: config.theme
    });
  } catch (error) {
    console.error('Error en getSystemConfig:', error);
    res.status(500).json({ error: 'Error al obtener configuracion del sistema' });
  }
};

/**
 * API-062: UpdateSystemConfig
 * PUT /api/config/system
 * Soporta ELM-382 (GeneralSettings)
 * Linea 04_apis_lista: 4420
 */
const updateSystemConfig = async (req, res) => {
  try {
    const {
      companyName,
      companyLogo,
      companyPhone,
      companyEmail,
      companyWebsite,
      companyAddress,
      companyRuc,
      accountNumber,
      accountCCI,
      adminPersonalPhone,
      adminOfficePhone,
      adminEmergencyPhone,
      adminEmail,
      timezone,
      currency,
      language,
      dateFormat,
      timeFormat,
      theme
    } = req.body;

    // Validar email si presente
    if (companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
      return res.status(400).json({ error: 'Formato de email invalido' });
    }

    // Validar URL de website si presente
    if (companyWebsite && companyWebsite.trim()) {
      try {
        new URL(companyWebsite);
      } catch {
        return res.status(400).json({ error: 'Formato de URL de sitio web invalido' });
      }
    }

    const updateData = {};
    if (companyName !== undefined) updateData.company_name = companyName;
    if (companyLogo !== undefined) updateData.company_logo = companyLogo;
    if (companyPhone !== undefined) updateData.company_phone = companyPhone;
    if (companyEmail !== undefined) updateData.company_email = companyEmail;
    if (companyWebsite !== undefined) updateData.company_website = companyWebsite;
    if (companyAddress !== undefined) updateData.company_address = companyAddress;
    if (companyRuc !== undefined) updateData.company_ruc = companyRuc;
    if (accountNumber !== undefined) updateData.account_number = accountNumber;
    if (accountCCI !== undefined) updateData.account_cci = accountCCI;
    if (adminPersonalPhone !== undefined) updateData.admin_personal_phone = adminPersonalPhone;
    if (adminOfficePhone !== undefined) updateData.admin_office_phone = adminOfficePhone;
    if (adminEmergencyPhone !== undefined) updateData.admin_emergency_phone = adminEmergencyPhone;
    if (adminEmail !== undefined) updateData.admin_email = adminEmail;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (currency !== undefined) updateData.currency = currency;
    if (language !== undefined) updateData.language = language;
    if (dateFormat !== undefined) updateData.date_format = dateFormat;
    if (timeFormat !== undefined) updateData.time_format = timeFormat;
    if (theme !== undefined) updateData.theme = theme;
    updateData.updated_at = new Date();

    let config = await prisma.system_config.findFirst();

    if (config) {
      config = await prisma.system_config.update({
        where: { id: config.id },
        data: updateData
      });
    } else {
      config = await prisma.system_config.create({
        data: updateData
      });
    }

    res.json({
      companyName: config.company_name,
      companyLogo: config.company_logo,
      companyPhone: config.company_phone,
      companyEmail: config.company_email,
      companyWebsite: config.company_website || '',
      companyAddress: config.company_address,
      companyRuc: config.company_ruc || '',
      accountNumber: config.account_number || '',
      accountCCI: config.account_cci || '',
      adminPersonalPhone: config.admin_personal_phone || '',
      adminOfficePhone: config.admin_office_phone || '',
      adminEmergencyPhone: config.admin_emergency_phone || '',
      adminEmail: config.admin_email || '',
      timezone: config.timezone,
      currency: config.currency,
      language: config.language,
      dateFormat: config.date_format,
      timeFormat: config.time_format,
      theme: config.theme,
      updatedAt: config.updated_at
    });
  } catch (error) {
    console.error('Error en updateSystemConfig:', error);
    res.status(500).json({ error: 'Error al actualizar configuracion del sistema' });
  }
};

/**
 * API-063: GetReservationConfig
 * GET /api/config/reservations
 * Línea 04_apis_lista: 4478
 */
const getReservationConfig = async (req, res) => {
  try {
    let config = await prisma.reservation_config.findFirst();

    if (!config) {
      config = {
        min_advance_hours: 24,
        max_advance_days: 90,
        default_start_time: '08:00',
        default_end_time: '18:00',
        time_slot_interval: 30,
        allow_same_day_booking: false,
        require_confirmation: true,
        auto_confirm_enabled: false,
        cancellation_policy: { hoursBeforeFree: 48, penaltyPercentage: 50 },
        overbooking_allowed: false
      };
    }

    res.json({
      minAdvanceHours: config.min_advance_hours,
      maxAdvanceDays: config.max_advance_days,
      defaultStartTime: config.default_start_time,
      defaultEndTime: config.default_end_time,
      timeSlotInterval: config.time_slot_interval,
      allowSameDayBooking: config.allow_same_day_booking,
      requireConfirmation: config.require_confirmation,
      autoConfirmEnabled: config.auto_confirm_enabled,
      cancellationPolicy: config.cancellation_policy,
      overbookingAllowed: config.overbooking_allowed
    });
  } catch (error) {
    console.error('Error en getReservationConfig:', error);
    res.status(500).json({ error: 'Error al obtener configuración de reservas' });
  }
};

/**
 * API-064: UpdateReservationConfig
 * PUT /api/config/reservations
 * Línea 04_apis_lista: 4533
 */
const updateReservationConfig = async (req, res) => {
  try {
    const {
      minAdvanceHours,
      maxAdvanceDays,
      defaultStartTime,
      defaultEndTime,
      timeSlotInterval,
      allowSameDayBooking,
      requireConfirmation,
      autoConfirmEnabled,
      cancellationPolicy,
      overbookingAllowed
    } = req.body;

    // Validaciones
    if (minAdvanceHours !== undefined && minAdvanceHours < 0) {
      return res.status(400).json({ error: 'minAdvanceHours debe ser >= 0' });
    }
    if (maxAdvanceDays !== undefined && maxAdvanceDays <= 0) {
      return res.status(400).json({ error: 'maxAdvanceDays debe ser > 0' });
    }
    if (timeSlotInterval !== undefined && (timeSlotInterval < 15 || timeSlotInterval > 120)) {
      return res.status(400).json({ error: 'timeSlotInterval debe estar entre 15 y 120' });
    }

    const updateData = {};
    if (minAdvanceHours !== undefined) updateData.min_advance_hours = minAdvanceHours;
    if (maxAdvanceDays !== undefined) updateData.max_advance_days = maxAdvanceDays;
    if (defaultStartTime !== undefined) updateData.default_start_time = defaultStartTime;
    if (defaultEndTime !== undefined) updateData.default_end_time = defaultEndTime;
    if (timeSlotInterval !== undefined) updateData.time_slot_interval = timeSlotInterval;
    if (allowSameDayBooking !== undefined) updateData.allow_same_day_booking = allowSameDayBooking;
    if (requireConfirmation !== undefined) updateData.require_confirmation = requireConfirmation;
    if (autoConfirmEnabled !== undefined) updateData.auto_confirm_enabled = autoConfirmEnabled;
    if (cancellationPolicy !== undefined) updateData.cancellation_policy = cancellationPolicy;
    if (overbookingAllowed !== undefined) updateData.overbooking_allowed = overbookingAllowed;
    updateData.updated_at = new Date();

    let config = await prisma.reservation_config.findFirst();

    if (config) {
      config = await prisma.reservation_config.update({
        where: { id: config.id },
        data: updateData
      });
    } else {
      config = await prisma.reservation_config.create({
        data: updateData
      });
    }

    res.json({
      minAdvanceHours: config.min_advance_hours,
      maxAdvanceDays: config.max_advance_days,
      defaultStartTime: config.default_start_time,
      defaultEndTime: config.default_end_time,
      timeSlotInterval: config.time_slot_interval,
      allowSameDayBooking: config.allow_same_day_booking,
      requireConfirmation: config.require_confirmation,
      autoConfirmEnabled: config.auto_confirm_enabled,
      cancellationPolicy: config.cancellation_policy,
      overbookingAllowed: config.overbooking_allowed,
      updatedAt: config.updated_at
    });
  } catch (error) {
    console.error('Error en updateReservationConfig:', error);
    res.status(500).json({ error: 'Error al actualizar configuración de reservas' });
  }
};

/**
 * API-065: UpdatePointsConfig
 * PUT /api/config/points
 * Línea 04_apis_lista: 4591
 */
const updatePointsConfig = async (req, res) => {
  try {
    const {
      pointsPerSol,
      levels,
      expirationMonths
    } = req.body;

    // Validaciones
    if (pointsPerSol !== undefined && pointsPerSol <= 0) {
      return res.status(400).json({ error: 'pointsPerSol debe ser > 0' });
    }
    if (levels !== undefined) {
      if (!Array.isArray(levels) || levels.length !== 4) {
        return res.status(400).json({ error: 'levels debe tener exactamente 4 niveles' });
      }
      const validNames = ['Bronze', 'Silver', 'Gold', 'Platinum'];
      for (let i = 0; i < levels.length; i++) {
        const lvl = levels[i];
        if (!lvl.name || !validNames.includes(lvl.name)) {
          return res.status(400).json({ error: `Nivel ${i + 1} debe tener name: ${validNames.join(', ')}` });
        }
        if (typeof lvl.minPoints !== 'number' || lvl.minPoints < 0) {
          return res.status(400).json({ error: `Nivel ${lvl.name}: minPoints debe ser un número >= 0` });
        }
      }
      if (levels[0].name !== 'Bronze' || levels[0].minPoints !== 0) {
        return res.status(400).json({ error: 'El primer nivel debe ser Bronze con minPoints = 0' });
      }
      for (let i = 1; i < levels.length; i++) {
        if (levels[i].minPoints <= levels[i - 1].minPoints) {
          return res.status(400).json({ error: 'Los minPoints deben ser ascendentes entre niveles' });
        }
      }
    }
    if (expirationMonths !== undefined && expirationMonths < 0) {
      return res.status(400).json({ error: 'expirationMonths debe ser >= 0' });
    }

    const updateData = {};
    if (pointsPerSol !== undefined) updateData.points_per_sol = pointsPerSol;
    if (levels !== undefined) updateData.levels = levels;
    if (expirationMonths !== undefined) updateData.expiration_months = expirationMonths;
    updateData.updated_at = new Date();

    let config = await prisma.points_config.findFirst();

    if (config) {
      config = await prisma.points_config.update({
        where: { id: config.id },
        data: updateData
      });
    } else {
      config = await prisma.points_config.create({
        data: updateData
      });
    }

    res.json({
      pointsPerSol: config.points_per_sol,
      levels: config.levels,
      expirationMonths: config.expiration_months,
      updatedAt: config.updated_at
    });
  } catch (error) {
    console.error('Error en updatePointsConfig:', error);
    res.status(500).json({ error: 'Error al actualizar configuración de puntos' });
  }
};

/**
 * API-066: GetNotificationConfig
 * GET /api/config/notifications
 * Línea 04_apis_lista: 4644
 */
const getNotificationConfig = async (req, res) => {
  try {
    let config = await prisma.notification_config.findFirst();

    if (!config) {
      // Crear configuracion por defecto si no existe
      config = await prisma.notification_config.create({
        data: {
          email_enabled: true,
          sms_enabled: false,
          push_enabled: true,
          whatsapp_enabled: false,
          email_templates: {},
          reminder_hours_before: [24, 2],
          notify_on_new_reservation: true,
          notify_on_status_change: true,
          notify_on_new_rating: true
        }
      });
    }

    res.json({
      emailEnabled: config.email_enabled,
      smsEnabled: config.sms_enabled,
      pushEnabled: config.push_enabled,
      whatsappEnabled: config.whatsapp_enabled,
      emailTemplates: config.email_templates,
      reminderHoursBefore: config.reminder_hours_before,
      notifyOnNewReservation: config.notify_on_new_reservation,
      notifyOnStatusChange: config.notify_on_status_change,
      notifyOnNewRating: config.notify_on_new_rating
    });
  } catch (error) {
    console.error('Error en getNotificationConfig:', error);
    res.status(500).json({ error: 'Error al obtener configuración de notificaciones' });
  }
};

/**
 * API-067: UpdateNotificationConfig
 * PUT /api/config/notifications
 * Línea 04_apis_lista: 4696
 */
const updateNotificationConfig = async (req, res) => {
  try {
    const {
      emailEnabled,
      smsEnabled,
      pushEnabled,
      whatsappEnabled,
      emailTemplates,
      reminderHoursBefore,
      notifyOnNewReservation,
      notifyOnStatusChange,
      notifyOnNewRating
    } = req.body;

    // Validar reminderHoursBefore
    if (reminderHoursBefore !== undefined) {
      if (!Array.isArray(reminderHoursBefore)) {
        return res.status(400).json({ error: 'reminderHoursBefore debe ser array' });
      }
      if (reminderHoursBefore.some(h => h < 1)) {
        return res.status(400).json({ error: 'reminderHoursBefore elementos deben ser >= 1' });
      }
    }

    const updateData = {};
    if (emailEnabled !== undefined) updateData.email_enabled = emailEnabled;
    if (smsEnabled !== undefined) updateData.sms_enabled = smsEnabled;
    if (pushEnabled !== undefined) updateData.push_enabled = pushEnabled;
    if (whatsappEnabled !== undefined) updateData.whatsapp_enabled = whatsappEnabled;
    if (emailTemplates !== undefined) updateData.email_templates = emailTemplates;
    if (reminderHoursBefore !== undefined) updateData.reminder_hours_before = reminderHoursBefore;
    if (notifyOnNewReservation !== undefined) updateData.notify_on_new_reservation = notifyOnNewReservation;
    if (notifyOnStatusChange !== undefined) updateData.notify_on_status_change = notifyOnStatusChange;
    if (notifyOnNewRating !== undefined) updateData.notify_on_new_rating = notifyOnNewRating;
    updateData.updated_at = new Date();

    let config = await prisma.notification_config.findFirst();

    if (config) {
      config = await prisma.notification_config.update({
        where: { id: config.id },
        data: updateData
      });
    } else {
      config = await prisma.notification_config.create({
        data: updateData
      });
    }

    res.json({
      emailEnabled: config.email_enabled,
      smsEnabled: config.sms_enabled,
      pushEnabled: config.push_enabled,
      whatsappEnabled: config.whatsapp_enabled,
      emailTemplates: config.email_templates,
      reminderHoursBefore: config.reminder_hours_before,
      notifyOnNewReservation: config.notify_on_new_reservation,
      notifyOnStatusChange: config.notify_on_status_change,
      notifyOnNewRating: config.notify_on_new_rating,
      updatedAt: config.updated_at
    });
  } catch (error) {
    console.error('Error en updateNotificationConfig:', error);
    res.status(500).json({ error: 'Error al actualizar configuración de notificaciones' });
  }
};

/**
 * API-068: ListCategories
 * GET /api/config/categories
 * Línea 04_apis_lista: 4750
 */
const listCategories = async (req, res) => {
  try {
    const { active = 'true' } = req.query;

    const where = {};
    if (active === 'true') {
      where.active = true;
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: {
          select: { tours: true }
        }
      },
      orderBy: { order: 'asc' }
    });

    const data = categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      color: c.color,
      order: c.order,
      active: c.active,
      tourCount: c._count.tours
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error en listCategories:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

/**
 * API-069: CreateCategory
 * POST /api/config/categories
 * Línea 04_apis_lista: 4807
 */
const createCategory = async (req, res) => {
  try {
    const { name, description, icon, color, order } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name es requerido' });
    }

    // Verificar nombre único
    const existing = await prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una categoría con este nombre' });
    }

    // Calcular orden si no se proporciona
    let categoryOrder = order;
    if (categoryOrder === undefined) {
      const maxOrder = await prisma.category.aggregate({
        _max: { order: true }
      });
      categoryOrder = (maxOrder._max.order || 0) + 1;
    }

    const category = await prisma.category.create({
      data: {
        name,
        description,
        icon,
        color,
        order: categoryOrder,
        active: true
      }
    });

    res.status(201).json({
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      order: category.order,
      active: true,
      createdAt: category.created_at
    });
  } catch (error) {
    console.error('Error en createCategory:', error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

/**
 * API-070: UpdateCategory
 * PUT /api/config/categories/:id
 * Línea 04_apis_lista: 4861
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, order, active } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de categoría inválido' });
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    // Verificar nombre único si se cambia
    if (name && name !== existing.name) {
      const nameExists = await prisma.category.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          id: { not: id }
        }
      });
      if (nameExists) {
        return res.status(409).json({ error: 'Ya existe una categoría con este nombre' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (order !== undefined) updateData.order = order;
    if (active !== undefined) updateData.active = active;
    updateData.updated_at = new Date();

    const category = await prisma.category.update({
      where: { id },
      data: updateData
    });

    res.json({
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      order: category.order,
      active: category.active,
      updatedAt: category.updated_at
    });
  } catch (error) {
    console.error('Error en updateCategory:', error);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
};

/**
 * FLW-045: GetToursConfig
 * GET /api/config/tours
 * Soporta ELM-387 (ToursSettings)
 * Obtiene configuracion de tours usando la tabla settings con category='tours'
 */
const getToursConfig = async (req, res) => {
  try {
    // Buscar configuracion de tours en la tabla settings
    const toursSettings = await prisma.settings.findMany({
      where: { category: 'tours' }
    });

    // Si no hay configuracion, devolver valores por defecto
    if (toursSettings.length === 0) {
      const defaultConfig = {
        maxCapacityPerTour: 30,
        defaultDuration: 240,
        minAdvanceBooking: 24,
        maxAdvanceBooking: 90,
        cancellationPolicy: 48,
        workingHours: { start: '08:00', end: '18:00' },
        priceRanges: {
          budget: { min: 50, max: 150 },
          standard: { min: 150, max: 300 },
          premium: { min: 300, max: 500 },
          luxury: { min: 500, max: 1000 }
        },
        allowPartialPayments: false,
        requireGuideAssignment: true,
        autoAssignGuides: false
      };
      return res.json(defaultConfig);
    }

    // Convertir array de settings a objeto
    const config = {};
    toursSettings.forEach(setting => {
      config[setting.key] = setting.value;
    });

    res.json(config);
  } catch (error) {
    console.error('Error en getToursConfig:', error);
    res.status(500).json({ error: 'Error al obtener configuracion de tours' });
  }
};

/**
 * FLW-045: UpdateToursConfig
 * PUT /api/config/tours
 * Soporta ELM-387 (ToursSettings)
 * Actualiza configuracion de tours usando la tabla settings con category='tours'
 */
const updateToursConfig = async (req, res) => {
  try {
    const {
      maxCapacityPerTour,
      defaultDuration,
      minAdvanceBooking,
      maxAdvanceBooking,
      cancellationPolicy,
      workingHours,
      priceRanges,
      allowPartialPayments,
      requireGuideAssignment,
      autoAssignGuides
    } = req.body;

    // Validaciones
    if (maxCapacityPerTour !== undefined && (maxCapacityPerTour < 1 || maxCapacityPerTour > 100)) {
      return res.status(400).json({ error: 'maxCapacityPerTour debe estar entre 1 y 100' });
    }
    if (defaultDuration !== undefined && defaultDuration < 30) {
      return res.status(400).json({ error: 'defaultDuration debe ser al menos 30 minutos' });
    }
    if (minAdvanceBooking !== undefined && minAdvanceBooking < 0) {
      return res.status(400).json({ error: 'minAdvanceBooking debe ser >= 0' });
    }
    if (maxAdvanceBooking !== undefined && maxAdvanceBooking < minAdvanceBooking) {
      return res.status(400).json({ error: 'maxAdvanceBooking debe ser >= minAdvanceBooking' });
    }

    const userId = req.user?.id || null;
    const now = new Date();

    // Mapeo de campos a guardar en settings
    const fieldsToSave = {
      maxCapacityPerTour,
      defaultDuration,
      minAdvanceBooking,
      maxAdvanceBooking,
      cancellationPolicy,
      workingHours,
      priceRanges,
      allowPartialPayments,
      requireGuideAssignment,
      autoAssignGuides
    };

    // Upsert cada campo en la tabla settings
    for (const [key, value] of Object.entries(fieldsToSave)) {
      if (value !== undefined) {
        const existing = await prisma.settings.findFirst({
          where: { key, category: 'tours' }
        });

        if (existing) {
          await prisma.settings.update({
            where: { id: existing.id },
            data: { value, updated_by: userId, updated_at: now }
          });
        } else {
          await prisma.settings.create({
            data: {
              key,
              value,
              category: 'tours',
              description: `Configuracion de tours: ${key}`,
              is_public: false,
              updated_by: userId,
              updated_at: now
            }
          });
        }
      }
    }

    // Devolver la configuracion actualizada
    const toursSettings = await prisma.settings.findMany({
      where: { category: 'tours' }
    });

    const config = {};
    toursSettings.forEach(setting => {
      config[setting.key] = setting.value;
    });

    res.json({ ...config, updatedAt: now });
  } catch (error) {
    console.error('Error en updateToursConfig:', error);
    res.status(500).json({ error: 'Error al actualizar configuracion de tours' });
  }
};

/**
 * FLW-044: CRUD ServiceTypes (Categorías de Tours/Servicios)
 * GET /api/config/service-types
 * Tabla: tour_categories (unificada)
 * Soporta ELM-386 (ServiceTypesSettings)
 */
const listServiceTypes = async (req, res) => {
  try {
    const types = await prisma.tour_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    const serviceTypes = types.map(t => ({
      value: t.code,
      label: t.name,
      description: t.description,
      color: t.color
    }));

    res.json({ success: true, data: { serviceTypes } });
  } catch (error) {
    console.error('Error en listServiceTypes:', error);
    res.status(500).json({ success: false, error: 'Error al obtener tipos de servicio' });
  }
};

/**
 * POST /api/config/service-types
 */
const createServiceType = async (req, res) => {
  try {
    const { value, label, description, color } = req.body;

    if (!value || !label) {
      return res.status(400).json({ success: false, error: 'value y label son requeridos' });
    }

    // Verificar code unico
    const existing = await prisma.tour_categories.findFirst({
      where: { code: value }
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Ya existe un tipo con este valor' });
    }

    const type = await prisma.tour_categories.create({
      data: {
        code: value,
        name: label,
        description: description || null,
        color: color || '#6B7280',
        is_active: true
      }
    });

    res.status(201).json({
      success: true,
      data: {
        value: type.code,
        label: type.name,
        description: type.description,
        color: type.color
      }
    });
  } catch (error) {
    console.error('Error en createServiceType:', error);
    res.status(500).json({ success: false, error: 'Error al crear tipo de servicio' });
  }
};

/**
 * PUT /api/config/service-types/:value
 */
const updateServiceType = async (req, res) => {
  try {
    const { value } = req.params;
    const { label, description, color } = req.body;

    const existing = await prisma.tour_categories.findFirst({
      where: { code: value }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Tipo de servicio no encontrado' });
    }

    const updateData = {};
    if (label !== undefined) updateData.name = label;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;

    const type = await prisma.tour_categories.update({
      where: { id: existing.id },
      data: updateData
    });

    res.json({
      success: true,
      data: {
        value: type.code,
        label: type.name,
        description: type.description,
        color: type.color
      }
    });
  } catch (error) {
    console.error('Error en updateServiceType:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar tipo de servicio' });
  }
};

/**
 * DELETE /api/config/service-types/:value
 */
const deleteServiceType = async (req, res) => {
  try {
    const { value } = req.params;

    const existing = await prisma.tour_categories.findFirst({
      where: { code: value }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Tipo de servicio no encontrado' });
    }

    await prisma.tour_categories.delete({
      where: { id: existing.id }
    });

    res.json({ success: true, message: 'Tipo de servicio eliminado' });
  } catch (error) {
    console.error('Error en deleteServiceType:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar tipo de servicio' });
  }
};

module.exports = {
  getSystemConfig,
  updateSystemConfig,
  getReservationConfig,
  updateReservationConfig,
  updatePointsConfig,
  getNotificationConfig,
  updateNotificationConfig,
  getToursConfig,
  updateToursConfig,
  listCategories,
  createCategory,
  updateCategory,
  listServiceTypes,
  createServiceType,
  updateServiceType,
  deleteServiceType
};
