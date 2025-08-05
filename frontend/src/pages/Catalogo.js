import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { productService } from '../services/productService';
import { useCart } from '../contexts/CartContext';
import { Search, Filter, ShoppingCart, Plus, Minus } from 'lucide-react';

const Catalogo = () => {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { addToCart, getItemQuantity, updateQuantity } = useCart();

  // Obtener productos
  const { data: productsData, isLoading: productsLoading } = useQuery(
    ['products', selectedCategory, searchTerm],
    () => productService.getProducts({
      categoria_id: selectedCategory,
      search: searchTerm
    })
  );

  // Obtener categorías
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery(
    'categories',
    () => productService.getCategories()
  );

  const handleAddToCart = (product) => {
    addToCart(product, 1);
  };

  const handleQuantityChange = (product, newQuantity) => {
    if (newQuantity === 0) {
      // Remover del carrito
      return;
    }
    updateQuantity(product.id, newQuantity);
  };

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const products = productsData?.data || [];
  const categories = categoriesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-gray-600">Explora nuestros productos disponibles</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Filtro por categoría */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input pl-10"
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Productos */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron productos</h3>
          <p className="text-gray-600">Intenta ajustar los filtros de búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const quantityInCart = getItemQuantity(product.id);
            const imageUrl = productService.getImageUrl(product.imagen);

            return (
              <div key={product.id} className="card hover:shadow-md transition-shadow">
                {/* Imagen del producto */}
                <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-t-lg bg-gray-200">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.nombre}
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="h-48 w-full flex items-center justify-center bg-gray-100">
                      <span className="text-gray-400 text-4xl">📦</span>
                    </div>
                  )}
                </div>

                {/* Información del producto */}
                <div className="card-body">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {product.nombre}
                    </h3>
                    <span className="badge badge-primary">{product.categoria_nombre}</span>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {product.descripcion || 'Sin descripción disponible'}
                  </p>

                  <div className="flex justify-between items-center mb-4">
                    <span className="text-2xl font-bold text-primary-600">
                      ${product.precio.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">
                      Stock: {product.stock}
                    </span>
                  </div>

                  {/* Controles del carrito */}
                  {quantityInCart > 0 ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleQuantityChange(product, quantityInCart - 1)}
                          className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-medium">{quantityInCart}</span>
                        <button
                          onClick={() => handleQuantityChange(product, quantityInCart + 1)}
                          disabled={quantityInCart >= product.stock}
                          className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <span className="text-sm text-gray-600">
                        ${(product.precio * quantityInCart).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart size={16} className="mr-2" />
                      {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Catalogo; 