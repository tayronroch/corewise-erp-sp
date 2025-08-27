import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
} from 'reactflow';
import L2VPNConfiguration from '../networking/l2vpn-configuration';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Drawer,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Tooltip,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Refresh,
  Settings,
  Layers,
  ArrowBack,
  Router as RouterIcon,
  DeviceHub,
} from '@mui/icons-material';
import axios from 'axios';
import 'reactflow/dist/style.css';

// Tipos para a topologia
interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  last_update: string;
}

interface TopologyNode {
  id: string;
  label: string;
  type: 'switch' | 'router' | 'server';
  ip?: string;
  status: 'online' | 'offline' | 'warning';
  position: { x: number; y: number };
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  bandwidth: string;
  traffic_in: string;
  traffic_out: string;
  utilization: number;
  status: 'active' | 'inactive';
}

// Componente customizado para nós
const CustomNode = ({ data }: { data: { label: string; type: string; ip?: string; status: string } }) => {
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'router':
        return <RouterIcon sx={{ fontSize: 32, color: '#4fc3f7' }} />;
      case 'switch':
        return <DeviceHub sx={{ fontSize: 32, color: '#81c784' }} />;
      default:
        return <DeviceHub sx={{ fontSize: 32, color: '#ffb74d' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return '#4caf50';
      case 'warning':
        return '#ff9800';
      case 'offline':
        return '#f44336';
      default:
        return '#757575';
    }
  };

  return (
    <Card
      sx={{
        p: 2,
        minWidth: 150,
        bgcolor: '#1e1e1e',
        border: `2px solid ${getStatusColor(data.status)}`,
        borderRadius: 2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        '&:hover': {
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          transform: 'translateY(-2px)',
        },
        transition: 'all 0.3s ease',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {getNodeIcon(data.type)}
        <Box>
          <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
            {data.label}
          </Typography>
          <Typography variant="caption" sx={{ color: '#aaa' }}>
            {data.ip}
          </Typography>
        </Box>
      </Box>
      <Chip
        label={data.status.toUpperCase()}
        size="small"
        sx={{
          mt: 1,
          bgcolor: getStatusColor(data.status),
          color: 'white',
          fontSize: '0.7rem',
        }}
      />
    </Card>
  );
};

// Tipos de nós customizados
const nodeTypes = {
  custom: CustomNode,
};

interface NetworkTopologyProps {
  onBack?: () => void;
}

export default function NetworkTopology({ onBack }: NetworkTopologyProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [showL2VPNConfig, setShowL2VPNConfig] = useState(false);
  const [showNetworkingPanel, setShowNetworkingPanel] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [topologyData, setTopologyData] = useState<TopologyData | null>(null);

  // Função para buscar dados da topologia
  const fetchTopologyData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Chamada para a API do backend
      const response = await axios.get('/api/v1/topology/', {
        withCredentials: true,
      });
      
      const data: TopologyData = response.data;
      setTopologyData(data);
      
      // Converter dados para formato React Flow
      const flowNodes: Node[] = data.nodes.map((node) => ({
        id: node.id,
        type: 'custom',
        position: node.position,
        data: {
          label: node.label,
          type: node.type,
          ip: node.ip,
          status: node.status,
        },
        dragHandle: '.drag-handle',
      }));

      const flowEdges: Edge[] = data.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: edge.status === 'active',
        style: {
          stroke: edge.utilization > 80 ? '#f44336' : edge.utilization > 60 ? '#ff9800' : '#4caf50',
          strokeWidth: Math.max(2, edge.utilization / 20),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edge.utilization > 80 ? '#f44336' : edge.utilization > 60 ? '#ff9800' : '#4caf50',
        },
        label: `${edge.bandwidth}\n${edge.utilization.toFixed(1)}%`,
        labelStyle: {
          fill: 'white',
          fontWeight: 'bold',
          fontSize: '12px',
        },
        labelBgStyle: {
          fill: '#1e1e1e',
          fillOpacity: 0.8,
        },
        data: {
          bandwidth: edge.bandwidth,
          traffic_in: edge.traffic_in,
          traffic_out: edge.traffic_out,
          utilization: edge.utilization,
        },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      
    } catch (err) {
      console.error('Erro ao buscar dados de topologia:', err);
      setError('Erro ao carregar dados da topologia. Usando dados simulados.');
      
      // Fallback para dados mock
      const mockNodes: Node[] = [
        {
          id: 'sw1',
          type: 'custom',
          position: { x: 250, y: 50 },
          data: { label: 'Core-Switch-SP', type: 'switch', ip: '192.168.1.1', status: 'online' },
        },
        {
          id: 'sw2',
          type: 'custom',
          position: { x: 450, y: 200 },
          data: { label: 'Distrib-Switch-RJ', type: 'switch', ip: '192.168.1.2', status: 'online' },
        },
        {
          id: 'rt1',
          type: 'custom',
          position: { x: 50, y: 200 },
          data: { label: 'Router-Core-BSB', type: 'router', ip: '192.168.1.10', status: 'online' },
        },
      ];

      const mockEdges: Edge[] = [
        {
          id: 'e1',
          source: 'sw1',
          target: 'sw2',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#4caf50', strokeWidth: 3 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#4caf50' },
          label: '10Gbps\n60%',
          labelStyle: { fill: 'white', fontWeight: 'bold' },
          labelBgStyle: { fill: '#1e1e1e', fillOpacity: 0.8 },
        },
        {
          id: 'e2',
          source: 'rt1',
          target: 'sw1',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#ff9800', strokeWidth: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#ff9800' },
          label: '40Gbps\n75%',
          labelStyle: { fill: 'white', fontWeight: 'bold' },
          labelBgStyle: { fill: '#1e1e1e', fillOpacity: 0.8 },
        },
      ];

      setNodes(mockNodes);
      setEdges(mockEdges);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  // Carregar dados na inicialização
  useEffect(() => {
    fetchTopologyData();
  }, [fetchTopologyData]);

  // Auto refresh a cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchTopologyData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTopologyData]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const nodeData = topologyData?.nodes.find(n => n.id === node.id);
    if (nodeData) {
      setSelectedNode(nodeData);
      setShowNetworkingPanel(true);
    }
  }, [topologyData]);

  return (
    <Box sx={{
      height: '100vh',
      width: '100%',
      background: '#0a0a0a',
      position: 'relative',
    }}>
      {/* Loading overlay */}
      {loading && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <Card sx={{
            padding: '24px',
            background: '#1e1e1e',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={24} />
              <Typography sx={{ color: 'white' }}>Carregando topologia...</Typography>
            </Box>
          </Card>
        </Box>
      )}

      {/* Error message */}
      {error && (
        <Alert
          severity="warning"
          style={{
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

      {/* Main topology view */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls
          style={{
            backgroundColor: '#1e1e1e',
            border: '1px solid #333',
          }}
        />
        
        <MiniMap
          style={{
            backgroundColor: '#1e1e1e',
            border: '1px solid #333',
          }}
          nodeColor={(node) => {
            switch (node.data?.status) {
              case 'online':
                return '#4caf50';
              case 'warning':
                return '#ff9800';
              case 'offline':
                return '#f44336';
              default:
                return '#757575';
            }
          }}
        />
        
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#333"
        />
      </ReactFlow>

      {/* Controls toolbar */}
      <Box sx={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 1000,
      }}>
        <Card sx={{ bgcolor: '#1e1e1e', border: '1px solid #333' }}>
          <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Tooltip title="Atualizar Topologia">
              <IconButton
                onClick={fetchTopologyData}
                disabled={loading}
                sx={{ color: 'white' }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Painel de Controle">
              <IconButton sx={{ color: 'white' }}>
                <Settings />
              </IconButton>
            </Tooltip>

            <Tooltip title="Camadas">
              <IconButton sx={{ color: 'white' }}>
                <Layers />
              </IconButton>
            </Tooltip>

            {onBack && (
              <Tooltip title="Voltar">
                <IconButton onClick={onBack} sx={{ color: 'white' }}>
                  <ArrowBack />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Card>
      </Box>

      {/* Networking Panel Drawer */}
      <Drawer
        anchor="right"
        open={showNetworkingPanel}
        onClose={() => setShowNetworkingPanel(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: '350px',
            bgcolor: '#1e1e1e',
            color: 'white',
            padding: '16px',
          },
        }}
      >
        {selectedNode && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: '#4fc3f7' }}>
              {selectedNode.label}
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
              IP: {selectedNode.ip || 'N/A'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: '#ccc' }}>
              Status: {selectedNode.status}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                fullWidth
                variant="contained"
                sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
                onClick={() => {
                  // Implementar OSPF
                  console.log('OSPF para:', selectedNode.id);
                }}
              >
                OSPF Configuration
              </Button>
              
              <Button
                fullWidth
                variant="contained"
                sx={{ bgcolor: '#ff9800', '&:hover': { bgcolor: '#f57c00' } }}
                onClick={() => {
                  // Implementar MPLS TE
                  console.log('MPLS TE para:', selectedNode.id);
                }}
              >
                MPLS TE
              </Button>
              
              <Button
                fullWidth
                variant="contained"
                sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1976d2' } }}
                onClick={() => {
                  setShowL2VPNConfig(true);
                  setShowNetworkingPanel(false);
                }}
              >
                L2VPN Configuration
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* L2VPN Configuration Integration */}
      {showL2VPNConfig && (
        <L2VPNConfiguration
          leftDrawerOpen={false}
          rightDrawerOpen={true}
          selectedHostLeft={null}
          selectedHostRight={null}
          onClose={() => setShowL2VPNConfig(false)}
        />
      )}

    </Box>
  );
}
