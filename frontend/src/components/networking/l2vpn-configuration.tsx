import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Snackbar,
  CircularProgress,
  Backdrop,
  IconButton,
  Paper,
  Chip
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { api } from '../../services/api';

interface L2VPNConfigurationProps {
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  selectedHostLeft: MapItem | null;
  selectedHostRight: MapItem | null;
  onClose: () => void;
}

interface MapItem {
  id: string;
  name: string;
  hostname?: string;
  ip?: string;
  zabbixHost?: {
    ipAddress?: string;
  };
}

interface L2VPNFormData {
  // Dados gerais
  cidade: string;
  ip: string;
  
  // Configuração L2VPN
  vpwsGroupName: string;
  vpnId: string;
  neighborIp: string;
  pwVlan: string;
  pwId: string;
  
  // Interface
  empresaTipo: string;
  numeroInterface: string;
  
  // Configurações específicas por modo
  dot1q: string;
  neighborTargetedIp: string;
  
  // Estado de modo
  modo: 'qinq' | 'access' | 'access-raw' | null;
  
  // Estado de confirmação
  confirmed: boolean;
}

interface CredentialsDialogData {
  login: string;
  senha: string;
}

const INTERFACE_TYPES = [
  { value: 'gigabit', label: 'gigabit' },
  { value: 'forty-gigabit', label: 'forty' },
  { value: 'ten-gigabit', label: 'ten' },
  { value: 'twenty-five-gigabit', label: 'twenty-five' },
  { value: 'hundred-gigabit', label: 'hundred' },
  { value: 'lag-', label: 'lag-' },
];

