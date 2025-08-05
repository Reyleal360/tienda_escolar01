# 🏫 Tienda Escolar SENA

Sistema de pedidos digital para la cafetería escolar del SENA, desarrollado con React, Node.js y MySQL.

## 🚀 Características

### Para Clientes
- ✅ Registro e inicio de sesión con validaciones
- ✅ Catálogo de productos con filtros por categoría
- ✅ Carrito de compras con cálculo automático
- ✅ Subida de comprobantes de pago (Nequi/Daviplata)
- ✅ Historial de pedidos
- ✅ Interfaz responsive y moderna

### Para Administradores
- ✅ Panel de administración completo
- ✅ CRUD de productos con gestión de imágenes
- ✅ Gestión de pedidos y estados
- ✅ Reportes de ventas y ganancias
- ✅ Gestión de usuarios
- ✅ Código QR para acceso rápido al catálogo

### Funcionalidades Técnicas
- ✅ API REST con autenticación JWT
- ✅ Base de datos MySQL con relaciones
- ✅ Validación de horarios de atención
- ✅ Subida segura de archivos
- ✅ Interfaz responsive con TailwindCSS
- ✅ Manejo de estados con React Context

## 📋 Requisitos Previos

- Node.js (v16 o superior)
- MySQL (v8.0 o superior)
- npm o yarn

## 🛠️ Instalación

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd tienda-escolar
```

### 2. Configurar la base de datos
```bash
# Crear base de datos MySQL
mysql -u root -p
CREATE DATABASE tienda_escolar;
```

### 3. Configurar variables de entorno
```bash
# Backend
cd backend
cp env.example .env
# Editar .env con tus credenciales de MySQL
```

### 4. Instalar dependencias
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Ejecutar el proyecto
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

## 🌐 Acceso

- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:3000/api
- **Catálogo público**: http://localhost:3000/catalogo

## 👤 Cuentas de Prueba

### Administrador
- **Correo**: admin@tiendaescolar.com
- **Contraseña**: admin123

### Cliente
- Registra una nueva cuenta desde la página de registro

## 📁 Estructura del Proyecto

```
tienda-escolar/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── productos.js
│   │   ├── pedidos.js
│   │   └── admin.js
│   ├── uploads/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   └── package.json
└── README.md
```

## 🔧 Configuración de Base de Datos

El sistema crea automáticamente las siguientes tablas:

- **usuarios**: Gestión de usuarios y roles
- **categorias**: Categorías de productos
- **productos**: Catálogo de productos
- **pedidos**: Pedidos de los clientes
- **detalle_pedido**: Detalles de cada pedido

## 📱 Funcionalidades Principales

### Flujo de Compra
1. El usuario inicia sesión
2. Escanea el código QR o accede al catálogo
3. Selecciona productos y los agrega al carrito
4. Verifica el total y completa el pedido
5. Sube comprobante de pago (opcional)
6. El administrador procesa el pedido
7. El usuario recoge su pedido

### Horarios de Atención
- **Mañana**: 7:30 AM - 12:30 PM
- **Tarde**: 1:30 PM - 5:30 PM

## 🛡️ Seguridad

- Autenticación JWT
- Encriptación de contraseñas (bcrypt)
- Validación de entrada
- Rate limiting
- CORS configurado
- Helmet para headers de seguridad

## 📊 Reportes Disponibles

- Ventas diarias/semanales/mensuales
- Productos más vendidos
- Ganancias por producto/categoría
- Métodos de pago utilizados
- Stock bajo

## 🎨 Tecnologías Utilizadas

### Backend
- Node.js
- Express.js
- MySQL2
- JWT
- Multer
- bcryptjs
- express-validator

### Frontend
- React 18
- React Router
- TailwindCSS
- Lucide React
- React Query
- Axios

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👨‍💻 Desarrollado por

SENA - Servicio Nacional de Aprendizaje

---

**Nota**: Este proyecto es para fines educativos y de demostración. Para uso en producción, asegúrate de configurar adecuadamente las variables de entorno y medidas de seguridad. 