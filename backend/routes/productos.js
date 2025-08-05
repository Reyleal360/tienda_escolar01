const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/productos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'producto-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp)'));
    }
  }
});

// Validaciones para productos
const productValidation = [
  body('nombre').trim().isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('categoria_id').isInt({ min: 1 }).withMessage('Categoría inválida'),
  body('precio').isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
  body('ganancia').isFloat({ min: 0 }).withMessage('La ganancia debe ser un número positivo'),
  body('stock').optional().isInt({ min: 0 }).withMessage('El stock debe ser un número entero positivo'),
  body('descripcion').optional().isLength({ max: 500 }).withMessage('La descripción no puede exceder 500 caracteres')
];

// Obtener todos los productos (público)
router.get('/', async (req, res) => {
  try {
    const { categoria_id, search, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      INNER JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.activo = TRUE
    `;
    const params = [];

    // Filtro por categoría
    if (categoria_id) {
      query += ' AND p.categoria_id = ?';
      params.push(categoria_id);
    }

    // Búsqueda por nombre
    if (search) {
      query += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.nombre ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [productos] = await pool.execute(query, params);

    res.json({
      success: true,
      data: productos
    });

  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener producto por ID (público)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [productos] = await pool.execute(`
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      INNER JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.id = ? AND p.activo = TRUE
    `, [id]);

    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      data: productos[0]
    });

  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Crear producto (solo admin)
router.post('/', authenticateToken, requireAdmin, upload.single('imagen'), productValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { nombre, categoria_id, precio, ganancia, stock = 0, descripcion } = req.body;
    const imagen = req.file ? `/uploads/productos/${req.file.filename}` : null;

    // Verificar que la categoría existe
    const [categorias] = await pool.execute(
      'SELECT id FROM categorias WHERE id = ?',
      [categoria_id]
    );

    if (categorias.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    const [result] = await pool.execute(`
      INSERT INTO productos (nombre, categoria_id, precio, ganancia, stock, imagen, descripcion) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [nombre, categoria_id, precio, ganancia, stock, imagen, descripcion]);

    // Obtener el producto creado
    const [productos] = await pool.execute(`
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      INNER JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: productos[0]
    });

  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar producto (solo admin)
router.put('/:id', authenticateToken, requireAdmin, upload.single('imagen'), productValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { nombre, categoria_id, precio, ganancia, stock, descripcion } = req.body;
    const imagen = req.file ? `/uploads/productos/${req.file.filename}` : undefined;

    // Verificar que el producto existe
    const [productos] = await pool.execute(
      'SELECT imagen FROM productos WHERE id = ?',
      [id]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Verificar que la categoría existe
    const [categorias] = await pool.execute(
      'SELECT id FROM categorias WHERE id = ?',
      [categoria_id]
    );

    if (categorias.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Eliminar imagen anterior si se sube una nueva
    if (imagen && productos[0].imagen) {
      const oldImagePath = path.join(__dirname, '..', productos[0].imagen);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Construir query de actualización
    let updateQuery = `
      UPDATE productos 
      SET nombre = ?, categoria_id = ?, precio = ?, ganancia = ?, stock = ?, descripcion = ?
    `;
    const params = [nombre, categoria_id, precio, ganancia, stock, descripcion];

    if (imagen) {
      updateQuery += ', imagen = ?';
      params.push(imagen);
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    await pool.execute(updateQuery, params);

    // Obtener el producto actualizado
    const [productosActualizados] = await pool.execute(`
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      INNER JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: productosActualizados[0]
    });

  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Eliminar producto (solo admin) - Soft delete
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el producto existe
    const [productos] = await pool.execute(
      'SELECT id FROM productos WHERE id = ? AND activo = TRUE',
      [id]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Soft delete
    await pool.execute(
      'UPDATE productos SET activo = FALSE WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener categorías (público)
router.get('/categorias/list', async (req, res) => {
  try {
    const [categorias] = await pool.execute(
      'SELECT * FROM categorias ORDER BY nombre ASC'
    );

    res.json({
      success: true,
      data: categorias
    });

  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Servir imágenes
router.get('/uploads/productos/:filename', (req, res) => {
  const { filename } = req.params;
  const imagePath = path.join(__dirname, '..', 'uploads', 'productos', filename);
  
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({
      success: false,
      message: 'Imagen no encontrada'
    });
  }
});

module.exports = router;