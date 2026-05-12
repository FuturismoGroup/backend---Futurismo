// Controller de Providers
// Fuente: 04_apis_lista.md
// API-076 a API-080: Gestión de proveedores de servicios externos

const prisma = require('../config/db');

/**
 * API-076: ListProviders
 * GET /api/providers
 * Roles permitidos: Admin, Agency
 *
 * Devuelve proveedores en formato compatible con frontend (ELM-337 ProvidersManager)
 * Incluye category, location, contact anidado, pricing anidado
 */
const listProviders = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      type,
      status,
      search,
      city,
      category,
      location,
      minRating
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = Math.min(parseInt(pageSize), 100);

    // Construir filtros
    const where = {};

    // Solo filtrar por status si se proporciona explicitamente
    if (status && status !== '') {
      where.status = status;
    }

    // Filtro por categoria (frontend envia category como ID)
    if (category && category !== '') {
      where.category_id = category;
    }

    // Filtro por ubicacion (frontend envia location como ID)
    if (location && location !== '') {
      where.location_id = location;
    }

    // Filtro por rating minimo
    if (minRating && parseFloat(minRating) > 0) {
      where.rating = { gte: parseFloat(minRating) };
    }

    // Busqueda por texto
    if (search && search !== '') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { contact_name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [providers, total] = await Promise.all([
      prisma.providers.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          provider_categories: {
            include: {
              _count: { select: { provider_services: true } }
            }
          },
          locations: true
        }
      }),
      prisma.providers.count({ where })
    ]);

    // Mapear al formato esperado por el frontend
    const data = providers.map(p => ({
      id: p.id,
      name: p.name,
      // Campos para compatibilidad con frontend
      category: p.category_id,
      categoryName: p.provider_categories?.name,
      categoryIcon: p.provider_categories?.icon,
      categoryColor: p.provider_categories?.color,
      location: p.location_id,
      locationName: p.locations?.name,
      // Contacto anidado (formato frontend)
      contact: {
        contactPerson: p.contact_name,
        phone: p.phone,
        email: p.email,
        address: p.address
      },
      rating: p.rating ? parseFloat(p.rating) : null,
      capacity: p.capacity,
      description: p.description,
      observations: p.observations,
      status: p.status,
      servicesCount: p.provider_categories?._count?.provider_services || 0,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));

    res.json({
      success: true,
      data: {
        providers: data,
        page: parseInt(page),
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Error en listProviders:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar proveedores'
    });
  }
};

/**
 * API-077: GetProvider
 * GET /api/providers/:id
 * Roles permitidos: Admin, Agency
 *
 * Devuelve proveedor en formato compatible con frontend (ELM-339 ProviderForm)
 */
const getProvider = async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await prisma.providers.findUnique({
      where: { id },
      include: {
        provider_categories: true,
        locations: true
      }
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Proveedor no encontrado'
      });
    }

    // Obtener servicios de la categoría del proveedor
    const categoryServices = await prisma.provider_services.findMany({
      where: { category_id: provider.category_id, is_active: true },
      orderBy: { name: 'asc' }
    });

    // Formato compatible con frontend
    res.json({
      success: true,
      data: {
        id: provider.id,
        name: provider.name,
        category: provider.category_id,
        categoryName: provider.provider_categories?.name,
        location: provider.location_id,
        locationName: provider.locations?.name,
        contact: {
          contactPerson: provider.contact_name,
          phone: provider.phone,
          email: provider.email,
          address: provider.address
        },
        rating: provider.rating ? parseFloat(provider.rating) : null,
        capacity: provider.capacity,
        description: provider.description,
        observations: provider.observations,
        status: provider.status,
        services: categoryServices.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          serviceType: s.service_type,
          isActive: s.is_active
        })),
        createdAt: provider.created_at,
        updatedAt: provider.updated_at
      }
    });
  } catch (error) {
    console.error('Error en getProvider:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener proveedor'
    });
  }
};

/**
 * API-078: CreateProvider
 * POST /api/providers
 * Roles permitidos: Admin
 *
 * Soporta DOS formatos de request:
 * 1. Formato Frontend (ELM-339 ProviderForm):
 *    { name, category, location, contact: {contactPerson, phone, email, address},
 *      pricing: {basePrice, type}, rating, capacity, services[], specialties[], languages[] }
 * 2. Formato API documentado (04_apis_lista.md API-078):
 *    { name, type, description, address, city, contactName, contactPhone, contactEmail, taxId, bankAccount }
 */
