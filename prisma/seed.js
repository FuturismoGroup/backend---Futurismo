// =============================================================================
// SEEDER PRISMA - Futurismo App
// =============================================================================
// Equivalente a seed.sql pero usando Prisma Client
// Fecha: 2025-12-02
// Zona horaria: America/Lima (UTC-5)
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Contrasena por defecto para todos los usuarios de prueba
const DEFAULT_PASSWORD = 'Password123';

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// Funcion para limpiar todas las tablas en orden inverso de dependencias
async function cleanDatabase() {
  console.log('🗑️  Limpiando base de datos...');

  const tablesToClean = [
    'audit_logs', 'documents', 'reviews', 'service_requests',
    'role_permissions', 'settings', 'emergency_contacts',
    'protocol_steps', 'protocols', 'emergency_categories',
    'tour_photos', 'tour_progress', 'guide_locations', 'active_tours',
    'suggestions', 'feedback', 'ratings', 'notification_settings',
    'notifications', 'messages',
    'chat_participants', 'chats', 'tour_assignments',
    'vehicle_documents', 'vehicles', 'drivers',
    'provider_services', 'providers',
    'locations', 'provider_categories', 'working_hours',
    'personal_events', 'time_slots', 'availability',
    'points_history', 'redemptions', 'rewards', 'reward_categories',
    'income', 'expenses', 'financial_calculations',
    'tourist_ratings', 'service_area_ratings', 'staff_evaluations',
    'reservations', 'tour_stops', 'tours', 'tour_categories',
    'emergency_material_items', 'emergency_materials',
    'emergency_contact_types', 'evaluation_criteria',
    'expense_categories', 'income_types', 'payment_methods',
    'recommendation_options', 'notification_config',
    'reservation_config', 'points_config', 'system_config',
    'agency_payment_methods', 'system_payment_methods',
    'user_terms_acceptance', 'terms_and_conditions',
    'languages',
    'guides', 'agencies', 'users', 'permissions', 'roles'
  ];

  for (const table of tablesToClean) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    } catch (e) {
      // Ignorar errores si la tabla no existe
    }
  }

  console.log('✅ Base de datos limpiada');
}

