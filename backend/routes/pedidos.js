const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin, requireClient, checkBusinessHours } = require('../middleware/auth');

const router = express.Router();

// Configuración de multer para subida de comprobantes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/comprobantes';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'comprobante-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpeg, jpg, png) y PDFs'));
    }
  }
});

// Validaciones para pedidos
const orderValidation = [
  body('productos').isArray({ min: 1 }).withMessage('Debe incluir al menos un producto'),
  body('productos.*.producto_id').isInt({ min: 1 }).withMessage('ID de producto inválido'),
  body('productos.*.cantidad').isInt({ min: 1 }).withMessage('Cantidad debe ser un número positivo'),
  body('metodo_pago').isIn(['efectivo', 'nequi', 'daviplata']).withMessage('Método de pago inválido'),
  body('observaciones').optional().isLength({ max: 500 }).withMessage('Las observaciones no pueden exceder 500 caracteres')
];

// Crear pedido (cliente)
router.post('/', authenticateToken, requireClient, checkBusinessHours, orderValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { productos, metodo_pago, observaciones } = req.body;
    const usuario_id = req.user.id;

    // Verificar disponibilidad de productos
    let total = 0;
    const productosVerificados = [];

    for (const item of productos) {
      const [producto] = await pool.execute(
        'SELECT id, nombre, precio, stock FROM productos WHERE id = ? AND activo = TRUE',
        [item.producto_id]
      );

      if (producto.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Producto con ID ${item.producto_id} no encontrado`
        });
      }

      const prod = producto[0];
      if (prod.stock < item.cantidad) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${prod.nombre}. Disponible: ${prod.stock}`
        });
      }

      const subtotal = prod.precio * item.cantidad;
      total += subtotal;

      productosVerificados.push({
        ...item,
        precio_unitario: prod.precio,
        subtotal,
        nombre: prod.nombre
      });
    }

    // Crear pedido
    const [pedidoResult] = await pool.execute(`
      INSERT INTO pedidos (usuario_id, total, metodo_pago, observaciones) 
      VALUES (?, ?, ?, ?)
    `, [usuario_id, total, metodo_pago, observaciones]);

    const pedido_id = pedidoResult.insertId;

    // Crear detalles del pedido
    for (const item of productosVerificados) {
      await pool.execute(`
        INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) 
        VALUES (?, ?, ?, ?, ?)
      `, [pedido_id, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal]);

      // Actualizar stock
      await pool.execute(
        'UPDATE productos SET stock = stock - ? WHERE id = ?',
        [item.cantidad, item.producto_id]
      );
    }

    // Obtener pedido completo
    const [pedidos] = await pool.execute(`
      SELECT p.*, u.nombre as usuario_nombre, u.correo as usuario_correo
      FROM pedidos p
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = ?
    `, [pedido_id]);

    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      data: {
        pedido: pedidos[0],
        productos: productosVerificados
      }
    });

  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener pedidos del usuario (cliente)