const createProvider = async (req, res) => {
  try {
    // Detectar formato: si tiene 'contact' anidado es formato frontend
    const isFrontendFormat = req.body.contact !== undefined;

    let providerData;
    let categoryId = null;

    // Extraer services del body para procesarlo después de crear el proveedor
    // (debe estar fuera del if para que sea accesible en el procesamiento posterior)
    const { services: servicesFromBody } = req.body;

    if (isFrontendFormat) {
      // Formato Frontend (ELM-339 ProviderForm)
      const {
        name,
        category,
        location,
        contact = {},
        rating,
        capacity,
        specialties,
        languages,
        description,
        observations
      } = req.body;

      // Validaciones para formato frontend
      if (!name || name.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'name es obligatorio y debe tener al menos 2 caracteres'
        });
      }

      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'category es obligatorio'
        });
      }

      if (!location) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'location es obligatorio'
        });
      }

      if (!contact.contactPerson) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'contact.contactPerson es obligatorio'
        });
      }

      if (!contact.phone) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'contact.phone es obligatorio'
        });
      }

      if (!contact.email) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'contact.email es obligatorio'
        });
      }

      // Mapear al schema de Prisma (TBL-019 providers)
      categoryId = category;
      providerData = {
        name,
        category_id: category,
        location_id: location || null,
        address: contact.address || null,
        phone: contact.phone || null,
        email: contact.email || null,
        contact_name: contact.contactPerson || null,
        rating: rating ? parseFloat(rating) : null,
        description: description || null,
        capacity: capacity ? parseInt(capacity) : null,
        observations: observations || null,
        status: 'active'
      };

    } else {
      // Formato API documentado (API-078)
      const {
        name,
        type,
        description,
        address,
        city,
        contactName,
        contactPhone,
        contactEmail,
        taxId,
        bankAccount
      } = req.body;

      // Validaciones para formato API
      if (!name || name.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'name es obligatorio y debe tener al menos 3 caracteres'
        });
      }

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'type es obligatorio'
        });
      }

      const validTypes = ['transport', 'hotel', 'restaurant', 'activity'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `type debe ser uno de: ${validTypes.join(', ')}`
        });
      }

      if (!address || !city || !contactName || !contactPhone) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'address, city, contactName y contactPhone son obligatorios'
        });
      }

      // Para formato API, necesitamos buscar o crear category por type
      // Por ahora usamos una categoria por defecto si existe
      const defaultCategory = await prisma.provider_categories.findFirst({
        where: { name: { contains: type, mode: 'insensitive' } }
      });
      if (defaultCategory) {
        categoryId = defaultCategory.id;
      } else {
        // Crear categoria basada en type
        const newCategory = await prisma.provider_categories.create({
          data: { name: type, is_active: true }
        });
        categoryId = newCategory.id;
      }

      providerData = {
        name,
        category_id: categoryId,
        address,
        phone: contactPhone,
        email: contactEmail,
        contact_name: contactName,
        description,
        status: 'active'
      };
    }

    // Crear proveedor en la BD
    const provider = await prisma.providers.create({
      data: providerData,
      include: {
        provider_categories: true,
        locations: true
      }
    });

    // Procesar servicios si se proporcionaron (formato frontend)
    // Los servicios se asocian a la CATEGORÍA, no al proveedor
    if (isFrontendFormat && Array.isArray(servicesFromBody) && servicesFromBody.length > 0) {
      const validServices = servicesFromBody.filter(s => s && typeof s === 'string' && s.trim());

      for (const serviceIdOrKey of validServices) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceIdOrKey);

        if (!isUUID) {
          // Es un key de traducción (servicio estático) - crear en catálogo de la categoría si no existe
          const existing = await prisma.provider_services.findFirst({
            where: { category_id: categoryId, service_type: serviceIdOrKey, is_active: true }
          });

          if (!existing) {
            const keyParts = serviceIdOrKey.split('.');
            const rawName = keyParts[keyParts.length - 1];
            const serviceName = rawName
              .replace(/_/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase());

            await prisma.provider_services.create({
              data: {
                category_id: categoryId,
                name: serviceName,
                service_type: serviceIdOrKey,
                is_active: true
              }
            });
          }
        }
        // Si es UUID, ya existe en el catálogo de la categoría - no hacer nada
      }
    }

    // Obtener servicios de la categoría para incluirlos en la respuesta
    const createdServices = await prisma.provider_services.findMany({
      where: { category_id: categoryId, is_active: true },
      orderBy: { name: 'asc' }
    });

    // Respuesta en formato compatible con frontend
    res.status(201).json({
      success: true,
      data: {
        id: provider.id,
        name: provider.name,
        category: provider.category_id,
        categoryName: provider.provider_categories?.name,
        location: provider.location_id,
        locationName: provider.locations?.name,
        contact: {
          contactPerson: provider.contact_name,
          phone: provider.phone,
          email: provider.email,
          address: provider.address
        },
        rating: provider.rating ? parseFloat(provider.rating) : null,
        capacity: provider.capacity,
        observations: provider.observations,
        status: provider.status,
        services: createdServices.map(s => ({
          id: s.id,
          name: s.name,
          serviceType: s.service_type
        })),
        createdAt: provider.created_at
      }
    });
  } catch (error) {
    console.error('Error en createProvider:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear proveedor'
    });
  }
};

