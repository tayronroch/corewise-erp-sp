// Serviço para integração com API do Zabbix

export interface ZabbixConfig {
  url: string;
  username: string;
  password: string;
  apiVersion?: string;
}

export interface ZabbixHostData {
  hostid: string;
  host: string;
  name: string;
  status: number;
  available: number;
  error?: string;
  interfaces: ZabbixInterface[];
  groups: ZabbixGroup[];
  items?: ZabbixItem[];
}

export interface ZabbixInterface {
  interfaceid: string;
  ip: string;
  dns: string;
  port: string;
  type: number;
  main: number;
}

export interface ZabbixGroup {
  groupid: string;
  name: string;
}

export interface ZabbixItem {
  itemid: string;
  name: string;
  key_: string;
  value_type: number;
  units: string;
  lastvalue?: string;
  lastclock?: number;
  status: number;
}

export interface ZabbixMetric {
  itemid: string;
  name: string;
  value: string;
  timestamp: number;
  units: string;
}

export interface ZabbixHistory {
  itemid: string;
  clock: number;
  value: string;
  ns: number;
}

class ZabbixService {
  private config: ZabbixConfig | null = null;
  private authToken: string | null = null;
  private requestId = 1;

  constructor() {
    // Tentar carregar configuração do localStorage
    this.loadConfig();
  }

  // Configurar conexão com Zabbix
  configure(config: ZabbixConfig): void {
    this.config = config;
    this.authToken = null;
    this.saveConfig();
  }

  // Salvar configuração no localStorage
  private saveConfig(): void {
    if (this.config) {
      localStorage.setItem('zabbix_config', JSON.stringify({
        url: this.config.url,
        username: this.config.username,
        // Não salvar a senha por segurança
        apiVersion: this.config.apiVersion,
      }));
    }
  }

