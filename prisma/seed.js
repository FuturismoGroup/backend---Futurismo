// =============================================================================
// SEEDER PRISMA - Futurismo App (PRODUCCIÓN)
// =============================================================================
// Carga ÚNICAMENTE la información indispensable para que el aplicativo arranque
// y opere correctamente en producción. Todas las demás tablas quedan vacías;
// los datos de negocio se generan desde el panel administrativo.
//
// CONTENIDO MÍNIMO:
//   1. RBAC: roles, permissions, role_permissions
//   2. Usuario administrador inicial (1)
//   3. Catálogos no editables: payment_methods, evaluation_criteria,
//      recommendation_options
//   4. Catálogos esperados por la UI: languages
//   5. Configuración del sistema: system_config, notification_config,
//      reservation_config, points_config
//   6. Documentos legales: terms_and_conditions
//
// ⚠️  IMPORTANTE: Cambiar la contraseña del admin inmediatamente después del
//     primer login en producción.
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Contraseña inicial del admin — CAMBIAR DESPUÉS DEL PRIMER LOGIN
const ADMIN_DEFAULT_PASSWORD = 'Admin@Futurismo2026';

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// ---------------------------------------------------------------------------
// Limpieza completa (idempotencia del seed)
// Se truncan TODAS las tablas para garantizar un estado limpio antes de
// reinsertar la información mínima.
// ---------------------------------------------------------------------------
async function cleanDatabase() {
  console.log('🗑️  Limpiando base de datos...');

  const tablesToClean = [
    // Datos transaccionales más profundos primero
    'audit_logs',
    'user_terms_acceptance',
    'user_permissions',
    'user_favorites',
    'tour_incidents',
    'monitoring_alerts',
    'guide_locations',
    'tour_progress',
    'tour_photos',
    'active_tours',
    'tour_assignments',
    'time_slots',
    'availability',
    'working_hours',
    'personal_events',
    'guide_pricing',
    'service_requests',
    'reservation_groups',
    'ratings',
    'tourist_ratings',
    'service_area_ratings',
    'staff_evaluations',
    'reviews',
    'reservations',
    'tour_stops',
    'tours',
    'tour_categories',
    'documents',
    'vehicle_documents',
    'vehicles',
    'drivers',
    'protocol_steps',
    'protocols',
    'emergency_contacts',
    'emergency_categories',
    'emergency_material_items',
    'emergency_materials',
    'emergency_contact_types',
    'provider_services',
    'providers',
    'provider_categories',
    'locations',
    'redemptions',
    'rewards',
    'reward_categories',
    'points_history',
    'expenses',
    'income',
    'financial_calculations',
    'expense_categories',
    'income_types',
    'agency_payment_methods',
    'system_payment_methods',
    'chat_participants',
    'messages',
    'chats',
    'notification_settings',
    'notifications',
    'feedback',
    'suggestions',
    'guides',
    'agencies',
    // Configuraciones (se reinsertan)
    'system_config',
    'notification_config',
    'reservation_config',
    'points_config',
    'settings',
    // Catálogos (se reinsertan)
    'languages',
    'payment_methods',
    'evaluation_criteria',
    'recommendation_options',
    'terms_and_conditions',
    // Estructura RBAC (se reinserta)
    'role_permissions',
    'permissions',
    'users',
    'roles'
  ];

  for (const table of tablesToClean) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    } catch (e) {
      // Ignorar si la tabla no existe (entorno fresco)
    }
  }

  console.log('✅ Base de datos limpiada');
}

