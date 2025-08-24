import React, { useEffect, useState, useCallback } from 'react';
import { ReactFlow, MiniMap, Controls, Background, type Edge, type Node } from 'reactflow';
import { api } from '../../services/api';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface Equipment {
  id: number;
  name: string;
  ip_address: string;
  description?: string;
}

interface Link {
  id: number;
  source: number;
  target: number;
  ptp_ip: string;
  capacity_mbps: number;
}

export default function NetworkMap() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [traffic, setTraffic] = useState<{[key: number]: {in: number, out: number}} | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEquip, setSelectedEquip] = useState<Equipment | null>(null);

  useEffect(() => {
    async function fetchData() {
      const eqRes = await api.get('/api/topology/equipments/');
      const linkRes = await api.get('/api/topology/links/');
      setNodes(eqRes.data.map((eq: Equipment, idx: number) => ({
        id: eq.id.toString(),
        data: { label: `${eq.name} (${eq.ip_address})`, ...eq },
        position: { x: 100 + idx * 200, y: 200 },
      })));
      setEdges(linkRes.data.map((lk: Link) => ({
        id: lk.id.toString(),
        source: lk.source.toString(),
        target: lk.target.toString(),
        label: `${lk.ptp_ip || ''} (${lk.capacity_mbps || ''} Mbps)`
      })));
    }
    fetchData();
  }, []);

  const onEdgeMouseEnter = useCallback(async (_: React.MouseEvent, edge: Edge) => {
    setHoveredEdge(Number(edge.id));
    const res = await api.get(`/api/topology/links/${edge.id}/traffic_realtime/`);
    setTraffic(t => ({ ...t, [Number(edge.id)]: { in: res.data.traffic_in_bps, out: res.data.traffic_out_bps } }));
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedEquip(node.data as Equipment);
    setDrawerOpen(true);
  }, []);

  return (
    <div style={{ height: '600px', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges.map(edge => ({
          ...edge,
          label: hoveredEdge === Number(edge.id) && traffic?.[Number(edge.id)]
            ? `${edge.label}\nIn: ${traffic[Number(edge.id)]?.in} bps | Out: ${traffic[Number(edge.id)]?.out} bps`
            : edge.label,
          onMouseEnter: (evt: React.MouseEvent) => onEdgeMouseEnter(evt, edge),
          onMouseLeave: onEdgeMouseLeave,
        }))}
        onNodeClick={onNodeClick}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
      <Drawer 
        anchor="right" 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: '300px',
            padding: '16px',
          },
        }}
      >
        {selectedEquip && (
          <Box>
            <Typography variant="h6" sx={{ marginBottom: '8px' }}>
              {selectedEquip.name}
            </Typography>
            <Typography variant="body2" sx={{ marginBottom: '16px' }}>
              IP: {selectedEquip.ip_address}
            </Typography>
            <Typography variant="body2" sx={{ marginBottom: '16px' }}>
              Tipo: {selectedEquip.description || 'Equipamento'}
            </Typography>
            <Button 
              fullWidth 
              sx={{ marginBottom: '8px' }} 
              variant="contained" 
              color="primary"
            >
              OSPF
            </Button>
            <Button 
              fullWidth 
              sx={{ marginBottom: '8px' }} 
              variant="contained" 
              color="secondary"
            >
              MPLS TE
            </Button>
            <Button 
              fullWidth 
              sx={{ marginBottom: '8px' }} 
              variant="contained"
            >
              L2VPN
            </Button>
            {/* Adicione mais ações conforme necessário */}
          </Box>
        )}
      </Drawer>
    </div>
  );
}