  // Carregar configuração do localStorage
  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('zabbix_config');
      if (saved) {
        const config = JSON.parse(saved);
        this.config = {
          ...config,
          password: '', // Senha deve ser fornecida novamente
        };
      }
    } catch (error) {
      console.error('Erro ao carregar configuração do Zabbix:', error);
    }
  }

  // Fazer requisição para API do Zabbix
  private async makeRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.config) {
      throw new Error('Zabbix não configurado');
    }

    const requestData = {
      jsonrpc: '2.0',
      method,
      params,
      auth: this.authToken,
      id: this.requestId++,
    };

    try {
      const response = await fetch(`${this.config.url}/api_jsonrpc.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Zabbix API Error: ${data.error.message} (${data.error.code})`);
      }

      return data.result;
    } catch (error) {
      console.error('Erro na requisição Zabbix:', error);
      throw error;
    }
  }

  // Autenticar no Zabbix
  async authenticate(username?: string, password?: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('Zabbix não configurado');
    }

    const user = username || this.config.username;
    const pass = password || this.config.password;

    try {
      const result = await this.makeRequest('user.login', {
        user,
        password: pass,
      });

      this.authToken = result as string;
      return true;
    } catch (error) {
      console.error('Erro na autenticação Zabbix:', error);
      this.authToken = null;
      return false;
    }
  }

  // Verificar se está autenticado
  isAuthenticated(): boolean {
    return this.authToken !== null;
  }

  // Buscar hosts
  async getHosts(search?: string): Promise<ZabbixHostData[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Zabbix');
    }

    const params: Record<string, unknown> = {
      output: ['hostid', 'host', 'name', 'status', 'available', 'error'],
      selectInterfaces: ['interfaceid', 'ip', 'dns', 'port', 'type', 'main'],
      selectGroups: ['groupid', 'name'],
    };

    if (search) {
      params.search = { name: search };
      params.searchWildcardsEnabled = true;
    }

    try {
      const hosts = await this.makeRequest('host.get', params) as ZabbixHostData[];
      return hosts;
    } catch (error) {
      console.error('Erro ao buscar hosts:', error);
      throw error;
    }
  }

  // Buscar host específico por IP
  async getHostByIP(ip: string): Promise<ZabbixHostData | null> {
    try {
      const hosts = await this.makeRequest('host.get', {
        output: ['hostid', 'host', 'name', 'status', 'available', 'error'],
        selectInterfaces: ['interfaceid', 'ip', 'dns', 'port', 'type', 'main'],
        selectGroups: ['groupid', 'name'],
        filter: {
          'interfaces.ip': ip,
        },
      }) as ZabbixHostData[];

      return hosts.length > 0 ? hosts[0] : null;
    } catch (error) {
      console.error('Erro ao buscar host por IP:', error);
      return null;
    }
  }

  // Buscar itens de um host
  async getHostItems(hostId: string): Promise<ZabbixItem[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Zabbix');
    }

    try {
      const items = await this.makeRequest('item.get', {
        output: ['itemid', 'name', 'key_', 'value_type', 'units', 'lastvalue', 'lastclock', 'status'],
        hostids: hostId,
        monitored: true,
        limit: 50,
      }) as ZabbixItem[];

      return items;
    } catch (error) {
      console.error('Erro ao buscar itens do host:', error);
      throw error;
    }
  }

  // Buscar métricas principais de um host
  async getHostMetrics(hostId: string): Promise<ZabbixMetric[]> {
    const items = await this.getHostItems(hostId);
    
    // Filtrar apenas itens importantes
    const importantKeys = [
      'system.cpu.util',
      'vm.memory.util',
      'net.if.in',
      'net.if.out',
      'icmpping',
      'system.uptime',
    ];

    const metrics: ZabbixMetric[] = [];

    for (const item of items) {
      const isImportant = importantKeys.some(key => item.key_.includes(key));
      if (isImportant && item.lastvalue !== undefined && item.lastclock !== undefined) {
        metrics.push({
          itemid: item.itemid,
          name: item.name,
          value: item.lastvalue,
          timestamp: item.lastclock * 1000, // Converter para milliseconds
          units: item.units,
        });
      }
    }

    return metrics;
  }

  // Buscar histórico de um item
  async getItemHistory(itemId: string, timeFrom: number, timeTill?: number): Promise<ZabbixHistory[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Zabbix');
    }

    const params: Record<string, unknown> = {
      output: 'extend',
      itemids: itemId,
      time_from: timeFrom,
      sortfield: 'clock',
      sortorder: 'DESC',
      limit: 100,
    };

    if (timeTill) {
      params.time_till = timeTill;
    }

    try {
      const history = await this.makeRequest('history.get', params) as ZabbixHistory[];
      return history;
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      throw error;
    }
  }

  // Verificar conectividade com host
  async pingHost(hostId: string): Promise<boolean> {
    try {
      const items = await this.makeRequest('item.get', {
        output: ['itemid', 'lastvalue'],
        hostids: hostId,
        search: { key_: 'icmpping' },
        monitored: true,
      }) as ZabbixItem[];

      if (items.length > 0 && items[0].lastvalue) {
        return items[0].lastvalue === '1';
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar ping:', error);
      return false;
    }
  }

  // Obter status resumido de um host
  async getHostStatus(hostId: string): Promise<{
    available: boolean;
    cpu?: number;
    memory?: number;
    uptime?: number;
    lastUpdate: Date;
  }> {
    try {
      const [host, metrics] = await Promise.all([
        this.makeRequest('host.get', {
          output: ['hostid', 'available'],
          hostids: hostId,
        }) as Promise<ZabbixHostData[]>,
        this.getHostMetrics(hostId),
      ]);

      const hostData = host[0];
      const status = {
        available: hostData.available === 1,
        lastUpdate: new Date(),
        cpu: undefined as number | undefined,
        memory: undefined as number | undefined,
        uptime: undefined as number | undefined,
      };

      // Extrair métricas específicas
      for (const metric of metrics) {
        if (metric.name.toLowerCase().includes('cpu')) {
          status.cpu = parseFloat(metric.value);
        } else if (metric.name.toLowerCase().includes('memory')) {
          status.memory = parseFloat(metric.value);
        } else if (metric.name.toLowerCase().includes('uptime')) {
          status.uptime = parseFloat(metric.value);
        }
      }

      return status;
    } catch (error) {
      console.error('Erro ao obter status do host:', error);
      return {
        available: false,
        lastUpdate: new Date(),
      };
    }
  }

  // Logout do Zabbix
  async logout(): Promise<void> {
    if (this.authToken) {
      try {
        await this.makeRequest('user.logout', {});
      } catch (error) {
        console.error('Erro no logout:', error);
      } finally {
        this.authToken = null;
      }
    }
  }

  // Buscar triggers (alertas) de um host
  async getHostTriggers(hostId: string, onlyProblems = true): Promise<any[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Não autenticado no Zabbix');
    }

    const params: Record<string, unknown> = {
      output: ['triggerid', 'description', 'priority', 'status', 'value'],
      hostids: hostId,
      monitored: true,
      active: true,
    };

    if (onlyProblems) {
      params.only_true = true; // Apenas triggers ativadas (problemas)
      params.min_severity = 2; // Apenas severidade Warning ou superior
    }

    try {
      const triggers = await this.makeRequest('trigger.get', params) as any[];
      return triggers || [];
    } catch (error) {
      console.error('Erro ao buscar triggers:', error);
      throw error;
    }
  }

  // Testar conectividade com Zabbix
  async testConnection(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.url}/api_jsonrpc.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'apiinfo.version',
          params: {},
          id: 1,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Erro no teste de conexão:', error);
      return false;
    }
  }
}

