import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  ButtonGroup,
  Card,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  Fade,
  Paper,
  Stack,
  Avatar,
} from '@mui/material';
import {
  Menu as MenuIcon,
  FolderOpen as LoadIcon,
  Link as LinkIcon,
  Router as RouterIcon,
  Computer as HostIcon,
  Storage as ServerIcon,
  Business as BuildingIcon,
  ToggleOn as SwitchIcon,
  Wifi as AntennaIcon,
  NetworkCheck as POPIcon,
  ArrowBack,
  Apps,
  Settings as SettingsIcon,
  NetworkCheck,
} from '@mui/icons-material';

import type {
  MapConfiguration,
  MapItem,
  MapConnection,
  MapItemType,
} from '../../types/mapTypes';
import { useMapManager } from '../../hooks/useMapManager';
import type {
  EditMode,
  GeoLocation,
  ZabbixHost,
} from '../../types/mapTypes';
import { zabbixService } from '../../services/zabbixService';
import { networkAutomationService, type NetworkDevice, type SSHExecutionResult } from '../../services/networkAutomationService';
import DebugPanel from '../debug/debug-panel';
import ZabbixConfigDialog from '../monitoring/zabbix-config-dialog';
import { HostMonitoringPanel } from '../monitoring/host-monitoring-panel';
import MapLoaderDebug from './map-loader-debug';
import L2VPNConfiguration from '../networking/l2vpn-configuration';

// Fix icon imports
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Item type icons mapping
const ITEM_TYPE_ICONS = {
  pop: POPIcon,
  host: HostIcon,
  antenna: AntennaIcon,
  switch: SwitchIcon,
  router: RouterIcon,
  server: ServerIcon,
  building: BuildingIcon,
};

// Item type colors
const ITEM_TYPE_COLORS = {
  pop: '#e3f2fd',
  host: '#f3e5f5',
  antenna: '#e8f5e8',
  switch: '#fff3e0',
  router: '#fce4ec',
  server: '#f1f8e9',
  building: '#e0f2f1',
};

// Create custom icons for map items with alert indicators
const createCustomIcon = (type: MapItemType, status?: string, hasAlerts?: boolean) => {
  const color = status === 'online' ? '#4caf50' : status === 'offline' ? '#f44336' : '#ff9800';
  const alertIndicator = hasAlerts ? `
    <div style="
      position: absolute;
      top: -5px;
      right: -5px;
      width: 12px;
      height: 12px;
      background-color: #ff1744;
      border-radius: 50%;
      border: 2px solid white;
      animation: pulse 1.5s ease-in-out infinite alternate;
    "></div>
  ` : '';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="position: relative;">
        <div style="
          background-color: ${color};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: white;
        ">
          ${type.charAt(0).toUpperCase()}
        </div>
        ${alertIndicator}
      </div>
      <style>
        @keyframes pulse {
          from { transform: scale(0.8); opacity: 1; }
          to { transform: scale(1.2); opacity: 0.7; }
        }
      </style>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  }) as L.Icon;
};

// Connection styles
const CONNECTION_STYLES = {
  fiber: { color: '#2196F3', width: 3, opacity: 0.8 },
  wireless: { color: '#4CAF50', width: 2, dashArray: '5, 5', opacity: 0.7 },
  ethernet: { color: '#FF9800', width: 2, opacity: 0.8 },
  logical: { color: '#9C27B0', width: 1, dashArray: '10, 5', opacity: 0.6 },
};

// Protocolos disponíveis para configuração - Baseado no l2vpn-master
const AVAILABLE_PROTOCOLS = [
  {
    id: 'l2vpn-vpws',
    name: 'L2VPN VPWS',
    description: 'Virtual Private Wire Service - Point-to-Point',
    icon: '🔗',
    color: '#2196F3',
    category: 'L2VPN',
    modes: ['qinq', 'access', 'vlan-selective'],
    fields: [
      { name: 'vpws_group_name', label: 'VPWS Group Name', type: 'text', required: true },
      { name: 'vpn_id', label: 'VPN ID', type: 'text', required: true },
      { name: 'neighbor_ip', label: 'Neighbor IP', type: 'text', required: true },
      { name: 'pw_id', label: 'PW ID', type: 'text', required: true },
      { name: 'access_interface', label: 'Interface', type: 'select', required: true, 
        options: ['gigabit-ethernet', 'forty-gigabit-ethernet', 'ten-gigabit-ethernet', 'twenty-five-gigabit-ethernet', 'hundred-gigabit-ethernet', 'lag'] },
      { name: 'interface_number', label: 'Port Number', type: 'text', required: true },
      { name: 'dot1q', label: 'Dot1q VLAN', type: 'text' },
      { name: 'pw_vlan', label: 'PW-Type VLAN', type: 'text' },
      { name: 'neighbor_targeted_ip', label: 'Neighbor Targeted IP', type: 'text', required: true }
    ]
  },
  {
    id: 'l2vpn-vpls',
    name: 'L2VPN VPLS',
    description: 'Virtual Private LAN Service - Multipoint',
    icon: '🌐',
    color: '#00BCD4',
    category: 'L2VPN',
    fields: [
      { name: 'bridge_domain_id', label: 'Bridge Domain ID', type: 'text', required: true },
      { name: 'interface_name', label: 'Interface Name', type: 'text', required: true },
      { name: 'vlan_id', label: 'VLAN ID', type: 'text', required: true },
      { name: 'route_distinguisher', label: 'Route Distinguisher', type: 'text', required: true },
      { name: 'route_target', label: 'Route Target', type: 'text', required: true }
    ]
  },
  {
    id: 'bgp',
    name: 'BGP',
    description: 'Border Gateway Protocol - Advanced Routing',
    icon: '🛣️',
    color: '#4CAF50',
    category: 'Routing',
    fields: [
      { name: 'vlan', label: 'VLAN', type: 'text', required: true },
      { name: 'client_name', label: 'Cliente', type: 'text', required: true },
      { name: 'subnet_v4', label: 'Subnet IPv4', type: 'text', required: true, placeholder: '10.10.10.0/30' },
      { name: 'subnet_v6', label: 'Subnet IPv6', type: 'text', required: true, placeholder: '2001:db8::/126' },
      { name: 'asn_client', label: 'ASN do Cliente', type: 'text', required: true, placeholder: '64512' },
      { name: 'client_network_v4', label: 'Rede IPv4 Cliente', type: 'text', required: true, placeholder: '170.80.80.0/22' },
      { name: 'client_network_v6', label: 'Rede IPv6 Cliente', type: 'text', required: true, placeholder: '2804:3768::/32' },
      { name: 'size_v4', label: 'Tamanho IPv4', type: 'text', required: true, placeholder: '24' },
      { name: 'size_v6', label: 'Tamanho IPv6', type: 'text', required: true, placeholder: '48' }
    ]
  },
  {
    id: 'ospf',
    name: 'OSPF',
    description: 'Open Shortest Path First - IGP Protocol',
    icon: '🗺️',
    color: '#FF9800',
    category: 'Routing',
    fields: [
      { name: 'process_id', label: 'Process ID', type: 'text', required: true, defaultValue: '1' },
      { name: 'router_id', label: 'Router ID', type: 'text', required: true },
      { name: 'area_id', label: 'Area ID', type: 'text', required: true, defaultValue: '0' },
      { name: 'interface', label: 'Interface', type: 'text', required: true },
      { name: 'cost', label: 'Interface Cost', type: 'number', required: true, min: '1', max: '65535' }
    ]
  }
];

// Removido MapClickHandler não utilizado (substituía useMapEvents)

interface MapManagerProps {
  onBack?: () => void;
}

