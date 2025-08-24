import axios from 'axios';
import { API_CONFIG, buildApiUrl } from '../config/api';

// Configuração base da API
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  withCredentials: false,  // Desabilitar para evitar problemas com CSRF
  headers: API_CONFIG.DEFAULT_HEADERS,
  timeout: API_CONFIG.TIMEOUT,
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Para requisições do topology manager, adicionar headers adequados
    if (config.url?.includes('/api/topology/')) {
      config.headers['Content-Type'] = 'application/json';
      config.headers['Accept'] = 'application/json';
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratamento de erros e refresh de token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.REFRESH), {
            refresh: refreshToken
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);
          api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
          originalRequest.headers['Authorization'] = `Bearer ${access}`;

          return api(originalRequest);
        }
      } catch (refreshError) {
        // Se o refresh token também expirou, fazer logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        window.location.href = '/login';
      }
    }

    if (error.response?.status === 401) {
      // Redirecionar para login se não autenticado
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { api };
export default api; 
