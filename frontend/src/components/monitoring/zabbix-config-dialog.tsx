import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Computer as HostIcon,
} from '@mui/icons-material';
import { zabbixService, type ZabbixConfig, type ZabbixHostData } from '../../services/zabbixService';

interface ZabbixConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onConfigured?: (hosts: ZabbixHostData[]) => void;
}

export const ZabbixConfigDialog: React.FC<ZabbixConfigDialogProps> = ({
  open,
  onClose,
  onConfigured,
}) => {
  const [config, setConfig] = useState<ZabbixConfig>({
    url: '',
    username: '',
    password: '',
    apiVersion: '6.0',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [availableHosts, setAvailableHosts] = useState<ZabbixHostData[]>([]);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [autoSync, setAutoSync] = useState(true);

  // Carregar configuração salva
  useEffect(() => {
    const savedConfig = localStorage.getItem('zabbix_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Erro ao carregar configuração salva:', error);
      }
    }
  }, []);

  const handleConfigChange = (field: keyof ZabbixConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const testConnection = async () => {
    if (!config.url || !config.username || !config.password) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Configurar o serviço
      zabbixService.configure(config);
      
      // Testar conectividade
      const canConnect = await zabbixService.testConnection();
      if (!canConnect) {
        throw new Error('Não foi possível conectar ao Zabbix. Verifique a URL.');
      }

      // Tentar autenticar
      const authenticated = await zabbixService.authenticate(config.username, config.password);
      if (!authenticated) {
        throw new Error('Falha na autenticação. Verifique usuário e senha.');
      }

      setConnectionStatus('connected');
      
      // Carregar hosts disponíveis
      await loadHosts();
      
    } catch (error) {
      console.error('Erro na conexão:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido na conexão');
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const loadHosts = async () => {
    try {
      setLoading(true);
      const hosts = await zabbixService.getHosts();
      setAvailableHosts(hosts);
      
      // Selecionar hosts que estão ativos por padrão
      const activeHostIds = hosts
        .filter(host => host.status === 0 && host.available === 1)
        .map(host => host.hostid);
      setSelectedHosts(activeHostIds);
      
    } catch (error) {
      console.error('Erro ao carregar hosts:', error);
      setError('Erro ao carregar lista de hosts');
    } finally {
      setLoading(false);
    }
  };

  const handleHostToggle = (hostId: string) => {
    setSelectedHosts(prev => 
      prev.includes(hostId)
        ? prev.filter(id => id !== hostId)
        : [...prev, hostId]
    );
  };

  const handleSave = async () => {
    if (connectionStatus !== 'connected') {
      setError('Teste a conexão primeiro');
      return;
    }

    if (selectedHosts.length === 0) {
      setError('Selecione pelo menos um host para monitoramento');
      return;
    }

    try {
      setLoading(true);
      
      // Salvar configurações
      localStorage.setItem('zabbix_auto_sync', String(autoSync));
      localStorage.setItem('zabbix_selected_hosts', JSON.stringify(selectedHosts));
      
      // Retornar hosts selecionados para o componente pai
      const hosts = availableHosts.filter(host => selectedHosts.includes(host.hostid));
      onConfigured?.(hosts);
      
      onClose();
      
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      setError('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: 'disconnected' | 'connecting' | 'connected' | 'error') => {
    switch (status) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: 'disconnected' | 'connecting' | 'connected' | 'error') => {
    switch (status) {
      case 'connected': return <CheckCircleIcon />;
      case 'connecting': return <CircularProgress size={16} />;
      case 'error': return <ErrorIcon />;
      default: return <WarningIcon />;
    }
  };

  const getHostStatusText = (host: ZabbixHostData) => {
    if (host.status === 0 && host.available === 1) return 'Online';
    if (host.status === 0 && host.available === 2) return 'Offline';
    if (host.status === 1) return 'Não monitorado';
    return 'Desconhecido';
  };

  const getHostStatusColor = (host: ZabbixHostData): 'success' | 'error' | 'warning' | 'default' => {
    if (host.status === 0 && host.available === 1) return 'success';
    if (host.status === 0 && host.available === 2) return 'error';
    return 'warning';
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { bgcolor: '#1e1e1e', color: '#fff', minHeight: '70vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <SettingsIcon />
        Configuração do Zabbix
        <Box sx={{ ml: 'auto' }}>
          <Chip
            icon={getStatusIcon(connectionStatus)}
            label={connectionStatus === 'connected' ? 'Conectado' : 
                   connectionStatus === 'connecting' ? 'Conectando' :
                   connectionStatus === 'error' ? 'Erro' : 'Desconectado'}
            color={getStatusColor(connectionStatus)}
            size="small"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ py: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Configurações de Conexão */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Configurações de Conexão
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="URL do Zabbix"
              value={config.url}
              onChange={(e) => handleConfigChange('url', e.target.value)}
              placeholder="https://zabbix.exemplo.com"
              fullWidth
              variant="outlined"
              sx={{
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                  '&:hover fieldset': { borderColor: '#777' },
                },
              }}
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Usuário"
                value={config.username}
                onChange={(e) => handleConfigChange('username', e.target.value)}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: '#555' },
                    '&:hover fieldset': { borderColor: '#777' },
                  },
                }}
              />
              
              <TextField
                label="Senha"
                type="password"
                value={config.password}
                onChange={(e) => handleConfigChange('password', e.target.value)}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: '#555' },
                    '&:hover fieldset': { borderColor: '#777' },
                  },
                }}
              />
            </Box>
            
            <TextField
              label="Versão da API"
              value={config.apiVersion}
              onChange={(e) => handleConfigChange('apiVersion', e.target.value)}
              variant="outlined"
              sx={{
                width: 200,
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                  '&:hover fieldset': { borderColor: '#777' },
                },
              }}
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Button
              onClick={testConnection}
              disabled={loading || !config.url || !config.username || !config.password}
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
            >
              {loading ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </Box>
        </Box>

        {/* Lista de Hosts (só aparece após conexão bem-sucedida) */}
        {connectionStatus === 'connected' && (
          <>
            <Divider sx={{ my: 3, bgcolor: '#555' }} />
            
            <Box>
              <Typography variant="h6" gutterBottom>
                Hosts Disponíveis ({availableHosts.length})
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                  />
                }
                label="Sincronização automática de status"
                sx={{ mb: 2 }}
              />
              
              <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #555', borderRadius: 1 }}>
                <List dense>
                  {availableHosts.map((host) => (
                    <ListItem
                      key={host.hostid}
                      onClick={() => handleHostToggle(host.hostid)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        borderBottom: '1px solid #333',
                      }}
                    >
                      <ListItemIcon>
                        <Checkbox
                          checked={selectedHosts.includes(host.hostid)}
                          tabIndex={-1}
                          disableRipple
                          sx={{ color: '#fff' }}
                        />
                      </ListItemIcon>
                      <ListItemIcon>
                        <HostIcon sx={{ color: '#fff' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={host.name || host.host}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {host.interfaces?.[0]?.ip || 'Sem IP'}
                            </Typography>
                            <Chip
                              label={getHostStatusText(host)}
                              size="small"
                              color={getHostStatusColor(host)}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                  
                  {availableHosts.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary="Nenhum host encontrado"
                        secondary="Verifique se há hosts configurados no Zabbix"
                        sx={{ textAlign: 'center', color: '#aaa' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
              
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {selectedHosts.length} de {availableHosts.length} hosts selecionados para monitoramento
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={connectionStatus !== 'connected' || selectedHosts.length === 0 || loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {loading ? 'Salvando...' : 'Salvar e Aplicar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ZabbixConfigDialog;