export const MapManager: React.FC<MapManagerProps> = ({ onBack }) => {
  const {
    currentMap,
    editMode,
    loading,
    error,
    addItem,
    updateItem,
    removeItem,
    addConnection,
    removeConnection,
    setEditMode,
    saveMap,
    loadMap,
    loadSavedMaps,
    createNewMap,
    selectItem,
    clearError,
  } = useMapManager();

  // Estados locais
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showMapLoaderDebug, setShowMapLoaderDebug] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<string[]>([]);
  const [zabbixHosts, setZabbixHosts] = useState<ZabbixHost[]>([]);
  const [showConnections, setShowConnections] = useState(true);
  const [showZabbixDialog, setShowZabbixDialog] = useState(false);
  const [showMonitoringPanel, setShowMonitoringPanel] = useState(false);
  const [selectedHostForMonitoring, setSelectedHostForMonitoring] = useState<MapItem | null>(null);
  const [hostAlerts, setHostAlerts] = useState<Record<string, boolean>>({});
  
  // Estados para automação de rede
  const [showAutomationLeftSidebar, setShowAutomationLeftSidebar] = useState(false);
  const [showAutomationRightSidebar, setShowAutomationRightSidebar] = useState(false);
  const [selectedRouterForAutomation, setSelectedRouterForAutomation] = useState<MapItem | null>(null);
  const [selectedAutomationOption, setSelectedAutomationOption] = useState<string | null>(null);
  
  // Novo: modos dos painéis laterais (menu/config) para L2VPN VPWS
  const [leftPanelMode, setLeftPanelMode] = useState<'menu' | 'l2vpn-vpws'>('menu');
  const [rightPanelMode, setRightPanelMode] = useState<'menu' | 'l2vpn-vpws'>('menu');
  const [leftConfirmed, setLeftConfirmed] = useState(false);
  const [rightConfirmed, setRightConfirmed] = useState(false);

  // Novo: dados separados por lado para L2VPN VPWS
  const [l2vpnLeftData, setL2vpnLeftData] = useState<Record<string, any>>({});
  const [l2vpnRightData, setL2vpnRightData] = useState<Record<string, any>>({});

  // Novo: diálogo central de credenciais
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ login: string; senha: string }>({ login: '', senha: '' });

  // Modos (QinQ/Access/Access-Raw) de cada lado
  const [pe1Mode, setPe1Mode] = useState<'qinq' | 'access' | 'vlan-selective' | ''>('');
  const [pe2Mode, setPe2Mode] = useState<'qinq' | 'access' | 'vlan-selective' | ''>('');

  // Estados para menus de configuração dupla
  const [selectedHosts, setSelectedHosts] = useState<MapItem[]>([]);
  const [leftMenuOpen, setLeftMenuOpen] = useState(false);
  const [rightMenuOpen, setRightMenuOpen] = useState(false);
  const [selectedLeftProtocol, setSelectedLeftProtocol] = useState<string | null>(null);
  const [selectedRightProtocol, setSelectedRightProtocol] = useState<string | null>(null);
  const [configurationMode, setConfigurationMode] = useState(false);
  const [showSSHDialog, setShowSSHDialog] = useState(false);
  const [sshExecutionResult, setSSHExecutionResult] = useState<SSHExecutionResult | null>(null);
  const [isExecutingSSH, setIsExecutingSSH] = useState(false);

  // Estados para configurações avançadas L2VPN/BGP/OSPF (sistema legado)
  const [showAdvancedConfigDialog, setShowAdvancedConfigDialog] = useState(false);
  const [protocolFormData, setProtocolFormData] = useState<Record<string, any>>({});
  const [selectedConfigProtocol, setSelectedConfigProtocol] = useState<string | null>(null);
  const [l2vpnMode, setL2vpnMode] = useState<string>(''); // 'qinq', 'access', 'vlan-selective'
  
  // Estados para formulários de rede integrados
  const [networkConfigLoading, setNetworkConfigLoading] = useState(false);
  const [networkFormData, setNetworkFormData] = useState<Record<string, any>>({});
  
  // Estados para navegação L2VPN PE1/PE2
  const [currentL2VPNStep, setCurrentL2VPNStep] = useState<'pe1' | 'pe2' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [availableCities, setAvailableCities] = useState<any[]>([]);
  const [availableInterfaces, setAvailableInterfaces] = useState<any[]>([]);
  const [availableMaps, setAvailableMaps] = useState<MapConfiguration[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const mapRef = useRef<L.Map | null>(null);
  
  // Estados para tooltip de conexões
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);

  // Initialize and load available maps
  useEffect(() => {
    const initializeMap = async () => {
      try {
        console.log('🔄 Inicializando MapManager...');
        
        // Carregar todos os mapas disponíveis primeiro
        const savedMaps = await loadSavedMaps();
        console.log(`📊 Mapas carregados: ${savedMaps.length}`);
        setAvailableMaps(savedMaps);
        
        if (savedMaps.length > 0) {
          // Se não há mapa selecionado, selecionar o primeiro
          if (!currentMap) {
            const firstMapId = savedMaps[0].id;
            console.log(`🗺️ Carregando mapa inicial: ${savedMaps[0].name} (${firstMapId})`);
            setSelectedMapId(firstMapId);
            const success = await loadMap(firstMapId);
            if (!success) {
              console.error('❌ Erro ao carregar mapa inicial');
            } else {
              console.log(`✅ Mapa carregado: ${savedMaps[0].name} com ${savedMaps[0].items.length} itens`);
            }
          }
        } else {
          // Não há mapas salvos, criar novo
          console.log('📝 Nenhum mapa encontrado, criando mapa inicial...');
          createNewMap('Mapa Principal', 'Mapa principal de topologia');
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar mapas:', error);
        createNewMap('Mapa Principal', 'Mapa principal de topologia');
      }
    };
    
    initializeMap();
  }, []); // Remover dependências para executar apenas uma vez

  // Atualizar selectedMapId quando currentMap mudar
  useEffect(() => {
    if (currentMap && currentMap.id !== selectedMapId) {
      setSelectedMapId(currentMap.id);
    }
  }, [currentMap]);

  // Auto-save dos elementos periodicamente
  useEffect(() => {
    if (currentMap && currentMap.items.length > 0) {
      const autoSaveInterval = setInterval(() => {
        saveMap(currentMap);
        console.log('Auto-save realizado:', currentMap.items.length, 'elementos');
      }, 10000); // Auto-save a cada 10 segundos

      return () => clearInterval(autoSaveInterval);
    }
  }, [currentMap, saveMap]);

  // Load saved configurations on mount
  useEffect(() => {
    const configs = Object.keys(localStorage).filter(key => 
      key.startsWith('corewise-map-config-')
    ).map(key => key.replace('corewise-map-config-', ''));
    setSavedConfigs(configs);
  }, []);

  const handleMapChange = async (mapId: string) => {
    if (mapId !== selectedMapId) {
      console.log(`🔄 Trocando para mapa: ${mapId}`);
      setSelectedMapId(mapId);
      const success = await loadMap(mapId);
      if (!success) {
        console.error(`❌ Erro ao carregar mapa: ${mapId}`);
      } else {
        const selectedMap = availableMaps.find(m => m.id === mapId);
        console.log(`✅ Mapa carregado: ${selectedMap?.name} com ${selectedMap?.items.length || 0} itens`);
      }
    }
  };

  // Load Zabbix hosts when component mounts
  useEffect(() => {
    const loadZabbixHosts = async () => {
      try {
        const hosts = await zabbixService.getHosts();
        setZabbixHosts(hosts.map(host => ({
          hostName: host.name,
          ipAddress: host.interfaces?.[0]?.ip || '',
          monitoringEnabled: true,
          status: host.status === 0 ? 'online' : 'offline'
        })));
      } catch (error) {
        console.error('Erro ao carregar hosts do Zabbix:', error);
      }
    };

    loadZabbixHosts();
  }, []);







  const getItemIcon = (item: MapItem) => {
    const hasAlerts = item.zabbixHost?.zabbixHostId ? hostAlerts[item.zabbixHost.zabbixHostId] : false;
    return createCustomIcon(item.type, item.zabbixHost?.status, hasAlerts);
  };

  const getConnectionPoints = (connection: MapConnection) => {
    const fromItem = currentMap?.items.find(item => item.id === connection.sourceId);
    const toItem = currentMap?.items.find(item => item.id === connection.targetId);
    
    if (!fromItem || !toItem) return null;
    
    // Log para debug
    console.log(`🔍 getConnectionPoints para conexão ${connection.id}:`, {
      hasPath: Boolean(connection.path),
      pathLength: connection.path?.length,
      isCalculated: connection.isCalculated,
      path: connection.path
    });
    
    // Se a conexão tem um path definido, usar ele
    if (connection.path && connection.path.length > 0) {
      console.log(`✅ Usando path calculado para ${connection.id}:`, connection.path);
      return connection.path as [number, number][];
    }
    
    // Fallback para linha direta entre os pontos
    const straightLine = [
      [fromItem.geoLocation.latitude, fromItem.geoLocation.longitude],
      [toItem.geoLocation.latitude, toItem.geoLocation.longitude],
    ] as [number, number][];
    
    console.log(`📏 Usando linha direta para ${connection.id}:`, straightLine);
    return straightLine;
  };

  // Funções para gerenciar seleção de hosts e configuração
  const handleHostClick = (item: MapItem) => {
    if (!['router', 'switch', 'server'].includes(item.type)) return;
    
    setSelectedHosts(prev => {
      const isAlreadySelected = prev.find(host => host.id === item.id);
      
      if (isAlreadySelected) {
        // Remove host se já estava selecionado
        const newSelection = prev.filter(host => host.id !== item.id);
        
        // Ajustar menus baseado na nova seleção
        if (newSelection.length === 0) {
          setLeftMenuOpen(false);
          setRightMenuOpen(false);
          setConfigurationMode(false);
        } else if (newSelection.length === 1) {
          // Se sobrou apenas 1 host, verificar qual era o removido
          const remainingHost = newSelection[0];
          const wasFirstHost = prev[0].id === item.id;
          
          if (wasFirstHost) {
            // Removeu o primeiro host, o segundo vira o primeiro
            // Fechar apenas o menu A, manter menu B aberto
            setLeftMenuOpen(false);
          } else {
            // Removeu o segundo host, manter apenas menu A
            setRightMenuOpen(false);
          }
        }
        
        return newSelection;
      } else {
        // Adicionar novo host (máximo 2)
        if (prev.length >= 2) {
          // Substitui o primeiro host, mantém ambos os menus abertos
          const newSelection = [prev[1], item];
          return newSelection;
        } else {
          const newSelection = [...prev, item];
          
          // Abrir menus progressivamente, mas MANTER os já abertos
          if (newSelection.length === 1) {
            setLeftMenuOpen(true);
            setConfigurationMode(true);
          } else if (newSelection.length === 2) {
            // Abrir menu B SEM fechar menu A
            setRightMenuOpen(true);
            // Menu A continua aberto
          }
          
          return newSelection;
        }
      }
    });
  };

  const selectLeftProtocol = (protocolId: string) => {
    setSelectedLeftProtocol(protocolId);
  };

  const selectRightProtocol = (protocolId: string) => {
    setSelectedRightProtocol(protocolId);
  };

  const resetConfiguration = () => {
    setSelectedHosts([]);
    setLeftMenuOpen(false);
    setRightMenuOpen(false);
    setSelectedLeftProtocol(null);
    setSelectedRightProtocol(null);
    setConfigurationMode(false);
    setLeftPanelMode('menu');
    setRightPanelMode('menu');
    setLeftConfirmed(false);
    setRightConfirmed(false);
    setL2vpnLeftData({});
    setL2vpnRightData({});
  };


  // Função para abrir configuração avançada baseada no protocolo
  const openAdvancedConfig = (protocolId: string, hostIndex?: number) => {
    setSelectedConfigProtocol(protocolId);
    setShowAdvancedConfigDialog(true);
    
    // Pre-popular dados baseado no host selecionado
    const host = hostIndex !== undefined ? selectedHosts[hostIndex] : selectedRouterForAutomation;
    if (host) {
      const baseData = {
        router_ip: host.zabbixHost?.ipAddress || '',
        router_name: host.name,
        login: 'admin', // TODO: pegar das configurações
        password: 'admin', // TODO: pegar das configurações seguras
      };
      
      // Adicionar dados específicos do protocolo
      if (protocolId === 'l2vpn-vpws') {
        setProtocolFormData({
          ...baseData,
          vpws_group_name_pe1: '',
          vpws_group_name_pe2: '',
          vpn_id_pe1: '',
          vpn_id_pe2: '',
          pw_id_pe1: '',
          pw_id_pe2: '',
          cidade_pe1: '',
          cidade_pe2: '',
        });
      } else if (protocolId === 'bgp') {
        setProtocolFormData({
          ...baseData,
          ip_roteador: host.zabbixHost?.ipAddress || '',
          vlan: '',
          cliente: '',
          subnet_v4: '',
          subnet_v6: '',
          asn_cliente: '',
          rede_v4_cliente: '',
          rede_v6_cliente: '',
          tamanho_v4: '24',
          tamanho_v6: '48',
        });
      } else if (protocolId === 'ospf') {
        setProtocolFormData({
          ...baseData,
          process_id: '1',
          router_id: host.zabbixHost?.ipAddress || '',
          area_id: '0',
          interface: '',
          cost: '100',
        });
      }
    }
  };

  // Abrir configuração L2VPN VPWS no lado esquerdo (PE1)
  const openLeftL2VPNConfig = () => {
    if (selectedHosts.length < 2) {
      alert('Selecione dois equipamentos (PE1 e PE2) para configurar L2VPN VPWS');
      return;
    }
    setLeftPanelMode('l2vpn-vpws');
    setCurrentL2VPNStep('pe1');
    setSelectedAutomationOption('l2vpn-vpws');
    setIsTransitioning(true);
    // Pré-popular dados do PE1
    setL2vpnLeftData({
      cidade_pe1: selectedHosts[0]?.name || '',
      vpws_group_name_pe1: '',
      vpn_id_pe1: '',
      neighbor_ip_pe1: selectedHosts[1]?.zabbixHost?.ipAddress || '',
      pw_id_pe1: '',
      neighbor_targeted_ip_pe1: selectedHosts[1]?.zabbixHost?.ipAddress || '',
      pe1_mode: 'qinq',
      empresa_pe1: '',
      numero_pe1: '',
      dot1q_pe1: '',
      pw_vlan_pe1: '',
    });
    setPe1Mode('qinq');
    // Manter dados comuns no estado principal
    setNetworkFormData(prev => ({
      ...prev,
      vpws_service_name: prev.vpws_service_name || '',
      customer_name: prev.customer_name || '',
    }));
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Abrir configuração L2VPN VPWS no lado direito (PE2)
  const openRightL2VPNConfig = () => {
    if (selectedHosts.length < 2) {
      alert('Selecione dois equipamentos (PE1 e PE2) para configurar L2VPN VPWS');
      return;
    }
    setRightPanelMode('l2vpn-vpws');
    setCurrentL2VPNStep('pe2');
    setSelectedAutomationOption('l2vpn-vpws');
    setIsTransitioning(true);
    // Pré-popular dados do PE2
    setL2vpnRightData({
      cidade_pe2: selectedHosts[1]?.name || '',
      vpws_group_name_pe2: '',
      vpn_id_pe2: '',
      neighbor_ip_pe2: selectedHosts[0]?.zabbixHost?.ipAddress || '',
      pw_id_pe2: '',
      neighbor_targeted_ip_pe2: selectedHosts[0]?.zabbixHost?.ipAddress || '',
      pe2_mode: 'qinq',
      empresa_pe2: '',
      numero_pe2: '',
      dot1q_pe2: '',
      pw_vlan_pe2: '',
    });
    setPe2Mode('qinq');
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const confirmLeftConfig = () => {
    setLeftConfirmed(true);
    if (rightConfirmed) setCredentialsDialogOpen(true);
  };

  const confirmRightConfig = () => {
    setRightConfirmed(true);
    if (leftConfirmed) setCredentialsDialogOpen(true);
  };

  // Enviar configuração combinada após credenciais
  const submitL2VPNVPWS = async () => {
    const payload = {
      vpws_service_name: networkFormData.vpws_service_name || '',
      customer_name: networkFormData.customer_name || '',
      ...l2vpnLeftData,
      ...l2vpnRightData,
      login: credentials.login,
      senha: credentials.senha,
    };

    setNetworkConfigLoading(true);
    try {
      const response = await fetch('/api/networking/configure_l2vpn/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.success) {
        alert('Configuração L2VPN VPWS iniciada com sucesso!');
        // Reset fluxo
        setCredentialsDialogOpen(false);
        setCredentials({ login: '', senha: '' });
        setLeftConfirmed(false);
        setRightConfirmed(false);
        setLeftPanelMode('menu');
        setRightPanelMode('menu');
        setL2vpnLeftData({});
        setL2vpnRightData({});
        setSelectedAutomationOption(null);
      } else {
        alert('Erro na configuração L2VPN VPWS: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('Erro de comunicação: ' + error);
    } finally {
      setNetworkConfigLoading(false);
    }
  };

  // Função para formatar dados de tráfego
  const formatTrafficData = (connection: MapConnection) => {
    const fromItem = currentMap?.items.find(item => item.id === connection.sourceId);
    const toItem = currentMap?.items.find(item => item.id === connection.targetId);
    
    if (!fromItem || !toItem) return null;

    const traffic = connection.properties.traffic;
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      name: `${fromItem.name} ↔ ${toItem.name}`,
      type: connection.type,
      bandwidth: connection.properties.bandwidth || 'N/A',
      distance: connection.properties.distance ? `${(connection.properties.distance / 1000).toFixed(1)} km` : 'N/A',
      latency: connection.properties.latency ? `${connection.properties.latency}ms` : 'N/A',
      utilization: connection.properties.utilization ? `${connection.properties.utilization.toFixed(1)}%` : 'N/A',
      traffic: traffic ? {
        inbound: formatBytes(traffic.inbound),
        outbound: formatBytes(traffic.outbound),
        latency: `${traffic.latency}ms`,
      } : null,
      pathPoints: connection.path ? connection.path.length : 2,
      isCalculated: connection.isCalculated || false,
    };
  };

  // Função para configurar protocolo diretamente na sidebar
  const openNetworkConfigDialog = (protocolId: string) => {
    console.log(`🔧 Configurando protocolo: ${protocolId}`);
    
    // Inicializar dados do formulário baseado no protocolo
    switch (protocolId) {
      case 'l2vpn-vpws':
        if (selectedHosts.length >= 2) {
          // Inicializar com dados completos mas mostrar apenas PE1 primeiro
          setNetworkFormData({
            // Dados básicos
            vpws_service_name: '',
            customer_name: '',
            // PE1 (Lado A)
            cidade_pe1: selectedHosts[0]?.name || '',
            vpws_group_name_pe1: '',
            vpn_id_pe1: '',
            neighbor_ip_pe1: selectedHosts[1]?.zabbixHost?.ipAddress || '',
            pw_id_pe1: '',
            neighbor_targeted_ip_pe1: '',
            pe1_mode: 'qinq',
            empresa_pe1: '',
            numero_pe1: '',
            dot1q_pe1: '',
            pw_vlan_pe1: '',
            // PE2 (Lado B) - dados iniciais
            cidade_pe2: selectedHosts[1]?.name || '',
            vpws_group_name_pe2: '',
            vpn_id_pe2: '',
            neighbor_ip_pe2: selectedHosts[0]?.zabbixHost?.ipAddress || '',
            pw_id_pe2: '',
            neighbor_targeted_ip_pe2: '',
            pe2_mode: 'qinq',
            empresa_pe2: '',
            numero_pe2: '',
            dot1q_pe2: '',
            pw_vlan_pe2: '',
            // Credenciais
            login: '',
            senha: '',
          });
          
          // Começar com PE1 (Lado A)
          setCurrentL2VPNStep('pe1');
          setSelectedAutomationOption('l2vpn-vpws');
          setIsTransitioning(true);
          
          // Animação: manter menus A e B abertos, e abrir configuração à direita
          // NÃO fechar os menus A e B - eles devem permanecer visíveis
          setTimeout(() => {
            setShowAutomationRightSidebar(true);
            setIsTransitioning(false);
          }, 300);
        } else {
          alert('Selecione pelo menos 2 equipamentos para configurar L2VPN VPWS');
        }
        break;
        
      case 'bgp':
        const hostForBGP = selectedRouterForAutomation || (selectedHosts.length > 0 ? selectedHosts[0] : null);
        if (hostForBGP) {
          setNetworkFormData({
            ip_roteador: hostForBGP.zabbixHost?.ipAddress || '',
            cliente: '',
            vlan: '',
            subnet_v4: '',
            rede_v4_cliente: '',
            tamanho_v4: '24',
            subnet_v6: '',
            rede_v6_cliente: '',
            tamanho_v6: '48',
            asn_cliente: '',
            login: '',
            senha: '',
          });
          setShowAutomationRightSidebar(true);
        } else {
          alert('Selecione um equipamento para configurar BGP');
        }
        break;
        
      case 'ospf':
        const hostsForOSPF = selectedHosts.length > 0 ? selectedHosts : [selectedRouterForAutomation].filter(Boolean);
        if (hostsForOSPF.length > 0) {
          setNetworkFormData({
            configs: hostsForOSPF.map((host, index) => ({
              id: host?.id || `router-${index}`,
              ip: host?.zabbixHost?.ipAddress || '',
              name: host?.name || `Router ${index + 1}`,
              process_id: '1',
              router_id: host?.zabbixHost?.ipAddress || '',
              area_id: '0',
              interface: 'loopback-0',
              cost: '100',
              enabled: true,
            })),
            login: '',
            senha: '',
          });
          setShowAutomationRightSidebar(true);
        } else {
          alert('Selecione pelo menos um equipamento para configurar OSPF');
        }
        break;
        
      default:
        console.log(`⚠️ Protocolo ${protocolId} ainda não implementado`);
        setShowAutomationRightSidebar(true);
        break;
    }
  };

  // Handlers para submit dos formulários integrados
  const handleNetworkConfigSubmit = async () => {
    const protocol = selectedAutomationOption;
    console.log(`🔧 Enviando configuração ${protocol?.toUpperCase()}:`, networkFormData);
    setNetworkConfigLoading(true);
    
    try {
      let endpoint = '';
      switch (protocol) {
        case 'l2vpn-vpws':
          endpoint = '/api/networking/configure_l2vpn/';
          break;
        case 'bgp':
          endpoint = '/api/networking/gerar_bgp/';
          break;
        case 'ospf':
          endpoint = '/api/networking/executar_config_ospf/';
          break;
        default:
          throw new Error(`Protocolo não suportado: ${protocol}`);
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(networkFormData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`Configuração ${protocol?.toUpperCase()} iniciada com sucesso!`);
        console.log(`✅ ${protocol?.toUpperCase()} configurado:`, result);
        
        // Limpar formulário e fechar sidebar após sucesso
        setNetworkFormData({});
        setShowAutomationRightSidebar(false);
        setSelectedAutomationOption(null);
      } else {
        alert(`Erro na configuração ${protocol?.toUpperCase()}: ` + (result.error || 'Erro desconhecido'));
        console.error(`❌ Erro ${protocol?.toUpperCase()}:`, result);
      }
    } catch (error) {
      alert('Erro de comunicação: ' + error);
      console.error(`❌ Erro de rede ${protocol?.toUpperCase()}:`, error);
    } finally {
      setNetworkConfigLoading(false);
    }
  };

  // Função para atualizar campos do formulário
  const updateNetworkFormField = (field: string, value: any) => {
    setNetworkFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Navegação entre PE1 e PE2 do L2VPN
  const navigateToL2VPNPE2 = () => {
    setIsTransitioning(true);
    setShowAutomationRightSidebar(false);
    setTimeout(() => {
      setCurrentL2VPNStep('pe2');
      setShowAutomationRightSidebar(true);
      setIsTransitioning(false);
    }, 300);
  };

  const navigateToL2VPNPE1 = () => {
    setIsTransitioning(true);
    setShowAutomationRightSidebar(false);
    setTimeout(() => {
      setCurrentL2VPNStep('pe1');
      setShowAutomationRightSidebar(true);
      setIsTransitioning(false);
    }, 300);
  };

  // Resetar estado L2VPN ao fechar
  const closeL2VPNConfig = () => {
    setCurrentL2VPNStep(null);
    setShowAutomationRightSidebar(false);
    setSelectedAutomationOption(null);
    setNetworkFormData({});
    
    // Fechar os menus L2VPN especificamente
    if (leftPanelMode === 'l2vpn-vpws') {
      setLeftMenuOpen(false);
      setLeftPanelMode('menu');
    }
    if (rightPanelMode === 'l2vpn-vpws') {
      setRightMenuOpen(false);
      setRightPanelMode('menu');
    }
  };

  const itemTypeLabels = {
    pop: 'POP',
    host: 'Host',
    antenna: 'Antena',
    switch: 'Switch',
    router: 'Roteador',
    server: 'Servidor',
    building: 'Prédio',
  };

  const executeAutomationConfig = async (protocol: string) => {
    if (!selectedRouterForAutomation) return;

    setIsExecutingSSH(true);
    setShowSSHDialog(true);
    setSSHExecutionResult(null);

    try {
      const device: NetworkDevice = {
        name: selectedRouterForAutomation.name,
        ipAddress: selectedRouterForAutomation.zabbixHost?.ipAddress || '192.168.1.1',
        deviceType: 'router',
        credentials: {
          username: 'admin', // TODO: Get from configuration
          password: 'admin', // TODO: Get from secure storage
        },
      };

      let result: SSHExecutionResult;

      switch (protocol) {
        case 'l2vpn-vpws':
          result = await networkAutomationService.configureL2VPNVPWS(device, {
            interfaceName: 'GigabitEthernet0/0/1',
            vlanId: 100,
            vcId: 1000,
            remoteEndpoint: '192.168.1.2',
            mtu: 1500,
          });
          break;
        
        case 'l2vpn-vpls':
          result = await networkAutomationService.configureL2VPNVPLS(device, {
            bridgeDomainId: 1000,
            interfaceName: 'GigabitEthernet0/0/1',
            vlanId: 100,
            routeDistinguisher: '65000:1000',
            routeTarget: '65000:1000',
          });
          break;
        
        case 'bgp':
          result = await networkAutomationService.configureBGP(device, {
            asNumber: 65000,
            routerId: device.ipAddress,
            neighbors: [
              { ip: '192.168.1.2', remoteAs: 65001, description: 'Neighbor Router' }
            ],
            networks: ['192.168.0.0/24'],
          });
          break;
        
        case 'ospf':
          result = await networkAutomationService.configureOSPF(device, {
            processId: 1,
            routerId: device.ipAddress,
            areas: [
              {
                areaId: '0',
                networks: ['192.168.0.0/24'],
                areaType: 'normal',
              }
            ],
          });
          break;
        
        default:
          throw new Error(`Protocol ${protocol} not supported`);
      }

      setSSHExecutionResult(result);
    } catch (error) {
      setSSHExecutionResult({
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        commands: [],
        executionTime: 0,
      });
    } finally {
      setIsExecutingSSH(false);
    }
  };


  // Handle Zabbix hosts integration
  const handleZabbixHostsConfigured = useCallback(async (hosts: any[]) => {
    try {
      console.log('Configurando hosts do Zabbix:', hosts.length);
      
      // Converter hosts do Zabbix para formato interno
      const zabbixHostsData = hosts.map(host => ({
        hostName: host.name || host.host,
        ipAddress: host.interfaces?.[0]?.ip || '',
        zabbixHostId: host.hostid,
        monitoringEnabled: true,
        status: (host.status === 0 && host.available === 1) ? 'online' as const : 
               (host.status === 0 && host.available === 2) ? 'offline' as const : 
               'unknown' as const,
      }));
      
      setZabbixHosts(zabbixHostsData);
      
      // Iniciar sincronização automática de status se habilitada
      const autoSync = localStorage.getItem('zabbix_auto_sync') === 'true';
      if (autoSync) {
        startStatusSync(hosts.map(h => h.hostid));
      }
      
    } catch (error) {
      console.error('Erro ao configurar hosts do Zabbix:', error);
    }
  }, []);

  // Auto sync status dos hosts e alertas
  const startStatusSync = useCallback((hostIds: string[]) => {
    const syncInterval = setInterval(async () => {
      if (!zabbixService.isAuthenticated()) {
        console.log('Zabbix não autenticado, pulando sincronização');
        return;
      }
      
      try {
        const [updatedHosts, alertsData] = await Promise.all([
          // Buscar status dos hosts
          Promise.all(
            hostIds.map(async (hostId) => {
              try {
                const status = await zabbixService.getHostStatus(hostId);
                return {
                  hostId,
                  available: status.available,
                  cpu: status.cpu,
                  memory: status.memory,
                  uptime: status.uptime,
                };
              } catch (error) {
                console.error(`Erro ao buscar status do host ${hostId}:`, error);
                return null;
              }
            })
          ),
          // Buscar alertas críticos (problemas ativos)
          checkHostAlerts(hostIds)
        ]);
        
        // Atualizar status dos itens no mapa que têm hosts Zabbix
        if (currentMap) {
          const updatedItems = currentMap.items.map(item => {
            if (item.zabbixHost?.zabbixHostId) {
              const hostStatus = updatedHosts.find(h => h?.hostId === item.zabbixHost?.zabbixHostId);
              if (hostStatus) {
                return {
                  ...item,
                  zabbixHost: {
                    ...item.zabbixHost,
                    status: hostStatus.available ? 'online' as const : 'offline' as const,
                  }
                };
              }
            }
            return item;
          });
          
          const updatedMap = {
            ...currentMap,
            items: updatedItems,
            updatedAt: new Date(),
          };
          
          // Salvar mapa atualizado
          saveMap(updatedMap);
        }
        
        // Atualizar alertas
        if (alertsData) {
          setHostAlerts(alertsData);
        }
        
        console.log('Status dos hosts sincronizado:', updatedHosts.filter(h => h !== null).length);
        console.log('Alertas atualizados:', Object.keys(alertsData || {}).length);
      } catch (error) {
        console.error('Erro na sincronização de status:', error);
      }
    }, 30000); // Sincronizar a cada 30 segundos
    
    // Limpar intervalo quando componente for desmontado ou lista de hosts mudar
    return () => clearInterval(syncInterval);
  }, [currentMap, saveMap]);

  // Verificar alertas de hosts
  const checkHostAlerts = useCallback(async (hostIds: string[]): Promise<Record<string, boolean>> => {
    try {
      const alerts: Record<string, boolean> = {};
      
      for (const hostId of hostIds) {
        try {
          // Buscar triggers ativos do host (apenas problemas)
          const triggers = await zabbixService.getHostTriggers(hostId, true);
          
          // Considerar que há alertas se existem triggers ativadas
          alerts[hostId] = triggers.length > 0;
        } catch (error) {
          console.error(`Erro ao verificar alertas do host ${hostId}:`, error);
          alerts[hostId] = false;
        }
      }
      
      return alerts;
    } catch (error) {
      console.error('Erro ao verificar alertas:', error);
      return {};
    }
  }, []);

  // Auto-descoberta de hosts do Zabbix
  const autoDiscoverZabbixHosts = useCallback(async () => {
    if (!zabbixService.isAuthenticated()) {
      alert('Configure o Zabbix primeiro');
      setShowZabbixDialog(true);
      return;
    }
    
    try {
      // Loading state is managed by hook
      const hosts = await zabbixService.getHosts();
      
      // Adicionar hosts automaticamente ao mapa baseado em sua localização ou grupo
      const newItems = hosts.map((host, index) => {
        const baseLocation = currentMap?.center || { latitude: -15.7942287, longitude: -47.8821945 };
        
        // Distribuir hosts em círculo ao redor do centro
        const angle = (index / hosts.length) * 2 * Math.PI;
        const radius = 0.1; // ~11km
        
        return {
          name: host.name || host.host,
          type: 'host' as const,
          description: `Host descoberto automaticamente: ${host.name}`,
          geoLocation: {
            latitude: baseLocation.latitude + Math.cos(angle) * radius,
            longitude: baseLocation.longitude + Math.sin(angle) * radius,
          },
          properties: {
            autoDiscovered: true,
            zabbixGroups: host.groups?.map(g => g.name).join(', ') || '',
          },
          visible: true,
          zabbixHost: {
            hostName: host.name || host.host,
            ipAddress: host.interfaces?.[0]?.ip || '',
            zabbixHostId: host.hostid,
            monitoringEnabled: true,
            status: (host.status === 0 && host.available === 1) ? 'online' as const : 
                   (host.status === 0 && host.available === 2) ? 'offline' as const : 
                   'unknown' as const,
          },
        };
      });
      
      // Adicionar todos os itens descobertos
      newItems.forEach(item => addItem(item));
      
      console.log(`${newItems.length} hosts descobertos e adicionados ao mapa`);
      
    } catch (error) {
      console.error('Erro na auto-descoberta:', error);
    } finally {
      // Loading state is managed by hook
    }
  }, [currentMap, addItem]);


  if (!currentMap) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#121212' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2, color: '#fff' }}>Carregando mapa...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', bgcolor: '#121212' }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: 1201, bgcolor: '#1e1e1e' }}>
        <Toolbar>
          {onBack && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={onBack}
              sx={{ mr: 1 }}
              title="Voltar ao Dashboard"
            >
              <ArrowBack />
            </IconButton>
          )}
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, color: '#fff' }}>
            CoreWise - Gerenciador de Mapas
            {currentMap && (
              <Chip 
                label={`${currentMap.items.length} elementos • ${currentMap.connections.length} conexões`}
                size="small"
                sx={{ ml: 2, bgcolor: '#333', color: '#fff' }}
              />
            )}
            {Object.values(hostAlerts).some(Boolean) && (
              <Chip 
                label={`${Object.values(hostAlerts).filter(Boolean).length} alertas`}
                size="small"
                color="error"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          
          {/* Seletor de Mapas */}
          <FormControl sx={{ minWidth: 200, mr: 2 }}>
            <InputLabel sx={{ color: '#fff' }}>Selecionar Mapa</InputLabel>
            <Select
              value={selectedMapId}
              onChange={(e) => handleMapChange(e.target.value)}
              label="Selecionar Mapa"
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                '& .MuiSvgIcon-root': { color: '#fff' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#777' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
              }}
            >
              {availableMaps.map((map) => (
                <MenuItem key={map.id} value={map.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: map.properties?.projectType === 'topology-manager' ? '#4caf50' : '#2196f3'
                    }} />
                    <Typography>{map.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                      ({map.items.length} itens)
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <ButtonGroup variant="contained" sx={{ mr: 2 }}>
            <Button
              onClick={() => setShowZabbixDialog(true)}
              startIcon={<SettingsIcon />}
              color="info"
            >
              Zabbix
            </Button>
            
            <Button
              onClick={autoDiscoverZabbixHosts}
              startIcon={<NetworkCheck />}
              color="warning"
              disabled={!zabbixService.isAuthenticated() || loading}
            >
              Descobrir
            </Button>
            
            <Button
              onClick={async () => {
                console.log('🔄 Recarregando mapas do backend...');
                const savedMaps = await loadSavedMaps();
                setAvailableMaps(savedMaps);
                console.log(`✅ ${savedMaps.length} mapas recarregados`);
              }}
              startIcon={<LoadIcon />}
              color="success"
              disabled={loading}
            >
              Recarregar
            </Button>
          </ButtonGroup>

          <ButtonGroup variant="contained" sx={{ mr: 2 }}>
            <Button
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              startIcon={<MenuIcon />}
              color="inherit"
            >
              Debug
            </Button>
            
            <Button
              onClick={() => setShowMapLoaderDebug(!showMapLoaderDebug)}
              startIcon={<Apps />}
              color="secondary"
            >
              Loader
            </Button>
          </ButtonGroup>

          {/* Indicadores de hosts selecionados */}
          {selectedHosts.length > 0 && (
            <ButtonGroup variant="contained" sx={{ mr: 2 }}>
              {selectedHosts.map((host, index) => (
                <Button
                  key={host.id}
                  startIcon={host.type === 'router' ? '🔀' : host.type === 'switch' ? '🔌' : '🖥️'}
                  color={index === 0 ? 'info' : 'warning'}
                  sx={{ 
                    backgroundColor: index === 0 ? '#1976d2' : '#ed6c02',
                    fontSize: '0.8rem'
                  }}
                  onClick={() => handleHostClick(host)}
                >
                  {index === 0 ? 'A' : 'B'}: {host.name}
                </Button>
              ))}
              
              {selectedHosts.length === 2 && (
                <Button
                  onClick={resetConfiguration}
                  color="error"
                  sx={{ backgroundColor: '#d32f2f' }}
                >
                  Reset
                </Button>
              )}
            </ButtonGroup>
          )}


        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 300,
            bgcolor: '#1e1e1e',
            color: '#fff',
            mt: '64px',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Configurações do Mapa
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={showConnections}
                onChange={(e) => setShowConnections(e.target.checked)}
              />
            }
            label="Mostrar Conexões"
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2, bgcolor: '#333' }} />

          <Typography variant="subtitle1" gutterBottom>
            Itens no Mapa ({currentMap.items.length})
          </Typography>
          
          <List>
            {currentMap.items.map((item) => {
              const Icon = ITEM_TYPE_ICONS[item.type as keyof typeof ITEM_TYPE_ICONS];
              return (
                <ListItem key={item.id} dense>
                  <ListItemIcon>
                    <Icon sx={{ color: '#fff' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {itemTypeLabels[item.type as keyof typeof itemTypeLabels]}
                        </Typography>
                        {item.zabbixHost?.ipAddress && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            IP: {item.zabbixHost.ipAddress}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
                          {item.zabbixHost?.status && (
                            <Chip
                              size="small"
                              label={item.zabbixHost.status}
                              color={
                                item.zabbixHost.status === 'online' ? 'success' :
                                item.zabbixHost.status === 'offline' ? 'error' : 'default'
                              }
                            />
                          )}
                          {item.zabbixHost?.zabbixHostId && hostAlerts[item.zabbixHost.zabbixHostId] && (
                            <Chip
                              size="small"
                              label="ALERTA"
                              color="error"
                              sx={{ 
                                animation: 'pulse 1.5s ease-in-out infinite alternate',
                                '@keyframes pulse': {
                                  from: { opacity: 1 },
                                  to: { opacity: 0.6 }
                                }
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>

          {currentMap.connections.length > 0 && (
            <>
              <Divider sx={{ my: 2, bgcolor: '#333' }} />
              <Typography variant="subtitle1" gutterBottom>
                Conexões ({currentMap.connections.length})
              </Typography>
              <List>
                {currentMap.connections.map((connection) => {
                  const fromItem = currentMap.items.find(i => i.id === connection.sourceId);
                  const toItem = currentMap.items.find(i => i.id === connection.targetId);
                  const trafficData = formatTrafficData(connection);
                  
                  return (
                    <ListItem key={connection.id} dense>
                      <ListItemIcon>
                        <LinkIcon sx={{ color: '#fff' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${fromItem?.name} ↔ ${toItem?.name}`}
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {connection.type.toUpperCase()}
                              {connection.properties.bandwidth && ` - ${connection.properties.bandwidth}`}
                            </Typography>
                            {connection.path && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                Path: {connection.path.length} pontos
                                {connection.isCalculated && ' (Calculado)'}
                              </Typography>
                            )}
                            {connection.properties.utilization !== undefined && (
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
                                <Chip
                                  size="small"
                                  label={`${connection.properties.utilization.toFixed(1)}% util.`}
                                  color={
                                    connection.properties.utilization > 80 ? 'error' :
                                    connection.properties.utilization > 60 ? 'warning' : 'success'
                                  }
                                />
                                {connection.properties.traffic && (
                                  <Chip
                                    size="small"
                                    label="TRÁFEGO"
                                    color="info"
                                  />
                                )}
                              </Box>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            </>
          )}
        </Box>
      </Drawer>

      {/* Menu Lateral Esquerdo (Menu A) */}
      <Drawer
        anchor="left"
        open={leftMenuOpen}
        variant="persistent"
        onClose={() => {
          // Só fechar se não houver hosts selecionados
          if (selectedHosts.length === 0) {
            setLeftMenuOpen(false);
            setConfigurationMode(false);
          }
        }}
        sx={{
          zIndex: 1300, // Maior que o Drawer principal (1200)
          '& .MuiDrawer-paper': {
            width: 280,
            bgcolor: '#1e1e1e',
            color: '#fff',
            mt: '64px',
            borderRadius: '0 12px 12px 0',
            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
            zIndex: 1300,
          },
        }}
      >
        <Box sx={{ p: 2, height: '100%', position: 'relative', overflow: 'hidden' }}>
          {/* Header do Menu A */}
          <Box sx={{ mb: 2, textAlign: 'center', position: 'relative' }}>
            {/* Botão voltar */}
            <IconButton
              onClick={() => {
                setLeftMenuOpen(false);
                if (selectedHosts.length === 0) {
                  setConfigurationMode(false);
                }
              }}
              sx={{
                position: 'absolute',
                top: -8,
                left: -8,
                color: '#fff',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                width: 24,
                height: 24,
              }}
              size="small"
              title="Voltar"
            >
              <ArrowBack fontSize="small" />
            </IconButton>
            
            {/* Botão fechar */}
            <IconButton
              onClick={() => {
                setLeftMenuOpen(false);
                if (selectedHosts.length === 0) {
                  setConfigurationMode(false);
                }
              }}
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                color: '#fff',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                width: 24,
                height: 24,
              }}
              size="small"
            >
              ✕
            </IconButton>
            
            <Avatar 
              sx={{ 
                bgcolor: '#fff', 
                color: '#1976d2', 
                mx: 'auto', 
                mb: 1,
                width: 40,
                height: 40,
                fontSize: '1.2rem'
              }}
            >
              A
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#fff' }}>
              Menu A
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, color: '#fff', fontSize: '0.75rem' }}>
              {selectedHosts[0]?.name || 'Nenhum selecionado'}
            </Typography>
          </Box>

          {/* Seleção de Protocolo para Host A */}
          <Box sx={{ height: 'calc(100% - 80px)' }}>
            {selectedHosts[0] ? (
              <>
                <Typography variant="body1" sx={{ mb: 2, color: '#fff', fontSize: '0.9rem' }}>
                  📡 Protocolo para {selectedHosts[0].name}
                </Typography>
                
                <Stack spacing={1.5}>
                  {AVAILABLE_PROTOCOLS.map((protocol) => (
                    <Paper
                      key={protocol.id}
                      onClick={() => {
                        selectLeftProtocol(protocol.id);
                        // L2VPN VPWS abre configuração no próprio lado esquerdo
                        if (protocol.id === 'l2vpn-vpws') {
                          setTimeout(() => openLeftL2VPNConfig(), 200);
                        } else {
                          setTimeout(() => openAdvancedConfig(protocol.id, 0), 300);
                        }
                      }}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        border: selectedLeftProtocol === protocol.id ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 1.5,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: protocol.color, color: '#fff', fontSize: '1rem', width: 32, height: 32 }}>
                          {protocol.icon}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 'bold' }}>
                            {protocol.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#fff', opacity: 0.8, display: 'block' }}>
                            {protocol.description}
                          </Typography>
                          <Chip
                            label={protocol.category}
                            size="small"
                            sx={{
                              mt: 0.5,
                              bgcolor: 'rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              height: 20,
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography variant="body2" sx={{ color: '#fff', opacity: 0.7 }}>
                  🖱️ Clique em um host no mapa
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* Menu Lateral Direito (Menu B) */}
      <Drawer
        anchor="right"
        open={rightMenuOpen}
        variant="persistent"
        onClose={() => {
          // Só fechar se houver menos de 2 hosts selecionados
          if (selectedHosts.length < 2) {
            setRightMenuOpen(false);
          }
        }}
        sx={{
          zIndex: 1300, // Maior que o Drawer principal (1200)
          '& .MuiDrawer-paper': {
            width: 280,
            bgcolor: '#1e1e1e',
            color: '#fff',
            mt: '64px',
            borderRadius: '12px 0 0 12px',
            background: 'linear-gradient(135deg, #ed6c02 0%, #ff9800 100%)',
            zIndex: 1300,
          },
        }}
      >
        <Box sx={{ p: 2, height: '100%', position: 'relative', overflow: 'hidden' }}>
          {/* Header do Menu B */}
          <Box sx={{ mb: 2, textAlign: 'center', position: 'relative' }}>
            {/* Botão voltar */}
            <IconButton
              onClick={() => {
                setRightMenuOpen(false);
              }}
              sx={{
                position: 'absolute',
                top: -8,
                left: -8,
                color: '#fff',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                width: 24,
                height: 24,
              }}
              size="small"
              title="Voltar"
            >
              <ArrowBack fontSize="small" />
            </IconButton>
            
            {/* Botão fechar */}
            <IconButton
              onClick={() => {
                setRightMenuOpen(false);
              }}
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                color: '#fff',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                width: 24,
                height: 24,
              }}
              size="small"
            >
              ✕
            </IconButton>
            
            <Avatar 
              sx={{ 
                bgcolor: '#fff', 
                color: '#ed6c02', 
                mx: 'auto', 
                mb: 1,
                width: 40,
                height: 40,
                fontSize: '1.2rem'
              }}
            >
              B
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#fff' }}>
              Menu B
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, color: '#fff', fontSize: '0.75rem' }}>
              {selectedHosts[1]?.name || 'Nenhum selecionado'}
            </Typography>
          </Box>

          {/* Seleção de Protocolo para Host B */}
          <Box sx={{ height: 'calc(100% - 80px)' }}>
            {selectedHosts[1] ? (
              <>
                <Typography variant="body1" sx={{ mb: 2, color: '#fff', fontSize: '0.9rem' }}>
                  📡 Protocolo para {selectedHosts[1].name}
                </Typography>
                
                <Stack spacing={1.5}>
                  {AVAILABLE_PROTOCOLS.map((protocol) => (
                    <Paper
                      key={protocol.id}
                      onClick={() => {
                        selectRightProtocol(protocol.id);
                        // L2VPN VPWS abre configuração no próprio lado direito
                        if (protocol.id === 'l2vpn-vpws') {
                          setTimeout(() => openRightL2VPNConfig(), 200);
                        } else {
                          setTimeout(() => openAdvancedConfig(protocol.id, 1), 300);
                        }
                      }}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        border: selectedRightProtocol === protocol.id ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 1.5,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: protocol.color, color: '#fff', fontSize: '1rem', width: 32, height: 32 }}>
                          {protocol.icon}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 'bold' }}>
                            {protocol.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#fff', opacity: 0.8, display: 'block' }}>
                            {protocol.description}
                          </Typography>
                          <Chip
                            label={protocol.category}
                            size="small"
                            sx={{
                              mt: 0.5,
                              bgcolor: 'rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              height: 20,
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography variant="body2" sx={{ color: '#fff', opacity: 0.7 }}>
                  {selectedHosts.length === 0 ? 
                    '🖱️ Clique em um host no mapa' :
                    '🖱️ Clique em um segundo host'
                  }
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* Conteúdo de Configuração substituindo Menu A (esquerda) quando L2VPN VPWS for selecionado */}
      <Drawer
        anchor="left"
        open={leftMenuOpen && leftPanelMode === 'l2vpn-vpws'}
        variant="persistent"
        sx={{
          zIndex: 1300,
          '& .MuiDrawer-paper': {
            width: 320,
            bgcolor: '#101820',
            color: '#fff',
            mt: '64px',
            borderRight: '1px solid #23b9f3',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ color: '#4fc3f7' }}>🔌 PE1 - Lado A</Typography>
            <Button size="small" color="inherit" onClick={() => setLeftPanelMode('menu')}>
              Voltar
            </Button>
          </Box>
          <Divider sx={{ my: 1, bgcolor: '#234' }} />
          <Fade in={!isTransitioning} timeout={300}>
            <Stack spacing={2}>
              {/* Modos PE1: QinQ / Access / Access-Raw */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant={pe1Mode === 'qinq' ? 'contained' : 'outlined'}
                  onClick={() => { setPe1Mode('qinq'); setL2vpnLeftData(prev => ({ ...prev, pe1_mode: 'qinq' })); }}
                >
                  Habilitar QinQ
                </Button>
                <Button
                  variant={pe1Mode === 'access' ? 'contained' : 'outlined'}
                  onClick={() => { setPe1Mode('access'); setL2vpnLeftData(prev => ({ ...prev, pe1_mode: 'access' })); }}
                >
                  Habilitar Access
                </Button>
                <Button
                  variant={pe1Mode === 'vlan-selective' ? 'contained' : 'outlined'}
                  onClick={() => { setPe1Mode('vlan-selective'); setL2vpnLeftData(prev => ({ ...prev, pe1_mode: 'vlan-selective' })); }}
                >
                  Habilitar Access-Raw
                </Button>
              </Box>
              <TextField
                fullWidth
                label="Nome do Serviço VPWS"
                value={networkFormData.vpws_service_name || ''}
                onChange={(e) => setNetworkFormData(prev => ({ ...prev, vpws_service_name: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />
              <TextField
                fullWidth
                label="Nome do Cliente"
                value={networkFormData.customer_name || ''}
                onChange={(e) => setNetworkFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <Typography variant="subtitle2" sx={{ color: '#4fc3f7', mt: 1 }}>Configuração PE1</Typography>

              <TextField
                fullWidth
                label="Cidade PE1"
                value={l2vpnLeftData.cidade_pe1 || ''}
                onChange={(e) => setL2vpnLeftData(prev => ({ ...prev, cidade_pe1: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <TextField
                fullWidth
                label="VPWS Group Name PE1"
                value={l2vpnLeftData.vpws_group_name_pe1 || ''}
                onChange={(e) => setL2vpnLeftData(prev => ({ ...prev, vpws_group_name_pe1: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                  label="VPN ID PE1"
                  value={l2vpnLeftData.vpn_id_pe1 || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setL2vpnLeftData(prev => ({ ...prev, vpn_id_pe1: v }));
                    setL2vpnRightData(prev => ({ ...prev, vpn_id_pe2: v }));
                  }}
                />
                <TextField
                  sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                  label="PW ID PE1"
                  value={l2vpnLeftData.pw_id_pe1 || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setL2vpnLeftData(prev => ({ ...prev, pw_id_pe1: v }));
                    setL2vpnRightData(prev => ({ ...prev, pw_id_pe2: v }));
                  }}
                />
              </Box>

              <TextField
                fullWidth
                label="Neighbor IP PE1"
                value={l2vpnLeftData.neighbor_ip_pe1 || ''}
                onChange={(e) => setL2vpnLeftData(prev => ({ ...prev, neighbor_ip_pe1: e.target.value }))}
                helperText="IP do PE2 (vizinho)"
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              {/* PW-Type VLAN */}
              <TextField
                fullWidth
                label="PW-Type VLAN PE1"
                value={l2vpnLeftData.pw_vlan_pe1 || ''}
                onChange={(e) => setL2vpnLeftData(prev => ({ ...prev, pw_vlan_pe1: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                  label="Número PE1"
                  value={l2vpnLeftData.numero_pe1 || ''}
                  onChange={(e) => setL2vpnLeftData(prev => ({ ...prev, numero_pe1: e.target.value }))}
                />
                {pe1Mode !== 'vlan-selective' && (
                  <TextField
                    sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    label="Dot1Q PE1"
                    value={l2vpnLeftData.dot1q_pe1 || ''}
                    onChange={(e) => setL2vpnLeftData(prev => ({ ...prev, dot1q_pe1: e.target.value }))}
                  />
                )}
              </Box>

              <TextField
                fullWidth
                label="Neighbor Targeted IP do PE1"
                value={l2vpnLeftData.neighbor_targeted_ip_pe1 || ''}
                onChange={(e) => setL2vpnLeftData(prev => ({ ...prev, neighbor_targeted_ip_pe1: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <Button
                variant="contained"
                sx={{ bgcolor: leftConfirmed ? '#2e7d32' : '#4caf50', '&:hover': { bgcolor: leftConfirmed ? '#1b5e20' : '#43a047' } }}
                onClick={confirmLeftConfig}
              >
                {leftConfirmed ? '✔️ PE1 Confirmado' : 'Confirmar PE1'}
              </Button>
            </Stack>
          </Fade>
        </Box>
      </Drawer>

      {/* Conteúdo de Configuração substituindo Menu B (direita) quando L2VPN VPWS for selecionado */}
      <Drawer
        anchor="right"
        open={rightMenuOpen && rightPanelMode === 'l2vpn-vpws'}
        variant="persistent"
        sx={{
          zIndex: 1300,
          '& .MuiDrawer-paper': {
            width: 320,
            bgcolor: '#101820',
            color: '#fff',
            mt: '64px',
            borderLeft: '1px solid #ff9800',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ color: '#ff9800' }}>🔌 PE2 - Lado B</Typography>
            <Button size="small" color="inherit" onClick={() => setRightPanelMode('menu')}>
              Voltar
            </Button>
          </Box>
          <Divider sx={{ my: 1, bgcolor: '#432' }} />
          <Fade in={!isTransitioning} timeout={300}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant={pe2Mode === 'qinq' ? 'contained' : 'outlined'}
                  onClick={() => { setPe2Mode('qinq'); setL2vpnRightData(prev => ({ ...prev, pe2_mode: 'qinq' })); }}
                >
                  Habilitar QinQ
                </Button>
                <Button
                  variant={pe2Mode === 'access' ? 'contained' : 'outlined'}
                  onClick={() => { setPe2Mode('access'); setL2vpnRightData(prev => ({ ...prev, pe2_mode: 'access' })); }}
                >
                  Habilitar Access
                </Button>
                <Button
                  variant={pe2Mode === 'vlan-selective' ? 'contained' : 'outlined'}
                  onClick={() => { setPe2Mode('vlan-selective'); setL2vpnRightData(prev => ({ ...prev, pe2_mode: 'vlan-selective' })); }}
                >
                  Habilitar Access-Raw
                </Button>
              </Box>
              <Typography variant="subtitle2" sx={{ color: '#ff9800' }}>Configuração PE2</Typography>

              <TextField
                fullWidth
                label="Cidade PE2"
                value={l2vpnRightData.cidade_pe2 || ''}
                onChange={(e) => setL2vpnRightData(prev => ({ ...prev, cidade_pe2: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <TextField
                fullWidth
                label="VPWS Group Name PE2"
                value={l2vpnRightData.vpws_group_name_pe2 || ''}
                onChange={(e) => setL2vpnRightData(prev => ({ ...prev, vpws_group_name_pe2: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                  label="VPN ID PE2"
                  value={l2vpnRightData.vpn_id_pe2 || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setL2vpnRightData(prev => ({ ...prev, vpn_id_pe2: v }));
                    setL2vpnLeftData(prev => ({ ...prev, vpn_id_pe1: v }));
                  }}
                />
                <TextField
                  sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                  label="PW ID PE2"
                  value={l2vpnRightData.pw_id_pe2 || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setL2vpnRightData(prev => ({ ...prev, pw_id_pe2: v }));
                    setL2vpnLeftData(prev => ({ ...prev, pw_id_pe1: v }));
                  }}
                />
              </Box>

              <TextField
                fullWidth
                label="Neighbor IP PE2"
                value={l2vpnRightData.neighbor_ip_pe2 || ''}
                onChange={(e) => setL2vpnRightData(prev => ({ ...prev, neighbor_ip_pe2: e.target.value }))}
                helperText="IP do PE1 (vizinho)"
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              {/* PW-Type VLAN */}
              <TextField
                fullWidth
                label="PW-Type VLAN PE2"
                value={l2vpnRightData.pw_vlan_pe2 || ''}
                onChange={(e) => setL2vpnRightData(prev => ({ ...prev, pw_vlan_pe2: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                  label="Número PE2"
                  value={l2vpnRightData.numero_pe2 || ''}
                  onChange={(e) => setL2vpnRightData(prev => ({ ...prev, numero_pe2: e.target.value }))}
                />
                {pe2Mode !== 'vlan-selective' && (
                  <TextField
                    sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    label="Dot1Q PE2"
                    value={l2vpnRightData.dot1q_pe2 || ''}
                    onChange={(e) => setL2vpnRightData(prev => ({ ...prev, dot1q_pe2: e.target.value }))}
                  />
                )}
              </Box>

              <TextField
                fullWidth
                label="Neighbor Targeted IP do PE2"
                value={l2vpnRightData.neighbor_targeted_ip_pe2 || ''}
                onChange={(e) => setL2vpnRightData(prev => ({ ...prev, neighbor_targeted_ip_pe2: e.target.value }))}
                sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
              />

              <Button
                variant="contained"
                sx={{ bgcolor: rightConfirmed ? '#2e7d32' : '#ff9800', '&:hover': { bgcolor: rightConfirmed ? '#1b5e20' : '#fb8c00' } }}
                onClick={confirmRightConfig}
              >
                {rightConfirmed ? '✔️ PE2 Confirmado' : 'Confirmar PE2'}
              </Button>
            </Stack>
          </Fade>
        </Box>
      </Drawer>

      {/* Main Map Container */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '64px',
          height: 'calc(100vh - 64px)',
          position: 'relative',
        }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert
            severity="error"
            onClose={clearError}
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
            }}
          >
            {error}
          </Alert>
        )}

        <MapContainer
          center={[currentMap.center.latitude, currentMap.center.longitude]}
          zoom={currentMap.zoom}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Render map items */}
          {currentMap.items.map((item) => (
            <Marker
              key={item.id}
              position={[item.geoLocation.latitude, item.geoLocation.longitude]}
              icon={getItemIcon(item)}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  
                  // Nova lógica: selecionar hosts para configuração
                  if (['router', 'switch', 'server'].includes(item.type)) {
                    handleHostClick(item);
                  } else if (item.zabbixHost) {
                    // Outros equipamentos com Zabbix - abrir painel de monitoramento
                    setSelectedHostForMonitoring(item);
                    setShowMonitoringPanel(true);
                  }
                },
              }}
            />
          ))}

          {/* Render connections */}
          {showConnections && currentMap.connections.map((connection) => {
            const points = getConnectionPoints(connection);
            if (!points) return null;

            const style = connection.style || CONNECTION_STYLES[connection.type];
            const trafficData = formatTrafficData(connection);
            
            // Ajustar cor baseada na utilização
            let connectionColor = style.color;
            if (connection.properties.utilization !== undefined) {
              if (connection.properties.utilization > 80) {
                connectionColor = '#f44336'; // Vermelho para alta utilização
              } else if (connection.properties.utilization > 60) {
                connectionColor = '#ff9800'; // Laranja para média utilização
              } else {
                connectionColor = '#4caf50'; // Verde para baixa utilização
              }
            }
            
            return (
              <Polyline
                key={connection.id}
                positions={points}
                color={connectionColor}
                weight={style.width}
                opacity={style.opacity}
                dashArray={(style as any).dashArray || undefined}
                eventHandlers={{
                  mouseover: () => setHoveredConnection(connection.id),
                  mouseout: () => setHoveredConnection(null),
                }}
              >
                {hoveredConnection === connection.id && trafficData && (
                  <LeafletTooltip permanent={false} sticky={true}>
                    <Box sx={{ 
                      p: 1, 
                      minWidth: 200,
                      bgcolor: 'rgba(0, 0, 0, 0.8)',
                      color: 'white',
                      borderRadius: 1,
                      fontSize: '12px'
                    }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        📡 {trafficData.name}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        🔗 Tipo: {trafficData.type.toUpperCase()}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        📊 Banda: {trafficData.bandwidth}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        📏 Distância: {trafficData.distance}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        ⏱️ Latência: {trafficData.latency}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        📈 Utilização: {trafficData.utilization}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        🗺️ Pontos no Path: {trafficData.pathPoints}
                        {trafficData.isCalculated && ' (Calculado)'}
                      </Typography>
                      
                      {trafficData.traffic && (
                        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            🚀 Tráfego em Tempo Real:
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 0.2 }}>
                            ⬇️ Entrada: {trafficData.traffic.inbound}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 0.2 }}>
                            ⬆️ Saída: {trafficData.traffic.outbound}
                          </Typography>
                          <Typography variant="body2">
                            ⏱️ Latência: {trafficData.traffic.latency}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </LeafletTooltip>
                )}
              </Polyline>
            );
          })}

          {/* Sobreposição para destacar hosts selecionados */}
          {configurationMode && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            />
          )}
        </MapContainer>

      </Box>




      {/* Debug Panel */}
      {showDebugPanel && (
        <DebugPanel onClose={() => setShowDebugPanel(false)} />
      )}

      {/* Map Loader Debug */}
      {showMapLoaderDebug && (
        <MapLoaderDebug 
          onLoadMap={async (map) => {
            console.log('🔄 Carregando mapa do debug:', map.name);
            // Fechar o debug panel
            setShowMapLoaderDebug(false);
            
            // Adicionar à lista de mapas disponíveis se não existir
            setAvailableMaps(prev => {
              const exists = prev.find(m => m.id === map.id);
              if (!exists) {
                return [...prev, map];
              }
              return prev;
            });
            
            // Carregar o mapa
            setSelectedMapId(map.id);
            const success = await loadMap(map.id);
            if (success) {
              console.log('✅ Mapa carregado com sucesso no MapManager');
            }
          }}
        />
      )}

      {/* Zabbix Configuration Dialog */}
      <ZabbixConfigDialog
        open={showZabbixDialog}
        onClose={() => setShowZabbixDialog(false)}
        onConfigured={handleZabbixHostsConfigured}
      />

      {/* Host Monitoring Panel */}
      <HostMonitoringPanel
        open={showMonitoringPanel}
        onClose={() => {
          setShowMonitoringPanel(false);
          setSelectedHostForMonitoring(null);
        }}
        selectedHost={selectedHostForMonitoring}
      />

      {/* Automation Left Sidebar - Equipment Selection */}
      <Drawer
        anchor="left"
        open={showAutomationLeftSidebar}
        onClose={() => {
          setShowAutomationLeftSidebar(false);
          setShowAutomationRightSidebar(false);
          setSelectedRouterForAutomation(null);
          setSelectedAutomationOption(null);
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: 350,
            bgcolor: '#1a1a1a',
            color: '#fff',
            mt: '64px',
            borderRight: '2px solid #333',
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ color: '#ff6b6b', fontWeight: 'bold' }}>
            Automação de Rede
          </Typography>
          
          {selectedRouterForAutomation && (
            <Card sx={{ bgcolor: '#333', mb: 3, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <RouterIcon sx={{ color: '#ff6b6b', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#fff' }}>
                    {selectedRouterForAutomation.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    {selectedRouterForAutomation.zabbixHost?.ipAddress || 'IP não configurado'}
                  </Typography>
                  {selectedRouterForAutomation.zabbixHost?.status && (
                    <Chip
                      size="small"
                      label={selectedRouterForAutomation.zabbixHost.status}
                      color={
                        selectedRouterForAutomation.zabbixHost.status === 'online' ? 'success' :
                        selectedRouterForAutomation.zabbixHost.status === 'offline' ? 'error' : 'default'
                      }
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              </Box>
            </Card>
          )}

          <Typography variant="h6" gutterBottom sx={{ color: '#4fc3f7', mb: 2 }}>
            Selecione o Protocolo/Serviço:
          </Typography>

          <List>
            {[
              { id: 'l2vpn-vpws', label: 'L2VPN VPWS', desc: 'Virtual Private Wire Service', icon: '🔗' },
              { id: 'l2vpn-vpls', label: 'L2VPN VPLS', desc: 'Virtual Private LAN Service', icon: '🌐' },
              { id: 'bgp', label: 'BGP', desc: 'Border Gateway Protocol', icon: '🛣️' },
              { id: 'ospf', label: 'OSPF', desc: 'Open Shortest Path First', icon: '🗺️' },
            ].map((option) => (
              <ListItem
                key={option.id}
                onClick={() => {
                  setSelectedAutomationOption(option.id);
                  openNetworkConfigDialog(option.id);
                }}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 2,
                  mb: 1,
                  bgcolor: selectedAutomationOption === option.id ? '#4fc3f7' : '#2a2a2a',
                  '&:hover': { bgcolor: selectedAutomationOption === option.id ? '#29b6f6' : '#3a3a3a' },
                  border: selectedAutomationOption === option.id ? '2px solid #fff' : '1px solid #444',
                  transition: 'all 0.3s ease',
                }}
              >
                <ListItemIcon>
                  <Typography sx={{ fontSize: '24px' }}>{option.icon}</Typography>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
                      {option.label}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" sx={{ color: '#bbb' }}>
                      {option.desc}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>

          <Box sx={{ mt: 3, p: 2, bgcolor: '#2d5016', borderRadius: 1, border: '1px solid #4caf50' }}>
            <Typography variant="body2" sx={{ color: '#a5d6a7', fontSize: '12px' }}>
              💡 Clique em um protocolo para abrir as opções de configuração no painel lateral direito.
            </Typography>
          </Box>
        </Box>
      </Drawer>

      {/* Automation Right Sidebar - Configuration Options */}
      <Drawer
        anchor="right"
        open={showAutomationRightSidebar}
        onClose={() => {
          if (selectedAutomationOption === 'l2vpn-vpws') {
            closeL2VPNConfig();
          } else {
            setShowAutomationRightSidebar(false);
            setSelectedAutomationOption(null);
          }
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
            bgcolor: '#1a1a1a',
            color: '#fff',
            mt: '64px',
            borderLeft: '2px solid #333',
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          
          {selectedAutomationOption && (
            <>
              <Typography variant="h5" gutterBottom sx={{ color: '#4fc3f7', fontWeight: 'bold' }}>
                Configuração {selectedAutomationOption.toUpperCase()}
              </Typography>
              
              {selectedRouterForAutomation && (
                <Box sx={{ mb: 3, p: 2, bgcolor: '#333', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>Equipamento Selecionado:</Typography>
                  <Typography variant="h6" sx={{ color: '#fff' }}>
                    {selectedRouterForAutomation.name}
                  </Typography>
                </Box>
              )}

              {/* L2VPN VPWS Configuration - PE1 (Lado A) */}
              {selectedAutomationOption === 'l2vpn-vpws' && currentL2VPNStep === 'pe1' && (
                <Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" gutterBottom sx={{ color: '#4fc3f7' }}>
                      🔌 PE1 - Lado A
                    </Typography>
                    <Chip 
                      label={`${selectedHosts[0]?.name || 'PE1'}`}
                      size="small" 
                      sx={{ bgcolor: '#4fc3f7', color: '#000' }}
                    />
                  </Box>
                  
                  {/* Indicador de Conexão */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#333', borderRadius: 1, border: '1px solid #4fc3f7' }}>
                    <Typography variant="body2" sx={{ color: '#4fc3f7', fontWeight: 'bold', mb: 1 }}>
                      🔗 Conexão L2VPN VPWS
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label={`PE1: ${selectedHosts[0]?.name}`} sx={{ bgcolor: '#4fc3f7', color: '#000' }} size="small" />
                      <Typography sx={{ color: '#fff' }}>↔</Typography>
                      <Chip label={`PE2: ${selectedHosts[1]?.name}`} sx={{ bgcolor: '#ff9800', color: '#000' }} size="small" />
                    </Box>
                  </Box>
                  
                  <Fade in={!isTransitioning} timeout={300}>
                    <Stack spacing={2}>
                      {/* Configuração Básica */}
                      <Typography variant="subtitle2" sx={{ color: '#aaa', mt: 1 }}>Informações Básicas</Typography>
                      
                      <TextField
                        fullWidth
                        label="Nome do Serviço VPWS"
                        value={networkFormData.vpws_service_name || ''}
                        onChange={(e) => updateNetworkFormField('vpws_service_name', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Nome do Cliente"
                        value={networkFormData.customer_name || ''}
                        onChange={(e) => updateNetworkFormField('customer_name', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      {/* PE1 Specific */}
                      <Typography variant="subtitle2" sx={{ color: '#4fc3f7', mt: 2 }}>Configuração PE1</Typography>
                      
                      <TextField
                        fullWidth
                        label="Cidade PE1"
                        value={networkFormData.cidade_pe1 || ''}
                        onChange={(e) => updateNetworkFormField('cidade_pe1', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <TextField
                        fullWidth
                        label="VPWS Group Name PE1"
                        value={networkFormData.vpws_group_name_pe1 || ''}
                        onChange={(e) => updateNetworkFormField('vpws_group_name_pe1', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                          label="VPN ID PE1"
                          value={networkFormData.vpn_id_pe1 || ''}
                          onChange={(e) => updateNetworkFormField('vpn_id_pe1', e.target.value)}
                        />
                        <TextField
                          sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                          label="PW ID PE1"
                          value={networkFormData.pw_id_pe1 || ''}
                          onChange={(e) => updateNetworkFormField('pw_id_pe1', e.target.value)}
                        />
                      </Box>
                      
                      <TextField
                        fullWidth
                        label="Neighbor IP PE1"
                        value={networkFormData.neighbor_ip_pe1 || ''}
                        onChange={(e) => updateNetworkFormField('neighbor_ip_pe1', e.target.value)}
                        helperText="IP do PE2 (vizinho)"
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Empresa PE1"
                        value={networkFormData.empresa_pe1 || ''}
                        onChange={(e) => updateNetworkFormField('empresa_pe1', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                          label="Número PE1"
                          value={networkFormData.numero_pe1 || ''}
                          onChange={(e) => updateNetworkFormField('numero_pe1', e.target.value)}
                        />
                        <TextField
                          sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                          label="Dot1Q PE1"
                          value={networkFormData.dot1q_pe1 || ''}
                          onChange={(e) => updateNetworkFormField('dot1q_pe1', e.target.value)}
                        />
                      </Box>
                    </Stack>
                  </Fade>
                  
                  {/* Botões de Navegação */}
                  <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      sx={{ flex: 1, color: '#ff9800', borderColor: '#ff9800' }}
                      onClick={navigateToL2VPNPE2}
                    >
                      Configurar PE2 →
                    </Button>
                  </Box>
                </Box>
              )}

              {/* L2VPN VPWS Configuration - PE2 (Lado B) */}
              {selectedAutomationOption === 'l2vpn-vpws' && currentL2VPNStep === 'pe2' && (
                <Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" gutterBottom sx={{ color: '#ff9800' }}>
                      🔌 PE2 - Lado B
                    </Typography>
                    <Chip 
                      label={`${selectedHosts[1]?.name || 'PE2'}`}
                      size="small" 
                      sx={{ bgcolor: '#ff9800', color: '#000' }}
                    />
                  </Box>
                  
                  {/* Indicador de Conexão */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#333', borderRadius: 1, border: '1px solid #ff9800' }}>
                    <Typography variant="body2" sx={{ color: '#ff9800', fontWeight: 'bold', mb: 1 }}>
                      🔗 Conexão L2VPN VPWS
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label={`PE1: ${selectedHosts[0]?.name}`} sx={{ bgcolor: '#4fc3f7', color: '#000' }} size="small" />
                      <Typography sx={{ color: '#fff' }}>↔</Typography>
                      <Chip label={`PE2: ${selectedHosts[1]?.name}`} sx={{ bgcolor: '#ff9800', color: '#000' }} size="small" />
                    </Box>
                  </Box>
                  
                  <Fade in={!isTransitioning} timeout={300}>
                    <Stack spacing={2}>
                      {/* PE2 Specific */}
                      <Typography variant="subtitle2" sx={{ color: '#ff9800' }}>Configuração PE2</Typography>
                      
                      <TextField
                        fullWidth
                        label="Cidade PE2"
                        value={networkFormData.cidade_pe2 || ''}
                        onChange={(e) => updateNetworkFormField('cidade_pe2', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <TextField
                        fullWidth
                        label="VPWS Group Name PE2"
                        value={networkFormData.vpws_group_name_pe2 || ''}
                        onChange={(e) => updateNetworkFormField('vpws_group_name_pe2', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                          label="VPN ID PE2"
                          value={networkFormData.vpn_id_pe2 || ''}
                          onChange={(e) => updateNetworkFormField('vpn_id_pe2', e.target.value)}
                        />
                        <TextField
                          sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                          label="PW ID PE2"
                          value={networkFormData.pw_id_pe2 || ''}
                          onChange={(e) => updateNetworkFormField('pw_id_pe2', e.target.value)}
                        />
                      </Box>
                      
                      <TextField
                        fullWidth
                        label="Neighbor IP PE2"
                        value={networkFormData.neighbor_ip_pe2 || ''}
                        onChange={(e) => updateNetworkFormField('neighbor_ip_pe2', e.target.value)}
                        helperText="IP do PE1 (vizinho)"
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Empresa PE2"
                        value={networkFormData.empresa_pe2 || ''}
                        onChange={(e) => updateNetworkFormField('empresa_pe2', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                          label="Número PE2"
                          value={networkFormData.numero_pe2 || ''}
                          onChange={(e) => updateNetworkFormField('numero_pe2', e.target.value)}
                        />
                        <TextField
                          sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                          label="Dot1Q PE2"
                          value={networkFormData.dot1q_pe2 || ''}
                          onChange={(e) => updateNetworkFormField('dot1q_pe2', e.target.value)}
                        />
                      </Box>
                      
                      {/* Credenciais */}
                      <Typography variant="subtitle2" sx={{ color: '#4caf50', mt: 2 }}>Credenciais</Typography>
                      
                      <TextField
                        fullWidth
                        label="Login"
                        value={networkFormData.login || ''}
                        onChange={(e) => updateNetworkFormField('login', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Senha"
                        type="password"
                        value={networkFormData.senha || ''}
                        onChange={(e) => updateNetworkFormField('senha', e.target.value)}
                        sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                      />
                    </Stack>
                  </Fade>
                  
                  {/* Botões de Navegação */}
                  <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      sx={{ flex: 1, color: '#4fc3f7', borderColor: '#4fc3f7' }}
                      onClick={navigateToL2VPNPE1}
                    >
                      ← Voltar PE1
                    </Button>
                    <Button
                      variant="contained"
                      sx={{ flex: 2, bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
                      onClick={handleNetworkConfigSubmit}
                      disabled={networkConfigLoading}
                    >
                      {networkConfigLoading ? 'Configurando...' : 'Executar L2VPN'}
                    </Button>
                  </Box>
                </Box>
              )}

              {/* L2VPN VPLS Configuration */}
              {selectedAutomationOption === 'l2vpn-vpls' && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ color: '#ff9800', mb: 2 }}>
                    Virtual Private LAN Service
                  </Typography>
                  <List>
                    <ListItem sx={{ bgcolor: '#2a2a2a', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary="Bridge Domain"
                        secondary="Criar e configurar domínio de bridge"
                      />
                    </ListItem>
                    <ListItem sx={{ bgcolor: '#2a2a2a', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary="Interface Attachment"
                        secondary="Anexar interfaces ao bridge domain"
                      />
                    </ListItem>
                    <ListItem sx={{ bgcolor: '#2a2a2a', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary="BGP Discovery"
                        secondary="Configurar auto-discovery via BGP"
                      />
                    </ListItem>
                    <ListItem sx={{ bgcolor: '#2a2a2a', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary="MAC Learning"
                        secondary="Configurar aprendizado de endereços MAC"
                      />
                    </ListItem>
                  </List>
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{ mt: 2, bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
                    onClick={() => executeAutomationConfig('l2vpn-vpls')}
                  >
                    Executar Configuração SSH
                  </Button>
                </Box>
              )}

              {/* BGP Configuration */}
              {selectedAutomationOption === 'bgp' && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ color: '#ff9800', mb: 2 }}>
                    Border Gateway Protocol
                  </Typography>
                  
                  <Stack spacing={2}>
                    {/* Configuração Básica */}
                    <TextField
                      fullWidth
                      label="IP do Roteador"
                      value={networkFormData.ip_roteador || ''}
                      onChange={(e) => updateNetworkFormField('ip_roteador', e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Nome do Cliente"
                      value={networkFormData.cliente || ''}
                      onChange={(e) => updateNetworkFormField('cliente', e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    />
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                        label="VLAN"
                        value={networkFormData.vlan || ''}
                        onChange={(e) => updateNetworkFormField('vlan', e.target.value)}
                      />
                      <TextField
                        sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                        label="ASN Cliente"
                        value={networkFormData.asn_cliente || ''}
                        onChange={(e) => updateNetworkFormField('asn_cliente', e.target.value)}
                      />
                    </Box>
                    
                    {/* Configuração IPv4 */}
                    <Typography variant="subtitle1" sx={{ color: '#4fc3f7', mt: 2 }}>IPv4</Typography>
                    
                    <TextField
                      fullWidth
                      label="Subnet Point-to-Point IPv4"
                      placeholder="192.168.1.0/30"
                      value={networkFormData.subnet_v4 || ''}
                      onChange={(e) => updateNetworkFormField('subnet_v4', e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    />
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        sx={{ flex: 2, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                        label="Rede IPv4 Cliente"
                        placeholder="10.0.0.0"
                        value={networkFormData.rede_v4_cliente || ''}
                        onChange={(e) => updateNetworkFormField('rede_v4_cliente', e.target.value)}
                      />
                      <TextField
                        sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                        label="/Prefixo"
                        value={networkFormData.tamanho_v4 || '24'}
                        onChange={(e) => updateNetworkFormField('tamanho_v4', e.target.value)}
                      />
                    </Box>
                    
                    {/* Configuração IPv6 */}
                    <Typography variant="subtitle1" sx={{ color: '#ff9800', mt: 2 }}>IPv6</Typography>
                    
                    <TextField
                      fullWidth
                      label="Subnet Point-to-Point IPv6"
                      placeholder="2001:db8::/127"
                      value={networkFormData.subnet_v6 || ''}
                      onChange={(e) => updateNetworkFormField('subnet_v6', e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    />
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        sx={{ flex: 2, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                        label="Rede IPv6 Cliente"
                        placeholder="2001:db8:1000::"
                        value={networkFormData.rede_v6_cliente || ''}
                        onChange={(e) => updateNetworkFormField('rede_v6_cliente', e.target.value)}
                      />
                      <TextField
                        sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                        label="/Prefixo"
                        value={networkFormData.tamanho_v6 || '48'}
                        onChange={(e) => updateNetworkFormField('tamanho_v6', e.target.value)}
                      />
                    </Box>
                    
                    {/* Credenciais */}
                    <Typography variant="subtitle1" sx={{ color: '#4caf50', mt: 2 }}>Credenciais</Typography>
                    
                    <TextField
                      fullWidth
                      label="Login"
                      value={networkFormData.login || ''}
                      onChange={(e) => updateNetworkFormField('login', e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Senha"
                      type="password"
                      value={networkFormData.senha || ''}
                      onChange={(e) => updateNetworkFormField('senha', e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    />
                  </Stack>
                  
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{ mt: 3, bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
                    onClick={handleNetworkConfigSubmit}
                    disabled={networkConfigLoading}
                  >
                    {networkConfigLoading ? 'Configurando...' : 'Executar Configuração BGP'}
                  </Button>
                </Box>
              )}

              {/* OSPF Configuration */}
              {selectedAutomationOption === 'ospf' && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ color: '#ff9800', mb: 2 }}>
                    Open Shortest Path First
                  </Typography>
                  
                  <Stack spacing={2}>
                    {/* Configurações Globais */}
                    <Typography variant="subtitle1" sx={{ color: '#4fc3f7' }}>Configurações Globais</Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                        label="Process ID"
                        value={networkFormData.global_settings?.default_process_id || '1'}
                        onChange={(e) => updateNetworkFormField('global_settings', { ...networkFormData.global_settings, default_process_id: e.target.value })}
                      />
                      <TextField
                        sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                        label="Área"
                        value={networkFormData.global_settings?.default_area_id || '0'}
                        onChange={(e) => updateNetworkFormField('global_settings', { ...networkFormData.global_settings, default_area_id: e.target.value })}
                      />
                    </Box>
                    
                    {/* Roteadores */}
                    <Typography variant="subtitle1" sx={{ color: '#ff9800', mt: 2 }}>Roteadores ({networkFormData.configs?.length || 0})</Typography>
                    
                    {networkFormData.configs && networkFormData.configs.map((router: any, index: number) => (
                      <Box key={router.id || index} sx={{ p: 2, bgcolor: '#2a2a2a', borderRadius: 1, mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
                          {router.name} ({router.ip})
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          <TextField
                            sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                            label="Router ID"
                            size="small"
                            value={router.router_id || ''}
                            onChange={(e) => {
                              const updatedConfigs = [...(networkFormData.configs || [])];
                              updatedConfigs[index] = { ...router, router_id: e.target.value };
                              updateNetworkFormField('configs', updatedConfigs);
                            }}
                          />
                          <TextField
                            sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                            label="Interface"
                            size="small"
                            value={router.interface || 'loopback-0'}
                            onChange={(e) => {
                              const updatedConfigs = [...(networkFormData.configs || [])];
                              updatedConfigs[index] = { ...router, interface: e.target.value };
                              updateNetworkFormField('configs', updatedConfigs);
                            }}
                          />
                        </Box>
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <TextField
                            sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                            label="Process ID"
                            size="small"
                            value={router.process_id || ''}
                            onChange={(e) => {
                              const updatedConfigs = [...(networkFormData.configs || [])];
                              updatedConfigs[index] = { ...router, process_id: e.target.value };
                              updateNetworkFormField('configs', updatedConfigs);
                            }}
                          />
                          <TextField
                            sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                            label="Área"
                            size="small"
                            value={router.area_id || ''}
                            onChange={(e) => {
                              const updatedConfigs = [...(networkFormData.configs || [])];
                              updatedConfigs[index] = { ...router, area_id: e.target.value };
                              updateNetworkFormField('configs', updatedConfigs);
                            }}
                          />
                          <TextField
                            sx={{ flex: 1, '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                            label="Custo"
                            size="small"
                            value={router.cost || '100'}
                            onChange={(e) => {
                              const updatedConfigs = [...(networkFormData.configs || [])];
                              updatedConfigs[index] = { ...router, cost: e.target.value };
                              updateNetworkFormField('configs', updatedConfigs);
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                    
                    {/* Credenciais */}
                    <Typography variant="subtitle1" sx={{ color: '#4caf50', mt: 2 }}>Credenciais</Typography>
                    
                    <TextField
                      fullWidth
                      label="Login"
                      value={networkFormData.login || ''}
                      onChange={(e) => updateNetworkFormField('login', e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Senha"
                      type="password"
                      value={networkFormData.senha || ''}
                      onChange={(e) => updateNetworkFormField('senha', e.target.value)}
                      sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
                    />
                  </Stack>
                  
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{ mt: 3, bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
                    onClick={handleNetworkConfigSubmit}
                    disabled={networkConfigLoading}
                  >
                    {networkConfigLoading ? 'Configurando...' : `Executar OSPF em ${networkFormData.configs?.length || 0} Roteadores`}
                  </Button>
                </Box>
              )}

              <Box sx={{ mt: 3, p: 2, bgcolor: '#3d2914', borderRadius: 1, border: '1px solid #ff9800' }}>
                <Typography variant="body2" sx={{ color: '#ffb74d', fontSize: '12px' }}>
                  ⚠️ As configurações serão aplicadas via SSH no equipamento selecionado. Certifique-se de que as credenciais estão corretas.
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Drawer>

      {/* Diálogo central de credenciais para finalizar operação L2VPN VPWS */}
      <Dialog
        open={credentialsDialogOpen}
        onClose={() => setCredentialsDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff' } }}
      >
        <DialogTitle>Finalizar Configuração</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: '#bbb' }}>
            Informe as credenciais para aplicar a configuração em ambos os PEs.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Login"
              value={credentials.login}
              onChange={(e) => setCredentials({ ...credentials, login: e.target.value })}
              sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
            />
            <TextField
              label="Senha"
              type="password"
              value={credentials.senha}
              onChange={(e) => setCredentials({ ...credentials, senha: e.target.value })}
              sx={{ '& .MuiInputLabel-root': { color: '#aaa' }, '& .MuiOutlinedInput-root': { color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCredentialsDialogOpen(false)} color="inherit" variant="outlined">Cancelar</Button>
          <Button onClick={submitL2VPNVPWS} variant="contained" disabled={!credentials.login || !credentials.senha || networkConfigLoading}>
            {networkConfigLoading ? 'Enviando...' : 'Aplicar Configuração'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SSH Execution Result Dialog */}
      <Dialog
        open={showSSHDialog}
        onClose={() => {
          setShowSSHDialog(false);
          setSSHExecutionResult(null);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: '#1e1e1e', color: '#fff', minHeight: '500px' }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #333', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SettingsIcon sx={{ color: '#4fc3f7' }} />
            <Typography variant="h5" sx={{ color: '#fff' }}>
              Execução SSH - Automação de Rede
            </Typography>
            {isExecutingSSH && <CircularProgress size={24} sx={{ color: '#4fc3f7' }} />}
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {isExecutingSSH ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
              <CircularProgress size={60} sx={{ color: '#4fc3f7' }} />
              <Typography variant="h6" sx={{ color: '#4fc3f7' }}>
                Conectando ao equipamento via SSH...
              </Typography>
              <Typography variant="body2" sx={{ color: '#aaa', textAlign: 'center' }}>
                Executando comandos de configuração no {selectedRouterForAutomation?.name}
              </Typography>
            </Box>
          ) : sshExecutionResult ? (
            <Box>
              {/* Status Header */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                mb: 3, 
                p: 2, 
                borderRadius: 1,
                bgcolor: sshExecutionResult.success ? '#1b5e20' : '#b71c1c'
              }}>
                <Box sx={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: '50%', 
                  bgcolor: sshExecutionResult.success ? '#4caf50' : '#f44336',
                  animation: 'pulse 2s infinite'
                }} />
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
                  {sshExecutionResult.success ? '✅ Configuração Aplicada com Sucesso' : '❌ Erro na Execução'}
                </Typography>
                <Chip
                  label={`${sshExecutionResult.executionTime}ms`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </Box>

              {/* Commands Executed */}
              {sshExecutionResult.commands.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: '#4fc3f7', borderBottom: '1px solid #333', pb: 1 }}>
                    📋 Comandos Executados ({sshExecutionResult.commands.length})
                  </Typography>
                  <Box sx={{ 
                    bgcolor: '#0d1117', 
                    border: '1px solid #30363d',
                    borderRadius: 1, 
                    p: 2,
                    maxHeight: '200px',
                    overflow: 'auto',
                    fontFamily: 'monospace'
                  }}>
                    {sshExecutionResult.commands.map((cmd, index) => (
                      <Typography 
                        key={index} 
                        variant="body2" 
                        sx={{ 
                          color: '#58a6ff',
                          mb: 0.5,
                          '&::before': {
                            content: `"${String(index + 1).padStart(2, '0')}. "`,
                            color: '#6e7681',
                            mr: 1
                          }
                        }}
                      >
                        {cmd}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}

              {/* SSH Output */}
              {sshExecutionResult.output && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: '#4fc3f7', borderBottom: '1px solid #333', pb: 1 }}>
                    💻 Saída SSH
                  </Typography>
                  <Box sx={{ 
                    bgcolor: '#0d1117', 
                    border: '1px solid #30363d',
                    borderRadius: 1, 
                    p: 2,
                    maxHeight: '300px',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-line'
                  }}>
                    <Typography variant="body2" sx={{ color: '#7c3aed' }}>
                      {sshExecutionResult.output}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Error */}
              {sshExecutionResult.error && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: '#f44336', borderBottom: '1px solid #333', pb: 1 }}>
                    ⚠️ Erro Detectado
                  </Typography>
                  <Box sx={{ 
                    bgcolor: '#3d1a1a', 
                    border: '1px solid #f44336',
                    borderRadius: 1, 
                    p: 2,
                    fontFamily: 'monospace'
                  }}>
                    <Typography variant="body2" sx={{ color: '#ff6b6b' }}>
                      {sshExecutionResult.error}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Equipment Info */}
              {selectedRouterForAutomation && (
                <Box sx={{ 
                  mt: 3, 
                  p: 2, 
                  bgcolor: '#2a2a2a', 
                  borderRadius: 1,
                  border: '1px solid #444'
                }}>
                  <Typography variant="body2" sx={{ color: '#aaa', mb: 1 }}>Equipamento Configurado:</Typography>
                  <Typography variant="h6" sx={{ color: '#fff' }}>
                    {selectedRouterForAutomation.name} ({selectedRouterForAutomation.zabbixHost?.ipAddress})
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#4fc3f7' }}>
                    Protocolo: {selectedAutomationOption?.toUpperCase()}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        
        <DialogActions sx={{ borderTop: '1px solid #333', pt: 2 }}>
          <Button 
            onClick={() => {
              setShowSSHDialog(false);
              setSSHExecutionResult(null);
            }}
            color="inherit"
            variant="outlined"
          >
            Fechar
          </Button>
          {sshExecutionResult && !isExecutingSSH && (
            <Button
              onClick={() => executeAutomationConfig(selectedAutomationOption || '')}
              color="primary"
              variant="contained"
              disabled={!selectedAutomationOption}
            >
              Executar Novamente
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Advanced Protocol Configuration Dialog - Inspirado no l2vpn-master */}
      <Dialog
        open={showAdvancedConfigDialog && selectedConfigProtocol !== 'l2vpn-vpws'}
        onClose={() => {
          setShowAdvancedConfigDialog(false);
          setProtocolFormData({});
          setSelectedConfigProtocol(null);
          setL2vpnMode('');
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { 
            bgcolor: '#121212', 
            color: '#23b9f3', 
            minHeight: '600px',
            border: '2px solid #23b9f3'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid #23b9f3', 
          pb: 2,
          bgcolor: '#1e1e1e',
          color: '#23b9f3'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {selectedConfigProtocol && (
              <Avatar sx={{ 
                bgcolor: AVAILABLE_PROTOCOLS.find(p => p.id === selectedConfigProtocol)?.color || '#23b9f3',
                color: '#fff' 
              }}>
                {AVAILABLE_PROTOCOLS.find(p => p.id === selectedConfigProtocol)?.icon}
              </Avatar>
            )}
            <Typography variant="h4" sx={{ color: '#23b9f3', fontWeight: 'bold' }}>
              Configurar {selectedConfigProtocol?.toUpperCase()}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0, bgcolor: '#000' }}>
          {selectedConfigProtocol === 'l2vpn-vpws' && (
            <Box sx={{ 
              display: 'flex', 
              height: '500px',
              bgcolor: '#000'
            }}>
              {/* Configuração PE-A */}
              <Box sx={{ 
                flex: 1, 
                p: 3, 
                borderRight: '1px solid #23b9f3',
                bgcolor: '#000'
              }}>
                <Typography variant="h5" sx={{ 
                  color: '#23b9f3', 
                  mb: 3, 
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}>
                  Configuração do PE-A
                </Typography>

                {/* Botões de modo L2VPN */}
                <Box sx={{ display: 'flex', gap: 1, mb: 3, justifyContent: 'center' }}>
                  {['qinq', 'access', 'vlan-selective'].map((mode) => (
                    <Button
                      key={mode}
                      variant={l2vpnMode === mode ? 'contained' : 'outlined'}
                      onClick={() => setL2vpnMode(l2vpnMode === mode ? '' : mode)}
                      sx={{
                        bgcolor: l2vpnMode === mode ? '#23b9f3' : 'transparent',
                        color: l2vpnMode === mode ? '#000' : '#23b9f3',
                        borderColor: '#23b9f3',
                        '&:hover': {
                          bgcolor: '#1d8dc2',
                          color: '#000'
                        }
                      }}
                    >
                      {mode.toUpperCase()}
                    </Button>
                  ))}
                </Box>

                <Stack spacing={2}>
                  <TextField
                    label="Cidade PE-A"
                    value={protocolFormData.cidade_pe1 || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, cidade_pe1: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                        '&:hover fieldset': { borderColor: '#1d8dc2' },
                        '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="VPWS Group Name PE-A"
                    value={protocolFormData.vpws_group_name_pe1 || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, vpws_group_name_pe1: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                        '&:hover fieldset': { borderColor: '#1d8dc2' },
                        '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="VPN ID PE-A"
                    value={protocolFormData.vpn_id_pe1 || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, vpn_id_pe1: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                        '&:hover fieldset': { borderColor: '#1d8dc2' },
                        '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="PW ID PE-A"
                    value={protocolFormData.pw_id_pe1 || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, pw_id_pe1: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                        '&:hover fieldset': { borderColor: '#1d8dc2' },
                        '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <FormControl sx={{ flex: 1 }}>
                      <InputLabel sx={{ color: '#23b9f3' }}>Interface PE-A</InputLabel>
                      <Select
                        value={protocolFormData.interface_pe1 || 'gigabit'}
                        onChange={(e) => setProtocolFormData(prev => ({ ...prev, interface_pe1: e.target.value }))}
                        sx={{
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#23b9f3' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1d8dc2' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#23b9f3' },
                          '& .MuiSvgIcon-root': { color: '#23b9f3' },
                        }}
                      >
                        <MenuItem value="gigabit">Gigabit</MenuItem>
                        <MenuItem value="forty-gigabit">Forty-Gigabit</MenuItem>
                        <MenuItem value="ten-gigabit">Ten-Gigabit</MenuItem>
                        <MenuItem value="twenty-five-gigabit">Twenty-Five-Gigabit</MenuItem>
                        <MenuItem value="hundred-gigabit">Hundred-Gigabit</MenuItem>
                        <MenuItem value="lag-">LAG</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <TextField
                      label="Número"
                      value={protocolFormData.interface_num_pe1 || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, interface_num_pe1: e.target.value }))}
                      sx={{ 
                        width: '100px',
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                          '&:hover fieldset': { borderColor: '#1d8dc2' },
                          '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                  </Box>

                  {l2vpnMode !== 'vlan-selective' && (
                    <TextField
                      label="Dot1q PE-A"
                      value={protocolFormData.dot1q_pe1 || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, dot1q_pe1: e.target.value }))}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                          '&:hover fieldset': { borderColor: '#1d8dc2' },
                          '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                  )}
                </Stack>
              </Box>

              {/* Configuração PE-B */}
              <Box sx={{ flex: 1, p: 3, bgcolor: '#000' }}>
                <Typography variant="h5" sx={{ 
                  color: '#23b9f3', 
                  mb: 3, 
                  textAlign: 'center',
                  fontWeight: 'bold'
                }}>
                  Configuração do PE-B
                </Typography>

                <Stack spacing={2}>
                  <TextField
                    label="Cidade PE-B"
                    value={protocolFormData.cidade_pe2 || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, cidade_pe2: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                        '&:hover fieldset': { borderColor: '#1d8dc2' },
                        '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="VPWS Group Name PE-B"
                    value={protocolFormData.vpws_group_name_pe2 || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, vpws_group_name_pe2: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                        '&:hover fieldset': { borderColor: '#1d8dc2' },
                        '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="VPN ID PE-B"
                    value={protocolFormData.vpn_id_pe2 || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, vpn_id_pe2: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                        '&:hover fieldset': { borderColor: '#1d8dc2' },
                        '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="PW ID PE-B"
                    value={protocolFormData.pw_id_pe2 || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, pw_id_pe2: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                        '&:hover fieldset': { borderColor: '#1d8dc2' },
                        '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <FormControl sx={{ flex: 1 }}>
                      <InputLabel sx={{ color: '#23b9f3' }}>Interface PE-B</InputLabel>
                      <Select
                        value={protocolFormData.interface_pe2 || 'gigabit'}
                        onChange={(e) => setProtocolFormData(prev => ({ ...prev, interface_pe2: e.target.value }))}
                        sx={{
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#23b9f3' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1d8dc2' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#23b9f3' },
                          '& .MuiSvgIcon-root': { color: '#23b9f3' },
                        }}
                      >
                        <MenuItem value="gigabit">Gigabit</MenuItem>
                        <MenuItem value="forty-gigabit">Forty-Gigabit</MenuItem>
                        <MenuItem value="ten-gigabit">Ten-Gigabit</MenuItem>
                        <MenuItem value="twenty-five-gigabit">Twenty-Five-Gigabit</MenuItem>
                        <MenuItem value="hundred-gigabit">Hundred-Gigabit</MenuItem>
                        <MenuItem value="lag-">LAG</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <TextField
                      label="Número"
                      value={protocolFormData.interface_num_pe2 || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, interface_num_pe2: e.target.value }))}
                      sx={{ 
                        width: '100px',
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                          '&:hover fieldset': { borderColor: '#1d8dc2' },
                          '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                  </Box>

                  {l2vpnMode !== 'vlan-selective' && (
                    <TextField
                      label="Dot1q PE-B"
                      value={protocolFormData.dot1q_pe2 || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, dot1q_pe2: e.target.value }))}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                          '&:hover fieldset': { borderColor: '#1d8dc2' },
                          '&.Mui-focused fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                  )}
                </Stack>
              </Box>
            </Box>
          )}

          {/* Configuração BGP */}
          {selectedConfigProtocol === 'bgp' && (
            <Box sx={{ p: 3, bgcolor: '#000', height: '500px', overflow: 'auto' }}>
              <Typography variant="h5" sx={{ 
                color: '#23b9f3', 
                mb: 3, 
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Configuração BGP - Border Gateway Protocol
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ color: '#4fc3f7', mb: 2 }}>
                    Informações do Roteador
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="IP do Roteador"
                      value={protocolFormData.ip_roteador || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, ip_roteador: e.target.value }))}
                      placeholder="10.10.10.1"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                    
                    <TextField
                      label="VLAN"
                      value={protocolFormData.vlan || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, vlan: e.target.value }))}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                    
                    <TextField
                      label="Nome do Cliente"
                      value={protocolFormData.cliente || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, cliente: e.target.value }))}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                    
                    <TextField
                      label="ASN do Cliente"
                      value={protocolFormData.asn_cliente || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, asn_cliente: e.target.value }))}
                      placeholder="64512"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="h6" sx={{ color: '#4fc3f7', mb: 2 }}>
                    Configuração de Rede
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Subnet IPv4"
                      value={protocolFormData.subnet_v4 || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, subnet_v4: e.target.value }))}
                      placeholder="10.10.10.0/30"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                    
                    <TextField
                      label="Subnet IPv6"
                      value={protocolFormData.subnet_v6 || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, subnet_v6: e.target.value }))}
                      placeholder="2001:db8::/126"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                    
                    <TextField
                      label="Rede IPv4 do Cliente"
                      value={protocolFormData.rede_v4_cliente || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, rede_v4_cliente: e.target.value }))}
                      placeholder="170.80.80.0/22"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                    
                    <TextField
                      label="Rede IPv6 do Cliente"
                      value={protocolFormData.rede_v6_cliente || ''}
                      onChange={(e) => setProtocolFormData(prev => ({ ...prev, rede_v6_cliente: e.target.value }))}
                      placeholder="2804:3768::/32"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#222',
                          color: '#23b9f3',
                          '& fieldset': { borderColor: '#23b9f3' },
                        },
                        '& .MuiInputLabel-root': { color: '#23b9f3' },
                      }}
                    />
                  </Stack>
                </Box>
              </Box>
            </Box>
          )}

          {/* Configuração OSPF */}
          {selectedConfigProtocol === 'ospf' && (
            <Box sx={{ p: 3, bgcolor: '#000', height: '500px' }}>
              <Typography variant="h5" sx={{ 
                color: '#23b9f3', 
                mb: 3, 
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Configuração OSPF - Open Shortest Path First
              </Typography>

              <Box sx={{ maxWidth: '600px', mx: 'auto' }}>
                <Stack spacing={3}>
                  <TextField
                    label="Process ID"
                    value={protocolFormData.process_id || '1'}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, process_id: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="Router ID"
                    value={protocolFormData.router_id || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, router_id: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="Area ID"
                    value={protocolFormData.area_id || '0'}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, area_id: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="Interface"
                    value={protocolFormData.interface || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, interface: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  
                  <TextField
                    label="Interface Cost"
                    type="number"
                    value={protocolFormData.cost || '100'}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, cost: e.target.value }))}
                    inputProps={{ min: 1, max: 65535 }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#222',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                </Stack>
              </Box>
            </Box>
          )}

          {/* Seção de Login */}
          {selectedConfigProtocol && (
            <Box sx={{ 
              p: 2, 
              bgcolor: '#1e1e1e', 
              borderTop: '1px solid #23b9f3',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <Box sx={{ 
                p: 2, 
                border: '1px solid #23b9f3', 
                borderRadius: 1,
                bgcolor: '#222',
                minWidth: '300px'
              }}>
                <Typography variant="h6" sx={{ 
                  color: '#23b9f3', 
                  mb: 2, 
                  textAlign: 'center' 
                }}>
                  Login no Roteador
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Login"
                    value={protocolFormData.login || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, login: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#333',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                  <TextField
                    label="Senha"
                    type="password"
                    value={protocolFormData.password || ''}
                    onChange={(e) => setProtocolFormData(prev => ({ ...prev, password: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: '#333',
                        color: '#23b9f3',
                        '& fieldset': { borderColor: '#23b9f3' },
                      },
                      '& .MuiInputLabel-root': { color: '#23b9f3' },
                    }}
                  />
                </Stack>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ 
          borderTop: '1px solid #23b9f3', 
          pt: 2,
          bgcolor: '#1e1e1e',
          justifyContent: 'space-between'
        }}>
          <Button 
            onClick={() => {
              setShowAdvancedConfigDialog(false);
              setProtocolFormData({});
              setSelectedConfigProtocol(null);
              setL2vpnMode('');
            }}
            sx={{ color: '#23b9f3', borderColor: '#23b9f3' }}
            variant="outlined"
          >
            Cancelar
          </Button>
          
          <Button
            onClick={async () => {
              console.log('🚀 Executando configuração avançada:', {
                protocol: selectedConfigProtocol,
                mode: l2vpnMode,
                data: protocolFormData
              });
              
              // Aqui será implementada a integração com o backend l2vpn
              // Por ora, apenas loggar os dados
              setShowAdvancedConfigDialog(false);
              setShowSSHDialog(true);
              setIsExecutingSSH(true);
              
              // Simular execução
              setTimeout(() => {
                setIsExecutingSSH(false);
                setSSHExecutionResult({
                  success: true,
                  output: `Configuração ${selectedConfigProtocol?.toUpperCase()} aplicada com sucesso!`,
                  commands: ['config', 'commit', 'exit'],
                  executionTime: 2500,
                });
              }, 3000);
            }}
            sx={{ 
              bgcolor: '#23b9f3', 
              color: '#000',
              '&:hover': { bgcolor: '#1d8dc2' }
            }}
            variant="contained"
            disabled={!protocolFormData.login || !protocolFormData.password}
          >
            🔗 Configurar {selectedConfigProtocol?.toUpperCase()}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Novo Componente L2VPN VPWS */}
      <L2VPNConfiguration
        leftDrawerOpen={leftMenuOpen && leftPanelMode === 'l2vpn-vpws'}
        rightDrawerOpen={rightMenuOpen && rightPanelMode === 'l2vpn-vpws'}
        selectedHostLeft={selectedHosts[0] || null}
        selectedHostRight={selectedHosts[1] || null}
        onClose={closeL2VPNConfig}
      />

    </Box>
  );
};

export default MapManager; 