/**
 * API-079: UpdateProvider
 * PUT /api/providers/:id
 * Roles permitidos: Admin
 *
 * Soporta DOS formatos de request:
 * 1. Formato Frontend (ELM-339 ProviderForm):
 *    { name, category, location, contact: {contactPerson, phone, email, address},
 *      pricing: {basePrice, type}, rating, capacity, services[], specialties[], languages[] }
 * 2. Formato API documentado (04_apis_lista.md API-079):
 *    { name, type, status, description, address, city, contactName, contactPhone, contactEmail, taxId, bankAccount }
 */
const updateProvider = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existing = await prisma.providers.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Proveedor no encontrado'
      });
    }

    // Detectar formato: si tiene 'contact' anidado es formato frontend
    const isFrontendFormat = req.body.contact !== undefined;

    let updateData = {
      updated_at: new Date()
    };

    // Extraer services del body para procesarlo después
    const { services: servicesFromBody } = req.body;

    if (isFrontendFormat) {
      // Formato Frontend (ELM-339 ProviderForm)
      const {
        name,
        category,
        location,
        contact = {},
        rating,
        capacity,
        description,
        observations,
        status
      } = req.body;

      if (name !== undefined) updateData.name = name;
      if (category !== undefined) updateData.category_id = category;
      if (location !== undefined) updateData.location_id = location || null;
      if (contact.address !== undefined) updateData.address = contact.address;
      if (contact.phone !== undefined) updateData.phone = contact.phone;
      if (contact.email !== undefined) updateData.email = contact.email;
      if (contact.contactPerson !== undefined) updateData.contact_name = contact.contactPerson;
      if (rating !== undefined) updateData.rating = rating ? parseFloat(rating) : null;
      if (capacity !== undefined) updateData.capacity = capacity ? parseInt(capacity) : null;
      if (description !== undefined) updateData.description = description;
      if (observations !== undefined) updateData.observations = observations;
      if (status !== undefined) updateData.status = status;

    } else {
      // Formato API documentado (API-079)
      const {
        name,
        type,
        status,
        description,
        address,
        city,
        contactName,
        contactPhone,
        contactEmail,
        taxId,
        bankAccount
      } = req.body;

      // Validar type si se proporciona
      if (type) {
        const validTypes = ['transport', 'hotel', 'restaurant', 'activity'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: `type debe ser uno de: ${validTypes.join(', ')}`
          });
        }
        // Buscar categoria por type
        const category = await prisma.provider_categories.findFirst({
          where: { name: { contains: type, mode: 'insensitive' } }
        });
        if (category) {
          updateData.category_id = category.id;
        }
      }

      // Validar status si se proporciona
      if (status) {
        const validStatuses = ['active', 'inactive', 'suspended'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: `status debe ser uno de: ${validStatuses.join(', ')}`
          });
        }
        updateData.status = status;
      }

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (address !== undefined) updateData.address = address;
      if (contactName !== undefined) updateData.contact_name = contactName;
      if (contactPhone !== undefined) updateData.phone = contactPhone;
      if (contactEmail !== undefined) updateData.email = contactEmail;
    }

    const provider = await prisma.providers.update({
      where: { id },
      data: updateData,
      include: {
        provider_categories: true,
        locations: true
      }
    });

    // Sincronizar servicios si se proporcionaron (formato frontend)
    // Los servicios se asocian a la CATEGORÍA, no al proveedor
    const effectiveCategoryId = updateData.category_id || provider.category_id;

    if (isFrontendFormat && servicesFromBody && Array.isArray(servicesFromBody)) {
      const validServices = servicesFromBody.filter(s => s && typeof s === 'string' && s.trim());

      for (const serviceIdOrKey of validServices) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceIdOrKey);

        if (!isUUID) {
          // Es un key de traducción - crear en catálogo de la categoría si no existe
          const existing = await prisma.provider_services.findFirst({
            where: { category_id: effectiveCategoryId, service_type: serviceIdOrKey, is_active: true }
          });

          if (!existing) {
            const keyParts = serviceIdOrKey.split('.');
            const rawName = keyParts[keyParts.length - 1];
            const serviceName = rawName
              .replace(/_/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase());

            await prisma.provider_services.create({
              data: {
                category_id: effectiveCategoryId,
                name: serviceName,
                service_type: serviceIdOrKey,
                is_active: true
              }
            });
          }
        }
        // Si es UUID, ya existe en el catálogo de la categoría - no hacer nada
      }
    }

    // Obtener servicios de la categoría para la respuesta
    const updatedServices = await prisma.provider_services.findMany({
      where: { category_id: effectiveCategoryId, is_active: true },
      orderBy: { name: 'asc' }
    });

    // Respuesta en formato compatible con frontend
    res.json({
      success: true,
      data: {
        id: provider.id,
        name: provider.name,
        category: provider.category_id,
        categoryName: provider.provider_categories?.name,
        location: provider.location_id,
        locationName: provider.locations?.name,
        contact: {
          contactPerson: provider.contact_name,
          phone: provider.phone,
          email: provider.email,
          address: provider.address
        },
        rating: provider.rating ? parseFloat(provider.rating) : null,
        capacity: provider.capacity,
        observations: provider.observations,
        status: provider.status,
        services: updatedServices.map(s => ({
          id: s.id,
          name: s.name,
          serviceType: s.service_type
        })),
        updatedAt: provider.updated_at
      }
    });
  } catch (error) {
    console.error('Error en updateProvider:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al actualizar proveedor'
    });
  }
};