async function main() {
  console.log('🌱 Iniciando seed de producción (mínimo indispensable)...\n');

  await cleanDatabase();

  const passwordHash = await hashPassword(ADMIN_DEFAULT_PASSWORD);

  // ==========================================================================
  // 1. ROLES
  // ==========================================================================
  console.log('📋 Creando roles...');
  await prisma.roles.createMany({
    data: [
      { role_id: 1, name: 'administrator', display_name: 'Administrador', description: 'Control total del sistema' },
      { role_id: 2, name: 'agency',        display_name: 'Agencia',       description: 'Operador de agencia de turismo' },
      { role_id: 3, name: 'guide',         display_name: 'Guía',          description: 'Guía turístico freelance o de agencia' }
    ]
  });

  // ==========================================================================
  // 2. PERMISSIONS
  // ==========================================================================
  console.log('🔐 Creando permisos...');
  const permissions = [
    // Administrator
    { id: 'a0000001-0001-0000-0000-000000000001', name: 'Dashboard Admin',         code: 'administrator.dashboard',     description: 'Acceso al dashboard de administrador',          module: 'administrator' },
    { id: 'a0000001-0002-0000-0000-000000000001', name: 'Gestión Usuarios',        code: 'administrator.users',         description: 'Gestionar todos los usuarios',                  module: 'administrator' },
    { id: 'a0000001-0003-0000-0000-000000000001', name: 'Gestión Agencias',        code: 'administrator.agencies',      description: 'Gestionar todas las agencias',                  module: 'administrator' },
    { id: 'a0000001-0004-0000-0000-000000000001', name: 'Gestión Guías',           code: 'administrator.guides',        description: 'Gestionar todos los guías',                     module: 'administrator' },
    { id: 'a0000001-0005-0000-0000-000000000001', name: 'Gestión Tours',           code: 'administrator.tours',         description: 'Gestionar catálogo de tours',                   module: 'administrator' },
    { id: 'a0000001-0006-0000-0000-000000000001', name: 'Gestión Reservas',        code: 'administrator.reservations',  description: 'Ver y gestionar todas las reservas',            module: 'administrator' },
    { id: 'a0000001-0007-0000-0000-000000000001', name: 'Gestión Proveedores',     code: 'administrator.providers',     description: 'Gestionar proveedores de servicios',            module: 'administrator' },
    { id: 'a0000001-0008-0000-0000-000000000001', name: 'Gestión Vehículos',       code: 'administrator.vehicles',      description: 'Gestionar flota de vehículos',                  module: 'administrator' },
    { id: 'a0000001-0009-0000-0000-000000000001', name: 'Gestión Choferes',        code: 'administrator.drivers',       description: 'Gestionar choferes',                            module: 'administrator' },
    { id: 'a0000001-0010-0000-0000-000000000001', name: 'Gestión Recompensas',     code: 'administrator.rewards',       description: 'Gestionar sistema de puntos y recompensas',     module: 'administrator' },
    { id: 'a0000001-0011-0000-0000-000000000001', name: 'Monitoreo Tiempo Real',   code: 'administrator.monitoring',    description: 'Monitorear tours en tiempo real',               module: 'administrator' },
    { id: 'a0000001-0012-0000-0000-000000000001', name: 'Reportes Admin',          code: 'administrator.reports',       description: 'Ver reportes y estadísticas globales',          module: 'administrator' },
    { id: 'a0000001-0013-0000-0000-000000000001', name: 'Configuración Sistema',   code: 'administrator.settings',      description: 'Configurar parámetros del sistema',             module: 'administrator' },
    { id: 'a0000001-0014-0000-0000-000000000001', name: 'Gestión Permisos',        code: 'administrator.permissions',   description: 'Gestionar roles y permisos',                    module: 'administrator' },
    { id: 'a0000001-0015-0000-0000-000000000001', name: 'Auditoría',               code: 'administrator.audit',         description: 'Ver logs de auditoría',                         module: 'administrator' },
    { id: 'a0000001-0016-0000-0000-000000000001', name: 'Emergencias',             code: 'administrator.emergencies',   description: 'Gestionar protocolos de emergencia',            module: 'administrator' },
    { id: 'a0000001-0017-0000-0000-000000000001', name: 'Chat Admin',              code: 'administrator.chat',          description: 'Acceso a todos los chats',                      module: 'administrator' },
    { id: 'a0000001-0018-0000-0000-000000000001', name: 'Marketplace Admin',       code: 'administrator.marketplace',   description: 'Gestionar marketplace de guías',                module: 'administrator' },
    // Agency
    { id: 'a0000002-0001-0000-0000-000000000001', name: 'Dashboard Agencia',       code: 'agency.dashboard',            description: 'Acceso al dashboard de agencia',                module: 'agency' },
    { id: 'a0000002-0002-0000-0000-000000000001', name: 'Mis Reservas',            code: 'agency.reservations',         description: 'Gestionar reservas propias',                    module: 'agency' },
    { id: 'a0000002-0003-0000-0000-000000000001', name: 'Mis Clientes',            code: 'agency.clients',              description: 'Gestionar clientes propios',                    module: 'agency' },
    { id: 'a0000002-0004-0000-0000-000000000001', name: 'Ver Tours',               code: 'agency.tours',                description: 'Ver catálogo de tours',                         module: 'agency' },
    { id: 'a0000002-0005-0000-0000-000000000001', name: 'Buscar Guías',            code: 'agency.guides',               description: 'Buscar guías en marketplace',                   module: 'agency' },
    { id: 'a0000002-0006-0000-0000-000000000001', name: 'Mis Puntos',              code: 'agency.points',               description: 'Ver puntos y canjear recompensas',              module: 'agency' },
    { id: 'a0000002-0007-0000-0000-000000000001', name: 'Perfil Agencia',          code: 'agency.profile',              description: 'Editar perfil de agencia',                      module: 'agency' },
    { id: 'a0000002-0008-0000-0000-000000000001', name: 'Historial Agencia',       code: 'agency.history',              description: 'Ver historial de reservas',                     module: 'agency' },
    { id: 'a0000002-0009-0000-0000-000000000001', name: 'Chat Agencia',            code: 'agency.chat',                 description: 'Acceso a chats de agencia',                     module: 'agency' },
    { id: 'a0000002-0010-0000-0000-000000000001', name: 'Solicitar Servicio',      code: 'agency.service_request',      description: 'Solicitar servicios a guías',                   module: 'agency' },
    { id: 'a0000002-0011-0000-0000-000000000001', name: 'Calificar Servicio',      code: 'agency.ratings',              description: 'Calificar servicios recibidos',                 module: 'agency' },
    { id: 'a0000002-0012-0000-0000-000000000001', name: 'Notificaciones Agencia',  code: 'agency.notifications',        description: 'Gestionar notificaciones',                      module: 'agency' },
    // Guide
    { id: 'a0000003-0001-0000-0000-000000000001', name: 'Dashboard Guía',          code: 'guide.dashboard',             description: 'Acceso al dashboard de guía',                   module: 'guide' },
    { id: 'a0000003-0002-0000-0000-000000000001', name: 'Mi Agenda',               code: 'guide.calendar',              description: 'Gestionar agenda y disponibilidad',             module: 'guide' },
    { id: 'a0000003-0003-0000-0000-000000000001', name: 'Mis Tours Asignados',     code: 'guide.tours',                 description: 'Ver tours asignados',                           module: 'guide' },
    { id: 'a0000003-0004-0000-0000-000000000001', name: 'Perfil Guía',             code: 'guide.profile',               description: 'Editar perfil de guía',                         module: 'guide' },
    { id: 'a0000003-0005-0000-0000-000000000001', name: 'Mis Ingresos',            code: 'guide.earnings',              description: 'Ver historial de ingresos',                     module: 'guide' },
    { id: 'a0000003-0006-0000-0000-000000000001', name: 'Ejecutar Tour',           code: 'guide.active_tour',           description: 'Iniciar y ejecutar tours',                      module: 'guide' },
    { id: 'a0000003-0007-0000-0000-000000000001', name: 'Chat Guía',               code: 'guide.chat',                  description: 'Acceso a chats de guía',                        module: 'guide' },
    { id: 'a0000003-0008-0000-0000-000000000001', name: 'Ver Solicitudes',         code: 'guide.requests',              description: 'Ver solicitudes de servicio',                   module: 'guide' },
    { id: 'a0000003-0009-0000-0000-000000000001', name: 'Notificaciones Guía',     code: 'guide.notifications',         description: 'Gestionar notificaciones',                      module: 'guide' },
    { id: 'a0000003-0010-0000-0000-000000000001', name: 'Reportar Emergencia',     code: 'guide.emergency',             description: 'Reportar emergencias durante tour',             module: 'guide' },
    { id: 'a0000003-0011-0000-0000-000000000001', name: 'Subir Fotos Tour',        code: 'guide.photos',                description: 'Subir fotos durante tours',                     module: 'guide' },
    { id: 'a0000003-0012-0000-0000-000000000001', name: 'Documentos Guía',         code: 'guide.documents',             description: 'Gestionar documentos personales',               module: 'guide' }
  ];
  await prisma.permissions.createMany({ data: permissions });

  // ==========================================================================
  // 3. ROLE_PERMISSIONS
  // ==========================================================================
  console.log('🔗 Asignando permisos a roles...');
  const adminPermissions  = permissions.filter(p => p.code.startsWith('administrator.'));
  const agencyPermissions = permissions.filter(p => p.code.startsWith('agency.'));
  const guidePermissions  = permissions.filter(p => p.code.startsWith('guide.'));

  await prisma.role_permissions.createMany({
    data: [
      ...adminPermissions.map(p  => ({ role_id: 1, permission_id: p.id })),
      ...agencyPermissions.map(p => ({ role_id: 2, permission_id: p.id })),
      ...guidePermissions.map(p  => ({ role_id: 3, permission_id: p.id }))
    ]
  });

  // ==========================================================================
  // 4. ADMIN INICIAL
  // ==========================================================================
  console.log('👤 Creando administrador inicial...');
  await prisma.users.create({
    data: {
      id: 'a1000001-0000-0000-0000-000000000001',
      username: 'admin',
      email: 'admin@futurismo.pe',
      password_hash: passwordHash,
      first_name: 'Administrador',
      last_name: 'Futurismo',
      role_id: 1,
      status: 'active'
    }
  });

  // ==========================================================================
  // 5. LANGUAGES (catálogo esperado por la UI)
  // ==========================================================================
  console.log('🌐 Cargando idiomas...');
  await prisma.languages.createMany({
    data: [
      { code: 'es', name: 'Español',         native_name: 'Español',   is_active: true, sort_order: 1 },
      { code: 'en', name: 'Inglés',          native_name: 'English',   is_active: true, sort_order: 2 },
      { code: 'pt', name: 'Portugués',       native_name: 'Português', is_active: true, sort_order: 3 },
      { code: 'fr', name: 'Francés',         native_name: 'Français',  is_active: true, sort_order: 4 },
      { code: 'de', name: 'Alemán',          native_name: 'Deutsch',   is_active: true, sort_order: 5 },
      { code: 'it', name: 'Italiano',        native_name: 'Italiano',  is_active: true, sort_order: 6 },
      { code: 'ja', name: 'Japonés',         native_name: '日本語',     is_active: true, sort_order: 7 },
      { code: 'zh', name: 'Chino Mandarín',  native_name: '中文',       is_active: true, sort_order: 8 },
      { code: 'ko', name: 'Coreano',         native_name: '한국어',     is_active: true, sort_order: 9 },
      { code: 'qu', name: 'Quechua',         native_name: 'Runasimi',  is_active: true, sort_order: 10 }
    ]
  });

  // ==========================================================================
  // 6. PAYMENT_METHODS (catálogo no editable desde frontend)
  // ==========================================================================
  console.log('💳 Cargando métodos de pago...');
  await prisma.payment_methods.createMany({
    data: [
      { name: 'Efectivo',              code: 'cash',          description: 'Pago en efectivo',                  icon: 'payments',         is_active: true, sort_order: 1 },
      { name: 'Tarjeta de Crédito',    code: 'credit_card',   description: 'Pago con tarjeta de crédito',       icon: 'credit_card',      is_active: true, sort_order: 2 },
      { name: 'Tarjeta de Débito',     code: 'debit_card',    description: 'Pago con tarjeta de débito',        icon: 'credit_card',      is_active: true, sort_order: 3 },
      { name: 'Transferencia Bancaria', code: 'bank_transfer', description: 'Transferencia o depósito bancario', icon: 'account_balance', is_active: true, sort_order: 4 },
      { name: 'Yape',                  code: 'yape',          description: 'Pago por Yape',                     icon: 'phone_android',    is_active: true, sort_order: 5 },
      { name: 'Plin',                  code: 'plin',          description: 'Pago por Plin',                     icon: 'phone_android',    is_active: true, sort_order: 6 }
    ]
  });

  // ==========================================================================
  // 7. EVALUATION_CRITERIA (catálogo no editable desde frontend)
  // ==========================================================================
  console.log('📊 Cargando criterios de evaluación...');
  await prisma.evaluation_criteria.createMany({
    data: [
      { key: 'punctuality',     label: 'Puntualidad',              description: 'Cumplimiento de horarios',                              order_index: 1, is_active: true },
      { key: 'knowledge',       label: 'Conocimiento',             description: 'Dominio del tema y contenido del tour',                 order_index: 2, is_active: true },
      { key: 'communication',   label: 'Comunicación',             description: 'Habilidades de comunicación con el grupo',              order_index: 3, is_active: true },
      { key: 'professionalism', label: 'Profesionalismo',          description: 'Presentación personal y actitud profesional',           order_index: 4, is_active: true },
      { key: 'problem_solving', label: 'Resolución de Problemas',  description: 'Capacidad de resolver imprevistos',                     order_index: 5, is_active: true }
    ]
  });

  // ==========================================================================
  // 8. RECOMMENDATION_OPTIONS (catálogo no editable desde frontend)
  // ==========================================================================
  console.log('👍 Cargando opciones de recomendación...');
  await prisma.recommendation_options.createMany({
    data: [
      { value: 'highly_recommended', label: 'Altamente Recomendado', color: '#10B981', order_index: 1, is_active: true },
      { value: 'recommended',        label: 'Recomendado',           color: '#3B82F6', order_index: 2, is_active: true },
      { value: 'neutral',            label: 'Neutral',               color: '#F59E0B', order_index: 3, is_active: true },
      { value: 'not_recommended',    label: 'No Recomendado',        color: '#EF4444', order_index: 4, is_active: true }
    ]
  });

  // ==========================================================================
  // 9. SYSTEM_CONFIG
  // ==========================================================================
  console.log('⚙️  Configuración del sistema...');
  await prisma.system_config.create({
    data: {
      company_name: 'Futurismo Tours',
      timezone: 'America/Lima',
      currency: 'PEN',
      language: 'es',
      date_format: 'DD/MM/YYYY',
      time_format: 'HH:mm'
    }
  });

  // ==========================================================================
  // 10. NOTIFICATION_CONFIG
  // ==========================================================================
  console.log('🔔 Configuración de notificaciones...');
  await prisma.notification_config.create({
    data: {
      email_enabled: true,
      sms_enabled: false,
      push_enabled: true,
      whatsapp_enabled: false,
      notify_on_new_reservation: true,
      notify_on_status_change: true,
      notify_on_new_rating: true
    }
  });

  // ==========================================================================
  // 11. RESERVATION_CONFIG
  // ==========================================================================
  console.log('📅 Configuración de reservas...');
  await prisma.reservation_config.create({
    data: {
      min_advance_hours: 24,
      max_advance_days: 90,
      default_start_time: '08:00',
      default_end_time: '18:00',
      time_slot_interval: 30,
      allow_same_day_booking: false,
      require_confirmation: true,
      auto_confirm_enabled: false,
      overbooking_allowed: false
    }
  });

  // ==========================================================================
  // 12. POINTS_CONFIG
  // ==========================================================================
  console.log('🎯 Configuración de puntos...');
  await prisma.points_config.create({
    data: {
      points_per_sol: 1,
      expiration_months: 12,
      levels: [
        { name: 'Bronze',   minPoints: 0 },
        { name: 'Silver',   minPoints: 1000 },
        { name: 'Gold',     minPoints: 5000 },
        { name: 'Platinum', minPoints: 20000 }
      ]
    }
  });

  // ==========================================================================
  // 13. TERMS_AND_CONDITIONS (placeholder inicial)
  // ==========================================================================
  console.log('📜 Cargando términos y condiciones iniciales...');
  const today = new Date();
  await prisma.terms_and_conditions.createMany({
    data: [
      {
        type: 'terms',
        version: '1.0',
        title: 'Términos y Condiciones de Uso',
        content: '<p>Términos y condiciones de uso de Futurismo Tours. Reemplazar este contenido con la versión legal definitiva desde el panel administrativo.</p>',
        is_active: true,
        effective_date: today,
        created_by: 'a1000001-0000-0000-0000-000000000001'
      },
      {
        type: 'privacy',
        version: '1.0',
        title: 'Política de Privacidad',
        content: '<p>Política de privacidad de Futurismo Tours. Reemplazar este contenido con la versión legal definitiva desde el panel administrativo.</p>',
        is_active: true,
        effective_date: today,
        created_by: 'a1000001-0000-0000-0000-000000000001'
      }
    ]
  });

  // ==========================================================================
  // RESUMEN
  // ==========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('✨ SEED DE PRODUCCIÓN COMPLETADO');
  console.log('='.repeat(60));

  const counts = {
    roles:                  await prisma.roles.count(),
    permissions:            await prisma.permissions.count(),
    role_permissions:       await prisma.role_permissions.count(),
    users:                  await prisma.users.count(),
    languages:              await prisma.languages.count(),
    payment_methods:        await prisma.payment_methods.count(),
    evaluation_criteria:    await prisma.evaluation_criteria.count(),
    recommendation_options: await prisma.recommendation_options.count(),
    system_config:          await prisma.system_config.count(),
    notification_config:    await prisma.notification_config.count(),
    reservation_config:     await prisma.reservation_config.count(),
    points_config:          await prisma.points_config.count(),
    terms_and_conditions:   await prisma.terms_and_conditions.count()
  };

  console.log('\n📊 Datos creados:');
  Object.entries(counts).forEach(([table, count]) => {
    console.log(`   ${table.padEnd(25)} ${count}`);
  });

  console.log('\n🔐 Credenciales del administrador inicial:');
  console.log(`   Email:    admin@futurismo.pe`);
  console.log(`   Usuario:  admin`);
  console.log(`   Password: ${ADMIN_DEFAULT_PASSWORD}`);
  console.log('\n⚠️  CAMBIAR LA CONTRASEÑA INMEDIATAMENTE DESPUÉS DEL PRIMER LOGIN');
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
