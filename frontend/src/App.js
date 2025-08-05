import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Catalogo from './pages/Catalogo';
import Carrito from './pages/Carrito';
import MisPedidos from './pages/MisPedidos';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProductos from './pages/admin/Productos';
import AdminPedidos from './pages/admin/Pedidos';
import AdminUsuarios from './pages/admin/Usuarios';
import AdminReportes from './pages/admin/Reportes';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
      
      {/* Rutas protegidas */}
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Catalogo />} />
        <Route path="carrito" element={<Carrito />} />
        <Route path="mis-pedidos" element={<MisPedidos />} />
        
        {/* Rutas de administración */}
        {user?.rol === 'admin' && (
          <>
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/productos" element={<AdminProductos />} />
            <Route path="admin/pedidos" element={<AdminPedidos />} />
            <Route path="admin/usuarios" element={<AdminUsuarios />} />
            <Route path="admin/reportes" element={<AdminReportes />} />
          </>
        )}
      </Route>
      
      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </AuthProvider>
  );
}

export default App; 