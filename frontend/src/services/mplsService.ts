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
    sideBInterface?: {
      name: string;
      details: any;
      capacity: string;
      media: string;
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
  async intelligentSearch(query: string, searchType: string = 'auto'): Promise<SearchResult[]> {
    try {
      console.log('🚀 MPLS SERVICE - Intelligent search chamada:', { query, searchType });

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
            media: vpn.side_b?.access_interface_details?.media || vpn.side_a?.access_interface_details?.media || 'physical'
          }
        };
        
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
            customers: [query], // Usar o nome do cliente da busca
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
            customer_services: [{
              id: index,
              customer_name: query,
              service_type: 'VPN'
            }],
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

  private extractInterfaceCapacity(interfaceName: string): string {
    if (!interfaceName) return 'N/A';

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

    // Tentar extrair capacidade numérica se disponível
    const numericMatch = interfaceName.match(/(\d+)(?:G|M|K)?$/i);
    if (numericMatch && numericMatch[1]) {
      const capacity = parseInt(numericMatch[1]);
      if (capacity >= 100) {
        return `${capacity}G`;
      } else if (capacity >= 1) {
        return `${capacity}G`;
      }
    }

    // Fallback para interfaces comuns
    if (interfaceName.includes('100G') || interfaceName.includes('100g')) return '100G';
    if (interfaceName.includes('25G') || interfaceName.includes('25g')) return '25G';
    if (interfaceName.includes('10G') || interfaceName.includes('10g')) return '10G';
    if (interfaceName.includes('1G') || interfaceName.includes('1g')) return '1G';

    return 'N/A';
  }
}

const mplsService = new MplsService();
export { mplsService };
export default mplsService;
