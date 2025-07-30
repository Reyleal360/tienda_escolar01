const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false,
            error: 'Token de acceso requerido',
            code: 'TOKEN_REQUIRED' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false,
                error: 'Token inválido o expirado',
                code: 'TOKEN_INVALID' 
            });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.tipo_usuario !== 'admin') {
        return res.status(403).json({ 
            success: false,
            error: 'Se requieren permisos de administrador',
            code: 'ADMIN_REQUIRED' 
        });
    }
    next();
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.tipo_usuario)) {
            return res.status(403).json({ 
                success: false,
                error: 'Permisos insuficientes',
                code: 'INSUFFICIENT_PERMISSIONS',
                required_roles: roles,
                user_role: req.user.tipo_usuario
            });
        }
        next();
    };
};

module.exports = { 
    authenticateToken, 
    requireAdmin, 
    requireRole 
};