/**
 * API-080: DeleteProvider
 * DELETE /api/providers/:id
 * Roles permitidos: Admin
 * Soft delete: cambia status a 'inactive'
 */
const deleteProvider = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existing = await prisma.providers.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Proveedor no encontrado'
      });
    }

    // Soft delete: cambiar status a inactive
    await prisma.providers.update({
      where: { id },
      data: {
        status: 'inactive',
        updated_at: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Proveedor eliminado correctamente'
    });
  } catch (error) {
    console.error('Error en deleteProvider:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar proveedor'
    });
  }
};

// ============================================
// LOCATIONS (Ubicaciones jerarquicas)
// Para ELM-329 LocationTree y flujos FLW-039, FLW-093
// Tabla: locations (TBL-018)
// ============================================

/**
 * ListLocations
 * GET /api/providers/locations
 * Lista todas las ubicaciones para el arbol jerarquico
 * Usado por ELM-329 (LocationTree)
 */
const listLocations = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const where = {};
    if (!includeInactive || includeInactive === 'false') {
      where.is_active = true;
    }

    const locations = await prisma.locations.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ],
      include: {
        providers: {
          select: {
            id: true,
            category_id: true
          }
        },
        locations: {
          // Relacion auto-referencial: parent -> children
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    // Transformar al formato esperado por el frontend
    const data = locations.map(loc => {
      // Contar proveedores por categoria para esta ubicacion
      const categoryCounts = {};
      const categories = [];

      loc.providers.forEach(p => {
        if (p.category_id) {
          if (!categoryCounts[p.category_id]) {
            categoryCounts[p.category_id] = 0;
            categories.push(p.category_id);
          }
          categoryCounts[p.category_id]++;
        }
      });

      return {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        parentId: loc.parent_id,
        code: loc.code,
        latitude: loc.latitude ? parseFloat(loc.latitude) : null,
        longitude: loc.longitude ? parseFloat(loc.longitude) : null,
        path: loc.path,
        isActive: loc.is_active,
        // Campos adicionales para LocationTree
        providerCount: loc.providers.length,
        categoryCounts,
        categories, // IDs de categorias con proveedores en esta ubicacion
        // Para compatibilidad con frontend que espera region/country
        region: loc.type === 'city' ? loc.path?.split('/')[2] : null,
        country: loc.path?.split('/')[1] || null,
        children: loc.locations || []
      };
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error en listLocations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar ubicaciones'
    });
  }
};

