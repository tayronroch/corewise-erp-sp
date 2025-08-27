import { api } from './api';

export interface OptimizedCustomerResult {
  id: number;
  name: string;
  total_occurrences: number;
  equipment_count: number;
  vpn_count: number;
  interface_count: number;
  equipments: string[];
  vpn_ids: number[];
}

export interface OptimizedSearchResponse {
  query: string;
  results: OptimizedCustomerResult[];
  total_found: number;
}

export interface CustomerDetails {
  id: number;
  name: string;
  equipment_details: Array<{
    equipment_name: string;
    interfaces: Array<{
      interface_name: string;
      description: string;
      vpn_id?: number;
    }>;
  }>;
}

export interface CustomerConfiguration {
  id: number;
  customer_name: string;
  vpn_configurations: Array<{
    vpn_id: number;
    rd: string;
    rt_import: string[];
    rt_export: string[];
    interfaces: Array<{
      equipment: string;
      interface: string;
      encapsulation: string;
      description: string;
    }>;
  }>;
}

export class CustomerSearchManager {
  private static instance: CustomerSearchManager;
  private searchCache = new Map<string, OptimizedSearchResponse>();
  private detailsCache = new Map<number, CustomerDetails>();
  private configCache = new Map<number, CustomerConfiguration>();
  private abortController: AbortController | null = null;

  private constructor() {}

  static getInstance(): CustomerSearchManager {
    if (!CustomerSearchManager.instance) {
      CustomerSearchManager.instance = new CustomerSearchManager();
    }
    return CustomerSearchManager.instance;
  }

  /**
   * Busca otimizada por nome de cliente
   */
  async searchCustomers(query: string, limit: number = 50): Promise<OptimizedSearchResponse> {
    // Validações básicas
    if (query.length < 2) {
      return { query, results: [], total_found: 0 };
    }

    const cacheKey = `${query.toLowerCase()}_${limit}`;
    
    // Verificar cache primeiro
    if (this.searchCache.has(cacheKey)) {
      console.log('🚀 Resultado da busca otimizada vindo do cache');
      return this.searchCache.get(cacheKey)!;
    }

    // Cancelar busca anterior se estiver rodando
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();

    try {
      console.log(`🔍 Iniciando busca otimizada por: "${query}"`);
      console.time('Busca Otimizada');

      const response = await api.get('/api/mpls/search/customers/', {
        params: { q: query, limit },
        signal: this.abortController.signal,
      });

      console.timeEnd('Busca Otimizada');
      console.log(`✅ Busca otimizada concluída: ${response.data.total_found} resultados`);

      const result: OptimizedSearchResponse = response.data;
      
      // Armazenar no cache por 5 minutos
      this.searchCache.set(cacheKey, result);
      setTimeout(() => this.searchCache.delete(cacheKey), 5 * 60 * 1000);

      return result;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('🔄 Busca otimizada cancelada');
        throw error;
      }

      console.error('❌ Erro na busca otimizada:', error);
      
      // Se for erro 404 ou 500, talvez o endpoint não esteja disponível
      if (error.response?.status === 404 || error.response?.status === 500) {
        throw new Error('FALLBACK_NEEDED');
      }
      
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Buscar detalhes completos de um cliente
   */
  async getCustomerDetails(customerId: number): Promise<CustomerDetails> {
    if (this.detailsCache.has(customerId)) {
      console.log('🚀 Detalhes do cliente vindo do cache');
      return this.detailsCache.get(customerId)!;
    }

    try {
      console.log(`📋 Buscando detalhes do cliente ${customerId}`);
      
      const response = await api.get(`/api/mpls/customers/${customerId}/`);
      const details: CustomerDetails = response.data;

      // Cache por 10 minutos
      this.detailsCache.set(customerId, details);
      setTimeout(() => this.detailsCache.delete(customerId), 10 * 60 * 1000);

      return details;

    } catch (error) {
      console.error(`❌ Erro ao buscar detalhes do cliente ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Buscar configurações MPLS de um cliente
   */
  async getCustomerConfigurations(customerId: number): Promise<CustomerConfiguration> {
    if (this.configCache.has(customerId)) {
      console.log('🚀 Configurações do cliente vindo do cache');
      return this.configCache.get(customerId)!;
    }

    try {
      console.log(`⚙️ Buscando configurações MPLS do cliente ${customerId}`);
      
      const response = await api.get(`/api/mpls/customers/${customerId}/configurations/`);
      const config: CustomerConfiguration = response.data;

      // Cache por 15 minutos
      this.configCache.set(customerId, config);
      setTimeout(() => this.configCache.delete(customerId), 15 * 60 * 1000);

      return config;

    } catch (error) {
      console.error(`❌ Erro ao buscar configurações do cliente ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Buscar clientes por VPN ID
   */
  async searchCustomersByVPN(vpnId: number): Promise<OptimizedSearchResponse> {
    const cacheKey = `vpn_${vpnId}`;
    
    if (this.searchCache.has(cacheKey)) {
      console.log('🚀 Busca por VPN vindo do cache');
      return this.searchCache.get(cacheKey)!;
    }

    try {
      console.log(`🔍 Buscando clientes da VPN ${vpnId}`);
      
      const response = await api.get(`/api/mpls/search/customers/vpn/${vpnId}/`);
      const result: OptimizedSearchResponse = response.data;

      // Cache por 10 minutos
      this.searchCache.set(cacheKey, result);
      setTimeout(() => this.searchCache.delete(cacheKey), 10 * 60 * 1000);

      return result;

    } catch (error) {
      console.error(`❌ Erro ao buscar clientes da VPN ${vpnId}:`, error);
      throw error;
    }
  }

  /**
   * Cancelar busca em andamento
   */
  cancelCurrentSearch(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Limpar todos os caches
   */
  clearAllCaches(): void {
    this.searchCache.clear();
    this.detailsCache.clear();
    this.configCache.clear();
    console.log('🧹 Cache da busca otimizada limpo');
  }

  /**
   * Estatísticas do cache
   */
  getCacheStats(): object {
    return {
      searchCacheSize: this.searchCache.size,
      detailsCacheSize: this.detailsCache.size,
      configCacheSize: this.configCache.size,
    };
  }
}

// Exportar instância singleton
export const customerSearchManager = CustomerSearchManager.getInstance();