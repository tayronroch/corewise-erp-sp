import { api } from './api';
import type { MapConfiguration, MapItem, MapConnection } from '../types/mapTypes';
import { API_CONFIG, buildApiUrl } from '../config/api';

export interface BackendProject {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface BackendDevice {
  id: number;
  name: string;
  device_type: string;
  latitude: number;
  longitude: number;
  ip_address?: string;
  created_at: string;
  updated_at: string;
}

export interface BackendConnection {
  id: number;
  source_id: number;
  target_id: number;
  connection_type: string;
  created_at: string;
  updated_at: string;
}

class BackendApiService {
  private sessionId: string | null = null;
  private csrfToken: string | null = null;

  private async authenticate(): Promise<boolean> {
    try {
      // Primeiro, obter o token CSRF
      const csrfResponse = await fetch(buildApiUrl('/'), {
        method: 'GET',
        credentials: 'include',
      });
      
      const csrfCookies = csrfResponse.headers.get('set-cookie');
      if (csrfCookies) {
        const csrfMatch = csrfCookies.match(/csrftoken=([^;]+)/);
        if (csrfMatch) {
          this.csrfToken = csrfMatch[1];
        }
      }

      // Fazer login
      const loginData = new FormData();
      loginData.append('username', 'admin');
      loginData.append('password', 'admin'); // Assumindo senha padrão
      
      const loginResponse = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.ADMIN.LOGIN), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': this.csrfToken || '',
        },
        body: loginData,
      });

      if (loginResponse.ok) {
        const sessionCookies = loginResponse.headers.get('set-cookie');
        if (sessionCookies) {
          const sessionMatch = sessionCookies.match(/sessionid=([^;]+)/);
          if (sessionMatch) {
            this.sessionId = sessionMatch[1];
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Erro na autenticação:', error);
      return false;
    }
  }

  private async makeAuthenticatedRequest(url: string): Promise<any> {
    try {
      // Usar o serviço de API configurado primeiro
      try {
        const response = await api.get(url.replace(API_CONFIG.BASE_URL, ''));
        return response.data;
      } catch (apiError: any) {
        // Se a API falhar, tentar método de fetch manual
        console.log('Tentando fallback para fetch manual...', apiError.message);
      }

      // Tentar primeiro sem autenticação
      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      // Se não autorizado, tentar com autenticação
      if (response.status === 401 || response.status === 403) {
        const authenticated = await this.authenticate();
        if (authenticated) {
          response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-CSRFToken': this.csrfToken || '',
            },
          });
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Erro na requisição para ${url}:`, error);
      throw error;
    }
  }
  private convertBackendProjectToMap(project: BackendProject, devices: BackendDevice[] = [], connections: BackendConnection[] = []): MapConfiguration {
    const items: MapItem[] = devices.map(device => ({
      id: device.id.toString(),
      name: device.name,
      type: device.device_type as any, // TODO: Mapear corretamente os tipos
      description: `${device.device_type} - ${device.ip_address || 'Sem IP'}`,
      geoLocation: {
        latitude: device.latitude,
        longitude: device.longitude,
      },
      properties: {
        ipAddress: device.ip_address || '',
        backendId: device.id.toString(),
      },
      visible: true,
      createdAt: new Date(device.created_at),
      updatedAt: new Date(device.updated_at),
      zabbixHost: device.ip_address ? {
        hostName: device.name,
        ipAddress: device.ip_address,
        monitoringEnabled: false,
      } : undefined,
    }));

    const mapConnections: MapConnection[] = connections.map(conn => ({
      id: conn.id.toString(),
      sourceId: conn.source_id.toString(),
      targetId: conn.target_id.toString(),
      type: conn.connection_type as any, // TODO: Mapear corretamente os tipos
      properties: {
        bandwidth: '',
        protocol: '',
        distance: 0,
        status: 'active' as const,
        latency: 0,
        utilization: 0,
      },
      style: {
        color: '#2196F3',
        width: 2,
        opacity: 0.8,
      },
      createdAt: new Date(conn.created_at),
      updatedAt: new Date(conn.updated_at),
    }));

    return {
      id: project.id.toString(),
      name: project.name,
      description: project.description || '',
      center: {
        latitude: -15.7942287, // Brasília - default
        longitude: -47.8821945,
      },
      zoom: 10,
      items,
      connections: mapConnections,
      properties: {
        backendId: project.id.toString(),
        projectType: 'legacy',
      },
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at),
    };
  }

  async getProjects(): Promise<BackendProject[]> {
    try {
      // Usar endpoint padronizado sem "api" redundante
      const response = await this.makeAuthenticatedRequest(buildApiUrl(API_CONFIG.ENDPOINTS.TOPOLOGY.PROJECTS));
      
      // Converter o formato do topology-manager para nosso formato
      if (Array.isArray(response)) {
        return response.map((project: any) => ({
          id: project.id,
          name: project.name,
          description: project.description || '',
          created_at: project.created_at || new Date().toISOString(),
          updated_at: project.updated_at || new Date().toISOString(),
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Erro ao buscar projetos do topology-manager:', error);
      
      // Fallback para o endpoint simple se não conseguir acessar o principal
      try {
        const fallbackResponse = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TOPOLOGY.SIMPLE_PROJECTS));
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          if (data.projects) {
            return data.projects.map((project: any) => ({
              id: project.id,
              name: project.name,
              description: project.description,
              created_at: project.created_at,
              updated_at: project.updated_at,
            }));
          }
        }
      } catch (fallbackError) {
        console.error('Erro no fallback:', fallbackError);
      }
      
      return [];
    }
  }

  async getDevices(projectId?: number): Promise<BackendDevice[]> {
    try {
      const url = projectId 
        ? buildApiUrl(`${API_CONFIG.ENDPOINTS.TOPOLOGY.DEVICES}?project=${projectId}`)
        : buildApiUrl(API_CONFIG.ENDPOINTS.TOPOLOGY.DEVICES);
      
      return await this.makeAuthenticatedRequest(url);
    } catch (error) {
      console.error('Erro ao buscar dispositivos:', error);
      return [];
    }
  }

  async getConnections(projectId?: number): Promise<BackendConnection[]> {
    try {
      const url = projectId 
        ? buildApiUrl(`${API_CONFIG.ENDPOINTS.TOPOLOGY.CONNECTIONS}?project=${projectId}`)
        : buildApiUrl(API_CONFIG.ENDPOINTS.TOPOLOGY.CONNECTIONS);
      
      return await this.makeAuthenticatedRequest(url);
    } catch (error) {
      console.error('Erro ao buscar conexões:', error);
      return [];
    }
  }

  async getAllMapsFromBackend(): Promise<MapConfiguration[]> {
    try {
      const projects = await this.getProjects();
      
      if (projects.length === 0) {
        return [];
      }

      const maps: MapConfiguration[] = [];

      // Para cada projeto, buscar os dados completos do projeto
      for (const project of projects) {
        try {
          // Usar endpoint padronizado para carregar projeto específico
          const projectData = await this.makeAuthenticatedRequest(buildApiUrl(`${API_CONFIG.ENDPOINTS.TOPOLOGY.PROJECTS}${project.id}/`));
          
          if (!projectData) {
            console.error(`Erro ao buscar dados do projeto ${project.name}`);
            continue;
          }
          
          // Converter dados do topology-manager para nosso formato de mapa
          const items: MapItem[] = [];
          const connections: MapConnection[] = [];
          
          // Processar nós (nodes)
          if (projectData.nodes && Array.isArray(projectData.nodes)) {
            console.log(`📍 Processando ${projectData.nodes.length} nós do projeto ${project.name}`);
            projectData.nodes.forEach((node: any) => {
              console.log(`🔍 Processando nó:`, {
                id: node.id,
                name: node.name,
                type: node.node_type,
                latitude: node.latitude,
                longitude: node.longitude
              });
              
              items.push({
                id: node.id,
                name: node.name,
                type: node.node_type as any, // router, switch, etc.
                description: node.description || `${node.node_type} - ${node.name}`,
                geoLocation: { 
                  latitude: node.latitude || node.position?.lat || 0,
                  longitude: node.longitude || node.position?.lng || 0
                },
                properties: {
                  nodeType: node.node_type,
                  backendId: node.id.toString(),
                  model: node.model || '',
                  vendor: node.vendor || '',
                  ip_address: node.ip_address || '',
                  capacity: node.capacity || '',
                  status: node.status || 'online',
                },
                visible: true,
                createdAt: new Date(node.created_at || project.created_at),
                updatedAt: new Date(node.updated_at || project.updated_at),
                zabbixHost: undefined, // TODO: Integrar com dados Zabbix se disponível
              });
            });
          }
          
          // Processar conexões
          if (projectData.connections && Array.isArray(projectData.connections)) {
            projectData.connections.forEach((connection: any) => {
              console.log(`🔗 Processando conexão ${connection.id}:`, {
                hasPath: Boolean(connection.path),
                pathLength: connection.path?.length,
                path: connection.path,
                isCalculated: connection.is_calculated
              });
              
              // Verificar múltiplos formatos de source/target IDs
              const sourceId = connection.source_node_id || connection.source_id || connection.sourceId || 
                             (typeof connection.source_node === 'string' ? connection.source_node : connection.source_node?.id);
              const targetId = connection.target_node_id || connection.target_id || connection.targetId ||
                             (typeof connection.target_node === 'string' ? connection.target_node : connection.target_node?.id);
              
              console.log(`🔍 IDs da conexão ${connection.id}:`, {
                sourceId,
                targetId,
                raw_source: connection.source_node,
                raw_target: connection.target_node,
                source_node_id: connection.source_node_id,
                target_node_id: connection.target_node_id
              });
              
              connections.push({
                id: connection.id,
                sourceId,
                targetId,
                type: connection.connection_type || 'ethernet',
                path: connection.path && Array.isArray(connection.path) ? connection.path : undefined,
                isCalculated: connection.is_calculated || false,
                properties: {
                  bandwidth: connection.bandwidth || '',
                  protocol: connection.connection_type || '',
                  distance: connection.distance || 0,
                  status: 'active' as const,
                  latency: connection.latency || 0,
                  utilization: connection.utilization || 0,
                  traffic: connection.traffic_inbound !== undefined ? {
                    inbound: connection.traffic_inbound || 0,
                    outbound: connection.traffic_outbound || 0,
                    latency: connection.traffic_latency || 0,
                  } : undefined,
                },
                style: {
                  color: connection.color || '#2196F3',
                  width: connection.width || 3,
                  opacity: connection.opacity || 0.8,
                  dashArray: connection.dash_array || undefined,
                },
                createdAt: new Date(project.created_at),
                updatedAt: new Date(project.updated_at),
              });
            });
          }
          
          // Criar o mapa          
          // Log resumo das conexões carregadas
          const connectionsWithPaths = connections.filter(c => c.path && c.path.length > 2);
          const calculatedConnections = connections.filter(c => c.isCalculated);
          
          console.log(`📊 Resumo do projeto ${project.name}:`, {
            totalConnections: connections.length,
            connectionsWithPaths: connectionsWithPaths.length,
            calculatedConnections: calculatedConnections.length,
            items: items.length
          });
          
          const map: MapConfiguration = {
            id: project.id.toString(),
            name: project.name,
            description: project.description || '',
            center: {
              latitude: projectData.center_latitude || (items.length > 0 ? items[0].geoLocation.latitude : -23.5505),
              longitude: projectData.center_longitude || (items.length > 0 ? items[0].geoLocation.longitude : -46.6333),
            },
            zoom: projectData.zoom_level || 12,
            items,
            connections,
            properties: {
              backendId: project.id.toString(),
              projectType: 'topology-manager',
            },
            createdAt: new Date(project.created_at),
            updatedAt: new Date(project.updated_at),
          };
          
          console.log(`✅ Adicionando mapa à lista:`, {
            id: map.id,
            name: map.name,
            itemsCount: map.items.length,
            connectionsCount: map.connections.length,
            centerLat: map.center?.latitude,
            centerLng: map.center?.longitude
          });
          
          maps.push(map);
          
        } catch (projectError) {
          console.error(`Erro ao carregar projeto ${project.name}:`, projectError);
          continue;
        }
      }

      console.log(`Carregados ${maps.length} mapas do topology-manager com ${maps.reduce((total, map) => total + map.items.length, 0)} equipamentos`);
      return maps;
    } catch (error) {
      console.error('Erro ao carregar mapas do backend:', error);
      return [];
    }
  }

  async getMapById(id: string): Promise<MapConfiguration | null> {
    try {
      const maps = await this.getAllMapsFromBackend();
      return maps.find(map => map.id === id) || null;
    } catch (error) {
      console.error('Erro ao buscar mapa por ID:', error);
      return null;
    }
  }

  // Métodos para testar conectividade
  async testConnection(): Promise<boolean> {
    try {
              await this.makeAuthenticatedRequest(buildApiUrl(API_CONFIG.ENDPOINTS.TOPOLOGY.PROJECTS));
      return true;
    } catch (error) {
      console.warn('Backend não está disponível, usando localStorage');
      return false;
    }
  }

  async getBackendStats() {
    try {
      const [projects, devices, connections] = await Promise.all([
        this.getProjects(),
        this.getDevices(),
        this.getConnections(),
      ]);

      return {
        totalProjects: projects.length,
        totalDevices: devices.length,
        totalConnections: connections.length,
        backendAvailable: true,
      };
    } catch (error) {
      return {
        totalProjects: 0,
        totalDevices: 0,
        totalConnections: 0,
        backendAvailable: false,
      };
    }
  }
}

export const backendApiService = new BackendApiService();