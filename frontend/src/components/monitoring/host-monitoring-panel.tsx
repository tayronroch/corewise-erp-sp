import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,

  Alert,
  CircularProgress,
  Button,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Computer as HostIcon,
  Memory as MemoryIcon,
  Speed as CpuIcon,
  Schedule as UptimeIcon,
  NetworkCheck as NetworkIcon,
  Refresh as RefreshIcon,
  Timeline as MetricsIcon,
  Warning as WarningIcon,
  CheckCircle as OnlineIcon,
  Error as OfflineIcon,
} from '@mui/icons-material';
import { zabbixService, ZabbixUtils } from '../../services/zabbixService';
import type { MapItem } from '../../types/mapTypes';

interface HostMonitoringPanelProps {
  open: boolean;
  onClose: () => void;
  selectedHost: MapItem | null;
}

interface HostMetrics {
  cpu?: number;
  memory?: number;
  uptime?: number;
  networkIn?: number;
  networkOut?: number;
  diskUsage?: number;
  loadAverage?: number;
  lastUpdate: Date;
}

interface HostAlerts {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

export const HostMonitoringPanel: React.FC<HostMonitoringPanelProps> = ({
  open,
  onClose,
  selectedHost,
}) => {
  const [metrics, setMetrics] = useState<HostMetrics | null>(null);
  const [alerts, setAlerts] = useState<HostAlerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Buscar métricas do host
  const fetchHostMetrics = useCallback(async () => {
    if (!selectedHost?.zabbixHost?.zabbixHostId || !zabbixService.isAuthenticated()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [status, rawMetrics] = await Promise.all([
        zabbixService.getHostStatus(selectedHost.zabbixHost.zabbixHostId),
        zabbixService.getHostMetrics(selectedHost.zabbixHost.zabbixHostId),
      ]);

      // Processar métricas
      const processedMetrics: HostMetrics = {
        cpu: status.cpu,
        memory: status.memory,
        uptime: status.uptime,
        lastUpdate: status.lastUpdate,
      };

      // Extrair métricas adicionais do array de métricas
      rawMetrics.forEach(metric => {
        const name = metric.name.toLowerCase();
        const value = parseFloat(metric.value);
        
        if (name.includes('network') && name.includes('in')) {
          processedMetrics.networkIn = value;
        } else if (name.includes('network') && name.includes('out')) {
          processedMetrics.networkOut = value;
        } else if (name.includes('disk') && name.includes('used')) {
          processedMetrics.diskUsage = value;
        } else if (name.includes('load') || name.includes('avg')) {
          processedMetrics.loadAverage = value;
        }
      });

      setMetrics(processedMetrics);
      setLastRefresh(new Date());

    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      setError('Erro ao carregar métricas do host');
    } finally {
      setLoading(false);
    }
  }, [selectedHost]);

  // Atualização automática das métricas
  useEffect(() => {
    if (open && selectedHost?.zabbixHost?.zabbixHostId) {
      fetchHostMetrics();
      
      const interval = setInterval(fetchHostMetrics, 30000); // Atualizar a cada 30 segundos
      return () => clearInterval(interval);
    }
  }, [open, selectedHost, fetchHostMetrics]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return '#4caf50';
      case 'offline': return '#f44336';
      default: return '#ff9800';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'online': return <OnlineIcon sx={{ color: '#4caf50' }} />;
      case 'offline': return <OfflineIcon sx={{ color: '#f44336' }} />;
      default: return <WarningIcon sx={{ color: '#ff9800' }} />;
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getProgressColor = (value: number, thresholds = { warning: 70, critical: 90 }) => {
    if (value >= thresholds.critical) return 'error';
    if (value >= thresholds.warning) return 'warning';
    return 'success';
  };

  if (!selectedHost) {
    return null;
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 400,
          bgcolor: '#1e1e1e',
          color: '#fff',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HostIcon />
            Monitoramento
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Atualizar métricas">
              <IconButton 
                onClick={fetchHostMetrics} 
                disabled={loading}
                sx={{ color: '#fff' }}
              >
                {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Host Info */}
        <Card sx={{ mb: 3, bgcolor: '#333' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {selectedHost.name}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getStatusIcon(selectedHost.zabbixHost?.status)}
                <Typography variant="body2">
                  Status: {selectedHost.zabbixHost?.status || 'Desconhecido'}
                </Typography>
              </Box>
              {selectedHost.zabbixHost?.ipAddress && (
                <Typography variant="body2" color="text.secondary">
                  IP: {selectedHost.zabbixHost.ipAddress}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Última atualização: {lastRefresh.toLocaleTimeString()}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Metrics */}
        {!selectedHost.zabbixHost?.zabbixHostId ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            Host não está associado ao Zabbix. Configure a integração para ver métricas.
          </Alert>
        ) : !zabbixService.isAuthenticated() ? (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Não conectado ao Zabbix. Configure a conexão para ver métricas.
          </Alert>
        ) : metrics ? (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MetricsIcon />
              Métricas do Sistema
            </Typography>

            <Box sx={{ mb: 3 }}>
              {/* CPU Usage */}
              {metrics.cpu !== undefined && (
                <Box sx={{ mb: 2 }}>
                  <Paper sx={{ p: 2, bgcolor: '#333' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CpuIcon />
                      <Typography variant="subtitle2">CPU</Typography>
                      <Typography variant="h6" sx={{ ml: 'auto' }}>
                        {metrics.cpu.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(metrics.cpu, 100)}
                      color={getProgressColor(metrics.cpu)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Paper>
                </Box>
              )}

              {/* Memory Usage */}
              {metrics.memory !== undefined && (
                <Box sx={{ mb: 2 }}>
                  <Paper sx={{ p: 2, bgcolor: '#333' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <MemoryIcon />
                      <Typography variant="subtitle2">Memória</Typography>
                      <Typography variant="h6" sx={{ ml: 'auto' }}>
                        {metrics.memory.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(metrics.memory, 100)}
                      color={getProgressColor(metrics.memory)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Paper>
                </Box>
              )}

              {/* Disk Usage */}
              {metrics.diskUsage !== undefined && (
                <Box sx={{ mb: 2 }}>
                  <Paper sx={{ p: 2, bgcolor: '#333' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle2">Disco</Typography>
                      <Typography variant="h6" sx={{ ml: 'auto' }}>
                        {metrics.diskUsage.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(metrics.diskUsage, 100)}
                      color={getProgressColor(metrics.diskUsage, { warning: 80, critical: 95 })}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Paper>
                </Box>
              )}
            </Box>

            {/* System Info */}
            <List sx={{ bgcolor: '#333', borderRadius: 1, mb: 3 }}>
              {metrics.uptime !== undefined && (
                <ListItem>
                  <ListItemIcon>
                    <UptimeIcon sx={{ color: '#fff' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Uptime"
                    secondary={formatUptime(metrics.uptime)}
                  />
                </ListItem>
              )}

              {metrics.loadAverage !== undefined && (
                <ListItem>
                  <ListItemIcon>
                    <CpuIcon sx={{ color: '#fff' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Load Average"
                    secondary={metrics.loadAverage.toFixed(2)}
                  />
                </ListItem>
              )}

              {(metrics.networkIn !== undefined || metrics.networkOut !== undefined) && (
                <ListItem>
                  <ListItemIcon>
                    <NetworkIcon sx={{ color: '#fff' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Rede"
                    secondary={
                      <Box>
                        {metrics.networkIn !== undefined && (
                          <Typography variant="caption" display="block">
                            In: {ZabbixUtils.formatBps(metrics.networkIn)}
                          </Typography>
                        )}
                        {metrics.networkOut !== undefined && (
                          <Typography variant="caption" display="block">
                            Out: {ZabbixUtils.formatBps(metrics.networkOut)}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              )}
            </List>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={fetchHostMetrics}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
              >
                Atualizar
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default HostMonitoringPanel;
