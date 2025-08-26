import axios from 'axios';
import { API_CONFIG, buildApiUrl } from '../config/api';

// Utilities para JWT e refresh automático
class TokenManager {
  private static refreshPromise: Promise<void> | null = null;
  private static refreshTimer: number | null = null;

  // Decodificar JWT sem verificação (apenas para ler payload)
  static decodeJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  // Verificar se token está próximo da expiração (5 minutos antes)
  static isTokenExpiringSoon(token: string): boolean {
    const payload = this.decodeJWT(token);
    if (!payload?.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    const expiryTime = payload.exp;
    const timeUntilExpiry = expiryTime - now;
    
    // Renovar se faltam menos de 5 minutos (300 segundos)
    return timeUntilExpiry < 300;
  }

  // Verificar se token está expirado
  static isTokenExpired(token: string): boolean {
    const payload = this.decodeJWT(token);
    if (!payload?.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }

  // Renovar token usando refresh token
  static async refreshAccessToken(): Promise<void> {
    // Evitar múltiplas tentativas simultâneas de refresh
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._performRefresh();
    
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private static async _performRefresh(): Promise<void> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      this.logout();
      return;
    }

    try {
      console.log('🔄 Renovando token de acesso...');
      
      const response = await axios.post(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.REFRESH), {
        refresh: refreshToken
      });

      const { access } = response.data;
      
      // Salvar novo token
      localStorage.setItem('access_token', access);
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      
      console.log('✅ Token renovado com sucesso');
      
      // Programar próxima verificação
      this.scheduleNextRefresh(access);
      
    } catch (error) {
      console.error('❌ Erro ao renovar token:', error);
      this.logout();
    }
  }

  // Programar próxima verificação de renovação
  static scheduleNextRefresh(accessToken: string): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const payload = this.decodeJWT(accessToken);
    if (!payload?.exp) return;

    const now = Math.floor(Date.now() / 1000);
    const expiryTime = payload.exp;
    const timeUntilExpiry = expiryTime - now;
    
    // Programar para verificar 6 minutos antes da expiração
    const checkTime = Math.max((timeUntilExpiry - 360) * 1000, 60000); // Mínimo de 1 minuto
    
    console.log(`🕒 Próxima verificação de token em ${Math.round(checkTime / 60000)} minutos`);
    
    this.refreshTimer = setTimeout(() => {
      this.checkAndRefreshToken();
    }, checkTime);
  }

  // Verificar e renovar token se necessário
  static async checkAndRefreshToken(): Promise<void> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      this.logout();
      return;
    }

    if (this.isTokenExpired(accessToken)) {
      console.log('🔒 Token expirado, fazendo logout...');
      this.logout();
      return;
    }

    if (this.isTokenExpiringSoon(accessToken)) {
      await this.refreshAccessToken();
    } else {
      // Reprogramar próxima verificação
      this.scheduleNextRefresh(accessToken);
    }
  }

  // Fazer logout e limpar dados
  static logout(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    
    delete api.defaults.headers.common['Authorization'];
    
    // Redirecionar para login apenas se não estiver já na página de login
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  // Iniciar sistema de refresh automático
  static startAutoRefresh(): void {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken && !this.isTokenExpired(accessToken)) {
      this.scheduleNextRefresh(accessToken);
    }
  }

  // Parar sistema de refresh automático
  static stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// Configuração base da API
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  withCredentials: false,  // Desabilitar para evitar problemas com CSRF
  headers: API_CONFIG.DEFAULT_HEADERS,
  timeout: API_CONFIG.TIMEOUT,
});

// Interceptor para adicionar token de autenticação e verificar expiração
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      // Verificar se token está próximo da expiração antes da requisição
      if (TokenManager.isTokenExpiringSoon(token)) {
        try {
          await TokenManager.refreshAccessToken();
          // Usar novo token após refresh
          const newToken = localStorage.getItem('access_token');
          if (newToken) {
            config.headers.Authorization = `Bearer ${newToken}`;
          }
        } catch (error) {
          console.error('Erro ao renovar token na requisição:', error);
          // Se falhou o refresh, usar token atual e deixar o interceptor de resposta lidar
          config.headers.Authorization = `Bearer ${token}`;
        }
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
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
        await TokenManager.refreshAccessToken();
        
        // Usar novo token para repetir a requisição
        const newToken = localStorage.getItem('access_token');
        if (newToken) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Se o refresh falhou, fazer logout
        console.error('Refresh token expirado ou inválido:', refreshError);
        TokenManager.logout();
      }
    }

    if (error.response?.status === 401) {
      // Redirecionar para login se não autenticado
      TokenManager.logout();
    }
    return Promise.reject(error);
  }
);

export { api, TokenManager };
export default api; 
