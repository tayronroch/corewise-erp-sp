import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import Login from './components/auth/login';
import Dashboard from './components/dashboard/dashboard';
import MapManager from './components/topology/mapmanager';
import NetworkTopology from './components/topology/networktopology';
import TopologyManager from './components/topology/topology-manager';
import UserManagement from './components/users/user-management';
import MplsAnalyzerDashboard from './components/mpls/mpls-analyzer-dashboard';
import { TokenManager } from './services/api';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0f1419',
      paper: '#1a1a1a',
    },
    primary: {
      main: '#ff4b5c',
    },
    secondary: {
      main: '#8b5cf6',
    },
    text: {
      primary: '#fff',
    },
  },
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se o usuário já está logado
    const authStatus = localStorage.getItem('isAuthenticated');
    const accessToken = localStorage.getItem('access_token');
    
    if (authStatus === 'true' && accessToken) {
      // Verificar se o token ainda é válido
      if (!TokenManager.isTokenExpired(accessToken)) {
        setIsAuthenticated(true);
        // Iniciar sistema de refresh automático
        TokenManager.startAutoRefresh();
      } else {
        // Token expirado, limpar dados e fazer logout
        TokenManager.logout();
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    TokenManager.stopAutoRefresh();
    TokenManager.logout();
    setIsAuthenticated(false);
    setCurrentModule('dashboard');
  };

  const handleNavigation = (module: string) => {
    setCurrentModule(module);
  };

  const renderCurrentModule = () => {
    switch (currentModule) {
      case 'easymaps':
        return <MapManager onBack={() => setCurrentModule('dashboard')} />;
      case 'mapmanager':
        return <MapManager onBack={() => setCurrentModule('dashboard')} />;
      case 'topology-manager':
        return <TopologyManager onBack={() => setCurrentModule('dashboard')} />;
      case 'geo-topology':
        return <TopologyManager />;
      case 'topology':
      case 'networktopology':
        return <NetworkTopology onBack={() => setCurrentModule('dashboard')} />;
      case 'mpls-analyzer':
      case 'mpls-analyzer-search':
      case 'mpls-analyzer-advanced':
      case 'mpls-analyzer-reports':
        return <MplsAnalyzerDashboard onBack={() => setCurrentModule('dashboard')} />;
      case 'easymon':
        return <div>CoreWiseMon - Em desenvolvimento</div>;
      case 'easyflow':
        return <div>CoreWiseFlow - Em desenvolvimento</div>;
      case 'zabbix':
        return <div>ZABBIX - Em desenvolvimento</div>;
      case 'easybi':
        return <div>CoreWiseBI - Em desenvolvimento</div>;
      case 'easyreport':
        return <div>CoreWiseReport - Em desenvolvimento</div>;
      case 'easylog':
        return <div>CoreWiseLog - Em desenvolvimento</div>;
      case 'user-management':
        return <UserManagement onBack={() => setCurrentModule('dashboard')} />;
      default:
        return <Dashboard onLogout={handleLogout} onNavigate={handleNavigation} />;
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {!isAuthenticated ? (
        <Login onLogin={handleLogin} />
      ) : (
        renderCurrentModule()
      )}
    </ThemeProvider>
  );
}