async function main() {
  console.log('🌱 Iniciando seed completo...\n');

  // Limpiar base de datos
  await cleanDatabase();

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  console.log(`📝 Hash generado para "${DEFAULT_PASSWORD}"\n`);

  // ==========================================================================
  // 1. ROLES
  // ==========================================================================
  console.log('📋 Creando roles...');
  await prisma.roles.createMany({
    data: [
      { role_id: 1, name: 'administrator', display_name: 'Administrador', description: 'Control total del sistema' },
      { role_id: 2, name: 'agency', display_name: 'Agencia', description: 'Operador de agencia de turismo' },
      { role_id: 3, name: 'guide', display_name: 'Guia', description: 'Guia turistico freelance o de agencia' }
    ]
  });

  // ==========================================================================
  // 2. PERMISSIONS
  // ==========================================================================
  console.log('🔐 Creando permisos...');
  const permissions = [
    // Administrator
    { id: 'a0000001-0001-0000-0000-000000000001', name: 'Dashboard Admin', code: 'administrator.dashboard', description: 'Acceso al dashboard de administrador', module: 'administrator' },
    { id: 'a0000001-0002-0000-0000-000000000001', name: 'Gestion Usuarios', code: 'administrator.users', description: 'Gestionar todos los usuarios', module: 'administrator' },
    { id: 'a0000001-0003-0000-0000-000000000001', name: 'Gestion Agencias', code: 'administrator.agencies', description: 'Gestionar todas las agencias', module: 'administrator' },
    { id: 'a0000001-0004-0000-0000-000000000001', name: 'Gestion Guias', code: 'administrator.guides', description: 'Gestionar todos los guias', module: 'administrator' },
    { id: 'a0000001-0005-0000-0000-000000000001', name: 'Gestion Tours', code: 'administrator.tours', description: 'Gestionar catalogo de tours', module: 'administrator' },
    { id: 'a0000001-0006-0000-0000-000000000001', name: 'Gestion Reservas', code: 'administrator.reservations', description: 'Ver y gestionar todas las reservas', module: 'administrator' },
    { id: 'a0000001-0007-0000-0000-000000000001', name: 'Gestion Proveedores', code: 'administrator.providers', description: 'Gestionar proveedores de servicios', module: 'administrator' },
    { id: 'a0000001-0008-0000-0000-000000000001', name: 'Gestion Vehiculos', code: 'administrator.vehicles', description: 'Gestionar flota de vehiculos', module: 'administrator' },
    { id: 'a0000001-0009-0000-0000-000000000001', name: 'Gestion Choferes', code: 'administrator.drivers', description: 'Gestionar choferes', module: 'administrator' },
    { id: 'a0000001-0010-0000-0000-000000000001', name: 'Gestion Recompensas', code: 'administrator.rewards', description: 'Gestionar sistema de puntos y recompensas', module: 'administrator' },
    { id: 'a0000001-0011-0000-0000-000000000001', name: 'Monitoreo Tiempo Real', code: 'administrator.monitoring', description: 'Monitorear tours en tiempo real', module: 'administrator' },
    { id: 'a0000001-0012-0000-0000-000000000001', name: 'Reportes Admin', code: 'administrator.reports', description: 'Ver reportes y estadisticas globales', module: 'administrator' },
    { id: 'a0000001-0013-0000-0000-000000000001', name: 'Configuracion Sistema', code: 'administrator.settings', description: 'Configurar parametros del sistema', module: 'administrator' },
    { id: 'a0000001-0014-0000-0000-000000000001', name: 'Gestion Permisos', code: 'administrator.permissions', description: 'Gestionar roles y permisos', module: 'administrator' },
    { id: 'a0000001-0015-0000-0000-000000000001', name: 'Auditoria', code: 'administrator.audit', description: 'Ver logs de auditoria', module: 'administrator' },
    { id: 'a0000001-0016-0000-0000-000000000001', name: 'Emergencias', code: 'administrator.emergencies', description: 'Gestionar protocolos de emergencia', module: 'administrator' },
    { id: 'a0000001-0017-0000-0000-000000000001', name: 'Chat Admin', code: 'administrator.chat', description: 'Acceso a todos los chats', module: 'administrator' },
    { id: 'a0000001-0018-0000-0000-000000000001', name: 'Marketplace Admin', code: 'administrator.marketplace', description: 'Gestionar marketplace de guias', module: 'administrator' },
    // Agency
    { id: 'a0000002-0001-0000-0000-000000000001', name: 'Dashboard Agencia', code: 'agency.dashboard', description: 'Acceso al dashboard de agencia', module: 'agency' },
    { id: 'a0000002-0002-0000-0000-000000000001', name: 'Mis Reservas', code: 'agency.reservations', description: 'Gestionar reservas propias', module: 'agency' },
    { id: 'a0000002-0003-0000-0000-000000000001', name: 'Mis Clientes', code: 'agency.clients', description: 'Gestionar clientes propios', module: 'agency' },
    { id: 'a0000002-0004-0000-0000-000000000001', name: 'Ver Tours', code: 'agency.tours', description: 'Ver catalogo de tours', module: 'agency' },
    { id: 'a0000002-0005-0000-0000-000000000001', name: 'Buscar Guias', code: 'agency.guides', description: 'Buscar guias en marketplace', module: 'agency' },
    { id: 'a0000002-0006-0000-0000-000000000001', name: 'Mis Puntos', code: 'agency.points', description: 'Ver puntos y canjear recompensas', module: 'agency' },
    { id: 'a0000002-0007-0000-0000-000000000001', name: 'Perfil Agencia', code: 'agency.profile', description: 'Editar perfil de agencia', module: 'agency' },
    { id: 'a0000002-0008-0000-0000-000000000001', name: 'Historial Agencia', code: 'agency.history', description: 'Ver historial de reservas', module: 'agency' },
    { id: 'a0000002-0009-0000-0000-000000000001', name: 'Chat Agencia', code: 'agency.chat', description: 'Acceso a chats de agencia', module: 'agency' },
    { id: 'a0000002-0010-0000-0000-000000000001', name: 'Solicitar Servicio', code: 'agency.service_request', description: 'Solicitar servicios a guias', module: 'agency' },
    { id: 'a0000002-0011-0000-0000-000000000001', name: 'Calificar Servicio', code: 'agency.ratings', description: 'Calificar servicios recibidos', module: 'agency' },
    { id: 'a0000002-0012-0000-0000-000000000001', name: 'Notificaciones Agencia', code: 'agency.notifications', description: 'Gestionar notificaciones', module: 'agency' },
    // Guide
    { id: 'a0000003-0001-0000-0000-000000000001', name: 'Dashboard Guia', code: 'guide.dashboard', description: 'Acceso al dashboard de guia', module: 'guide' },
    { id: 'a0000003-0002-0000-0000-000000000001', name: 'Mi Agenda', code: 'guide.calendar', description: 'Gestionar agenda y disponibilidad', module: 'guide' },
    { id: 'a0000003-0003-0000-0000-000000000001', name: 'Mis Tours Asignados', code: 'guide.tours', description: 'Ver tours asignados', module: 'guide' },
    { id: 'a0000003-0004-0000-0000-000000000001', name: 'Perfil Guia', code: 'guide.profile', description: 'Editar perfil de guia', module: 'guide' },
    { id: 'a0000003-0005-0000-0000-000000000001', name: 'Mis Ingresos', code: 'guide.earnings', description: 'Ver historial de ingresos', module: 'guide' },
    { id: 'a0000003-0006-0000-0000-000000000001', name: 'Ejecutar Tour', code: 'guide.active_tour', description: 'Iniciar y ejecutar tours', module: 'guide' },
    { id: 'a0000003-0007-0000-0000-000000000001', name: 'Chat Guia', code: 'guide.chat', description: 'Acceso a chats de guia', module: 'guide' },
    { id: 'a0000003-0008-0000-0000-000000000001', name: 'Ver Solicitudes', code: 'guide.requests', description: 'Ver solicitudes de servicio', module: 'guide' },
    { id: 'a0000003-0009-0000-0000-000000000001', name: 'Notificaciones Guia', code: 'guide.notifications', description: 'Gestionar notificaciones', module: 'guide' },
    { id: 'a0000003-0010-0000-0000-000000000001', name: 'Reportar Emergencia', code: 'guide.emergency', description: 'Reportar emergencias durante tour', module: 'guide' },
    { id: 'a0000003-0011-0000-0000-000000000001', name: 'Subir Fotos Tour', code: 'guide.photos', description: 'Subir fotos durante tours', module: 'guide' },
    { id: 'a0000003-0012-0000-0000-000000000001', name: 'Documentos Guia', code: 'guide.documents', description: 'Gestionar documentos personales', module: 'guide' }
  ];
  await prisma.permissions.createMany({ data: permissions });

  // ==========================================================================
  // 3. USERS
  // ==========================================================================
  console.log('👤 Creando usuarios...');
  const users = [
    // Administrators
    { id: 'a1000001-0000-0000-0000-000000000001', username: 'admin', email: 'admin@futurismo.pe', password_hash: passwordHash, first_name: 'Carlos', last_name: 'Rodriguez', phone: '+51999888777', role_id: 1, status: 'active', document_type: 'DNI', document_number: '12345678', birth_date: new Date('1985-03-15'), address: 'Av. Larco 123, Miraflores', city: 'Lima' },
    { id: 'a1000002-0000-0000-0000-000000000001', username: 'supervisor', email: 'supervisor@futurismo.pe', password_hash: passwordHash, first_name: 'Maria', last_name: 'Gonzales', phone: '+51999888666', role_id: 1, status: 'active', document_type: 'DNI', document_number: '12345679', birth_date: new Date('1990-07-22'), address: 'Calle Los Pinos 456, San Isidro', city: 'Lima' },
    // Agencies
    { id: 'b2000001-0000-0000-0000-000000000001', username: 'tourslima', email: 'contacto@tourslima.com', password_hash: passwordHash, first_name: 'Juan', last_name: 'Perez', phone: '+51999111222', role_id: 2, status: 'active', document_type: 'DNI', document_number: '45678901', birth_date: new Date('1988-05-10'), address: 'Jr. Union 789, Centro de Lima', city: 'Lima' },
    { id: 'b2000002-0000-0000-0000-000000000001', username: 'perumagico', email: 'info@perumagico.com', password_hash: passwordHash, first_name: 'Ana', last_name: 'Martinez', phone: '+51999222333', role_id: 2, status: 'active', document_type: 'DNI', document_number: '45678902', birth_date: new Date('1992-11-28'), address: 'Av. Pardo 321, Miraflores', city: 'Lima' },
    { id: 'b2000003-0000-0000-0000-000000000001', username: 'aventuraperu', email: 'reservas@aventuraperu.com', password_hash: passwordHash, first_name: 'Roberto', last_name: 'Silva', phone: '+51999333444', role_id: 2, status: 'active', document_type: 'DNI', document_number: '45678903', birth_date: new Date('1980-02-14'), address: 'Calle Libertad 555, San Borja', city: 'Lima' },
    { id: 'b2000004-0000-0000-0000-000000000001', username: 'incatravel', email: 'ventas@incatravel.pe', password_hash: passwordHash, first_name: 'Patricia', last_name: 'Lopez', phone: '+51999444555', role_id: 2, status: 'active', document_type: 'DNI', document_number: '45678904', birth_date: new Date('1995-09-03'), address: 'Av. Benavides 2000, Surco', city: 'Lima' },
    // Guides
    { id: 'c3000001-0000-0000-0000-000000000001', username: 'carlos_guia', email: 'carlos@guia.com', password_hash: passwordHash, first_name: 'Carlos', last_name: 'Mendoza', phone: '+51987654321', role_id: 3, status: 'active', document_type: 'DNI', document_number: '78901234', birth_date: new Date('1990-01-20'), address: 'Av. Brasil 1500, Jesus Maria', city: 'Lima' },
    { id: 'c3000002-0000-0000-0000-000000000001', username: 'lucia_guia', email: 'lucia@guia.com', password_hash: passwordHash, first_name: 'Lucia', last_name: 'Vargas', phone: '+51987654322', role_id: 3, status: 'active', document_type: 'DNI', document_number: '78901235', birth_date: new Date('1993-04-12'), address: 'Jr. Amazonas 800, Brena', city: 'Lima' },
    { id: 'c3000003-0000-0000-0000-000000000001', username: 'miguel_guia', email: 'miguel@guia.com', password_hash: passwordHash, first_name: 'Miguel', last_name: 'Torres', phone: '+51987654323', role_id: 3, status: 'active', document_type: 'DNI', document_number: '78901236', birth_date: new Date('1987-08-25'), address: 'Calle Las Flores 200, La Molina', city: 'Lima' },
    { id: 'c3000004-0000-0000-0000-000000000001', username: 'rosa_guia', email: 'rosa@guia.com', password_hash: passwordHash, first_name: 'Rosa', last_name: 'Huaman', phone: '+51987654324', role_id: 3, status: 'active', document_type: 'DNI', document_number: '78901237', birth_date: new Date('1991-12-05'), address: 'Av. Arequipa 3500, Lince', city: 'Lima' },
    { id: 'c3000005-0000-0000-0000-000000000001', username: 'pedro_guia', email: 'pedro@guia.com', password_hash: passwordHash, first_name: 'Pedro', last_name: 'Quispe', phone: '+51987654325', role_id: 3, status: 'active', document_type: 'DNI', document_number: '78901238', birth_date: new Date('1985-06-18'), address: 'Jr. Cusco 400, Rimac', city: 'Lima' },
    { id: 'c3000006-0000-0000-0000-000000000001', username: 'maria_guia', email: 'maria@guia.com', password_hash: passwordHash, first_name: 'Maria', last_name: 'Flores', phone: '+51987654326', role_id: 3, status: 'active', document_type: 'DNI', document_number: '78901239', birth_date: new Date('1994-03-30'), address: 'Av. Colonial 1200, Callao', city: 'Callao' }
  ];
  await prisma.users.createMany({ data: users });

  // ==========================================================================
  // 4. ROLE_PERMISSIONS
  // ==========================================================================
  console.log('🔗 Asignando permisos a roles...');
  const adminPermissions = permissions.filter(p => p.code.startsWith('administrator.'));
  const agencyPermissions = permissions.filter(p => p.code.startsWith('agency.'));
  const guidePermissions = permissions.filter(p => p.code.startsWith('guide.'));

  const rolePermissionsData = [
    ...adminPermissions.map(p => ({ role_id: 1, permission_id: p.id })),
    ...agencyPermissions.map(p => ({ role_id: 2, permission_id: p.id })),
    ...guidePermissions.map(p => ({ role_id: 3, permission_id: p.id }))
  ];
  await prisma.role_permissions.createMany({ data: rolePermissionsData });

  // ==========================================================================
  // 5. AGENCIES
  // ==========================================================================
  console.log('🏢 Creando agencias...');
  await prisma.agencies.createMany({
    data: [
      { id: 'd4000001-0000-0000-0000-000000000001', user_id: 'b2000001-0000-0000-0000-000000000001', business_name: 'Tours Lima SAC', ruc: '20123456789', position: 'Gerente General', agency_phone: '+5114567890', agency_email: 'contacto@tourslima.com', agency_address: 'Jr. Union 789, Centro de Lima', whatsapp: '+51999111222', status: 'active', level: 'gold', verified: true, rating: 4.50, total_reviews: 125, total_tours: 450, available_points: 2500, total_points: 15000, certifications: ['MINCETUR', 'IATA'], specialties: ['city_tours', 'cultural', 'gastronomico'], languages: ['es', 'en', 'pt'] },
      { id: 'd4000002-0000-0000-0000-000000000001', user_id: 'b2000002-0000-0000-0000-000000000001', business_name: 'Peru Magico Tours', ruc: '20234567890', position: 'Directora Comercial', agency_phone: '+5114567891', agency_email: 'info@perumagico.com', agency_address: 'Av. Pardo 321, Miraflores', whatsapp: '+51999222333', status: 'active', level: 'silver', verified: true, rating: 4.30, total_reviews: 89, total_tours: 280, available_points: 1800, total_points: 9500, certifications: ['MINCETUR'], specialties: ['aventura', 'naturaleza', 'trekking'], languages: ['es', 'en'] },
      { id: 'd4000003-0000-0000-0000-000000000001', user_id: 'b2000003-0000-0000-0000-000000000001', business_name: 'Aventura Peru EIRL', ruc: '20345678901', position: 'Administrador', agency_phone: '+5114567892', agency_email: 'reservas@aventuraperu.com', agency_address: 'Calle Libertad 555, San Borja', whatsapp: '+51999333444', status: 'active', level: 'bronze', verified: false, rating: 4.10, total_reviews: 45, total_tours: 120, available_points: 500, total_points: 3200, certifications: [], specialties: ['aventura', 'ecoturismo'], languages: ['es', 'en'] },
      { id: 'd4000004-0000-0000-0000-000000000001', user_id: 'b2000004-0000-0000-0000-000000000001', business_name: 'Inca Travel Peru SAC', ruc: '20456789012', position: 'Gerente de Operaciones', agency_phone: '+5114567893', agency_email: 'ventas@incatravel.pe', agency_address: 'Av. Benavides 2000, Surco', whatsapp: '+51999444555', status: 'active', level: 'gold', verified: true, rating: 4.70, total_reviews: 210, total_tours: 680, available_points: 4500, total_points: 28000, certifications: ['MINCETUR', 'IATA', 'ASTA'], specialties: ['luxury', 'cultural', 'historico'], languages: ['es', 'en', 'fr', 'de'] }
    ]
  });

  // ==========================================================================
  // 6. GUIDES
  // ==========================================================================
  console.log('🎒 Creando guias...');
  await prisma.guides.createMany({
    data: [
      { id: 'e5000001-0000-0000-0000-000000000001', user_id: 'c3000001-0000-0000-0000-000000000001', agency_id: 'd4000001-0000-0000-0000-000000000001', guide_type: 'AGENCY', license_number: 'GL-2018-001234', years_of_experience: 8, languages: ['es', 'en', 'pt'], specialties: ['historico', 'cultural', 'gastronomico'], certifications: ['MINCETUR', 'First Aid'], bio: 'Guia de planta con 8 anios de experiencia en tours historicos y culturales.', hourly_rate: 80.00, rating: 4.80, online: true, bank_name: 'BCP', account_type: 'ahorros', account_number: '19123456789012', currency: 'PEN' },
      { id: 'e5000002-0000-0000-0000-000000000001', user_id: 'c3000002-0000-0000-0000-000000000001', guide_type: 'FREELANCE', license_number: 'GL-2019-005678', years_of_experience: 5, languages: ['es', 'en'], specialties: ['aventura', 'trekking', 'naturaleza'], certifications: ['MINCETUR', 'Wilderness First Responder'], bio: 'Apasionada por el ecoturismo y las actividades al aire libre.', hourly_rate: 70.00, rating: 4.65, online: true, bank_name: 'Interbank', account_type: 'ahorros', account_number: '20123456789013', currency: 'PEN' },
      { id: 'e5000003-0000-0000-0000-000000000001', user_id: 'c3000003-0000-0000-0000-000000000001', guide_type: 'FREELANCE', license_number: 'GL-2015-003456', years_of_experience: 12, languages: ['es', 'en', 'fr', 'de'], specialties: ['luxury', 'cultural', 'wine_tours'], certifications: ['MINCETUR', 'WSET Level 2'], bio: 'Experto en tours de lujo y experiencias gastronomicas.', hourly_rate: 120.00, rating: 4.90, online: false, bank_name: 'BBVA', account_type: 'corriente', account_number: '01123456789014', currency: 'USD' },
      { id: 'e5000004-0000-0000-0000-000000000001', user_id: 'c3000004-0000-0000-0000-000000000001', guide_type: 'FREELANCE', license_number: 'GL-2020-007890', years_of_experience: 4, languages: ['es', 'en', 'quechua'], specialties: ['historico', 'arqueologico', 'cultural'], certifications: ['MINCETUR'], bio: 'Historiadora de profesion, especializada en arqueologia peruana.', hourly_rate: 65.00, rating: 4.55, online: true, bank_name: 'BCP', account_type: 'ahorros', account_number: '19234567890123', currency: 'PEN' },
      { id: 'e5000005-0000-0000-0000-000000000001', user_id: 'c3000005-0000-0000-0000-000000000001', guide_type: 'FREELANCE', license_number: 'GL-2017-002345', years_of_experience: 9, languages: ['es', 'en', 'it'], specialties: ['city_tours', 'fotografia', 'arquitectura'], certifications: ['MINCETUR', 'Photography Guide'], bio: 'Fotografo profesional convertido en guia turistico.', hourly_rate: 90.00, rating: 4.75, online: true, bank_name: 'Scotiabank', account_type: 'ahorros', account_number: '00923456789012', currency: 'PEN' },
      { id: 'e5000006-0000-0000-0000-000000000001', user_id: 'c3000006-0000-0000-0000-000000000001', guide_type: 'FREELANCE', license_number: 'GL-2021-009012', years_of_experience: 3, languages: ['es', 'en'], specialties: ['gastronomico', 'mercados', 'cooking_class'], certifications: ['MINCETUR', 'Food Handler'], bio: 'Chef de profesion, guia especializada en tours gastronomicos.', hourly_rate: 75.00, rating: 4.60, online: false, bank_name: 'BCP', account_type: 'ahorros', account_number: '19345678901234', currency: 'PEN' }
    ]
  });

  // ==========================================================================
  // 7. TOURS
  // ==========================================================================
  console.log('🗺️  Creando tours...');
  await prisma.tours.createMany({
    data: [
      { id: 'f6000001-0000-0000-0000-000000000001', name: 'Lima Colonial Walking Tour', description: 'Recorrido a pie por el centro historico de Lima, visitando la Plaza Mayor, la Catedral, el Palacio de Gobierno.', short_description: 'Descubre la historia de Lima Colonial en un recorrido a pie.', category: 'cultural', tour_type: 'walking', duration: 4, price: 45.00, child_price: 25.00, max_capacity: 15, includes_guide: true, includes_transport: false, meeting_point: 'Plaza San Martin, frente al monumento', languages: ['es', 'en'], image: '/images/tours/lima-colonial.jpg', active: true },
      { id: 'f6000002-0000-0000-0000-000000000001', name: 'Miraflores Food Tour', description: 'Experiencia gastronomica por los mejores restaurantes y mercados de Miraflores.', short_description: 'Saborea lo mejor de la gastronomia peruana en Miraflores.', category: 'gastronomico', tour_type: 'food', duration: 5, price: 85.00, child_price: 45.00, max_capacity: 10, includes_guide: true, includes_transport: false, meeting_point: 'Parque Kennedy, Miraflores', languages: ['es', 'en', 'pt'], image: '/images/tours/food-tour.jpg', active: true },
      { id: 'f6000003-0000-0000-0000-000000000001', name: 'Pachacamac Archaeological Site', description: 'Visita al santuario arqueologico mas importante de la costa central del Peru.', short_description: 'Explora el antiguo santuario de Pachacamac.', category: 'arqueologico', tour_type: 'historical', duration: 6, price: 65.00, child_price: 35.00, max_capacity: 20, includes_guide: true, includes_transport: true, meeting_point: 'Recojo en hotel en Miraflores/San Isidro', languages: ['es', 'en'], image: '/images/tours/pachacamac.jpg', active: true },
      { id: 'f6000004-0000-0000-0000-000000000001', name: 'Barranco Bohemian Night Tour', description: 'Tour nocturno por el bohemio distrito de Barranco.', short_description: 'Vive la noche bohemia de Barranco con arte y musica.', category: 'cultural', tour_type: 'night', duration: 4, price: 55.00, child_price: 30.00, max_capacity: 12, includes_guide: true, includes_transport: false, meeting_point: 'Parque Municipal de Barranco', languages: ['es', 'en'], image: '/images/tours/barranco-night.jpg', active: true },
      { id: 'f6000005-0000-0000-0000-000000000001', name: 'Lima City Tour Completo', description: 'Tour panoramico por los principales atractivos de Lima.', short_description: 'Conoce todos los distritos emblematicos de Lima.', category: 'city_tour', tour_type: 'full_day', duration: 8, price: 120.00, child_price: 70.00, max_capacity: 25, includes_guide: true, includes_transport: true, meeting_point: 'Recojo en hotel', languages: ['es', 'en', 'fr'], image: '/images/tours/lima-completo.jpg', active: true },
      { id: 'f6000006-0000-0000-0000-000000000001', name: 'Circuito Magico del Agua', description: 'Visita nocturna al Parque de la Reserva.', short_description: 'Maravillate con el espectaculo de fuentes luminosas.', category: 'entretenimiento', tour_type: 'night', duration: 3, price: 35.00, child_price: 20.00, max_capacity: 30, includes_guide: true, includes_transport: true, meeting_point: 'Recojo en hotel en zona centro', languages: ['es', 'en'], image: '/images/tours/circuito-agua.jpg', active: true },
      { id: 'f6000007-0000-0000-0000-000000000001', name: 'Islas Palomino - Nado con Lobos', description: 'Excursion maritima a las Islas Palomino para nadar con lobos marinos.', short_description: 'Nada con lobos marinos en las Islas Palomino.', category: 'aventura', tour_type: 'excursion', duration: 5, price: 95.00, child_price: 65.00, max_capacity: 15, includes_guide: true, includes_transport: true, meeting_point: 'Plaza Grau, Callao', languages: ['es', 'en'], image: '/images/tours/palomino.jpg', active: true },
      { id: 'f6000008-0000-0000-0000-000000000001', name: 'Clase de Cocina Peruana', description: 'Aprende a preparar los platos mas emblematicos de la cocina peruana.', short_description: 'Cocina como un chef peruano en nuestra clase practica.', category: 'gastronomico', tour_type: 'cooking', duration: 4, price: 75.00, child_price: null, max_capacity: 8, includes_guide: true, includes_transport: false, meeting_point: 'Mercado de Surquillo', languages: ['es', 'en'], image: '/images/tours/cooking-class.jpg', active: true }
    ]
  });

  // ==========================================================================
  // 8. TOUR_STOPS
  // ==========================================================================
  console.log('📍 Creando paradas de tours...');
  await prisma.tour_stops.createMany({
    data: [
      { id: '11100001-0000-0000-0000-000000000001', tour_id: 'f6000001-0000-0000-0000-000000000001', order_num: 1, name: 'Plaza San Martin', duration: 20, description: 'Punto de encuentro e introduccion historica' },
      { id: '11100002-0000-0000-0000-000000000001', tour_id: 'f6000001-0000-0000-0000-000000000001', order_num: 2, name: 'Jiron de la Union', duration: 15, description: 'Caminata por la principal calle peatonal' },
      { id: '11100003-0000-0000-0000-000000000001', tour_id: 'f6000001-0000-0000-0000-000000000001', order_num: 3, name: 'Plaza Mayor', duration: 30, description: 'Catedral, Palacio de Gobierno, Palacio Arzobispal' },
      { id: '11100004-0000-0000-0000-000000000001', tour_id: 'f6000001-0000-0000-0000-000000000001', order_num: 4, name: 'Convento San Francisco', duration: 45, description: 'Iglesia, claustro y catacumbas' },
      { id: '11100005-0000-0000-0000-000000000001', tour_id: 'f6000001-0000-0000-0000-000000000001', order_num: 5, name: 'Barrio Chino', duration: 30, description: 'Historia de la inmigracion china en Peru' },
      { id: '11100006-0000-0000-0000-000000000001', tour_id: 'f6000002-0000-0000-0000-000000000001', order_num: 1, name: 'Mercado de Surquillo', duration: 45, description: 'Visita al mercado, frutas exoticas' },
      { id: '11100007-0000-0000-0000-000000000001', tour_id: 'f6000002-0000-0000-0000-000000000001', order_num: 2, name: 'Cevicheria La Mar', duration: 60, description: 'Degustacion de ceviche y tiradito' },
      { id: '11100008-0000-0000-0000-000000000001', tour_id: 'f6000002-0000-0000-0000-000000000001', order_num: 3, name: 'Anticucheria Grimanesa', duration: 40, description: 'Anticuchos y papas rellenas' },
      { id: '11100009-0000-0000-0000-000000000001', tour_id: 'f6000002-0000-0000-0000-000000000001', order_num: 4, name: 'Bar de Pisco', duration: 45, description: 'Pisco sour y chilcano' },
      { id: '11100010-0000-0000-0000-000000000001', tour_id: 'f6000003-0000-0000-0000-000000000001', order_num: 1, name: 'Museo de Sitio', duration: 45, description: 'Introduccion historica y exhibicion' },
      { id: '11100011-0000-0000-0000-000000000001', tour_id: 'f6000003-0000-0000-0000-000000000001', order_num: 2, name: 'Templo del Sol', duration: 60, description: 'Principal estructura religiosa Inca' },
      { id: '11100012-0000-0000-0000-000000000001', tour_id: 'f6000003-0000-0000-0000-000000000001', order_num: 3, name: 'Templo de la Luna', duration: 45, description: 'Acllahuasi y templos Lima' },
      { id: '11100013-0000-0000-0000-000000000001', tour_id: 'f6000003-0000-0000-0000-000000000001', order_num: 4, name: 'Templo Pintado', duration: 30, description: 'Mural policromado' }
    ]
  });

  // ==========================================================================
  // 8.5. TOUR_CATEGORIES
  // ==========================================================================
  console.log('🏷️  Creando categorías de tours...');
  await prisma.tour_categories.createMany({
    data: [
      { id: '22200001-0000-0000-0000-000000000001', name: 'Cultural', code: 'cultural', description: 'Tours culturales e históricos', color: '#8B5CF6', is_active: true },
      { id: '22200002-0000-0000-0000-000000000001', name: 'Gastronómico', code: 'gastronomico', description: 'Tours gastronómicos y culinarios', color: '#F59E0B', is_active: true },
      { id: '22200003-0000-0000-0000-000000000001', name: 'Aventura', code: 'aventura', description: 'Tours de aventura y deportes', color: '#10B981', is_active: true },
      { id: '22200004-0000-0000-0000-000000000001', name: 'Arqueológico', code: 'arqueologico', description: 'Tours a sitios arqueológicos', color: '#D97706', is_active: true },
      { id: '22200005-0000-0000-0000-000000000001', name: 'City Tour', code: 'city_tour', description: 'Tours por la ciudad', color: '#3B82F6', is_active: true },
      { id: '22200006-0000-0000-0000-000000000001', name: 'Entretenimiento', code: 'entretenimiento', description: 'Shows y actividades recreativas', color: '#EC4899', is_active: true },
      { id: '22200007-0000-0000-0000-000000000001', name: 'Naturaleza', code: 'naturaleza', description: 'Ecoturismo y naturaleza', color: '#059669', is_active: true },
      { id: '22200008-0000-0000-0000-000000000001', name: 'Nocturno', code: 'nocturno', description: 'Tours nocturnos', color: '#6366F1', is_active: true }
    ]
  });

  // ==========================================================================
  // 8.6. EXPENSE_CATEGORIES
  // ==========================================================================
  console.log('💰 Creando categorías de gastos...');
  await prisma.expense_categories.createMany({
    data: [
      { id: '88800001-0000-0000-0000-000000000001', name: 'Transporte', value: 'transporte', icon: '🚗', color: '#3B82F6', description: 'Gastos de transporte y combustible', is_active: true },
      { id: '88800002-0000-0000-0000-000000000001', name: 'Alimentación', value: 'alimentacion', icon: '🍽️', color: '#F59E0B', description: 'Gastos de comida y bebidas', is_active: true },
      { id: '88800003-0000-0000-0000-000000000001', name: 'Entradas', value: 'entradas', icon: '🎫', color: '#8B5CF6', description: 'Entradas a museos y sitios', is_active: true },
      { id: '88800004-0000-0000-0000-000000000001', name: 'Materiales', value: 'materiales', icon: '📦', color: '#10B981', description: 'Materiales y suministros para tours', is_active: true },
      { id: '88800005-0000-0000-0000-000000000001', name: 'Comunicaciones', value: 'comunicaciones', icon: '📱', color: '#6366F1', description: 'Teléfono, internet y comunicaciones', is_active: true },
      { id: '88800006-0000-0000-0000-000000000001', name: 'Otros', value: 'otros', icon: '📋', color: '#6B7280', description: 'Otros gastos no categorizados', is_active: true }
    ]
  });

  // ==========================================================================
  // 8.7. INCOME_TYPES
  // ==========================================================================
  console.log('💵 Creando tipos de ingreso...');
  await prisma.income_types.createMany({
    data: [
      { id: '88900001-0000-0000-0000-000000000001', name: 'Tour Regular', value: 'tour_regular', icon: '🗺️', color: '#3B82F6', description: 'Ingreso por tour regular', is_active: true },
      { id: '88900002-0000-0000-0000-000000000001', name: 'Tour Privado', value: 'tour_privado', icon: '⭐', color: '#F59E0B', description: 'Ingreso por tour privado/VIP', is_active: true },
      { id: '88900003-0000-0000-0000-000000000001', name: 'Propina', value: 'propina', icon: '💰', color: '#10B981', description: 'Propinas recibidas', is_active: true },
      { id: '88900004-0000-0000-0000-000000000001', name: 'Clase/Taller', value: 'clase_taller', icon: '📚', color: '#8B5CF6', description: 'Clases y talleres impartidos', is_active: true },
      { id: '88900005-0000-0000-0000-000000000001', name: 'Freelance', value: 'freelance', icon: '🎒', color: '#EC4899', description: 'Servicios freelance', is_active: true },
      { id: '88900006-0000-0000-0000-000000000001', name: 'Otro', value: 'otro', icon: '📋', color: '#6B7280', description: 'Otros ingresos', is_active: true }
    ]
  });

  // ==========================================================================
  // 8.8. PAYMENT_METHODS (catalog)
  // ==========================================================================
  console.log('💳 Creando métodos de pago...');
  await prisma.payment_methods.createMany({
    data: [
      { id: '89000001-0000-0000-0000-000000000001', name: 'Efectivo', code: 'cash', description: 'Pago en efectivo', icon: 'payments', is_active: true, sort_order: 1 },
      { id: '89000002-0000-0000-0000-000000000001', name: 'Tarjeta de Crédito', code: 'credit_card', description: 'Pago con tarjeta de crédito', icon: 'credit_card', is_active: true, sort_order: 2 },
      { id: '89000003-0000-0000-0000-000000000001', name: 'Tarjeta de Débito', code: 'debit_card', description: 'Pago con tarjeta de débito', icon: 'credit_card', is_active: true, sort_order: 3 },
      { id: '89000004-0000-0000-0000-000000000001', name: 'Transferencia Bancaria', code: 'bank_transfer', description: 'Transferencia o depósito bancario', icon: 'account_balance', is_active: true, sort_order: 4 },
      { id: '89000005-0000-0000-0000-000000000001', name: 'Yape', code: 'yape', description: 'Pago por Yape', icon: 'phone_android', is_active: true, sort_order: 5 },
      { id: '89000006-0000-0000-0000-000000000001', name: 'Plin', code: 'plin', description: 'Pago por Plin', icon: 'phone_android', is_active: true, sort_order: 6 }
    ]
  });

  // ==========================================================================
  // 8.9. EVALUATION_CRITERIA
  // ==========================================================================
  console.log('📊 Creando criterios de evaluación...');
  await prisma.evaluation_criteria.createMany({
    data: [
      { id: '89100001-0000-0000-0000-000000000001', key: 'punctuality', label: 'Puntualidad', description: 'Cumplimiento de horarios', order_index: 1, is_active: true },
      { id: '89100002-0000-0000-0000-000000000001', key: 'knowledge', label: 'Conocimiento', description: 'Dominio del tema y contenido del tour', order_index: 2, is_active: true },
      { id: '89100003-0000-0000-0000-000000000001', key: 'communication', label: 'Comunicación', description: 'Habilidades de comunicación con el grupo', order_index: 3, is_active: true },
      { id: '89100004-0000-0000-0000-000000000001', key: 'professionalism', label: 'Profesionalismo', description: 'Presentación personal y actitud profesional', order_index: 4, is_active: true },
      { id: '89100005-0000-0000-0000-000000000001', key: 'problem_solving', label: 'Resolución de Problemas', description: 'Capacidad de resolver imprevistos', order_index: 5, is_active: true }
    ]
  });

  // ==========================================================================
  // 8.10. RECOMMENDATION_OPTIONS
  // ==========================================================================
  console.log('👍 Creando opciones de recomendación...');
  await prisma.recommendation_options.createMany({
    data: [
      { id: '89200001-0000-0000-0000-000000000001', value: 'highly_recommended', label: 'Altamente Recomendado', color: '#10B981', order_index: 1, is_active: true },
      { id: '89200002-0000-0000-0000-000000000001', value: 'recommended', label: 'Recomendado', color: '#3B82F6', order_index: 2, is_active: true },
      { id: '89200003-0000-0000-0000-000000000001', value: 'neutral', label: 'Neutral', color: '#F59E0B', order_index: 3, is_active: true },
      { id: '89200004-0000-0000-0000-000000000001', value: 'not_recommended', label: 'No Recomendado', color: '#EF4444', order_index: 4, is_active: true }
    ]
  });

  // ==========================================================================
  // 8.11. EMERGENCY_CONTACT_TYPES
  // ==========================================================================
  console.log('📞 Creando tipos de contacto de emergencia...');
  await prisma.emergency_contact_types.createMany({
    data: [
      { id: '89300001-0000-0000-0000-000000000001', name: 'Policía', icon: '🚔', description: 'Policía Nacional del Perú', color: '#1E40AF', priority: 1, is_active: true },
      { id: '89300002-0000-0000-0000-000000000001', name: 'Bomberos', icon: '🚒', description: 'Cuerpo General de Bomberos', color: '#DC2626', priority: 2, is_active: true },
      { id: '89300003-0000-0000-0000-000000000001', name: 'Emergencia Médica', icon: '🏥', description: 'Servicios de emergencia médica', color: '#059669', priority: 3, is_active: true },
      { id: '89300004-0000-0000-0000-000000000001', name: 'Hospital', icon: '🏨', description: 'Hospitales y clínicas', color: '#7C3AED', priority: 4, is_active: true },
      { id: '89300005-0000-0000-0000-000000000001', name: 'Defensa Civil', icon: '🛡️', description: 'Instituto Nacional de Defensa Civil', color: '#D97706', priority: 5, is_active: true },
      { id: '89300006-0000-0000-0000-000000000001', name: 'Embajada', icon: '🏛️', description: 'Embajadas y consulados', color: '#4B5563', priority: 6, is_active: true }
    ]
  });

  // ==========================================================================
  // 8.12. EMERGENCY_MATERIALS
  // ==========================================================================
  console.log('🧰 Creando materiales de emergencia...');
  await prisma.emergency_materials.createMany({
    data: [
      { id: '89400001-0000-0000-0000-000000000001', name: 'Botiquín de Primeros Auxilios', category: 'Salud', description: 'Kit completo de primeros auxilios', quantity: 1, unit: 'unidad', is_mandatory: true, icon: '🏥', is_active: true },
      { id: '89400002-0000-0000-0000-000000000001', name: 'Extintor', category: 'Seguridad', description: 'Extintor portátil tipo ABC', quantity: 1, unit: 'unidad', is_mandatory: true, icon: '🧯', is_active: true },
      { id: '89400003-0000-0000-0000-000000000001', name: 'Chaleco Reflectivo', category: 'Seguridad', description: 'Chalecos de alta visibilidad', quantity: 2, unit: 'unidad', is_mandatory: true, icon: '🦺', is_active: true },
      { id: '89400004-0000-0000-0000-000000000001', name: 'Linterna', category: 'Equipamiento', description: 'Linterna LED recargable', quantity: 1, unit: 'unidad', is_mandatory: false, icon: '🔦', is_active: true },
      { id: '89400005-0000-0000-0000-000000000001', name: 'Agua Embotellada', category: 'Suministros', description: 'Botellas de agua para emergencias', quantity: 6, unit: 'botella', is_mandatory: true, icon: '💧', is_active: true }
    ]
  });

  // ==========================================================================
  // 8.13. LANGUAGES
  // ==========================================================================
  console.log('🌐 Creando idiomas...');
  await prisma.languages.createMany({
    data: [
      { id: '89500001-0000-0000-0000-000000000001', code: 'es', name: 'Español', native_name: 'Español', is_active: true, sort_order: 1 },
      { id: '89500002-0000-0000-0000-000000000001', code: 'en', name: 'Inglés', native_name: 'English', is_active: true, sort_order: 2 },
      { id: '89500003-0000-0000-0000-000000000001', code: 'pt', name: 'Portugués', native_name: 'Português', is_active: true, sort_order: 3 },
      { id: '89500004-0000-0000-0000-000000000001', code: 'fr', name: 'Francés', native_name: 'Français', is_active: true, sort_order: 4 },
      { id: '89500005-0000-0000-0000-000000000001', code: 'de', name: 'Alemán', native_name: 'Deutsch', is_active: true, sort_order: 5 },
      { id: '89500006-0000-0000-0000-000000000001', code: 'it', name: 'Italiano', native_name: 'Italiano', is_active: true, sort_order: 6 },
      { id: '89500007-0000-0000-0000-000000000001', code: 'ja', name: 'Japonés', native_name: '日本語', is_active: true, sort_order: 7 },
      { id: '89500008-0000-0000-0000-000000000001', code: 'zh', name: 'Chino Mandarín', native_name: '中文', is_active: true, sort_order: 8 },
      { id: '89500009-0000-0000-0000-000000000001', code: 'ko', name: 'Coreano', native_name: '한국어', is_active: true, sort_order: 9 },
      { id: '89500010-0000-0000-0000-000000000001', code: 'qu', name: 'Quechua', native_name: 'Runasimi', is_active: true, sort_order: 10 }
    ]
  });

  // ==========================================================================
  // 8.14. SYSTEM_CONFIG
  // ==========================================================================
  console.log('⚙️  Creando configuración del sistema...');
  await prisma.system_config.create({
    data: {
      id: '89600001-0000-0000-0000-000000000001',
      company_name: 'Futurismo Tours',
      company_phone: '+51 1 234 5678',
      company_email: 'info@futurismo.pe',
      company_website: 'https://futurismo.pe',
      company_address: 'Av. Larco 123, Miraflores, Lima, Perú',
      timezone: 'America/Lima',
      currency: 'PEN',
      language: 'es',
      date_format: 'DD/MM/YYYY',
      time_format: 'HH:mm',
      company_ruc: '20123456789',
      admin_email: 'admin@futurismo.pe',
      admin_office_phone: '+51 1 234 5678',
      admin_personal_phone: '+51 999 888 777',
      admin_emergency_phone: '+51 999 888 776'
    }
  });

  // ==========================================================================
  // 8.15. NOTIFICATION_CONFIG
  // ==========================================================================
  console.log('🔔 Creando configuración de notificaciones...');
  await prisma.notification_config.create({
    data: {
      id: '89700001-0000-0000-0000-000000000001',
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
  // 8.16. RESERVATION_CONFIG
  // ==========================================================================
  console.log('📅 Creando configuración de reservas...');
  await prisma.reservation_config.create({
    data: {
      id: '89800001-0000-0000-0000-000000000001',
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
  // 8.17. POINTS_CONFIG
  // ==========================================================================
  console.log('🎯 Creando configuración de puntos...');
  await prisma.points_config.create({
    data: {
      id: '89900001-0000-0000-0000-000000000001',
      points_per_sol: 1,
      expiration_months: 12,
      levels: [
        { name: 'Bronze', minPoints: 0 },
        { name: 'Silver', minPoints: 1000 },
        { name: 'Gold', minPoints: 5000 },
        { name: 'Platinum', minPoints: 20000 }
      ]
    }
  });

  // ==========================================================================
  // 9. REWARD_CATEGORIES
  // ==========================================================================
  console.log('🏷️  Creando categorias de recompensas...');
  await prisma.reward_categories.createMany({
    data: [
      { id: '33300001-0000-0000-0000-000000000001', name: 'Descuentos', description: 'Descuentos en servicios y productos', icon: 'ticket', color: '#10B981', active: true },
      { id: '33300002-0000-0000-0000-000000000001', name: 'Merchandising', description: 'Productos promocionales de Futurismo', icon: 'shopping-cart', color: '#F59E0B', active: true },
      { id: '33300003-0000-0000-0000-000000000001', name: 'Experiencias', description: 'Tours y experiencias exclusivas', icon: 'sparkles', color: '#8B5CF6', active: true },
      { id: '33300004-0000-0000-0000-000000000001', name: 'Servicios Premium', description: 'Servicios premium para agencias', icon: 'credit-card', color: '#3B82F6', active: true }
    ]
  });

  // ==========================================================================
  // 11. REWARDS
  // ==========================================================================
  console.log('🎁 Creando recompensas...');
  await prisma.rewards.createMany({
    data: [
      { id: '44400001-0000-0000-0000-000000000001', name: 'Descuento 10% en Tours', description: '10% de descuento en cualquier tour', points: 500, stock: 100, category_id: '33300001-0000-0000-0000-000000000001', image: '/images/rewards/discount10.jpg', active: true },
      { id: '44400002-0000-0000-0000-000000000001', name: 'Descuento 20% en Tours', description: '20% de descuento en cualquier tour', points: 1000, stock: 50, category_id: '33300001-0000-0000-0000-000000000001', image: '/images/rewards/discount20.jpg', active: true },
      { id: '44400003-0000-0000-0000-000000000001', name: 'Polo Futurismo', description: 'Polo oficial de Futurismo talla M, L o XL', points: 300, stock: 200, category_id: '33300002-0000-0000-0000-000000000001', image: '/images/rewards/polo.jpg', active: true },
      { id: '44400004-0000-0000-0000-000000000001', name: 'Gorra Futurismo', description: 'Gorra oficial bordada', points: 200, stock: 150, category_id: '33300002-0000-0000-0000-000000000001', image: '/images/rewards/gorra.jpg', active: true },
      { id: '44400005-0000-0000-0000-000000000001', name: 'Tour VIP Gratis', description: 'Un tour VIP completamente gratis para 2 personas', points: 5000, stock: 10, category_id: '33300003-0000-0000-0000-000000000001', image: '/images/rewards/tour-vip.jpg', active: true },
      { id: '44400006-0000-0000-0000-000000000001', name: 'Cena Gourmet', description: 'Cena para 2 en restaurante partner', points: 3000, stock: 20, category_id: '33300003-0000-0000-0000-000000000001', image: '/images/rewards/cena.jpg', active: true },
      { id: '44400007-0000-0000-0000-000000000001', name: 'Prioridad en Reservas', description: 'Prioridad en asignacion de guias por 1 mes', points: 2000, stock: 30, category_id: '33300004-0000-0000-0000-000000000001', image: '/images/rewards/prioridad.jpg', active: true },
      { id: '44400008-0000-0000-0000-000000000001', name: 'Soporte Dedicado', description: 'Linea de soporte exclusiva por 3 meses', points: 4000, stock: 15, category_id: '33300004-0000-0000-0000-000000000001', image: '/images/rewards/soporte.jpg', active: true }
    ]
  });

  // ==========================================================================
  // 12. PROVIDER_CATEGORIES
  // ==========================================================================
  console.log('📦 Creando categorias de proveedores...');
  await prisma.provider_categories.createMany({
    data: [
      { id: '55500001-0000-0000-0000-000000000001', name: 'Restaurantes', description: 'Restaurantes y servicios de alimentacion', icon: 'restaurant', color: '#FF5722', is_active: true },
      { id: '55500002-0000-0000-0000-000000000001', name: 'Transporte', description: 'Servicios de transporte turistico', icon: 'directions_bus', color: '#2196F3', is_active: true },
      { id: '55500003-0000-0000-0000-000000000001', name: 'Hoteles', description: 'Alojamiento y hospedaje', icon: 'hotel', color: '#9C27B0', is_active: true },
      { id: '55500004-0000-0000-0000-000000000001', name: 'Entretenimiento', description: 'Shows, museos y atracciones', icon: 'theater_comedy', color: '#4CAF50', is_active: true },
      { id: '55500005-0000-0000-0000-000000000001', name: 'Equipamiento', description: 'Alquiler de equipos para tours', icon: 'sports', color: '#FF9800', is_active: true }
    ]
  });

  // ==========================================================================
  // 13. LOCATIONS
  // ==========================================================================
  console.log('🌍 Creando ubicaciones...');
  await prisma.locations.createMany({
    data: [
      { id: '66600001-0000-0000-0000-000000000001', parent_id: null, name: 'Peru', type: 'country', code: 'PE', latitude: -9.1900, longitude: -75.0152, is_active: true, path: 'Peru' },
      { id: '66600002-0000-0000-0000-000000000001', parent_id: '66600001-0000-0000-0000-000000000001', name: 'Lima', type: 'department', code: 'LIM', latitude: -12.0464, longitude: -77.0428, is_active: true, path: 'Peru/Lima' },
      { id: '66600003-0000-0000-0000-000000000001', parent_id: '66600001-0000-0000-0000-000000000001', name: 'Callao', type: 'department', code: 'CAL', latitude: -12.0566, longitude: -77.1181, is_active: true, path: 'Peru/Callao' },
      { id: '66600004-0000-0000-0000-000000000001', parent_id: '66600001-0000-0000-0000-000000000001', name: 'Cusco', type: 'department', code: 'CUS', latitude: -13.5320, longitude: -71.9675, is_active: true, path: 'Peru/Cusco' },
      { id: '66600005-0000-0000-0000-000000000001', parent_id: '66600002-0000-0000-0000-000000000001', name: 'Lima Metropolitana', type: 'province', code: 'LIM-MET', latitude: -12.0464, longitude: -77.0428, is_active: true, path: 'Peru/Lima/Lima Metropolitana' },
      { id: '66600006-0000-0000-0000-000000000001', parent_id: '66600005-0000-0000-0000-000000000001', name: 'Miraflores', type: 'district', code: 'MIR', latitude: -12.1219, longitude: -77.0299, is_active: true, path: 'Peru/Lima/Lima Metropolitana/Miraflores' },
      { id: '66600007-0000-0000-0000-000000000001', parent_id: '66600005-0000-0000-0000-000000000001', name: 'San Isidro', type: 'district', code: 'SIS', latitude: -12.0978, longitude: -77.0365, is_active: true, path: 'Peru/Lima/Lima Metropolitana/San Isidro' },
      { id: '66600008-0000-0000-0000-000000000001', parent_id: '66600005-0000-0000-0000-000000000001', name: 'Barranco', type: 'district', code: 'BAR', latitude: -12.1464, longitude: -77.0219, is_active: true, path: 'Peru/Lima/Lima Metropolitana/Barranco' },
      { id: '66600009-0000-0000-0000-000000000001', parent_id: '66600005-0000-0000-0000-000000000001', name: 'Centro de Lima', type: 'district', code: 'CEN', latitude: -12.0464, longitude: -77.0300, is_active: true, path: 'Peru/Lima/Lima Metropolitana/Centro de Lima' },
      { id: '66600010-0000-0000-0000-000000000001', parent_id: '66600005-0000-0000-0000-000000000001', name: 'Surco', type: 'district', code: 'SUR', latitude: -12.1358, longitude: -76.9880, is_active: true, path: 'Peru/Lima/Lima Metropolitana/Surco' }
    ]
  });

  // ==========================================================================
  // 14. PROVIDERS
  // ==========================================================================
  console.log('🏪 Creando proveedores...');
  await prisma.providers.createMany({
    data: [
      { id: '77700001-0000-0000-0000-000000000001', name: 'La Mar Cebicheria', category_id: '55500001-0000-0000-0000-000000000001', location_id: '66600006-0000-0000-0000-000000000001', address: 'Av. La Mar 770, Miraflores', phone: '+5116219960', email: 'reservas@lamarcebicheria.com', contact_name: 'Jorge Garcia', rating: 4.8, description: 'Cebicheria premium de Gaston Acurio', capacity: 80, price_type: 'per_person', base_price: 45.00, currency: 'USD', status: 'active' },
      { id: '77700002-0000-0000-0000-000000000001', name: 'Huaca Pucllana Restaurant', category_id: '55500001-0000-0000-0000-000000000001', location_id: '66600006-0000-0000-0000-000000000001', address: 'General Borgono cdra. 8, Miraflores', phone: '+5614450042', email: 'eventos@huacapucllana.com', contact_name: 'Maria Torres', rating: 4.7, description: 'Restaurante junto a la huaca iluminada', capacity: 100, price_type: 'per_person', base_price: 55.00, currency: 'USD', status: 'active' },
      { id: '77700003-0000-0000-0000-000000000001', name: 'TransTur Peru', category_id: '55500002-0000-0000-0000-000000000001', location_id: '66600007-0000-0000-0000-000000000001', address: 'Av. Javier Prado 2020, San Isidro', phone: '+5117020000', email: 'reservas@transturperu.com', contact_name: 'Carlos Mendez', rating: 4.5, description: 'Transporte turistico ejecutivo', capacity: 45, price_type: 'per_vehicle', base_price: 150.00, currency: 'USD', status: 'active' },
      { id: '77700004-0000-0000-0000-000000000001', name: 'Museo Larco', category_id: '55500004-0000-0000-0000-000000000001', location_id: '66600009-0000-0000-0000-000000000001', address: 'Av. Bolivar 1515, Pueblo Libre', phone: '+5614611312', email: 'visitas@museolarco.org', contact_name: 'Ana Quispe', rating: 4.9, description: 'Museo de arte precolombino', capacity: 200, price_type: 'per_person', base_price: 15.00, currency: 'USD', status: 'active' },
      { id: '77700005-0000-0000-0000-000000000001', name: 'Bike Tours Lima', category_id: '55500005-0000-0000-0000-000000000001', location_id: '66600008-0000-0000-0000-000000000001', address: 'Malecon Armendariz 100, Barranco', phone: '+51999555666', email: 'info@biketourslima.com', contact_name: 'Pedro Ramos', rating: 4.6, description: 'Alquiler de bicicletas y tours en bici', capacity: 30, price_type: 'per_person', base_price: 25.00, currency: 'USD', status: 'active' }
    ]
  });

  // ==========================================================================
  // 15. DRIVERS
  // ==========================================================================
  console.log('🚗 Creando choferes...');
  const licenseExpiry1Year = new Date();
  licenseExpiry1Year.setFullYear(licenseExpiry1Year.getFullYear() + 1);
  const licenseExpiry2Years = new Date();
  licenseExpiry2Years.setFullYear(licenseExpiry2Years.getFullYear() + 2);
  const licenseExpiry6Months = new Date();
  licenseExpiry6Months.setMonth(licenseExpiry6Months.getMonth() + 6);
  const licenseExpiry18Months = new Date();
  licenseExpiry18Months.setMonth(licenseExpiry18Months.getMonth() + 18);

  await prisma.drivers.createMany({
    data: [
      { id: 'aaa00001-0000-0000-0000-000000000001', first_name: 'Jorge', last_name: 'Paredes', document_type: 'DNI', document_number: '23456789', phone: '+51987111222', email: 'jorge.paredes@email.com', license_number: 'A2-12345678', license_category: 'A-IIb', license_expiry: licenseExpiry1Year, status: 'active' },
      { id: 'aaa00002-0000-0000-0000-000000000001', first_name: 'Luis', last_name: 'Fernandez', document_type: 'DNI', document_number: '34567890', phone: '+51987222333', email: 'luis.fernandez@email.com', license_number: 'A2-23456789', license_category: 'A-IIb', license_expiry: licenseExpiry2Years, status: 'active' },
      { id: 'aaa00003-0000-0000-0000-000000000001', first_name: 'Ricardo', last_name: 'Castro', document_type: 'DNI', document_number: '45678901', phone: '+51987333444', email: 'ricardo.castro@email.com', license_number: 'A2-34567890', license_category: 'A-IIIa', license_expiry: licenseExpiry6Months, status: 'active' },
      { id: 'aaa00004-0000-0000-0000-000000000001', first_name: 'Manuel', last_name: 'Vargas', document_type: 'DNI', document_number: '56789012', phone: '+51987444555', email: 'manuel.vargas@email.com', license_number: 'A2-45678901', license_category: 'A-IIb', license_expiry: licenseExpiry18Months, status: 'active' }
    ]
  });

  // ==========================================================================
  // 16. VEHICLES
  // ==========================================================================
  console.log('🚐 Creando vehiculos...');
  await prisma.vehicles.createMany({
    data: [
      { id: 'bbb00001-0000-0000-0000-000000000001', plate: 'ABC-123', brand: 'Toyota', model: 'Hiace', year: 2022, capacity: 15, vehicle_type: 'van', color: 'Blanco', status: 'active' },
      { id: 'bbb00002-0000-0000-0000-000000000001', plate: 'DEF-456', brand: 'Mercedes-Benz', model: 'Sprinter', year: 2021, capacity: 19, vehicle_type: 'minibus', color: 'Plata', status: 'active' },
      { id: 'bbb00003-0000-0000-0000-000000000001', plate: 'GHI-789', brand: 'Hyundai', model: 'H1', year: 2023, capacity: 12, vehicle_type: 'van', color: 'Negro', status: 'active' },
      { id: 'bbb00004-0000-0000-0000-000000000001', plate: 'JKL-012', brand: 'Toyota', model: 'Coaster', year: 2020, capacity: 30, vehicle_type: 'bus', color: 'Blanco', status: 'active' }
    ]
  });

  // ==========================================================================
  // 17. RESERVATIONS
  // ==========================================================================
  console.log('📅 Creando reservaciones...');
  const today = new Date();
  const date2Days = new Date(today); date2Days.setDate(date2Days.getDate() + 2);
  const date3Days = new Date(today); date3Days.setDate(date3Days.getDate() + 3);
  const date4Days = new Date(today); date4Days.setDate(date4Days.getDate() + 4);
  const date5Days = new Date(today); date5Days.setDate(date5Days.getDate() + 5);
  const date6Days = new Date(today); date6Days.setDate(date6Days.getDate() + 6);
  const date7Days = new Date(today); date7Days.setDate(date7Days.getDate() + 7);
  const dateMinus5 = new Date(today); dateMinus5.setDate(dateMinus5.getDate() - 5);
  const dateMinus3 = new Date(today); dateMinus3.setDate(dateMinus3.getDate() - 3);
  const dateMinus1 = new Date(today); dateMinus1.setDate(dateMinus1.getDate() - 1);

  await prisma.reservations.createMany({
    data: [
      { id: '99900001-0000-0000-0000-000000000001', tour_id: 'f6000001-0000-0000-0000-000000000001', agency_id: 'd4000001-0000-0000-0000-000000000001', date: date2Days, time: new Date('1970-01-01T09:00:00'), adults: 2, children: 0, participants: 2, special_requirements: 'Vegetarian meals required', status: 'confirmed', total_amount: 90.00, payment_method: 'credit_card', payment_status: 'paid', guide_id: 'e5000001-0000-0000-0000-000000000001', billing_name: 'John Smith', notes: 'Cliente VIP', created_by: 'b2000001-0000-0000-0000-000000000001' },
      { id: '99900002-0000-0000-0000-000000000001', tour_id: 'f6000002-0000-0000-0000-000000000001', agency_id: 'd4000001-0000-0000-0000-000000000001', date: date3Days, time: new Date('1970-01-01T11:00:00'), adults: 3, children: 1, participants: 4, pickup_location: 'Hotel Marriott Miraflores', special_requirements: 'Alergia a mariscos en 1 persona', status: 'confirmed', total_amount: 295.00, payment_method: 'bank_transfer', payment_status: 'paid', guide_id: 'e5000006-0000-0000-0000-000000000001', billing_name: 'Marie Dupont', created_by: 'b2000001-0000-0000-0000-000000000001' },
      { id: '99900003-0000-0000-0000-000000000001', tour_id: 'f6000003-0000-0000-0000-000000000001', agency_id: 'd4000002-0000-0000-0000-000000000001', date: date4Days, time: new Date('1970-01-01T08:30:00'), adults: 2, children: 2, participants: 4, pickup_location: 'JW Marriott Lima', status: 'pending', total_amount: 200.00, payment_method: 'cash', payment_status: 'pending', billing_name: 'Hans Mueller', notes: 'Confirmar pago antes del tour', created_by: 'b2000002-0000-0000-0000-000000000001' },
      { id: '99900004-0000-0000-0000-000000000001', tour_id: 'f6000005-0000-0000-0000-000000000001', agency_id: 'd4000002-0000-0000-0000-000000000001', date: date5Days, time: new Date('1970-01-01T09:00:00'), adults: 4, children: 0, participants: 4, pickup_location: 'Hilton Lima', special_requirements: 'Grupo de ejecutivos', status: 'confirmed', total_amount: 480.00, payment_method: 'credit_card', payment_status: 'paid', guide_id: 'e5000003-0000-0000-0000-000000000001', billing_name: 'Joao Silva', notes: 'Tour corporativo', created_by: 'b2000002-0000-0000-0000-000000000001' },
      { id: '99900005-0000-0000-0000-000000000001', tour_id: 'f6000004-0000-0000-0000-000000000001', agency_id: 'd4000003-0000-0000-0000-000000000001', date: date6Days, time: new Date('1970-01-01T18:00:00'), adults: 2, children: 0, participants: 2, status: 'pending', total_amount: 110.00, payment_method: 'cash', payment_status: 'pending', billing_name: 'Maria Garcia', created_by: 'b2000003-0000-0000-0000-000000000001' },
      { id: '99900006-0000-0000-0000-000000000001', tour_id: 'f6000007-0000-0000-0000-000000000001', agency_id: 'd4000004-0000-0000-0000-000000000001', date: date7Days, time: new Date('1970-01-01T07:30:00'), adults: 2, children: 0, participants: 2, pickup_location: 'Costa del Sol Lima Airport', special_requirements: 'Necesitan traje de neopreno XL', status: 'confirmed', total_amount: 190.00, payment_method: 'credit_card', payment_status: 'paid', guide_id: 'e5000002-0000-0000-0000-000000000001', billing_name: 'Emma Wilson', notes: 'Primera vez nadando con lobos', created_by: 'b2000004-0000-0000-0000-000000000001' },
      { id: '99900007-0000-0000-0000-000000000001', tour_id: 'f6000001-0000-0000-0000-000000000001', agency_id: 'd4000004-0000-0000-0000-000000000001', date: dateMinus5, time: new Date('1970-01-01T09:00:00'), adults: 2, children: 1, participants: 3, status: 'completed', total_amount: 115.00, payment_method: 'credit_card', payment_status: 'paid', guide_id: 'e5000001-0000-0000-0000-000000000001', billing_name: 'Yuki Tanaka', created_by: 'b2000004-0000-0000-0000-000000000001' },
      { id: '99900008-0000-0000-0000-000000000001', tour_id: 'f6000002-0000-0000-0000-000000000001', agency_id: 'd4000004-0000-0000-0000-000000000001', date: dateMinus3, time: new Date('1970-01-01T12:00:00'), adults: 4, children: 0, participants: 4, pickup_location: 'Westin Lima', status: 'completed', total_amount: 340.00, payment_method: 'bank_transfer', payment_status: 'paid', guide_id: 'e5000006-0000-0000-0000-000000000001', billing_name: 'Alessandro Rossi', notes: 'Excelente servicio', created_by: 'b2000004-0000-0000-0000-000000000001' },
      { id: '99900009-0000-0000-0000-000000000001', tour_id: 'f6000006-0000-0000-0000-000000000001', agency_id: 'd4000001-0000-0000-0000-000000000001', date: dateMinus1, time: new Date('1970-01-01T19:00:00'), adults: 2, children: 2, participants: 4, pickup_location: 'Hotel Antigua Miraflores', status: 'completed', total_amount: 110.00, payment_method: 'cash', payment_status: 'paid', guide_id: 'e5000004-0000-0000-0000-000000000001', billing_name: 'Sophie Martin', created_by: 'b2000001-0000-0000-0000-000000000001' },
      { id: '99900010-0000-0000-0000-000000000001', tour_id: 'f6000008-0000-0000-0000-000000000001', agency_id: 'd4000003-0000-0000-0000-000000000001', date: today, time: new Date('1970-01-01T10:00:00'), adults: 2, children: 0, participants: 2, status: 'in_progress', total_amount: 150.00, payment_method: 'credit_card', payment_status: 'paid', guide_id: 'e5000006-0000-0000-0000-000000000001', billing_name: 'Carlos Rodriguez', notes: 'Clase de cocina', created_by: 'b2000003-0000-0000-0000-000000000001' }
    ]
  });

  // ==========================================================================
  // 18. EMERGENCY_CATEGORIES
  // ==========================================================================
  console.log('🚨 Creando categorias de emergencia...');
  await prisma.emergency_categories.createMany({
    data: [
      { id: 'eee00001-0000-0000-0000-000000000001', name: 'Accidente Vehicular', description: 'Accidente de transito durante el tour', icon: 'car_crash', severity_level: 5, is_active: true, color: '#EF4444' },
      { id: 'eee00002-0000-0000-0000-000000000001', name: 'Emergencia Medica', description: 'Problema de salud de un pasajero', icon: 'medical_services', severity_level: 4, is_active: true, color: '#EF4444' },
      { id: 'eee00003-0000-0000-0000-000000000001', name: 'Turista Perdido', description: 'Pasajero que se separo del grupo', icon: 'person_search', severity_level: 3, is_active: true, color: '#EF4444' },
      { id: 'eee00004-0000-0000-0000-000000000001', name: 'Robo/Asalto', description: 'Incidente de seguridad ciudadana', icon: 'security', severity_level: 4, is_active: true, color: '#EF4444' },
      { id: 'eee00005-0000-0000-0000-000000000001', name: 'Desastre Natural', description: 'Sismo, inundacion u otro evento natural', icon: 'warning', severity_level: 5, is_active: true, color: '#EF4444' },
      { id: 'eee00006-0000-0000-0000-000000000001', name: 'Falla de Vehiculo', description: 'Desperfecto mecanico del transporte', icon: 'car_repair', severity_level: 2, is_active: true, color: '#EF4444' }
    ]
  });

  // ==========================================================================
  // 19. PROTOCOLS
  // ==========================================================================
  console.log('📋 Creando protocolos...');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await prisma.protocols.createMany({
    data: [
      { id: 'fff00001-0000-0000-0000-000000000001', category_id: 'eee00001-0000-0000-0000-000000000001', title: 'Protocolo Accidente Vehicular', description: 'Procedimiento ante accidente de transito', version: '1.0', status: 'active', created_by: 'a1000001-0000-0000-0000-000000000001', approved_by: 'a1000001-0000-0000-0000-000000000001', approved_at: thirtyDaysAgo },
      { id: 'fff00002-0000-0000-0000-000000000001', category_id: 'eee00002-0000-0000-0000-000000000001', title: 'Protocolo Emergencia Medica', description: 'Procedimiento ante problema de salud', version: '1.0', status: 'active', created_by: 'a1000001-0000-0000-0000-000000000001', approved_by: 'a1000001-0000-0000-0000-000000000001', approved_at: thirtyDaysAgo },
      { id: 'fff00003-0000-0000-0000-000000000001', category_id: 'eee00003-0000-0000-0000-000000000001', title: 'Protocolo Turista Perdido', description: 'Procedimiento ante perdida de pasajero', version: '1.0', status: 'active', created_by: 'a1000001-0000-0000-0000-000000000001', approved_by: 'a1000001-0000-0000-0000-000000000001', approved_at: thirtyDaysAgo }
    ]
  });

  // ==========================================================================
  // 20. PROTOCOL_STEPS
  // ==========================================================================
  console.log('📝 Creando pasos de protocolos...');
  await prisma.protocol_steps.createMany({
    data: [
      { id: '11000001-0000-0000-0000-000000000001', protocol_id: 'fff00001-0000-0000-0000-000000000001', step_number: 1, title: 'Asegurar la escena', description: 'Verificar seguridad de todos los pasajeros', is_critical: true },
      { id: '11000002-0000-0000-0000-000000000001', protocol_id: 'fff00001-0000-0000-0000-000000000001', step_number: 2, title: 'Llamar a emergencias', description: 'Contactar al 105 (policia) y 116 (bomberos)', is_critical: true },
      { id: '11000003-0000-0000-0000-000000000001', protocol_id: 'fff00001-0000-0000-0000-000000000001', step_number: 3, title: 'Notificar a central', description: 'Informar a la central de operaciones via app', is_critical: true },
      { id: '11000004-0000-0000-0000-000000000001', protocol_id: 'fff00002-0000-0000-0000-000000000001', step_number: 1, title: 'Evaluar situacion', description: 'Determinar gravedad y si requiere atencion inmediata', is_critical: true },
      { id: '11000005-0000-0000-0000-000000000001', protocol_id: 'fff00002-0000-0000-0000-000000000001', step_number: 2, title: 'Primeros auxilios', description: 'Aplicar primeros auxilios basicos si esta capacitado', is_critical: false },
      { id: '11000006-0000-0000-0000-000000000001', protocol_id: 'fff00002-0000-0000-0000-000000000001', step_number: 3, title: 'Llamar SAMU', description: 'Contactar al 106 para asistencia medica', is_critical: true },
      { id: '11000007-0000-0000-0000-000000000001', protocol_id: 'fff00003-0000-0000-0000-000000000001', step_number: 1, title: 'Contar pasajeros', description: 'Verificar lista de pasajeros y determinar quien falta', is_critical: true },
      { id: '11000008-0000-0000-0000-000000000001', protocol_id: 'fff00003-0000-0000-0000-000000000001', step_number: 2, title: 'Contactar al turista', description: 'Llamar al telefono registrado del pasajero', is_critical: true },
      { id: '11000009-0000-0000-0000-000000000001', protocol_id: 'fff00003-0000-0000-0000-000000000001', step_number: 3, title: 'Busqueda en zona', description: 'Revisar ultimo punto donde se vio al pasajero', is_critical: false }
    ]
  });

  // ==========================================================================
  // 21. EMERGENCY_CONTACTS
  // ==========================================================================
  console.log('📞 Creando contactos de emergencia...');
  await prisma.emergency_contacts.createMany({
    data: [
      { id: '12000001-0000-0000-0000-000000000001', name: 'Policia Nacional - Central', contact_type: 'police', phone: '105', phone_secondary: '+5114750022', address: 'Av. Espana 323, Lima', location_id: '66600009-0000-0000-0000-000000000001', is_24_hours: true, notes: 'Linea de emergencias nacional', is_active: true },
      { id: '12000002-0000-0000-0000-000000000001', name: 'Bomberos Lima', contact_type: 'fire', phone: '116', phone_secondary: '+5114816000', address: 'Jr. Angaraes 278, Lima', location_id: '66600009-0000-0000-0000-000000000001', is_24_hours: true, notes: 'Compania de Bomberos Voluntarios', is_active: true },
      { id: '12000003-0000-0000-0000-000000000001', name: 'SAMU - Emergencias Medicas', contact_type: 'medical', phone: '106', phone_secondary: '+5116119000', location_id: '66600005-0000-0000-0000-000000000001', is_24_hours: true, notes: 'Sistema de Atencion Movil de Urgencias', is_active: true },
      { id: '12000004-0000-0000-0000-000000000001', name: 'Clinica Anglo Americana', contact_type: 'hospital', phone: '+5116189000', phone_secondary: '+5116189100', address: 'Av. Alfredo Salazar 350, San Isidro', location_id: '66600007-0000-0000-0000-000000000001', is_24_hours: true, notes: 'Clinica privada con emergencias 24h', is_active: true },
      { id: '12000005-0000-0000-0000-000000000001', name: 'Hospital Rebagliati', contact_type: 'hospital', phone: '+5112654901', address: 'Av. Edgardo Rebagliati 490, Jesus Maria', location_id: '66600005-0000-0000-0000-000000000001', is_24_hours: true, notes: 'Hospital EsSalud - Emergencias', is_active: true }
    ]
  });

  // ==========================================================================
  // 22. RATINGS
  // ==========================================================================
  console.log('⭐ Creando calificaciones...');
  await prisma.ratings.createMany({
    data: [
      { id: '16000001-0000-0000-0000-000000000001', reservation_id: '99900007-0000-0000-0000-000000000001', rated_by_id: 'b2000004-0000-0000-0000-000000000001', guide_rating: 5, overall_rating: 5, comment: 'Carlos es un excelente guia, muy conocedor de la historia de Lima.' },
      { id: '16000002-0000-0000-0000-000000000001', reservation_id: '99900008-0000-0000-0000-000000000001', rated_by_id: 'b2000004-0000-0000-0000-000000000001', guide_rating: 5, overall_rating: 5, comment: 'Maria hizo que la experiencia gastronomica fuera inolvidable.' },
      { id: '16000003-0000-0000-0000-000000000001', reservation_id: '99900009-0000-0000-0000-000000000001', rated_by_id: 'b2000001-0000-0000-0000-000000000001', guide_rating: 4, overall_rating: 4, comment: 'Muy buen tour, Rosa es muy amable con los ninios.' }
    ]
  });

  // ==========================================================================
  // 23. ACTIVE_TOURS (Tours en curso para monitoreo en mapa)
  // ==========================================================================
  console.log('🗺️  Creando tours activos para monitoreo...');
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  await prisma.active_tours.createMany({
    data: [
      {
        id: 'aa000001-0000-0000-0000-000000000099',
        reservation_id: '99900010-0000-0000-0000-000000000001',
        guide_id: 'e5000006-0000-0000-0000-000000000001',
        status: 'in_progress',
        started_at: twoHoursAgo,
        current_stop_index: 2
      },
      {
        id: 'aa000002-0000-0000-0000-000000000099',
        reservation_id: '99900004-0000-0000-0000-000000000001',
        guide_id: 'e5000003-0000-0000-0000-000000000001',
        status: 'in_progress',
        started_at: oneHourAgo,
        current_stop_index: 1
      },
      {
        id: 'aa000003-0000-0000-0000-000000000099',
        reservation_id: '99900006-0000-0000-0000-000000000001',
        guide_id: 'e5000002-0000-0000-0000-000000000001',
        status: 'in_progress',
        started_at: thirtyMinAgo,
        current_stop_index: 1
      }
    ]
  });

  // ==========================================================================
  // 24. GUIDE_LOCATIONS (Ubicaciones GPS de guias activos)
  // ==========================================================================
  console.log('📍 Creando ubicaciones de guias...');
  await prisma.guide_locations.createMany({
    data: [
      {
        id: 'bb000001-0000-0000-0000-000000000099',
        active_tour_id: 'aa000001-0000-0000-0000-000000000099',
        latitude: -12.0464,
        longitude: -77.0300,
        accuracy: 10,
        speed: 5,
        recorded_at: new Date(now.getTime() - 5000)
      },
      {
        id: 'bb000002-0000-0000-0000-000000000099',
        active_tour_id: 'aa000002-0000-0000-0000-000000000099',
        latitude: -12.1191,
        longitude: -77.0300,
        accuracy: 8,
        speed: 0,
        recorded_at: new Date(now.getTime() - 3000)
      },
      {
        id: 'bb000003-0000-0000-0000-000000000099',
        active_tour_id: 'aa000003-0000-0000-0000-000000000099',
        latitude: -12.1500,
        longitude: -77.0219,
        accuracy: 12,
        speed: 3,
        recorded_at: new Date(now.getTime() - 2000)
      }
    ]
  });

  // ==========================================================================
  // 25. TERMS AND CONDITIONS (Términos y Condiciones)
  // ==========================================================================
  console.log('📜 Creando términos y condiciones...');
  const effectiveDate = new Date();
  effectiveDate.setDate(effectiveDate.getDate() - 30); // Efectivo hace 30 días

  await prisma.terms_and_conditions.createMany({
    data: [
      {
        id: 'ccc00001-0000-0000-0000-000000000001',
        type: 'terms',
        version: '1.0',
        title: 'Términos y Condiciones de Uso',
        content: `
<h2>1. Aceptación de los Términos</h2>
<p>Al registrarse y utilizar la plataforma Futurismo como guía freelance, usted acepta estar legalmente vinculado por estos Términos y Condiciones. Si no está de acuerdo con alguno de estos términos, no debe utilizar nuestros servicios.</p>

<h2>2. Descripción del Servicio</h2>
<p>Futurismo es una plataforma que conecta guías turísticos freelance con agencias de turismo para la prestación de servicios de guiado. La plataforma facilita:</p>
<ul>
  <li>Registro y verificación de guías profesionales</li>
  <li>Conexión con agencias de turismo</li>
  <li>Gestión de reservaciones y pagos</li>
  <li>Seguimiento de tours en tiempo real</li>
</ul>

<h2>3. Requisitos para Guías</h2>
<p>Para registrarse como guía en la plataforma, debe:</p>
<ul>
  <li>Ser mayor de 18 años</li>
  <li>Poseer licencia de guía turístico vigente emitida por MINCETUR</li>
  <li>Contar con documento de identidad válido</li>
  <li>Proporcionar información veraz y actualizada</li>
  <li>Mantener un comportamiento profesional y ético</li>
</ul>

<h2>4. Obligaciones del Guía</h2>
<p>Como guía registrado, usted se compromete a:</p>
<ul>
  <li>Cumplir puntualmente con los tours asignados</li>
  <li>Mantener actualizada su información de perfil</li>
  <li>Reportar cualquier incidente durante los tours</li>
  <li>Seguir los protocolos de emergencia establecidos</li>
  <li>Mantener confidencialidad de la información de clientes</li>
</ul>

<h2>5. Pagos y Comisiones</h2>
<p>Futurismo retendrá una comisión del 10% sobre cada servicio completado. Los pagos se procesarán dentro de los 7 días hábiles posteriores a la finalización del tour.</p>

<h2>6. Cancelaciones</h2>
<p>Las cancelaciones deben realizarse con al menos 24 horas de anticipación. Cancelaciones tardías o no presentarse pueden resultar en penalizaciones según el siguiente esquema:</p>
<ul>
  <li>Primera vez: Advertencia</li>
  <li>Segunda vez: Suspensión de 7 días</li>
  <li>Tercera vez: Suspensión indefinida de la cuenta</li>
</ul>

<h2>7. Propiedad Intelectual</h2>
<p>Todo el contenido de la plataforma, incluyendo logos, diseños y software, es propiedad de Futurismo y está protegido por leyes de propiedad intelectual.</p>

<h2>8. Limitación de Responsabilidad</h2>
<p>Futurismo actúa únicamente como intermediario y no será responsable por daños directos, indirectos o consecuentes derivados de la prestación de servicios de guiado.</p>

<h2>9. Modificaciones</h2>
<p>Futurismo se reserva el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la plataforma con al menos 15 días de anticipación.</p>

<h2>10. Contacto</h2>
<p>Para consultas sobre estos términos, puede contactarnos en: soporte@futurismo.pe</p>

<p><em>Última actualización: ${effectiveDate.toLocaleDateString('es-PE')}</em></p>
        `.trim(),
        is_active: true,
        effective_date: effectiveDate,
        created_by: 'a1000001-0000-0000-0000-000000000001'
      },
      {
        id: 'ccc00002-0000-0000-0000-000000000001',
        type: 'privacy',
        version: '1.0',
        title: 'Política de Privacidad',
        content: `
<h2>1. Información que Recopilamos</h2>
<p>En Futurismo recopilamos la siguiente información personal:</p>
<ul>
  <li><strong>Datos de identificación:</strong> Nombre completo, DNI/CE, fecha de nacimiento</li>
  <li><strong>Datos de contacto:</strong> Email, teléfono, dirección</li>
  <li><strong>Datos profesionales:</strong> Licencia de guía, experiencia, idiomas, especialidades</li>
  <li><strong>Datos bancarios:</strong> Para procesar pagos de servicios</li>
  <li><strong>Datos de ubicación:</strong> GPS durante la ejecución de tours (con su consentimiento)</li>
</ul>

<h2>2. Uso de la Información</h2>
<p>Utilizamos su información para:</p>
<ul>
  <li>Verificar su identidad y credenciales profesionales</li>
  <li>Conectarlo con agencias de turismo</li>
  <li>Procesar pagos por servicios prestados</li>
  <li>Proporcionar seguimiento en tiempo real durante tours</li>
  <li>Enviar notificaciones relevantes sobre la plataforma</li>
  <li>Mejorar nuestros servicios mediante análisis estadísticos</li>
</ul>

<h2>3. Compartición de Datos</h2>
<p>Compartimos su información únicamente con:</p>
<ul>
  <li>Agencias de turismo (perfil profesional limitado)</li>
  <li>Proveedores de servicios de pago</li>
  <li>Autoridades competentes cuando sea requerido por ley</li>
</ul>

<h2>4. Seguridad de Datos</h2>
<p>Implementamos medidas de seguridad técnicas y organizativas para proteger su información:</p>
<ul>
  <li>Encriptación de datos en tránsito y en reposo</li>
  <li>Acceso restringido a datos personales</li>
  <li>Monitoreo continuo de sistemas</li>
  <li>Copias de seguridad regulares</li>
</ul>

<h2>5. Retención de Datos</h2>
<p>Mantenemos su información personal mientras su cuenta esté activa. Tras la eliminación de su cuenta, conservaremos ciertos datos por un período de 5 años para cumplir con obligaciones legales.</p>

<h2>6. Sus Derechos</h2>
<p>Conforme a la Ley N° 29733, Ley de Protección de Datos Personales del Perú, usted tiene derecho a:</p>
<ul>
  <li>Acceder a sus datos personales</li>
  <li>Rectificar datos inexactos</li>
  <li>Cancelar su información (con ciertas excepciones legales)</li>
  <li>Oponerse al tratamiento de sus datos</li>
</ul>

<h2>7. Cookies y Tecnologías Similares</h2>
<p>Utilizamos cookies para mejorar la experiencia de usuario y analizar el uso de la plataforma. Puede configurar su navegador para rechazar cookies, aunque esto puede afectar la funcionalidad del servicio.</p>

<h2>8. Cambios a esta Política</h2>
<p>Podemos actualizar esta política periódicamente. Le notificaremos cualquier cambio significativo a través de la plataforma o por email.</p>

<h2>9. Contacto</h2>
<p>Para ejercer sus derechos o realizar consultas sobre privacidad:<br>
Email: privacidad@futurismo.pe<br>
Dirección: Av. Larco 123, Miraflores, Lima, Perú</p>

<p><em>Última actualización: ${effectiveDate.toLocaleDateString('es-PE')}</em></p>
        `.trim(),
        is_active: true,
        effective_date: effectiveDate,
        created_by: 'a1000001-0000-0000-0000-000000000001'
      }
    ]
  });

  // ==========================================================================
  // RESUMEN FINAL
  // ==========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('✨ SEED COMPLETADO EXITOSAMENTE');
  console.log('='.repeat(60));

  const counts = {
    roles: await prisma.roles.count(),
    users: await prisma.users.count(),
    permissions: await prisma.permissions.count(),
    agencies: await prisma.agencies.count(),
    guides: await prisma.guides.count(),
    tours: await prisma.tours.count(),
    tour_categories: await prisma.tour_categories.count(),
    reservations: await prisma.reservations.count(),
    active_tours: await prisma.active_tours.count(),
    guide_locations: await prisma.guide_locations.count(),
    languages: await prisma.languages.count(),
    expense_categories: await prisma.expense_categories.count(),
    income_types: await prisma.income_types.count(),
    payment_methods: await prisma.payment_methods.count(),
    emergency_categories: await prisma.emergency_categories.count(),
    system_config: await prisma.system_config.count()
  };

  console.log('\n📊 Resumen de datos creados:');
  Object.entries(counts).forEach(([table, count]) => {
    console.log(`   ${table}: ${count}`);
  });

  console.log('\n👤 Credenciales de acceso:');
  console.log('   Contrasena para todos los usuarios: ' + DEFAULT_PASSWORD);
  console.log('\n   Usuarios admin:');
  console.log('   - admin@futurismo.pe');
  console.log('   - supervisor@futurismo.pe');
  console.log('\n   Usuarios agencia:');
  console.log('   - contacto@tourslima.com');
  console.log('   - info@perumagico.com');
  console.log('\n   Usuarios guia:');
  console.log('   - carlos@guia.com');
  console.log('   - lucia@guia.com');
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
