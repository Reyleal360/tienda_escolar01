import api from './api';

export const orderService = {
  // Crear pedido
  async createOrder(orderData) {
    const response = await api.post('/pedidos', orderData);
    return response.data;
  },

  // Obtener pedidos del usuario
  async getUserOrders(params = {}) {
    const response = await api.get('/pedidos/mis-pedidos', { params });
    return response.data;
  },

  // Obtener pedido específico del usuario
  async getUserOrder(id) {
    const response = await api.get(`/pedidos/mis-pedidos/${id}`);
    return response.data;
  },

  // Obtener todos los pedidos (admin)
  async getAllOrders(params = {}) {
    const response = await api.get('/pedidos', { params });
    return response.data;
  },

  // Obtener pedido específico (admin)
  async getOrder(id) {
    const response = await api.get(`/pedidos/${id}`);
    return response.data;
  },

  // Actualizar estado del pedido (admin)
  async updateOrderStatus(id, status) {
    const response = await api.put(`/pedidos/${id}/estado`, { estado: status });
    return response.data;
  },

  // Subir comprobante de pago
  async uploadPaymentProof(orderId, file) {
    const formData = new FormData();
    formData.append('comprobante', file);

    const response = await api.post(`/pedidos/${orderId}/comprobante`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Obtener estadísticas de pedidos (admin)
  async getOrderStats(params = {}) {
    const response = await api.get('/pedidos/stats/overview', { params });
    return response.data;
  },

  // Obtener URL de comprobante
  getProofUrl(filename) {
    if (!filename) return null;
    if (filename.startsWith('http')) return filename;
    return `${process.env.REACT_APP_API_URL || 'http://localhost:3000}/uploads/comprobantes/${filename}`;
  }
}; 