import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Alert,
  Snackbar
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadAll } from '@tsparticles/all';
import { api } from '../../services/api';

interface LoginProps {
  onLogin: () => void;
}

// Componente separado para as partículas para evitar re-renderização
const ParticlesBackground = React.memo(() => {
  const [init, setInit] = useState(false);

  // Inicializar o engine de partículas uma única vez
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadAll(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const particlesLoaded = useCallback(async (container?: unknown): Promise<void> => {
    console.log('Particles loaded:', container);
  }, []);

  // Configuração do efeito de galáxia/constelação - memoizada
  const particlesOptions = useMemo(() => ({
    background: { color: 'transparent' },
    fpsLimit: 60,
    interactivity: {
      events: {
        onHover: { enable: true, mode: 'grab' },
        resize: { enable: true },
      },
      modes: {
        grab: { distance: 180, links: { opacity: 0.7 } },
      },
    },
    particles: {
      color: { value: '#fff' },
      links: {
        color: '#fff',
        distance: 150,
        enable: true,
        opacity: 0.3,
        width: 1,
      },
      collisions: { enable: false },
      move: {
        enable: true,
        outModes: { default: "bounce" as const },
        random: false,
        speed: 1.2,
        straight: false,
      },
      number: { density: { enable: true, area: 800 }, value: 60 },
      opacity: { value: 0.7 },
      shape: { type: 'circle' },
      size: { value: { min: 1, max: 4 } },
    },
    detectRetina: true,
  }), []);

  if (!init) return null;

  return (
    <Particles
      id="galaxy-bg"
      particlesLoaded={particlesLoaded}
      options={particlesOptions}
      style={{ position: 'absolute', inset: 0, zIndex: 0 }}
    />
  );
});

ParticlesBackground.displayName = 'ParticlesBackground';

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/api/core/auth/login', {
        username: username,
        password: password
      });

      if (response.data.access && response.data.refresh) {
        // Salvar tokens no localStorage
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Configurar o token no axios para próximas requisições
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
        
        onLogin();
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else if (error.response?.status === 401) {
        setError('Credenciais inválidas. Verifique seu usuário e senha.');
      } else if (error.code === 'NETWORK_ERROR') {
        setError('Erro de conexão. Verifique se o backend está rodando.');
      } else {
        setError('Erro interno. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e3c72 0%, #000000 50%, #1e3c72 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        paddingLeft: '2vw',
        paddingRight: '2vw',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-opacity='0.1'%3E%3Cpolygon fill='%23fff' points='50 0 60 40 100 50 60 60 50 100 40 60 0 50 40 40'/%3E%3C/g%3E%3C/svg%3E\")",
          animation: 'float 20s ease-in-out infinite',
          zIndex: -1,
        },
        '@keyframes float': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(180deg)' },
        },
      }}
    >
      {/* Efeito de galáxia/constelação - Componente separado */}
      <ParticlesBackground />
      
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          maxWidth: '1200px',
          height: '70vh',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          background: 'rgba(0, 0, 0, 0)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Lado Esquerdo - Informações */}
        <Box
          sx={{
            flex: 1,
            background: 'linear-gradient(45deg, rgba(0,0,0,0.7), rgba(0,0,0,0.5))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '32px 48px',
            color: 'rgb(255, 255, 255)',
            position: 'relative',
            minWidth: '340px',
          }}
        >
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 2, color: '#fff' }}>
            Monitoramento eficiente e confiável.
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, lineHeight: 1.6 }}>
            Monitoramento de infraestrutura de redes para provedores de internet, 
            com suporte confiável e atencioso.
          </Typography>
          
          {/* Logo/Brand */}
          <Box sx={{ position: 'absolute', top: 40, right: 40 }}>
            <Typography variant="h4" sx={{
              fontWeight: 900,
              color: '#ff4b5c',
            }}>
              CoreWise
            </Typography>
            <Typography variant="caption" sx={{
              color: 'rgb(255, 255, 255)',
            }}>
              SOLUÇÕES EM INFRAESTRUTURA DE REDES
            </Typography>
          </Box>
        </Box>

        {/* Lado Direito - Login */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#053db600',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Card
            sx={{
              width: '100%',
              maxWidth: '400px',
              padding: '32px',
              background: '#fff',
              border: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              borderRadius: '12px',
            }}
          >
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1, fontWeight: 600, textAlign: 'center' }}>
                Login
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
                Bem vindo! Por favor digite suas credenciais.
              </Typography>

              <TextField
                fullWidth
                label="Login"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{ 
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#f8f9fa',
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#8b5cf6',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#8b5cf6',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#666666',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#333333',
                  },
                }}
                placeholder="Digite seu usuário"
              />

              <TextField
                fullWidth
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{ 
                  mb: 4,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#f8f9fa',
                    '& fieldset': {
                      borderColor: '#e0e0e0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#8b5cf6',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#8b5cf6',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#666666',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#333333',
                  },
                }}
                placeholder="Digite sua senha"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleLogin}
                disabled={loading}
                sx={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: '12px',
                  textTransform: 'none',
                  boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    boxShadow: '0 6px 25px rgba(139, 92, 246, 0.4)',
                  },
                  '&:disabled': {
                    background: '#cccccc',
                    boxShadow: 'none',
                  },
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>

              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 3, color: '#666' }}>
                Esqueceu sua senha? Entre em contato com o administrador.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
} 
