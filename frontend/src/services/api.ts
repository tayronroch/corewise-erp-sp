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
      console.log('❌ Nenhum refresh token encontrado');
      this.logout();
      return;
    }

    try {
      console.log('🔄 Renovando token de acesso...');
      console.log('🔑 Refresh token usado:', refreshToken.substring(0, 20) + '...');
      
      const response = await axios.post(buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.REFRESH), {
        refresh: refreshToken
      });

      const { access, refresh: newRefresh } = response.data;
      
      // Salvar novo access token
      localStorage.setItem('access_token', access);
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      
      // ⚠️ IMPORTANTE: Se o backend retornar um novo refresh token, atualizá-lo
      if (newRefresh && newRefresh !== refreshToken) {
        console.log('🔄 Atualizando refresh token...');
        localStorage.setItem('refresh_token', newRefresh);
      }
      
      console.log('✅ Token renovado com sucesso');
      
      // Programar próxima verificação
      this.scheduleNextRefresh(access);
      
    } catch (error) {
      console.error('❌ Erro ao renovar token:', error);
      console.log('🔑 Refresh token que falhou:', refreshToken.substring(0, 20) + '...');
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
    
    console.log(`Próxima verificação de token em ${Math.round(checkTime / 60000)} minutos`);
    
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
      console.log('Token expirado, fazendo logout...');
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

  // Funções de teste e debug
  static getTokenInfo(): any {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return { error: 'No access token found' };

    const payload = this.decodeJWT(accessToken);
    if (!payload) return { error: 'Invalid token format' };

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - now;
    const expiryDate = new Date(payload.exp * 1000);

    return {
      issuedAt: new Date(payload.iat * 1000).toLocaleString(),
      expiresAt: expiryDate.toLocaleString(),
      timeUntilExpiry: Math.round(timeUntilExpiry / 60), // em minutos
      isExpiringSoon: this.isTokenExpiringSoon(accessToken),
      isExpired: this.isTokenExpired(accessToken),
      payload: payload
    };
  }

  static async testRefresh(): Promise<void> {
    console.log('TESTE - Iniciando teste manual de refresh...');
    console.log('TESTE - Token atual:', this.getTokenInfo());
    
    try {
      await this.refreshAccessToken();
      console.log('TESTE - Refresh realizado com sucesso!');
      console.log('TESTE - Novo token:', this.getTokenInfo());
    } catch (error) {
      console.error('TESTE - Erro no refresh:', error);
    }
  }

  static forceExpiringSoon(): void {
    console.log('TESTE - Forçando token próximo da expiração...');
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.log('TESTE - Nenhum token encontrado');
      return;
    }

    // Parar timer atual
    this.stopAutoRefresh();

    // Forçar verificação imediata (simula token próximo da expiração)
    setTimeout(() => {
      console.log('TESTE - Simulando verificação de token próximo da expiração...');
      this.checkAndRefreshToken();
    }, 1000);
  }

  static debugTimerStatus(): void {
    console.log('DEBUG - Status do timer:', {
      hasTimer: !!this.refreshTimer,
      hasRefreshPromise: !!this.refreshPromise,
      tokenInfo: this.getTokenInfo()
    });
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

// Disponibilizar TokenManager globalmente para testes no console
if (typeof window !== 'undefined') {
  (window as any).TokenManager = TokenManager;
}

export { api, TokenManager };
export default api; 