// Instância singleton
export const zabbixService = new ZabbixService();

// Funções utilitárias para usar nos componentes
export const ZabbixUtils = {
  // Converter status numérico para string
  getHostStatusText(status: number): string {
    switch (status) {
      case 0: return 'Monitorado';
      case 1: return 'Não monitorado';
      default: return 'Desconhecido';
    }
  },

  // Converter disponibilidade para string
  getAvailabilityText(available: number): string {
    switch (available) {
      case 0: return 'Desconhecido';
      case 1: return 'Disponível';
      case 2: return 'Indisponível';
      default: return 'Desconhecido';
    }
  },

  // Converter tipo de interface para string
  getInterfaceTypeText(type: number): string {
    switch (type) {
      case 1: return 'Zabbix Agent';
      case 2: return 'SNMP';
      case 3: return 'IPMI';
      case 4: return 'JMX';
      default: return 'Desconhecido';
    }
  },

  // Formatar valor com unidade
  formatValue(value: string, units: string): string {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      return value;
    }

    if (units === '%') {
      return `${numValue.toFixed(1)}%`;
    } else if (units === 'B' || units === 'bytes') {
      return ZabbixUtils.formatBytes(numValue);
    } else if (units === 'bps') {
      return ZabbixUtils.formatBps(numValue);
    } else if (units === 's') {
      return ZabbixUtils.formatTime(numValue);
    }

    return `${numValue} ${units}`;
  },

  // Formatar bytes
  formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  },

  // Formatar bits por segundo
  formatBps(bps: number): string {
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    if (bps === 0) return '0 bps';
    const i = Math.floor(Math.log(bps) / Math.log(1000));
    return `${(bps / Math.pow(1000, i)).toFixed(1)} ${sizes[i]}`;
  },

  // Formatar tempo
  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(0)}s`;
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(1)}m`;
    } else if (seconds < 86400) {
      return `${(seconds / 3600).toFixed(1)}h`;
    } else {
      return `${(seconds / 86400).toFixed(1)}d`;
    }
  },
}; 