import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      // Error de respuesta del servidor
      const { status, data } = error.response;
      
      if (status === 401) {
        // Token expirado o inválido
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(new Error('Sesión expirada. Por favor, inicie sesión nuevamente.'));
      }
      
      if (status === 403) {
        return Promise.reject(new Error('No tienes permisos para realizar esta acción.'));
      }
      
      if (status === 404) {
        return Promise.reject(new Error('Recurso no encontrado.'));
      }
      
      if (status === 422) {
        // Error de validación
        const errors = data.errors || [];
        const errorMessage = errors.map(err => err.msg).join(', ');
        return Promise.reject(new Error(errorMessage || 'Datos de entrada inválidos.'));
      }
      
      if (status >= 500) {
        return Promise.reject(new Error('Error interno del servidor.'));
      }
      
      // Otros errores
      const message = data.message || data.error || 'Error en la petición';
      return Promise.reject(new Error(message));
    }
    
    if (error.request) {
      // Error de red
      return Promise.reject(new Error('Error de conexión. Verifica tu conexión a internet.'));
    }
    
    // Otros errores
    return Promise.reject(new Error('Error inesperado.'));
  }
);

export default api; 