/**
 * CreateLocation
 * POST /api/providers/locations
 * Crea una nueva ubicacion
 * Usado por ELM-331 (NewLocationModal)
 */
const createLocation = async (req, res) => {
  try {
    const {
      name,
      type,
      parentId,
      code,
      latitude,
      longitude
    } = req.body;

    // Validaciones
    if (!name || name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name es obligatorio y debe tener al menos 2 caracteres'
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'type es obligatorio'
      });
    }

    const validTypes = ['country', 'region', 'city', 'district', 'zone'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `type debe ser uno de: ${validTypes.join(', ')}`
      });
    }

    // Verificar padre si se proporciona
    let parentPath = '';
    if (parentId) {
      const parent = await prisma.locations.findUnique({
        where: { id: parentId }
      });
      if (!parent) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ubicacion padre no encontrada'
        });
      }
      parentPath = parent.path || `/${parent.name.toLowerCase().replace(/\s+/g, '-')}`;
    }

    // Construir path
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const path = parentPath ? `${parentPath}/${slug}` : `/${slug}`;

    // Verificar nombre unico dentro del mismo padre
    const existing = await prisma.locations.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        parent_id: parentId || null
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe una ubicacion con este nombre en el mismo nivel'
      });
    }

    const location = await prisma.locations.create({
      data: {
        name,
        type,
        parent_id: parentId || null,
        code: code || null,
        latitude: latitude || null,
        longitude: longitude || null,
        path,
        is_active: true
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: location.id,
        name: location.name,
        type: location.type,
        parentId: location.parent_id,
        code: location.code,
        path: location.path,
        isActive: location.is_active,
        createdAt: location.created_at
      }
    });
  } catch (error) {
    console.error('Error en createLocation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear ubicacion'
    });
  }
};

// ============================================
// CATEGORIES (Categorias de proveedores)
// Para ELM-329, ELM-330 y flujos FLW-014, FLW-039
// Tabla: provider_categories
// ============================================

/**
 * ListCategories
 * GET /api/providers/categories
 * Lista todas las categorias de proveedores
 * Usado por ELM-329 (LocationTree), ELM-330 (NewCategoryModal)
 */
const listCategories = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const where = {};
    if (!includeInactive || includeInactive === 'false') {
      where.is_active = true;
    }

    const categories = await prisma.provider_categories.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { providers: true }
        }
      }
    });

    const data = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      isActive: cat.is_active,
      providerCount: cat._count.providers,
      createdAt: cat.created_at
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error en listCategories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar categorias'
    });
  }
};

/**
 * CreateCategory
 * POST /api/providers/categories
 * Crea una nueva categoria de proveedor
 * Usado por ELM-330 (NewCategoryModal)
 */
const createCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      icon,
      color
    } = req.body;

    // Validaciones
    if (!name || name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name es obligatorio y debe tener al menos 2 caracteres'
      });
    }

    // Verificar nombre unico
    const existing = await prisma.provider_categories.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' }
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe una categoria con este nombre'
      });
    }

    const category = await prisma.provider_categories.create({
      data: {
        name: name.trim(),
        description: description || null,
        icon: icon || null,
        color: color || null,
        is_active: true
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color,
        isActive: category.is_active,
        createdAt: category.created_at
      }
    });
  } catch (error) {
    console.error('Error en createCategory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear categoria'
    });
  }
};

// ============================================
// SERVICES (Servicios de proveedores)
// Para flujos FLW-014, FLW-037
// Tabla: provider_services
// ============================================

/**
 * ListServices
 * GET /api/providers/services
 * Lista todos los servicios de proveedores
 */
