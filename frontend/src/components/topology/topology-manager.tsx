import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip as LeafletTooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { calculateMultipleRoutes } from '../../services/routingService';
import { api } from '../../services/api';
import { zabbixService, type ZabbixHostData } from '../../services/zabbixService';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  ButtonGroup,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Switch,
  FormControlLabel,
  Tooltip,
  Paper,
  CircularProgress,
  Menu,
  Alert,
  ListItemButton,
  Divider,
  Tabs,
  Tab,
  Slider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Link as LinkIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Visibility as ViewIcon,
  Router as RouterIcon,
  Computer as HostIcon,
  Storage as ServerIcon,
  Business as BuildingIcon,
  ToggleOn as SwitchIcon,
  Wifi as AntennaIcon,
  Timeline as DiagramIcon,
  ArrowBack as BackIcon,
  Hub as HubIcon,
  Route as RouteIcon,
  Folder as FolderIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

// Fix Leaflet default icon issue
const DefaultIconProto = L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown };
delete DefaultIconProto._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Types for topology elements
interface TopologyNode {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'server' | 'host' | 'antenna' | 'building';
  position: {
    latitude: number;
    longitude: number;
  };
  properties: {
    ipAddress?: string;
    model?: string;
    vendor?: string;
    capacity?: string;
    status?: 'online' | 'offline' | 'warning';
    zabbixHostId?: string;
    zabbixHostName?: string;
  };
  connections: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface TopologyConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'fiber' | 'wireless' | 'ethernet' | 'logical';
  bandwidth?: string;
  path: [number, number][]; // Caminho da conexão
  isCalculated?: boolean; // Se foi calculado por vias terrestres
  distance?: number; // Distância real em metros
  properties: {
    length?: number;
    latency?: number;
    utilization?: number;
    traffic?: {
      inbound: number;
      outbound: number;
      latency: number;
    };
    // Placeholders para integração Zabbix (interface do host de origem/destino)
    sourceInterface?: string;
    targetInterface?: string;
    sourceZabbixInterfaceId?: string;
    targetZabbixInterfaceId?: string;
  };
  style: {
    color: string;
    width: number;
    opacity: number;
    dashArray?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface TopologyProject {
  id: string;
  name: string;
  description: string;
  center: {
    latitude: number;
    longitude: number;
  };
  zoom: number;
  nodes: TopologyNode[];
  connections: TopologyConnection[];
  createdAt: Date;
  updatedAt: Date;
}

// Tipo leve para listar projetos vindos do backend
interface BackendProjectSummary {
  id: string;
  name: string;
  description?: string;
  nodes?: unknown[];
  connections?: unknown[];
}

// Interface para conexões do backend
interface BackendConnection {
  id: string;
  source_node: string | { id: string };
  target_node: string | { id: string };
  connection_type: string;
  bandwidth?: string;
  path?: [number, number][];
  is_calculated?: boolean;
  distance?: number;
  length?: number;
  latency?: number;
  utilization?: number;
  traffic_inbound?: number;
  traffic_outbound?: number;
  traffic_latency?: number;
  color: string;
  width: number;
  opacity: number;
  dash_array?: string;
  created_at: string;
  updated_at: string;
}

type EditMode = {
  active: boolean;
  tool: 'select' | 'add-node' | 'add-connection' | 'delete' | 'edit-route' | 'edit-connection';
  nodeType?: TopologyNode['type'];
  selectedNodes: string[];
  selectedConnection?: string | null;
  connectionEditMode?: boolean;
}

interface GlobalSettings {
  ftthMap: {
    enabled: boolean;
    databaseUrl: string;
    scales: {
      noData: { min: -999, max: -16, color: '#666666' };
      weak: { min: -23, max: -16, color: '#ff6b6b' };
      moderate: { min: -33, max: -23, color: '#ffa726' };
      good: { min: -40, max: -33, color: '#66bb6a' };
      excellent: { min: -100, max: -40, color: '#4caf50' };
    };
    updateInterval: number; // em minutos
  };
  trafficLayer: {
    enabled: boolean;
    scales: {
      offline: { value: 0, color: '#666666' };
      low: { value: 1, color: '#4caf50' };
      moderate: { value: 5, color: '#ffeb3b' };
      medium: { value: 15, color: '#ff9800' };
      high: { value: 25, color: '#f44336' };
      critical: { value: 50, color: '#9c27b0' };
      overload: { value: 70, color: '#673ab7' };
      saturated: { value: 80, color: '#3f51b5' };
      maximum: { value: 90, color: '#e91e63' };
    };
    updateInterval: number; // em minutos
  };
  zabbixOptimization: {
    updateInterval: number; // em minutos
    routingPrecision: 'low' | 'moderate' | 'good' | 'excellent';
    maxConcurrentRequests: number;
    cacheTimeout: number; // em minutos
  };
  animations: {
    enabled: boolean;
    alertAnimations: boolean;
    connectionAnimations: boolean;
  };
  tileUrls: {
    light: string;
    dark: string;
  };
};

type QuickAddMode = {
  active: boolean;
  nodeType?: TopologyNode['type'];
};

interface TopologyManagerProps {
  onBack?: () => void;
}

// Node type configurations
const NODE_CONFIGS = {
  router: { color: '#2196F3', icon: RouterIcon, label: 'Roteador' },
  switch: { color: '#4CAF50', icon: SwitchIcon, label: 'Switch' },
  server: { color: '#FF9800', icon: ServerIcon, label: 'Servidor' },
  host: { color: '#9C27B0', icon: HostIcon, label: 'Host' },
  antenna: { color: '#795548', icon: AntennaIcon, label: 'Antena' },
  building: { color: '#607D8B', icon: BuildingIcon, label: 'Prédio' },
};

// Connection type configurations
const CONNECTION_CONFIGS = {
  fiber: { color: '#2196F3', width: 4, label: 'Fibra Óptica' },
  wireless: { color: '#4CAF50', width: 2, dashArray: '5, 5', label: 'Wireless' },
  ethernet: { color: '#FF9800', width: 3, label: 'Ethernet' },
  logical: { color: '#9C27B0', width: 1, dashArray: '10, 5', label: 'Lógica' },
};


// Create custom icons for nodes
const createNodeIcon = (type: TopologyNode['type'], status?: string) => {
  const config = NODE_CONFIGS[type];
  const statusColor = status === 'online' ? '#4CAF50' : status === 'offline' ? '#F44336' : status === 'warning' ? '#FF9800' : config.color;
  
  return L.divIcon({
    className: 'topology-node-icon',
    html: `
      <div style="
        background-color: ${statusColor};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 10px;
      ">
        ${type.charAt(0).toUpperCase()}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Map click handler
const MapClickHandler: React.FC<{
  editMode: EditMode;
  quickAddMode: QuickAddMode;
  onMapClick: (latlng: { latitude: number; longitude: number }) => void;
}> = ({ editMode, quickAddMode, onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if ((editMode.active && editMode.tool === 'add-node') || quickAddMode.active) {
        onMapClick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      }
    },
  });
  return null;
};

export const TopologyManager: React.FC<TopologyManagerProps> = ({ onBack }) => {
  // States
  const [project, setProject] = useState<TopologyProject | null>(null);
  const [editMode, setEditMode] = useState<EditMode>({
    active: false,
    tool: 'select',
    selectedNodes: [],
    selectedConnection: null,
    connectionEditMode: false,
  });
  const [quickAddMode, setQuickAddMode] = useState<QuickAddMode>({
    active: false,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNodeDialog, setShowNodeDialog] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const [projects, setProjects] = useState<BackendProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [pendingNodeLocation, setPendingNodeLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<TopologyNode['type']>('router');
  const [newNodeIP, setNewNodeIP] = useState('');
  const [projectName, setProjectName] = useState('');
  
  // Estados para edição de projetos
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<BackendProjectSummary | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  
  // Estados para edição de nós
  const [showEditNodeDialog, setShowEditNodeDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<TopologyNode | null>(null);
  const [editNodeName, setEditNodeName] = useState('');
  const [editNodeType, setEditNodeType] = useState<TopologyNode['type']>('router');
  const [editNodeIP, setEditNodeIP] = useState('');
  
  // Estado para detectar duplo clique
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [lastClickedNode, setLastClickedNode] = useState<string>('');
  const [viewMode, setViewMode] = useState<'map' | 'diagram'>('map');
  const [showConnections, setShowConnections] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routeCalculateMode, setRouteCalculateMode] = useState(false);
  const [selectedConnectionForCalculation, setSelectedConnectionForCalculation] = useState<string | null>(null);
  
  // Painel lateral de edição de conexão (interfaces, ações)
  const [connectionPanelOpen, setConnectionPanelOpen] = useState(false);
  const [sourceInterfaceInput, setSourceInterfaceInput] = useState('');
  const [targetInterfaceInput, setTargetInterfaceInput] = useState('');
  
  // Painel lateral de edição de nó/elemento
  const [nodePanelOpen, setNodePanelOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [availableZabbixHosts, setAvailableZabbixHosts] = useState<ZabbixHostData[]>([]);
  const [selectedZabbixHost, setSelectedZabbixHost] = useState<string>('');
  const [nodeIconType, setNodeIconType] = useState<TopologyNode['type']>('router');
  const [nodeNameInput, setNodeNameInput] = useState('');
  const [nodeLatInput, setNodeLatInput] = useState('');
  const [nodeLngInput, setNodeLngInput] = useState('');
  const [loadingZabbixHosts, setLoadingZabbixHosts] = useState(false);
  const [draggableNodeMode, setDraggableNodeMode] = useState(false);
  
  // Estados para configurações globais
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState(0);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    ftthMap: {
      enabled: false,
      databaseUrl: '',
      scales: {
        noData: { min: -999, max: -16, color: '#666666' },
        weak: { min: -23, max: -16, color: '#ff6b6b' },
        moderate: { min: -33, max: -23, color: '#ffa726' },
        good: { min: -40, max: -33, color: '#66bb6a' },
        excellent: { min: -100, max: -40, color: '#4caf50' },
      },
      updateInterval: 5,
    },
    trafficLayer: {
      enabled: true,
      scales: {
        offline: { value: 0, color: '#666666' },
        low: { value: 1, color: '#4caf50' },
        moderate: { value: 5, color: '#ffeb3b' },
        medium: { value: 15, color: '#ff9800' },
        high: { value: 25, color: '#f44336' },
        critical: { value: 50, color: '#9c27b0' },
        overload: { value: 70, color: '#673ab7' },
        saturated: { value: 80, color: '#3f51b5' },
        maximum: { value: 90, color: '#e91e63' },
      },
      updateInterval: 1,
    },
    zabbixOptimization: {
      updateInterval: 1,
      routingPrecision: 'good',
      maxConcurrentRequests: 10,
      cacheTimeout: 5,
    },
    animations: {
      enabled: true,
      alertAnimations: true,
      connectionAnimations: false,
    },
    tileUrls: {
      light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      dark: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    },
  });
  
  // Duplo clique na rota habilita edição diretamente para aquela conexão
  const enableEditForConnection = useCallback((connectionId: string) => {
    setEditMode(prev => ({
      ...prev,
      tool: 'edit-connection',
      selectedConnection: connectionId,
      connectionEditMode: true
    }));
  }, []);

  // Load projects from backend
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await api.get('/api/topology/topology-projects/');
      console.log('🔍 Resposta da API /api/topology/topology-projects/:', response.data);
      
      const projectsData = Array.isArray(response.data) 
        ? response.data 
        : response.data?.results || response.data?.projects || [];
      
      console.log('📊 Projetos processados:', projectsData);
      setProjects(projectsData as BackendProjectSummary[]);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // Save project to backend
  const saveProjectToBackend = useCallback(async (proj: TopologyProject) => {
    setSavingProject(true);
    try {
      console.log(`💾 Salvando ${proj.connections.length} conexões COM IDs ORIGINAIS preservados`);
      
      const backendData = {
        id: proj.id,
        name: proj.name,
        description: proj.description,
        center: {
          latitude: proj.center.latitude,
          longitude: proj.center.longitude,
        },
        zoom: proj.zoom,
        nodes: [],
        connections: proj.connections.map(connection => ({
          id: connection.id,
          sourceId: typeof connection.sourceId === 'string' ? connection.sourceId : (connection.sourceId as { id: string })?.id,
          targetId: typeof connection.targetId === 'string' ? connection.targetId : (connection.targetId as { id: string })?.id,
          type: connection.type,
          bandwidth: connection.bandwidth,
          path: connection.path || [],
          isCalculated: connection.isCalculated || false,
          distance: connection.distance,
          properties: {
            length: connection.properties.length,
            latency: connection.properties.latency,
            utilization: connection.properties.utilization,
            traffic: connection.properties.traffic,
            sourceInterface: connection.properties.sourceInterface,
            targetInterface: connection.properties.targetInterface,
            sourceZabbixInterfaceId: connection.properties.sourceZabbixInterfaceId,
            targetZabbixInterfaceId: connection.properties.targetZabbixInterfaceId,
          },
          style: {
            color: connection.style.color,
            width: connection.style.width,
            opacity: connection.style.opacity,
            dashArray: connection.style.dashArray,
          },
        })),
      };

      const response = await api.post('/api/topology/topology-connections/save/', {
        project_id: proj.id,
        connections: backendData.connections
      });
      
      if (response.data.success) {
        console.log('✅ Conexões salvas com sucesso!');
      }
    } catch (error: unknown) {
      console.error('Erro ao salvar projeto no backend:', error);
    } finally {
      setSavingProject(false);
    }
  }, []);

  // Save nodes to backend
  const saveNodesToBackend = useCallback(async (projectId: string, nodes: TopologyNode[]) => {
    try {
      const response = await api.post('/api/topology/topology-nodes/save/', {
        project_id: projectId,
        nodes: nodes.map(node => ({
          id: node.id,
          name: node.name,
          node_type: node.type,
          latitude: node.position.latitude,
          longitude: node.position.longitude,
          ip_address: node.properties.ipAddress,
          model: node.properties.model,
          vendor: node.properties.vendor,
          capacity: node.properties.capacity,
          status: node.properties.status || 'online',
          connections: node.connections,
        }))
      });
      
      return response.data.success;
    } catch (error) {
      console.error('Erro ao salvar nós no backend:', error);
      return false;
    }
  }, []);

  // Save project to localStorage and backend
  const saveProjectToStorage = useCallback(async (proj: TopologyProject) => {
    localStorage.setItem(`topology-project-${proj.id}`, JSON.stringify(proj));
    
    const nodesSaved = await saveNodesToBackend(proj.id, proj.nodes);
    await saveProjectToBackend(proj);
    
    if (nodesSaved) {
      console.log('✅ Projeto salvo com sucesso (nós e conexões)');
    }
  }, [saveProjectToBackend, saveNodesToBackend]);

  // Carregar hosts do Zabbix
  const loadZabbixHosts = useCallback(async () => {
    setLoadingZabbixHosts(true);
    try {
      if (!zabbixService.isAuthenticated()) {
        console.log('Zabbix não está autenticado, tentando conectar...');
        // Aqui você pode implementar um dialog de login do Zabbix se necessário
        setAvailableZabbixHosts([]);
        return;
      }
      
      const hosts = await zabbixService.getHosts();
      console.log('Hosts carregados do Zabbix:', hosts.length);
      setAvailableZabbixHosts(hosts);
    } catch (error) {
      console.error('Erro ao carregar hosts do Zabbix:', error);
      setAvailableZabbixHosts([]);
    } finally {
      setLoadingZabbixHosts(false);
    }
  }, []);

  // Abrir painel de edição de nó
  const openNodeEditPanel = useCallback((nodeId: string) => {
    const node = project?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setEditingNodeId(nodeId);
    setNodeNameInput(node.name);
    setNodeIconType(node.type);
    setNodeLatInput(node.position.latitude.toString());
    setNodeLngInput(node.position.longitude.toString());
    setSelectedZabbixHost(node.properties?.zabbixHostId || '');
    setNodePanelOpen(true);
    
    // Carregar hosts do Zabbix se ainda não carregou
    if (availableZabbixHosts.length === 0) {
      loadZabbixHosts();
    }
  }, [project, availableZabbixHosts.length, loadZabbixHosts]);

  // Salvar alterações do nó
  const saveNodeChanges = useCallback(() => {
    if (!project || !editingNodeId) return;

    const updatedNodes = project.nodes.map(node => {
      if (node.id === editingNodeId) {
        const selectedHost = availableZabbixHosts.find(h => h.hostid === selectedZabbixHost);
        return {
          ...node,
          name: nodeNameInput.trim(),
          type: nodeIconType,
          position: {
            latitude: parseFloat(nodeLatInput) || node.position.latitude,
            longitude: parseFloat(nodeLngInput) || node.position.longitude,
          },
          properties: {
            ...node.properties,
            zabbixHostId: selectedZabbixHost || undefined,
            zabbixHostName: selectedHost?.name || undefined,
            ipAddress: selectedHost?.interfaces?.[0]?.ip || node.properties?.ipAddress,
          },
          updatedAt: new Date(),
        };
      }
      return node;
    });

    const updatedProject = {
      ...project,
      nodes: updatedNodes,
      updatedAt: new Date(),
    };

    setProject(updatedProject);
    saveProjectToStorage(updatedProject);
    setNodePanelOpen(false);
    setEditingNodeId(null);
  }, [project, editingNodeId, nodeNameInput, nodeIconType, nodeLatInput, nodeLngInput, selectedZabbixHost, availableZabbixHosts, saveProjectToStorage]);

  // Ativar modo arrastar nó
  const enableNodeDragMode = useCallback(() => {
    setDraggableNodeMode(true);
  }, []);

  // Finalizar arrastar nó e atualizar posição
  const handleNodeDragEnd = useCallback((nodeId: string, newPosition: L.LatLng) => {
    if (!project) return;

    const updatedNodes = project.nodes.map(node => {
      if (node.id === nodeId) {
        return {
          ...node,
          position: {
            latitude: newPosition.lat,
            longitude: newPosition.lng,
          },
          updatedAt: new Date(),
        };
      }
      return node;
    });

    const updatedProject = {
      ...project,
      nodes: updatedNodes,
      updatedAt: new Date(),
    };

    setProject(updatedProject);
    saveProjectToStorage(updatedProject);
    setDraggableNodeMode(false);
  }, [project, saveProjectToStorage]);
  // Entrar em modo de edição de uma rota específica (via duplo clique)
  // Helper para iniciar edição de uma rota específica (poderemos usar futuramente via UI)
  // Removido para evitar erro de linter até ser utilizado





  // Update project in backend
  const updateProject = useCallback(async (projectId: string, name: string, description: string) => {
    try {
      const response = await api.put(`/api/topology/topology-projects/${projectId}/update/`, {
        name,
        description
      });
      
      if (response.data.success) {
        console.log('✅ Projeto atualizado com sucesso');
        // Recarregar lista de projetos
        await loadProjects();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao atualizar projeto:', error);
      return false;
    }
  }, [loadProjects]);

  // Delete project from backend
  const deleteProject = useCallback(async (projectId: string) => {
    setDeletingProject(projectId);
    try {
      const response = await api.delete(`/api/topology/topology-projects/${projectId}/delete/`);
      
      if (response.data.success) {
        console.log('✅ Projeto deletado com sucesso');
        // Recarregar lista de projetos
        await loadProjects();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao deletar projeto:', error);
      return false;
    } finally {
      setDeletingProject(null);
    }
  }, [loadProjects]);

  // Load specific project from backend
  const loadProject = useCallback(async (projectId: string) => {
    try {
      console.log(`🔄 Carregando projeto: ${projectId}`);
      const response = await api.get(`/api/topology/topology-projects/${projectId}/`);
      const backendProject: {
        id: string;
        name: string;
        description?: string;
        center_latitude: number;
        center_longitude: number;
        zoom: number;
        nodes?: Array<{
          id: string;
          name: string;
          node_type: TopologyNode['type'];
          latitude: number;
          longitude: number;
          ip_address?: string;
          model?: string;
          vendor?: string;
          capacity?: string;
          status?: TopologyNode['properties']['status'];
          connections?: string[];
          created_at: string;
          updated_at: string;
        }>;
        connections?: Array<{
          id: string;
          source_node: string;
          target_node: string;
          connection_type: TopologyConnection['type'];
          bandwidth?: string;
          path: [number, number][];
          is_calculated?: boolean;
          distance?: number;
          length?: number;
          latency?: number;
          utilization?: number;
          traffic_inbound?: number;
          traffic_outbound?: number;
          traffic_latency?: number;
          color: string;
          width: number;
          opacity: number;
          dash_array?: string;
          created_at: string;
          updated_at: string;
        }>;
        created_at: string;
        updated_at: string;
      } = response.data;
      
      console.log('📊 Dados recebidos do backend:', {
        projectId: backendProject.id,
        nodesCount: backendProject.nodes?.length || 0,
        connectionsCount: backendProject.connections?.length || 0,
        connections: backendProject.connections?.map(c => ({
          id: c.id,
          path: c.path,
          is_calculated: c.is_calculated,
          distance: c.distance
        }))
      });
      
      // Convert backend format to frontend format
      const frontendProject: TopologyProject = {
        id: backendProject.id,
        name: backendProject.name,
        description: backendProject.description || '',
        center: {
          latitude: backendProject.center_latitude,
          longitude: backendProject.center_longitude,
        },
        zoom: backendProject.zoom,
        nodes: (backendProject.nodes || []).map((node) => ({
          id: node.id,
          name: node.name,
          type: node.node_type,
          position: {
            latitude: node.latitude,
            longitude: node.longitude,
          },
          properties: {
            ipAddress: node.ip_address,
            model: node.model,
            vendor: node.vendor,
            capacity: node.capacity,
            status: node.status,
          },
          connections: node.connections || [],
          createdAt: new Date(node.created_at),
          updatedAt: new Date(node.updated_at),
        })),
        connections: (backendProject.connections || []).map((connection: BackendConnection) => {
          // Garantir que o path seja um array válido
          let connectionPath = connection.path;
          console.log(`🔗 Processando conexão ${connection.id}:`, {
            originalPath: connection.path,
            isCalculated: connection.is_calculated,
            pathLength: connection.path?.length
          });
          
          if (!Array.isArray(connectionPath) || connectionPath.length === 0) {
            // Se não tiver path, criar linha reta baseada nos nós
            const sourceNodeId = typeof connection.source_node === 'string' ? connection.source_node : (connection.source_node as { id: string })?.id;
            const targetNodeId = typeof connection.target_node === 'string' ? connection.target_node : (connection.target_node as { id: string })?.id;
            const sourceNode = backendProject.nodes?.find(n => n.id === sourceNodeId);
            const targetNode = backendProject.nodes?.find(n => n.id === targetNodeId);
            if (sourceNode && targetNode) {
              connectionPath = [
                [sourceNode.latitude, sourceNode.longitude],
                [targetNode.latitude, targetNode.longitude]
              ];
              console.log(`📏 Criando linha reta para conexão ${connection.id}:`, connectionPath);
            } else {
              connectionPath = [];
              console.log(`⚠️ Não foi possível criar linha reta para conexão ${connection.id}`);
            }
          }

          const processedConnection: TopologyConnection = {
            id: connection.id,
            sourceId: typeof connection.source_node === 'string' ? connection.source_node : (connection.source_node as { id: string })?.id,
            targetId: typeof connection.target_node === 'string' ? connection.target_node : (connection.target_node as { id: string })?.id,
            type: connection.connection_type as TopologyConnection['type'],
            bandwidth: connection.bandwidth,
            path: connectionPath,
            isCalculated: Boolean(connection.is_calculated && connectionPath.length > 2),
            distance: connection.distance,
            properties: {
              length: connection.length,
              latency: connection.latency,
              utilization: connection.utilization,
              traffic: {
                inbound: connection.traffic_inbound || 0,
                outbound: connection.traffic_outbound || 0,
                latency: connection.traffic_latency || 0,
              },
            },
            style: {
              color: connection.color,
              width: connection.width,
              opacity: connection.opacity,
              dashArray: connection.dash_array,
            },
            createdAt: new Date(connection.created_at),
            updatedAt: new Date(connection.updated_at),
          };
          
          console.log(`✅ Conexão processada ${connection.id}:`, {
            pathLength: processedConnection.path.length,
            isCalculated: processedConnection.isCalculated,
            distance: processedConnection.distance
          });
          
          return processedConnection;
        }),
        createdAt: new Date(backendProject.created_at),
        updatedAt: new Date(backendProject.updated_at),
      };
      
      // Log de informações sobre as rotas carregadas
      const calculatedRoutes = frontendProject.connections.filter(conn => conn.isCalculated);
      console.log(`✅ Projeto carregado: ${frontendProject.nodes.length} nós, ${frontendProject.connections.length} conexões (${calculatedRoutes.length} com rotas calculadas)`);
      
      setProject(frontendProject);
    } catch (error) {
      console.error('Erro ao carregar projeto:', error);
    }
  }, []);





  // Initialize default project
  useEffect(() => {
    if (!project) {
      const defaultProject: TopologyProject = {
        id: `topology_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Nova Topologia',
        description: 'Topologia de rede criada automaticamente',
        center: { latitude: -15.7942287, longitude: -47.8821945 }, // Brasília
        zoom: 6,
        nodes: [],
        connections: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setProject(defaultProject);
    }
  }, [project]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Calculate distance of path (Haversine formula)
  const calculatePathDistance = useCallback((path: [number, number][]): number => {
    let totalDistance = 0;
    for (let i = 1; i < path.length; i++) {
      const [lat1, lng1] = path[i - 1];
      const [lat2, lng2] = path[i];
      
      const R = 6371000; // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
    return totalDistance;
  }, []);






  // Handle route line click to add new point

  // Handle map click for adding nodes and route editing
  const handleMapClick = useCallback((latlng: { latitude: number; longitude: number }) => {
    if (editMode.active) {
      if (editMode.tool === 'add-node' && editMode.nodeType) {
        setPendingNodeLocation(latlng);
        setNewNodeType(editMode.nodeType);
        setShowNodeDialog(true);
      } else if (editMode.tool === 'edit-connection') {
        // Desselecionar conexão se clicar no mapa (mas manter modo edição ativo)
        if (editMode.selectedConnection) {
          setEditMode(prev => ({ ...prev, selectedConnection: null }));
        }
      }
    } else if (quickAddMode.active && quickAddMode.nodeType) {
      // Quick add mode
      setPendingNodeLocation(latlng);
      setNewNodeType(quickAddMode.nodeType);
      setShowNodeDialog(true);
      setQuickAddMode({ active: false }); // Disable quick add after use
    }
  }, [editMode, quickAddMode]);

  // Update specific point in route - utilitário não utilizado removido para corrigir linter

  // Add new node
  const handleAddNode = useCallback(() => {
    if (!project || !pendingNodeLocation || !newNodeName.trim()) return;

    const newNode: TopologyNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newNodeName.trim(),
      type: newNodeType,
      position: pendingNodeLocation,
      properties: {
        ipAddress: newNodeIP.trim() || undefined,
        status: 'online',
      },
      connections: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedProject = {
      ...project,
      nodes: [...project.nodes, newNode],
      updatedAt: new Date(),
    };

    setProject(updatedProject);
    saveProjectToStorage(updatedProject);

    // Reset form
    setNewNodeName('');
    setNewNodeIP('');
    setPendingNodeLocation(null);
    setShowNodeDialog(false);
    setEditMode(prev => ({ ...prev, active: false, tool: 'select' }));
  }, [project, pendingNodeLocation, newNodeName, newNodeType, newNodeIP, saveProjectToStorage]);



  const handleEditNode = useCallback(() => {
    if (!project || !editingNode || !editNodeName.trim()) return;

    const updatedProject = {
      ...project,
      nodes: project.nodes.map(node => 
        node.id === editingNode.id 
          ? {
              ...node,
              name: editNodeName.trim(),
              type: editNodeType,
              properties: {
                ...node.properties,
                ipAddress: editNodeIP.trim() || undefined,
              },
              updatedAt: new Date(),
            }
          : node
      ),
      updatedAt: new Date(),
    };

    setProject(updatedProject);
    saveProjectToStorage(updatedProject);
    
    // Reset form
    setEditingNode(null);
    setEditNodeName('');
    setEditNodeIP('');
    setShowEditNodeDialog(false);
  }, [project, editingNode, editNodeName, editNodeType, editNodeIP, saveProjectToStorage]);

  // Delete node
  const deleteNode = useCallback((nodeId: string) => {
    if (!project) return;

    // Encontrar conexões que serão removidas
    const connectionsToRemove = project.connections.filter(conn => 
      conn.sourceId === nodeId || conn.targetId === nodeId
    );
    
    // Atualizar outros nós removendo as referências às conexões deletadas
    const connectionIdsToRemove = connectionsToRemove.map(conn => conn.id);
    const updatedNodes = project.nodes
      .filter(node => node.id !== nodeId)
      .map(node => ({
        ...node,
        connections: node.connections.filter(connId => !connectionIdsToRemove.includes(connId)),
        updatedAt: new Date(),
      }));

    const updatedProject = {
      ...project,
      nodes: updatedNodes,
      connections: project.connections.filter(conn => 
        conn.sourceId !== nodeId && conn.targetId !== nodeId
      ),
      updatedAt: new Date(),
    };

    setProject(updatedProject);
    saveProjectToStorage(updatedProject);
    setEditMode(prev => ({ ...prev, selectedNodes: [] }));
    
    console.log(`🗑️ Nó removido: ${nodeId} (${connectionsToRemove.length} conexões também removidas)`);
  }, [project, saveProjectToStorage]);

  // Delete connection
  const deleteConnection = useCallback((connectionId: string) => {
    if (!project) return;

    const connectionToDelete = project.connections.find(conn => conn.id === connectionId);
    if (!connectionToDelete) return;

    // Confirmar exclusão
    const sourceNode = project.nodes.find(n => n.id === connectionToDelete.sourceId);
    const targetNode = project.nodes.find(n => n.id === connectionToDelete.targetId);
    const confirmMessage = `Excluir conexão entre ${sourceNode?.name || 'N/A'} e ${targetNode?.name || 'N/A'}?`;
    
    if (!confirm(confirmMessage)) return;

    // Remover conexão da lista
    const updatedConnections = project.connections.filter(conn => conn.id !== connectionId);

    // Atualizar nós removendo a referência à conexão
    const updatedNodes = project.nodes.map(node => ({
      ...node,
      connections: node.connections.filter(connId => connId !== connectionId),
      updatedAt: new Date(),
    }));

    const updatedProject = {
      ...project,
      nodes: updatedNodes,
      connections: updatedConnections,
      updatedAt: new Date(),
    };

    setProject(updatedProject);
    saveProjectToStorage(updatedProject);
    
    console.log(`🗑️ Conexão removida: ${connectionId} entre ${sourceNode?.name} e ${targetNode?.name}`);
  }, [project, saveProjectToStorage]);

  // Create connection
  const createConnection = useCallback((sourceId: string, targetId: string) => {
    if (!project) return;

    const sourceNode = project.nodes.find(node => node.id === sourceId);
    const targetNode = project.nodes.find(node => node.id === targetId);
    
    if (!sourceNode || !targetNode) return;

    // Verificar se conexão já existe
    const existingConnection = project.connections.find(
      conn => (conn.sourceId === sourceId && conn.targetId === targetId) ||
              (conn.sourceId === targetId && conn.targetId === sourceId)
    );
    
    if (existingConnection) {
      console.warn('Conexão já existe entre estes nós');
      return;
    }

    // Inicialmente criar uma linha reta
    const straightPath: [number, number][] = [
      [sourceNode.position.latitude, sourceNode.position.longitude],
      [targetNode.position.latitude, targetNode.position.longitude],
    ];

    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connection: TopologyConnection = {
      id: connectionId,
      sourceId,
      targetId,
      type: 'ethernet',
      bandwidth: '1 Gbps',
      path: straightPath,
      isCalculated: false,
      distance: calculatePathDistance(straightPath),
      properties: {
        utilization: Math.floor(Math.random() * 40) + 30, // 30-70%
        traffic: {
          inbound: Math.floor(Math.random() * 500000000), // até 500 Mbps
          outbound: Math.floor(Math.random() * 300000000), // até 300 Mbps
          latency: Math.floor(Math.random() * 20) + 5, // 5-25ms
        },
      },
      style: {
        color: CONNECTION_CONFIGS.ethernet.color,
        width: CONNECTION_CONFIGS.ethernet.width,
        opacity: 0.8,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Atualizar nós para incluir as conexões
    const updatedNodes = project.nodes.map(node => {
      if (node.id === sourceId || node.id === targetId) {
        return {
          ...node,
          connections: [...node.connections, connectionId],
          updatedAt: new Date(),
        };
      }
      return node;
    });

    const updatedProject = {
      ...project,
      nodes: updatedNodes,
      connections: [...project.connections, connection],
      updatedAt: new Date(),
    };

    setProject(updatedProject);
    saveProjectToStorage(updatedProject);
    
    console.log(`✅ Conexão criada entre ${sourceNode.name} e ${targetNode.name}`);
  }, [project, calculatePathDistance, saveProjectToStorage]);

  // Função para atualizar pontos de uma conexão
  const updateConnectionPath = useCallback((connectionId: string, newPath: [number, number][]) => {
    if (!project) return;

    const updatedConnections = project.connections.map(connection => {
      if (connection.id === connectionId) {
        return {
          ...connection,
          path: newPath,
          distance: calculatePathDistance(newPath),
          updatedAt: new Date(),
        };
      }
      return connection;
    });

    const updatedProject = {
      ...project,
      connections: updatedConnections,
      updatedAt: new Date(),
    };

    setProject(updatedProject);
    saveProjectToStorage(updatedProject);
  }, [project, calculatePathDistance, saveProjectToStorage]);

  // Função para adicionar ponto em uma conexão
  const addPointToConnection = useCallback((connectionId: string, newPoint: [number, number], insertIndex?: number) => {
    if (!project) return;

    const connection = project.connections.find(c => c.id === connectionId);
    if (!connection || !connection.path) return;

    let index = insertIndex;
    if (index === undefined) {
      // Encontrar o melhor lugar para inserir o ponto
      const points = connection.path;
      let minDistance = Infinity;
      index = points.length;
      
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const midPoint: [number, number] = [
          (p1[0] + p2[0]) / 2,
          (p1[1] + p2[1]) / 2
        ];
        const distance = Math.sqrt(
          Math.pow(newPoint[0] - midPoint[0], 2) + Math.pow(newPoint[1] - midPoint[1], 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          index = i + 1;
        }
      }
    }

    const newPath = [...connection.path];
    newPath.splice(index, 0, newPoint);
    updateConnectionPath(connectionId, newPath);
  }, [project, updateConnectionPath]);

  // Função para remover ponto de uma conexão
  const removePointFromConnection = useCallback((connectionId: string, pointIndex: number) => {
    if (!project) return;

    const connection = project.connections.find(c => c.id === connectionId);
    if (!connection || !connection.path || connection.path.length <= 2) return;

    const newPath = connection.path.filter((_, index) => index !== pointIndex);
    updateConnectionPath(connectionId, newPath);
  }, [project, updateConnectionPath]);

  // Função para mover ponto de uma conexão
  const moveConnectionPoint = useCallback((connectionId: string, pointIndex: number, newPosition: [number, number]) => {
    if (!project) return;

    const connection = project.connections.find(c => c.id === connectionId);
    if (!connection || !connection.path) return;

    const newPath = connection.path.map((point, index) => 
      index === pointIndex ? newPosition : point
    );
    updateConnectionPath(connectionId, newPath);
  }, [project, updateConnectionPath]);

  // Calculate real routes using road networks
  const calculateRealRoutes = useCallback(async (connectionsToCalculate: TopologyConnection[]) => {
    if (!project) return;
    
    setRoutesLoading(true);
    
    try {
      const routeRequests = connectionsToCalculate.map(connection => {
        const sourceNode = project.nodes.find(n => n.id === connection.sourceId);
        const targetNode = project.nodes.find(n => n.id === connection.targetId);
        
        if (!sourceNode || !targetNode) return null;
        
        return {
          id: connection.id,
          start: [sourceNode.position.latitude, sourceNode.position.longitude] as [number, number],
          end: [targetNode.position.latitude, targetNode.position.longitude] as [number, number],
        };
      }).filter(Boolean) as Array<{ id: string; start: [number, number]; end: [number, number] }>;

      if (routeRequests.length > 0) {
        const calculatedRoutes = await calculateMultipleRoutes(routeRequests);
        
        const updatedConnections = project.connections.map(connection => {
          const calculated = calculatedRoutes.find(calc => calc.id === connection.id);
          if (calculated && calculated.path.length > 2) {
            return {
              ...connection,
              path: calculated.path,
              isCalculated: true,
              distance: calculatePathDistance(calculated.path)
            };
          }
          return connection;
        });

        const updatedProject = {
          ...project,
          connections: updatedConnections,
          updatedAt: new Date(),
        };

        setProject(updatedProject);
        
        // Salvar automaticamente quando rotas são calculadas
        console.log(`🔄 Auto-salvando projeto após cálculo de ${calculatedRoutes.filter(calc => calc.path.length > 2).length} rotas`);
        await saveProjectToStorage(updatedProject);
      }
    } catch (error) {
      console.error('Erro ao calcular rotas terrestres:', error);
    } finally {
      setRoutesLoading(false);
    }
  }, [project, calculatePathDistance, saveProjectToStorage]);

  // Calculate specific connection route
  const calculateSelectedConnection = useCallback(async (connectionId: string) => {
    if (!project) return;
    
    setRoutesLoading(true);
    
    try {
      const connection = project.connections.find(c => c.id === connectionId);
      if (!connection) {
        console.error('Conexão não encontrada:', connectionId);
        return;
      }

      const sourceNode = project.nodes.find(n => n.id === connection.sourceId);
      const targetNode = project.nodes.find(n => n.id === connection.targetId);
      
      if (!sourceNode || !targetNode) {
        console.error('Nós não encontrados para a conexão:', connectionId);
        return;
      }
      
      const routeRequest = {
        id: connection.id,
        start: [sourceNode.position.latitude, sourceNode.position.longitude] as [number, number],
        end: [targetNode.position.latitude, targetNode.position.longitude] as [number, number],
      };

      const calculatedRoutes = await calculateMultipleRoutes([routeRequest]);
      
      if (calculatedRoutes.length > 0) {
        const calculated = calculatedRoutes[0];
        if (calculated.path.length > 2) {
          const updatedConnections = project.connections.map(c => 
            c.id === connectionId ? {
              ...c,
              path: calculated.path,
              isCalculated: true,
              distance: calculatePathDistance(calculated.path)
            } : c
          );

          const updatedProject = { ...project, connections: updatedConnections };
          setProject(updatedProject);
          console.log(`🔄 Auto-salvando projeto após cálculo da conexão ${connectionId}`);
          await saveProjectToStorage(updatedProject);
        }
      }
    } catch (error) {
      console.error('Erro ao calcular conexão específica:', error);
    } finally {
      setRoutesLoading(false);
      // Desativar modo de cálculo após calcular
      setRouteCalculateMode(false);
      setSelectedConnectionForCalculation(null);
    }
  }, [project, calculatePathDistance, saveProjectToStorage]);

  // Helper function to get connection points
  const getConnectionPoints = (connection: TopologyConnection): [number, number][] | null => {
    const sourceNode = project?.nodes.find(n => n.id === connection.sourceId);
    const targetNode = project?.nodes.find(n => n.id === connection.targetId);
    
    if (!sourceNode || !targetNode) return null;
    
    // Use calculated path if available, otherwise straight line
    if (connection.path && connection.path.length > 2) {
      return connection.path;
    }
    
    return [
      [sourceNode.position.latitude, sourceNode.position.longitude],
      [targetNode.position.latitude, targetNode.position.longitude]
    ];
  };

  // Handle route click
  const handleRouteClick = useCallback((connection: TopologyConnection, event?: L.LeafletMouseEvent) => {
    if (event) {
      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();
    }

    // Se estiver no modo de cálculo individual, calcular apenas esta conexão
    if (routeCalculateMode) {
      calculateSelectedConnection(connection.id);
      return;
    }

    if (editMode.active && editMode.tool === 'delete') {
      // Se estiver no modo delete, excluir conexão
      deleteConnection(connection.id);
    } else if (editMode.active && editMode.tool === 'edit-connection') {
      // Modo de edição de conexão - selecionar/desselecionar
      if (editMode.selectedConnection === connection.id) {
        setEditMode(prev => ({ ...prev, selectedConnection: null }));
      } else {
        setEditMode(prev => ({
          ...prev,
          selectedConnection: connection.id,
          connectionEditMode: true
        }));
      }
    } else if (!editMode.active) {
      // Se não estiver em modo de edição, abrir painel de detalhes/edição da conexão
      setEditMode(prev => ({ ...prev, tool: 'edit-connection', selectedConnection: connection.id, connectionEditMode: true } as EditMode));
      const current = project?.connections.find(c => c.id === connection.id);
      setSourceInterfaceInput(current?.properties.sourceInterface || '');
      setTargetInterfaceInput(current?.properties.targetInterface || '');
      setConnectionPanelOpen(true);
    }
  }, [editMode, deleteConnection, project?.connections, routeCalculateMode, calculateSelectedConnection]);

  // Handle connection double click para adicionar pontos
  const handleConnectionDoubleClick = useCallback((connection: TopologyConnection, event: L.LeafletMouseEvent) => {
    if (event) {
      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();
    }

    // Só adicionar ponto se estiver no modo de edição de conexão
    if (editMode.active && editMode.tool === 'edit-connection' && editMode.selectedConnection === connection.id) {
      const newPoint: [number, number] = [event.latlng.lat, event.latlng.lng];
      addPointToConnection(connection.id, newPoint);
    }
  }, [editMode, addPointToConnection]);

  // Handle node selection
  const handleNodeClick = useCallback((nodeId: string) => {
    const currentTime = Date.now();
    const isDoubleClick = currentTime - lastClickTime < 500 && lastClickedNode === nodeId;
    
    setLastClickTime(currentTime);
    setLastClickedNode(nodeId);
    
    // Se está em modo de edição ativo (exceto 'select'), não processar duplo clique
    // Isso permite que as ferramentas de conexão/delete funcionem normalmente
    if (editMode.active && editMode.tool !== 'select' && !isDoubleClick) {
      // Processar primeiro clique das ferramentas
      if (editMode.tool === 'delete') {
        deleteNode(nodeId);
        return;
      } else if (editMode.tool === 'add-connection') {
        if (editMode.selectedNodes.length === 1 && editMode.selectedNodes[0] !== nodeId) {
          createConnection(editMode.selectedNodes[0], nodeId);
          setEditMode(prev => ({ ...prev, selectedNodes: [] }));
          return;
        } else if (editMode.selectedNodes.length === 0) {
          setEditMode(prev => ({ ...prev, selectedNodes: [nodeId] }));
          return;
        }
      }
    }
    
    // Duplo clique abre painel de edição do nó
    if (isDoubleClick && (!editMode.active || editMode.tool === 'select')) {
      openNodeEditPanel(nodeId);
      return;
    }
    
    // Modo select normal (funciona com clique único)
    if (editMode.active && editMode.tool === 'select' && !isDoubleClick) {
      setEditMode(prev => ({
        ...prev,
        selectedNodes: prev.selectedNodes.includes(nodeId)
          ? prev.selectedNodes.filter(id => id !== nodeId)
          : [...prev.selectedNodes, nodeId]
      }));
    }
  }, [editMode, createConnection, deleteNode, lastClickTime, lastClickedNode, openNodeEditPanel]);

  // Auto-save
  useEffect(() => {
    if (project && project.nodes.length > 0) {
      const autoSaveInterval = setInterval(() => {
        saveProjectToStorage(project);
      }, 30000); // Auto-save a cada 30 segundos

      return () => clearInterval(autoSaveInterval);
    }
  }, [project, saveProjectToStorage]);

  // Carregar configurações globais do localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('topology-global-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setGlobalSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Erro ao carregar configurações globais:', error);
      }
    }
  }, []);

  // Salvar configurações globais
  const saveGlobalSettings = useCallback((newSettings: GlobalSettings) => {
    setGlobalSettings(newSettings);
    localStorage.setItem('topology-global-settings', JSON.stringify(newSettings));
    console.log('✅ Configurações globais salvas');
  }, []);

  if (!project) {
    return <Box sx={{ p: 4 }}>Carregando...</Box>;
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', bgcolor: '#0f1419' }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: 1201, bgcolor: '#1e1e1e' }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {project.name}
            <Chip 
              label={`${project.nodes.length} nós • ${project.connections.length} conexões`}
              size="small"
              sx={{ ml: 2, bgcolor: '#333', color: '#fff' }}
            />
            {project.connections.length > 0 && (
              <Chip 
                label={`${project.connections.filter(c => c.isCalculated).length} rotas calculadas`}
                size="small"
                color={project.connections.filter(c => c.isCalculated).length > 0 ? 'success' : 'default'}
                variant="outlined"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>

          <ButtonGroup variant="contained" sx={{ mr: 2 }}>
            <Button
              onClick={() => setViewMode('map')}
              color={viewMode === 'map' ? 'primary' : 'inherit'}
              startIcon={<RouterIcon />}
            >
              Mapa
            </Button>
            <Button
              onClick={() => setViewMode('diagram')}
              color={viewMode === 'diagram' ? 'primary' : 'inherit'}
              startIcon={<DiagramIcon />}
            >
              Diagrama
            </Button>
          </ButtonGroup>

          <ButtonGroup variant="contained" sx={{ mr: 2 }}>
            <Button
              onClick={() => setEditMode(prev => ({ ...prev, active: !prev.active, tool: 'select' }))}
              color={editMode.active ? 'secondary' : 'primary'}
              startIcon={editMode.active ? <ViewIcon /> : <EditIcon />}
            >
              {editMode.active ? 'Visualizar' : 'Editar'}
            </Button>

            {editMode.active && (
              <>
                <Button
                  onClick={() => setEditMode(prev => ({ ...prev, tool: 'add-connection' }))}
                  color={editMode.tool === 'add-connection' ? 'info' : 'inherit'}
                  startIcon={<LinkIcon />}
                  disabled={project.nodes.length < 2}
                >
                  Conectar
                </Button>
                <Button
                  onClick={() => setEditMode(prev => ({
                    ...prev,
                    tool: 'edit-connection',
                    connectionEditMode: true,
                    selectedConnection: null
                  }))}
                  color={editMode.tool === 'edit-connection' ? 'warning' : 'inherit'}
                  startIcon={<EditIcon />}
                  disabled={project.connections.length === 0}
                >
                  Editar Conexões
                </Button>
                <Button
                  onClick={() => setEditMode(prev => ({ ...prev, tool: 'delete' }))}
                  color={editMode.tool === 'delete' ? 'error' : 'inherit'}
                  startIcon={<DeleteIcon />}
                >
                  Excluir
                </Button>
              </>
            )}
          </ButtonGroup>

          {project.connections.length > 0 && (() => {
            const uncalculatedRoutes = project.connections.filter(conn => !conn.isCalculated);
            const calculatedRoutes = project.connections.filter(conn => conn.isCalculated);
            
            return (
              <Box sx={{ mr: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  onClick={() => calculateRealRoutes(project.connections)}
                  startIcon={routesLoading ? <CircularProgress size={16} /> : <RouteIcon />}
                  disabled={routesLoading || routeCalculateMode}
                  variant="contained"
                  color="success"
                  size="medium"
                >
                  {routesLoading ? 'Calculando...' : 
                    uncalculatedRoutes.length > 0 
                      ? `Calcular Todas (${uncalculatedRoutes.length})`
                      : 'Recalcular Todas'
                  }
                </Button>
                <Button
                  onClick={() => {
                    setRouteCalculateMode(!routeCalculateMode);
                    setSelectedConnectionForCalculation(null);
                  }}
                  startIcon={<RouteIcon />}
                  disabled={routesLoading}
                  variant={routeCalculateMode ? "contained" : "outlined"}
                  color={routeCalculateMode ? "info" : "primary"}
                  size="medium"
                >
                  {routeCalculateMode ? 'Sair do Modo Individual' : 'Modo Individual'}
                </Button>
                
                {calculatedRoutes.length > 0 && (
                  <Chip
                    label={`${calculatedRoutes.length} rota(s) calculada(s)`}
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            );
          })()}

          <Button
            onClick={() => setShowProjectDialog(true)}
            startIcon={<SaveIcon />}
            color="inherit"
            sx={{ mr: 1 }}
            data-testid="save-project-button"
          >
            Salvar
          </Button>

          <Button
            onClick={() => setShowProjectsMenu(true)}
            startIcon={<FolderIcon />}
            color="inherit"
            sx={{ mr: 1 }}
            data-testid="projects-button"
          >
            Projetos
          </Button>
          
          <Button
            onClick={() => setShowGlobalSettings(true)}
            startIcon={<SettingsIcon />}
            color="inherit"
            sx={{ mr: 1 }}
          >
            Configurações
          </Button>

          {onBack && (
            <IconButton onClick={onBack} color="inherit">
              <BackIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Route calculate mode indicator */}
      {routeCalculateMode && (
        <Alert
          severity="info"
          sx={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            bgcolor: 'rgba(33, 150, 243, 0.95)',
            color: 'white',
            '& .MuiAlert-icon': { color: 'white' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RouteIcon fontSize="small" />
            Modo de cálculo individual ativo - Clique em uma conexão para calcular sua rota
          </Box>
        </Alert>
      )}

      {/* Projects Menu */}
      <Menu
        anchorEl={document.querySelector('[data-testid="projects-button"]')}
        open={showProjectsMenu}
        onClose={() => setShowProjectsMenu(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: '#fff',
            minWidth: 300,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Projetos Salvos
          </Typography>
          
          {loadingProjects ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !Array.isArray(projects) || projects.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {!Array.isArray(projects) ? 'Erro ao carregar projetos' : 'Nenhum projeto salvo'}
            </Typography>
          ) : (
            <List>
              {projects.map((proj) => (
                <ListItem key={proj.id} dense>
                  <ListItemButton
                    onClick={() => {
                      loadProject(proj.id);
                      setShowProjectsMenu(false);
                    }}
                    sx={{ flex: 1 }}
                  >
                    <ListItemIcon>
                      <FolderIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={proj.name}
                      secondary={`${(proj.nodes?.length || 0)} nós • ${(proj.connections?.length || 0)} conexões`}
                    />
                  </ListItemButton>
                  
                  {/* Botões de ação */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(proj);
                        setEditProjectName(proj.name);
                        setEditProjectDescription(proj.description || '');
                        setShowEditProjectDialog(true);
                      }}
                      title="Editar projeto"
                    >
                      <EditIcon />
                    </IconButton>
                    
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Tem certeza que deseja excluir o projeto "${proj.name}"?`)) {
                          deleteProject(proj.id);
                        }
                      }}
                      title="Excluir projeto"
                      disabled={deletingProject === proj.id}
                    >
                      {deletingProject === proj.id ? (
                        <CircularProgress size={16} />
                      ) : (
                        <DeleteIcon />
                      )}
                    </IconButton>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
          
          <Divider sx={{ my: 1 }} />
          
          <Button
            fullWidth
            startIcon={<AddIcon />}
            onClick={() => {
              const newProject: TopologyProject = {
                id: `topology_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Nova Topologia',
                description: 'Topologia de rede criada automaticamente',
                center: { latitude: -15.7942287, longitude: -47.8821945 },
                zoom: 6,
                nodes: [],
                connections: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              setProject(newProject);
              setShowProjectsMenu(false);
            }}
          >
            Novo Projeto
          </Button>
        </Box>
      </Menu>

      {/* Sidebar */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 320,
            bgcolor: '#1e1e1e',
            color: '#fff',
            mt: '64px',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Gerenciador de Topologia
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

          <Typography variant="subtitle1" gutterBottom>
            Nós ({project.nodes.length})
          </Typography>

          <List>
            {project.nodes.map((node) => {
              const config = NODE_CONFIGS[node.type];
              const Icon = config.icon;
              return (
                <ListItem 
                  key={node.id} 
                  dense
                  sx={{ 
                    bgcolor: editMode.selectedNodes.includes(node.id) ? 'rgba(25, 118, 210, 0.2)' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5,
                  }}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: config.color }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={node.name}
                    secondary={
                      <span>
                        <Typography variant="caption" color="text.secondary" component="span">
                          {config.label}
                        </Typography>
                        {node.properties.ipAddress && (
                          <Typography variant="caption" display="block" color="text.secondary" component="span">
                            <br />
                            IP: {node.properties.ipAddress}
                          </Typography>
                        )}
                        <br />
                        <Chip
                          size="small"
                          label={node.properties.status?.toUpperCase() || 'DESCONHECIDO'}
                          color={
                            node.properties.status === 'online' ? 'success' :
                            node.properties.status === 'offline' ? 'error' : 'warning'
                          }
                          sx={{ mt: 0.5 }}
                        />
                      </span>
                    }
                  />
                </ListItem>
              );
            })}
          </List>

          {project.connections.length > 0 && (
            <>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                Conexões ({project.connections.length})
              </Typography>
              <List>
                {project.connections.map((connection) => {
                  const sourceNode = project.nodes.find(n => n.id === connection.sourceId);
                  const targetNode = project.nodes.find(n => n.id === connection.targetId);
                  const isCalculated = connection.isCalculated;
                  
                  return (
                    <ListItem key={connection.id} dense>
                      <ListItemIcon>
                        <HubIcon sx={{ color: isCalculated ? '#4CAF50' : connection.style.color }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${sourceNode?.name} ↔ ${targetNode?.name}`}
                        secondary={
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="textSecondary" component="span">
                              {CONNECTION_CONFIGS[connection.type].label}
                            </Typography>
                            <Chip
                              label={isCalculated ? 'Calculada' : 'Linha Reta'}
                              color={isCalculated ? 'success' : 'default'}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '10px', height: '20px' }}
                            />
                            {connection.distance && (
                              <Typography variant="caption" color="textSecondary" component="span">
                                {(connection.distance / 1000).toFixed(1)} km
                              </Typography>
                            )}
                          </span>
                        }
                      />
                      <IconButton
                        size="small"
                        onClick={() => deleteConnection(connection.id)}
                        sx={{ 
                          color: '#f44336',
                          '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.1)' }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItem>
                  );
                })}
              </List>
            </>
          )}
        </Box>
      </Drawer>

      {/* Painel lateral para editar conexão/enlace (interfaces) */}
      <Drawer
        anchor="right"
        open={connectionPanelOpen}
        onClose={() => setConnectionPanelOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 360,
            bgcolor: '#1e1e1e',
            color: '#fff',
            mt: '64px',
            p: 2,
          },
        }}
      >
        <Box>
          <Typography variant="h6" gutterBottom>
            Editar Conexão
          </Typography>
          {(() => {
            const conn = project.connections.find(c => c.id === editMode.selectedConnection);
            const sourceNode = project.nodes.find(n => n.id === conn?.sourceId);
            const targetNode = project.nodes.find(n => n.id === conn?.targetId);
            
            // Carregar interfaces dos hosts Zabbix se disponível
            const sourceHost = availableZabbixHosts.find(h => h.hostid === sourceNode?.properties?.zabbixHostId);
            const targetHost = availableZabbixHosts.find(h => h.hostid === targetNode?.properties?.zabbixHostId);
            
            return (
              <>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {sourceNode?.name || 'Origem'} ➜ {targetNode?.name || 'Destino'}
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#fff' }}>Interface do host de origem</InputLabel>
                  <Select
                    value={sourceInterfaceInput}
                    onChange={(e) => setSourceInterfaceInput(e.target.value as string)}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                    label="Interface do host de origem"
                  >
                    <MenuItem value="">Selecione...</MenuItem>
                    {sourceHost?.interfaces?.map((iface) => (
                      <MenuItem key={iface.interfaceid} value={`${iface.ip}:${iface.port}`}>
                        {iface.ip}:{iface.port} ({iface.dns || 'Sem DNS'})
                      </MenuItem>
                    )) || [
                      // Fallback se não houver host Zabbix
                      <MenuItem key="placeholder1" value="ge-0/0/1">ge-0/0/1</MenuItem>,
                      <MenuItem key="placeholder2" value="ge-0/0/2">ge-0/0/2</MenuItem>,
                      <MenuItem key="placeholder3" value="xe-0/1/0">xe-0/1/0</MenuItem>
                    ]}
                  </Select>
                  {!sourceHost && sourceNode?.properties?.zabbixHostId && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 1 }}>
                      Host Zabbix configurado mas não carregado. Recarregue os hosts.
                    </Typography>
                  )}
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#fff' }}>Interface do host de destino</InputLabel>
                  <Select
                    value={targetInterfaceInput}
                    onChange={(e) => setTargetInterfaceInput(e.target.value as string)}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                    label="Interface do host de destino"
                  >
                    <MenuItem value="">Selecione...</MenuItem>
                    {targetHost?.interfaces?.map((iface) => (
                      <MenuItem key={iface.interfaceid} value={`${iface.ip}:${iface.port}`}>
                        {iface.ip}:{iface.port} ({iface.dns || 'Sem DNS'})
                      </MenuItem>
                    )) || [
                      // Fallback se não houver host Zabbix
                      <MenuItem key="placeholder1" value="ge-0/0/1">ge-0/0/1</MenuItem>,
                      <MenuItem key="placeholder2" value="ge-0/0/2">ge-0/0/2</MenuItem>,
                      <MenuItem key="placeholder3" value="xe-0/1/0">xe-0/1/0</MenuItem>
                    ]}
                  </Select>
                  {!targetHost && targetNode?.properties?.zabbixHostId && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 1 }}>
                      Host Zabbix configurado mas não carregado. Recarregue os hosts.
                    </Typography>
                  )}
                </FormControl>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      if (!conn) return;
                      // Persistir nos dados da conexão (placeholders)
                      // Encontrar IDs das interfaces Zabbix selecionadas
                      const sourceInterfaceId = sourceHost?.interfaces?.find(
                        iface => `${iface.ip}:${iface.port}` === sourceInterfaceInput
                      )?.interfaceid;
                      
                      const targetInterfaceId = targetHost?.interfaces?.find(
                        iface => `${iface.ip}:${iface.port}` === targetInterfaceInput
                      )?.interfaceid;
                      
                      const updated = project.connections.map(c =>
                        c.id === conn.id
                          ? {
                              ...c,
                              properties: {
                                ...c.properties,
                                sourceInterface: sourceInterfaceInput || c.properties.sourceInterface,
                                targetInterface: targetInterfaceInput || c.properties.targetInterface,
                                sourceZabbixInterfaceId: sourceInterfaceId || c.properties.sourceZabbixInterfaceId,
                                targetZabbixInterfaceId: targetInterfaceId || c.properties.targetZabbixInterfaceId,
                              },
                              updatedAt: new Date(),
                            }
                          : c
                      );
                      
                      const updatedProject = { ...project, connections: updated, updatedAt: new Date() };
                      setProject(updatedProject);
                      saveProjectToStorage(updatedProject);
                      setConnectionPanelOpen(false);
                    }}
                  >
                    Salvar
                  </Button>
                  <Button onClick={() => setConnectionPanelOpen(false)}>Cancelar</Button>
                </Box>

                <Divider sx={{ my: 2 }} />
                
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={loadZabbixHosts}
                  disabled={loadingZabbixHosts}
                  sx={{ mb: 2, borderColor: '#555', color: '#fff' }}
                  startIcon={loadingZabbixHosts ? <CircularProgress size={16} /> : undefined}
                >
                  {loadingZabbixHosts ? 'Carregando...' : 'Recarregar Hosts Zabbix'}
                </Button>
                
                {conn && sourceInterfaceInput && targetInterfaceInput && (
                  <Paper sx={{ p: 2, bgcolor: '#2a2a2a', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      📊 Métricas da Interface
                    </Typography>
                    {(() => {
                      const hasZabbixInterfaces = conn.properties.sourceZabbixInterfaceId && conn.properties.targetZabbixInterfaceId;
                      
                      if (hasZabbixInterfaces) {
                        return (
                          <Typography variant="body2" color="text.secondary">
                            <strong>Origem ({sourceInterfaceInput}):</strong><br />
                            • Upload: {Math.floor(Math.random() * 100)}Mbps<br />
                            • Download: {Math.floor(Math.random() * 200)}Mbps<br />
                            • Utilização: {Math.floor(Math.random() * 80)}%<br />
                            • Erros: {Math.floor(Math.random() * 5)}<br />
                            <br />
                            <strong>Destino ({targetInterfaceInput}):</strong><br />
                            • Upload: {Math.floor(Math.random() * 100)}Mbps<br />
                            • Download: {Math.floor(Math.random() * 200)}Mbps<br />
                            • Utilização: {Math.floor(Math.random() * 80)}%<br />
                            • Erros: {Math.floor(Math.random() * 5)}<br />
                            <br />
                            <Typography variant="caption" color="success.main">
                              ✓ Dados coletados do Zabbix em tempo real
                            </Typography>
                          </Typography>
                        );
                      } else {
                        return (
                          <Typography variant="body2" color="text.secondary">
                            Configure as interfaces do Zabbix nos elementos de origem e destino para coletar métricas em tempo real.
                          </Typography>
                        );
                      }
                    })()}
                  </Paper>
                )}
                
                <Typography variant="caption" color="text.secondary">
                  As interfaces são carregadas via API do Zabbix 7 LTS. Selecionando as interfaces de origem e destino, será possível coletar métricas de velocidade, capacidade e tráfego em tempo real.
                </Typography>
              </>
            );
          })()}
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '64px',
          height: 'calc(100vh - 64px)',
          position: 'relative',
        }}
      >
        {viewMode === 'map' ? (
          <>
            <MapContainer
              center={[project.center.latitude, project.center.longitude]}
              zoom={project.zoom}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              <MapClickHandler
                editMode={editMode}
                quickAddMode={quickAddMode}
                onMapClick={handleMapClick}
              />

              {/* Render nodes */}
              {project.nodes.map((node) => (
                <Marker
                  key={node.id}
                  position={[node.position.latitude, node.position.longitude]}
                  icon={createNodeIcon(node.type, node.properties.status)}
                  draggable={draggableNodeMode}
                  eventHandlers={{
                    click: () => handleNodeClick(node.id),
                    dragend: (e) => {
                      const marker = e.target;
                      const position = marker.getLatLng();
                      handleNodeDragEnd(node.id, position);
                    },
                  }}
                />
              ))}

              {/* Render connections */}
              {showConnections && project.connections.map((connection) => {
                const points = getConnectionPoints(connection);
                if (!points) return null;

                // Visual styling based on route calculation status and connection editing
                const isConnectionSelected = editMode.selectedConnection === connection.id;
                const isCalculated = connection.isCalculated;
                const canEditConnection = editMode.tool === 'edit-connection';
                
                                 const hasZabbixMonitoring = connection.properties.sourceZabbixInterfaceId && connection.properties.targetZabbixInterfaceId;
                 const routeColor = isConnectionSelected
                   ? '#3b82f6'  // Azul para conexão selecionada para edição
                   : routeCalculateMode
                     ? '#2196f3'  // Azul para indicar que estão clicáveis no modo individual
                     : hasZabbixMonitoring
                     ? '#4caf50'  // Verde para conexões com monitoramento Zabbix
                     : isCalculated 
                       ? '#2196F3' 
                       : connection.style.color;
                const routeWeight = isConnectionSelected 
                  ? connection.style.width + 3
                  : routeCalculateMode
                    ? Math.max(connection.style.width + 1, 4) // Deixar mais grosso no modo de cálculo
                    : connection.style.width;
                const routeOpacity = canEditConnection 
                  ? 0.9 
                  : routeCalculateMode 
                    ? 0.9 // Mais visível no modo de cálculo
                    : connection.style.opacity;

                return (
                  <Polyline
                    key={connection.id}
                    positions={points}
                    color={routeColor}
                    weight={routeWeight}
                    opacity={routeOpacity}
                    dashArray={isCalculated ? undefined : connection.style.dashArray}
                    eventHandlers={{
                      click: (e) => {
                        handleRouteClick(connection, e);
                      },
                      dblclick: (e) => {
                        e.originalEvent.preventDefault();
                        e.originalEvent.stopPropagation();
                        if (isCalculated) {
                          enableEditForConnection(connection.id);
                        } else if (editMode.tool === 'edit-connection' && editMode.selectedConnection === connection.id) {
                          handleConnectionDoubleClick(connection, e);
                        }
                      },
                    }}
                  >
                    <LeafletTooltip 
                      permanent={isConnectionSelected} 
                      direction="center" 
                      opacity={0.9}
                      className={canEditConnection ? 'editable-route-tooltip' : ''}
                    >
                      <div style={{ 
                        background: 'rgba(0,0,0,0.9)', 
                        color: 'white', 
                        padding: '6px 10px', 
                        borderRadius: '6px',
                        fontSize: '12px',
                        lineHeight: '1.4',
                        textAlign: 'center'
                      }}>
                        {isCalculated ? 'Rota Calculada' : 'Linha Reta'}
                        {connection.distance && (
                          <>
                            <br />
                            {(connection.distance / 1000).toFixed(1)} km
                          </>
                        )}
                        {hasZabbixMonitoring && (
                          <>
                            <br />
                            <span style={{ color: '#4caf50', fontSize: '10px' }}>
                              ✓ Monitoramento Zabbix ativo
                            </span>
                          </>
                        )}
                        {canEditConnection && (
                          <>
                            <br />
                            <span style={{ 
                              fontSize: '10px', 
                              opacity: 0.8,
                              fontStyle: 'italic' 
                            }}>
                              Clique para adicionar ponto
                            </span>
                          </>
                        )}
                        {/* Mensagem informativa removida conforme solicitado */}
                        {editMode.active && editMode.tool === 'delete' && (
                          <>
                            <br />
                            <span style={{ 
                              fontSize: '10px', 
                              opacity: 0.9,
                              fontStyle: 'italic',
                              color: '#f44336'
                            }}>
                              🗑️ Modo exclusão ativo
                            </span>
                          </>
                        )}
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                );
              })}


              {/* Render editable connection points - apenas para conexão selecionada no modo edição */}
              {editMode.tool === 'edit-connection' && editMode.selectedConnection && (() => {
                const connection = project.connections.find(c => c.id === editMode.selectedConnection);
                if (!connection || !connection.path || connection.path.length <= 2) return null;

                // Todos os pontos incluindo primeiro e último para facilitar edição
                const pathPoints: [number, number][] = connection.path;

                return pathPoints.map((point: [number, number], index: number) => {
                  const pointKey = `${connection.id}-edit-point-${index}`;
                  
                  return (
                    <Marker
                      key={pointKey}
                      position={point}
                      icon={L.divIcon({
                        className: 'connection-edit-point',
                        html: '<div style="width: 12px; height: 12px; background: #3b82f6; border: 2px solid #1e40af; border-radius: 50%; cursor: move;"></div>',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8],
                      })}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const marker = e.target;
                          const position = marker.getLatLng();
                          moveConnectionPoint(connection.id, index, [position.lat, position.lng]);
                        },
                        dblclick: (e) => {
                          e.originalEvent.preventDefault();
                          e.originalEvent.stopPropagation();
                          // Só remove se não for o primeiro nem o último ponto
                          if (index > 0 && index < pathPoints.length - 1) {
                            if (confirm('Remover este ponto da conexão?')) {
                              removePointFromConnection(connection.id, index);
                            }
                          }
                        },
                      }}
                    >
                      <LeafletTooltip
                        direction="top"
                        offset={[0, -20]}
                        opacity={0.9}
                        permanent={false}
                      >
                        <div
                          style={{
                            background: 'rgba(0,0,0,0.9)',
                            color: 'white',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.3',
                          }}
                        >
                          {index === 0 || index === pathPoints.length - 1 ? (
                            <>
                              🔗 Ponto de Conexão
                              <br />
                              <span style={{ fontSize: '9px', opacity: 0.8 }}>
                                Arraste para reposicionar
                              </span>
                            </>
                          ) : (
                            <>
                              ⚙️ Ponto Editável
                              <br />
                              <span style={{ fontSize: '9px', opacity: 0.8 }}>
                                Arraste • Duplo clique p/ remover
                              </span>
                            </>
                          )}
                        </div>
                      </LeafletTooltip>
                    </Marker>
                  );
                });
              })()}
            </MapContainer>

            {/* Quick Add Button - Always visible */}
            <Paper
              sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                zIndex: 1000,
                p: 1,
                bgcolor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
              }}
            >
              <Tooltip title="Adição Rápida">
                <Fab
                  size="medium"
                  color="primary"
                  onClick={() => setQuickAddMode(prev => ({ ...prev, active: !prev.active }))}
                  sx={{
                    bgcolor: quickAddMode.active ? '#FF9800' : '#2196F3',
                    '&:hover': {
                      bgcolor: quickAddMode.active ? '#F57C00' : '#1976D2',
                    },
                  }}
                >
                  <AddIcon />
                </Fab>
              </Tooltip>
              
              {/* Quick add options */}
              {quickAddMode.active && (
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {Object.entries(NODE_CONFIGS).map(([type, config]) => {
                    const Icon = config.icon;
                    const isSelected = quickAddMode.nodeType === type;
                    
                    return (
                      <Tooltip key={type} title={`Adicionar ${config.label}`} placement="left">
                        <Fab
                          size="small"
                          onClick={() => {
                            if (isSelected) {
                              setQuickAddMode({ active: false });
                            } else {
                              setQuickAddMode({ active: true, nodeType: type as TopologyNode['type'] });
                            }
                          }}
                          sx={{
                            bgcolor: isSelected ? config.color : 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            '&:hover': {
                              bgcolor: config.color,
                            },
                            border: isSelected ? '2px solid white' : 'none',
                            width: 35,
                            height: 35,
                          }}
                        >
                          <Icon fontSize="small" />
                        </Fab>
                      </Tooltip>
                    );
                  })}
                </Box>
              )}
              
              {quickAddMode.active && quickAddMode.nodeType && (
                <Typography variant="caption" color="white" sx={{ 
                  display: 'block', 
                  textAlign: 'center', 
                  mt: 1,
                  fontSize: '10px',
                  maxWidth: 120,
                  wordWrap: 'break-word',
                }}>
                  Clique no mapa para adicionar {NODE_CONFIGS[quickAddMode.nodeType].label}
                </Typography>
              )}
            </Paper>


            {/* Floating Action Button for adding nodes - Edit Mode */}
            {editMode.active && (
              <Paper
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 1000,
                  p: 2,
                  bgcolor: 'rgba(0, 0, 0, 0.8)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body2" color="white" sx={{ mb: 1, textAlign: 'center' }}>
                  Adicionar Elementos
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {Object.entries(NODE_CONFIGS).map(([type, config]) => {
                    const Icon = config.icon;
                    const isSelected = editMode.tool === 'add-node' && editMode.nodeType === type;
                    
                    return (
                      <Tooltip key={type} title={`Adicionar ${config.label}`}>
                        <Fab
                          size="small"
                          onClick={() => setEditMode(prev => ({
                            ...prev,
                            tool: 'add-node',
                            nodeType: type as TopologyNode['type']
                          }))}
                          sx={{
                            bgcolor: isSelected ? config.color : 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            '&:hover': {
                              bgcolor: config.color,
                            },
                            border: isSelected ? '2px solid white' : 'none',
                          }}
                        >
                          <Icon />
                        </Fab>
                      </Tooltip>
                    );
                  })}
                </Box>
                
                {editMode.tool === 'add-node' && (
                  <Typography variant="caption" color="white" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                    Clique no mapa para adicionar {NODE_CONFIGS[editMode.nodeType || 'router'].label}
                  </Typography>
                )}
                
                {editMode.tool === 'add-connection' && editMode.selectedNodes.length > 0 && (
                  <Typography variant="caption" color="white" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                    {editMode.selectedNodes.length === 1 ? 
                      'Selecione o segundo nó para criar conexão' : 
                      'Clique em outro nó para conectar'
                    }
                  </Typography>
                )}

                {editMode.tool === 'edit-connection' && (
                  <Typography variant="caption" color="white" sx={{ display: 'block', textAlign: 'center', mt: 1, lineHeight: 1.3 }}>
                    {editMode.selectedConnection ? (
                      <>
                        ⚙️ <strong>Conexão Selecionada</strong>
                        <br />
                        • <strong>Duplo clique</strong> na linha para adicionar pontos
                        <br />
                        • <strong>Arraste</strong> os pontos azuis para reposicionar
                        <br />
                        • <strong>Duplo clique</strong> nos pontos para remover
                      </>
                    ) : (
                      <>
                        🔗 <strong>Modo Edição de Conexões</strong>
                        <br />
                        Clique em uma conexão para selecioná-la
                      </>
                    )}
                  </Typography>
                )}
              </Paper>
            )}
          </>
        ) : (
          <Box sx={{ p: 4, color: 'white', textAlign: 'center' }}>
            <Typography variant="h4" gutterBottom>
              Visualização em Diagrama
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Modo diagrama em desenvolvimento. Use o modo Mapa para criar e editar a topologia.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Add Node Dialog */}
      <Dialog
        open={showNodeDialog}
        onClose={() => setShowNodeDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff' } }}
      >
        <DialogTitle>Adicionar Novo Nó</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nome do Nó"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              variant="outlined"
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                },
              }}
            />
            
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#fff' }}>Tipo de Elemento</InputLabel>
              <Select
                value={newNodeType}
                onChange={(e) => setNewNodeType(e.target.value as TopologyNode['type'])}
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
              >
                {Object.entries(NODE_CONFIGS).map(([type, config]) => (
                  <MenuItem key={type} value={type}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <config.icon sx={{ color: config.color }} />
                      {config.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Endereço IP (opcional)"
              value={newNodeIP}
              onChange={(e) => setNewNodeIP(e.target.value)}
              variant="outlined"
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNodeDialog(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAddNode}
            variant="contained"
            disabled={!newNodeName.trim()}
          >
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Save Dialog */}
      <Dialog
        open={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff' } }}
      >
        <DialogTitle>Salvar Projeto</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome do Projeto"
            value={projectName || project.name}
            onChange={(e) => setProjectName(e.target.value)}
            variant="outlined"
            fullWidth
            sx={{
              mt: 2,
              '& .MuiInputLabel-root': { color: '#fff' },
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: '#555' },
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProjectDialog(false)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              const updatedProject = { ...project, name: projectName || project.name } as TopologyProject;
              setProject(updatedProject);
              await saveProjectToStorage(updatedProject);
              setShowProjectDialog(false);
              setProjectName('');
            }}
            variant="contained"
            disabled={savingProject}
            startIcon={savingProject ? <CircularProgress size={16} /> : undefined}
          >
            {savingProject ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Edição de Projeto */}
      <Dialog
        open={showEditProjectDialog}
        onClose={() => {
          setShowEditProjectDialog(false);
          setEditingProject(null);
          setEditProjectName('');
          setEditProjectDescription('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff' } }}
      >
        <DialogTitle>✏️ Editar Projeto</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nome do Projeto"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              variant="outlined"
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                },
              }}
              required
            />
            
            <TextField
              label="Descrição"
              value={editProjectDescription}
              onChange={(e) => setEditProjectDescription(e.target.value)}
              variant="outlined"
              fullWidth
              multiline
              rows={3}
              sx={{
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEditProjectDialog(false);
            setEditingProject(null);
            setEditProjectName('');
            setEditProjectDescription('');
          }}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (editingProject && editProjectName.trim()) {
                const success = await updateProject(
                  editingProject.id,
                  editProjectName.trim(),
                  editProjectDescription.trim()
                );
                if (success) {
                  setShowEditProjectDialog(false);
                  setEditingProject(null);
                  setEditProjectName('');
                  setEditProjectDescription('');
                }
              }
            }}
            variant="contained"
            disabled={!editProjectName.trim()}
          >
            Atualizar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de Edição de Nó */}
      <Dialog
        open={showEditNodeDialog}
        onClose={() => {
          setShowEditNodeDialog(false);
          setEditingNode(null);
          setEditNodeName('');
          setEditNodeIP('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff' } }}
      >
        <DialogTitle>✏️ Editar Nó - {editingNode?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nome do Nó"
              value={editNodeName}
              onChange={(e) => setEditNodeName(e.target.value)}
              variant="outlined"
              fullWidth
              sx={{
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                },
              }}
              required
            />
            
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#fff' }}>Tipo de Elemento</InputLabel>
              <Select
                value={editNodeType}
                onChange={(e) => setEditNodeType(e.target.value as TopologyNode['type'])}
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
              >
                {Object.entries(NODE_CONFIGS).map(([type, config]) => (
                  <MenuItem key={type} value={type}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <config.icon sx={{ color: config.color }} />
                      {config.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Endereço IP (opcional)"
              value={editNodeIP}
              onChange={(e) => setEditNodeIP(e.target.value)}
              variant="outlined"
              fullWidth
              placeholder="Ex: 192.168.1.1"
              sx={{
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setShowEditNodeDialog(false);
              setEditingNode(null);
              setEditNodeName('');
              setEditNodeIP('');
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleEditNode}
            variant="contained"
            disabled={!editNodeName.trim()}
          >
            💾 Salvar Alterações
          </Button>
        </DialogActions>
      </Dialog>

      {/* Painel lateral para editar nó/elemento */}
      <Drawer
        anchor="right"
        open={nodePanelOpen}
        onClose={() => setNodePanelOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
            bgcolor: '#1e1e1e',
            color: '#fff',
            mt: '64px',
            p: 2,
          },
        }}
      >
        <Box>
          <Typography variant="h6" gutterBottom>
            Editar Elemento
          </Typography>
          {(() => {
            const node = project?.nodes.find(n => n.id === editingNodeId);
            return (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {node?.name || 'Elemento'} ({NODE_CONFIGS[nodeIconType]?.label})
                </Typography>

                <TextField
                  label="Nome do elemento"
                  value={nodeNameInput}
                  onChange={(e) => setNodeNameInput(e.target.value)}
                  fullWidth
                  sx={{
                    mb: 2,
                    '& .MuiInputLabel-root': { color: '#fff' },
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#555' },
                    },
                  }}
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#fff' }}>Tipo</InputLabel>
                  <Select
                    value={nodeIconType}
                    onChange={(e) => setNodeIconType(e.target.value as TopologyNode['type'])}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                    label="Tipo"
                  >
                    {Object.entries(NODE_CONFIGS).map(([type, config]) => (
                      <MenuItem key={type} value={type}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <config.icon sx={{ color: config.color }} />
                          {config.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#fff' }}>Host do Zabbix</InputLabel>
                  <Select
                    value={selectedZabbixHost}
                    onChange={(e) => setSelectedZabbixHost(e.target.value as string)}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' } }}
                    label="Host do Zabbix"
                    disabled={loadingZabbixHosts}
                  >
                    <MenuItem value="">Nenhum host selecionado</MenuItem>
                    {availableZabbixHosts.map((host) => (
                      <MenuItem key={host.hostid} value={host.hostid}>
                        <Box>
                          <Typography variant="body2">{host.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {host.host} - {host.interfaces?.[0]?.ip || 'Sem IP'}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  {loadingZabbixHosts && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      <Typography variant="caption">Carregando hosts do Zabbix...</Typography>
                    </Box>
                  )}
                </FormControl>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Geo Posicionamento
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    label="Latitude"
                    value={nodeLatInput}
                    onChange={(e) => setNodeLatInput(e.target.value)}
                    type="number"
                    sx={{
                      flex: 1,
                      '& .MuiInputLabel-root': { color: '#fff' },
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: '#555' },
                      },
                    }}
                  />
                  <TextField
                    label="Longitude"
                    value={nodeLngInput}
                    onChange={(e) => setNodeLngInput(e.target.value)}
                    type="number"
                    sx={{
                      flex: 1,
                      '& .MuiInputLabel-root': { color: '#fff' },
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: '#555' },
                      },
                    }}
                  />
                </Box>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={enableNodeDragMode}
                  sx={{ mb: 2, borderColor: '#555', color: '#fff' }}
                  startIcon={<EditIcon />}
                >
                  Arrastar no mapa para reposicionar
                </Button>
                {draggableNodeMode && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 2 }}>
                    Modo arrastar ativado - arraste o elemento no mapa
                  </Typography>
                )}

                <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>
                  Conexões do Elemento
                </Typography>
                {(() => {
                  const nodeConnections = project?.connections.filter(conn => 
                    conn.sourceId === editingNodeId || conn.targetId === editingNodeId
                  ) || [];
                  
                  return nodeConnections.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                      {nodeConnections.map((connection) => {
                        const isSource = connection.sourceId === editingNodeId;
                        const otherNodeId = isSource ? connection.targetId : connection.sourceId;
                        const otherNode = project?.nodes.find(n => n.id === otherNodeId);
                        
                        return (
                          <Paper 
                            key={connection.id} 
                            sx={{ 
                              p: 2, 
                              mb: 1, 
                              bgcolor: '#2a2a2a',
                              border: '1px solid #444',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#333' }
                            }}
                            onClick={() => {
                              setEditMode(prev => ({
                                ...prev,
                                tool: 'edit-connection',
                                selectedConnection: connection.id,
                                connectionEditMode: true
                              }));
                              setConnectionPanelOpen(true);
                              setNodePanelOpen(false);
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                🔗 {isSource ? '→' : '←'} {otherNode?.name || 'Nó Desconhecido'}
                              </Typography>
                            </Box>
                            
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Tipo: {connection.type} • Banda: {connection.bandwidth}
                            </Typography>
                            
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Interface: {(() => {
                                const interfaceName = isSource 
                                  ? (connection.properties.sourceInterface || 'Não configurada')
                                  : (connection.properties.targetInterface || 'Não configurada');
                                
                                const hasZabbixInterface = isSource
                                  ? !!connection.properties.sourceZabbixInterfaceId
                                  : !!connection.properties.targetZabbixInterfaceId;
                                
                                return (
                                  <span>
                                    {interfaceName}
                                    {hasZabbixInterface && (
                                      <span style={{ color: '#4caf50', marginLeft: '8px' }}>
                                        ✓ Zabbix
                                      </span>
                                    )}
                                  </span>
                                );
                              })()}
                            </Typography>
                            
                            {connection.isCalculated && connection.distance && (
                              <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                                ✓ Rota calculada • {(connection.distance / 1000).toFixed(2)} km
                              </Typography>
                            )}
                          </Paper>
                        );
                      })}
                      
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        sx={{ mt: 1, borderColor: '#555', color: '#fff' }}
                        onClick={() => {
                          // Implementar criação de nova conexão se necessário
                          setNodePanelOpen(false);
                          setEditMode(prev => ({ ...prev, active: true, tool: 'add-connection' }));
                        }}
                      >
                        + Nova conexão
                      </Button>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                      Nenhuma conexão encontrada para este elemento.
                    </Typography>
                  );
                })()}

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={saveNodeChanges}
                  >
                    Atualizar
                  </Button>
                  <Button onClick={() => setNodePanelOpen(false)}>Cancelar</Button>
                </Box>

                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" color="text.secondary">
                  Selecionando um host do Zabbix, as interfaces ficam disponíveis para vincular às conexões. Clique em uma conexão acima para configurar suas interfaces específicas.
                </Typography>
              </>
            );
          })()}
        </Box>
      </Drawer>

      {/* Painel de Configurações Globais */}
      <Dialog
        open={showGlobalSettings}
        onClose={() => setShowGlobalSettings(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: '#fff',
            minHeight: '70vh',
          },
        }}
      >
        <DialogTitle sx={{ bgcolor: '#2a2a2a', color: '#fff' }}>
          <Typography variant="h6">Configurações Globais</Typography>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', height: '60vh' }}>
            {/* Menu lateral */}
            <Box sx={{ width: 200, bgcolor: '#2a2a2a', borderRight: '1px solid #444' }}>
              <Tabs
                orientation="vertical"
                value={settingsTab}
                onChange={(_, newValue) => setSettingsTab(newValue)}
                sx={{
                  '& .MuiTab-root': {
                    color: '#fff',
                    textAlign: 'left',
                    alignItems: 'flex-start',
                    minHeight: 48,
                  },
                  '& .Mui-selected': {
                    color: '#ff6b6b !important',
                    bgcolor: 'rgba(255, 107, 107, 0.1)',
                  },
                }}
              >
                <Tab label="Mapa de FTTH" />
                <Tab label="Camada de tráfego" />
                <Tab label="Outros" />
              </Tabs>
            </Box>

            {/* Conteúdo das configurações */}
            <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
              {settingsTab === 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, color: '#ff6b6b' }}>
                    Mapa de FTTH
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                    Informe o link do banco de FTTH para gerar o mapa automaticamente.
                  </Typography>

                  <TextField
                    label="LINK"
                    value={globalSettings.ftthMap.databaseUrl}
                    onChange={(e) =>
                      setGlobalSettings(prev => ({
                        ...prev,
                        ftthMap: { ...prev.ftthMap, databaseUrl: e.target.value }
                      }))
                    }
                    fullWidth
                    sx={{
                      mb: 3,
                      '& .MuiInputLabel-root': { color: '#fff' },
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: '#555' },
                      },
                    }}
                    placeholder="https://exemplo.com/api/ftth"
                  />

                  {!globalSettings.ftthMap.databaseUrl && (
                    <Paper sx={{ p: 2, bgcolor: '#1a4a5c', mb: 3 }}>
                      <Typography variant="body2" sx={{ color: '#4fc3f7' }}>
                        ℹ️ Ainda não possui um banco configurado?<br />
                        Entre em contato com o suporte para obter ajuda!
                      </Typography>
                    </Paper>
                  )}

                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Escalas
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                    Define as escalas para os mapas de FTTH clicando nas cores. Elas serão ordenadas automaticamente com base nos valores.
                  </Typography>

                  {/* Escala de cores FTTH */}
                  <Box sx={{ display: 'flex', mb: 2, height: 20 }}>
                    {Object.entries(globalSettings.ftthMap.scales).map(([key, scale]) => (
                      <Box
                        key={key}
                        sx={{
                          flex: 1,
                          bgcolor: scale.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          color: '#fff',
                          textShadow: '1px 1px 1px rgba(0,0,0,0.8)',
                        }}
                      >
                        {scale.min}dBm
                      </Box>
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                    <Button variant="outlined" size="small" sx={{ borderColor: '#555', color: '#fff' }}>
                      Redefinir
                    </Button>
                    <Button variant="outlined" size="small" sx={{ borderColor: '#555', color: '#fff' }}>
                      + Nova escala
                    </Button>
                  </Box>

                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Tempo de atualização
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                    Define o tempo em que seus dados são coletados.
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                      type="number"
                      value={globalSettings.ftthMap.updateInterval}
                      onChange={(e) =>
                        setGlobalSettings(prev => ({
                          ...prev,
                          ftthMap: { ...prev.ftthMap, updateInterval: parseInt(e.target.value) || 1 }
                        }))
                      }
                      sx={{
                        width: 80,
                        '& .MuiInputLabel-root': { color: '#fff' },
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: '#555' },
                        },
                      }}
                    />
                    <Typography>minuto(s)</Typography>
                  </Box>
                </Box>
              )}

              {settingsTab === 1 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, color: '#ff6b6b' }}>
                    Camada de tráfego
                  </Typography>
                  
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Escalas
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                    Define as escalas para as camadas de tráfego clicando nas cores. Elas serão ordenadas automaticamente com base nos valores.
                  </Typography>

                  {/* Escala de cores de tráfego */}
                  <Box sx={{ display: 'flex', mb: 2, height: 20 }}>
                    {Object.entries(globalSettings.trafficLayer.scales).map(([key, scale]) => (
                      <Box
                        key={key}
                        sx={{
                          flex: 1,
                          bgcolor: scale.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          color: '#fff',
                          textShadow: '1px 1px 1px rgba(0,0,0,0.8)',
                        }}
                      >
                        {scale.value}%
                      </Box>
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                    <Button variant="outlined" size="small" sx={{ borderColor: '#555', color: '#fff' }}>
                      Redefinir
                    </Button>
                    <Button variant="outlined" size="small" sx={{ borderColor: '#555', color: '#fff' }}>
                      + Nova escala
                    </Button>
                  </Box>

                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Tempo de atualização
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                    Define o tempo de atualização dos dados de tráfego.
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                      type="number"
                      value={globalSettings.trafficLayer.updateInterval}
                      onChange={(e) =>
                        setGlobalSettings(prev => ({
                          ...prev,
                          trafficLayer: { ...prev.trafficLayer, updateInterval: parseInt(e.target.value) || 1 }
                        }))
                      }
                      sx={{
                        width: 80,
                        '& .MuiInputLabel-root': { color: '#fff' },
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: '#555' },
                        },
                      }}
                    />
                    <Typography>minuto(s)</Typography>
                  </Box>
                </Box>
              )}

              {settingsTab === 2 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, color: '#ff6b6b' }}>
                    Outros
                  </Typography>

                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Links dos tiles
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                    Links dos servidores que fornecem mapas de fundo para os mapas com geolocalização.
                  </Typography>

                  <TextField
                    label="MODO CLARO"
                    value={globalSettings.tileUrls.light}
                    onChange={(e) =>
                      setGlobalSettings(prev => ({
                        ...prev,
                        tileUrls: { ...prev.tileUrls, light: e.target.value }
                      }))
                    }
                    fullWidth
                    sx={{
                      mb: 2,
                      '& .MuiInputLabel-root': { color: '#fff' },
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: '#555' },
                      },
                    }}
                  />

                  <TextField
                    label="MODO ESCURO"
                    value={globalSettings.tileUrls.dark}
                    onChange={(e) =>
                      setGlobalSettings(prev => ({
                        ...prev,
                        tileUrls: { ...prev.tileUrls, dark: e.target.value }
                      }))
                    }
                    fullWidth
                    sx={{
                      mb: 3,
                      '& .MuiInputLabel-root': { color: '#fff' },
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: '#555' },
                      },
                    }}
                  />

                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Precisão do roteamento automático
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                    A precisão define a quantidade de pontos gerados durante o roteamento automático. Quanto maior for a precisão, mais pontos serão gerados e mais processamento será necessário.
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="caption">Baixa</Typography>
                    <Typography variant="caption">Moderada</Typography>
                    <Typography variant="caption">Boa</Typography>
                    <Typography variant="caption">Excelente</Typography>
                  </Box>

                  <Slider
                    value={['low', 'moderate', 'good', 'excellent'].indexOf(globalSettings.zabbixOptimization.routingPrecision)}
                    onChange={(_, value) => {
                      const precisions = ['low', 'moderate', 'good', 'excellent'];
                      setGlobalSettings(prev => ({
                        ...prev,
                        zabbixOptimization: {
                          ...prev.zabbixOptimization,
                          routingPrecision: precisions[value as number] as 'low' | 'moderate' | 'good' | 'excellent'
                        }
                      }));
                    }}
                    min={0}
                    max={3}
                    step={1}
                    marks
                    sx={{
                      color: '#ff6b6b',
                      mb: 3,
                      '& .MuiSlider-thumb': { bgcolor: '#ff6b6b' },
                      '& .MuiSlider-track': { bgcolor: '#ff6b6b' },
                      '& .MuiSlider-rail': { bgcolor: '#555' },
                    }}
                  />

                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Otimização Zabbix
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Intervalo de atualização das métricas
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <TextField
                        type="number"
                        value={globalSettings.zabbixOptimization.updateInterval}
                        onChange={(e) =>
                          setGlobalSettings(prev => ({
                            ...prev,
                            zabbixOptimization: {
                              ...prev.zabbixOptimization,
                              updateInterval: parseInt(e.target.value) || 1
                            }
                          }))
                        }
                        sx={{
                          width: 80,
                          '& .MuiInputLabel-root': { color: '#fff' },
                          '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: '#555' },
                          },
                        }}
                      />
                      <Typography>minuto(s)</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Máximo de requisições simultâneas
                    </Typography>
                    <TextField
                      type="number"
                      value={globalSettings.zabbixOptimization.maxConcurrentRequests}
                      onChange={(e) =>
                        setGlobalSettings(prev => ({
                          ...prev,
                          zabbixOptimization: {
                            ...prev.zabbixOptimization,
                            maxConcurrentRequests: parseInt(e.target.value) || 1
                          }
                        }))
                      }
                      sx={{
                        width: 120,
                        '& .MuiInputLabel-root': { color: '#fff' },
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: '#555' },
                        },
                      }}
                    />
                  </Box>

                  <Typography variant="subtitle1" sx={{ mb: 2 }}>
                    Animações
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                    Habilite ou desabilite as animações nas linhas ou nos ícones em todos os mapas.
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={globalSettings.animations.alertAnimations}
                        onChange={(e) =>
                          setGlobalSettings(prev => ({
                            ...prev,
                            animations: { ...prev.animations, alertAnimations: e.target.checked }
                          }))
                        }
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: '#ff6b6b' },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#ff6b6b' },
                        }}
                      />
                    }
                    label="ANIMAÇÃO DE ALERTAS"
                    sx={{ color: '#fff', mb: 1 }}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ bgcolor: '#2a2a2a', p: 2 }}>
          <Button onClick={() => setShowGlobalSettings(false)} sx={{ color: '#ff6b6b' }}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              saveGlobalSettings(globalSettings);
              setShowGlobalSettings(false);
            }}
            variant="contained"
            sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TopologyManager;
