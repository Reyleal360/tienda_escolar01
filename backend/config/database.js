const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tienda_escolar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para inicializar la base de datos
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Crear base de datos si no existe
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.execute(`USE ${dbConfig.database}`);
    
    // Crear tabla de usuarios
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        correo VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol ENUM('cliente', 'admin') DEFAULT 'cliente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Crear tabla de categorías
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Crear tabla de productos
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS productos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        categoria_id INT NOT NULL,
        precio DECIMAL(10,2) NOT NULL,
        ganancia DECIMAL(10,2) NOT NULL,
        stock INT DEFAULT 0,
        imagen VARCHAR(255),
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
      )
    `);
    
    // Crear tabla de pedidos
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        estado ENUM('pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado') DEFAULT 'pendiente',
        metodo_pago ENUM('efectivo', 'nequi', 'daviplata') DEFAULT 'efectivo',
        comprobante_pago VARCHAR(255),
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `);
    
    // Crear tabla de detalles de pedido
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS detalle_pedido (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pedido_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
        FOREIGN KEY (producto_id) REFERENCES productos(id)
      )
    `);
    
    // Insertar categorías por defecto
    const categorias = [
      'Harinas', 'Bebidas', 'Frutas', 'Dulces', 
      'Helados', 'Galletas', 'Copias', 'Materiales'
    ];
    
    for (const categoria of categorias) {
      await connection.execute(
        'INSERT IGNORE INTO categorias (nombre) VALUES (?)',
        [categoria]
      );
    }
    
    // Crear usuario administrador por defecto
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    await connection.execute(`
      INSERT IGNORE INTO usuarios (nombre, correo, password, rol) 
      VALUES ('Administrador', 'admin@tiendaescolar.com', ?, 'admin')
    `, [adminPassword]);
    
    connection.release();
    console.log('✅ Base de datos inicializada correctamente');
    
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
}

// Función para probar la conexión
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión a MySQL establecida correctamente');
        console.log(`📊 Base de datos: ${process.env.DB_NAME}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error conectando a MySQL:', error.message);
        return false;
    }
}

// Función para ejecutar queries con manejo de errores
async function executeQuery(query, params = []) {
    try {
        const [results] = await pool.execute(query, params);
        return results;
    } catch (error) {
        console.error('Error ejecutando query:', error);
        throw error;
    }
}

module.exports = {
  pool,
  initializeDatabase,
  testConnection,
  executeQuery
};