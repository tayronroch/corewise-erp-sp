import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Chip,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Paper,
  Avatar,
  Tooltip,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Layers,
  Search,
  Refresh,
  Warning,
  CheckCircle,
  Error,
  ArrowBack,
  Map as MapIcon,
  AccountTree,
  DarkMode,
  LightMode,
  Route as RouteIcon,
  Edit,
  Undo,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { calculateMultipleRoutes } from '../../services/routingService';

// Fix para ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Tipos de equipamentos
interface Equipment {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'olt' | 'radio' | 'servidor';
  status: 'online' | 'offline' | 'warning' | 'maintenance';
  coordinates: [number, number];
  connections: string[];
  details: {
    ip: string;
    model: string;
    clients?: number;
    uptime?: string;
    signal?: number;
    cpu?: number;
    memory?: number;
    temperature?: number;
  };
}

// Tipos de rotas
interface Route {
  id: string;
  from: string;
  to: string;
  path: [number, number][];
  type: 'fiber' | 'radio' | 'metallic';
  bandwidth: string;
  utilization: number;
  isCalculated?: boolean; // Se a rota foi calculada por vias terrestres
  distance?: number; // Distância real em metros
  traffic?: {
    inbound: number;
    outbound: number;
    latency: number;
  };
}

// Componente Tooltip Customizado para Equipamentos
interface EquipmentTooltipProps {
  equipment: Equipment | null;
  position: { x: number; y: number };
  visible: boolean;
}

