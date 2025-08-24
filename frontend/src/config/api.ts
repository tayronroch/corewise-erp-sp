// Configuração central da API
export const API_CONFIG = {
  // URL base da API
  BASE_URL: (import.meta.env.VITE_API_BASE as string) || 'http://localhost:8000',
  
  // Endpoints principais
  ENDPOINTS: {
    // Topology Manager
    TOPOLOGY: {
      PROJECTS: '/api/topology/topology-projects/',
      SIMPLE_PROJECTS: '/api/topology/simple/projects/list/',
      DEVICES: '/api/topology/simple/devices/',
      CONNECTIONS: '/api/topology/simple/connections/',
      EQUIPMENTS: '/api/topology/equipments/',
      LINKS: '/api/topology/links/',
    },
    
    // MPLS Analyzer
    MPLS: {
      BASE: '/api/mpls-analyzer',
      SEARCH: '/api/mpls-analyzer/search/',
      SUGGESTIONS: '/api/mpls-analyzer/search/suggestions/',
      ADVANCED_SEARCH: '/api/mpls-analyzer/search/advanced/',
    },
    
    // Networking
    NETWORKING: {
      L2VPN_CONFIG: '/api/networking/configure_l2vpn/',
      BGP_CONFIG: '/api/networking/gerar_bgp/',
      OSPF_CONFIG: '/api/networking/executar_config_ospf/',
    },
    
    // Users & Authentication
    AUTH: {
      LOGIN: '/api/core/auth/login',
      REFRESH: '/api/core/auth/refresh',
      LOGOUT: '/api/core/auth/logout',
      REGISTER: '/api/core/auth/register',
    },

    // User Management
    USERS: {
      BASE: '/api/core/users',
      PERMISSIONS: '/api/core/users/permissions/',
    },
    
    // Admin
    ADMIN: {
      LOGIN: '/admin/login/',
      DASHBOARD: '/admin/',
    },
    
    // Documentation
    DOCS: {
      API_DOCS: '/api/docs/',
      SWAGGER_UI: '/api/docs/#/',
    },
  },
  
  // Headers padrão
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  
  // Timeout padrão
  TIMEOUT: 10000, // 10 segundos
};

// Função helper para construir URLs completas
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Função helper para verificar se a API está disponível
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/health/`, {
      method: 'GET',
      headers: API_CONFIG.DEFAULT_HEADERS,
    });
    return response.ok;
  } catch {
    return false;
  }
};
