const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Función para validar email institucional
const isInstitutionalEmail = (email) => {
    return email.endsWith(process.env.INSTITUTIONAL_EMAIL_DOMAIN || '@colegio.edu.co');
};

// Registro/Login de usuario
router.post('/login', async (req, res) => {
    try {
        const { email, nombre, tipo_usuario = 'estudiante' } = req.body;

        // Validaciones básicas
        if (!email || !nombre) {
            return res.status(400).json({ 
                success: false,
                error: 'Email y nombre son requeridos',
                code: 'MISSING_FIELDS'
            });
        }

        if (!isInstitutionalEmail(email)) {
            return res.status(400).json({ 
                success: false,
                error: `Debe usar un correo institucional (${process.env.INSTITUTIONAL_EMAIL_DOMAIN})`,
                code: 'INVALID_EMAIL_DOMAIN'
            });
        }

        // Buscar usuario existente
        const [existingUsers] = await pool.execute(
            'SELECT * FROM usuarios WHERE email = ? AND activo = TRUE',
            [email.toLowerCase().trim()]
        );

        let user;

        if (existingUsers.length > 0) {
            // Usuario existe, hacer login
            user = existingUsers[0];
            
            // Actualizar nombre si es diferente
            if (user.nombre !== nombre.trim()) {
                await pool.execute(
                    'UPDATE usuarios SET nombre = ? WHERE id = ?',
                    [nombre.trim(), user.id]
                );
                user.nombre = nombre.trim();
            }
        } else {
            // Usuario no existe, crear nuevo
            const [result] = await pool.execute(
                'INSERT INTO usuarios (email, nombre, tipo_usuario) VALUES (?, ?, ?)',
                [email.toLowerCase().trim(), nombre.trim(), tipo_usuario]
            );

            user = {
                id: result.insertId,
                email: email.toLowerCase().trim(),
                nombre: nombre.trim(),
                tipo_usuario,
                activo: true,
                fecha_creacion: new Date()
            };
        }

        // Generar JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                nombre: user.nombre,
                tipo_usuario: user.tipo_usuario 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            success: true,
            message: existingUsers.length > 0 ? 'Bienvenido de nuevo' : 'Cuenta creada exitosamente',
            data: {
                token, 
                usuario: {
                    id: user.id,
                    email: user.email,
                    nombre: user.nombre,
                    tipo_usuario: user.tipo_usuario
                }
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor',
            code: 'INTERNAL_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Verificar token
router.get('/verify', authenticateToken, async (req, res) => {
    try {
        // Verificar que el usuario aún existe y está activo
        const [users] = await pool.execute(
            'SELECT id, email, nombre, tipo_usuario, activo FROM usuarios WHERE id = ? AND activo = TRUE',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Usuario no encontrado o inactivo',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({ 
            success: true,
            data: {
                valid: true, 
                usuario: users[0]
            }
        });

    } catch (error) {
        console.error('Error verificando token:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error verificando autenticación',
            code: 'VERIFICATION_ERROR'
        });
    }
});

// Logout (opcional - principalmente para limpiar logs)
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ 
        success: true,
        message: 'Sesión cerrada exitosamente'
    });
});

module.exports = router;