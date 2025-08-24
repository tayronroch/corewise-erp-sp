/**
 * Dashboard de Segurança - CoreWise
 * Componente principal para monitoramento de segurança e auditoria
 */

import React, { useState, useEffect } from 'react';
import { auditService } from '../../services/auditService';
import type { SecurityDashboard, AuditStats } from '../../services/auditService';

interface SecurityMetrics {
  title: string;
  value: number;
  icon: string;
  color: string;
  description: string;
}

const SecurityDashboardComponent: React.FC = () => {
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Removed tab functionality - this is security-only dashboard
  // Controle de atualização automática (interval local)

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardData, statsData] = await Promise.all([
        auditService.getSecurityDashboard(),
        auditService.getAuditStats(),
      ]);
      
      setDashboard(dashboardData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
      console.error('Erro no dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto refresh a cada 30 segundos
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getMetrics = (): SecurityMetrics[] => {
    if (!dashboard || !stats) return [];

    return [
      {
        title: 'Sessões Ativas',
        value: dashboard.active_sessions,
        icon: '👥',
        color: 'bg-blue-500',
        description: 'Usuários conectados atualmente'
      },
      {
        title: 'IPs Bloqueados',
        value: dashboard.blocked_ips,
        icon: '🚫',
        color: 'bg-red-500',
        description: 'Endereços IP temporariamente bloqueados'
      },
      {
        title: 'Usuários Bloqueados',
        value: dashboard.blocked_users,
        icon: '⛔',
        color: 'bg-orange-500',
        description: 'Contas de usuário bloqueadas'
      },
      {
        title: 'Falhas de Login Hoje',
        value: dashboard.failed_logins_today,
        icon: '🔐',
        color: 'bg-yellow-500',
        description: 'Tentativas de login falhadas hoje'
      },
      {
        title: 'Alertas de Segurança',
        value: stats.security_alerts,
        icon: '⚠️',
        color: 'bg-purple-500',
        description: 'Atividades suspeitas detectadas'
      },
      {
        title: 'Total de Logs',
        value: stats.total_logs,
        icon: '📊',
        color: 'bg-green-500',
        description: 'Logs de auditoria registrados'
      },
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dashboard de segurança...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Erro no Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard || !stats) return null;

  const metrics = getMetrics();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🛡️ Dashboard de Segurança</h1>
              <p className="text-gray-600 mt-2">Monitoramento de segurança, auditoria e proteção de dados - CoreWise</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={fetchDashboardData}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                🔄 Atualizar
              </button>
              <div className="text-sm text-gray-500">
                Última atualização: {new Date().toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        {/* Alertas de Segurança */}
        {dashboard.security_alerts.length > 0 && (
          <div className="mb-8">
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400 text-xl">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Alertas de Segurança Ativas ({dashboard.security_alerts.length})
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc pl-5 space-y-1">
                      {dashboard.security_alerts.map((alert, index) => (
                        <li key={index}>{alert.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {metrics.map((metric, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">{metric.description}</p>
                </div>
                <div className={`${metric.color} rounded-full p-3 text-white text-2xl`}>
                  {metric.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Gráficos e Estatísticas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Atividade por Hora */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Atividade nas Últimas 24h</h3>
            <div className="space-y-3">
              {stats.activity_by_hour.slice(-12).map((hour, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{hour.hour}</span>
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-200 rounded-full h-2" style={{width: `${Math.max(20, (hour.count / Math.max(...stats.activity_by_hour.map(h => h.count))) * 100)}px`}}></div>
                    <span className="text-sm font-medium text-gray-900 w-8">{hour.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Usuários Mais Ativos */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">👑 Usuários Mais Ativos (7 dias)</h3>
            <div className="space-y-3">
              {stats.most_active_users.slice(0, 8).map((user, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{user.user__username}</span>
                  <span className="text-sm font-medium text-blue-600">{user.count} ações</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tentativas de Login Falhadas Recentes */}
        {dashboard.recent_failed_attempts.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔐 Tentativas de Login Falhadas Recentes</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tempo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dashboard.recent_failed_attempts.slice(0, 5).map((attempt) => (
                    <tr key={attempt.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {attempt.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {attempt.ip_address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {attempt.failure_reason || 'Credenciais inválidas'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {attempt.time_ago}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Usuários de Alto Risco */}
        {dashboard.high_risk_users.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">⚠️ Usuários de Alto Risco</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard.high_risk_users.slice(0, 6).map((user) => (
                <div key={user.id} className={`p-4 rounded-lg border-l-4 ${auditService.getRiskColor(user.security_risk_level.level)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-gray-600">{user.user_full_name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${auditService.getRiskColor(user.security_risk_level.level)}`}>
                      {user.security_risk_level.label}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Falhas hoje: {user.failed_login_attempts_today}</p>
                    <p>Atividades suspeitas: {user.suspicious_activity_count}</p>
                    {user.last_activity_ago && <p>Última atividade: {user.last_activity_ago}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atividades Suspeitas */}
        {dashboard.suspicious_activities.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🚨 Atividades Suspeitas Recentes</h3>
            <div className="space-y-3">
              {dashboard.suspicious_activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <span className="text-red-500 text-sm">🚨</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{activity.user_username}</span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600">{activity.action_display}</span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-500">{auditService.formatTimestamp(activity.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{activity.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                      <span>IP: {activity.ip_address}</span>
                      <span>App: {activity.app_name}</span>
                      {activity.module_name && <span>Módulo: {activity.module_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityDashboardComponent;
