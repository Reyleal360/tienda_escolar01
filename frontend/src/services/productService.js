import api from './api';

export const productService = {
  // Obtener todos los productos
  async getProducts(params = {}) {
    const response = await api.get('/productos', { params });
    return response.data;
  },

  // Obtener producto por ID
  async getProduct(id) {
    const response = await api.get(`/productos/${id}`);
    return response.data;
  },

  // Obtener categorías
  async getCategories() {
    const response = await api.get('/productos/categorias/list');
    return response.data;
  },

  // Crear producto (admin)
  async createProduct(productData) {
    const formData = new FormData();
    
    // Agregar datos del producto
    Object.keys(productData).forEach(key => {
      if (key === 'imagen' && productData[key]) {
        formData.append('imagen', productData[key]);
      } else if (key !== 'imagen') {
        formData.append(key, productData[key]);
      }
    });

    const response = await api.post('/productos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Actualizar producto (admin)
  async updateProduct(id, productData) {
    const formData = new FormData();
    
    // Agregar datos del producto
    Object.keys(productData).forEach(key => {
      if (key === 'imagen' && productData[key]) {
        formData.append('imagen', productData[key]);
      } else if (key !== 'imagen') {
        formData.append(key, productData[key]);
      }
    });

    const response = await api.put(`/productos/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Eliminar producto (admin)
  async deleteProduct(id) {
    const response = await api.delete(`/productos/${id}`);
    return response.data;
  },

  // Obtener URL de imagen
  getImageUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}${imagePath}`;
  }
}; 