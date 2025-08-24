import { api } from './api';

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  last_login?: string;
  profile: {
    phone: string;
    role: 'admin' | 'editor' | 'viewer';
    avatar?: string;
    is_active: boolean;
    last_login_ip?: string;
    created_at: string;
    updated_at: string;
  };
}

export interface CreateUserData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
  phone?: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface UpdateUserData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  phone?: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admins: number;
  editors: number;
  viewers: number;
  recent_logins: number;
  new_users: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  user?: T;
  results?: T[];
  count?: number;
  next?: string;
  previous?: string;
}

class UserService {
  private baseUrl = '/api/core/users';

  /**
   * Listar todos os usuários com filtros opcionais
   */
  async getUsers(params?: {
    search?: string;
    role?: string;
    active?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse<User[]> & { results: User[]; count: number }> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.search) queryParams.append('search', params.search);
      if (params?.role) queryParams.append('role', params.role);
      if (params?.active !== undefined) queryParams.append('active', String(params.active));
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.page_size) queryParams.append('page_size', String(params.page_size));

      const response = await api.get(`${this.baseUrl}/?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      throw error;
    }
  }

  /**
   * Buscar usuário por ID
   */
  async getUser(id: string): Promise<ApiResponse<User>> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      throw error;
    }
  }

  /**
   * Criar novo usuário
   */
  async createUser(userData: CreateUserData): Promise<ApiResponse<User>> {
    try {
      const response = await api.post(`${this.baseUrl}/`, userData);
      return response.data;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  /**
   * Atualizar usuário
   */
  async updateUser(id: string, userData: Partial<UpdateUserData>): Promise<ApiResponse<User>> {
    try {
      const response = await api.patch(`${this.baseUrl}/${id}/`, userData);
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  /**
   * Deletar usuário
   */
  async deleteUser(id: string): Promise<ApiResponse<null>> {
    try {
      const response = await api.delete(`${this.baseUrl}/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error;
    }
  }

  /**
   * Ativar/Desativar usuário
   */
  async toggleUserStatus(id: string): Promise<ApiResponse<{ is_active: boolean }>> {
    try {
      const response = await api.post(`${this.baseUrl}/${id}/toggle_status/`);
      return response.data;
    } catch (error) {
      console.error('Erro ao alterar status do usuário:', error);
      throw error;
    }
  }

  /**
   * Resetar senha do usuário
   */
  async resetPassword(id: string, newPassword: string): Promise<ApiResponse<null>> {
    try {
      const response = await api.post(`${this.baseUrl}/${id}/reset_password/`, {
        new_password: newPassword
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas dos usuários
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const response = await api.get(`${this.baseUrl}/stats/`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Verificar permissões do usuário atual
   */
  async checkPermissions(): Promise<{
    role: string;
    permissions: string[];
  }> {
    try {
      const response = await api.get('/api/core/users/permissions/');
      return response.data;
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      throw error;
    }
  }

  /**
   * Obter perfil do usuário logado
   */
  async getMyProfile(): Promise<ApiResponse<User>> {
    try {
      const response = await api.get(`${this.baseUrl}/profile/`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      throw error;
    }
  }

  /**
   * Atualizar perfil do usuário logado
   */
  async updateMyProfile(userData: Partial<UpdateUserData>): Promise<ApiResponse<User>> {
    try {
      const response = await api.patch(`${this.baseUrl}/profile/`, userData);
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  }
}

export const userService = new UserService();