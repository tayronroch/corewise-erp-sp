/**
 * Serviço para funcionalidades MPLS - CoreWise
 * Busca, relatórios e análise de equipamentos MPLS
 */

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
      // Usar a API de busca que está funcionando (api_search do sistema original)
      const response = await this.request<{
        results: any[];
        total: number;
        query: string;
      }>('/search/', {
        params: { q: query }
      });
      
      // Mapear os dados da API para o formato esperado pelo frontend
      const mappedResults = response.results.map((item, index) => ({
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
      (mappedResults as any).total = response.total;
      (mappedResults as any).query = response.query;
      
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
      
      // Verificar se a resposta tem a estrutura esperada
      if (response && response.equipment_groups) {
        // Mapear a estrutura real da API para o formato esperado pelo frontend
        const groups = response.equipment_groups.map((group: any) => ({
          location: group.location || 'Localização não especificada',
          equipments: [{
            name: group.equipment_name,
            last_backup: group.services?.[0]?.last_backup || '',
            interfaces: group.services?.map((service: any) => ({
              name: service.access_interface || 'Interface não especificada',
              description: service.interface_details?.description || '',
              bandwidth: service.bandwidth || '',
              vlan: service.encapsulation || '',
              ip_address: service.neighbor_ip || '',
              status: 'active'
            })) || []
          }]
        }));
        
        return {
          customer_name: response.customer || customerName,
          total_locations: response.summary?.locations?.length || 0,
          total_equipments: response.summary?.total_equipment || response.equipment_groups?.length || 0,
          total_interfaces: response.equipment_groups?.reduce((total: number, group: any) => 
            total + (group.services?.length || 0), 0) || 0,
          total_services: response.summary?.total_services || 0,
          groups: groups
        };
      }
      
      // Se não tiver a estrutura esperada, criar uma estrutura padrão
      return {
        customer_name: customerName,
        total_locations: response?.summary?.locations?.length || 0,
        total_equipments: response?.summary?.total_equipment || 0,
        total_interfaces: 0,
        total_services: response?.summary?.total_services || 0,
        groups: []
      };
    } catch (error) {
      console.error('Erro ao buscar relatório do cliente:', error);
      // Retornar estrutura vazia em caso de erro
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