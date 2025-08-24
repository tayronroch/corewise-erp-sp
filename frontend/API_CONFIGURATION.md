# Configuração da API - CoreWise ERP Frontend

## Visão Geral

Este documento descreve as configurações da API para conectar o frontend ao backend Django em `http://localhost:8000`.

## Configurações Atualizadas

### 1. Arquivo de Configuração Central (`src/config/api.ts`)

- **URL Base**: `http://localhost:8000` (configurável via variável de ambiente `VITE_API_BASE`)
- **Endpoints Padronizados**: Todos os endpoints da API estão centralizados e padronizados
- **Headers Padrão**: Configuração consistente de headers para todas as requisições
- **Timeout**: 10 segundos para todas as requisições

### 2. Configuração do Vite (`vite.config.ts`)

- **Proxy Configurado**: Todas as requisições para `/api`, `/docs` e `/admin` são redirecionadas para `localhost:8000`
- **Porta do Frontend**: 3003
- **CORS**: Configurado para permitir comunicação com o backend

### 3. Serviços Atualizados

#### `api.ts` (Serviço Principal)
- Usa a configuração central da API
- Interceptors para autenticação e refresh de token
- Tratamento de erros padronizado

#### `backendApiService.ts`
- URLs hardcoded substituídas por configuração central
- Endpoints padronizados para topology manager
- Fallback para endpoints alternativos

#### `mplsService.ts`
- Já estava usando a API base corretamente
- Endpoints para busca e análise MPLS

## Endpoints Disponíveis

### Topology Manager
- `GET /api/topology/topology-projects/` - Lista de projetos
- `GET /api/topology/simple/projects/list/` - Lista simples de projetos
- `GET /api/topology/simple/devices/` - Dispositivos
- `GET /api/topology/simple/connections/` - Conexões

### MPLS Analyzer
- `GET /api/mpls-analyzer/search/` - Busca inteligente
- `GET /api/mpls-analyzer/search/suggestions/` - Sugestões de busca
- `POST /api/mpls-analyzer/search/advanced/` - Busca avançada

### Networking
- `POST /api/networking/configure_l2vpn/` - Configuração L2VPN
- `POST /api/networking/gerar_bgp/` - Configuração BGP
- `POST /api/networking/executar_config_ospf/` - Configuração OSPF

### Autenticação
- `POST /api/core/auth/login` - Login JWT
- `POST /api/core/auth/refresh` - Refresh Token
- `POST /api/core/auth/logout` - Logout
- `POST /api/core/auth/register` - Registro de Usuário

### Admin
- `GET /admin/login/` - Página de login admin
- `GET /admin/` - Dashboard admin

### Documentação
- `GET /api/docs/` - Documentação da API
- `GET /api/docs/#/` - Swagger UI

## Variáveis de Ambiente

Para configurar a URL da API em diferentes ambientes, use:

```bash
# Desenvolvimento local
VITE_API_BASE=http://localhost:8000

# Produção
VITE_API_BASE=https://api.seudominio.com

# Teste
VITE_API_BASE=http://localhost:8001
```

## Como Usar

### 1. Importar a Configuração

```typescript
import { API_CONFIG, buildApiUrl } from '../config/api';

// Usar endpoint específico
const url = buildApiUrl(API_CONFIG.ENDPOINTS.TOPOLOGY.PROJECTS);

// Usar URL base diretamente
const baseUrl = API_CONFIG.BASE_URL;
```

### 2. Fazer Requisições

```typescript
import { api } from '../services/api';

// GET request
const response = await api.get('/api/topology/projects/');

// POST request
const response = await api.post('/api/core/auth/login', {
  username: 'user',
  password: 'pass'
});
```

### 3. Verificar Saúde da API

```typescript
import { checkApiHealth } from '../config/api';

const isHealthy = await checkApiHealth();
if (isHealthy) {
  console.log('API está funcionando!');
}
```

## Troubleshooting

### Problemas Comuns

1. **CORS Errors**: Verificar se o proxy do Vite está configurado corretamente
2. **Timeout**: Aumentar o valor de `TIMEOUT` em `api.ts` se necessário
3. **URLs Incorretas**: Verificar se `VITE_API_BASE` está configurado corretamente

### Logs de Debug

Para habilitar logs de debug, adicione no console:

```typescript
console.log('API Base:', API_CONFIG.BASE_URL);
console.log('Endpoint:', buildApiUrl('/api/test/'));
```

## Próximos Passos

1. ✅ Configuração da API base
2. ✅ Proxy do Vite configurado
3. ✅ Endpoints padronizados
4. 🔄 Testar conectividade com o backend
5. 🔄 Implementar tratamento de erros específicos
6. 🔄 Adicionar cache para requisições frequentes
