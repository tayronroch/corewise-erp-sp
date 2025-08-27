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

      // Detectar se a query parece ser nome de cliente
      const customerPattern = /(TECNET|MEGALINK|VILARNET|NETPAC|HIITECH|JRNET|TECHFIBRA|CONNECT|DIGITALNET|ACCORD|HENRIQUE|MULTLINK|INFOWEB|ULTRANET|ORLATELECOM)/i;
      if (customerPattern.test(query) || query.length > 3) {
        console.log('🏢 MPLS SERVICE - Query detectada como cliente, usando searchByCustomerName:', query);
        return this.searchByCustomerName(query);
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

  // Busca específica por equipamento - NOVA IMPLEMENTAÇÃO COM PARSER JSON
  async searchByEquipment(equipmentName: string): Promise<SearchResult[]> {
    try {
      console.log('🔍 MPLS SERVICE - Buscando equipamento com nova implementação:', equipmentName);

      // 1. Usar a nova função de busca estruturada
      const equipmentData = await this.searchEquipmentByName(equipmentName);
      
      if (!equipmentData.localEquipment) {
        console.log('❌ MPLS SERVICE - Equipamento não encontrado');
        return [];
      }

      // 2. Converter para o formato SearchResult[]
      const convertedResults: SearchResult[] = equipmentData.remoteConnections.map((connection, index) => {
        // Encontrar interface local
        const localInterface = equipmentData.localEquipment.interfaces.find((intf: any) => 
          intf.name === connection.localInterface
        );

        // Extrair cliente da descrição da interface
        let customerName = connection.customer || 'N/A';
        if (customerName === 'N/A') {
          if (localInterface?.type === 'lag' && localInterface?.lagMemberDetails) {
            // Para LAGs, usar descrição das interfaces membros
            const customerMember = localInterface.lagMemberDetails.find((member: any) =>
              member.description && member.description.toUpperCase().startsWith('CUSTOMER-')
            );
            if (customerMember) {
              customerName = this.extractClientFromDescription(customerMember.description) || 'CLIENTE_DESCONHECIDO';
            }
          } else if (localInterface?.description) {
            customerName = this.extractClientFromDescription(localInterface.description) || 'CLIENTE_DESCONHECIDO';
          }
          
          if (customerName === 'N/A') {
            customerName = 'CLIENTE_DESCONHECIDO';
          }
        }

        return {
          id: index,
          equipment_name: equipmentData.localEquipment.equipment.hostname,
          equipment_location: equipmentData.localEquipment.equipment.location || '',
          backup_date: new Date().toISOString().split('T')[0], // Usar data atual como fallback
          raw_config: '',
          vpn_id: connection.vpnId,
          loopback_ip: equipmentData.localEquipment.equipment.loopbackIp,
          neighbor_ip: connection.remoteIp,
          neighbor_hostname: connection.remoteEquipment,
          access_interface: connection.localInterface,
          encapsulation: connection.encapsulation,
          description: localInterface?.description || '',
          group_name: connection.remoteEquipment,
          customers: [customerName],
          highlights: [],
          vpws_groups: [{
            id: connection.vpnId,
            name: `VPN ${connection.vpnId}`,
            vpns: [{
              id: connection.vpnId,
              vpn_id: connection.vpnId,
              name: `VPN ${connection.vpnId}`
            }]
          }],
          customer_services: [{
            id: index,
            customer_name: customerName,
            service_type: 'VPN'
          }],
          destination_info: {
            hostname: connection.remoteEquipment,
            ip: connection.remoteIp,
            isInDatabase: true,
            neighborIp: connection.remoteIp,
            vpwsGroup: null,
            localInterface: {
              name: connection.localInterface,
              details: {
                ...localInterface || {},
                // Se for LAG, incluir detalhes dos membros
                physicalMembers: localInterface?.type === 'lag' && localInterface?.lagMemberDetails ? 
                  localInterface.lagMemberDetails.map((member: any) => ({
                    interface: member.name,
                    speed: member.speed,
                    description: member.description,
                    customer: this.extractClientFromDescription(member.description) || 'N/A'
                  })) : 
                  undefined,
                membersSummary: localInterface?.type === 'lag' && localInterface?.lagMemberDetails ?
                  `Membros: ${localInterface.lagMemberDetails.map((m: any) => 
                    `${m.name}(${m.speed}): ${this.extractClientFromDescription(m.description) || 'N/A'}`
                  ).join(', ')}` :
                  undefined
              },
              capacity: localInterface?.speed || 'N/A',
              media: localInterface?.type === 'lag' ? 'lag' : 'physical',
              description: localInterface?.description || ''
            },
            remoteInterface: {
              name: connection.remoteInterface || 'N/A',
              details: {
                ...connection.remoteInterfaceFullData || {},
                // Se for LAG remota, incluir detalhes dos membros
                physicalMembers: connection.remoteInterfaceFullData?.type === 'lag' && connection.remoteInterfaceFullData?.lagMemberDetails ? 
                  connection.remoteInterfaceFullData.lagMemberDetails.map((member: any) => ({
                    interface: member.name,
                    speed: member.speed,
                    description: member.description,
                    customer: this.extractClientFromDescription(member.description) || 'N/A'
                  })) : 
                  undefined,
                membersSummary: connection.remoteInterfaceFullData?.type === 'lag' && connection.remoteInterfaceFullData?.lagMemberDetails ?
                  `Membros Remotos: ${connection.remoteInterfaceFullData.lagMemberDetails.map((m: any) => 
                    `${m.name}(${m.speed}): ${this.extractClientFromDescription(m.description) || 'N/A'}`
                  ).join(', ')}` :
                  undefined
              },
              capacity: this.calculateTotalInterfaceCapacity(connection.remoteInterfaceFullData) || 'N/A',
              media: connection.remoteInterfaceFullData?.type === 'lag' ? 'lag' : 'physical',
              description: connection.remoteInterfaceDetails || 'Interface remota'
            },
            sideBInterface: {
              name: connection.localInterface,
              details: {
                ...localInterface || {},
                // Se for LAG local, incluir detalhes dos membros
                physicalMembers: localInterface?.type === 'lag' && localInterface?.lagMemberDetails ? 
                  localInterface.lagMemberDetails.map((member: any) => ({
                    interface: member.name,
                    speed: member.speed,
                    description: member.description,
                    customer: this.extractClientFromDescription(member.description) || 'N/A'
                  })) : 
                  undefined,
                membersSummary: localInterface?.type === 'lag' && localInterface?.lagMemberDetails ?
                  `Membros Locais: ${localInterface.lagMemberDetails.map((m: any) => 
                    `${m.name}(${m.speed}): ${this.extractClientFromDescription(m.description) || 'N/A'}`
                  ).join(', ')}` :
                  undefined
              },
              capacity: localInterface?.speed || 'N/A',
              media: localInterface?.type === 'lag' ? 'lag' : 'physical',
              description: localInterface?.description || ''
            },
            sideAInterface: {
              name: connection.remoteInterface || 'N/A',
              details: {
                ...connection.remoteInterfaceFullData || {},
                // Se for LAG remota, incluir detalhes dos membros
                physicalMembers: connection.remoteInterfaceFullData?.type === 'lag' && connection.remoteInterfaceFullData?.lagMemberDetails ? 
                  connection.remoteInterfaceFullData.lagMemberDetails.map((member: any) => ({
                    interface: member.name,
                    speed: member.speed,
                    description: member.description,
                    customer: this.extractClientFromDescription(member.description) || 'N/A'
                  })) : 
                  undefined,
                membersSummary: connection.remoteInterfaceFullData?.type === 'lag' && connection.remoteInterfaceFullData?.lagMemberDetails ?
                  `Membros Remotos: ${connection.remoteInterfaceFullData.lagMemberDetails.map((m: any) => 
                    `${m.name}(${m.speed}): ${this.extractClientFromDescription(m.description) || 'N/A'}`
                  ).join(', ')}` :
                  undefined
              },
              capacity: this.calculateTotalInterfaceCapacity(connection.remoteInterfaceFullData) || 'N/A',
              media: connection.remoteInterfaceFullData?.type === 'lag' ? 'lag' : 'physical',
              description: connection.remoteInterfaceDetails || 'Interface remota'
            }
          },
          opposite_interface: connection.remoteInterface || 'N/A',
          vlan_id: connection.encapsulation.split(':')[1]?.split(',')[0] || '',
          pw_type: connection.encapsulation?.startsWith('qinq:') ? 'qinq' : 'vlan',
          customer_name: customerName,
          interface_description: localInterface?.description || '',
          interface_found_in_db: true,
          interface_lag_members: localInterface?.lagMembers || [],
          interface_note: localInterface?.type === 'lag' ? 
            `LAG LOCAL com ${localInterface?.lagMembers?.length || 0} membros: ${localInterface?.lagMemberDetails?.map((m: any) => 
              `${m.name}(${m.speed}) - ${this.extractClientFromDescription(m.description) || 'N/A'}`
            ).join(', ')}${
              connection.remoteInterfaceFullData?.type === 'lag' && connection.remoteInterfaceFullData?.lagMemberDetails ? 
              ` | LAG REMOTA com ${connection.remoteInterfaceFullData.lagMembers?.length || 0} membros: ${connection.remoteInterfaceFullData.lagMemberDetails.map((m: any) => 
                `${m.name}(${m.speed}) - ${this.extractClientFromDescription(m.description) || 'N/A'}`
              ).join(', ')}` : ''
            }` : 
            (connection.remoteInterfaceFullData?.type === 'lag' && connection.remoteInterfaceFullData?.lagMemberDetails ? 
              `INTERFACE REMOTA LAG com ${connection.remoteInterfaceFullData.lagMembers?.length || 0} membros: ${connection.remoteInterfaceFullData.lagMemberDetails.map((m: any) => 
                `${m.name}(${m.speed}) - ${this.extractClientFromDescription(m.description) || 'N/A'}`
              ).join(', ')}` : ''),
          neighbor_interface_description: connection.remoteInterfaceDetails || 'Interface remota',
          neighbor_interface_found_in_db: connection.remoteInterface !== 'N/A',
          neighbor_customer_name: connection.remoteCustomerName || 'N/A'
        };
      });

      console.log('🎯 MPLS SERVICE - Total de VPNs encontradas (nova implementação):', convertedResults.length);
      console.log('📊 MPLS SERVICE - Dados do equipamento local:', equipmentData.localEquipment.equipment);

      return convertedResults;

    } catch (error) {
      console.error('❌ MPLS SERVICE - Erro na nova implementação, usando fallback:', error);
      return this.searchByEquipmentLegacy(equipmentName);
    }
  }

  /**
   * Busca por nome de cliente usando o novo sistema otimizado
   * ULTRA-RÁPIDA: Usa índice otimizado do backend (< 200ms vs 3-5s anteriores)
   */
  async searchByCustomerName(customerName: string): Promise<SearchResult[]> {
    try {
      console.log('🚀 MPLS SERVICE - Usando busca otimizada para cliente:', customerName);
      console.time('Busca Otimizada Cliente');

      // 1. Tentar usar o novo endpoint otimizado primeiro
      try {
        const optimizedResponse = await this.request<any>('/search/customers/', {
          params: { q: customerName, limit: 100 }
        });

        console.timeEnd('Busca Otimizada Cliente');
        console.log('✅ MPLS SERVICE - Sistema otimizado funcionando! Resultados:', optimizedResponse?.results?.length || 0);

        if (optimizedResponse?.results && optimizedResponse.results.length > 0) {
          // Converter resultados otimizados para o formato SearchResult
          const searchResults: SearchResult[] = [];
          
          for (const customer of optimizedResponse.results) {
            console.log(`📋 Processando cliente otimizado: ${customer.name} (${customer.total_occurrences} ocorrências)`);
            
            // Para cada VPN ID do cliente, buscar detalhes
            for (const vpnId of customer.vpn_ids || []) {
              try {
                // Buscar configurações específicas da VPN
                const vpnConfig = await this.request<any>(`/customers/${customer.id}/configurations/`);
                
                if (vpnConfig?.vpn_configurations) {
                  for (const vpn of vpnConfig.vpn_configurations) {
                    if (vpn.vpn_id === vpnId) {
                      // Converter para formato SearchResult
                      for (const interface_info of vpn.interfaces) {
                        const result: SearchResult = {
                          id: customer.id || 0,
                          equipment_name: interface_info.equipment,
                          equipment_location: 'N/A',
                          backup_date: new Date().toISOString(),
                          raw_config: '',
                          vpn_id: vpn.vpn_id,
                          customer_name: customer.name,
                          access_interface: interface_info.interface,
                          encapsulation: interface_info.encapsulation || '',
                          description: interface_info.description || '',
                          pw_type: interface_info.encapsulation?.startsWith('qinq') ? 'qinq' : 'vlan'
                        };
                        searchResults.push(result);
                      }
                    }
                  }
                }
              } catch (vpnError) {
                console.warn('⚠️ Erro ao buscar configuração da VPN:', vpnId, vpnError);
              }
            }
          }

          console.log('🎯 MPLS SERVICE - Total de conexões convertidas do sistema otimizado:', searchResults.length);
          return searchResults;
        }
      } catch (optimizedError: any) {
        console.warn('⚠️ MPLS SERVICE - Sistema otimizado indisponível, usando fallback:', optimizedError.response?.status);
        
        // Se for 404, o endpoint não existe ainda
        if (optimizedError.response?.status === 404) {
          console.log('📡 MPLS SERVICE - Endpoints otimizados não disponíveis, usando sistema tradicional...');
        }
      }

      // 2. FALLBACK: Usar sistema tradicional se otimizado falhar
      console.log('🔄 MPLS SERVICE - Usando sistema tradicional como fallback...');
      
      const response = await this.request<any>('/reports/customers/', {
        params: { customer: customerName }
      });

      console.log('📊 MPLS SERVICE - VPNs encontradas no relatório tradicional:', response?.results?.length || 0);

      // Se encontrou poucas VPNs, fazer busca abrangente
      let shouldFallbackSearch = false;
      if (!response || !response.results || response.results.length < 5) {
        console.log('⚠️ MPLS SERVICE - Poucas VPNs no relatório, fazendo busca abrangente...');
        shouldFallbackSearch = true;
      }

      let allResults: SearchResult[] = [];

      // Processar resultados tradicionais
      if (response?.results && response.results.length > 0) {
        console.log('✅ MPLS SERVICE - Processando VPNs do relatório tradicional:', response.results.length);
        const reportResults = await this.processCustomerReportResults(response, customerName);
        allResults.push(...reportResults);
      }

      // Busca por descrições se necessário
      if (shouldFallbackSearch) {
        console.log('🔍 MPLS SERVICE - Iniciando busca por descrições em equipamentos...');
        const fallbackResults = await this.searchCustomerByDescriptions(customerName);
        
        const existingVpnIds = new Set(allResults.map(r => r.vpn_id));
        const uniqueFallbackResults = fallbackResults.filter(r => 
          r.vpn_id && !existingVpnIds.has(r.vpn_id)
        );
        
        console.log('📈 MPLS SERVICE - VPNs adicionais encontradas por descrição:', uniqueFallbackResults.length);
        allResults.push(...uniqueFallbackResults);
      }

      console.log('🎯 MPLS SERVICE - Total de conexões encontradas (fallback):', allResults.length);
      return allResults;

    } catch (error) {
      console.error('❌ MPLS SERVICE - Erro na busca por cliente:', error);
      return [];
    }
  }

  /**
   * Processa resultados do endpoint de relatório de clientes
   */
  private async processCustomerReportResults(response: any, customerName: string): Promise<SearchResult[]> {
    // Extrair lista de equipamentos únicos envolvidos nas VPNs do cliente
    const uniqueEquipments = new Set<string>();
    response.results.forEach((vpn: any) => {
      // Equipamentos principais
      if (vpn.side_a?.equipment?.hostname) uniqueEquipments.add(vpn.side_a.equipment.hostname);
      if (vpn.side_b?.equipment?.hostname) uniqueEquipments.add(vpn.side_b.equipment.hostname);
      
      // Equipamentos neighbors (para casos onde equipment não está disponível)
      if (vpn.side_a?.neighbor?.hostname) uniqueEquipments.add(vpn.side_a.neighbor.hostname);
      if (vpn.side_b?.neighbor?.hostname) uniqueEquipments.add(vpn.side_b.neighbor.hostname);
    });

    console.log('🎯 MPLS SERVICE - Equipamentos únicos identificados:', uniqueEquipments.size, Array.from(uniqueEquipments));

    // Buscar dados detalhados dos equipamentos únicos (com controle de rate limiting)
    const equipmentDataCache: { [key: string]: any } = {};
    const equipmentPromises = Array.from(uniqueEquipments).map(async (equipmentName, index) => {
      // Adicionar delay progressivo para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, index * 100)); // 100ms entre requests
      
      try {
        const data = await this.searchEquipmentByName(equipmentName);
        equipmentDataCache[equipmentName] = data;
        console.log(`✅ MPLS SERVICE - Dados carregados para ${equipmentName}`);
        return data;
      } catch (error) {
        console.error(`❌ MPLS SERVICE - Erro ao buscar ${equipmentName}:`, error);
        equipmentDataCache[equipmentName] = { localEquipment: null, remoteConnections: [] };
        return null;
      }
    });

    // Aguardar todas as requisições
    await Promise.allSettled(equipmentPromises);

    // Processar VPNs usando dados dos equipamentos carregados
    const convertedResults: SearchResult[] = [];
    const processedVpns = new Set<number>();

    response.results.forEach((vpn: any) => {
      if (processedVpns.has(vpn.vpn_id)) {
        return;
      }
      processedVpns.add(vpn.vpn_id);

      // Processar lado A -> lado B  
      const sideAHostname = vpn.side_a?.equipment?.hostname || vpn.side_a?.neighbor?.hostname;
      if (sideAHostname && equipmentDataCache[sideAHostname]) {
        const equipmentData = equipmentDataCache[sideAHostname];
        
        if (equipmentData.localEquipment) {
          const sideBHostname = vpn.side_b?.equipment?.hostname || vpn.side_b?.neighbor?.hostname;
          const relevantConnection = equipmentData.remoteConnections.find((conn: any) => 
            conn.vpnId === vpn.vpn_id || 
            (conn.remoteEquipment === sideBHostname && 
             conn.localInterface === vpn.side_a?.access_interface)
          );

          if (relevantConnection) {
            const result = this.buildSearchResultForCustomer(
              equipmentData, 
              relevantConnection, 
              customerName,
              convertedResults.length
            );
            convertedResults.push(result);
          }
        }
      }

      // Processar lado B -> lado A
      const sideBHostname = vpn.side_b?.equipment?.hostname || vpn.side_b?.neighbor?.hostname;
      if (sideBHostname && equipmentDataCache[sideBHostname]) {
        const equipmentData = equipmentDataCache[sideBHostname];
        
        if (equipmentData.localEquipment) {
          const sideAHostname = vpn.side_a?.equipment?.hostname || vpn.side_a?.neighbor?.hostname;
          const relevantConnection = equipmentData.remoteConnections.find((conn: any) => 
            conn.vpnId === vpn.vpn_id || 
            (conn.remoteEquipment === sideAHostname && 
             conn.localInterface === vpn.side_b?.access_interface)
          );

          if (relevantConnection) {
            const result = this.buildSearchResultForCustomer(
              equipmentData, 
              relevantConnection, 
              customerName,
              convertedResults.length
            );
            convertedResults.push(result);
          }
        }
      }
    });

    return convertedResults;
  }

  /**
   * Busca por cliente usando descrições das interfaces (busca abrangente)
   */
  private async searchCustomerByDescriptions(customerName: string): Promise<SearchResult[]> {
    try {
      console.log('🔍 MPLS SERVICE - Buscando por descrições para cliente:', customerName);
      
      // Lista de equipamentos principais para buscar (você pode expandir isso)
      const mainEquipments = [
        'PI-TERESINA-PICARRA-PE01', 'PI-TERESINA-PICARRA-PE02', 'PI-TERESINA-PICARRA-PE03',
        'PI-TERESINA-GURUPI-PE01', 'PI-TERESINA-SANTAFE-PE01', 'PI-TERESINA-SAOVICENTE-PE01',
        'PI-TERESINA-PLANALTO-PE01', 'PI-TERESINA-PORTOALEGRE-PE01', 'PI-TERESINA-TECNET-CE01',
        'PI-PARNAIBA-PE01', 'PI-UNIAO-PE01', 'PI-THE-DIGITALNET-RENATO-CE01'
      ];

      const allResults: SearchResult[] = [];
      
      // Buscar em cada equipamento principal
      for (const equipmentName of mainEquipments) {
        try {
          await new Promise(resolve => setTimeout(resolve, 150)); // Rate limiting
          
          console.log(`🔍 Buscando ${customerName} em ${equipmentName}...`);
          const equipmentData = await this.searchEquipmentByName(equipmentName);
          
          if (equipmentData.localEquipment) {
            // Filtrar conexões que tenham o cliente nas descrições
            const customerConnections = equipmentData.remoteConnections.filter((conn: any) => {
              // Verificar interface local
              const localInterface = equipmentData.localEquipment.interfaces.find((intf: any) => 
                intf.name === conn.localInterface
              );
              
              let hasCustomer = false;
              
              // Verificar descrição da interface principal
              if (localInterface?.description?.toUpperCase().includes(customerName.toUpperCase())) {
                hasCustomer = true;
              }
              
              // Verificar descrições dos membros LAG
              if (!hasCustomer && localInterface?.type === 'lag' && localInterface?.lagMemberDetails) {
                hasCustomer = localInterface.lagMemberDetails.some((member: any) =>
                  member.description?.toUpperCase().includes(customerName.toUpperCase())
                );
              }
              
              return hasCustomer;
            });

            // Converter conexões encontradas para SearchResult
            customerConnections.forEach((conn: any) => {
              const result = this.buildSearchResultForCustomer(
                equipmentData, 
                conn, 
                customerName,
                allResults.length
              );
              allResults.push(result);
            });
            
            if (customerConnections.length > 0) {
              console.log(`✅ Encontradas ${customerConnections.length} conexões de ${customerName} em ${equipmentName}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Erro ao buscar ${customerName} em ${equipmentName}:`, error);
        }
      }
      
      return allResults;
      
    } catch (error) {
      console.error('❌ MPLS SERVICE - Erro na busca por descrições:', error);
      return [];
    }
  }

  /**
   * Constrói um SearchResult a partir dos dados do equipamento e conexão para busca por cliente
   * Mesma lógica da busca por equipamento, mas adaptada para o contexto de cliente
   */
  private buildSearchResultForCustomer(
    equipmentData: any, 
    connection: any, 
    customerName: string,
    index: number
  ): SearchResult {
    // Encontrar interface local usando a mesma lógica da busca por equipamento
    const localInterface = equipmentData.localEquipment.interfaces.find((intf: any) => 
      intf.name === connection.localInterface
    );

    // Extrair cliente da descrição da interface se necessário (mesma lógica)
    let finalCustomerName = customerName;
    if (!finalCustomerName || finalCustomerName === 'N/A') {
      if (localInterface?.type === 'lag' && localInterface?.lagMemberDetails) {
        const customerMember = localInterface.lagMemberDetails.find((member: any) =>
          member.description && member.description.toUpperCase().startsWith('CUSTOMER-')
        );
        if (customerMember) {
          finalCustomerName = this.extractClientFromDescription(customerMember.description) || customerName;
        }
      } else if (localInterface?.description) {
        finalCustomerName = this.extractClientFromDescription(localInterface.description) || customerName;
      }
    }

    // Retornar SearchResult com a mesma estrutura da busca por equipamento
    return {
      id: index,
      equipment_name: equipmentData.localEquipment.equipment.hostname,
      equipment_location: equipmentData.localEquipment.equipment.location || '',
      backup_date: new Date().toISOString().split('T')[0],
      raw_config: '',
      vpn_id: connection.vpnId,
      loopback_ip: equipmentData.localEquipment.equipment.loopbackIp,
      neighbor_ip: connection.remoteIp,
      neighbor_hostname: connection.remoteEquipment,
      access_interface: connection.localInterface,
      encapsulation: connection.encapsulation,
      description: localInterface?.description || '',
      group_name: connection.remoteEquipment,
      customers: [finalCustomerName],
      highlights: [],
      vpws_groups: [{
        id: connection.vpnId,
        name: `VPN ${connection.vpnId}`,
        vpns: [{
          id: connection.vpnId,
          vpn_id: connection.vpnId,
          name: `VPN ${connection.vpnId}`
        }]
      }],
      customer_services: [{
        id: index,
        customer_name: finalCustomerName,
        service_type: 'VPN'
      }],
      // Informações detalhadas dos dois lados (mesma estrutura da busca por equipamento)
      side_a_info: {
        hostname: equipmentData.localEquipment.equipment.hostname,
        location: equipmentData.localEquipment.equipment.location || '',
        loopback_ip: equipmentData.localEquipment.equipment.loopbackIp,
        access_interface: connection.localInterface,
        interface_details: localInterface || {}
      },
      side_b_info: {
        hostname: connection.remoteEquipment,
        location: '',
        loopback_ip: connection.remoteIp,
        access_interface: connection.remoteInterface || 'N/A',
        interface_details: connection.remoteInterfaceFullData || {}
      },
      destination_info: {
        hostname: connection.remoteEquipment,
        ip: connection.remoteIp,
        isInDatabase: true,
        neighborIp: connection.remoteIp,
        vpwsGroup: null,
        localInterface: {
          name: connection.localInterface,
          details: {
            ...localInterface || {},
            // LAG members details (igual à busca por equipamento)
            physicalMembers: localInterface?.type === 'lag' && localInterface?.lagMemberDetails ? 
              localInterface.lagMemberDetails.map((member: any) => ({
                interface: member.name,
                speed: member.speed,
                description: member.description,
                customer: this.extractClientFromDescription(member.description) || 'N/A'
              })) : 
              undefined,
            membersSummary: localInterface?.type === 'lag' && localInterface?.lagMemberDetails ?
              `Membros: ${localInterface.lagMemberDetails.map((m: any) => 
                `${m.name}(${m.speed}): ${this.extractClientFromDescription(m.description) || 'N/A'}`
              ).join(', ')}` :
              undefined
          },
          capacity: localInterface?.speed || 'N/A',
          media: localInterface?.type === 'lag' ? 'lag' : 'physical',
          description: localInterface?.description || ''
        },
        remoteInterface: {
          name: connection.remoteInterface || 'N/A',
          details: {
            ...connection.remoteInterfaceFullData || {},
            // Remote LAG members details
            physicalMembers: connection.remoteInterfaceFullData?.type === 'lag' && connection.remoteInterfaceFullData?.lagMemberDetails ? 
              connection.remoteInterfaceFullData.lagMemberDetails.map((member: any) => ({
                interface: member.name,
                speed: member.speed,
                description: member.description,
                customer: this.extractClientFromDescription(member.description) || 'N/A'
              })) : 
              undefined,
            membersSummary: connection.remoteInterfaceFullData?.type === 'lag' && connection.remoteInterfaceFullData?.lagMemberDetails ?
              `Membros Remotos: ${connection.remoteInterfaceFullData.lagMemberDetails.map((m: any) => 
                `${m.name}(${m.speed}): ${this.extractClientFromDescription(m.description) || 'N/A'}`
              ).join(', ')}` :
              undefined
          },
          capacity: this.calculateTotalInterfaceCapacity(connection.remoteInterfaceFullData) || 'N/A',
          media: connection.remoteInterfaceFullData?.type === 'lag' ? 'lag' : 'physical',
          description: connection.remoteInterfaceDetails || 'Interface remota'
        }
      },
      // Campos adicionais para compatibilidade (mesma estrutura)
      interface_lag_members: localInterface?.lagMembers || [],
      interface_note: localInterface?.type === 'lag' && localInterface?.lagMemberDetails ?
        `LAG com ${localInterface.lagMemberDetails.length} membros: ${localInterface.lagMemberDetails.map((m: any) => 
          `${m.name}(${m.speed})`
        ).join(', ')}` : '',
      interface_description: localInterface?.description || '',
      interface_found_in_db: true,
      neighbor_interface_description: connection.remoteInterfaceDetails || 'Interface remota',
      neighbor_interface_found_in_db: connection.remoteInterface !== 'N/A',
      opposite_interface: connection.remoteInterface || 'N/A',
      vlan_id: connection.encapsulation?.split(':')[1]?.split(',')[0] || '',
      pw_type: connection.encapsulation?.startsWith('qinq:') ? 'qinq' : 'vlan',
      customer_name: finalCustomerName
    };
  }

  // Implementação legada mantida como fallback
  async searchByEquipmentLegacy(equipmentName: string): Promise<SearchResult[]> {
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
            
            
            // Detectar se a interface pertence a uma LAG pela descrição (suporta qualquer número de LAG)
            const lagMatch = description.match(/LAG(\d+)/i);
            if (lagMatch) {
              const lagId = parseInt(lagMatch[1]);
              const lagName = `lag-${lagId}`;
              
              
              if (!lagMembersMap[lagName]) {
                lagMembersMap[lagName] = {
                  name: lagName,
                  lagNumber: lagId,
                  members: [],
                  totalSpeed: 0,
                  description: description.replace(/-P\d+-LAG\d+/i, '').trim(), // Remover sufixo específico
                  clientName: null // Será extraído das interfaces membros
                };
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
              
              // Extrair nome do cliente da descrição da interface física (API)
              if (!lagMembersMap[lagName].clientName) {
                const clientName = this.extractClientFromDescription(description);
                
                if (clientName) {
                  lagMembersMap[lagName].clientName = clientName;
                }
              }
              
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
        
        // 3.6. Buscar descrições das interfaces físicas no banco de dados local
        for (const lagName of Object.keys(lagMembersMap)) {
          const lag = lagMembersMap[lagName];
          if (lag.members && lag.members.length > 0) {
            for (const member of lag.members) {
              try {
                // Buscar descrição da interface física no banco de dados local via search
                const searchQuery = `${equipmentName} ${member.name}`;
                const interfaceSearchResult = await this.request<any>('/search/', {
                  params: { 
                    q: searchQuery,
                    limit: 1
                  }
                });
                
                if (interfaceSearchResult && interfaceSearchResult.results && interfaceSearchResult.results.length > 0) {
                  // Procurar resultado que contenha a interface específica
                  const matchingResult = interfaceSearchResult.results.find((result: any) => 
                    result.raw_config && result.raw_config.includes(member.name) && 
                    result.equipment_name === equipmentName
                  );
                  
                  if (matchingResult) {
                    // Extrair descrição da interface do raw_config
                    const configLines = matchingResult.raw_config.split('\n');
                    let interfaceDescription = '';
                    
                    for (let i = 0; i < configLines.length; i++) {
                      const line = configLines[i].trim();
                      if (line === `interface ${member.name}` || line.startsWith(`interface ${member.name} `)) {
                        // Procurar pela linha description nas próximas linhas
                        for (let j = i + 1; j < configLines.length && j < i + 10; j++) {
                          const descLine = configLines[j].trim();
                          if (descLine.startsWith('description ')) {
                            interfaceDescription = descLine.replace('description ', '').trim();
                            break;
                          }
                          if (descLine.startsWith('interface ')) break; // Próxima interface
                        }
                        break;
                      }
                    }
                    
                    if (interfaceDescription) {
                      // Atualizar descrição do membro com dados do banco
                      member.dbDescription = interfaceDescription;
                      
                      // Tentar extrair cliente da descrição do banco de dados
                      if (!lag.clientName) {
                        const clientName = this.extractClientFromDescription(interfaceDescription);
                        if (clientName) {
                          lag.clientName = clientName;
                          console.log(`🎯 Cliente identificado via BD para ${lagName}: ${clientName} (interface: ${member.name})`);
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                // Fallback: tentar buscar via reports/equipment se search falhar
                try {
                  const equipmentReport = await this.request<any>('/reports/equipment/', {
                    params: { equipment: equipmentName }
                  });
                  
                  if (equipmentReport && equipmentReport.results) {
                    for (const result of equipmentReport.results) {
                      if (result.raw_config && result.raw_config.includes(`interface ${member.name}`)) {
                        const configLines = result.raw_config.split('\n');
                        let interfaceDescription = '';
                        
                        for (let i = 0; i < configLines.length; i++) {
                          const line = configLines[i].trim();
                          if (line === `interface ${member.name}` || line.startsWith(`interface ${member.name} `)) {
                            // Procurar pela linha description
                            for (let j = i + 1; j < configLines.length && j < i + 10; j++) {
                              const descLine = configLines[j].trim();
                              if (descLine.startsWith('description ')) {
                                interfaceDescription = descLine.replace('description ', '').trim();
                                break;
                              }
                              if (descLine.startsWith('interface ')) break;
                            }
                            break;
                          }
                        }
                        
                        if (interfaceDescription) {
                          member.dbDescription = interfaceDescription;
                          
                          if (!lag.clientName) {
                            const clientName = this.extractClientFromDescription(interfaceDescription);
                            if (clientName) {
                              lag.clientName = clientName;
                              console.log(`🎯 Cliente identificado via BD (fallback) para ${lagName}: ${clientName}`);
                            }
                          }
                          break;
                        }
                      }
                    }
                  }
                } catch (fallbackError) {
                  console.log(`⚠️ Erro no fallback para interface ${member.name}:`, fallbackError);
                }
              }
            }
          }
        }
        
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
            const lagInfo = lagMembersMap[interfaceName];
            
            if (lagInfo && lagInfo.clientName) {
              finalCustomers = [lagInfo.clientName];
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
          
          // NOVA ABORDAGEM: Usar método inteligente de extração
          for (const desc of allDescriptions) {
            if (!desc) continue;
            
            const clientName = this.extractClientFromDescription(desc);
            if (clientName) {
              finalCustomers = [clientName];
              break;
            }
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

  // Método auxiliar para extrair nome do cliente de descrições complexas
  private extractClientFromDescription(description: string): string | null {
    if (!description) return null;

    // Padrões de palavras genéricas que devem ser ignoradas
    const genericWords = [
      'ISP', 'BORDA', 'L2L', 'P1', 'P2', 'LAG', 'VL', 'VLAN', 
      'TRUNK', 'UPLINK', 'BACKUP', 'PRIMARY', 'SECONDARY',
      'FASE', 'ATIVACAO', 'TESTE', 'TEMP', 'TMP', 'NNI',
      'ORLATELECOM', 'R1', 'PHB', 'TSA', 'LAG02', 'VL16'
    ];

    // 1. Primeiro, tentar padrão CUSTOMER-
    const customerMatch = description.match(/CUSTOMER-(.+)/i);
    if (customerMatch) {
      const afterCustomer = customerMatch[1];
      
      // 2. Se termina com hífen, extrair até o hífen
      let clientPart = afterCustomer;
      if (afterCustomer.endsWith('-')) {
        clientPart = afterCustomer.slice(0, -1);
        
        // Se só tem o nome do cliente (sem hífens ou nome curto), retornar diretamente
        if (clientPart && (!clientPart.includes('-') || clientPart.length <= 10)) {
          return clientPart.toUpperCase();
        }
      }
      
      // 2.5. Se não termina com hífen, mas é uma palavra simples, tentar extrair diretamente
      if (!afterCustomer.endsWith('-') && !afterCustomer.includes('-') && afterCustomer.length >= 3) {
        return afterCustomer.toUpperCase();
      }
      
      // 3. Quebrar por hífens e analisar cada parte
      const parts = clientPart.split('-').filter(part => part.length > 0);
      
      // 4. Procurar a primeira parte que não seja uma palavra genérica
      for (const part of parts) {
        const cleanPart = part.trim().toUpperCase();
        
        // Pular palavras genéricas
        if (genericWords.includes(cleanPart)) {
          continue;
        }
        
        // Pular partes que são claramente técnicas (números, VLANs, etc.)
        if (/^(VL|VLAN|LAG|P)\d+$/i.test(cleanPart)) {
          continue;
        }
        
        // Aceitar partes com 3+ caracteres OU partes conhecidas menores
        const knownShortClients = ['MW', 'TI', 'NET'];
        if (cleanPart.length >= 3 || knownShortClients.includes(cleanPart)) {
          return cleanPart;
        }
      }
    }

    // 5. Fallback: tentar padrões conhecidos de clientes
    const knownPatterns = [
      /(TECNET|MEGALINK|VILARNET|NETPAC|HIITECH|JRNET|TECHFIBRA|CONNECT|DIGITALNET|ACCORD|HENRIQUE|MULTLINK|INFOWEB|ULTRANET)/gi
    ];

    for (const pattern of knownPatterns) {
      const match = description.match(pattern);
      if (match) {
        return match[0].toUpperCase();
      }
    }

    return null;
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

  /**
   * Calcula capacidade total de uma interface (LAG soma os membros, física retorna própria capacidade)
   */
  private calculateTotalInterfaceCapacity(interfaceData: any): string {
    if (!interfaceData) return 'N/A';

    // Se for LAG, somar capacidade dos membros
    if (interfaceData.type === 'lag' && interfaceData.lagMemberDetails && interfaceData.lagMemberDetails.length > 0) {
      let totalCapacity = 0;
      
      interfaceData.lagMemberDetails.forEach((member: any) => {
        const memberSpeed = member.speed || '0G';
        const match = memberSpeed.match(/(\d+)([GMK]?)/);
        if (match) {
          let value = parseInt(match[1]);
          const unit = match[2] || 'G';
          
          // Converter tudo para Gbps
          if (unit === 'M') value = value / 1000;
          else if (unit === 'K') value = value / 1000000;
          
          totalCapacity += value;
        }
      });
      
      if (totalCapacity >= 1) {
        return `${totalCapacity}G`;
      } else if (totalCapacity > 0) {
        return `${Math.round(totalCapacity * 1000)}M`;
      }
    }

    // Se for interface física, retornar velocidade própria
    return interfaceData.speed || 'N/A';
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

  /**
   * Parser para extrair dados estruturados do JSON de backup dos equipamentos MPLS
   * Implementa a lógica de correlação conforme especificado pelo usuário
   */
  async parseEquipmentBackupJson(jsonData: any, equipmentName?: string): Promise<{
    equipment: {
      hostname: string;
      loopbackIp: string;
      location?: string;
    };
    interfaces: Array<{
      name: string;
      type: 'physical' | 'lag';
      description: string;
      speed: string;
      isCustomerInterface: boolean;
      lagMembers?: string[];
      lagMemberDetails?: any[];
      chassisId?: number;
      slotId?: number;
      portId?: number;
    }>;
    vpns: Array<{
      vpnId: number;
      groupName: string;
      neighborIp: string;
      neighborHostname?: string;
      accessInterface: string;
      encapsulationType: 'qinq' | 'vlan';
      encapsulationVlans: string[];
      description?: string;
      pwId: number;
      pwType: string;
    }>;
  }> {
    console.log('🔍 MPLS SERVICE - Iniciando parse do JSON do equipamento');
    console.log('🔍 MPLS SERVICE - Estrutura do JSON recebido:', Object.keys(jsonData.data || {}));
    
    // 1. Extrair dados básicos do equipamento
    const hostname = jsonData.data?.['dmos-base:config']?.['dmos-sys-config:system']?.hostname || equipmentName || 'N/A';
    const equipment = {
      hostname,
      loopbackIp: this.extractLoopbackIp(jsonData),
      location: this.extractLocation(hostname)
    };

    console.log('📋 MPLS SERVICE - Dados do equipamento:', equipment);

    // 2. Extrair interfaces LAG
    const lagInterfaces = this.extractLagInterfaces(jsonData);
    console.log('🔗 MPLS SERVICE - LAGs encontradas:', lagInterfaces.length);

    // 3. Extrair interfaces físicas 
    const physicalInterfaces = this.extractPhysicalInterfaces(jsonData);
    console.log('🔌 MPLS SERVICE - Interfaces físicas encontradas:', physicalInterfaces.length);

    // 4. Extrair VPNs e suas correlações
    const vpns = this.extractVpns(jsonData);
    console.log('🌐 MPLS SERVICE - VPNs encontradas:', vpns.length);

    // 5. Combinar todas as interfaces
    const allInterfaces = [...lagInterfaces, ...physicalInterfaces];

    return {
      equipment,
      interfaces: allInterfaces,
      vpns
    };
  }

  /**
   * Extrai IP de loopback do equipamento
   */
  private extractLoopbackIp(jsonData: any): string {
    const loopbacks = jsonData.data?.['dmos-base:config']?.interface?.['dmos-ip-application:loopback'];
    if (loopbacks && loopbacks.length > 0) {
      const loopback0 = loopbacks.find((l: any) => l.id === '0');
      if (loopback0?.ipv4?.address?.[0]?.ip) {
        return loopback0.ipv4.address[0].ip.split('/')[0]; // Remove a máscara /32
      }
    }
    return 'N/A';
  }

  /**
   * Extrai localização baseada no hostname do equipamento (padrão: ESTADO-CIDADE-*)
   */
  private extractLocation(hostname: string): string {
    if (!hostname || hostname === 'N/A') return 'N/A';
    
    const parts = hostname.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}`; // Ex: MA-CANABRAVA de MA-CANABRAVA-PE01
    }
    
    return hostname;
  }

  /**
   * Extrai interfaces LAG (agregadas) do JSON
   */
  private extractLagInterfaces(jsonData: any): Array<{
    name: string;
    type: 'lag';
    description: string;
    speed: string;
    isCustomerInterface: boolean;
    lagMembers: string[];
    lagMemberDetails: any[];
  }> {
    const interfaces: Array<any> = [];
    // Verificar se é 'lacp:link-aggregation' ou 'dmos-lag:link-aggregation'
    const lagData = jsonData.data?.['lacp:link-aggregation']?.interface?.lag || 
                   jsonData.data?.['dmos-lag:link-aggregation']?.interface?.lag;
    
    if (!lagData || !Array.isArray(lagData)) {
      console.log('⚠️ MPLS SERVICE - Nenhuma LAG encontrada no JSON');
      return interfaces;
    }

    // Extrair interfaces físicas para buscar descrições dos membros
    const physicalInterfaces = this.extractPhysicalInterfacesMap(jsonData);

    lagData.forEach((lag: any) => {
      const lagId = lag['lag-id'];
      const members = lag['interface-config']?.map((ic: any) => ic['interface-name']) || [];
      
      // Buscar descrições das interfaces membros
      const memberDetails = members.map((memberName: string) => {
        const physInterface = physicalInterfaces[memberName];
        return {
          name: memberName,
          description: physInterface?.description || '',
          speed: physInterface?.speed || this.extractInterfaceCapacity(memberName),
          chassisId: physInterface?.chassisId,
          slotId: physInterface?.slotId,
          portId: physInterface?.portId
        };
      });

      // Usar descrição do primeiro membro como descrição da LAG (lógica de cliente)
      let lagDescription = lag.description || '';
      let clientDescription = '';
      
      // Se não tem descrição na LAG ou não é de cliente, buscar nas interfaces membros
      if (!lagDescription || !lagDescription.includes('CUSTOMER-')) {
        const customerMember = memberDetails.find((member: any) => 
          member.description && member.description.toUpperCase().startsWith('CUSTOMER-')
        );
        
        if (customerMember) {
          clientDescription = customerMember.description;
          // Extrair nome do cliente da descrição da interface física
          lagDescription = this.extractClientFromDescription(clientDescription) || clientDescription;
        }
      }

      // Verificar se é interface de cliente baseado nas descrições dos membros
      const isCustomerInterface = memberDetails.some((member: any) => 
        member.description && member.description.toUpperCase().startsWith('CUSTOMER-')
      ) || this.isCustomerLagDescription(lagDescription);
      
      // Calcular velocidade baseada nos membros
      const speed = this.calculateLagSpeedFromMembers(members, jsonData);

      interfaces.push({
        name: `lag-${lagId}`,
        type: 'lag' as const,
        description: lagDescription,
        speed,
        isCustomerInterface,
        lagMembers: members,
        lagMemberDetails: memberDetails
      });

      console.log(`🔗 LAG ${lagId}: ${lagDescription} (${speed}) - Cliente: ${isCustomerInterface}`);
      console.log(`   Membros: ${memberDetails.map((m: any) => `${m.name}(${m.speed})`).join(', ')}`);
      if (clientDescription && clientDescription !== lagDescription) {
        console.log(`   Descrição do cliente: ${clientDescription}`);
      }
    });

    return interfaces;
  }

  /**
   * Extrai interfaces físicas em formato de mapa para consulta rápida
   */
  private extractPhysicalInterfacesMap(jsonData: any): { [key: string]: any } {
    const interfaceMap: { [key: string]: any } = {};
    const interfaceData = jsonData.data?.['dmos-base:config']?.interface;

    if (!interfaceData) return interfaceMap;

    // Mapear gigabit-ethernet
    const gigInterfaces = interfaceData['dmos-interface-ethernet:gigabit-ethernet'] || [];
    gigInterfaces.forEach((intf: any) => {
      const name = `gigabit-ethernet-${intf['chassis-id']}/${intf['slot-id']}/${intf['port-id']}`;
      interfaceMap[name] = {
        description: intf.description || '',
        speed: intf.speed === '1G' ? '1G' : intf.speed || '1G',
        chassisId: intf['chassis-id'],
        slotId: intf['slot-id'],
        portId: intf['port-id']
      };
    });

    // Mapear ten-gigabit-ethernet
    const tenGigInterfaces = interfaceData['dmos-interface-ethernet:ten-gigabit-ethernet'] || [];
    tenGigInterfaces.forEach((intf: any) => {
      const name = `ten-gigabit-ethernet-${intf['chassis-id']}/${intf['slot-id']}/${intf['port-id']}`;
      interfaceMap[name] = {
        description: intf.description || '',
        speed: intf.speed === '10G' ? '10G' : '10G',
        chassisId: intf['chassis-id'],
        slotId: intf['slot-id'],
        portId: intf['port-id']
      };
    });

    // Mapear hundred-gigabit-ethernet
    const hundredGigInterfaces = interfaceData['dmos-interface-ethernet:hundred-gigabit-ethernet'] || [];
    hundredGigInterfaces.forEach((intf: any) => {
      const name = `hundred-gigabit-ethernet-${intf['chassis-id']}/${intf['slot-id']}/${intf['port-id']}`;
      interfaceMap[name] = {
        description: intf.description || '',
        speed: intf.speed === '100G' ? '100G' : '100G',
        chassisId: intf['chassis-id'],
        slotId: intf['slot-id'],
        portId: intf['port-id']
      };
    });

    return interfaceMap;
  }

  /**
   * Extrai interfaces físicas do JSON
   */
  private extractPhysicalInterfaces(jsonData: any): Array<{
    name: string;
    type: 'physical';
    description: string;
    speed: string;
    isCustomerInterface: boolean;
    chassisId: number;
    slotId: number;
    portId: number;
  }> {
    const interfaces: Array<any> = [];
    const interfaceData = jsonData.data?.['dmos-base:config']?.interface;

    if (!interfaceData) {
      console.log('⚠️ MPLS SERVICE - Nenhuma interface física encontrada no JSON');
      return interfaces;
    }

    // Extrair gigabit-ethernet
    const gigInterfaces = interfaceData['dmos-interface-ethernet:gigabit-ethernet'] || [];
    gigInterfaces.forEach((intf: any) => {
      const name = `gigabit-ethernet-${intf['chassis-id']}/${intf['slot-id']}/${intf['port-id']}`;
      const description = intf.description || '';
      const speed = intf.speed === '1G' ? '1G' : intf.speed || '1G';
      const isCustomerInterface = description.toUpperCase().startsWith('CUSTOMER-');

      interfaces.push({
        name,
        type: 'physical' as const,
        description,
        speed,
        isCustomerInterface,
        chassisId: intf['chassis-id'],
        slotId: intf['slot-id'],
        portId: intf['port-id']
      });

      if (isCustomerInterface) {
        console.log(`🔌 Interface Cliente: ${name} - ${description} (${speed})`);
      }
    });

    // Extrair ten-gigabit-ethernet
    const tenGigInterfaces = interfaceData['dmos-interface-ethernet:ten-gigabit-ethernet'] || [];
    tenGigInterfaces.forEach((intf: any) => {
      const name = `ten-gigabit-ethernet-${intf['chassis-id']}/${intf['slot-id']}/${intf['port-id']}`;
      const description = intf.description || '';
      const speed = intf.speed === '10G' ? '10G' : this.extractInterfaceCapacity(name);
      const isCustomerInterface = description.toUpperCase().startsWith('CUSTOMER-');

      interfaces.push({
        name,
        type: 'physical' as const,
        description,
        speed,
        isCustomerInterface,
        chassisId: intf['chassis-id'],
        slotId: intf['slot-id'],
        portId: intf['port-id']
      });

      if (isCustomerInterface) {
        console.log(`🔌 Interface Cliente: ${name} - ${description} (${speed})`);
      }
    });

    // Extrair hundred-gigabit-ethernet
    const hundredGigInterfaces = interfaceData['dmos-interface-ethernet:hundred-gigabit-ethernet'] || [];
    hundredGigInterfaces.forEach((intf: any) => {
      const name = `hundred-gigabit-ethernet-${intf['chassis-id']}/${intf['slot-id']}/${intf['port-id']}`;
      const description = intf.description || '';
      const speed = intf.speed === '100G' ? '100G' : this.extractInterfaceCapacity(name);
      const isCustomerInterface = description.toUpperCase().startsWith('CUSTOMER-');

      interfaces.push({
        name,
        type: 'physical' as const,
        description,
        speed,
        isCustomerInterface,
        chassisId: intf['chassis-id'],
        slotId: intf['slot-id'],
        portId: intf['port-id']
      });

      if (isCustomerInterface) {
        console.log(`🔌 Interface Cliente: ${name} - ${description} (${speed})`);
      }
    });

    return interfaces;
  }

  /**
   * Extrai todas as VPNs do JSON
   */
  private extractVpns(jsonData: any): Array<{
    vpnId: number;
    groupName: string;
    neighborIp: string;
    neighborHostname?: string;
    accessInterface: string;
    encapsulationType: 'qinq' | 'vlan';
    encapsulationVlans: string[];
    description?: string;
    pwId: number;
    pwType: string;
  }> {
    const vpns: Array<any> = [];
    const l2vpnConfig = jsonData.data?.['router-mpls:mpls']?.['l2-vpn:l2vpn-config']?.l2vpn;
    
    if (!l2vpnConfig?.['vpws-group']) {
      console.log('⚠️ MPLS SERVICE - Nenhuma VPN encontrada no JSON');
      return vpns;
    }

    l2vpnConfig['vpws-group'].forEach((group: any) => {
      const groupName = group['group-name'];
      console.log(`🌐 Processando grupo VPWS: ${groupName}`);

      if (group.vpn && Array.isArray(group.vpn)) {
        group.vpn.forEach((vpn: any) => {
          const vpnId = parseInt(vpn['vpn-name']);
          const description = vpn.description || '';
          
          // Extrair dados do neighbor
          const neighbor = vpn.neighbor?.[0];
          const neighborIp = neighbor?.['neighbor-ip'] || '';
          const pwId = neighbor?.['pw-id'] || 0;
          const pwType = neighbor?.['pw-type']?.type || 'vlan';
          
          // Extrair interface de acesso
          const accessInterface = vpn['access-interface']?.[0];
          const interfaceName = accessInterface?.['interface-name'] || '';
          
          // Determinar tipo de encapsulamento
          let encapsulationType: 'qinq' | 'vlan' = 'vlan';
          let encapsulationVlans: string[] = [];
          
          if (accessInterface?.['dmos-mpls-l2vpn-vpws:encapsulation']) {
            const encap = accessInterface['dmos-mpls-l2vpn-vpws:encapsulation'];
            
            // QinQ: múltiplas VLANs em array
            if (encap.dot1q && Array.isArray(encap.dot1q) && encap.dot1q.length > 1) {
              encapsulationType = 'qinq';
              encapsulationVlans = encap.dot1q.map((v: any) => v.toString());
            }
            // VLAN tradicional: single VLAN ou array com um elemento
            else if (encap.dot1q) {
              encapsulationType = 'vlan';
              encapsulationVlans = Array.isArray(encap.dot1q) ? 
                encap.dot1q.map((v: any) => v.toString()) : 
                [encap.dot1q.toString()];
            }
          }
          
          // Se não tem encapsulação específica, usar dot1q diretamente da interface
          if (encapsulationVlans.length === 0 && accessInterface?.dot1q) {
            encapsulationType = 'vlan';
            encapsulationVlans = [accessInterface.dot1q.toString()];
          }

          vpns.push({
            vpnId,
            groupName,
            neighborIp,
            neighborHostname: this.extractHostnameFromGroupName(groupName),
            accessInterface: interfaceName,
            encapsulationType,
            encapsulationVlans,
            description,
            pwId,
            pwType
          });

          console.log(`🔗 VPN ${vpnId}: ${interfaceName} -> ${neighborIp} (${groupName})`);
          console.log(`   Encapsulamento: ${encapsulationType} [${encapsulationVlans.join(', ')}]`);
        });
      }
    });

    return vpns;
  }

  /**
   * Verifica se uma LAG é para cliente baseada na descrição
   */
  private isCustomerLagDescription(description: string): boolean {
    if (!description) return false;
    
    // LAGs de clientes geralmente não são de outros PEs ou ISPs
    const networkKeywords = ['PE01', 'PE00', 'PE02', 'SANTANADOMARANHAO', 'PLACAS'];
    const uppercaseDesc = description.toUpperCase();
    
    // Se contém palavras de rede/backbone, não é cliente
    for (const keyword of networkKeywords) {
      if (uppercaseDesc.includes(keyword)) {
        return false;
      }
    }
    
    // Se contém ISP, pode ser cliente dependendo do contexto
    if (uppercaseDesc.includes('ISP-')) {
      return true; // ISPs terceiros são clientes
    }
    
    // Se contém palavras típicas de clientes
    const customerKeywords = ['MULTLINK', 'INFOWEB', 'ORLATELECOM'];
    for (const keyword of customerKeywords) {
      if (uppercaseDesc.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calcula velocidade de LAG baseada nos membros
   */
  private calculateLagSpeedFromMembers(members: string[], jsonData: any): string {
    if (!members || members.length === 0) return 'N/A';

    let totalSpeed = 0;
    const interfaceData = jsonData.data?.['dmos-base:config']?.interface;

    members.forEach((memberName: string) => {
      let memberSpeed = 0;

      // Buscar em ten-gigabit-ethernet
      const tenGigInterfaces = interfaceData?.['dmos-interface-ethernet:ten-gigabit-ethernet'] || [];
      const tenGigMember = tenGigInterfaces.find((intf: any) => {
        const name = `ten-gigabit-ethernet-${intf['chassis-id']}/${intf['slot-id']}/${intf['port-id']}`;
        return name === memberName;
      });
      
      if (tenGigMember) {
        memberSpeed = 10; // 10G
      }

      // Buscar em hundred-gigabit-ethernet
      const hundredGigInterfaces = interfaceData?.['dmos-interface-ethernet:hundred-gigabit-ethernet'] || [];
      const hundredGigMember = hundredGigInterfaces.find((intf: any) => {
        const name = `hundred-gigabit-ethernet-${intf['chassis-id']}/${intf['slot-id']}/${intf['port-id']}`;
        return name === memberName;
      });
      
      if (hundredGigMember) {
        memberSpeed = 100; // 100G
      }

      totalSpeed += memberSpeed;
    });

    return totalSpeed > 0 ? `${totalSpeed}G` : 'N/A';
  }

  /**
   * Extrai hostname do equipment remoto baseado no group-name
   */
  private extractHostnameFromGroupName(groupName: string): string {
    // Group name já é o hostname do equipamento remoto
    return groupName;
  }

  /**
   * Busca equipamento por nome e retorna dados estruturados
   */
  async searchEquipmentByName(equipmentName: string): Promise<{
    localEquipment: any;
    remoteConnections: Array<{
      vpnId: number;
      remoteEquipment: string;
      remoteIp: string;
      localInterface: string;
      remoteInterface?: string;
      encapsulation: string;
      customer?: string;
      remoteInterfaceDetails?: string;
      remoteCustomerName?: string;
      remoteInterfaceFullData?: any;
    }>;
  }> {
    try {
      console.log(`🔍 MPLS SERVICE - Buscando equipamento: ${equipmentName}`);

      // 1. Buscar JSON backup do equipamento
      const jsonBackup = await this.request<any>('/equipment/json-backup/', {
        params: { equipment: equipmentName }
      });

      if (!jsonBackup?.json_data) {
        console.log('❌ MPLS SERVICE - JSON backup não encontrado');
        console.log('📋 MPLS SERVICE - Resposta recebida:', jsonBackup);
        return { localEquipment: null, remoteConnections: [] };
      }

      // 2. Parse dos dados locais
      const parsedData = await this.parseEquipmentBackupJson(jsonBackup.json_data, equipmentName);
      console.log('✅ MPLS SERVICE - Dados locais parseados:', parsedData.equipment);

      // 3. Para cada VPN, buscar dados do equipamento remoto
      const remoteConnections = await Promise.all(
        parsedData.vpns.map(async (vpn) => {
          const remoteEquipmentName = vpn.neighborHostname || vpn.groupName;
          
          // Tentar buscar dados do equipamento remoto
          let remoteInterface = 'N/A';
          let customer = 'N/A';
          
          try {
            const remoteJsonBackup = await this.request<any>('/equipment/json-backup/', {
              params: { equipment: remoteEquipmentName }
            });
            
            if (remoteJsonBackup?.json_data) {
              const remoteParsedData = await this.parseEquipmentBackupJson(remoteJsonBackup.json_data, remoteEquipmentName);
              
              // Encontrar VPN correspondente no equipamento remoto
              const matchingVpn = remoteParsedData.vpns.find(v => 
                v.vpnId === vpn.vpnId && v.neighborIp === parsedData.equipment.loopbackIp
              );
              
              if (matchingVpn) {
                remoteInterface = matchingVpn.accessInterface;
              }
              
              // Tentar extrair cliente da interface local
              const localInterfaceData = parsedData.interfaces.find(i => 
                i.name === vpn.accessInterface
              );
              
              if (localInterfaceData) {
                // Se for LAG, usar descrição dos membros
                if (localInterfaceData.type === 'lag' && localInterfaceData.lagMemberDetails) {
                  const customerMember = localInterfaceData.lagMemberDetails.find((member: any) =>
                    member.description && member.description.toUpperCase().startsWith('CUSTOMER-')
                  );
                  if (customerMember) {
                    customer = this.extractClientFromDescription(customerMember.description) || 'N/A';
                  }
                } else if (localInterfaceData.description) {
                  customer = this.extractClientFromDescription(localInterfaceData.description) || 'N/A';
                }
              }
            }
          } catch (error) {
            console.log(`⚠️ MPLS SERVICE - Erro ao buscar equipamento remoto ${remoteEquipmentName}:`, error);
          }

          return {
            vpnId: vpn.vpnId,
            remoteEquipment: remoteEquipmentName,
            remoteIp: vpn.neighborIp,
            localInterface: vpn.accessInterface,
            remoteInterface,
            encapsulation: `${vpn.encapsulationType}:${vpn.encapsulationVlans.join(',')}`,
            customer
          };
        })
      );

      // 4. ENRIQUECER com informações das interfaces remotas
      const enrichedConnections = await Promise.all(
        remoteConnections.map(async (connection) => {
          let remoteInterfaceDetails = 'N/A';
          let remoteCustomerName = 'N/A';
          let remoteInterfaceFullData: any = null;

          if (connection.remoteInterface && connection.remoteInterface !== 'N/A') {
            try {
              // Buscar dados do equipamento remoto novamente para obter detalhes da interface
              const remoteJsonBackup = await this.request<any>('/equipment/json-backup/', {
                params: { equipment: connection.remoteEquipment }
              });
              
              if (remoteJsonBackup?.json_data) {
                const remoteParsedData = await this.parseEquipmentBackupJson(remoteJsonBackup.json_data, connection.remoteEquipment);
                
                const remoteInterfaceData = remoteParsedData.interfaces.find((i: any) => 
                  i.name === connection.remoteInterface
                );

                if (remoteInterfaceData) {
                  remoteInterfaceFullData = remoteInterfaceData;
                  
                  // Se for LAG remota, usar descrição dos membros
                  if (remoteInterfaceData.type === 'lag' && remoteInterfaceData.lagMemberDetails) {
                    const customerMember = remoteInterfaceData.lagMemberDetails.find((member: any) =>
                      member.description && member.description.toUpperCase().startsWith('CUSTOMER-')
                    );
                    if (customerMember) {
                      remoteCustomerName = this.extractClientFromDescription(customerMember.description) || 'N/A';
                      remoteInterfaceDetails = customerMember.description;
                    } else {
                      // Se não encontrou CUSTOMER-, usar o primeiro membro com descrição
                      const firstMemberWithDesc = remoteInterfaceData.lagMemberDetails.find((member: any) => member.description);
                      if (firstMemberWithDesc) {
                        remoteInterfaceDetails = firstMemberWithDesc.description;
                        remoteCustomerName = this.extractClientFromDescription(firstMemberWithDesc.description) || 'N/A';
                      }
                    }
                  } else if (remoteInterfaceData.description) {
                    remoteCustomerName = this.extractClientFromDescription(remoteInterfaceData.description) || 'N/A';
                    remoteInterfaceDetails = remoteInterfaceData.description;
                  }
                }
              }
            } catch (error) {
              console.log(`⚠️ MPLS SERVICE - Erro ao enriquecer interface remota ${connection.remoteInterface}:`, error);
            }
          }

          return {
            ...connection,
            remoteInterfaceDetails,
            remoteCustomerName,
            remoteInterfaceFullData
          };
        })
      );

      console.log('🎯 MPLS SERVICE - Conexões remotas identificadas:', enrichedConnections.length);

      return {
        localEquipment: parsedData,
        remoteConnections: enrichedConnections
      };

    } catch (error) {
      console.error('❌ MPLS SERVICE - Erro na busca por equipamento:', error);
      return { localEquipment: null, remoteConnections: [] };
    }
  }

  /**
   * Gera relatório ponta a ponta mostrando conexões entre dois equipamentos
   */
  async generatePointToPointReport(equipmentA: string, equipmentB?: string): Promise<{
    equipmentA: any;
    equipmentB?: any;
    connections: Array<{
      vpnId: number;
      sideA: {
        equipment: string;
        loopbackIp: string;
        interface: string;
        interfaceDetails: any;
        customer: string;
        encapsulation: string;
      };
      sideB: {
        equipment: string;
        loopbackIp: string;
        interface: string;
        interfaceDetails: any;
        customer: string;
        encapsulation: string;
      };
    }>;
    summary: {
      totalVpns: number;
      uniqueCustomers: string[];
      totalBandwidth: string;
    };
  }> {
    try {
      console.log(`🔍 MPLS SERVICE - Gerando relatório ponta a ponta: ${equipmentA} ${equipmentB ? `<-> ${equipmentB}` : ''}`);

      // 1. Buscar dados do equipamento A
      const dataA = await this.searchEquipmentByName(equipmentA);
      
      if (!dataA.localEquipment) {
        throw new Error(`Equipamento ${equipmentA} não encontrado`);
      }

      let dataB: any = null;
      let connections: any[] = [];

      if (equipmentB) {
        // 2. Buscar dados do equipamento B  
        dataB = await this.searchEquipmentByName(equipmentB);
        
        if (!dataB.localEquipment) {
          throw new Error(`Equipamento ${equipmentB} não encontrado`);
        }

        // 3. Encontrar conexões entre A e B
        const connectionsAtoB = dataA.remoteConnections.filter(conn => 
          conn.remoteEquipment === equipmentB
        );

        const connectionsBtoA = dataB.remoteConnections.filter((conn: any) => 
          conn.remoteEquipment === equipmentA
        );

        // 4. Correlacionar VPNs bidirecionais
        connections = connectionsAtoB.map(connA => {
          const connB = connectionsBtoA.find((cb: any) => cb.vpnId === connA.vpnId);
          
          // Encontrar interfaces locais
          const interfaceA = dataA.localEquipment.interfaces.find((intf: any) => 
            intf.name === connA.localInterface
          );
          const interfaceB = dataB?.localEquipment?.interfaces.find((intf: any) => 
            intf.name === connB?.localInterface
          );

          // Extrair clientes
          const customerA = this.extractClientFromDescription(interfaceA?.description || '') || 'N/A';
          const customerB = this.extractClientFromDescription(interfaceB?.description || '') || 'N/A';

          return {
            vpnId: connA.vpnId,
            sideA: {
              equipment: equipmentA,
              loopbackIp: dataA.localEquipment.equipment.loopbackIp,
              interface: connA.localInterface,
              interfaceDetails: interfaceA || {},
              customer: customerA,
              encapsulation: connA.encapsulation
            },
            sideB: {
              equipment: equipmentB,
              loopbackIp: dataB.localEquipment.equipment.loopbackIp,
              interface: connB?.localInterface || 'N/A',
              interfaceDetails: interfaceB || {},
              customer: customerB,
              encapsulation: connB?.encapsulation || 'N/A'
            }
          };
        });
      } else {
        // 3. Se não especificou equipamento B, mostrar todas as conexões do A
        connections = dataA.remoteConnections.map(conn => {
          const interfaceA = dataA.localEquipment.interfaces.find((intf: any) => 
            intf.name === conn.localInterface
          );

          const customerA = this.extractClientFromDescription(interfaceA?.description || '') || 'N/A';

          return {
            vpnId: conn.vpnId,
            sideA: {
              equipment: equipmentA,
              loopbackIp: dataA.localEquipment.equipment.loopbackIp,
              interface: conn.localInterface,
              interfaceDetails: interfaceA || {},
              customer: customerA,
              encapsulation: conn.encapsulation
            },
            sideB: {
              equipment: conn.remoteEquipment,
              loopbackIp: conn.remoteIp,
              interface: conn.remoteInterface || 'N/A',
              interfaceDetails: {},
              customer: 'N/A',
              encapsulation: conn.encapsulation
            }
          };
        });
      }

      // 5. Gerar resumo
      const uniqueCustomers = Array.from(new Set([
        ...connections.map(c => c.sideA.customer),
        ...connections.map(c => c.sideB.customer)
      ])).filter(c => c !== 'N/A');

      // Calcular bandwidth total (aproximação baseada nas interfaces)
      let totalBandwidthGbps = 0;
      connections.forEach(conn => {
        if (conn.sideA.interfaceDetails.speed) {
          const speedMatch = conn.sideA.interfaceDetails.speed.match(/(\d+)G/);
          if (speedMatch) {
            totalBandwidthGbps += parseInt(speedMatch[1]);
          }
        }
      });

      const summary = {
        totalVpns: connections.length,
        uniqueCustomers,
        totalBandwidth: totalBandwidthGbps > 0 ? `${totalBandwidthGbps}G` : 'N/A'
      };

      console.log('🎯 MPLS SERVICE - Relatório gerado:', {
        equipmentA,
        equipmentB,
        connectionsFound: connections.length,
        uniqueCustomers: uniqueCustomers.length
      });

      return {
        equipmentA: dataA.localEquipment,
        equipmentB: dataB?.localEquipment,
        connections,
        summary
      };

    } catch (error) {
      console.error('❌ MPLS SERVICE - Erro ao gerar relatório ponta a ponta:', error);
      throw error;
    }
  }

  /**
   * Função de teste para validar o parser com dados simulados
   */
  async testEquipmentParser(equipmentName: string = 'MA-CANABRAVA-PE01'): Promise<void> {
    console.log('🧪 MPLS SERVICE - Testando parser de equipamento:', equipmentName);
    
    try {
      const result = await this.searchEquipmentByName(equipmentName);
      
      console.log('✅ TESTE - Resultado do parser:');
      console.log('📋 Equipamento:', result.localEquipment?.equipment);
      console.log('🔗 Interfaces encontradas:', result.localEquipment?.interfaces.length);
      console.log('🌐 VPNs encontradas:', result.localEquipment?.vpns.length);
      console.log('🔄 Conexões remotas:', result.remoteConnections.length);
      
      // Mostrar interfaces de cliente
      const customerInterfaces = result.localEquipment?.interfaces.filter((i: any) => i.isCustomerInterface);
      console.log('👥 Interfaces de clientes:', customerInterfaces?.length);
      customerInterfaces?.forEach((intf: any) => {
        console.log(`   - ${intf.name}: ${intf.description} (${intf.speed})`);
      });

    } catch (error) {
      console.error('❌ TESTE - Erro no parser:', error);
    }
  }

  /**
   * Função de teste para validar extração de nomes de clientes
   */
  testClientExtraction(): void {
    console.log('🧪 MPLS SERVICE - Testando extração de clientes');
    
    const testCases = [
      'CUSTOMER-TECNET-',
      'CUSTOMER-TECNET-L2L-VL100',
      'CUSTOMER-MULTLINKTUTOIA-P1-LAG10',
      'CUSTOMER-MEGALINK-NNI-VL16',
      'CUSTOMER-ISP-ULTRANET-L2L-VL209-210',
      'CUSTOMER-INFOWEB-ORLATELECOM-L2L-P1-LAG11',
      'CUSTOMER-MW-SOLUTIONS-P1',
      'CUSTOMER-NET-',
      'CUSTOMER-TI-SYSTEM-'
    ];

    testCases.forEach(testCase => {
      const result = this.extractClientFromDescription(testCase);
      console.log(`📝 "${testCase}" → "${result}"`);
    });
  }
}

const mplsService = new MplsService();
export { mplsService };
export default mplsService;
