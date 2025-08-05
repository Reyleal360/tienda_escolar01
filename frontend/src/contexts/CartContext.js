import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de un CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar carrito desde localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error al cargar carrito:', error);
        localStorage.removeItem('cart');
      }
    }
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product, quantity = 1) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      if (existingItem) {
        // Verificar stock disponible
        if (existingItem.cantidad + quantity > product.stock) {
          toast.error(`Solo hay ${product.stock} unidades disponibles de ${product.nombre}`);
          return prevItems;
        }
        
        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, cantidad: item.cantidad + quantity }
            : item
        );
      } else {
        // Verificar stock disponible para nuevo item
        if (quantity > product.stock) {
          toast.error(`Solo hay ${product.stock} unidades disponibles de ${product.nombre}`);
          return prevItems;
        }
        
        return [...prevItems, {
          id: product.id,
          nombre: product.nombre,
          precio: product.precio,
          imagen: product.imagen,
          stock: product.stock,
          cantidad: quantity
        }];
      }
    });
    
    toast.success(`${product.nombre} agregado al carrito`);
  };

  const removeFromCart = (productId) => {
    setItems(prevItems => prevItems.filter(item => item.id !== productId));
    toast.success('Producto removido del carrito');
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems(prevItems => {
      const item = prevItems.find(item => item.id === productId);
      if (!item) return prevItems;

      if (quantity > item.stock) {
        toast.error(`Solo hay ${item.stock} unidades disponibles de ${item.nombre}`);
        return prevItems;
      }

      return prevItems.map(item =>
        item.id === productId
          ? { ...item, cantidad: quantity }
          : item
      );
    });
  };

  const clearCart = () => {
    setItems([]);
    toast.success('Carrito vaciado');
  };

  const getTotal = () => {
    return items.reduce((total, item) => total + (item.precio * item.cantidad), 0);
  };

  const getItemCount = () => {
    return items.reduce((count, item) => count + item.cantidad, 0);
  };

  const getItemQuantity = (productId) => {
    const item = items.find(item => item.id === productId);
    return item ? item.cantidad : 0;
  };

  const isInCart = (productId) => {
    return items.some(item => item.id === productId);
  };

  const value = {
    items,
    loading,
    setLoading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotal,
    getItemCount,
    getItemQuantity,
    isInCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}; 