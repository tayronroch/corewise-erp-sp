// Tipos base para o sistema de gerenciamento de mapas

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface ZabbixHost {
  hostId?: string;
  zabbixHostId?: string; // Para compatibilidade com o código existente
  hostName: string;
  ipAddress: string;
  port?: number;
  monitoringEnabled: boolean;
  lastUpdate?: Date;
  status?: 'online' | 'offline' | 'warning' | 'unknown';
}

export type MapItemType = 'pop' | 'host' | 'antenna' | 'switch' | 'router' | 'server' | 'building' | 'connection';

export interface MapItem {
  id: string;
  type: MapItemType;
  name: string;
  description?: string;
  geoLocation: GeoLocation;
  zabbixHost?: ZabbixHost;
  properties: Record<string, string | number | boolean | string[]>;
  createdAt: Date;
  updatedAt: Date;
  visible: boolean;
  icon?: string;
  color?: string;
}

export interface MapConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'fiber' | 'wireless' | 'ethernet' | 'logical';
  path?: [number, number][]; // Caminho completo da conexão (array de lat/lng)
  isCalculated?: boolean; // Se o caminho foi calculado automaticamente
  properties: {
    bandwidth?: string;
    protocol?: string;
    distance?: number;
    status?: 'active' | 'inactive' | 'maintenance';
    latency?: number;
    utilization?: number;
    traffic?: {
      inbound: number;
      outbound: number;
      latency: number;
    };
  };
  style?: {
    color?: string;
    width?: number;
    dashArray?: string;
    opacity?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MapConfiguration {
  id: string;
  name: string;
  description?: string;
  center: GeoLocation;
  zoom: number;
  items: MapItem[];
  connections: MapConnection[];
  layers?: {
    items: boolean;
    connections: boolean;
    labels: boolean;
    monitoring: boolean;
  };
  properties?: Record<string, any>; // Para armazenar metadados adicionais como projectType
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface MapItemTemplate {
  type: MapItemType;
  name: string;
  icon: string;
  defaultProperties: Record<string, string | number | boolean | string[]>;
  requiredFields: string[];
  category: 'network' | 'infrastructure' | 'monitoring' | 'logical';
}

export interface EditMode {
  active: boolean;
  tool: 'select' | 'add' | 'connect' | 'delete' | 'move';
  selectedItemType?: MapItemType;
  selectedItems: string[];
  tempConnection?: {
    sourceId: string;
    targetId?: string;
    path: GeoLocation[];
  };
}

export interface MapManagerState {
  currentMap: MapConfiguration | null;
  editMode: EditMode;
  selectedItem: MapItem | null;
  hoveredItem: MapItem | null;
  loading: boolean;
  error: string | null;
  filters: {
    itemTypes: MapItemType[];
    connectionTypes: string[];
    monitoringStatus: string[];
  };
}

// Estados de monitoramento
export interface MonitoringData {
  timestamp: Date;
  cpu?: number;
  memory?: number;
  networkIn?: number;
  networkOut?: number;
  availability?: number;
  responseTime?: number;
  customMetrics?: Record<string, number>;
}

// Templates de itens pré-definidos
export const MAP_ITEM_TEMPLATES: MapItemTemplate[] = [
  {
    type: 'pop',
    name: 'POP (Ponto de Presença)',
    icon: '🏢',
    category: 'infrastructure',
    defaultProperties: {
      capacity: '',
      provider: '',
      redundancy: false,
    },
    requiredFields: ['name', 'geoLocation'],
  },
  {
    type: 'host',
    name: 'Host/Servidor',
    icon: '💻',
    category: 'network',
    defaultProperties: {
      os: '',
      role: '',
      environment: 'production',
    },
    requiredFields: ['name', 'geoLocation', 'zabbixHost'],
  },
  {
    type: 'antenna',
    name: 'Antena',
    icon: '📡',
    category: 'infrastructure',
    defaultProperties: {
      frequency: '',
      range: '',
      type: 'omnidirecional',
    },
    requiredFields: ['name', 'geoLocation'],
  },
  {
    type: 'switch',
    name: 'Switch',
    icon: '🔌',
    category: 'network',
    defaultProperties: {
      ports: 24,
      managed: true,
      vlanSupport: true,
    },
    requiredFields: ['name', 'geoLocation'],
  },
  {
    type: 'router',
    name: 'Router',
    icon: '🌐',
    category: 'network',
    defaultProperties: {
      protocols: ['BGP', 'OSPF'],
      interfaces: '',
    },
    requiredFields: ['name', 'geoLocation'],
  },
  {
    type: 'server',
    name: 'Servidor',
    icon: '🖥️',
    category: 'infrastructure',
    defaultProperties: {
      cpu: '',
      memory: '',
      storage: '',
    },
    requiredFields: ['name', 'geoLocation'],
  },
  {
    type: 'building',
    name: 'Prédio/Site',
    icon: '🏗️',
    category: 'infrastructure',
    defaultProperties: {
      address: '',
      floors: 1,
      power: '',
    },
    requiredFields: ['name', 'geoLocation'],
  },
];

// Constantes para estilos de conexões
export const CONNECTION_STYLES = {
  fiber: {
    color: '#0066cc',
    width: 3,
    opacity: 0.8,
  },
  wireless: {
    color: '#ff6600',
    width: 2,
    dashArray: '5,5',
    opacity: 0.7,
  },
  ethernet: {
    color: '#00cc66',
    width: 2,
    opacity: 0.8,
  },
  logical: {
    color: '#cc0066',
    width: 1,
    dashArray: '10,5',
    opacity: 0.6,
  },
};

// Estados de monitoramento
export const MONITORING_STATES = {
  online: { color: '#4caf50', label: 'Online' },
  offline: { color: '#f44336', label: 'Offline' },
  warning: { color: '#ff9800', label: 'Atenção' },
  unknown: { color: '#757575', label: 'Desconhecido' },
}; 