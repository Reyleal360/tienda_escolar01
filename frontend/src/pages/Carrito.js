import React from 'react';
import { useCart } from '../contexts/CartContext';
import { Trash2, ShoppingCart } from 'lucide-react';

const Carrito = () => {
  const { items, removeFromCart, updateQuantity, getTotal, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">🛒</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Tu carrito está vacío</h3>
        <p className="text-gray-600">Agrega algunos productos para comenzar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Carrito de Compras</h1>
        <button
          onClick={clearCart}
          className="btn-outline text-red-600 hover:text-red-700"
        >
          <Trash2 size={16} className="mr-2" />
          Vaciar carrito
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de productos */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Productos ({items.length})</h2>
            </div>
            <div className="card-body space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400 text-2xl">📦</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {item.nombre}
                    </h3>
                    <p className="text-sm text-gray-500">
                      ${item.precio.toLocaleString()} c/u
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                      className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-medium">{item.cantidad}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                      disabled={item.cantidad >= item.stock}
                      className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ${(item.precio * item.cantidad).toLocaleString()}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resumen del pedido */}
        <div className="lg:col-span-1">
          <div className="card sticky top-6">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Resumen del Pedido</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${getTotal().toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="text-lg font-bold text-primary-600">
                    ${getTotal().toLocaleString()}
                  </span>
                </div>
              </div>
              
              <button className="w-full btn-primary">
                <ShoppingCart size={16} className="mr-2" />
                Proceder al Pago
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Carrito; 