const EquipmentTooltip = ({ equipment, position, visible }: EquipmentTooltipProps) => {
  if (!visible) return null;

  return (
    <Card
      sx={{
        position: 'fixed',
        top: position.y - 10,
        left: position.x + 20,
        zIndex: 10000,
        minWidth: 280,
        maxWidth: 320,
        bgcolor: 'rgba(30, 30, 30, 0.98)',
        color: 'white',
        border: '1px solid #444',
        borderRadius: 2,
        boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.2s ease-in',
        pointerEvents: 'none',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ color: '#4fc3f7', fontWeight: 'bold' }}>
            {equipment?.name}
          </Typography>
          <Chip
            label={equipment?.status.toUpperCase()}
            size="small"
            sx={{
              bgcolor: equipment?.status === 'online' ? '#4caf50' : 
                       equipment?.status === 'warning' ? '#ff9800' : '#f44336',
              color: 'white',
              fontWeight: 'bold'
            }}
          />
        </Box>
        
        <Typography variant="body2" sx={{ mb: 1, color: '#aaa' }}>
          📱 <strong>Tipo:</strong> {equipment?.type} | 🌐 <strong>IP:</strong> {equipment?.details.ip}
        </Typography>
        
        <Typography variant="body2" sx={{ mb: 1, color: '#aaa' }}>
          🔧 <strong>Modelo:</strong> {equipment?.details.model}
        </Typography>

        {equipment?.details.clients && (
          <Typography variant="body2" sx={{ mb: 1, color: '#aaa' }}>
            👥 <strong>Clientes:</strong> {equipment?.details.clients}
          </Typography>
        )}

        {equipment?.details.uptime && (
          <Typography variant="body2" sx={{ mb: 1, color: '#aaa' }}>
            ⏰ <strong>Uptime:</strong> {equipment?.details.uptime}
          </Typography>
        )}

        {equipment?.details.signal && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#aaa' }}>
              📶 <strong>Sinal:</strong> 
              <span style={{ 
                color: equipment?.details.signal > 80 ? '#4caf50' : 
                       equipment?.details.signal > 60 ? '#ff9800' : '#f44336',
                fontWeight: 'bold',
                marginLeft: '4px'
              }}>
                {equipment?.details.signal}%
              </span>
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {equipment?.details.cpu && (
            <Chip label={`CPU: ${equipment?.details.cpu}%`} size="small" sx={{ bgcolor: '#333', color: 'white' }} />
          )}
          {equipment?.details.memory && (
            <Chip label={`RAM: ${equipment?.details.memory}%`} size="small" sx={{ bgcolor: '#333', color: 'white' }} />
          )}
          {equipment?.details.temperature && (
            <Chip label={`${equipment?.details.temperature}°C`} size="small" sx={{ bgcolor: '#333', color: 'white' }} />
          )}
        </Box>
      </Box>
    </Card>
  );
};

// Componente Tooltip de Tráfego para Enlaces
interface RouteTooltipProps {
  route: Route | null;
  position: { x: number; y: number };
  visible: boolean;
}

const RouteTooltip = ({ route, position, visible }: RouteTooltipProps) => {
  if (!visible) return null;

  const getUtilizationColor = (util: number) => {
    if (util > 80) return '#f44336';
    if (util > 60) return '#ff9800';
    return '#4caf50';
  };

  return (
    <Card
      sx={{
        position: 'fixed',
        top: position.y - 80,
        left: position.x + 20,
        zIndex: 10000,
        minWidth: 320,
        maxWidth: 380,
        bgcolor: 'rgba(30, 30, 30, 0.98)',
        color: 'white',
        border: '1px solid #444',
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.2s ease-in',
        pointerEvents: 'none',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ color: '#4fc3f7', fontWeight: 'bold', mb: 1 }}>
          🔗 Enlace {route?.bandwidth}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: '#aaa', mb: 0.5 }}>
            📡 <strong>Tipo:</strong> {route?.type} | <strong>Capacidade:</strong> {route?.bandwidth}
          </Typography>
          {route?.isCalculated && (
            <Typography variant="body2" sx={{ color: '#4caf50', mb: 0.5 }}>
              🛣️ <strong>Rota por vias terrestres</strong>
              {route?.distance && ` • ${(route?.distance / 1000).toFixed(1)} km`}
            </Typography>
          )}
          {!route?.isCalculated && (
            <Typography variant="body2" sx={{ color: '#ff9800', mb: 0.5 }}>
              📏 <strong>Rota direta</strong>
            </Typography>
          )}
        </Box>

        {/* Gráfico de Utilização */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: '#aaa', mb: 1 }}>
            📊 <strong>Utilização:</strong>
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: '100%',
                height: 8,
                bgcolor: '#333',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${route?.utilization || 0}%`,
                  height: '100%',
                  bgcolor: getUtilizationColor(route?.utilization || 0),
                  transition: 'width 0.3s ease',
                }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: getUtilizationColor(route?.utilization || 0),
                fontWeight: 'bold',
                minWidth: '45px',
              }}
            >
              {(route?.utilization || 0).toFixed(1)}%
            </Typography>
          </Box>
        </Box>

        {/* Métricas de Tráfego */}
        {route?.traffic && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`↓ ${(route?.traffic.inbound / 1024 / 1024).toFixed(1)} Mbps`}
              size="small"
              sx={{ bgcolor: '#1976d2', color: 'white' }}
            />
            <Chip
              label={`↑ ${(route?.traffic.outbound / 1024 / 1024).toFixed(1)} Mbps`}
              size="small"
              sx={{ bgcolor: '#388e3c', color: 'white' }}
            />
            <Chip
              label={`⚡ ${route?.traffic.latency}ms`}
              size="small"
              sx={{ bgcolor: '#7b1fa2', color: 'white' }}
            />
          </Box>
        )}
      </Box>
    </Card>
  );
};

// Ícones customizados para equipamentos
const createCustomIcon = (type: string, status: string) => {
  const colors = {
    online: '#4caf50',
    offline: '#f44336',
    warning: '#ff9800',
    maintenance: '#2196f3'
  };

  const icons = {
    router: '🌐',
    switch: '🔀',
    olt: '📡',
    radio: '📶',
    servidor: '🖥️'
  };

  return L.divIcon({
    html: `
      <div class="equipment-marker" style="
        background: ${colors[status as keyof typeof colors]};
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        border: 3px solid white;
        cursor: pointer;
        transition: all 0.3s ease;
      ">
        ${icons[type as keyof typeof icons]}
      </div>
    `,
    className: 'custom-equipment-icon',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
};

interface CoreWiseMapsProps {
  onBack?: () => void;
}

export default function CoreWiseMaps({ onBack }: CoreWiseMapsProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [networkData, setNetworkData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [editingRoute, setEditingRoute] = useState<string | null>(null);
  const [routeEditMode, setRouteEditMode] = useState(false);

  // Estados para tooltips
  const [equipmentTooltip, setEquipmentTooltip] = useState<{
    equipment: Equipment | null;
    position: { x: number; y: number };
    visible: boolean;
  }>({ equipment: null, position: { x: 0, y: 0 }, visible: false });
  
  const [routeTooltip, setRouteTooltip] = useState<{
    route: Route | null;
    position: { x: number; y: number };
    visible: boolean;
  }>({ route: null, position: { x: 0, y: 0 }, visible: false });

  // Estado para equipamentos
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);

  // Função para calcular rotas por vias terrestres
  const calculateRealRoutes = useCallback(async (routesToCalculate: Route[]) => {
    setRoutesLoading(true);
    
    try {
      const routeRequests = routesToCalculate.map(route => {
        // Encontrar coordenadas dos equipamentos
        const fromEquip = equipments.find(eq => eq.id === route.from);
        const toEquip = equipments.find(eq => eq.id === route.to);
        
        if (!fromEquip || !toEquip) {
          return null;
        }
        
        return {
          id: route.id,
          start: fromEquip.coordinates,
          end: toEquip.coordinates
        };
      }).filter(Boolean) as Array<{ id: string; start: [number, number]; end: [number, number] }>;

      if (routeRequests.length > 0) {
        const calculatedRoutes = await calculateMultipleRoutes(routeRequests);
        
        setRoutes(prevRoutes => 
          prevRoutes.map(route => {
            const calculated = calculatedRoutes.find(calc => calc.id === route.id);
            if (calculated) {
              return {
                ...route,
                path: calculated.path,
                isCalculated: true,
                distance: calculateDistance(calculated.path)
              };
            }
            return route;
          })
        );
      }
    } catch (error) {
      console.error('Erro ao calcular rotas terrestres:', error);
      setError('Erro ao calcular rotas por vias terrestres. Usando rotas diretas.');
    } finally {
      setRoutesLoading(false);
    }
  }, [equipments]);

  // Função auxiliar para calcular distância da rota
  const calculateDistance = (path: [number, number][]): number => {
    let totalDistance = 0;
    for (let i = 1; i < path.length; i++) {
      const [lat1, lng1] = path[i - 1];
      const [lat2, lng2] = path[i];
      
      // Fórmula de Haversine para calcular distância
      const R = 6371000; // Raio da Terra em metros
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
    return totalDistance;
  };

  // Função para buscar dados do backend
  const fetchNetworkData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // Dados mock sempre disponíveis
      const mockEquipments: Equipment[] = [
        {
          id: 'sw1',
          name: 'Core-Switch-SP',
          type: 'switch',
          status: 'online',
          coordinates: [-23.5505, -46.6333],
          connections: ['sw2', 'rt1'],
          details: {
            ip: '192.168.1.1',
            model: 'Cisco Catalyst 9500',
            clients: 850,
            uptime: '45 dias',
          signal: 98,
          cpu: 25,
          memory: 45,
          temperature: 42
          }
        },
        {
          id: 'sw2',
          name: 'Distrib-Switch-RJ',
          type: 'switch',
          status: 'online',
          coordinates: [-22.9068, -43.1729],
          connections: ['sw1', 'sw3'],
          details: {
            ip: '192.168.1.2',
            model: 'Huawei S5700',
            clients: 650,
            uptime: '32 dias',
          signal: 95,
          cpu: 35,
          memory: 55,
          temperature: 38
          }
        },
        {
          id: 'sw3',
          name: 'Access-Switch-BH',
          type: 'switch',
          status: 'warning',
          coordinates: [-19.8197, -43.9542],
          connections: ['sw2'],
          details: {
            ip: '192.168.1.3',
            model: 'TP-Link T2600G',
            clients: 320,
            uptime: '18 dias',
          signal: 78,
          cpu: 68,
          memory: 72,
          temperature: 58
          }
        },
        {
          id: 'rt1',
          name: 'Router-Core-BSB',
          type: 'router',
          status: 'online',
          coordinates: [-15.8267, -47.9218],
          connections: ['sw1'],
          details: {
            ip: '192.168.1.10',
            model: 'MikroTik CCR2004',
            clients: 1200,
            uptime: '67 dias',
          signal: 99,
          cpu: 28,
          memory: 41,
          temperature: 39
          }
        }
      ];
      
      const mockRoutes: Route[] = [
        {
          id: 'r1',
          from: 'sw1',
          to: 'sw2',
        path: [[-23.5505, -46.6333], [-22.9068, -43.1729]], // Será recalculado
          type: 'fiber',
          bandwidth: '10Gbps',
        utilization: 60.0,
        isCalculated: false,
        traffic: {
          inbound: 6000000000,
          outbound: 4500000000,
          latency: 12
        }
        },
        {
          id: 'r2',
          from: 'sw2',
          to: 'sw3',
        path: [[-22.9068, -43.1729], [-19.8197, -43.9542]], // Será recalculado
          type: 'fiber',
          bandwidth: '1Gbps',
        utilization: 83.0,
        isCalculated: false,
        traffic: {
          inbound: 830000000,
          outbound: 720000000,
          latency: 18
        }
        },
        {
          id: 'r3',
          from: 'sw1',
          to: 'rt1',
        path: [[-23.5505, -46.6333], [-15.8267, -47.9218]], // Será recalculado
          type: 'fiber',
          bandwidth: '40Gbps',
        utilization: 53.0,
        isCalculated: false,
        traffic: {
          inbound: 21200000000,
          outbound: 18900000000,
          latency: 8
        }
      }
    ];

    try {
      // Tentar buscar dados do backend primeiro
      const response = await axios.get('/api/v1/network-map/', {
        withCredentials: true,
        timeout: 5000 // 5 segundos de timeout
      });
      
      const data = response.data;
      setNetworkData(data);
      
      // Se sucesso, converter dados reais
      const mappedEquipments: Equipment[] = data.equipments.map((eq: any) => ({
        id: eq.id,
        name: eq.name,
        type: eq.type,
        status: eq.status,
        coordinates: eq.coordinates,
        connections: eq.connections,
        details: {
          ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
          model: 'Equipamento de Rede',
          clients: Math.floor(Math.random() * 500),
          uptime: `${Math.floor(Math.random() * 100)} dias`,
          signal: Math.floor(Math.random() * 40) + 60,
          cpu: Math.floor(Math.random() * 50) + 20,
          memory: Math.floor(Math.random() * 60) + 30,
          temperature: Math.floor(Math.random() * 30) + 35,
        }
      }));
      
      const mappedRoutes: Route[] = data.routes.map((route: any) => ({
        id: route.id,
        from: route.from,
        to: route.to,
        path: route.path,
        type: route.type,
        bandwidth: route.bandwidth,
        utilization: route.utilization,
        isCalculated: false,
        traffic: {
          inbound: Math.floor(Math.random() * 1000000000),
          outbound: Math.floor(Math.random() * 800000000),
          latency: Math.floor(Math.random() * 50) + 5,
        },
      }));
      
      setEquipments(mappedEquipments);
      setRoutes(mappedRoutes);
      
      // Calcular rotas terrestres
      setTimeout(() => {
        calculateRealRoutes(mappedRoutes);
      }, 500);
      
    } catch (err) {
      console.warn('Backend indisponível, usando dados simulados:', err);
      setError('Backend offline - Executando em modo demonstração');
      
      // Usar dados mock
      setEquipments(mockEquipments);
      setRoutes(mockRoutes);
      
      // Calcular rotas terrestres para dados mock
      setTimeout(() => {
        calculateRealRoutes(mockRoutes);
      }, 1000);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar dados na inicialização
  useEffect(() => {
    fetchNetworkData();
  }, [fetchNetworkData]);

  // Cores para diferentes tipos de rota
  const getRouteColor = (utilization: number) => {
    if (utilization > 80) return '#f44336'; // Vermelho
    if (utilization > 60) return '#ff9800'; // Laranja
    return '#4caf50'; // Verde
  };

  // Componente para adicionar eventos ao mapa
  function MapEvents() {
    useMapEvents({
      mousemove: (e) => {
        // Ocultar tooltips quando o mouse se move pelo mapa (não sobre elementos)
        const target = e.originalEvent.target as HTMLElement;
        if (!target.closest('.equipment-marker') && !target.closest('.leaflet-interactive')) {
          setEquipmentTooltip(prev => ({ ...prev, visible: false }));
          setRouteTooltip(prev => ({ ...prev, visible: false }));
        }
      },
      click: (e) => {
        // Se estiver em modo de edição de rota, adicionar ponto
        if (routeEditMode && editingRoute) {
          const { lat, lng } = e.latlng;
          addPointToRoute(editingRoute, [lat, lng]);
        }
      }
    });
    return null;
  }

  // Função para adicionar ponto a uma rota em edição
  const addPointToRoute = (routeId: string, newPoint: [number, number]) => {
    setRoutes(prevRoutes =>
      prevRoutes.map(route => {
        if (route.id === routeId) {
          const newPath = [...route.path];
          // Inserir o novo ponto na posição mais apropriada
          const insertIndex = findBestInsertionPoint(newPath, newPoint);
          newPath.splice(insertIndex, 0, newPoint);
          
          return {
            ...route,
            path: newPath,
            isCalculated: false, // Marcar como editado manualmente
            distance: calculateDistance(newPath)
          };
        }
        return route;
      })
    );
  };

  // Encontrar a melhor posição para inserir um novo ponto
  const findBestInsertionPoint = (path: [number, number][], newPoint: [number, number]): number => {
    if (path.length <= 1) return path.length;
    
    let minDistance = Infinity;
    let bestIndex = 1;
    
    for (let i = 0; i < path.length - 1; i++) {
      const segmentDistance = distanceToSegment(newPoint, path[i], path[i + 1]);
      if (segmentDistance < minDistance) {
        minDistance = segmentDistance;
        bestIndex = i + 1;
      }
    }
    
    return bestIndex;
  };

  // Calcular distância de um ponto para um segmento de linha
  const distanceToSegment = (
    point: [number, number], 
    segmentStart: [number, number], 
    segmentEnd: [number, number]
  ): number => {
    const [px, py] = point;
    const [x1, y1] = segmentStart;
    const [x2, y2] = segmentEnd;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
    const projection = [x1 + t * dx, y1 + t * dy];
    
    return Math.sqrt((px - projection[0]) ** 2 + (py - projection[1]) ** 2);
  };

  // Função para resetar uma rota para linha reta
  const resetRouteToStraight = (routeId: string) => {
    setRoutes(prevRoutes =>
      prevRoutes.map(route => {
        if (route.id === routeId) {
          const fromEquip = equipments.find(eq => eq.id === route.from);
          const toEquip = equipments.find(eq => eq.id === route.to);
          
          if (fromEquip && toEquip) {
            const straightPath = [fromEquip.coordinates, toEquip.coordinates];
            return {
              ...route,
              path: straightPath,
              isCalculated: false,
              distance: calculateDistance(straightPath)
            };
          }
        }
        return route;
      })
    );
  };

  // Função para centralizar no equipamento
  const centerOnEquipment = (equipment: Equipment) => {
    console.log('Centralizando no equipamento:', equipment.name);
  };

  // Filtrar equipamentos por busca
  const filteredEquipments = equipments.filter(eq => 
    eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eq.details.ip.includes(searchQuery)
  );

  // Event handlers para tooltips dos equipamentos
  const handleEquipmentMouseEnter = (equipment: Equipment, event: any) => {
    const rect = event.target.getBoundingClientRect();
    setEquipmentTooltip({
      equipment,
      position: { x: rect.left, y: rect.top },
      visible: true
    });
  };

  const handleEquipmentMouseLeave = () => {
    setEquipmentTooltip(prev => ({ ...prev, visible: false }));
  };

  // Event handlers para tooltips das rotas
  const handleRouteMouseEnter = (route: Route, event: any) => {
    const rect = event.target.getBoundingClientRect();
    setRouteTooltip({
      route,
      position: { x: rect.left, y: rect.top },
      visible: true
    });
  };

  const handleRouteMouseLeave = () => {
    setRouteTooltip(prev => ({ ...prev, visible: false }));
  };

  // Renderizar conteúdo baseado na aba atual
  const renderContent = () => {
    if (currentTab === 1) {
      return (
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: '#0a0a0a',
          color: 'white'
        }}>
          <Card sx={{ p: 4, bgcolor: '#1e1e1e', textAlign: 'center' }}>
            <Typography variant="h5" sx={{ mb: 2, color: '#ff4b5c' }}>
              🔀 Topologia Lógica
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Diagrama interativo da topologia de rede
            </Typography>
            <Typography variant="body2" sx={{ color: '#aaa' }}>
              Funcionalidade em desenvolvimento...
            </Typography>
          </Card>
        </Box>
      );
    }

    // Mapa Geográfico (aba 0)
    return (
      <Box sx={{ height: '100%', position: 'relative' }}>
        {/* Loading overlay */}
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <Card sx={{ p: 3, bgcolor: '#1e1e1e' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={24} />
                <Typography sx={{ color: 'white' }}>Carregando dados da rede...</Typography>
              </Box>
            </Card>
          </Box>
        )}

        {/* Error message */}
        {error && (
          <Alert
            severity="warning"
            sx={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
            }}
          >
            {error}
          </Alert>
        )}

        {/* Routes loading indicator */}
        {routesLoading && (
          <Alert
            severity="info"
            sx={{
              position: 'absolute',
              top: error ? 80 : 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              Calculando rotas por vias terrestres...
            </Box>
          </Alert>
        )}

        {/* Route edit mode indicator */}
        {routeEditMode && (
          <Alert
            severity="warning"
            sx={{
              position: 'absolute',
              top: (error ? 80 : 20) + (routesLoading ? 60 : 0),
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Edit fontSize="small" />
              {editingRoute 
                ? `Editando rota ${editingRoute} - Clique no mapa para adicionar pontos`
                : 'Modo de edição ativo - Selecione uma rota para editar'
              }
            </Box>
          </Alert>
        )}

        <MapContainer
          center={[-14.2350, -51.9253]}
          zoom={5}
          style={{ 
            height: '100%', 
            width: '100%', 
            filter: darkMode ? 'brightness(0.3) contrast(1.5) saturate(0.8)' : 'brightness(0.7) contrast(1.2)',
            border: 'none',
            outline: 'none',
            background: 'transparent'
          }}
          scrollWheelZoom={true}
          zoomControl={!isMobile}
          className={routeEditMode ? 'editing-mode' : ''}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={darkMode 
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
            maxZoom={19}
          />
          
          <MapEvents />
          
          {/* Markers de Equipamentos com eventos de mouse */}
          {equipments.map((equipment) => (
            <Marker
              key={equipment.id}
              position={equipment.coordinates}
              icon={createCustomIcon(equipment.type, equipment.status)}
              eventHandlers={{
                mouseover: (e) => handleEquipmentMouseEnter(equipment, e.originalEvent),
                mouseout: handleEquipmentMouseLeave,
              }}
            >
              <Popup>
                <div style={{ minWidth: '250px', color: '#333' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>{equipment.name}</h3>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ 
                      background: equipment.status === 'online' ? '#4caf50' : '#f44336',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {equipment.status.toUpperCase()}
                    </span>
                  </div>
                  <p><strong>IP:</strong> {equipment.details.ip}</p>
                  <p><strong>Modelo:</strong> {equipment.details.model}</p>
                  <p><strong>Tipo:</strong> {equipment.type}</p>
                  {equipment.details.clients && (
                    <p><strong>Clientes:</strong> {equipment.details.clients}</p>
                  )}
                  {equipment.details.uptime && (
                    <p><strong>Uptime:</strong> {equipment.details.uptime}</p>
                  )}
                  {equipment.details.signal && (
                    <p><strong>Sinal:</strong> {equipment.details.signal}%</p>
                  )}
                  <div style={{ marginTop: '10px' }}>
                    <button 
                      style={{
                        background: '#1976d2',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => centerOnEquipment(equipment)}
                    >
                      Ações de Engenharia
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Linhas de Rotas com efeito animado de fluxo de dados */}
          {showRoutes && routes.map((route) => {
            const isEditing = editingRoute === route.id;
            const routeColor = isEditing ? '#ff4b5c' : getRouteColor(route.utilization);
            const routeWeight = isEditing ? 5 : Math.max(3, route.utilization / 15);
            const routeOpacity = isEditing ? 1 : 0.8;
            
            // Define padrão animado baseado no tipo e utilização - PONTILHADO MENOR COM ESPAÇAMENTO
            const getAnimatedDashArray = () => {
              if (isEditing) return '3, 6';  // Edição: traço pequeno, espaço maior
              
              switch (route.type) {
                case 'fiber':
                  return route.utilization > 70 ? '5, 6' : '8, 6'; // Fibra óptica: espaçamento maior
                case 'radio':
                  return '6, 8'; // Rádio: espaçamento maior
                case 'metallic':
                  return route.utilization > 50 ? '4, 6' : '9, 6'; // Metálico: espaçamento maior
                default:
                  return '6, 6'; // Padrão: espaçamento uniforme
              }
            };
            
            // Classe simples para identificação
            const getRouteClass = () => {
              return isEditing ? 'editing-route' : 'animated-route';
            };
            
            return (
            <Polyline
              key={route.id}
              positions={route.path}
              color={routeColor}
              weight={routeWeight}
              opacity={routeOpacity}
              dashArray={getAnimatedDashArray()}
              className={getRouteClass()}
              eventHandlers={{
                mouseover: (e) => handleRouteMouseEnter(route, e.originalEvent),
                mouseout: handleRouteMouseLeave,
                click: () => {
                  if (routeEditMode) {
                    setEditingRoute(editingRoute === route.id ? null : route.id);
                  }
                }
              }}
            >
              <Popup>
                <div style={{ color: '#333' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>
                    Enlace {route.bandwidth}
                    {isEditing && <span style={{ color: '#ff4b5c' }}> (Editando)</span>}
                  </h4>
                  <p><strong>Tipo:</strong> {route.type}</p>
                  <p><strong>Bandwidth:</strong> {route.bandwidth}</p>
                  <p><strong>Pontos na rota:</strong> {route.path.length}</p>
                  <p><strong>Utilização:</strong> 
                    <span style={{
                      color: route.utilization > 80 ? '#f44336' : route.utilization > 60 ? '#ff9800' : '#4caf50',
                      fontWeight: 'bold'
                    }}>
                      {route.utilization.toFixed(1)}%
                    </span>
                  </p>
                  {route.distance && (
                    <p><strong>Distância:</strong> {(route.distance / 1000).toFixed(1)} km</p>
                  )}
                  <p><strong>Status do Tráfego:</strong> 
                    <span style={{ 
                      color: route.utilization > 80 ? '#f44336' : 
                             route.utilization > 50 ? '#ff9800' : '#4caf50',
                      fontWeight: 'bold'
                    }}>
                      {route.utilization > 80 ? '🔴 Alto' : 
                       route.utilization > 50 ? '🟡 Médio' : '🟢 Baixo'}
                    </span>
                  </p>
                  {routeEditMode && (
                    <div style={{ marginTop: '10px' }}>
                      <button 
                        style={{
                          background: isEditing ? '#f44336' : '#ff4b5c',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                        onClick={() => setEditingRoute(isEditing ? null : route.id)}
                      >
                        {isEditing ? 'Parar Edição' : 'Editar Rota'}
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            </Polyline>
            );
          })}
        </MapContainer>

        {/* Tooltips Flutuantes */}
        <EquipmentTooltip
          equipment={equipmentTooltip.equipment!}
          position={equipmentTooltip.position}
          visible={equipmentTooltip.visible}
        />
        
        <RouteTooltip
          route={routeTooltip.route!}
          position={routeTooltip.position}
          visible={routeTooltip.visible}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100%', 
      bgcolor: '#0a0a0a', 
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* CSS para animações avançadas de fluxo de dados */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .equipment-marker:hover {
          transform: scale(1.2) !important;
          box-shadow: 0 6px 20px rgba(0,0,0,0.5) !important;
        }
        
        /* ====== ANIMAÇÕES DE FLUXO DE DADOS NOS ENLACES ====== */
        
        /* Animação para fibra óptica - fluxo rápido - AJUSTADO PARA ESPAÇAMENTO MAIOR */
        @keyframes fiberFlow {
          0% { 
            stroke-dashoffset: 0;
          }
          100% { 
            stroke-dashoffset: -14px;
          }
        }
        
        /* Animação para rádio - fluxo pulsante - AJUSTADO PARA ESPAÇAMENTO MAIOR */
        @keyframes radioFlow {
          0% { 
            stroke-dashoffset: 0;
            opacity: 0.8;
          }
          50% { 
            opacity: 1;
          }
          100% { 
            stroke-dashoffset: -28px;
            opacity: 0.8;
          }
        }
        
        /* Animação para metálico - fluxo moderado - AJUSTADO PARA ESPAÇAMENTO MAIOR */
        @keyframes metallicFlow {
          0% { 
            stroke-dashoffset: 0;
          }
          100% { 
            stroke-dashoffset: -15px;
          }
        }
        
        /* Animação para edição - AJUSTADO PARA ESPAÇAMENTO MAIOR */
        @keyframes editingPulse {
          0% { opacity: 1; stroke-dashoffset: 0; }
          50% { opacity: 0.6; }
          100% { opacity: 1; stroke-dashoffset: -9px; }
        }
        
        /* APLICAR ANIMAÇÕES DIRETAMENTE AOS ELEMENTOS LEAFLET */
        
        /* Fibra óptica - diferentes velocidades por tráfego - PONTILHADO MENOR COM ESPAÇAMENTO */
        .leaflet-interactive[stroke-dasharray*="8,6"] {
          animation: fiberFlow 3s linear infinite;
        }
        
        .leaflet-interactive[stroke-dasharray*="5,6"] {
          animation: fiberFlow 1.5s linear infinite;
        }
        
        /* Rádio - sempre pontilhado com pulsação - PONTILHADO MENOR COM ESPAÇAMENTO */
        .leaflet-interactive[stroke-dasharray*="6,8"] {
          animation: radioFlow 2.5s ease-in-out infinite;
        }
        
        /* Metálico - diferentes velocidades - PONTILHADO MENOR COM ESPAÇAMENTO */
        .leaflet-interactive[stroke-dasharray*="9,6"] {
          animation: metallicFlow 4s linear infinite;
        }
        
        .leaflet-interactive[stroke-dasharray*="4,6"] {
          animation: metallicFlow 2s linear infinite;
        }
        
        /* Edição - sempre pulsante - PONTILHADO MENOR COM ESPAÇAMENTO */
        .leaflet-interactive[stroke-dasharray*="3,6"] {
          animation: editingPulse 2s infinite;
        }
        
        /* Efeito especial para rotas com muito tráfego - baseado na cor - SEM SOMBRA */
        .leaflet-interactive[stroke="#f44336"] {
          animation: fiberFlow 0.8s linear infinite !important;
        }
        
        .leaflet-interactive[stroke="#ff9800"] {
          animation: fiberFlow 1.2s linear infinite !important;
        }
        
        .leaflet-interactive[stroke="#4caf50"] {
          animation: fiberFlow 2.5s linear infinite !important;
        }
        
        /* Efeito hover para rotas - SEM SOMBRA */
        .leaflet-interactive:hover {
          opacity: 0.8 !important;
          stroke-width: 5px !important;
        }

        /* Cursor para modo de edição */
        .leaflet-container.editing-mode {
          cursor: crosshair !important;
        }
        
        /* REMOVE TODAS AS LINHAS VERMELHAS DO MAPA */
        .leaflet-container,
        .leaflet-container * {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        
        .leaflet-container {
          background: transparent !important;
        }
        
        .leaflet-control-container {
          position: relative !important;
        }
        
        /* Remove linhas de grade e debug */
        .leaflet-tile-container,
        .leaflet-layer,
        .leaflet-overlay-pane,
        .leaflet-map-pane,
        .leaflet-pane,
        .leaflet-tile,
        .leaflet-zoom-box {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        
        /* Remove qualquer borda vermelha que possa aparecer */
        .leaflet-container::before,
        .leaflet-container::after,
        .leaflet-container *::before,
        .leaflet-container *::after {
          border: none !important;
          content: none !important;
        }
        
        /* Força remoção de qualquer elemento com borda vermelha */
        [style*="border: 1px solid red"],
        [style*="border:1px solid red"],
        [style*="border-color: red"],
        [style*="border-color:red"] {
          border: none !important;
        }
      `}</style>

      {/* Header com Tabs - Responsivo */}
      <Box sx={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        bgcolor: '#1e1e1e',
        borderBottom: '1px solid #333'
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          p: isMobile ? 1 : 2,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 1 : 0
        }}>
          <Typography 
            variant={isMobile ? "subtitle1" : "h6"} 
            sx={{ color: '#ff4b5c', fontWeight: 'bold' }}
          >
                            CoreWiseMaps - Topologia de Rede
          </Typography>
          
          <Tabs 
            value={currentTab} 
            onChange={(_, newValue) => setCurrentTab(newValue)}
            sx={{
              '& .MuiTab-root': { 
                color: '#aaa',
                minHeight: isMobile ? 40 : 48,
                fontSize: isMobile ? '0.8rem' : '0.875rem'
              },
              '& .Mui-selected': { color: '#ff4b5c' },
              '& .MuiTabs-indicator': { backgroundColor: '#ff4b5c' }
            }}
          >
            <Tab 
              icon={<MapIcon />} 
              label={isMobile ? "Mapa" : "Mapa Geográfico"}
              sx={{ minHeight: isMobile ? 40 : 48 }}
            />
            <Tab 
              icon={<AccountTree />} 
              label={isMobile ? "Topologia" : "Topologia Lógica"}
              sx={{ minHeight: isMobile ? 40 : 48 }}
            />
          </Tabs>
        </Box>
      </Box>

      {/* Conteúdo principal */}
      <Box sx={{ pt: isMobile ? '100px' : '80px', height: isMobile ? 'calc(100vh - 100px)' : 'calc(100vh - 80px)' }}>
        {renderContent()}
      </Box>

      {/* Controles do Mapa - Responsivos */}
      {currentTab === 0 && (
        <>
          <Box sx={{ 
            position: 'absolute', 
            top: isMobile ? 110 : 100, 
            right: isMobile ? 10 : 20, 
            zIndex: 1000 
          }}>
            <Card sx={{ p: 1, mb: 2, bgcolor: '#1e1e1e', border: '1px solid #333' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Tooltip title="Atualizar Dados">
                  <span>
                    <IconButton 
                      size="small" 
                      onClick={fetchNetworkData} 
                      disabled={loading}
                      sx={{ color: 'white' }}
                    >
                    <Refresh />
                  </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Recalcular Rotas por Vias Terrestres">
                  <span>
                    <IconButton 
                      size="small" 
                      onClick={() => calculateRealRoutes(routes)} 
                      disabled={routesLoading || routes.length === 0}
                      sx={{ 
                        color: routesLoading ? '#ff9800' : routes.some(r => r.isCalculated) ? '#4caf50' : 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                      }}
                    >
                      <RouteIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={darkMode ? "Modo Claro" : "Modo Escuro"}>
                  <IconButton 
                    size="small" 
                    onClick={() => setDarkMode(!darkMode)} 
                    sx={{ 
                      color: darkMode ? '#ffd700' : 'white',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    {darkMode ? <LightMode /> : <DarkMode />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={routeEditMode ? "Sair do Modo Edição" : "Modo Edição de Rotas"}>
                  <span>
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        setRouteEditMode(!routeEditMode);
                        setEditingRoute(null);
                      }}
                      sx={{ 
                        color: routeEditMode ? '#ff4b5c' : 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                      }}
                    >
                      <Edit />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Painel de Controle">
                  <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: 'white' }}>
                    <Layers />
                  </IconButton>
                </Tooltip>
              </Box>
            </Card>
          </Box>

          {/* Barra de Busca - Responsiva */}
          <Box sx={{ 
            position: 'absolute', 
            top: isMobile ? 110 : 100, 
            left: isMobile ? 10 : 20, 
            zIndex: 1000,
            right: isMobile ? 70 : 'auto'
          }}>
            <Card sx={{ 
              p: isMobile ? 1 : 2, 
              minWidth: isMobile ? 'auto' : 300, 
              bgcolor: '#1e1e1e', 
              border: '1px solid #333' 
            }}>
              <TextField
                fullWidth
                placeholder={isMobile ? "Buscar..." : "Buscar equipamento ou IP..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: '#aaa' }} />,
                }}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: '#333' },
                    '&:hover fieldset': { borderColor: '#ff4b5c' },
                    '&.Mui-focused fieldset': { borderColor: '#ff4b5c' },
                  },
                  '& .MuiInputLabel-root': { color: '#aaa' },
                }}
              />
            </Card>
          </Box>
        </>
      )}

      {/* Botão de Volta - Responsivo - POSIÇÃO AJUSTADA */}
      {onBack && (
        <Box sx={{ 
          position: 'absolute', 
          bottom: isMobile ? 20 : 30, 
          right: isMobile ? 10 : 25, 
          zIndex: 1000 
        }}>
          <Button
            variant="contained"
            onClick={onBack}
            startIcon={<ArrowBack />}
            size="small"
            sx={{
              bgcolor: '#ff4b5c',
              '&:hover': { bgcolor: '#d32f2f' },
              color: 'white',
              fontSize: '0.8rem',
              padding: '6px 12px'
            }}
          >
            Voltar
          </Button>
        </Box>
      )}

      {/* Painel Lateral - Responsivo */}
      {currentTab === 0 && (
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: isMobile ? '90%' : isTablet ? 320 : 350,
              bgcolor: '#1e1e1e',
              color: 'white',
              border: '1px solid #333',
            },
          }}
        >
          <Box sx={{ p: isMobile ? 2 : 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff4b5c' }}>
              Controles do Mapa
            </Typography>
            
            {/* Controles de Visualização */}
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#2a2a2a' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'white' }}>
                Visualização
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={darkMode}
                    onChange={(e) => setDarkMode(e.target.checked)}
                    icon={<LightMode sx={{ fontSize: 16 }} />}
                    checkedIcon={<DarkMode sx={{ fontSize: 16 }} />}
                  />
                }
                label={darkMode ? "Modo Escuro" : "Modo Claro"}
                sx={{ color: 'white', display: 'flex', mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showRoutes}
                    onChange={(e) => setShowRoutes(e.target.checked)}
                  />
                }
                label="Mostrar Rotas"
                sx={{ color: 'white' }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                  />
                }
                label="Mostrar Labels"
                sx={{ color: 'white' }}
              />
            </Paper>

            {/* Informações das Rotas */}
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#2a2a2a' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'white' }}>
                Rotas ({routes.length})
              </Typography>
              
              {/* Estatísticas das rotas */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    🛣️ Por vias terrestres:
                  </Typography>
                  <Chip
                    label={routes.filter(r => r.isCalculated).length}
                    size="small"
                    sx={{ bgcolor: '#4caf50', color: 'white' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#aaa' }}>
                    📏 Rotas diretas/editadas:
                  </Typography>
                  <Chip
                    label={routes.filter(r => !r.isCalculated).length}
                    size="small"
                    sx={{ bgcolor: '#ff9800', color: 'white' }}
                  />
                </Box>
              </Box>

              {/* Controles gerais */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={routesLoading ? <CircularProgress size={16} /> : <RouteIcon />}
                  onClick={() => calculateRealRoutes(routes)}
                  disabled={routesLoading || routes.length === 0}
                  sx={{
                    color: 'white',
                    borderColor: '#ff4b5c',
                    '&:hover': { borderColor: '#d32f2f', bgcolor: 'rgba(255,75,92,0.1)' },
                    '&:disabled': { borderColor: '#555', color: '#777' },
                    flex: 1
                  }}
                >
                  {routesLoading ? 'Calc...' : 'Recalcular'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Edit />}
                  onClick={() => {
                    setRouteEditMode(!routeEditMode);
                    setEditingRoute(null);
                  }}
                  sx={{
                    color: routeEditMode ? '#ff4b5c' : 'white',
                    borderColor: routeEditMode ? '#ff4b5c' : '#666',
                    '&:hover': { borderColor: '#ff4b5c', bgcolor: 'rgba(255,75,92,0.1)' },
                    flex: 1
                  }}
                >
                  {routeEditMode ? 'Sair' : 'Editar'}
                </Button>
              </Box>

              {/* Lista de rotas individuais */}
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'white' }}>
                Edição Individual
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {routes.map((route) => (
                  <Paper 
                    key={route.id} 
                    sx={{ 
                      p: 1, 
                      mb: 1, 
                      bgcolor: editingRoute === route.id ? '#444' : '#333',
                      border: editingRoute === route.id ? '1px solid #ff4b5c' : '1px solid transparent'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                        {route.id.toUpperCase()} - {route.bandwidth}
                      </Typography>
                      <Chip
                        label={route.isCalculated ? 'Auto' : 'Manual'}
                        size="small"
                        sx={{ 
                          bgcolor: route.isCalculated ? '#4caf50' : '#ff9800', 
                          color: 'white',
                          fontSize: '0.6rem'
                        }}
                      />
                    </Box>
                    
                    <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 1 }}>
                      {route.path.length} pontos • {route.distance ? `${(route.distance / 1000).toFixed(1)} km` : 'N/A'}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<Edit />}
                        onClick={() => {
                          setEditingRoute(editingRoute === route.id ? null : route.id);
                          setRouteEditMode(true);
                        }}
                        sx={{ 
                          color: editingRoute === route.id ? '#ff4b5c' : 'white',
                          fontSize: '0.7rem',
                          minWidth: 'auto',
                          px: 1
                        }}
                      >
                        {editingRoute === route.id ? 'Parar' : 'Editar'}
                      </Button>
                      
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<Undo />}
                        onClick={() => resetRouteToStraight(route.id)}
                        sx={{ 
                          color: '#ff9800',
                          fontSize: '0.7rem',
                          minWidth: 'auto',
                          px: 1
                        }}
                      >
                        Reset
                      </Button>
                      
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<RouteIcon />}
                        onClick={() => calculateRealRoutes([route])}
                        disabled={routesLoading}
                        sx={{ 
                          color: '#4caf50',
                          fontSize: '0.7rem',
                          minWidth: 'auto',
                          px: 1
                        }}
                      >
                        Auto
                      </Button>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Paper>

            {/* Lista de Equipamentos */}
            <Paper sx={{ bgcolor: '#2a2a2a', maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="subtitle2" sx={{ p: 2, color: 'white' }}>
                Equipamentos ({filteredEquipments.length})
              </Typography>
              <List dense>
                {filteredEquipments.map((equipment) => (
                  <ListItemButton
                    key={equipment.id}
                    onClick={() => centerOnEquipment(equipment)}
                    sx={{ 
                      '&:hover': { bgcolor: '#3a3a3a' },
                      color: 'white'
                    }}
                  >
                    <ListItemIcon>
                      <Avatar 
                        sx={{ 
                          width: 24, 
                          height: 24, 
                          bgcolor: equipment.status === 'online' ? 'success.main' : 'error.main'
                        }}
                      >
                        {equipment.status === 'online' ? <CheckCircle /> : <Error />}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={equipment.name}
                      secondary={`${equipment.details.ip} • ${equipment.type}`}
                      secondaryTypographyProps={{ color: '#aaa' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Box>
        </Drawer>
      )}

      {/* Status Bar - Responsivo */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: '#1e1e1e',
          color: 'white',
          p: isMobile ? 0.5 : 1,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #333',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 0.5 : 0
        }}
      >
        <Box sx={{ display: 'flex', gap: isMobile ? 1 : 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip 
            icon={<CheckCircle />} 
            label={`Online: ${equipments.filter(e => e.status === 'online').length}`}
            color="success"
            size="small"
          />
          <Chip 
            icon={<Warning />} 
            label={`Aviso: ${equipments.filter(e => e.status === 'warning').length}`}
            color="warning"
            size="small"
          />
          <Chip 
            icon={<Error />} 
            label={`Offline: ${equipments.filter(e => e.status === 'offline').length}`}
            color="error"
            size="small"
          />
        </Box>
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#aaa',
            fontSize: isMobile ? '0.7rem' : '0.75rem',
            textAlign: 'center'
          }}
        >
          Última atualização: {new Date().toLocaleTimeString()} | 
          Modo: {currentTab === 0 ? 'Geográfico' : 'Topologia'}
        </Typography>
      </Box>
    </Box>
  );
}