const listServices = async (req, res) => {
  try {
    const { categoryId, includeInactive = false } = req.query;

    const where = {};
    if (!includeInactive || includeInactive === 'false') {
      where.is_active = true;
    }
    if (categoryId) {
      where.category_id = categoryId;
    }

    const services = await prisma.provider_services.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        provider_categories: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const data = services.map(svc => ({
      id: svc.id,
      categoryId: svc.category_id,
      category: svc.category_id,
      categoryName: svc.provider_categories?.name,
      name: svc.name,
      description: svc.description,
      serviceType: svc.service_type,
      durationMinutes: svc.duration_minutes,
      maxCapacity: svc.max_capacity,
      isActive: svc.is_active,
      createdAt: svc.created_at
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error en listServices:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al listar servicios'
    });
  }
};

/**
 * CreateService
 * POST /api/providers/services
 * Crea un nuevo servicio asociado a una categoría de proveedor
 */
const createService = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      description,
      serviceType,
      durationMinutes,
      maxCapacity
    } = req.body;

    // Validaciones
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'categoryId es obligatorio'
      });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(categoryId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'La categoría seleccionada no es válida. Recarga la página e intenta nuevamente.'
      });
    }

    if (!name || name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'name es obligatorio y debe tener al menos 2 caracteres'
      });
    }

    // Verificar que la categoría existe
    const category = await prisma.provider_categories.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Categoría no encontrada'
      });
    }

    // serviceType es opcional - si no se envía, se usa el nombre de la categoría
    // Truncar a 50 caracteres para respetar la restricción VARCHAR(50) del schema
    const effectiveServiceType = (serviceType || category.name).slice(0, 50);

    const service = await prisma.provider_services.create({
      data: {
        category_id: categoryId,
        name: name.trim(),
        description: description || null,
        service_type: effectiveServiceType,
        duration_minutes: durationMinutes || null,
        max_capacity: maxCapacity || null,
        is_active: true
      },
      include: {
        provider_categories: {
          select: { name: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: service.id,
        categoryId: service.category_id,
        category: service.category_id,
        categoryName: service.provider_categories?.name,
        name: service.name,
        description: service.description,
        serviceType: service.service_type,
        durationMinutes: service.duration_minutes,
        maxCapacity: service.max_capacity,
        isActive: service.is_active,
        createdAt: service.created_at
      }
    });
  } catch (error) {
    console.error('Error en createService:', error, '\nBody:', req.body);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error?.message || 'Error al crear servicio'
    });
  }
};

// ============================================
// ENDPOINTS ADICIONALES
// ============================================

/**
 * ToggleProviderStatus
 * PATCH /api/providers/:id/status
 * Cambia el status de un proveedor
 */
const toggleProviderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `status debe ser uno de: ${validStatuses.join(', ')}`
      });
    }

    const existing = await prisma.providers.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Proveedor no encontrado'
      });
    }

    const provider = await prisma.providers.update({
      where: { id },
      data: { status, updated_at: new Date() }
    });

    res.json({
      success: true,
      data: { id: provider.id, status: provider.status }
    });
  } catch (error) {
    console.error('Error en toggleProviderStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al cambiar status del proveedor'
    });
  }
};

/**
 * SearchProviders
 * GET /api/providers/search
 * Búsqueda avanzada de proveedores
 */
const searchProviders = async (req, res) => {
  try {
    const { q, category, location, minRating, status, page = 1, pageSize = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = Math.min(parseInt(pageSize), 100);

    const where = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { contact_name: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (category) where.category_id = category;
    if (location) where.location_id = location;
    if (status) where.status = status;
    if (minRating) where.rating = { gte: parseFloat(minRating) };

    const [providers, total] = await Promise.all([
      prisma.providers.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { provider_categories: true, locations: true }
      }),
      prisma.providers.count({ where })
    ]);

    const data = providers.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category_id,
      categoryName: p.provider_categories?.name,
      location: p.location_id,
      locationName: p.locations?.name,
      rating: p.rating ? parseFloat(p.rating) : null,
      status: p.status
    }));

    res.json({ success: true, data: { providers: data, total, page: parseInt(page), pageSize: take } });
  } catch (error) {
    console.error('Error en searchProviders:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error en búsqueda' });
  }
};

