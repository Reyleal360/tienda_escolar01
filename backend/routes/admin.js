const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const QRCode = require('qrcode');
const moment = require('moment');

const router = express.Router();

// Validaciones para usuarios
const userValidation = [
  body('nombre').trim().isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('correo').isEmail().normalizeEmail().withMessage('Correo electrónico inválido'),
  body('password').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('rol').isIn(['cliente', 'admin']).withMessage('Rol inválido')
];

// Obtener todos los usuarios (admin)
router.get('/usuarios', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rol, search, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT id, nombre, correo, rol, created_at FROM usuarios WHERE 1=1';
    const params = [];

    if (rol) {
      query += ' AND rol = ?';
      params.push(rol);
    }

    if (search) {
      query += ' AND (nombre LIKE ? OR correo LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [usuarios] = await pool.execute(query, params);

    res.json({
      success: true,
      data: usuarios
    });

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener usuario específico (admin)
router.get('/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [usuarios] = await pool.execute(
      'SELECT id, nombre, correo, rol, created_at FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: usuarios[0]
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Crear usuario (admin)
router.post('/usuarios', authenticateToken, requireAdmin, userValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { nombre, correo, password, rol } = req.body;

    // Verificar si el correo ya existe
    const [existingUsers] = await pool.execute(
      'SELECT id FROM usuarios WHERE correo = ?',
      [correo]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ya está registrado'
      });
    }

    // Encriptar contraseña
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar nuevo usuario
    const [result] = await pool.execute(
      'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
      [nombre, correo, hashedPassword, rol]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id: result.insertId,
        nombre,
        correo,
        rol
      }
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar usuario (admin)
router.put('/usuarios/:id', authenticateToken, requireAdmin, userValidation, async (req, res) => {
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
    const { nombre, correo, password, rol } = req.body;

    // Verificar que el usuario existe
    const [usuarios] = await pool.execute(
      'SELECT id FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si el correo ya existe en otro usuario
    const [existingUsers] = await pool.execute(
      'SELECT id FROM usuarios WHERE correo = ? AND id != ?',
      [correo, id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ya está registrado por otro usuario'
      });
    }

    // Construir query de actualización
    let updateQuery = 'UPDATE usuarios SET nombre = ?, correo = ?, rol = ?';
    const params = [nombre, correo, rol];

    if (password) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += ', password = ?';
      params.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    await pool.execute(updateQuery, params);

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Eliminar usuario (admin)
router.delete('/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario existe
    const [usuarios] = await pool.execute(
      'SELECT id FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que no sea el último administrador
    const [admins] = await pool.execute(
      'SELECT COUNT(*) as count FROM usuarios WHERE rol = "admin"'
    );

    if (admins[0].count <= 1) {
      const [userRole] = await pool.execute(
        'SELECT rol FROM usuarios WHERE id = ?',
        [id]
      );

      if (userRole[0].rol === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar el último administrador'
        });
      }
    }

    // Eliminar usuario
    await pool.execute('DELETE FROM usuarios WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Generar código QR para el catálogo
router.get('/qr-catalogo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const catalogUrl = `${req.protocol}://${req.get('host')}/catalogo`;
    
    const qrCode = await QRCode.toDataURL(catalogUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      success: true,
      data: {
        qr_code: qrCode,
        url: catalogUrl
      }
    });

  } catch (error) {
    console.error('Error al generar QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Reporte de ventas diarias
router.get('/reportes/ventas-diarias', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fecha } = req.query;
    const targetDate = fecha || moment().format('YYYY-MM-DD');

    // Ventas del día
    const [ventas] = await pool.execute(`
      SELECT 
        COUNT(*) as total_pedidos,
        SUM(total) as total_ventas,
        AVG(total) as promedio_venta
      FROM pedidos 
      WHERE DATE(created_at) = ? AND estado != 'cancelado'
    `, [targetDate]);

    // Productos más vendidos
    const [productosVendidos] = await pool.execute(`
      SELECT 
        p.nombre,
        p.categoria_id,
        c.nombre as categoria_nombre,
        SUM(dp.cantidad) as cantidad_vendida,
        SUM(dp.subtotal) as total_vendido
      FROM detalle_pedido dp
      INNER JOIN productos p ON dp.producto_id = p.id
      INNER JOIN categorias c ON p.categoria_id = c.id
      INNER JOIN pedidos ped ON dp.pedido_id = ped.id
      WHERE DATE(ped.created_at) = ? AND ped.estado != 'cancelado'
      GROUP BY p.id
      ORDER BY cantidad_vendida DESC
      LIMIT 10
    `, [targetDate]);

    // Métodos de pago
    const [metodosPago] = await pool.execute(`
      SELECT 
        metodo_pago,
        COUNT(*) as cantidad,
        SUM(total) as total
      FROM pedidos 
      WHERE DATE(created_at) = ? AND estado != 'cancelado'
      GROUP BY metodo_pago
    `, [targetDate]);

    res.json({
      success: true,
      data: {
        fecha: targetDate,
        resumen: ventas[0],
        productos_mas_vendidos: productosVendidos,
        metodos_pago: metodosPago
      }
    });

  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Reporte de ganancias
router.get('/reportes/ganancias', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let whereClause = 'WHERE p.estado != "cancelado"';
    const params = [];

    if (fecha_inicio) {
      whereClause += ' AND DATE(ped.created_at) >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND DATE(ped.created_at) <= ?';
      params.push(fecha_fin);
    }

    // Ganancias por producto
    const [gananciasProductos] = await pool.execute(`
      SELECT 
        p.nombre,
        c.nombre as categoria_nombre,
        SUM(dp.cantidad) as cantidad_vendida,
        SUM(dp.subtotal) as total_ventas,
        SUM(dp.cantidad * p.ganancia) as ganancia_total
      FROM detalle_pedido dp
      INNER JOIN productos p ON dp.producto_id = p.id
      INNER JOIN categorias c ON p.categoria_id = c.id
      INNER JOIN pedidos ped ON dp.pedido_id = ped.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY ganancia_total DESC
    `, params);

    // Ganancias por categoría
    const [gananciasCategorias] = await pool.execute(`
      SELECT 
        c.nombre as categoria_nombre,
        SUM(dp.cantidad) as cantidad_vendida,
        SUM(dp.subtotal) as total_ventas,
        SUM(dp.cantidad * p.ganancia) as ganancia_total
      FROM detalle_pedido dp
      INNER JOIN productos p ON dp.producto_id = p.id
      INNER JOIN categorias c ON p.categoria_id = c.id
      INNER JOIN pedidos ped ON dp.pedido_id = ped.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY ganancia_total DESC
    `, params);

    // Total general
    const [totalGeneral] = await pool.execute(`
      SELECT 
        SUM(dp.subtotal) as total_ventas,
        SUM(dp.cantidad * p.ganancia) as total_ganancias
      FROM detalle_pedido dp
      INNER JOIN productos p ON dp.producto_id = p.id
      INNER JOIN pedidos ped ON dp.pedido_id = ped.id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: {
        ganancias_por_producto: gananciasProductos,
        ganancias_por_categoria: gananciasCategorias,
        total_general: totalGeneral[0]
      }
    });

  } catch (error) {
    console.error('Error al generar reporte de ganancias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Reporte de stock bajo
router.get('/reportes/stock-bajo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limite = 10 } = req.query;

    const [productosStockBajo] = await pool.execute(`
      SELECT 
        p.id,
        p.nombre,
        p.stock,
        c.nombre as categoria_nombre,
        p.precio,
        p.ganancia
      FROM productos p
      INNER JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = TRUE AND p.stock <= ?
      ORDER BY p.stock ASC
    `, [limite]);

    res.json({
      success: true,
      data: {
        productos_stock_bajo: productosStockBajo,
        limite_stock: parseInt(limite)
      }
    });

  } catch (error) {
    console.error('Error al obtener reporte de stock:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Dashboard de administración
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const weekStart = moment().startOf('week').format('YYYY-MM-DD');
    const monthStart = moment().startOf('month').format('YYYY-MM-DD');

    // Estadísticas del día
    const [statsHoy] = await pool.execute(`
      SELECT 
        COUNT(*) as pedidos,
        SUM(total) as ventas,
        COUNT(DISTINCT usuario_id) as clientes_unicos
      FROM pedidos 
      WHERE DATE(created_at) = ? AND estado != 'cancelado'
    `, [today]);

    // Estadísticas de la semana
    const [statsSemana] = await pool.execute(`
      SELECT 
        COUNT(*) as pedidos,
        SUM(total) as ventas
      FROM pedidos 
      WHERE DATE(created_at) >= ? AND estado != 'cancelado'
    `, [weekStart]);

    // Estadísticas del mes
    const [statsMes] = await pool.execute(`
      SELECT 
        COUNT(*) as pedidos,
        SUM(total) as ventas
      FROM pedidos 
      WHERE DATE(created_at) >= ? AND estado != 'cancelado'
    `, [monthStart]);

    // Pedidos pendientes
    const [pedidosPendientes] = await pool.execute(`
      SELECT COUNT(*) as cantidad
      FROM pedidos 
      WHERE estado IN ('pendiente', 'confirmado', 'en_preparacion')
    `);

    // Productos con stock bajo
    const [stockBajo] = await pool.execute(`
      SELECT COUNT(*) as cantidad
      FROM productos 
      WHERE activo = TRUE AND stock <= 10
    `);

    res.json({
      success: true,
      data: {
        hoy: statsHoy[0],
        semana: statsSemana[0],
        mes: statsMes[0],
        pedidos_pendientes: pedidosPendientes[0].cantidad,
        productos_stock_bajo: stockBajo[0].cantidad
      }
    });

  } catch (error) {
    console.error('Error al obtener dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
