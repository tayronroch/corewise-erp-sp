/**
 * Serviço para funcionalidades MPLS - CoreWise
 * Busca, relatórios e análise de equipamentos MPLS
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';

// MPLS Search Interfaces
export interface SearchResult {
  id: number;
  equipment_name: string;
  equipment_location: string;
  backup_date: string;
  raw_config: string;
  // Campos detalhados do resultado de busca
  vpn_id?: number;
  loopback_ip?: string;
  neighbor_ip?: string;
  neighbor_hostname?: string;
  access_interface?: string;
  encapsulation?: string;
  description?: string;
  group_name?: string;
  customers?: string[];
  vpws_groups?: Array<{
    id: number;
    name: string;
    vpns?: Array<{
      id: number;
      vpn_id: number;
      name: string;
    }>;
  }>;
  customer_services?: Array<{
    id: number;
    customer_name: string;
    service_type: string;
  }>;
  highlights?: Array<{
    text: string;
    line_number: number;
  }>;
  // Informações adicionais para cada lado (A e B)
  side_a_info?: {
    hostname: string;
    location: string;
    loopback_ip: string;
    access_interface: string;
    interface_details: any;
  };
  side_b_info?: {
    hostname: string;
    location: string;
    loopback_ip: string;
    access_interface: string;
    interface_details: any;
  };
  // Campos LAG específicos
  interface_lag_members?: string[];
  interface_note?: string;
  interface_description?: string;
  interface_found_in_db?: boolean;
  neighbor_interface_description?: string;
  neighbor_interface_found_in_db?: boolean;
  opposite_interface?: string;
  pw_type?: string;
  vlan_id?: string;
  customer_name?: string;
  
  // Informações de destino para casos onde o equipamento não está na base
  destination_info?: {
    hostname: string;
    ip: string;
    isInDatabase: boolean;
    neighborIp: string;
    vpwsGroup?: {
      name: string;
      id: number;
      // Outros campos do vpws_group se necessário
    } | null;
    localInterface?: {
      name: string;
      details: any;
      capacity: string;
      media: string;
      description: string;
    };
    remoteInterface?: {
      name: string;
      details: any;
      capacity: string;
      media: string;
      description: string;
    };
    sideBInterface?: {
      name: string;
      details: any;
      capacity: string;
      media: string;
      description: string;
    };
    sideAInterface?: {
      name: string;
      details: any;
      capacity: string;
      media: string;
      description: string;
    };
  };
}

export interface SearchSuggestion {
  term: string;
  type: string;
  count: number;
}

export interface AdvancedSearchFilters {
  query: string;
  search_type: 'auto' | 'full_text' | 'ip' | 'mac' | 'vlan' | 'interface' | 'serial' | 'vpn';
  equipment_name?: string;
  location?: string;
  date_from?: string;
  date_to?: string;
  has_vpws?: boolean;
  has_customer_services?: boolean;
  customer_name?: string;
  interface_name?: string;
  vlan_id?: string;
  ip_address?: string;
  limit: number;
}

// Customer Report Interfaces
export interface CustomerInterface {
  name: string;
  description?: string;
  bandwidth?: string;
  vlan?: string;
  ip_address?: string;
  status: string;
}

export interface CustomerEquipment {
  name: string;
  last_backup: string;
  interfaces: CustomerInterface[];
}

export interface CustomerReportGroup {
  location: string;
  equipments: CustomerEquipment[];
}

export interface CustomerReportData {
  customer_name: string;
  total_locations: number;
  total_equipments: number;
  total_interfaces: number;
  total_services: number;
  groups: CustomerReportGroup[];
  // Dados crus por VPN (para renderização estilo Lado A/B)
  vpns?: any[];
}

class MplsService {
  private baseUrl = '/api/mpls-analyzer';
  
  private async request<T>(endpoint: string, options: any = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await api({
      url,
      method: options.method || 'GET',
      data: options.body ? JSON.parse(options.body) : undefined,
      params: options.params,
      ...options
    });
    
    return response.data;
  }

  // MPLS Search Methods
  async intelligentSearch(query: string, searchType: string = 'auto', equipmentFilter?: string): Promise<SearchResult[]> {
    try {
      console.log('🚀 MPLS SERVICE - Intelligent search chamada:', { query, searchType, equipmentFilter });

      // Se temos filtro de equipamento, usar busca específica por equipamento
      if (equipmentFilter && equipmentFilter.trim()) {
        console.log('🔍 MPLS SERVICE - Buscando por equipamento específico:', equipmentFilter);
        return this.searchByEquipment(equipmentFilter);
      }

      // Detectar se a query parece ser nome de equipamento (padrão: ESTADO-CIDADE-ALGO-PE01)
      const equipmentPattern = /^[A-Z]{2}-[A-Z]+-[A-Z]+-PE\d+$/i;
      if (equipmentPattern.test(query)) {
        console.log('🔍 MPLS SERVICE - Query detectada como equipamento, usando searchByEquipment:', query);
        return this.searchByEquipment(query);
      }

      // Usar o endpoint de relatório de cliente que retorna todos os resultados
      // O endpoint /search/ tem bug de paginação (sempre retorna os mesmos 10 resultados)
      console.log('🔄 MPLS SERVICE - Usando endpoint de relatório para busca completa...');
      
      const response = await this.request<any>('/reports/customers/', {
        params: { customer: query }
      });
      
      console.log('🔥 MPLS SERVICE - Relatório API response:', response);
      
      if (!response || !response.results) {
        console.log('❌ MPLS SERVICE - Sem resultados no relatório, tentando busca alternativa...');
        // Fallback para busca alternativa se o relatório não funcionar
        return this.fallbackSearch(query);
      }
      
      // Converter os dados do relatório para o formato de busca
      const convertedResults: SearchResult[] = [];
      const processedVpns = new Set<number>(); // Para evitar duplicação de VPNs
      
      response.results.forEach((vpn: any, index: number) => {
        // Verificar se já processamos esta VPN
        if (processedVpns.has(vpn.vpn_id)) {
          return; // Pular se já foi processada
        }
        
        processedVpns.add(vpn.vpn_id);
        
        // Criar um resultado consolidado com informações de ambos os lados
        const sideA = vpn.side_a?.equipment;
        const sideB = vpn.side_b?.equipment;
        
        // Usar o lado A como equipamento principal (ou o primeiro disponível)
        const mainEquipment = sideA || sideB;
        const neighborEquipment = sideA ? sideB : sideA;
        
        // Capturar informações de destino mesmo quando o equipamento não está na base
        const destinationInfo = {
          hostname: vpn.side_a?.neighbor?.hostname || vpn.side_b?.neighbor?.hostname || 
                   neighborEquipment?.hostname || 
                   // Tentar extrair do vpws_group se disponível
                   vpn.side_a?.vpws_group?.name || vpn.side_b?.vpws_group?.name || 'N/A',
          ip: vpn.side_a?.neighbor?.loopback_ip || vpn.side_b?.neighbor?.loopback_ip || 
               neighborEquipment?.loopback_ip || 'N/A',
          // Se não temos o equipamento na base, usar informações do neighbor ou vpws_group
          isInDatabase: !!(neighborEquipment && neighborEquipment.hostname),
          // Capturar IP do vizinho mesmo quando o equipamento principal não está na base
          neighborIp: vpn.side_a?.neighbor?.loopback_ip || vpn.side_b?.neighbor?.loopback_ip || 
                     (sideA ? sideB?.loopback_ip : sideA?.loopback_ip) || 'N/A',
          // Informações do vpws_group para equipamentos capturados
          vpwsGroup: vpn.side_a?.vpws_group || vpn.side_b?.vpws_group || null,
          // Informações da interface do lado B (destino)
          sideBInterface: {
            name: vpn.side_b?.access_interface || vpn.side_a?.access_interface || 'N/A',
            details: vpn.side_b?.access_interface_details || vpn.side_a?.access_interface_details || null,
            capacity: this.extractInterfaceCapacity(vpn.side_b?.access_interface || vpn.side_a?.access_interface || ''),
            media: vpn.side_b?.access_interface_details?.media || vpn.side_a?.access_interface_details?.media || 'physical',
            description: vpn.side_b?.access_interface_description || vpn.side_a?.access_interface_description || 'N/A'
          },
          // Informações da interface do lado A (origem)
          sideAInterface: {
            name: vpn.side_a?.access_interface || vpn.side_b?.access_interface || 'N/A',
            details: vpn.side_a?.access_interface_details || vpn.side_b?.access_interface_details || null,
            capacity: this.extractInterfaceCapacity(vpn.side_a?.access_interface || vpn.side_b?.access_interface || ''),
            media: vpn.side_a?.access_interface_details?.media || vpn.side_b?.access_interface_details?.media || 'physical',
            description: vpn.side_a?.access_interface_description || vpn.side_b?.access_interface_description || 'N/A'
          }
        };
        
        // Log de debug para verificar as descrições
        console.log('🔍 MPLS SERVICE - Debug interface descriptions:', {
          vpn_id: vpn.vpn_id,
          side_a_description: vpn.side_a?.access_interface_description,
          side_b_description: vpn.side_b?.access_interface_description,
          side_a_interface: vpn.side_a?.access_interface,
          side_b_interface: vpn.side_b?.access_interface,
          destinationInfo: destinationInfo
        });
        
        if (mainEquipment) {
          convertedResults.push({
            id: index,
            equipment_name: mainEquipment.hostname || '',
            equipment_location: mainEquipment.location || '',
            backup_date: mainEquipment.last_backup || '',
            raw_config: '',
            vpn_id: vpn.vpn_id,
            loopback_ip: mainEquipment.loopback_ip || '',
            neighbor_ip: destinationInfo.ip,
            neighbor_hostname: destinationInfo.hostname,
            access_interface: vpn.side_a?.access_interface || vpn.side_b?.access_interface || '',
            encapsulation: vpn.encapsulation || '',
            description: vpn.description || '',
            group_name: '',
            customers: vpn.customers || [query], // Usar clientes reais da VPN ou fallback para query
            highlights: [],
            vpws_groups: vpn.vpn_id ? [{
              id: vpn.vpn_id,
              name: `VPN ${vpn.vpn_id}`,
              vpns: [{
                id: vpn.vpn_id,
                vpn_id: vpn.vpn_id,
                name: vpn.description || `VPN ${vpn.vpn_id}`
              }]
            }] : [],
            customer_services: (vpn.customers || [query]).map((customer: string, idx: number) => ({
              id: index + idx,
              customer_name: customer,
              service_type: 'VPN'
            })),
            // Adicionar informações dos dois lados para contexto completo
            side_a_info: sideA ? {
              hostname: sideA.hostname || '',
              location: sideA.location || '',
              loopback_ip: sideA.loopback_ip || '',
              access_interface: vpn.side_a?.access_interface || '',
              interface_details: vpn.side_a?.access_interface_details
            } : undefined,
            side_b_info: sideB ? {
              hostname: sideB.hostname || '',
              location: sideB.location || '',
              loopback_ip: sideB.loopback_ip || '',
              access_interface: vpn.side_b?.access_interface || '',
              interface_details: vpn.side_b?.access_interface_details
            } : undefined,
            // Informações de destino para casos onde o equipamento não está na base
            destination_info: destinationInfo
          });
        }
      });
      
      console.log('🎯 MPLS SERVICE - Total convertido do relatório (consolidado):', convertedResults.length);
      console.log('📊 MPLS SERVICE - VPNs únicas processadas:', processedVpns.size);
      return convertedResults;
      
    } catch (error) {
      console.error('❌ Erro na busca MPLS:', error);
      // Fallback para busca alternativa
      return this.fallbackSearch(query);
    }
  }

  // Busca específica por equipamento
  async searchByEquipment(equipmentName: string): Promise<SearchResult[]> {
    try {
      console.log('🔍 MPLS SERVICE - Buscando todas as VPNs do equipamento:', equipmentName);
      
      // ESTRATÉGIA: Busca recursiva para obter dados de TODOS os equipamentos
      // 1. Primeiro, buscar todas as VPNs do equipamento atual
      const allVpns = await this.request<any>('/search/', { 
        params: { q: equipmentName } 
      });
      
      // 2. Extrair todos os equipamentos únicos conectados
      const connectedEquipments = new Set<string>();
      if (allVpns && allVpns.results) {
        allVpns.results.forEach((result: any) => {
          if (result.type === 'vpn' && result.neighbor_hostname) {
            connectedEquipments.add(result.neighbor_hostname);
          }
        });
      }
      
      console.log('🔗 MPLS SERVICE - Equipamentos conectados:', Array.from(connectedEquipments));
      
      // 3. Buscar dados de cada equipamento conectado para obter suas interfaces
      const equipmentInterfaces: any = {};
      for (const equipment of connectedEquipments) {
        try {
          const equipmentData = await this.request<any>('/reports/equipment/', {
            params: { equipment }
          });
          
          if (equipmentData && equipmentData.vpns) {
            equipmentInterfaces[equipment] = {};
            equipmentData.vpns.forEach((vpn: any) => {
              if (vpn.interface) {
                equipmentInterfaces[equipment][vpn.vpn_id] = {
                  name: vpn.interface.name,
                  description: vpn.interface.description,
                  type: vpn.interface.type,
                  speed: vpn.interface.speed,
                  is_customer: vpn.interface.is_customer,
                  found_in_db: vpn.interface.found_in_db,
                  lag_members: vpn.interface.lag_members || []
                };
              }
            });
          }
        } catch (error) {
          console.log(`⚠️ MPLS SERVICE - Erro ao buscar dados do equipamento ${equipment}:`, error);
        }
      }
      
      console.log('📊 MPLS SERVICE - Interfaces dos equipamentos conectados:', equipmentInterfaces);
      
      // 3.5. Buscar detalhes das LAGs e seus membros via /customer-interface-report/
      const lagMembersMap: any = {};
      const interfaceDescriptionsMap: any = {}; // Novo mapa para correlacionar interfaces com clientes
      
      try {
        const interfaceReport = await this.request<any>('/customer-interface-report/', {
          params: { equipment: equipmentName }
        });
        
        if (interfaceReport && interfaceReport.results) {
          console.log('🔍 MPLS SERVICE - Processando interfaces para LAGs:', interfaceReport.results.length);
          
          // Primeiro, mapear todas as interfaces físicas e suas descrições
          interfaceReport.results.forEach((interfaceInfo: any) => {
            const interfaceName = interfaceInfo.interface?.name;
            const description = interfaceInfo.interface?.description || '';
            
            // Armazenar descrição da interface para uso posterior
            interfaceDescriptionsMap[interfaceName] = description;
            
            console.log(`🔍 Interface: ${interfaceName} - Descrição: ${description}`);
            
            // Detectar se a interface pertence a uma LAG pela descrição (suporta qualquer número de LAG)
            const lagMatch = description.match(/LAG(\d+)/i);
            if (lagMatch) {
              const lagId = parseInt(lagMatch[1]);
              const lagName = `lag-${lagId}`;
              
              console.log(`🔗 LAG detectada: ${lagName} (LAG${lagId}) para interface ${interfaceName}`);
              
              if (!lagMembersMap[lagName]) {
                lagMembersMap[lagName] = {
                  name: lagName,
                  lagNumber: lagId,
                  members: [],
                  totalSpeed: 0,
                  description: description.replace(/-P\d+-LAG\d+/i, '').trim(), // Remover sufixo específico
                  clientName: null // Será extraído das interfaces membros
                };
                console.log(`📝 Nova LAG criada: ${lagName} (número ${lagId})`);
              }
              
              // Adicionar membro à LAG
              lagMembersMap[lagName].members.push({
                name: interfaceName,
                speed: interfaceInfo.interface?.speed || '10G',
                description: description
              });
              
              // Calcular velocidade total
              const speed = this.extractInterfaceCapacity(interfaceName);
              const speedValue = parseInt(speed.replace('G', '')) || 10;
              lagMembersMap[lagName].totalSpeed += speedValue;
              
              // Extrair nome do cliente da descrição da interface física
              if (!lagMembersMap[lagName].clientName) {
                console.log(`🔍 Tentando extrair cliente da descrição: "${description}"`);
                const clientMatch = description.match(/CUSTOMER-([A-Z][A-Z0-9]+)/i);
                console.log(`🔍 Match encontrado:`, clientMatch);
                
                if (clientMatch) {
                  lagMembersMap[lagName].clientName = clientMatch[1];
                  console.log(`👤 Cliente identificado para ${lagName}: ${lagMembersMap[lagName].clientName}`);
                } else {
                  console.log(`❌ Nenhum cliente encontrado na descrição: "${description}"`);
                }
              }
              
              console.log(`➕ Membro adicionado à ${lagName}: ${interfaceName} (${speed}) - Total: ${lagMembersMap[lagName].totalSpeed}G`);
            } else {
              console.log(`❌ Não é LAG: ${interfaceName} - ${description}`);
            }
          });
          
          // Atualizar descrições das LAGs e garantir que o cliente foi identificado
          Object.keys(lagMembersMap).forEach(lagName => {
            const lag = lagMembersMap[lagName];
            if (lag.members.length > 0) {
              // Extrair descrição limpa do primeiro membro
              const firstMemberDesc = lag.members[0].description;
              lag.description = firstMemberDesc.replace(/-P\d+-LAG\d+/i, '').trim();
              lag.finalSpeed = `${lag.totalSpeed}G`;
              
              console.log(`🏷️ LAG ${lagName} finalizada:`, {
                description: lag.description,
                finalSpeed: lag.finalSpeed,
                members: lag.members.length,
                totalSpeed: lag.totalSpeed,
                clientName: lag.clientName
              });
            }
          });
        }
        
        console.log('🔗 MPLS SERVICE - LAGs e seus membros mapeados:', lagMembersMap);
        console.log('📋 MPLS SERVICE - Descrições das interfaces:', interfaceDescriptionsMap);
        
        // DEBUG: Log específico dos clientes identificados nas LAGs
        Object.keys(lagMembersMap).forEach(lagName => {
          const lag = lagMembersMap[lagName];
          console.log(`🏷️ LAG ${lagName} - Cliente: ${lag.clientName || 'NÃO IDENTIFICADO'}`);
        });
      } catch (error) {
        console.log('⚠️ MPLS SERVICE - Erro ao buscar membros das LAGs:', error);
      }
      
      // 4. Agora buscar dados complementares via /customer-report/ para VPNs específicas
      const customerReport = await this.request<any>('/customer-report/', {
        params: { customer: 'MEGALINK' }
      });
      
      const complementaryData: any = {};
      if (customerReport && customerReport.results) {
        customerReport.results.forEach((vpn: any) => {
          if (vpn.vpn_id) {
            // Determinar qual lado é o equipamento buscado vs remoto
            const isLocalSideA = vpn.side_a?.equipment?.hostname === equipmentName;
            const isLocalSideB = vpn.side_b?.equipment?.hostname === equipmentName;
            
            if (isLocalSideA || isLocalSideB) {
              const localSide = isLocalSideA ? vpn.side_a : vpn.side_b;
              const remoteSide = isLocalSideA ? vpn.side_b : vpn.side_a;
              const remoteEquipment = remoteSide?.equipment?.hostname;
              
              complementaryData[vpn.vpn_id] = {
                local_interface: localSide?.interface?.name || '',
                local_interface_details: localSide?.interface || {},
                remote_interface: remoteSide?.interface?.name || '',
                remote_interface_details: remoteSide?.interface || {},
                remote_equipment: remoteEquipment || '',
                remote_ip: remoteSide?.equipment?.loopback_ip || ''
              };
              
              // 5. ENRICH: Adicionar dados das interfaces do equipamento remoto
              if (remoteEquipment && equipmentInterfaces[remoteEquipment]) {
                // Buscar interface correspondente no equipamento remoto
                // (pode ser por VPN ID ou por descrição similar)
                const remoteVpn = Object.entries(equipmentInterfaces[remoteEquipment]).find(([, interfaceData]: [string, any]) => {
                  // Tentar encontrar por descrição similar ou VPN ID
                  return interfaceData.description === localSide?.interface?.description ||
                         interfaceData.description.includes('MEGALINK') ||
                         interfaceData.description.includes('VILARNET');
                });
                
                if (remoteVpn) {
                  const [, remoteInterfaceData] = remoteVpn;
                  complementaryData[vpn.vpn_id].remote_interface_details = {
                    ...complementaryData[vpn.vpn_id].remote_interface_details,
                    ...(remoteInterfaceData || {})
                  };
                }
              }
            }
          }
        });
      }
      
      console.log('📊 MPLS SERVICE - Dados complementares obtidos via busca recursiva:', complementaryData);
      
      // 6. Agora buscar os dados principais do equipamento
      const response = await this.request<any>('/reports/equipment/', { 
        params: { equipment: equipmentName } 
      });
      
      if (!response || !response.vpns || response.vpns.length === 0) {
        console.log('❌ MPLS SERVICE - Nenhuma VPN encontrada para o equipamento');
        return [];
      }
      
      // 7. Converter resultados para o formato padrão usando a nova estrutura
      const convertedResults: SearchResult[] = await Promise.all(response.vpns.map(async (vpn: any, index: number) => {
        // LÓGICA CORRETA:
        // - Interface LOCAL: Sempre do equipamento buscado (equipmentName)
        // - Interface REMOTA: Sempre do equipamento conectado (neighbor)
        
        // Interface LOCAL (do equipamento buscado - MA-BREJO-PE01)
        const localInterface = vpn.interface?.name || '';
        let localInterfaceDetails = vpn.interface || {};
        
        // ENRICH: Se for LAG, adicionar informações dos membros
        console.log(`🔍 Verificando se ${localInterface} é LAG...`);
        console.log(`🗂️ LAGs disponíveis:`, Object.keys(lagMembersMap));
        
        if (localInterface.startsWith('lag-') && lagMembersMap[localInterface]) {
          const lagInfo = lagMembersMap[localInterface];
          console.log(`🎯 LAG encontrada: ${localInterface}`, lagInfo);
          
          localInterfaceDetails = {
            ...localInterfaceDetails,
            description: lagInfo.description,
            speed: lagInfo.finalSpeed,
            lag_members: lagInfo.members.map((m: any) => m.name),
            lag_members_details: lagInfo.members,
            found_in_db: true,
            note: `LAG com ${lagInfo.members.length} membros: ${lagInfo.members.map((m: any) => `${m.name} (${m.speed})`).join(', ')}`
          };
          console.log(`✅ LAG local enriquecida: ${localInterface} - ${lagInfo.description} - ${lagInfo.finalSpeed}`);
          console.log(`📊 Interface details atualizada:`, localInterfaceDetails);
        } else if (localInterface.startsWith('lag-')) {
          console.log(`❌ LAG ${localInterface} não encontrada no mapa de LAGs`);
        }
        
        // Interface REMOTA (do equipamento conectado - busca recursiva)
        let remoteInterface = '';
        let remoteInterfaceDetails: any = {};
        
        // 1. Tentar obter da busca recursiva primeiro
        const remoteEquipment = vpn.neighbor?.hostname;
        if (remoteEquipment && equipmentInterfaces[remoteEquipment]) {
          // Buscar a interface correspondente no equipamento remoto pela VPN ID
          const remoteVpnData = equipmentInterfaces[remoteEquipment][vpn.vpn_id];
          if (remoteVpnData) {
            remoteInterface = remoteVpnData.name;
            remoteInterfaceDetails = remoteVpnData;
            console.log(`✅ Interface remota encontrada via busca recursiva: ${remoteInterface} (${remoteEquipment})`);
          } else {
            // Se não encontrou por VPN ID, tentar por descrição similar
            const remoteVpn = Object.entries(equipmentInterfaces[remoteEquipment]).find(([, interfaceData]: [string, any]) => {
              return interfaceData.description?.includes(vpn.customers?.[0]) ||
                     interfaceData.description === vpn.description ||
                     interfaceData.description?.includes('MEGALINK') ||
                     interfaceData.description?.includes('VILARNET');
            });
            
            if (remoteVpn) {
              const [, remoteInterfaceData] = remoteVpn;
              remoteInterface = (remoteInterfaceData as any).name;
              remoteInterfaceDetails = remoteInterfaceData as any;
              console.log(`✅ Interface remota encontrada por descrição: ${remoteInterface} (${remoteEquipment})`);
            }
          }
        }
        
        // 2. Fallback: se não encontrou na busca recursiva, usar dados complementares
        if (!remoteInterface) {
          const complementary = complementaryData[vpn.vpn_id] || {};
          remoteInterface = complementary.remote_interface || '';
          remoteInterfaceDetails = complementary.remote_interface_details || {};
        }
        
        // ENRICH: Se interface remota for LAG, tentar buscar membros via busca recursiva nos outros equipamentos
        if (remoteInterface.startsWith('lag-') && remoteEquipment) {
          try {
            const remoteInterfaceReport = await this.request<any>('/customer-interface-report/', {
              params: { equipment: remoteEquipment }
            });
            
            if (remoteInterfaceReport && remoteInterfaceReport.results) {
              const remoteLagMembers: any[] = [];
              let remoteLagTotalSpeed = 0;
              let remoteLagDescription = '';
              
              remoteInterfaceReport.results.forEach((interfaceInfo: any) => {
                const description = interfaceInfo.interface?.description || '';
                const lagMatch = description.match(/LAG(\d+)/i);
                
                if (lagMatch) {
                  const lagId = parseInt(lagMatch[1]);
                  const expectedLagName = `lag-${lagId}`;
                  
                  console.log(`🔍 Comparando LAG remota: esperado=${remoteInterface}, encontrado=${expectedLagName}`);
                  
                  if (expectedLagName === remoteInterface) {
                    remoteLagMembers.push({
                      name: interfaceInfo.interface?.name,
                      speed: interfaceInfo.interface?.speed || '10G',
                      description: description
                    });
                    
                    const speed = this.extractInterfaceCapacity(interfaceInfo.interface?.name || '');
                    const speedValue = parseInt(speed.replace('G', '')) || 10;
                    remoteLagTotalSpeed += speedValue;
                    
                    if (!remoteLagDescription) {
                      remoteLagDescription = description.replace(/-P\d+-LAG\d+/i, '').trim();
                    }
                    
                    console.log(`✅ Membro LAG remota adicionado: ${interfaceInfo.interface?.name} para ${expectedLagName}`);
                  }
                }
              });
              
              if (remoteLagMembers.length > 0) {
                remoteInterfaceDetails = {
                  ...remoteInterfaceDetails,
                  description: remoteLagDescription,
                  speed: `${remoteLagTotalSpeed}G`,
                  lag_members: remoteLagMembers.map((m: any) => m.name),
                  lag_members_details: remoteLagMembers,
                  found_in_db: true,
                  note: `LAG remota com ${remoteLagMembers.length} membros: ${remoteLagMembers.map((m: any) => `${m.name} (${m.speed})`).join(', ')}`
                };
                console.log(`✅ LAG remota enriquecida: ${remoteInterface} (${remoteEquipment}) - ${remoteLagDescription} - ${remoteLagTotalSpeed}G`);
              }
            }
          } catch (error) {
            console.log(`⚠️ Erro ao buscar membros da LAG remota ${remoteInterface}:`, error);
          }
        }
        
        // 3. Último fallback: informações básicas do neighbor
        if (!remoteInterface && vpn.neighbor?.hostname) {
          remoteInterface = 'N/A';
          remoteInterfaceDetails = {
            name: 'N/A',
            type: 'remote',
            speed: 'N/A',
            is_customer: false,
            found_in_db: false,
            description: `Equipamento: ${vpn.neighbor.hostname}`
          };
          console.log(`⚠️ Interface remota não encontrada para ${vpn.neighbor.hostname}, usando fallback`);
        }
        
        // Extrair informações da interface e capacidade
        let interfaceCapacity = this.extractInterfaceCapacity(localInterface);
        let neighborInterfaceCapacity = this.extractInterfaceCapacity(remoteInterface);
        
        // Se for LAG local e temos informações enriquecidas, usar a velocidade calculada
        if (localInterface.startsWith('lag-') && localInterfaceDetails.speed) {
          interfaceCapacity = localInterfaceDetails.speed;
          console.log(`🚀 Usando velocidade calculada da LAG local: ${interfaceCapacity}`);
        }
        
        // Se for LAG remota e temos informações enriquecidas, usar a velocidade calculada
        if (remoteInterface.startsWith('lag-') && remoteInterfaceDetails.speed) {
          neighborInterfaceCapacity = remoteInterfaceDetails.speed;
          console.log(`🚀 Usando velocidade calculada da LAG remota: ${neighborInterfaceCapacity}`);
        }
        
        
        // Tentar extrair cliente da descrição se não temos no campo customers
        let finalCustomers = vpn.customers || [];
        
        // DEBUG para VPNs específicas
        if (vpn.vpn_id === 1340 || vpn.vpn_id === 1341 || vpn.vpn_id === 2790) {
          console.log(`🔍 DEBUG VPN ${vpn.vpn_id} - INICIAL:`, {
            vpn_customers_original: vpn.customers,
            finalCustomers_inicial: finalCustomers,
            finalCustomers_length: finalCustomers.length,
            access_interface: vpn.access_interface,
            interface_name: vpn.interface?.name,
            vpn_object: vpn
          });
        }
        
        if (!finalCustomers || finalCustomers.length === 0) {
          // NOVA ABORDAGEM: Se for LAG, usar diretamente o clientName do lagMembersMap
          const interfaceName = vpn.access_interface || vpn.interface?.name;
          if (interfaceName && interfaceName.startsWith('lag-')) {
            console.log(`🔍 DEBUG VPN ${vpn.vpn_id} - Tentando LAG ${interfaceName}`);
            console.log(`🔍 DEBUG VPN ${vpn.vpn_id} - lagMembersMap disponível:`, Object.keys(lagMembersMap));
            
            const lagInfo = lagMembersMap[interfaceName];
            console.log(`🔍 DEBUG VPN ${vpn.vpn_id} - lagInfo encontrada:`, lagInfo);
            
            if (lagInfo && lagInfo.clientName) {
              finalCustomers = [lagInfo.clientName];
              console.log(`🎯 Cliente encontrado via lagMembersMap para VPN ${vpn.vpn_id}: ${lagInfo.clientName}`);
            } else {
              console.log(`❌ DEBUG VPN ${vpn.vpn_id} - Não foi possível encontrar cliente na LAG ${interfaceName}`);
            }
          }
          
          // Se ainda não encontrou, usar método tradicional
          if (finalCustomers.length === 0) {
            // Tentar extrair da descrição da VPN
            const description = vpn.description || '';
            
            // Também tentar extrair das descrições das interfaces (LAG e física)
            const allDescriptions = [description];
            
            // Adicionar descrições das interfaces do equipamento local
          if (response.equipment && response.equipment.hostname) {
            const equipmentName = response.equipment.hostname;
            const equipmentData = equipmentInterfaces[equipmentName];
            if (equipmentData) {
              // Buscar interface relacionada à esta VPN
              const relatedInterface = Object.values(equipmentData).find((intfData: any) => {
                return intfData.encapsulation?.includes(vpn.vpn_id) || 
                       intfData.encapsulation?.includes(`vlan:${vpn.vpn_id}`) ||
                       intfData.encapsulation?.includes(`qinq:${vpn.vpn_id}`) ||
                       intfData.name === vpn.access_interface ||
                       intfData.lag_id === vpn.access_interface; // Buscar por LAG ID também
              });
              
              if (vpn.vpn_id === '1340' || vpn.vpn_id === '1341') {
                console.log(`  - buscando interface para VPN ${vpn.vpn_id}:`);
                console.log(`    - vpn.access_interface: ${vpn.access_interface}`);
                console.log(`    - relatedInterface encontrada:`, relatedInterface ? (relatedInterface as any).name : 'NENHUMA');
              }
              
              if (relatedInterface && (relatedInterface as any).description) {
                allDescriptions.push((relatedInterface as any).description);
                if (vpn.vpn_id === '1340' || vpn.vpn_id === '1341') {
                  console.log(`  - descrição da interface encontrada:`, (relatedInterface as any).description);
                }
              }
              
              // Se for LAG, também verificar interfaces membros
              if (relatedInterface && (relatedInterface as any).lag_members) {
                const members = (relatedInterface as any).lag_members;
                for (const memberName of members) {
                  const memberInterface = Object.values(equipmentData).find((intfData: any) => 
                    intfData.name === memberName
                  );
                  if (memberInterface && (memberInterface as any).description) {
                    allDescriptions.push((memberInterface as any).description);
                    if (vpn.vpn_id === '1340' || vpn.vpn_id === '1341') {
                      console.log(`  - descrição do membro LAG ${memberName}:`, (memberInterface as any).description);
                    }
                  }
                }
              }
              
              // NOVA ABORDAGEM: Se for LAG, buscar nas interfaces físicas membros do equipamento
              if (vpn.access_interface && vpn.access_interface.startsWith('lag-')) {
                const lagId = vpn.access_interface; // Ex: "lag-14"
                
                // 1. Usar o lagMembersMap para pegar as interfaces membros
                const lagInfo = lagMembersMap[lagId];
                if (lagInfo && lagInfo.members && lagInfo.members.length > 0) {
                  // 2. Para cada interface membro, buscar no equipmentData a descrição da interface física
                  for (const member of lagInfo.members) {
                    const memberInterfaceName = member.name; // Ex: "ten-gigabit-ethernet-1/1/10"
                    
                    // 3. Buscar essa interface física no equipmentData do mesmo equipamento
                    if (equipmentData) {
                      // Busca direta por nome da interface
                      const physicalInterface = Object.values(equipmentData).find((intfData: any) => 
                        intfData.name === memberInterfaceName
                      );
                      
                      if (physicalInterface && (physicalInterface as any).description) {
                        allDescriptions.push((physicalInterface as any).description);
                      } else {
                        // Busca alternativa: buscar por padrão similar no nome
                        const alternativeInterface = Object.values(equipmentData).find((intfData: any) => 
                          intfData.name && intfData.name.includes(memberInterfaceName.replace('ten-gigabit-ethernet-', ''))
                        );
                        
                        if (alternativeInterface && (alternativeInterface as any).description) {
                          allDescriptions.push((alternativeInterface as any).description);
                        }
                      }
                    }
                    
                    // 4. Buscar usando dados do customer-interface-report específico para essa interface
                    try {
                      // Esta é uma busca mais específica para pegar a descrição real da interface física
                      // (Esta busca já foi feita anteriormente no código, mas vamos aproveitar)
                    } catch (error) {
                      // Silencioso - apenas fallback
                    }
                    
                    // 5. Fallback: usar descrição do lagMembersMap se não encontrou nas outras fontes
                    if (member.description) {
                      allDescriptions.push(member.description);
                    }
                  }
                } else {
                  // Fallback: usar o método antigo se não encontrou no lagMembersMap
                  const lagId = vpn.access_interface; // Ex: "lag-14"
                  const lagNumber = lagId.replace('lag-', ''); // Ex: "14"
                  const lagPattern = `LAG${lagNumber}`; // Ex: "LAG14"
                  
                  const physicalInterfacesWithLag = Object.values(equipmentData).filter((intfData: any) => 
                    intfData.description && (
                      intfData.description.includes(lagPattern) ||
                      intfData.description.includes(`-${lagPattern}`) ||
                      intfData.description.includes(`P1-${lagPattern}`) ||
                      intfData.description.includes(`P2-${lagPattern}`)
                    )
                  );
                  
                  if (vpn.vpn_id === '1340' || vpn.vpn_id === '1341') {
                    console.log(`  - fallback: buscando interfaces físicas com padrão ${lagPattern}:`, physicalInterfacesWithLag.length);
                  }
                  
                  for (const physIntf of physicalInterfacesWithLag) {
                    if ((physIntf as any).description) {
                      allDescriptions.push((physIntf as any).description);
                      if (vpn.vpn_id === '1340' || vpn.vpn_id === '1341') {
                        console.log(`  - descrição da interface física com ${lagPattern}:`, (physIntf as any).description);
                      }
                    }
                  }
                }
              }
            }
          }
          
          // Padrões de cliente para buscar em todas as descrições
          const clientPatterns = [
            // Padrão CUSTOMER-CLIENTE-... das interfaces físicas
            /CUSTOMER-([A-Z][A-Z0-9]*(?:[A-Z]+)*)/gi,
            // Clientes conhecidos diretos (incluindo novos)
            /(MEGALINK|VILARNET|NETPAC|TECNET|HIITECH|JRNET|TECHFIBRA|CONNECT|CLIENTE)/gi, 
            // Padrão específico para interfaces LAG: NOME-P1-LAG[qualquer_numero] ou NOME-P2-LAG[qualquer_numero]
            /^([A-Z][A-Z0-9]+)-P[12]-LAG\d+/gi,
            // Padrão alternativo para LAGs: NOME-LAG[qualquer_numero] (sem P1/P2)
            /^([A-Z][A-Z0-9]+)-LAG\d+/gi,
            // Palavras em maiúsculas genéricas (mais restritivo)
            /^([A-Z]{3,}(?:\s+[A-Z]{3,})*)/g
          ];
          
          // Testar todos os padrões em todas as descrições
          for (const desc of allDescriptions) {
            if (!desc) continue;
            
            for (let i = 0; i < clientPatterns.length; i++) {
              const pattern = clientPatterns[i];
              
              if (i === 0) {
                // Padrão CUSTOMER- com grupo de captura
                const matches = desc.match(pattern);
                if (matches && matches.length > 0) {
                  // Para o padrão CUSTOMER-, pegar apenas os grupos capturados (sem o "CUSTOMER-")
                  const regex = /CUSTOMER-([A-Z][A-Z0-9]*(?:[A-Z]+)*)/gi;
                  const clients = [];
                  let match;
                  while ((match = regex.exec(desc)) !== null) {
                    clients.push(match[1]); // Pegar apenas o grupo capturado
                  }
                  if (clients.length > 0) {
                    finalCustomers = [...new Set(clients)]; // Remove duplicatas
                    break;
                  }
                }
              } else if (i === 2) {
                // Padrão específico LAG: NOME-P1-LAG[numero] ou NOME-P2-LAG[numero] com grupo de captura
                const matches = desc.match(pattern);
                if (matches && matches.length > 0) {
                  // Para o padrão LAG com P1/P2, pegar apenas o grupo capturado (o nome do cliente)
                  const regex = /^([A-Z][A-Z0-9]+)-P[12]-LAG\d+/gi;
                  const clients = [];
                  let match;
                  while ((match = regex.exec(desc)) !== null) {
                    clients.push(match[1]); // Pegar apenas o grupo capturado
                  }
                  if (clients.length > 0) {
                    finalCustomers = [...new Set(clients)]; // Remove duplicatas
                    break;
                  }
                }
              } else if (i === 3) {
                // Padrão alternativo LAG: NOME-LAG[numero] (sem P1/P2) com grupo de captura
                const matches = desc.match(pattern);
                if (matches && matches.length > 0) {
                  // Para o padrão LAG direto, pegar apenas o grupo capturado (o nome do cliente)
                  const regex = /^([A-Z][A-Z0-9]+)-LAG\d+/gi;
                  const clients = [];
                  let match;
                  while ((match = regex.exec(desc)) !== null) {
                    clients.push(match[1]); // Pegar apenas o grupo capturado
                  }
                  if (clients.length > 0) {
                    finalCustomers = [...new Set(clients)]; // Remove duplicatas
                    break;
                  }
                }
              } else {
                // Outros padrões normais
                const matches = desc.match(pattern);
                if (matches && matches.length > 0) {
                  finalCustomers = [...new Set(matches)]; // Remove duplicatas
                  break;
                }
              }
            }
            
            if (finalCustomers.length > 0) break; // Se encontrou, parar de buscar
          }
          
          // Se ainda não encontrou, usar um fallback baseado no padrão da descrição
          if (finalCustomers.length === 0 && description) {
            if (description.includes('-P') || description.includes('LAG')) {
              // Tentar extrair a parte antes do "-P" ou "LAG"
              const match = description.match(/^([A-Z]+(?:\s+[A-Z]+)*)/);
              if (match) {
                finalCustomers = [match[1].trim()];
              }
            }
          }
          
            // Último fallback: usar "DESCONHECIDO"
            if (finalCustomers.length === 0) {
              finalCustomers = ['CLIENTE_DESCONHECIDO'];
            }
          }
        }
        
        
        return {
          id: index,
          equipment_name: response.equipment?.hostname || equipmentName,
          equipment_location: response.equipment?.location || '',
          backup_date: response.equipment?.last_backup || '',
          raw_config: '',
          vpn_id: vpn.vpn_id,
          loopback_ip: response.equipment?.ip_address || '',
          neighbor_ip: vpn.neighbor?.ip || '',
          neighbor_hostname: vpn.neighbor?.hostname || '',
          access_interface: localInterface,
          encapsulation: vpn.encapsulation || '',
          description: vpn.description || '',
          group_name: '',
          customers: finalCustomers,
          highlights: [],
          vpws_groups: vpn.vpn_id ? [{
            id: vpn.vpn_id,
            name: `VPN ${vpn.vpn_id}`,
            vpns: [{
              id: vpn.vpn_id,
              vpn_id: vpn.vpn_id,
              name: vpn.description || `VPN ${vpn.vpn_id}`
            }]
          }] : [],
          customer_services: finalCustomers.map((customer: string, idx: number) => ({
            id: index + idx,
            customer_name: customer,
            service_type: 'VPN'
          })),
          destination_info: {
            hostname: vpn.neighbor?.hostname || 'N/A',
            ip: vpn.neighbor?.ip || 'N/A',
            isInDatabase: true,
            neighborIp: vpn.neighbor?.ip || 'N/A',
            vpwsGroup: null,
            // Interface LOCAL (do equipamento buscado)
            localInterface: {
              name: localInterface || 'N/A',
              details: {
                ...localInterfaceDetails,
                found_in_db: localInterfaceDetails.found_in_db || false,
                lag_members: localInterfaceDetails.lag_members || [],
                note: localInterfaceDetails.note || '',
                // DEBUG: Garantir que os dados das LAGs sejam transferidos
                debug_lag_members: localInterfaceDetails.lag_members,
                debug_note: localInterfaceDetails.note,
                debug_description: localInterfaceDetails.description
              },
              capacity: interfaceCapacity,
              media: localInterfaceDetails.type || 'physical',
              description: localInterfaceDetails.description || vpn.description || 'N/A'
            },
            // Interface REMOTA (do equipamento conectado)
            remoteInterface: {
              name: remoteInterface || 'N/A',
              details: {
                ...remoteInterfaceDetails,
                found_in_db: remoteInterfaceDetails.found_in_db || false,
                lag_members: remoteInterfaceDetails.lag_members || [],
                note: remoteInterfaceDetails.note || ''
              },
              capacity: neighborInterfaceCapacity,
              media: remoteInterfaceDetails.type || 'physical',
              description: remoteInterfaceDetails.description || 'N/A'
            },
            // Manter compatibilidade com código antigo
            sideBInterface: {
              name: localInterface || 'N/A',
              details: {
                ...localInterfaceDetails,
                found_in_db: localInterfaceDetails.found_in_db || false,
                lag_members: localInterfaceDetails.lag_members || [],
                note: localInterfaceDetails.note || ''
              },
              capacity: interfaceCapacity,
              media: localInterfaceDetails.type || 'physical',
              description: localInterfaceDetails.description || vpn.description || 'N/A'
            },
            sideAInterface: {
              name: remoteInterface || 'N/A',
              details: {
                ...remoteInterfaceDetails,
                found_in_db: remoteInterfaceDetails.found_in_db || false,
                lag_members: remoteInterfaceDetails.lag_members || [],
                note: remoteInterfaceDetails.note || ''
              },
              capacity: neighborInterfaceCapacity,
              media: remoteInterfaceDetails.type || 'physical',
              description: remoteInterfaceDetails.description || 'N/A'
            }
          },
          opposite_interface: remoteInterface,
          vlan_id: vpn.encapsulation_details?.vlans?.[0]?.vlan || '',
          pw_type: vpn.encapsulation_type || 'vlan',
          customer_name: finalCustomers[0] || '',
          interface_description: localInterfaceDetails.description || '',
          interface_found_in_db: localInterfaceDetails.found_in_db || false,
          interface_lag_members: localInterfaceDetails.lag_members || [],
          interface_note: localInterfaceDetails.note || '',
          neighbor_interface_description: remoteInterfaceDetails.description || '',
          neighbor_interface_found_in_db: remoteInterfaceDetails.found_in_db || false
        };
      }));
      
      console.log('🎯 MPLS SERVICE - Total de VPNs encontradas para o equipamento:', convertedResults.length);
      console.log('📊 MPLS SERVICE - Dados do equipamento:', response.equipment);
      
      // DEBUG FINAL: Log de todos os clientes que serão retornados
      console.log('🚀 MPLS SERVICE - RESULTADO FINAL - Clientes por VPN:');
      convertedResults.forEach((result, index) => {
        console.log(`  VPN ${result.vpn_id}: Clientes [${result.customers?.join(', ') || 'N/A'}] - Descrição: "${result.description}"`);
      });
      
      return convertedResults;
      
    } catch (error) {
      console.error('❌ Erro na busca por equipamento:', error);
      return [];
    }
  }

  // Fallback para busca alternativa se o relatório falhar
  private async fallbackSearch(query: string): Promise<SearchResult[]> {
    try {
      console.log('🔄 MPLS SERVICE - Usando fallback de busca...');
      
      // Função auxiliar para detectar forma de paginação e consolidar resultados
      const collectAllResults = async (): Promise<{ items: any[]; total: number; meta: any }> => {
        const allItems: any[] = [];
        
        // 1) Primeiro, tentar paginação por page com page_size maior
        console.log('🔄 MPLS SERVICE - Tentando paginação por page...');
        let page = 1;
        let hasMoreData = true;
        
        while (hasMoreData && page <= 50) {
          try {
            const resp = await this.request<any>('/search/', {
              params: { 
                q: query, 
                page, 
                page_size: 100  // Aumentar para 100 por página
              } 
            });
            
            const pageItems = resp.results || resp.data?.results || resp.items || [];
            console.log(`📄 MPLS SERVICE - page=${page} recv=${pageItems.length} total_acumulado=${allItems.length}`);
            
            if (pageItems.length === 0) {
              hasMoreData = false;
              break;
            }
            
            // Adicionar todos os itens desta página
            allItems.push(...pageItems);
            
            // Se recebeu menos que o page_size, provavelmente é a última página
            if (pageItems.length < 100) {
              hasMoreData = false;
            }
            
            page++;
          } catch (error) {
            console.error(`❌ Erro na página ${page}:`, error);
            break;
          }
        }
        
        // 2) Se ainda não temos dados suficientes, tentar offset/limit
        if (allItems.length < 30) {
          console.log('🔄 MPLS SERVICE - Tentando paginação por offset/limit...');
          let offset = 0;
          const limit = 100;
          
          while (offset < 1000) { // Limite de segurança
            try {
            const resp = await this.request<any>('/search/', {
                params: { 
                  q: query, 
                  offset, 
                  limit 
                } 
              });
              
              const pageItems = resp.results || resp.data?.results || resp.items || [];
              console.log(`📑 MPLS SERVICE - offset=${offset} recv=${pageItems.length} total_acumulado=${allItems.length}`);
              
              if (pageItems.length === 0) {
                break;
              }
              
              // Adicionar todos os itens desta página
              allItems.push(...pageItems);
            offset += pageItems.length;
              
              // Se recebeu menos que o limit, provavelmente é a última página
              if (pageItems.length < limit) {
                break;
              }
            } catch (error) {
              console.error(`❌ Erro no offset ${offset}:`, error);
              break;
            }
          }
        }
        
        // 3) Remover duplicatas APÓS coletar todos os dados
        console.log(`🔍 MPLS SERVICE - Total coletado antes de deduplicação: ${allItems.length}`);
        
        const uniqueItems: any[] = [];
        const seen = new Set<string>();
        
        for (const item of allItems) {
          // Criar chave mais específica para VPNs
          const key = `${item.vpn_id || 'N/A'}-${item.equipment_name || 'N/A'}-${item.neighbor_ip || 'N/A'}-${item.access_interface || 'N/A'}-${item.description || 'N/A'}`;
          
          if (!seen.has(key)) {
            seen.add(key);
            uniqueItems.push(item);
          }
        }
        
        console.log(`🎯 MPLS SERVICE - Total único após deduplicação: ${uniqueItems.length}`);
        console.log(`📊 MPLS SERVICE - Duplicatas removidas: ${allItems.length - uniqueItems.length}`);
        
        return { items: uniqueItems, total: uniqueItems.length, meta: { query } };
      };

      const { items, total, meta } = await collectAllResults();

      console.log('🔥 MPLS SERVICE - Search API response (consolidado):', { total, received: items.length });
      console.log('📊 MPLS SERVICE - Search stats:', {
        resultsCount: items.length || 0,
        total: total,
        query: meta.query || query
      });

      // Mapear os dados da API para o formato esperado pelo frontend
      const mappedResults: SearchResult[] = items.map((item, index) => {
        const it = item as Record<string, any>;
        return ({
        id: index,
          equipment_name: it.equipment_name || '',
          equipment_location: it.location || it.equipment_location || '',
          backup_date: it.last_backup || it.backup_date || '',
        raw_config: '',
        // Dados detalhados do equipamento/VPN
          vpn_id: it.vpn_id,
          loopback_ip: it.loopback_ip,
          neighbor_ip: it.neighbor_ip,
          neighbor_hostname: it.neighbor_hostname,
          access_interface: it.access_interface,
          encapsulation: it.encapsulation,
          description: it.description,
          group_name: it.group_name,
          customers: (it.customers as string[]) || [],
          highlights: (it.highlights as any[]) || [],
          vpws_groups: it.vpn_id ? [{
            id: it.vpn_id || index,
            name: `VPN ${it.vpn_id || 'N/A'}`,
          vpns: [{
              id: it.vpn_id || index,
              vpn_id: it.vpn_id || 0,
              name: it.description || `VPN ${it.vpn_id || 'N/A'}`
          }]
        }] : [],
          customer_services: it.customers && (it.customers as string[]).length > 0 ? [{
          id: index,
            customer_name: (it.customers as string[])[0],
          service_type: 'VPN'
        }] : []
        });
      });
      
      // Adicionar metadados aos resultados para o frontend
      // Garantir que total corresponda ao que foi realmente reunido
      (mappedResults as any).total = mappedResults.length;
      (mappedResults as any).query = meta.query || query;
      
      return mappedResults;
    } catch (error) {
      console.error('❌ Erro no fallback de busca:', error);
      return [];
    }
  }

  async getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
    try {
      // Usar a API de sugestões que está funcionando
      const response = await this.request<any>('/search/suggestions/', {
        params: { q: query }
      });
      
      // Verificar se a resposta é um array ou tem a estrutura esperada
      let suggestions = [];
      if (Array.isArray(response)) {
        suggestions = response;
      } else if (response && Array.isArray(response.suggestions)) {
        suggestions = response.suggestions;
      } else if (response && response.data && Array.isArray(response.data)) {
        suggestions = response.data;
      }
      
      // Garantir que as sugestões tenham o formato correto
      return suggestions.map((item: any) => ({
        term: item.term || item.suggestion || '',
        type: item.type || 'auto',
        count: item.count || 0
      }));
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
      return [];
    }
  }

  async advancedSearch(filters: AdvancedSearchFilters): Promise<SearchResult[]> {
    return this.request<SearchResult[]>('/search/advanced/', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  }

  // Customer Report Methods
  async getCustomerReport(customerName: string): Promise<CustomerReportData> {
    try {
      const response = await this.request<any>('/reports/customers/', {
        params: { customer: customerName }
      });
      
      console.log('🔥 MPLS SERVICE - Customer report API response:', response);
      console.log('🔍 MPLS SERVICE - Response structure check:', {
        hasResults: !!response.results,
        resultsLength: response.results?.length || 0,
        hasCustomerName: !!response.customer_name,
        hasTotalVpns: !!response.total_vpns
      });
      
      // Processar a nova estrutura da API com results contendo VPNs individuais
      if (response && response.results) {
        // Agrupar por localização de equipamento
        const locationGroups: { [key: string]: any[] } = {};
        
        response.results.forEach((vpn: any) => {
          // Processar lado A
          if (vpn.side_a && vpn.side_a.equipment) {
            const location = vpn.side_a.equipment.location || 'Localização não especificada';
            if (!locationGroups[location]) {
              locationGroups[location] = [];
            }
            locationGroups[location].push({
              vpn_id: vpn.vpn_id,
              side: 'A',
              equipment_name: vpn.side_a.equipment.hostname,
              location: vpn.side_a.equipment.location,
              loopback_ip: vpn.side_a.equipment.loopback_ip,
              neighbor_hostname: vpn.side_a.neighbor?.hostname,
              neighbor_ip: vpn.side_a.neighbor?.loopback_ip,
              access_interface: vpn.side_a.access_interface,
              interface_details: vpn.side_a.access_interface_details,
              vpws_group: vpn.side_a.vpws_group,
              encapsulation: vpn.encapsulation,
              description: vpn.description,
              pw_type: vpn.pw_type
            });
          }
          
          // Processar lado B
          if (vpn.side_b && vpn.side_b.equipment) {
            const location = vpn.side_b.equipment.location || 'Localização não especificada';
            if (!locationGroups[location]) {
              locationGroups[location] = [];
            }
            locationGroups[location].push({
              vpn_id: vpn.vpn_id,
              side: 'B',
              equipment_name: vpn.side_b.equipment.hostname,
              location: vpn.side_b.equipment.location,
              loopback_ip: vpn.side_b.equipment.loopback_ip,
              neighbor_hostname: vpn.side_b.neighbor?.hostname,
              neighbor_ip: vpn.side_b.neighbor?.loopback_ip,
              access_interface: vpn.side_b.access_interface,
              interface_details: vpn.side_b.access_interface_details,
              vpws_group: vpn.side_b.vpws_group,
              encapsulation: vpn.encapsulation,
              description: vpn.description,
              pw_type: vpn.pw_type
            });
          }
        });
        
        // Converter para o formato esperado pelo frontend
        const groups = Object.keys(locationGroups).map(location => ({
          location,
          equipments: this.groupByEquipment(locationGroups[location])
        }));
        
        return {
          customer_name: response.customer_name || customerName,
          total_locations: Object.keys(locationGroups).length,
          total_equipments: groups.reduce((total, group) => total + group.equipments.length, 0),
          total_interfaces: response.total_vpns || 0,
          total_services: response.total_vpns || 0,
          groups: groups,
          vpns: response.results
        };
      }
      
      // Se não tiver a estrutura esperada, retornar estrutura vazia
      return {
        customer_name: customerName,
        total_locations: 0,
        total_equipments: 0,
        total_interfaces: 0,
        total_services: 0,
        groups: []
      };
    } catch (error) {
      console.error('Erro ao buscar relatório do cliente:', error);
      return {
        customer_name: customerName,
        total_locations: 0,
        total_equipments: 0,
        total_interfaces: 0,
        total_services: 0,
        groups: []
      };
    }
  }

  private groupByEquipment(items: any[]): any[] {
    const equipmentGroups: { [key: string]: any } = {};
    
    items.forEach(item => {
      const equipmentName = item.equipment_name;
      if (!equipmentGroups[equipmentName]) {
        equipmentGroups[equipmentName] = {
          name: equipmentName,
          location: item.location,
          loopback_ip: item.loopback_ip,
          last_backup: '', // TODO: Implementar quando disponível na API
          interfaces: []
        };
      }
      
      equipmentGroups[equipmentName].interfaces.push({
        vpn_id: item.vpn_id,
        side: item.side,
        name: item.access_interface,
        description: item.description,
        neighbor_hostname: item.neighbor_hostname,
        neighbor_ip: item.neighbor_ip,
        vpws_group: item.vpws_group,
        encapsulation: item.encapsulation,
        bandwidth: item.interface_details?.speed || '',
        status: 'active'
      });
    });
    
    return Object.values(equipmentGroups);
  }

  async exportCustomerReportExcel(customerName: string): Promise<void> {
    const response = await api({
      url: `${this.baseUrl}/reports/customers/excel/`,
      method: 'GET',
      params: { customer: customerName },
      responseType: 'blob'
    });

    // Handle file download
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `customer_report_${customerName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async exportReport(reportType: string, options: any = {}): Promise<void> {
    const response = await api({
      url: `${this.baseUrl}/reports/export/`,
      method: 'POST',
      data: {
        report_type: reportType,
        ...options
      },
      responseType: 'blob'
    });

    // Handle file download
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // Network Management Methods (Novos métodos integrados)
  async scanNetwork(username?: string, password?: string): Promise<any> {
    try {
      const response = await this.request<any>('/api/mpls-analyzer/network/scan/', {
        method: 'POST',
        data: { username, password }
      });
      return response;
    } catch (error) {
      console.error('Erro no scan da rede:', error);
      throw error;
    }
  }

  async backupAllDevices(username?: string, password?: string): Promise<any> {
    try {
      const response = await this.request<any>('/api/mpls-analyzer/backup/execute/', {
        method: 'POST',
        data: { username, password }
      });
      return response;
    } catch (error) {
      console.error('Erro no backup dos dispositivos:', error);
      throw error;
    }
  }

  async getBackupStatus(): Promise<any> {
    try {
      const response = await this.request<any>('/api/mpls-analyzer/backup/status/');
      return response;
    } catch (error) {
      console.error('Erro ao verificar status do backup:', error);
      throw error;
    }
  }

  async fixMalformedJson(): Promise<any> {
    try {
      const response = await this.request<any>('/api/mpls-analyzer/fix-json/', {
        method: 'POST'
      });
      return response;
    } catch (error) {
      console.error('Erro ao corrigir JSONs malformados:', error);
      throw error;
    }
  }

  // Utility methods
  formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString('pt-BR');
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('pt-BR');
  }

  formatBandwidth(bandwidth: string): string {
    const num = parseInt(bandwidth);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}G`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}M`;
    }
    return `${num}K`;
  }

  getInterfaceStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'up': return 'status-up';
      case 'down': return 'status-down';
      case 'admin-down': return 'status-admin-down';
      default: return 'status-unknown';
    }
  }

  detectSearchType(searchQuery: string): string {
    if (!searchQuery) return 'auto';
    
    // IP address pattern
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(searchQuery)) {
      return 'IP Address';
    }
    
    // MAC address pattern
    if (/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(searchQuery)) {
      return 'MAC Address';
    }
    
    // Pure numeric (VPN ID or VLAN)
    if (/^\d+$/.test(searchQuery)) {
      return searchQuery.length <= 4 ? 'VLAN/VPN ID' : 'VPN ID';
    }
    
    // Interface patterns
    if (/interface|gi|fa|eth/i.test(searchQuery)) {
      return 'Interface';
    }
    
    // Serial number pattern (alphanumeric, longer strings)
    if (searchQuery.length > 8 && /^[A-Z0-9]+$/.test(searchQuery)) {
      return 'Serial Number';
    }
    
    return 'Text Search';
  }

  private extractInterfaceCapacity(interfaceName: string, interfaceDetails?: any): string {
    if (!interfaceName) return 'N/A';

    // Se temos detalhes da interface, usar essa informação primeiro
    if (interfaceDetails) {
      // Se tem informação de speed nos detalhes
      if (interfaceDetails.speed) {
        return interfaceDetails.speed;
      }
      
      // Se é uma LAG, calcular capacidade baseada nos membros
      if (interfaceDetails.lag_members && Array.isArray(interfaceDetails.lag_members) && interfaceDetails.lag_members.length > 0) {
        let totalCapacity = 0;
        
        interfaceDetails.lag_members.forEach((member: string) => {
          const memberCapacity = this.extractInterfaceCapacity(member);
          if (memberCapacity !== 'N/A') {
            const match = memberCapacity.match(/(\d+)([GMK])/);
            if (match) {
              let value = parseInt(match[1]);
              const memberUnit = match[2];
              
              // Converter tudo para Gbps para somar
              if (memberUnit === 'M') value = value / 1000;
              else if (memberUnit === 'K') value = value / 1000000;
              
              totalCapacity += value;
            }
          }
        });
        
        if (totalCapacity > 0) {
          if (totalCapacity >= 1) {
            return `${Math.round(totalCapacity)}G`;
          } else {
            return `${Math.round(totalCapacity * 1000)}M`;
          }
        }
      }
    }

    // Verificar se é uma LAG sem detalhes - não extrair número do nome
    if (/^lag-\d+$/i.test(interfaceName)) {
      return 'LAG'; // Retornar apenas LAG se não temos os membros
    }

    // Extrair capacidade de diferentes tipos de interface MPLS
    const interfacePatterns = [
      { pattern: /hundred-gigabit/i, capacity: '100G' },
      { pattern: /twenty-five-g/i, capacity: '25G' },
      { pattern: /ten-gigabit/i, capacity: '10G' },
      { pattern: /gigabit/i, capacity: '1G' },
      { pattern: /fast-ethernet/i, capacity: '100M' },
      { pattern: /ethernet/i, capacity: '10M' }
    ];

    // Verificar padrões conhecidos primeiro
    for (const { pattern, capacity } of interfacePatterns) {
      if (pattern.test(interfaceName)) {
        return capacity;
      }
    }

    // Fallback para interfaces comuns
    if (interfaceName.includes('100G') || interfaceName.includes('100g')) return '100G';
    if (interfaceName.includes('25G') || interfaceName.includes('25g')) return '25G';
    if (interfaceName.includes('10G') || interfaceName.includes('10g')) return '10G';
    if (interfaceName.includes('1G') || interfaceName.includes('1g')) return '1G';

    return 'N/A';
  }

  // Método auxiliar para calcular velocidade de LAGs
  private calculateLagSpeed(interfaceConfig: any[]): string {
    if (!interfaceConfig || !Array.isArray(interfaceConfig)) return 'N/A';
    
    let totalSpeed = 0;
    interfaceConfig.forEach((iface: any) => {
      const speed = this.extractInterfaceCapacity(iface['interface-name']);
      if (speed !== 'N/A') {
        const match = speed.match(/(\d+)([GMK])/);
        if (match) {
          let value = parseInt(match[1]);
          const unit = match[2];
          
          // Converter tudo para Gbps
          if (unit === 'M') value = value / 1000;
          else if (unit === 'K') value = value / 1000000;
          
          totalSpeed += value;
        }
      }
    });
    
    if (totalSpeed > 0) {
      if (totalSpeed >= 1) {
        return `${Math.round(totalSpeed)}G`;
      } else {
        return `${Math.round(totalSpeed * 1000)}M`;
      }
    }
    
    return 'LAG';
  }

  // Método auxiliar para encontrar informações de interface
  private findInterfaceInfo(data: any, interfaceName: string): any {
    // Buscar em ten-gigabit-ethernet
    if (data?.interface?.['dmos-interface-ethernet:ten-gigabit-ethernet']) {
      const found = data.interface['dmos-interface-ethernet:ten-gigabit-ethernet'].find((i: any) => 
        `${i['chassis-id']}/${i['slot-id']}/${i['port-id']}` === interfaceName.replace('ten-gigabit-ethernet-', '')
      );
      if (found) return { speed: found.speed, description: found.description };
    }
    
    // Buscar em hundred-gigabit-ethernet
    if (data?.interface?.['dmos-interface-ethernet:hundred-gigabit-ethernet']) {
      const found = data.interface['dmos-interface-ethernet:hundred-gigabit-ethernet'].find((i: any) => 
        `${i['chassis-id']}/${i['slot-id']}/${i['port-id']}` === interfaceName.replace('hundred-gigabit-ethernet-', '')
      );
      if (found) return { speed: found.speed, description: found.description };
    }
    
    return null;
  }
}

const mplsService = new MplsService();
export { mplsService };
export default mplsService;