/**
 * CheckProviderAvailability
 * POST /api/providers/:id/check-availability
 * Verifica disponibilidad de un proveedor
 */
const checkProviderAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'date es requerido'
      });
    }

    const provider = await prisma.providers.findUnique({ where: { id } });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Proveedor no encontrado'
      });
    }

    // Sin tabla de asignaciones, el proveedor siempre está disponible
    res.json({
      success: true,
      data: {
        providerId: id,
        date,
        isAvailable: true,
        existingAssignments: 0,
        conflicts: []
      }
    });
  } catch (error) {
    console.error('Error en checkProviderAvailability:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al verificar disponibilidad' });
  }
};

/**
 * GetProvidersStats
 * GET /api/providers/stats
 * Estadísticas de proveedores
 */
const getProvidersStats = async (req, res) => {
  try {
    const [
      totalProviders,
      activeProviders,
      providersByCategory,
      providersByLocation,
      avgRating
    ] = await Promise.all([
      prisma.providers.count(),
      prisma.providers.count({ where: { status: 'active' } }),
      prisma.providers.groupBy({
        by: ['category_id'],
        _count: { id: true }
      }),
      prisma.providers.groupBy({
        by: ['location_id'],
        _count: { id: true }
      }),
      prisma.providers.aggregate({
        _avg: { rating: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        total: totalProviders,
        active: activeProviders,
        inactive: totalProviders - activeProviders,
        byCategory: providersByCategory,
        byLocation: providersByLocation,
        averageRating: avgRating._avg.rating ? parseFloat(avgRating._avg.rating).toFixed(2) : null
      }
    });
  } catch (error) {
    console.error('Error en getProvidersStats:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al obtener estadísticas' });
  }
};

/**
 * RateProvider
 * POST /api/providers/:id/rate
 * Calificar un proveedor
 */
const rateProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'rating debe estar entre 1 y 5'
      });
    }

    const provider = await prisma.providers.findUnique({ where: { id } });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Proveedor no encontrado'
      });
    }

    // Actualizar rating promedio (simplificado)
    const currentRating = provider.rating ? parseFloat(provider.rating) : 0;
    const newRating = currentRating === 0 ? rating : (currentRating + rating) / 2;

    const updated = await prisma.providers.update({
      where: { id },
      data: { rating: newRating, updated_at: new Date() }
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        rating: parseFloat(updated.rating),
        message: 'Calificación registrada'
      }
    });
  } catch (error) {
    console.error('Error en rateProvider:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al calificar proveedor' });
  }
};
/**
 * CloneProvider
 * POST /api/providers/:id/clone
 * Clonar un proveedor existente
 */
const cloneProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const overrides = req.body || {};

    const original = await prisma.providers.findUnique({ where: { id } });
    if (!original) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Proveedor no encontrado'
      });
    }

    const clonedData = {
      name: overrides.name || `${original.name} (Copia)`,
      category_id: overrides.category_id || original.category_id,
      location_id: overrides.location_id || original.location_id,
      address: original.address,
      phone: overrides.phone || original.phone,
      email: overrides.email || original.email,
      contact_name: original.contact_name,
      description: original.description,
      observations: original.observations,
      rating: null,
      capacity: original.capacity,
      status: 'active'
    };

    const cloned = await prisma.providers.create({
      data: clonedData,
      include: { provider_categories: true, locations: true }
    });

    res.status(201).json({
      success: true,
      data: {
        id: cloned.id,
        name: cloned.name,
        status: cloned.status,
        message: 'Proveedor clonado exitosamente'
      }
    });
  } catch (error) {
    console.error('Error en cloneProvider:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al clonar proveedor' });
  }
};

/**
 * ExportProviders
 * GET /api/providers/export
 * Exportar proveedores a CSV/JSON
 */
