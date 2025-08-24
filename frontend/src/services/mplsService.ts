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

      // Função auxiliar para detectar forma de paginação e consolidar resultados
      const collectAllResults = async (): Promise<{ items: any[]; total: number; meta: any }> => {
        // Primeira tentativa: enviar vários parâmetros de paginação comuns
        const baseParams: any = {
          q: query,
          page: 1,
          page_size: 1000,
          limit: 1000,
          size: 1000,
          per_page: 1000,
          all: true,
        };

        const first = await this.request<any>('/search/', { params: baseParams });
        let items: any[] = Array.isArray(first) ? first : (first.results || first.data?.results || first.items || []);
        const totalFromResponse: number = first.total ?? first.count ?? first.data?.count ?? first.results_count ?? items.length ?? 0;
        let nextUrl: string | null = first.next ?? first.data?.next ?? null;

        // Caso haja paginação por "next" (padrão DRF), seguir links
        let safety = 0;
        while (nextUrl && safety < 50) {
          try {
            const nextResp = await api({ url: nextUrl, method: 'GET' });
            const nextData = nextResp.data;
            const nextItems = nextData.results || [];
            items = items.concat(nextItems);
            nextUrl = nextData.next || null;
            safety += 1;
          } catch (e) {
            console.warn('⚠️ MPLS SERVICE - Falha ao seguir paginação via next:', e);
            break;
          }
        }

        // Se ainda houver chance de mais páginas, tentar paginação por page até esgotar
        if (items.length <= totalFromResponse) {
          let page = 2;
          while (page <= 50) {
            const resp = await this.request<any>('/search/', {
              params: { ...baseParams, page, page_size: 1000 }
            });
            const pageItems = resp.results || resp.data?.results || resp.items || [];
            if (!pageItems.length) break;
            items = items.concat(pageItems);
            page += 1;
          }
        }

        // Como último fallback tentar offset/limit até esgotar
        if (items.length <= totalFromResponse) {
          let offset = items.length;
          const step = 200;
          let guard = 0;
          while (guard < 50) {
            const resp = await this.request<any>('/search/', {
              params: { q: query, limit: step, offset }
            });
            const pageItems = resp.results || resp.data?.results || resp.items || [];
            if (!pageItems.length) break;
            items = items.concat(pageItems);
            offset += pageItems.length;
            guard += 1;
          }
        }

        const finalTotal = Math.max(totalFromResponse || 0, items.length);
        return { items, total: finalTotal, meta: first };
      };

      const { items, total, meta } = await collectAllResults();

      console.log('🔥 MPLS SERVICE - Search API response (consolidado):', { total, received: items.length });
      console.log('📊 MPLS SERVICE - Search stats:', {
        resultsCount: items.length || 0,
        total: total,
        query: meta.query || query
      });

      // Mapear os dados da API para o formato esperado pelo frontend
      const mappedResults = items.map((item, index) => ({
        id: index,
        equipment_name: item.equipment_name || '',
        equipment_location: item.location || item.equipment_location || '',
        backup_date: item.last_backup || item.backup_date || '',
        raw_config: '',
        // Dados detalhados do equipamento/VPN
        vpn_id: item.vpn_id,
        loopback_ip: item.loopback_ip,
        neighbor_ip: item.neighbor_ip,
        neighbor_hostname: item.neighbor_hostname,
        access_interface: item.access_interface,
        encapsulation: item.encapsulation,
        description: item.description,
        group_name: item.group_name,
        customers: item.customers || [],
        highlights: item.highlights || [],
        vpws_groups: item.vpn_id ? [{
          id: item.vpn_id || index,
          name: `VPN ${item.vpn_id || 'N/A'}`,
          vpns: [{
            id: item.vpn_id || index,
            vpn_id: item.vpn_id || 0,
            name: item.description || `VPN ${item.vpn_id || 'N/A'}`
          }]
        }] : [],
        customer_services: item.customers && item.customers.length > 0 ? [{
          id: index,
          customer_name: item.customers[0],
          service_type: 'VPN'
        }] : []
      }));
      
      // Adicionar metadados aos resultados para o frontend
      // Garantir que total corresponda ao que foi realmente reunido
      (mappedResults as any).total = mappedResults.length;
      (mappedResults as any).query = meta.query || query;
      
      return mappedResults;
    } catch (error) {
      console.error('Erro na busca MPLS:', error);
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
}

const mplsService = new MplsService();
export { mplsService };
export default mplsService;
