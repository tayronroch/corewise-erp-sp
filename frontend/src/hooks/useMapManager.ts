import { useState, useCallback } from 'react';
import type {
  MapConfiguration,
  MapItem,
  MapConnection,
  MapManagerState,
  EditMode,
  MonitoringData,
} from '../types/mapTypes';
import { localDatabase } from '../services/database';
import { backendApiService } from '../services/backendApiService';

export const useMapManager = () => {
  const [state, setState] = useState<MapManagerState>({
    currentMap: null,
    editMode: {
      active: false,
      tool: 'select',
      selectedItems: [],
    },
    selectedItem: null,
    hoveredItem: null,
    loading: false,
    error: null,
    filters: {
      itemTypes: [],
      connectionTypes: [],
      monitoringStatus: [],
    },
  });

  // Carregar mapas salvos do backend e banco local
  const loadSavedMaps = useCallback(async (): Promise<MapConfiguration[]> => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Tentar carregar do backend primeiro
      const backendMaps = await backendApiService.getAllMapsFromBackend();
      if (backendMaps.length > 0) {
        console.log('Mapas carregados do backend:', backendMaps.length);
        setState(prev => ({ ...prev, loading: false }));
        return backendMaps;
      }

      // Fallback para banco local se backend não disponível
      console.log('Backend não disponível, carregando do localStorage');
      const localMaps = localDatabase.getAllMaps();
      setState(prev => ({ ...prev, loading: false }));
      return localMaps;
    } catch (error) {
      console.error('Erro ao carregar mapas salvos:', error);
      setState(prev => ({
        ...prev,
        error: 'Erro ao carregar mapas salvos',
        loading: false,
      }));
      
      // Fallback final para localStorage
      try {
        return localDatabase.getAllMaps();
      } catch (localError) {
        console.error('Erro no fallback localStorage:', localError);
        return [];
      }
    }
  }, []);

  // Salvar mapa no banco local
  const saveMap = useCallback((map: MapConfiguration) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const success = localDatabase.saveMap(map);
      
      if (success) {
        setState(prev => ({
          ...prev,
          currentMap: map,
          loading: false,
          error: null,
        }));
        console.log('Mapa salvo com sucesso:', map.name);
        return true;
      } else {
        throw new Error('Falha ao salvar no banco de dados');
      }
    } catch (error) {
      console.error('Erro ao salvar mapa:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao salvar mapa',
      }));
      return false;
    }
  }, []);

  // Carregar mapa específico
  const loadMap = useCallback(async (mapId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Tentar carregar do backend primeiro
      let map = await backendApiService.getMapById(mapId);
      
      // Fallback para localStorage se não encontrou no backend
      if (!map) {
        map = localDatabase.getMapById(mapId);
      }
      
      if (map) {
        setState(prev => ({
          ...prev,
          currentMap: map,
          loading: false,
          error: null,
        }));
        console.log('Mapa carregado com sucesso:', map.name, 'Itens:', map.items.length);
        return true;
      }
      
      setState(prev => ({
        ...prev,
        error: 'Mapa não encontrado',
        loading: false,
      }));
      return false;
    } catch (error) {
      console.error('Erro ao carregar mapa:', error);
      setState(prev => ({
        ...prev,
        error: 'Erro ao carregar mapa',
        loading: false,
      }));
      
      // Fallback para localStorage em caso de erro
      try {
        const map = localDatabase.getMapById(mapId);
        if (map) {
          setState(prev => ({
            ...prev,
            currentMap: map,
            error: null,
          }));
          return true;
        }
      } catch (localError) {
        console.error('Erro no fallback localStorage:', localError);
      }
      
      return false;
    }
  }, []);

  // Criar novo mapa
  const createNewMap = useCallback((name: string, description?: string) => {
    const newMap: MapConfiguration = {
      id: `map_${Date.now()}`,
      name,
      description: description || '',
      center: { latitude: -15.7942287, longitude: -47.8821945 }, // Brasília
      zoom: 6,
      items: [],
      connections: [],
      layers: {
        items: true,
        connections: true,
        labels: true,
        monitoring: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'admin', // TODO: pegar do contexto de usuário
    };

    // Salvar no banco imediatamente
    const success = localDatabase.saveMap(newMap);
    
    if (success) {
      setState(prev => ({
        ...prev,
        currentMap: newMap,
        error: null,
      }));
      console.log('Novo mapa criado:', newMap.name);
    } else {
      setState(prev => ({
        ...prev,
        error: 'Erro ao criar novo mapa',
      }));
    }

    return newMap;
  }, []);

  // Adicionar item ao mapa
  const addItem = useCallback((item: Omit<MapItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!state.currentMap) return null;

    const newItem: MapItem = {
      ...item,
      id: `item_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedMap = {
      ...state.currentMap,
      items: [...state.currentMap.items, newItem],
      updatedAt: new Date(),
    };

    // Salvar no banco
    const success = localDatabase.saveMap(updatedMap);
    
    if (success) {
      setState(prev => ({
        ...prev,
        currentMap: updatedMap,
      }));
      console.log('Item adicionado:', newItem.name);
    } else {
      setState(prev => ({
        ...prev,
        error: 'Erro ao adicionar item',
      }));
    }

    return newItem;
  }, [state.currentMap]);

  // Atualizar item
  const updateItem = useCallback((itemId: string, updates: Partial<MapItem>) => {
    if (!state.currentMap) return false;

    const updatedMap = {
      ...state.currentMap,
      items: state.currentMap.items.map(item =>
        item.id === itemId
          ? { ...item, ...updates, updatedAt: new Date() }
          : item
      ),
      updatedAt: new Date(),
    };

    // Salvar no banco
    const success = localDatabase.saveMap(updatedMap);
    
    if (success) {
      setState(prev => ({
        ...prev,
        currentMap: updatedMap,
      }));
      console.log('Item atualizado:', itemId);
    } else {
      setState(prev => ({
        ...prev,
        error: 'Erro ao atualizar item',
      }));
    }

    return success;
  }, [state.currentMap]);

  // Remover item
  const removeItem = useCallback((itemId: string) => {
    if (!state.currentMap) return false;

    const updatedMap = {
      ...state.currentMap,
      items: state.currentMap.items.filter(item => item.id !== itemId),
      connections: state.currentMap.connections.filter(
        conn => conn.sourceId !== itemId && conn.targetId !== itemId
      ),
      updatedAt: new Date(),
    };

    // Salvar no banco
    const success = localDatabase.saveMap(updatedMap);
    
    if (success) {
      setState(prev => ({
        ...prev,
        currentMap: updatedMap,
        selectedItem: prev.selectedItem?.id === itemId ? null : prev.selectedItem,
      }));
      console.log('Item removido:', itemId);
    } else {
      setState(prev => ({
        ...prev,
        error: 'Erro ao remover item',
      }));
    }

    return success;
  }, [state.currentMap]);

  // Adicionar conexão
  const addConnection = useCallback((connection: Omit<MapConnection, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!state.currentMap) return null;

    const newConnection: MapConnection = {
      ...connection,
      id: `conn_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedMap = {
      ...state.currentMap,
      connections: [...state.currentMap.connections, newConnection],
      updatedAt: new Date(),
    };

    // Salvar no banco
    const success = localDatabase.saveMap(updatedMap);
    
    if (success) {
      setState(prev => ({
        ...prev,
        currentMap: updatedMap,
      }));
      console.log('Conexão adicionada:', newConnection.id);
    } else {
      setState(prev => ({
        ...prev,
        error: 'Erro ao adicionar conexão',
      }));
    }

    return newConnection;
  }, [state.currentMap]);

  // Remover conexão
  const removeConnection = useCallback((connectionId: string) => {
    if (!state.currentMap) return false;

    const updatedMap = {
      ...state.currentMap,
      connections: state.currentMap.connections.filter(conn => conn.id !== connectionId),
      updatedAt: new Date(),
    };

    // Salvar no banco
    const success = localDatabase.saveMap(updatedMap);
    
    if (success) {
      setState(prev => ({
        ...prev,
        currentMap: updatedMap,
      }));
      console.log('Conexão removida:', connectionId);
    } else {
      setState(prev => ({
        ...prev,
        error: 'Erro ao remover conexão',
      }));
    }

    return success;
  }, [state.currentMap]);

  // Controles de modo de edição
  const setEditMode = useCallback((editMode: Partial<EditMode>) => {
    setState(prev => ({
      ...prev,
      editMode: { ...prev.editMode, ...editMode },
    }));
  }, []);

  const toggleEditMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      editMode: {
        ...prev.editMode,
        active: !prev.editMode.active,
        tool: 'select',
        selectedItems: [],
      },
    }));
  }, []);

  // Seleção de itens
  const selectItem = useCallback((item: MapItem | null) => {
    setState(prev => ({
      ...prev,
      selectedItem: item,
    }));
  }, []);

  const hoverItem = useCallback((item: MapItem | null) => {
    setState(prev => ({
      ...prev,
      hoveredItem: item,
    }));
  }, []);

  // Filtros
  const updateFilters = useCallback((filters: Partial<typeof state.filters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters },
    }));
  }, []);

  // Função para buscar dados de monitoramento do Zabbix
  const fetchMonitoringData = useCallback(async (hostId: string): Promise<MonitoringData | null> => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // TODO: Implementar integração real com API do Zabbix
      const response = await fetch(`/api/zabbix/monitoring/${hostId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados de monitoramento');
      }
      
      const data = await response.json();
      
      setState(prev => ({ ...prev, loading: false }));
      return data;
    } catch (error) {
      console.error('Erro ao buscar dados de monitoramento:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao buscar dados de monitoramento',
      }));
      return null;
    }
  }, []);

  // Função para validar conectividade de um host
  const validateHost = useCallback(async (ipAddress: string): Promise<boolean> => {
    try {
      // TODO: Implementar ping ou verificação de conectividade real
      const response = await fetch(`/api/network/ping/${ipAddress}`);
      return response.ok;
    } catch (error) {
      console.error('Erro ao validar host:', error);
      return false;
    }
  }, []);

  // Função para calcular distância entre dois pontos geográficos
  const calculateDistance = useCallback((
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distância em km
  }, []);

  // Função para otimizar posicionamento de itens (evitar sobreposição)
  const optimizeItemPositions = useCallback(() => {
    if (!state.currentMap) return;

    const items = state.currentMap.items;
    const minDistance = 0.001; // Distância mínima em graus (~111m)
    
    const optimizedItems = items.map((item, index) => {
      const newPosition = { ...item.geoLocation };
      
      // Verificar sobreposição com outros itens
      items.forEach((otherItem, otherIndex) => {
        if (index !== otherIndex) {
          const distance = calculateDistance(
            newPosition.latitude,
            newPosition.longitude,
            otherItem.geoLocation.latitude,
            otherItem.geoLocation.longitude
          );
          
          if (distance < minDistance) {
            // Ajustar posição para evitar sobreposição
            const angle = Math.random() * 2 * Math.PI;
            newPosition.latitude += Math.cos(angle) * minDistance;
            newPosition.longitude += Math.sin(angle) * minDistance;
          }
        }
      });
      
      return { ...item, geoLocation: newPosition };
    });

    const optimizedMap = {
      ...state.currentMap,
      items: optimizedItems,
      updatedAt: new Date(),
    };

    // Salvar no banco
    const success = localDatabase.saveMap(optimizedMap);
    
    if (success) {
      setState(prev => ({
        ...prev,
        currentMap: optimizedMap,
      }));
    }
  }, [state.currentMap, calculateDistance]);

  // Exportar dados do mapa
  const exportMap = useCallback((format: 'json' | 'csv' = 'json') => {
    if (!state.currentMap) return null;

    if (format === 'json') {
      return JSON.stringify(state.currentMap, null, 2);
    } else if (format === 'csv') {
      // Implementar exportação CSV
      const headers = ['ID', 'Nome', 'Tipo', 'Latitude', 'Longitude', 'Descrição'];
      const rows = state.currentMap.items.map(item => [
        item.id,
        item.name,
        item.type,
        item.geoLocation.latitude.toString(),
        item.geoLocation.longitude.toString(),
        item.description || '',
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return null;
  }, [state.currentMap]);

  // Limpar erros
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Estatísticas do banco
  const getStatistics = useCallback(() => {
    return localDatabase.getStatistics();
  }, []);

  // Auto-save desabilitado pois agora salvamos a cada operação
  // useEffect(() => {
  //   if (state.currentMap) {
  //     const autoSaveInterval = setInterval(() => {
  //       if (state.currentMap) {
  //         saveMap(state.currentMap);
  //       }
  //     }, 30000); // Auto-save a cada 30 segundos

  //     return () => clearInterval(autoSaveInterval);
  //   }
  // }, [state.currentMap, saveMap]);

  return {
    // Estado
    ...state,
    
    // Ações de mapa
    loadSavedMaps,
    saveMap,
    loadMap,
    createNewMap,
    exportMap,
    
    // Ações de itens
    addItem,
    updateItem,
    removeItem,
    selectItem,
    hoverItem,
    
    // Ações de conexões
    addConnection,
    removeConnection,
    
    // Controles de edição
    setEditMode,
    toggleEditMode,
    
    // Filtros
    updateFilters,
    
    // Utilitários
    fetchMonitoringData,
    validateHost,
    calculateDistance,
    optimizeItemPositions,
    clearError,
    getStatistics,
  };
}; 