const exportProviders = async (req, res) => {
  try {
    const { format = 'json', category, location, status } = req.query;

    const where = {};
    if (category) where.category_id = category;
    if (location) where.location_id = location;
    if (status) where.status = status;

    const providers = await prisma.providers.findMany({
      where,
      include: { provider_categories: true, locations: true },
      orderBy: { name: 'asc' }
    });

    if (format === 'csv') {
      const csvHeader = 'ID,Nombre,Categoría,Ubicación,Teléfono,Email,Contacto,Rating,Status,Observaciones\n';
      const csvRows = providers.map(p =>
        `"${p.id}","${p.name}","${p.provider_categories?.name || ''}","${p.locations?.name || ''}","${p.phone || ''}","${p.email || ''}","${p.contact_name || ''}","${p.rating || ''}","${p.status}","${(p.observations || '').replace(/"/g, '""')}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="proveedores.csv"');
      return res.send(csvHeader + csvRows);
    }

    res.json({
      success: true,
      data: providers.map(p => ({
        id: p.id,
        name: p.name,
        category: p.provider_categories?.name,
        location: p.locations?.name,
        phone: p.phone,
        email: p.email,
        contactName: p.contact_name,
        rating: p.rating ? parseFloat(p.rating) : null,
        status: p.status
      }))
    });
  } catch (error) {
    console.error('Error en exportProviders:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al exportar' });
  }
};

/**
 * ImportProviders
 * POST /api/providers/import
 * Importar proveedores desde CSV/JSON
 */
const importProviders = async (req, res) => {
  try {
    // El archivo viene en req.file (multer) o req.body para JSON
    let providersData = [];

    if (req.file) {
      // Procesar archivo CSV
      const fileContent = req.file.buffer.toString('utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'El archivo está vacío o no tiene datos'
        });
      }

      // Primera línea es el header
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());

      // Mapear headers a campos de BD
      const headerMap = {
        'nombre': 'name',
        'name': 'name',
        'telefono': 'phone',
        'phone': 'phone',
        'email': 'email',
        'contacto': 'contact_name',
        'contact': 'contact_name',
        'contactname': 'contact_name',
        'direccion': 'address',
        'address': 'address',
        'descripcion': 'description',
        'description': 'description'
      };

      // Procesar cada línea de datos
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const provider = {};

        headers.forEach((header, index) => {
          const field = headerMap[header];
          if (field && values[index]) {
            provider[field] = values[index];
          }
        });

        if (provider.name) {
          providersData.push(provider);
        }
      }
    } else if (req.body.providers && Array.isArray(req.body.providers)) {
      // JSON con array de proveedores
      providersData = req.body.providers;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Debe enviar un archivo CSV o un JSON con array de proveedores'
      });
    }

    if (providersData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No se encontraron proveedores para importar'
      });
    }

    // Importar proveedores
    const results = {
      created: [],
      errors: [],
      skipped: []
    };

    for (const providerData of providersData) {
      try {
        // Validar campos mínimos
        if (!providerData.name || providerData.name.length < 2) {
          results.errors.push({
            data: providerData,
            error: 'Nombre es requerido (mínimo 2 caracteres)'
          });
          continue;
        }

        // Verificar duplicado por nombre
        const existing = await prisma.providers.findFirst({
          where: { name: { equals: providerData.name, mode: 'insensitive' } }
        });

        if (existing) {
          results.skipped.push({
            name: providerData.name,
            reason: 'Ya existe un proveedor con este nombre'
          });
          continue;
        }

        // Crear proveedor
        const created = await prisma.providers.create({
          data: {
            name: providerData.name,
            phone: providerData.phone || null,
            email: providerData.email || null,
            contact_name: providerData.contact_name || providerData.contactName || null,
            address: providerData.address || null,
            description: providerData.description || null,
            category_id: providerData.category_id || providerData.categoryId || null,
            location_id: providerData.location_id || providerData.locationId || null,
            status: 'active'
          }
        });

        results.created.push({
          id: created.id,
          name: created.name
        });
      } catch (err) {
        results.errors.push({
          data: providerData,
          error: err.message
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        total: providersData.length,
        created: results.created.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        details: results
      },
      message: `Importación completada: ${results.created.length} creados, ${results.skipped.length} omitidos, ${results.errors.length} errores`
    });
  } catch (error) {
    console.error('Error en importProviders:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: 'Error al importar proveedores' });
  }
};

module.exports = {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  // Locations
  listLocations,
  createLocation,
  // Categories
  listCategories,
  createCategory,
  // Services
  listServices,
  createService,
  // Nuevos endpoints
  toggleProviderStatus,
  searchProviders,
  checkProviderAvailability,
  getProvidersStats,
  rateProvider,
  cloneProvider,
  exportProviders,
  importProviders
};