router.get('/mis-pedidos', authenticateToken, requireClient, async (req, res) => {
  try {
    const { estado, limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT p.*, u.nombre as usuario_nombre
      FROM pedidos p
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.usuario_id = ?
    `;
    const params = [req.user.id];

    if (estado) {
      query += ' AND p.estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [pedidos] = await pool.execute(query, params);

    // Obtener detalles de cada pedido
    for (const pedido of pedidos) {
      const [detalles] = await pool.execute(`
        SELECT dp.*, p.nombre as producto_nombre, p.imagen
        FROM detalle_pedido dp
        INNER JOIN productos p ON dp.producto_id = p.id
        WHERE dp.pedido_id = ?
      `, [pedido.id]);
      
      pedido.detalles = detalles;
    }

    res.json({
      success: true,
      data: pedidos
    });

  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener pedido específico del usuario
router.get('/mis-pedidos/:id', authenticateToken, requireClient, async (req, res) => {
  try {
    const { id } = req.params;

    const [pedidos] = await pool.execute(`
      SELECT p.*, u.nombre as usuario_nombre, u.correo as usuario_correo
      FROM pedidos p
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = ? AND p.usuario_id = ?
    `, [id, req.user.id]);

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const [detalles] = await pool.execute(`
      SELECT dp.*, p.nombre as producto_nombre, p.imagen
      FROM detalle_pedido dp
      INNER JOIN productos p ON dp.producto_id = p.id
      WHERE dp.pedido_id = ?
    `, [id]);

    const pedido = pedidos[0];
    pedido.detalles = detalles;

    res.json({
      success: true,
      data: pedido
    });

  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener todos los pedidos (admin)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { estado, usuario_id, fecha_inicio, fecha_fin, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT p.*, u.nombre as usuario_nombre, u.correo as usuario_correo
      FROM pedidos p
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (estado) {
      query += ' AND p.estado = ?';
      params.push(estado);
    }

    if (usuario_id) {
      query += ' AND p.usuario_id = ?';
      params.push(usuario_id);
    }

    if (fecha_inicio) {
      query += ' AND DATE(p.created_at) >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += ' AND DATE(p.created_at) <= ?';
      params.push(fecha_fin);
    }

    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [pedidos] = await pool.execute(query, params);

    // Obtener detalles de cada pedido
    for (const pedido of pedidos) {
      const [detalles] = await pool.execute(`
        SELECT dp.*, p.nombre as producto_nombre, p.imagen
        FROM detalle_pedido dp
        INNER JOIN productos p ON dp.producto_id = p.id
        WHERE dp.pedido_id = ?
      `, [pedido.id]);
      
      pedido.detalles = detalles;
    }

    res.json({
      success: true,
      data: pedidos
    });

  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener pedido específico (admin)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [pedidos] = await pool.execute(`
      SELECT p.*, u.nombre as usuario_nombre, u.correo as usuario_correo
      FROM pedidos p
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = ?
    `, [id]);

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const [detalles] = await pool.execute(`
      SELECT dp.*, p.nombre as producto_nombre, p.imagen
      FROM detalle_pedido dp
      INNER JOIN productos p ON dp.producto_id = p.id
      WHERE dp.pedido_id = ?
    `, [id]);

    const pedido = pedidos[0];
    pedido.detalles = detalles;

    res.json({
      success: true,
      data: pedido
    });

  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar estado del pedido (admin)
router.put('/:id/estado', authenticateToken, requireAdmin, [
  body('estado').isIn(['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado'])
    .withMessage('Estado inválido')
], async (req, res) => {
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
    const { estado } = req.body;

    // Verificar que el pedido existe
    const [pedidos] = await pool.execute(
      'SELECT id FROM pedidos WHERE id = ?',
      [id]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Actualizar estado
    await pool.execute(
      'UPDATE pedidos SET estado = ? WHERE id = ?',
      [estado, id]
    );

    res.json({
      success: true,
      message: 'Estado del pedido actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Subir comprobante de pago (cliente)
router.post('/:id/comprobante', authenticateToken, requireClient, upload.single('comprobante'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Comprobante de pago requerido'
      });
    }

    // Verificar que el pedido existe y pertenece al usuario
    const [pedidos] = await pool.execute(
      'SELECT id, estado FROM pedidos WHERE id = ? AND usuario_id = ?',
      [id, req.user.id]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    if (pedidos[0].estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden subir comprobantes a pedidos pendientes'
      });
    }

    const comprobantePath = `/uploads/comprobantes/${req.file.filename}`;

    // Actualizar pedido con comprobante
    await pool.execute(
      'UPDATE pedidos SET comprobante_pago = ? WHERE id = ?',
      [comprobantePath, id]
    );

    res.json({
      success: true,
      message: 'Comprobante subido exitosamente'
    });

  } catch (error) {
    console.error('Error al subir comprobante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Servir comprobantes
router.get('/uploads/comprobantes/:filename', authenticateToken, (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '..', 'uploads', 'comprobantes', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: 'Archivo no encontrado'
    });
  }
});

// Obtener estadísticas de pedidos (admin)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (fecha_inicio) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(fecha_fin);
    }

    // Total de pedidos
    const [totalPedidos] = await pool.execute(
      `SELECT COUNT(*) as total FROM pedidos ${whereClause}`,
      params
    );

    // Total de ventas
    const [totalVentas] = await pool.execute(
      `SELECT SUM(total) as total FROM pedidos ${whereClause} AND estado != 'cancelado'`,
      params
    );

    // Pedidos por estado
    const [pedidosPorEstado] = await pool.execute(
      `SELECT estado, COUNT(*) as cantidad FROM pedidos ${whereClause} GROUP BY estado`,
      params
    );

    // Métodos de pago
    const [metodosPago] = await pool.execute(
      `SELECT metodo_pago, COUNT(*) as cantidad FROM pedidos ${whereClause} GROUP BY metodo_pago`,
      params
    );

    res.json({
      success: true,
      data: {
        total_pedidos: totalPedidos[0].total,
        total_ventas: totalVentas[0].total || 0,
        pedidos_por_estado: pedidosPorEstado,
        metodos_pago: metodosPago
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;