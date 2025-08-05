const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Middleware para verificar el token JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token de acceso requerido' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tienda_escolar_secret');
    
    // Verificar que el usuario existe en la base de datos
    const [users] = await pool.execute(
      'SELECT id, nombre, correo, rol FROM usuarios WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Token inválido' 
    });
  }
};

// Middleware para verificar si el usuario es administrador
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Acceso denegado. Se requieren permisos de administrador' 
    });
  }
  next();
};

// Middleware para verificar si el usuario es cliente
const requireClient = (req, res, next) => {
  if (req.user.rol !== 'cliente') {
    return res.status(403).json({ 
      success: false, 
      message: 'Acceso denegado. Solo clientes pueden acceder a este recurso' 
    });
  }
  next();
};

// Middleware para verificar horario de atención
const checkBusinessHours = (req, res, next) => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  // Horarios: 7:30 AM - 12:30 PM y 1:30 PM - 5:30 PM
  const morningStart = 7 * 60 + 30; // 7:30 AM
  const morningEnd = 12 * 60 + 30;  // 12:30 PM
  const afternoonStart = 13 * 60 + 30; // 1:30 PM
  const afternoonEnd = 17 * 60 + 30;   // 5:30 PM

  const isWithinHours = (
    (currentTime >= morningStart && currentTime <= morningEnd) ||
    (currentTime >= afternoonStart && currentTime <= afternoonEnd)
  );

  if (!isWithinHours) {
    return res.status(403).json({
      success: false,
      message: 'La tienda está cerrada. Horario de atención: 7:30 AM - 12:30 PM y 1:30 PM - 5:30 PM'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireClient,
  checkBusinessHours
};