const L2VPNConfiguration: React.FC<L2VPNConfigurationProps> = ({
  leftDrawerOpen,
  rightDrawerOpen,
  selectedHostLeft,
  selectedHostRight,
  onClose
}) => {
  // Estados do formulário PE1 (esquerda) e PE2 (direita)
  const [pe1Data, setPe1Data] = useState<L2VPNFormData>({
    cidade: '',
    ip: '',
    vpwsGroupName: '',
    vpnId: '',
    neighborIp: '',
    pwVlan: '',
    pwId: '',
    empresaTipo: 'gigabit',
    numeroInterface: '',
    dot1q: '',
    neighborTargetedIp: '',
    modo: null,
    confirmed: false
  });

  const [pe2Data, setPe2Data] = useState<L2VPNFormData>({
    cidade: '',
    ip: '',
    vpwsGroupName: '',
    vpnId: '',
    neighborIp: '',
    pwVlan: '',
    pwId: '',
    empresaTipo: 'gigabit',
    numeroInterface: '',
    dot1q: '',
    neighborTargetedIp: '',
    modo: null,
    confirmed: false
  });

  // Estados do diálogo de credenciais
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState<CredentialsDialogData>({
    login: '',
    senha: ''
  });

  // Estados de loading e notificação
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Preencher dados iniciais com hosts selecionados
  useEffect(() => {
    if (selectedHostLeft) {
      setPe1Data(prev => ({
        ...prev,
        cidade: selectedHostLeft.name || selectedHostLeft.hostname || '',
        ip: selectedHostLeft.ip || selectedHostLeft.zabbixHost?.ipAddress || '--',
        vpwsGroupName: selectedHostRight?.name || selectedHostRight?.hostname || '',
        neighborIp: selectedHostRight?.ip || selectedHostRight?.zabbixHost?.ipAddress || '',
        neighborTargetedIp: selectedHostRight?.ip || selectedHostRight?.zabbixHost?.ipAddress || ''
      }));
    }
  }, [selectedHostLeft, selectedHostRight]);

  useEffect(() => {
    if (selectedHostRight) {
      setPe2Data(prev => ({
        ...prev,
        cidade: selectedHostRight.name || selectedHostRight.hostname || '',
        ip: selectedHostRight.ip || selectedHostRight.zabbixHost?.ipAddress || '--',
        vpwsGroupName: selectedHostLeft?.name || selectedHostLeft?.hostname || '',
        neighborIp: selectedHostLeft?.ip || selectedHostLeft?.zabbixHost?.ipAddress || '',
        neighborTargetedIp: selectedHostLeft?.ip || selectedHostLeft?.zabbixHost?.ipAddress || ''
      }));
    }
  }, [selectedHostRight, selectedHostLeft]);

  // Sincronizar VPN ID e PW ID entre PE1 e PE2
  const syncVpnId = useCallback((newValue: string, source: 'pe1' | 'pe2') => {
    if (source === 'pe1') {
      setPe2Data(prev => ({ ...prev, vpnId: newValue }));
    } else {
      setPe1Data(prev => ({ ...prev, vpnId: newValue }));
    }
  }, []);

  const syncPwId = useCallback((newValue: string, source: 'pe1' | 'pe2') => {
    if (source === 'pe1') {
      setPe2Data(prev => ({ ...prev, pwId: newValue }));
    } else {
      setPe1Data(prev => ({ ...prev, pwId: newValue }));
    }
  }, []);

  // Handlers para mudança de modo
  const handleModeChange = (pe: 'pe1' | 'pe2', newMode: 'qinq' | 'access' | 'access-raw' | null) => {
    if (pe === 'pe1') {
      setPe1Data(prev => ({ ...prev, modo: newMode }));
    } else {
      setPe2Data(prev => ({ ...prev, modo: newMode }));
    }
  };

  // Handler para confirmar PE
  const handleConfirmPE = (pe: 'pe1' | 'pe2') => {
    if (pe === 'pe1') {
      setPe1Data(prev => ({ ...prev, confirmed: true }));
      setSnackbar({
        open: true,
        message: 'PE1 confirmado com sucesso!',
        severity: 'success'
      });
    } else {
      setPe2Data(prev => ({ ...prev, confirmed: true }));
      setSnackbar({
        open: true,
        message: 'PE2 confirmado com sucesso!',
        severity: 'success'
      });
    }

    // Se ambos PEs estão confirmados, abrir diálogo de credenciais
    const bothConfirmed = (pe === 'pe1' ? true : pe1Data.confirmed) && 
                         (pe === 'pe2' ? true : pe2Data.confirmed);
    
    if (bothConfirmed) {
      setTimeout(() => {
        setCredentialsDialogOpen(true);
      }, 1000);
    }
  };

  // Handler para envio final
  const handleFinalSubmit = async () => {
    setLoading(true);
    setCredentialsDialogOpen(false);

    try {
      // Preparar payload exatamente como no HTML original
      const payload = {
        // Cidades
        cidade_pe1: pe1Data.cidade,
        cidade_pe2: pe2Data.cidade,
        
        // Login
        login: credentials.login,
        senha: credentials.senha,
        
        // Modos (enviar apenas o modo ativo como no HTML)
        ...(pe1Data.modo === 'qinq' && { qinq_pe1: 'qinq' }),
        ...(pe1Data.modo === 'access' && { access_pe1: 'access' }),
        ...(pe1Data.modo === 'access-raw' && { vlan_selective_pe1: 'vlan-selective' }),
        
        ...(pe2Data.modo === 'qinq' && { qinq_pe2: 'qinq' }),
        ...(pe2Data.modo === 'access' && { access_pe2: 'access' }),
        ...(pe2Data.modo === 'access-raw' && { vlan_selective_pe2: 'vlan-selective' }),
        
        // Dados PE1
        vpws_group_name_pe1: pe1Data.vpwsGroupName,
        vpn_id_pe1: pe1Data.vpnId,
        neighbor_ip_pe1: pe1Data.neighborIp,
        pw_vlan_pe1: pe1Data.pwVlan,
        pw_id_pe1: pe1Data.pwId,
        empresa_pe1: pe1Data.empresaTipo,
        numero_pe1: pe1Data.numeroInterface,
        dot1q_pe1: pe1Data.dot1q,
        neighbor_targeted_ip_pe1: pe1Data.neighborTargetedIp,
        
        // Dados PE2
        vpws_group_name_pe2: pe2Data.vpwsGroupName,
        vpn_id_pe2: pe2Data.vpnId,
        neighbor_ip_pe2: pe2Data.neighborIp,
        pw_vlan_pe2: pe2Data.pwVlan,
        pw_id_pe2: pe2Data.pwId,
        empresa_pe2: pe2Data.empresaTipo,
        numero_pe2: pe2Data.numeroInterface,
        dot1q_pe2: pe2Data.dot1q,
        neighbor_targeted_ip_pe2: pe2Data.neighborTargetedIp,
      };

      console.log('Enviando payload L2VPN:', payload);

      const response = await api.post('/api/networking/configure_l2vpn/', payload);

      setSnackbar({
        open: true,
        message: `Configuração L2VPN iniciada com sucesso! Log ID: ${response.data.log_id}`,
        severity: 'success'
      });

      // Fechar componente após sucesso
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error: unknown) {
      console.error('Erro na configuração L2VPN:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setSnackbar({
        open: true,
        message: `Erro: ${errorMessage}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler para voltar com confirmação (se necessário)
  const handleBackClick = () => {
    const hasDataPE1 = pe1Data.vpnId || pe1Data.pwId || pe1Data.numeroInterface;
    const hasDataPE2 = pe2Data.vpnId || pe2Data.pwId || pe2Data.numeroInterface;
    
    if (hasDataPE1 || hasDataPE2) {
      const confirmClose = window.confirm('Você possui dados não salvos. Deseja realmente voltar ao menu?');
      if (confirmClose) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Render do painel de configuração individual
  const renderPEPanel = (pe: 'pe1' | 'pe2', data: L2VPNFormData, setData: React.Dispatch<React.SetStateAction<L2VPNFormData>>) => {
    const isLeft = pe === 'pe1';
    const peLabel = isLeft ? 'PE-A' : 'PE-B';
    const isConfirmed = data.confirmed;

    return (
      <Box sx={{ height: '100%', overflow: 'auto' }}>
        {/* Header com botão Voltar */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: { xs: 1.5, sm: 2 }, 
          borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 1
        }}>
          <IconButton
            onClick={handleBackClick}
            sx={{ 
              color: '#fff', 
              mr: { xs: 0.5, sm: 1 },
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease-in-out',
              width: { xs: 28, sm: 32 },
              height: { xs: 28, sm: 32 }
            }}
            title={`Voltar ao menu ${isLeft ? 'A' : 'B'}`}
          >
            <ArrowBack sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
          </IconButton>
          <Typography variant="h6" sx={{ 
            color: '#fff', 
            fontWeight: 'bold', 
            flex: 1,
            fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
          }}>
            Configuração do {peLabel}
          </Typography>
          
          {/* Indicador de status */}
          {isConfirmed && (
            <Chip
              label="✓ CONFIRMADO"
              size="small"
              sx={{
                bgcolor: '#4caf50',
                color: 'white',
                fontWeight: 'bold',
                fontSize: { xs: '0.6rem', sm: '0.7rem' },
                height: { xs: 20, sm: 24 }
              }}
            />
          )}
        </Box>

        {/* Conteúdo do formulário */}
        <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>

        {/* Botões de Modo */}
        <Box sx={{ mb: { xs: 2, sm: 2.5, md: 3 } }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: '#fff', opacity: 0.9, fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } }}>
            Modo de Operação:
          </Typography>
          <ToggleButtonGroup
            value={data.modo}
            exclusive
            onChange={(_, newMode) => handleModeChange(pe, newMode)}
            size="small"
            sx={{ 
              '& .MuiToggleButton-root': {
                color: '#fff',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                px: { xs: 1, sm: 1.5, md: 2 },
                py: { xs: 0.5, sm: 0.75, md: 1 },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                  borderColor: '#fff'
                },
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)'
                }
              }
            }}
          >
            <ToggleButton value="qinq">QinQ</ToggleButton>
            <ToggleButton value="access">Access</ToggleButton>
            <ToggleButton value="access-raw">Access-Raw</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Cidade */}
        <TextField
          fullWidth
          label={`Cidade ${peLabel}`}
          value={data.cidade}
          onChange={(e) => setData(prev => ({ ...prev, cidade: e.target.value }))}
          size="small"
          sx={{ 
            mb: { xs: 1.5, sm: 2 },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#fff' },
              '& input': { color: '#fff', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' } },
              '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
              '&.Mui-focused label': { color: '#fff' }
            }
          }}
        />

        {/* IP Display */}
        <Paper sx={{ 
          p: { xs: 1, sm: 1.5 }, 
          mb: { xs: 1.5, sm: 2 }, 
          bgcolor: 'rgba(255, 255, 255, 0.1)', 
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 1
        }}>
          <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9, fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } }}>
            IP: {data.ip}
          </Typography>
        </Paper>

        {/* VPWS Group Name */}
        <TextField
          fullWidth
          label={`VPWS Group Name ${peLabel}`}
          value={data.vpwsGroupName}
          onChange={(e) => setData(prev => ({ ...prev, vpwsGroupName: e.target.value }))}
          InputProps={{ readOnly: true }}
          size="small"
          sx={{ 
            mb: { xs: 1.5, sm: 2 },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '& input': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' } },
              '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
              bgcolor: 'rgba(255, 255, 255, 0.05)'
            }
          }}
        />

        {/* VPN ID */}
        <TextField
          fullWidth
          label={`VPN ID ${peLabel}`}
          value={data.vpnId}
          onChange={(e) => {
            setData(prev => ({ ...prev, vpnId: e.target.value }));
            syncVpnId(e.target.value, pe);
          }}
          size="small"
          sx={{ 
            mb: { xs: 1.5, sm: 2 },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#fff' },
              '& input': { color: '#fff', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' } },
              '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
              '&.Mui-focused label': { color: '#fff' }
            }
          }}
          required
        />

        {/* Neighbor IP */}
        <TextField
          fullWidth
          label={`Neighbor IP do ${peLabel}`}
          value={data.neighborIp}
          onChange={(e) => setData(prev => ({ ...prev, neighborIp: e.target.value }))}
          InputProps={{ readOnly: true }}
          size="small"
          sx={{ 
            mb: { xs: 1.5, sm: 2 },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '& input': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' } },
              '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
              bgcolor: 'rgba(255, 255, 255, 0.05)'
            }
          }}
          required
        />

        {/* PW-Type VLAN (ocultar em access-raw quando mode === vlan-selective) */}
        {data.modo !== 'access-raw' && (
          <TextField
            fullWidth
            label={`PW-Type VLAN ${peLabel}`}
            value={data.pwVlan}
            onChange={(e) => setData(prev => ({ ...prev, pwVlan: e.target.value }))}
            size="small"
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#fff' },
                '& input': { color: '#fff', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' } },
                '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
                '&.Mui-focused label': { color: '#fff' }
              }
            }}
          />
        )}

        {/* PW ID */}
        <TextField
          fullWidth
          label={`PW ID ${peLabel}`}
          value={data.pwId}
          onChange={(e) => {
            setData(prev => ({ ...prev, pwId: e.target.value }));
            syncPwId(e.target.value, pe);
          }}
          size="small"
          sx={{ 
            mb: { xs: 1.5, sm: 2 },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#fff' },
              '& input': { color: '#fff', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' } },
              '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
              '&.Mui-focused label': { color: '#fff' }
            }
          }}
          required
        />

        {/* Interface */}
        <Typography variant="subtitle2" sx={{ mb: 1, color: '#fff', opacity: 0.9, fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } }}>
          Interface {peLabel}:
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, mb: { xs: 1.5, sm: 2 } }}>
          <FormControl size="small" sx={{ minWidth: { xs: 100, sm: 120, md: 140 } }}>
            <Select
              value={data.empresaTipo}
              onChange={(e) => setData(prev => ({ ...prev, empresaTipo: e.target.value }))}
              sx={{
                color: '#fff',
                fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                '& .MuiSelect-icon': { color: 'rgba(255, 255, 255, 0.7)' },
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              {INTERFACE_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value} sx={{ color: '#000', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } }}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" sx={{ color: '#fff', opacity: 0.8, fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem' } }}>-ethernet-1/1/</Typography>
          <TextField
            size="small"
            placeholder={`Número ${peLabel}`}
            value={data.numeroInterface}
            onChange={(e) => setData(prev => ({ ...prev, numeroInterface: e.target.value }))}
            sx={{ 
              maxWidth: { xs: 80, sm: 90, md: 100 },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#fff' },
                '& input': { color: '#fff', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
                '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
                '&.Mui-focused label': { color: '#fff' }
              }
            }}
            required
          />
        </Box>

        {/* Dot1Q (ocultar em access e access-raw) */}
        {data.modo !== 'access' && data.modo !== 'access-raw' && (
          <TextField
            fullWidth
            label={`Dot1q ${peLabel}`}
            value={data.dot1q}
            onChange={(e) => setData(prev => ({ ...prev, dot1q: e.target.value }))}
            size="small"
            sx={{ 
              mb: { xs: 1.5, sm: 2 },
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#fff' },
                '& input': { color: '#fff', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' } },
                '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
                '&.Mui-focused label': { color: '#fff' }
              }
            }}
          />
        )}

        {/* Neighbor Targeted IP */}
        <TextField
          fullWidth
          label={`Neighbor Targeted IP do ${peLabel}`}
          value={data.neighborTargetedIp}
          onChange={(e) => setData(prev => ({ ...prev, neighborTargetedIp: e.target.value }))}
          InputProps={{ readOnly: true }}
          size="small"
          sx={{ 
            mb: { xs: 2, sm: 2.5, md: 3 },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
              '& input': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' } },
              '& label': { color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } },
              bgcolor: 'rgba(255, 255, 255, 0.05)'
            }
          }}
          required
        />

          {/* Botão Confirmar */}
          <Button
            fullWidth
            variant="contained"
            onClick={() => handleConfirmPE(pe)}
            disabled={isConfirmed}
            sx={{
              backgroundColor: isConfirmed ? '#4caf50' : 'rgba(255, 255, 255, 0.2)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              '&:hover': {
                backgroundColor: isConfirmed ? '#4caf50' : 'rgba(255, 255, 255, 0.3)',
                borderColor: '#fff'
              },
              '&:disabled': {
                backgroundColor: '#4caf50',
                color: '#fff'
              },
              transition: 'all 0.3s ease',
              py: { xs: 1, sm: 1.25, md: 1.5 },
              px: { xs: 1.5, sm: 2, md: 2.5 },
              fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' },
              fontWeight: 'bold',
              minHeight: { xs: 40, sm: 44, md: 48 }
            }}
          >
            {isConfirmed ? `${peLabel} Confirmado ✓` : `Confirmar ${peLabel}`}
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <>
      {/* Drawer Esquerdo - PE1 */}
      <Drawer
        anchor="left"
        open={leftDrawerOpen}
        onClose={handleBackClick}
        variant="persistent"
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 380, md: 400, lg: 420 },
            maxWidth: '90vw',
            mt: '64px',
            borderRadius: '0 12px 12px 0',
            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
            color: '#fff',
            zIndex: 1300,
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '4px 0 20px rgba(25, 118, 210, 0.4)',
            overflow: 'hidden',
          },
        }}
      >
        {renderPEPanel('pe1', pe1Data, setPe1Data)}
      </Drawer>

      {/* Drawer Direito - PE2 */}
      <Drawer
        anchor="right"
        open={rightDrawerOpen}
        onClose={handleBackClick}
        variant="persistent"
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 380, md: 400, lg: 420 },
            maxWidth: '90vw',
            mt: '64px',
            borderRadius: '12px 0 0 12px',
            background: 'linear-gradient(135deg, #6a1b9a 0%, #8e24aa 100%)',
            color: '#fff',
            zIndex: 1300,
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '-4px 0 20px rgba(106, 27, 154, 0.4)',
            overflow: 'hidden',
          },
        }}
      >
        {renderPEPanel('pe2', pe2Data, setPe2Data)}
      </Drawer>

      {/* Diálogo de Credenciais */}
      <Dialog
        open={credentialsDialogOpen}
        onClose={() => setCredentialsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            color: '#fff',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          color: '#fff',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          🔐 Credenciais de Login
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="Login"
            value={credentials.login}
            onChange={(e) => setCredentials(prev => ({ ...prev, login: e.target.value }))}
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#2196F3' },
                '& input': { color: '#fff' },
                '& label': { color: 'rgba(255, 255, 255, 0.7)' },
                '&.Mui-focused label': { color: '#2196F3' }
              }
            }}
            required
          />
          <TextField
            fullWidth
            type="password"
            label="Senha"
            value={credentials.senha}
            onChange={(e) => setCredentials(prev => ({ ...prev, senha: e.target.value }))}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#2196F3' },
                '& input': { color: '#fff' },
                '& label': { color: 'rgba(255, 255, 255, 0.7)' },
                '&.Mui-focused label': { color: '#2196F3' }
              }
            }}
            required
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setCredentialsDialogOpen(false)}
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              '&:hover': {
                borderColor: '#fff',
                color: '#fff'
              }
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleFinalSubmit}
            variant="contained"
            disabled={!credentials.login || !credentials.senha}
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              color: '#fff',
              '&:hover': { 
                background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)'
              },
              '&:disabled': {
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.3)'
              }
            }}
          >
            🚀 Configurar L2VPN
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backdrop de Loading */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: 2000,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(5px)'
        }}
        open={loading}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: '#2196F3' }} />
          <Typography variant="h6" sx={{ mt: 2, color: '#fff' }}>
            🔧 Configurando L2VPN VPWS...
          </Typography>
        </Box>
      </Backdrop>

      {/* Snackbar de Notificações */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ 
            width: '100%',
            '& .MuiAlert-icon': { color: '#fff' }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default L2VPNConfiguration;
