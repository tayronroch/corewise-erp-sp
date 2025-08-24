/**
 * Serviço para gerenciar auditoria e segurança - CoreWise
 * Integração com sistema global de logs e monitoramento
 */

export interface AuditLog {
  id: number;
  timestamp: string;
  user_username: string;
  user_full_name: string;
  action: string;
  action_display: string;
  description: string;
  ip_address: string;
  app_name: string;
  module_name: string;
  success: boolean;
  execution_time_ms?: number;
  endpoint: string;
  error_message?: string;
}

export interface SecuritySettings {
  id: number;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  session_timeout_minutes: number;
  concurrent_sessions_limit: number;
  audit_retention_days: number;
  access_log_retention_days: number;
  enable_ip_whitelist: boolean;
  allowed_ips: string;
  enable_geo_blocking: boolean;
  blocked_countries: string;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_symbols: boolean;
  mfa_required_for_admin: boolean;
  mfa_required_for_all: boolean;
  api_rate_limit_per_minute: number;
  search_rate_limit_per_minute: number;
  export_rate_limit_per_hour: number;
  notify_admin_on_failed_login: boolean;
  admin_notification_email: string;
  created_at: string;
  updated_at: string;
}

export interface LoginAttempt {
  id: number;
  username: string;
  ip_address: string;
  success: boolean;
  success_display: string;
  failure_reason?: string;
  timestamp: string;
  time_ago: string;
  app_name: string;
  geolocation?: any;
}

export interface UserActivitySummary {
  id: number;
  username: string;
  user_full_name: string;
  user_email: string;
  is_active: boolean;
  is_staff: boolean;
  total_logins: number;
  total_searches: number;
  total_exports: number;
  total_admin_actions: number;
  last_login?: string;
  last_activity?: string;
  last_activity_ago?: string;
  last_ip?: string;
  failed_login_attempts_today: number;
  suspicious_activity_count: number;
  security_risk_level: {
    level: string;
    label: string;
    color: string;
  };
}

export interface SecurityDashboard {
  active_sessions: number;
  blocked_ips: number;
  blocked_users: number;
  failed_logins_today: number;
  recent_failed_attempts: LoginAttempt[];
  high_risk_users: UserActivitySummary[];
  suspicious_activities: AuditLog[];
  security_settings: SecuritySettings;
  security_alerts: {
    type: string;
    message: string;
    action: string;
  }[];
}

export interface AuditStats {
  total_logs: number;
  total_users: number;
  total_failed_logins: number;
  total_successful_logins: number;
  most_active_users: Array<{user__username: string; count: number}>;
  most_accessed_endpoints: Array<{endpoint: string; count: number}>;
  activity_by_hour: Array<{hour: string; count: number}>;
  activity_by_app: Record<string, number>;
  security_alerts: number;
  today_stats: {
    total_logs: number;
    unique_users: number;
    failed_logins: number;
  };
  week_stats: {
    total_logs: number;
    unique_users: number;
    failed_logins: number;
  };
  month_stats: {
    total_logs: number;
    unique_users: number;
    failed_logins: number;
  };
}


class AuditService {
  private baseUrl = '/api/core';
  
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Logs de Auditoria
  async getAuditLogs(params: {
    page?: number;
    page_size?: number;
    user?: string;
    action?: string;
    app_name?: string;
    success?: boolean;
    search?: string;
    ordering?: string;
  } = {}): Promise<{
    count: number;
    next: string | null;
    previous: string | null;
    results: AuditLog[];
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return this.request<{
      count: number;
      next: string | null;
      previous: string | null;
      results: AuditLog[];
    }>(`/audit-logs/?${queryParams}`);
  }

  async getMyActivity(): Promise<AuditLog[]> {
    return this.request<AuditLog[]>('/audit-logs/my_activity/');
  }

  async getAuditStats(): Promise<AuditStats> {
    return this.request<AuditStats>('/audit-logs/stats/');
  }

  // Configurações de Segurança
  async getSecuritySettings(): Promise<SecuritySettings> {
    const settings = await this.request<SecuritySettings[]>('/security-settings/');
    return settings[0]; // Singleton
  }

  async updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<SecuritySettings> {
    return this.request<SecuritySettings>('/security-settings/1/', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  // Dashboard de Segurança
  async getSecurityDashboard(): Promise<SecurityDashboard> {
    return this.request<SecurityDashboard>('/security-dashboard/');
  }

  // Tentativas de Login
  async getLoginAttempts(params: {
    page?: number;
    page_size?: number;
    username?: string;
    success?: boolean;
    search?: string;
  } = {}): Promise<{
    count: number;
    next: string | null;
    previous: string | null;
    results: LoginAttempt[];
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return this.request<{
      count: number;
      next: string | null;
      previous: string | null;
      results: LoginAttempt[];
    }>(`/login-attempts/?${queryParams}`);
  }

  // Atividades dos Usuários
  async getUserActivities(params: {
    page?: number;
    page_size?: number;
    search?: string;
    ordering?: string;
  } = {}): Promise<{
    count: number;
    next: string | null;
    previous: string | null;
    results: UserActivitySummary[];
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    return this.request<{
      count: number;
      next: string | null;
      previous: string | null;
      results: UserActivitySummary[];
    }>(`/user-activities/?${queryParams}`);
  }

  async getMyActivitySummary(): Promise<UserActivitySummary> {
    return this.request<UserActivitySummary>('/user-activities/my_summary/');
  }

  async updateUserCounters(userId: number): Promise<{message: string; summary: UserActivitySummary}> {
    return this.request<{message: string; summary: UserActivitySummary}>(`/user-activities/${userId}/update_counters/`, {
      method: 'POST',
    });
  }

  // Manutenção
  async cleanupOldLogs(): Promise<{message: string; deleted_counts: Record<string, number>}> {
    return this.request<{message: string; deleted_counts: Record<string, number>}>('/cleanup-logs/', {
      method: 'POST',
    });
  }

  // Health Check
  async getHealthCheck(): Promise<{
    status: string;
    timestamp: string;
    recent_activity: boolean;
    database: string;
    error?: string;
  }> {
    return this.request<{
      status: string;
      timestamp: string;
      recent_activity: boolean;
      database: string;
      error?: string;
    }>('/health/');
  }

  // Utilitários de formatação
  formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString('pt-BR');
  }

  formatDuration(ms?: number): string {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  getStatusColor(success: boolean): string {
    return success ? 'text-green-600' : 'text-red-600';
  }

  getRiskColor(level: string): string {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-orange-600 bg-orange-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

}

const auditService = new AuditService();
export { auditService };
export default auditService;