import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,

  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Map as MapIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { backendApiService } from '../../services/backendApiService';
import type { MapConfiguration } from '../../types/mapTypes';
import { api } from '../../services/api';

interface MapLoaderDebugProps {
  onLoadMap?: (map: MapConfiguration) => void;
}

export const MapLoaderDebug: React.FC<MapLoaderDebugProps> = ({ onLoadMap }) => {
  const [maps, setMaps] = useState<MapConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStats, setBackendStats] = useState<any>(null);
  const [apiTest, setApiTest] = useState<string>('');

  const loadMapsFromBackend = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Carregando mapas do topology-manager...');
      
      const backendMaps = await backendApiService.getAllMapsFromBackend();
      setMaps(backendMaps);
      
      console.log(`📊 ${backendMaps.length} mapas carregados do backend`);
      
      if (backendMaps.length > 0) {
        console.log('🗺️ Primeiro mapa:', backendMaps[0]);
      }
      
    } catch (err: any) {
      console.error('❌ Erro ao carregar mapas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBackendStats = async () => {
    try {
      const stats = await backendApiService.getBackendStats();
      setBackendStats(stats);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  const testApiConnection = async () => {
    try {
      setApiTest('Testando...');
      
      // Testar endpoints do topology-manager - URLs padronizadas
      const endpoints = [
        '/api/topology/topology-projects/',
        '/api/topology/simple/projects/list/',
      ];
      
      const results = [];
      
      for (const endpoint of endpoints) {
        try {
          const response = await api.get(endpoint);
          results.push(`✅ ${endpoint}: ${response.status} - ${response.data?.length || 'OK'} itens`);
        } catch (err: any) {
          results.push(`❌ ${endpoint}: ${err.response?.status || 'ERRO'} - ${err.message}`);
        }
      }
      
      setApiTest(results.join('\n'));
    } catch (err: any) {
      setApiTest(`❌ Erro geral: ${err.message}`);
    }
  };

  useEffect(() => {
    loadMapsFromBackend();
    loadBackendStats();
    testApiConnection();
  }, []);

  return (
    <Box sx={{ p: 3, bgcolor: '#1e1e1e', color: '#fff', minHeight: '100vh' }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#4fc3f7' }}>
        🔧 Debug - Carregador de Mapas
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {/* Status da API */}
        <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
          <Card sx={{ bgcolor: '#2a2a2a', color: '#fff' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📡 Status da API
              </Typography>
              
              {backendStats && (
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={backendStats.backendAvailable ? 'Backend Online' : 'Backend Offline'}
                    color={backendStats.backendAvailable ? 'success' : 'error'}
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip
                    label={`${backendStats.totalProjects} Projetos`}
                    color="info"
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip
                    label={`${backendStats.totalDevices} Dispositivos`}
                    color="warning"
                    sx={{ mr: 1, mb: 1 }}
                  />
                </Box>
              )}

              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={testApiConnection}
                sx={{ mr: 1 }}
              >
                Testar API
              </Button>

              {apiTest && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#1a1a1a', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
                    {apiTest}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Controles */}
        <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
          <Card sx={{ bgcolor: '#2a2a2a', color: '#fff' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⚙️ Controles
              </Typography>

              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
                onClick={loadMapsFromBackend}
                disabled={loading}
                sx={{ mr: 1, mb: 1 }}
              >
                Recarregar Mapas
              </Button>

              <Button
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={loadBackendStats}
                sx={{ mr: 1, mb: 1 }}
              >
                Atualizar Stats
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Mapas Carregados */}
      <Box sx={{ mt: 3 }}>
        <Card sx={{ bgcolor: '#2a2a2a', color: '#fff' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🗺️ Mapas do Topology-Manager ({maps.length})
            </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <CircularProgress size={24} />
                  <Typography>Carregando mapas...</Typography>
                </Box>
              )}

              {maps.length === 0 && !loading && (
                <Alert severity="warning">
                  Nenhum mapa encontrado no topology-manager. Verifique se o backend está rodando e se há projetos criados.
                </Alert>
              )}

              {maps.map((map, index) => (
                <Accordion key={map.id} sx={{ bgcolor: '#333', color: '#fff', mb: 1 }}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}
                    sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <MapIcon sx={{ color: '#4fc3f7' }} />
                      <Typography variant="h6">{map.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                        <Chip
                          size="small"
                          label={`${map.items.length} itens`}
                          color="primary"
                        />
                        <Chip
                          size="small"
                          label={`${map.connections.length} conexões`}
                          color="secondary"
                        />
                        <Chip
                          size="small"
                          label={`${map.connections.filter(c => c.path && c.path.length > 2).length} paths`}
                          color="warning"
                        />
                        {map.properties?.projectType && (
                          <Chip
                            size="small"
                            label={map.properties.projectType}
                            color="success"
                          />
                        )}
                      </Box>
                    </Box>
                  </AccordionSummary>
                  
                  <AccordionDetails sx={{ bgcolor: '#2a2a2a' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: '1 1 45%', minWidth: '250px' }}>
                        <Typography variant="subtitle2" gutterBottom>📍 Informações</Typography>
                        <List dense>
                          <ListItem>
                            <ListItemText
                              primary="ID"
                              secondary={map.id}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Descrição"
                              secondary={map.description || 'Sem descrição'}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Centro"
                              secondary={`${map.center.latitude.toFixed(4)}, ${map.center.longitude.toFixed(4)}`}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Zoom"
                              secondary={map.zoom}
                            />
                          </ListItem>
                        </List>
                      </Box>
                      
                      <Box sx={{ flex: '1 1 45%', minWidth: '250px' }}>
                        <Typography variant="subtitle2" gutterBottom>🔧 Itens</Typography>
                        {map.items.length > 0 ? (
                          <List dense>
                            {map.items.slice(0, 5).map((item) => (
                              <ListItem key={item.id}>
                                <ListItemText
                                  primary={item.name}
                                  secondary={`${item.type} - ${item.geoLocation.latitude.toFixed(4)}, ${item.geoLocation.longitude.toFixed(4)}`}
                                />
                              </ListItem>
                            ))}
                            {map.items.length > 5 && (
                              <ListItem>
                                <ListItemText secondary={`... e mais ${map.items.length - 5} itens`} />
                              </ListItem>
                            )}
                          </List>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Nenhum item encontrado
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {onLoadMap && (
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<MapIcon />}
                        onClick={() => onLoadMap(map)}
                        sx={{ mt: 2 }}
                      >
                        Carregar no MapManager
                      </Button>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        </Box>
    </Box>
  );
};

export default MapLoaderDebug;
