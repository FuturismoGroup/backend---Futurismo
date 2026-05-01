// Controller de Documentos del Perfil
// Maneja CRUD de documentos de usuario con la tabla documents de Prisma

const prisma = require('../config/db');

/**
 * GET /api/profile/documents
 * Obtener documentos del usuario autenticado
 * Roles permitidos: Todos los autenticados
 */
const getMyDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, status } = req.query;

    // Construir filtros
    const where = {
      user_id: userId
    };

    if (category && category !== 'all') {
      where.document_type = category;
    }

    if (status) {
      where.verification_status = status;
    }

    const documents = await prisma.documents.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      },
      select: {
        id: true,
        document_type: true,
        name: true,
        file_url: true,
        file_type: true,
        file_size: true,
        expiry_date: true,
        verification_status: true,
        created_at: true
      }
    });

    // Transformar a formato esperado por frontend
    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.document_type,
      category: doc.document_type,
      fileName: doc.name,
      size: doc.file_size ? formatFileSize(doc.file_size) : null,
      uploadDate: doc.created_at,
      expiryDate: doc.expiry_date,
      status: doc.verification_status,
      url: doc.file_url
    }));

    return res.status(200).json({
      success: true,
      data: formattedDocuments
    });
  } catch (error) {
    console.error('Error en getMyDocuments:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener documentos'
    });
  }
};

/**
 * POST /api/profile/documents
 * Crear un nuevo documento para el usuario autenticado
 * Requiere que el archivo ya haya sido subido via /api/upload/document
 * Roles permitidos: Todos los autenticados
 */
const createDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      document_type,
      file_url,
      file_type,
      file_size,
      expiry_date
    } = req.body;

    // Validaciones basicas
    if (!name || !document_type || !file_url) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Faltan campos requeridos: name, document_type, file_url'
      });
    }

    const document = await prisma.documents.create({
      data: {
        user_id: userId,
        name,
        document_type,
        file_url,
        file_type: file_type || null,
        file_size: file_size ? BigInt(file_size) : null,
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        verification_status: 'pending'
      },
      select: {
        id: true,
        document_type: true,
        name: true,
        file_url: true,
        file_type: true,
        file_size: true,
        expiry_date: true,
        verification_status: true,
        created_at: true
      }
    });

    // Transformar respuesta
    const formattedDocument = {
      id: document.id,
      name: document.name,
      type: document.document_type,
      category: document.document_type,
      fileName: document.name,
      size: document.file_size ? formatFileSize(document.file_size) : null,
      uploadDate: document.created_at,
      expiryDate: document.expiry_date,
      status: document.verification_status,
      url: document.file_url
    };

    return res.status(201).json({
      success: true,
      message: 'Documento creado exitosamente',
      data: formattedDocument
    });
  } catch (error) {
    console.error('Error en createDocument:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al crear documento'
    });
  }
};

/**
 * DELETE /api/profile/documents/:id
 * Eliminar un documento del usuario autenticado
 * Roles permitidos: Todos los autenticados (solo sus propios documentos)
 */
const deleteDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar que el documento existe y pertenece al usuario
    const document = await prisma.documents.findFirst({
      where: {
        id,
        user_id: userId
      }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Documento no encontrado'
      });
    }

    // Eliminar documento
    await prisma.documents.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Documento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteDocument:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al eliminar documento'
    });
  }
};

/**
 * GET /api/profile/documents/:id
 * Obtener un documento especifico del usuario autenticado
 * Roles permitidos: Todos los autenticados (solo sus propios documentos)
 */
const getDocumentById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const document = await prisma.documents.findFirst({
      where: {
        id,
        user_id: userId
      },
      select: {
        id: true,
        document_type: true,
        name: true,
        file_url: true,
        file_type: true,
        file_size: true,
        expiry_date: true,
        verification_status: true,
        created_at: true
      }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Documento no encontrado'
      });
    }

    const formattedDocument = {
      id: document.id,
      name: document.name,
      type: document.document_type,
      category: document.document_type,
      fileName: document.name,
      size: document.file_size ? formatFileSize(document.file_size) : null,
      uploadDate: document.created_at,
      expiryDate: document.expiry_date,
      status: document.verification_status,
      url: document.file_url
    };

    return res.status(200).json({
      success: true,
      data: formattedDocument
    });
  } catch (error) {
    console.error('Error en getDocumentById:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error al obtener documento'
    });
  }
};

// Utilidad para formatear tamano de archivo
function formatFileSize(bytes) {
  if (!bytes) return null;
  const bigBytes = BigInt(bytes);
  const kb = 1024n;
  const mb = kb * 1024n;

  if (bigBytes >= mb) {
    return `${Number(bigBytes / mb)}.${Number((bigBytes % mb) / (mb / 100n))} MB`;
  } else if (bigBytes >= kb) {
    return `${Number(bigBytes / kb)} KB`;
  }
  return `${Number(bigBytes)} bytes`;
}

module.exports = {
  getMyDocuments,
  createDocument,
  deleteDocument,
  getDocumentById
};
