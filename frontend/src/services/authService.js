import api from './api';

export const authService = {
  // Iniciar sesión
  async login(credentials) {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // Registrarse
  async register(userData) {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Obtener perfil del usuario
  async getProfile() {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  // Actualizar perfil
  async updateProfile(userData) {
    const response = await api.put('/auth/profile', userData);
    return response.data;
  },

  // Cambiar contraseña
  async changePassword(passwordData) {
    const response = await api.put('/auth/change-password', passwordData);
    return response.data;
  },

  // Verificar si el usuario está autenticado
  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  // Obtener token
  getToken() {
    return localStorage.getItem('token');
  },

  // Eliminar token
  removeToken() {
    localStorage.removeItem('token');
  }
}; 