const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Obtener todas las categorías activas
router.get('/categorias', authenticateToken, async (req, res) => {
    try {
        const [categorias] = await pool.execute(
            'SELECT * FROM categorias WHERE activo = TRUE ORDER BY nombre'
        );
        
        res.json({
            success: true,
            data: categorias
        });
    } catch (error) {
        console.error('Error obteniendo categorías:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error al obtener categorías',
            code: 'CATEGORIES_ERROR'
        });
    }
});

// Obtener todos los productos activos con stock
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { categoria, buscar, disponibles_solo } = req.query;
        
        let query = `
            SELECT p.*, c.nombre as categoria_nombre 
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id 
            WHERE p.activo = TRUE
        `;
        
        const params = [];
        
        // Filtrar solo productos con stock si se solicita
        if (disponibles_solo === 'true') {
            query += ' AND p.stock > 0';
        }
        
        // Filtrar por categoría
        if (categoria && categoria !== 'todas' && categoria !== '') {
            query += ' AND p.categoria_id = ?';
            params.push(categoria);
        }
        
        // Búsqueda por texto
        if (buscar && buscar.trim() !== '') {
            query += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR c.nombre LIKE ?)';
            const searchTerm = `%${buscar.trim()}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        query += ' ORDER BY c.nombre, p.nombre';
        
        const [productos] = await pool.execute(query, params);
        
        res.json({
            success: true,
            data: productos,
            total: productos.length
        });
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error al obtener productos',
            code: 'PRODUCTS_ERROR'
        });
    }
});

// Obtener producto por ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                error: 'ID de producto inválido',
                code: 'INVALID_PRODUCT_ID'
            });
        }
        
        const [productos] = await pool.execute(
            `SELECT p.*, c.nombre as categoria_nombre 
             FROM productos p 
             LEFT JOIN categorias c ON p.categoria_id = c.id 
             WHERE p.id = ? AND p.activo = TRUE`,
            [id]
        );
        
        if (productos.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Producto no encontrado',
                code: 'PRODUCT_NOT_FOUND'
            });
        }
        
        res.json({
            success: true,
            data: productos[0]
        });
    } catch (error) {
        console.error('Error obteniendo producto:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error al obtener producto',
            code: 'PRODUCT_FETCH_ERROR'
        });
    }
});

// Verificar disponibilidad de productos para el carrito
router.post('/verificar-disponibilidad', authenticateToken, async (req, res) => {
    try {
        const { productos } = req.body;
        
        if (!productos || !Array.isArray(productos)) {
            return res.status(400).json({
                success: false,
                error: 'Lista de productos requerida',
                code: 'INVALID_PRODUCTS_LIST'
            });
        }

        const verificaciones = [];
        
        for (const item of productos) {
            const { producto_id, cantidad } = item;
            
            const [producto] = await pool.execute(
                'SELECT id, nombre, precio_venta, stock, activo FROM productos WHERE id = ?',
                [producto_id]
            );
            
            if (producto.length === 0) {
                verificaciones.push({
                    producto_id,
                    disponible: false,
                    error: 'Producto no encontrado'
                });
                continue;
            }
            
            const prod = producto[0];
            
            if (!prod.activo) {
                verificaciones.push({
                    producto_id,
                    disponible: false,
                    error: 'Producto no disponible'
                });
                continue;
            }
            
            if (prod.stock < cantidad) {
                verificaciones.push({
                    producto_id,
                    disponible: false,
                    error: `Stock insuficiente. Disponible: ${prod.stock}`,
                    stock_disponible: prod.stock
                });
                continue;
            }
            
            verificaciones.push({
                producto_id,
                disponible: true,
                nombre: prod.nombre,
                precio_actual: prod.precio_venta,
                stock_disponible: prod.stock
            });
        }
        
        const todos_disponibles = verificaciones.every(v => v.disponible);
        
        res.json({
            success: true,
            data: {
                todos_disponibles,
                verificaciones
            }
        });
        
    } catch (error) {
        console.error('Error verificando disponibilidad:', error);
        res.status(500).json({
            success: false,
            error: 'Error verificando disponibilidad de productos',
            code: 'AVAILABILITY_CHECK_ERROR'
        });
    }
});

module.exports = router;