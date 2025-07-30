const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Configurar multer para comprobantes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/comprobantes');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        const extension = path.extname(file.originalname);
        cb(null, `comprobante-${uniqueSuffix}${extension}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB máximo
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, WebP)'));
        }
    }
});

// Crear nuevo pedido
router.post('/', authenticateToken, upload.single('comprobante'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { productos, metodo_pago, notas = '' } = req.body;
        
        // Validaciones básicas
        if (!productos || !metodo_pago) {
            throw new Error('Productos y método de pago son requeridos');
        }

        const productosArray = JSON.parse(productos);
        
        if (!Array.isArray(productosArray) || productosArray.length === 0) {
            throw new Error('Debe incluir al menos un producto');
        }

        // Validar método de pago
        const metodosValidos = ['efectivo', 'nequi', 'daviplata'];
        if (!metodosValidos.includes(metodo_pago)) {
            throw new Error('Método de pago inválido');
        }

        let total = 0;
        const productosValidados = [];

        // Validar productos y calcular total
        for (const item of productosArray) {
            const { producto_id, cantidad } = item;
            
            if (!producto_id || !cantidad || cantidad <= 0) {
                throw new Error(`Datos de producto inválidos: ID ${producto_id}, cantidad ${cantidad}`);
            }

            const [productoData] = await connection.execute(
                'SELECT id, nombre, precio_venta, stock FROM productos WHERE id = ? AND activo = TRUE',
                [producto_id]
            );

            if (productoData.length === 0) {
                throw new Error(`Producto ${producto_id} no encontrado o inactivo`);
            }

            const producto = productoData[0];

            if (producto.stock < cantidad) {
                throw new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}, solicitado: ${cantidad}`);
            }

            const subtotal = producto.precio_venta * cantidad;
            total += subtotal;

            productosValidados.push({
                producto_id: producto.id,
                nombre: producto.nombre,
                cantidad: parseInt(cantidad),
                precio_unitario: producto.precio_venta,
                subtotal: subtotal
            });
        }

        // Validar comprobante para métodos electrónicos
        const metodosElectronicos = ['nequi', 'daviplata'];
        if (metodosElectronicos.includes(metodo_