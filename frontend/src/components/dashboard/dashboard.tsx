import React from 'react';
import { userService } from '../../services/userService';
import type { User } from '../../services/userService';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu as MenuComponent,
  MenuItem,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Divider,
  Paper,
  Switch,
  FormControlLabel,
  InputAdornment,
  OutlinedInput,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Settings,
  Notifications,
  Home,
  AddCircle,
  Support,
  Timeline,
  Assessment,
  Language,
  BugReport,
  Menu,
  MonitorHeart,
  Analytics,
  Map as MapIcon,
  Storage,
  Edit,
  PhotoCamera,
  Logout,
  LightMode,
  DarkMode,
  Person,
  Lock,
  Search,
  ChevronRight,
} from '@mui/icons-material';

interface DashboardProps {
  onLogout: () => void;
  onNavigate: (module: string) => void;
}

interface UserProfile {
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  photo?: string;
}

const modules = [
  {
    id: 'easymon',
    title: 'CoreWiseMon',
    description: 'Monitoramento de equipamentos',
    accent: ['#ff6b35', '#f7931e'],
    icon: <MonitorHeart sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'mpls-analyzer',
    title: 'MPLS Analyzer',
    description: 'Busca, relatórios e auditoria MPLS',
    accent: ['#0ea5e9', '#2563eb'],
    icon: <Storage sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'easyflow',
    title: 'CoreWiseFlow',
    description: 'Análise de tráfego de rede',
    accent: ['#00d4aa', '#00a785'],
    icon: <Timeline sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'zabbix',
    title: 'ZABBIX',
    description: 'Integração Zabbix',
    accent: ['#6c5ce7', '#a29bfe'],
    icon: <Storage sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'easybi',
    title: 'CoreWiseBI',
    description: 'Business Intelligence',
    accent: ['#00cec9', '#55a3ff'],
    icon: <Analytics sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'easyreport',
    title: 'CoreWiseReport',
    description: 'Relatórios e análises',
    accent: ['#ffa726', '#fb8c00'],
    icon: <Assessment sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'easymaps',
    title: 'CoreWiseMaps',
    description: 'Mapas de rede',
    accent: ['#ff5722', '#f44336'],
    icon: <MapIcon sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'mapmanager',
    title: 'Gerenciador de Mapas',
    description: 'Gerenciar topologias geográficas',
    accent: ['#3f51b5', '#2196f3'],
    icon: <MapIcon sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'topology-manager',
    title: 'Gerenciador de Topologia',
    description: 'Criar topologias de rede no mapa',
    accent: ['#673ab7', '#9c27b0'],
    icon: <Storage sx={{ fontSize: 40, color: 'white' }} />,
  },
  {
    id: 'easylog',
    title: 'CoreWiseLog',
    description: 'Logs e eventos',
    accent: ['#e74c3c', '#c0392b'],
    icon: <BugReport sx={{ fontSize: 40, color: 'white' }} />,
  },
];

const sidebarItems = [
  { text: 'Home', icon: <Home />, id: 'home' },
  { text: 'Adição de Host', icon: <AddCircle />, id: 'addhost' },
  { text: 'Gerenciar Usuários', icon: <Person />, id: 'user-management' },
  { text: 'Suporte', icon: <Support />, id: 'support' },
  {
    text: 'MPLS',
    icon: <Storage />, id: 'mpls-analyzer',
    subitems: [
      { text: 'Busca Inteligente', id: 'mpls-analyzer-search' },
      { text: 'Busca Avançada', id: 'mpls-analyzer-advanced' },
      { text: 'Relatórios de Cliente', id: 'mpls-analyzer-reports' },
    ]
  },
  {
    text: 'CoreWiseFlow', icon: <Timeline />, id: 'easyflow',
    subitems: [{ text: 'Relatórios Flow', id: 'flow-reports' }]
  },
  { text: 'CoreWiseReport', icon: <Assessment />, id: 'easyreport' },
  { text: 'CoreWiseMaps', icon: <Language />, id: 'easymaps' },
  {
    text: 'CoreWiseLog', icon: <BugReport />, id: 'easylog',
    subitems: [
      { text: 'Histórico de Logs', id: 'log-history' },
      { text: 'Insights', id: 'log-insights' }
    ]
  },
];

// ---------- Styled / UI Atoms ----------
const Page = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  background: `radial-gradient(1200px 500px at 20% -10%, ${alpha(theme.palette.primary.main, 0.25)}, transparent),
               radial-gradient(900px 400px at 80% 10%, ${alpha(theme.palette.secondary.main, 0.18)}, transparent),
               #0f1419`,
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.common.white,
  fontWeight: 700,
}));

const GlowCard = styled('div')<{ g1: string; g2: string }>(({ theme, g1, g2 }) => ({
  position: 'relative',
  borderRadius: 20,
  padding: 1,
  background: `linear-gradient(135deg, ${alpha('#fff', 0.12)}, ${alpha('#fff', 0.05)})`,
  transition: 'transform .25s ease, box-shadow .25s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-6px)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)'
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: -1,
    borderRadius: 20,
    padding: 2,
    background: `linear-gradient(135deg, ${g1}, ${g2})`,
    filter: 'blur(12px)',
    opacity: .35,
    zIndex: 0,
  },
}));

const Glass = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  height: 200,
  backgroundColor: alpha('#121417', 0.55),
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha('#fff', 0.1)}`,
  position: 'relative',
  zIndex: 1,
}));

const Stat = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderRadius: 16,
  background: alpha('#ffffff', 0.04),
  border: `1px solid ${alpha('#fff', 0.08)}`,
  color: alpha('#fff', 0.85),
}));

export default function Dashboard({ onLogout, onNavigate }: DashboardProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [sidebarHovered, setSidebarHovered] = React.useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(true);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [realUserData, setRealUserData] = React.useState<User | null>(null);
  const [query, setQuery] = React.useState('');

  const [userProfile, setUserProfile] = React.useState<UserProfile>({
    username: 'tayron.rocha',
    name: 'Tayron',
    surname: 'Rocha',
    email: 'tayron.directtelecom@gmail.com',
    phone: '(86) 99993-6376',
    cpf: '063.823.083-74',
    birthDate: '07/05/1994',
    photo: undefined,
  });

  const [passwordData, setPasswordData] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Load profile
  React.useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setProfileLoading(true);
        const response = await userService.getMyProfile();
        if (response.success && response.user) {
          const user = response.user;
          setRealUserData(user);
          setUserProfile({
            username: user.username,
            name: user.first_name,
            surname: user.last_name,
            email: user.email,
            phone: user.profile?.phone || '',
            cpf: '',
            birthDate: '',
            photo: user.profile?.avatar,
          });
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      } finally {
        setProfileLoading(false);
      }
    };
    loadUserProfile();
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const el = document.getElementById('dashboard-search') as HTMLInputElement | null;
        el?.focus();
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleModuleClick = (moduleId: string) => onNavigate(moduleId);
  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => setUserMenuAnchor(event.currentTarget);
  const handleUserMenuClose = () => setUserMenuAnchor(null);

  const modulesFiltered = React.useMemo(() => {
    if (!query) return modules;
    const q = query.toLowerCase();
    return modules.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.id.includes(q)
    );
  }, [query]);

  const handleProfileSave = async () => {
    try {
      setProfileLoading(true);
      const updateData = {
        username: userProfile.username,
        email: userProfile.email,
        first_name: userProfile.name,
        last_name: userProfile.surname,
        phone: userProfile.phone,
        is_active: realUserData?.is_active || true,
        role: realUserData?.profile?.role || 'viewer',
      };
      const response = await userService.updateMyProfile(updateData);
      if (response.success && response.user) {
        setRealUserData(response.user);
        setProfileDialogOpen(false);
      }
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }
    console.log('Senha alterada');
    setPasswordDialogOpen(false);
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setUserProfile(prev => ({ ...prev, photo: e.target?.result as string }));
      reader.readAsDataURL(file);
    }
  };

  return (
    <Page>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        sx={{
          width: sidebarHovered ? 240 : 60,
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: sidebarHovered ? 240 : 60,
            boxSizing: 'border-box',
            background: '#111315',
            color: 'white',
            borderRight: '1px solid #2b2f33',
            paddingTop: '16px',
            transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
            overflowX: 'hidden',
            position: 'relative',
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #2b2f33', display: sidebarHovered ? 'block' : 'none' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#ff4b5c', letterSpacing: .5 }}>CoreWise</Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>ADMINISTRAÇÃO</Typography>
        </Box>

        <Typography variant="overline" sx={{ px: 2, py: 1, color: 'rgba(255,255,255,0.5)', display: sidebarHovered ? 'block' : 'none' }}>Navegação</Typography>

        <List>
          {sidebarItems.map((item) => (
            <Box key={item.id}>
              <ListItemButton
                onClick={() => item.id === 'home' ? null : onNavigate(item.id)}
                sx={{
                  mx: 1,
                  borderRadius: 1.5,
                  minHeight: 52,
                  justifyContent: sidebarHovered ? 'flex-start' : 'center',
                  px: sidebarHovered ? 2 : 0,
                  '&:hover': { bgcolor: alpha('#ff4b5c', 0.1) },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: sidebarHovered ? 40 : 'auto', justifyContent: 'center', mr: sidebarHovered ? 1 : 0 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: item.id === 'home' ? alpha('#ff4b5c', 0.25) : 'transparent' }}>
                    {item.icon}
                  </Box>
                </ListItemIcon>
                <ListItemText primary={item.text} sx={{ opacity: sidebarHovered ? 1 : 0, width: sidebarHovered ? 'auto' : 0, transition: 'opacity .2s, width .2s', overflow: 'hidden', whiteSpace: 'nowrap' }} />
              </ListItemButton>
              {item.subitems && sidebarHovered && (
                <List sx={{ pl: 2 }}>
                  {item.subitems.map((sub) => (
                    <ListItemButton key={sub.id} onClick={() => onNavigate(sub.id)} sx={{ mx: 1, borderRadius: 1.5, py: .5, '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
                      <ListItemText primary={sub.text} primaryTypographyProps={{ variant: 'body2' }} sx={{ color: 'rgba(255,255,255,0.75)' }} />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          ))}
        </List>
      </Drawer>

      {/* Main */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, ml: sidebarHovered ? '240px' : '60px', transition: 'margin-left .3s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* Header */}
        <AppBar position="fixed" elevation={0} sx={{ background: '#111315', borderBottom: '1px solid #2b2f33', left: sidebarHovered ? '240px' : '60px', width: `calc(100% - ${sidebarHovered ? 240 : 60}px)`, transition: 'left .3s, width .3s' }}>
          <Toolbar>
            <IconButton color="inherit" onClick={() => setDrawerOpen(!drawerOpen)} sx={{ mr: 2, display: { sm: 'none' } }}>
              <Menu />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1, color: '#ff4b5c', fontWeight: 800 }}>Dashboard</Typography>

            <OutlinedInput
              id="dashboard-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar módulos… (Ctrl/⌘+K)"
              sx={{
                mr: 2,
                width: { xs: 180, sm: 260, md: 320 },
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2f3338' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#40454b' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.25) },
                background: alpha('#ffffff', 0.04),
                borderRadius: 2
              }}
              startAdornment={<InputAdornment position="start"><Search sx={{ color: 'rgba(255,255,255,.6)' }} /></InputAdornment>}
            />

            <IconButton color="inherit" sx={{ mr: 1 }}>
              <Notifications />
            </IconButton>
            <IconButton color="inherit" onClick={() => setSettingsDialogOpen(true)} sx={{ mr: 1 }}>
              <Settings />
            </IconButton>
            <IconButton color="inherit" onClick={(e) => setUserMenuAnchor(e.currentTarget)} sx={{ p: .5, border: userMenuAnchor ? '2px solid #ff4b5c' : '2px solid transparent', borderRadius: '50%' }}>
              <Avatar src={userProfile.photo} sx={{ width: 32, height: 32, bgcolor: '#ff4b5c', fontSize: 14, fontWeight: 'bold' }}>
                {!userProfile.photo && `${userProfile.name[0]}${userProfile.surname[0]}`}
              </Avatar>
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* User Menu */}
        <MenuComponent anchorEl={userMenuAnchor} open={Boolean(userMenuAnchor)} onClose={handleUserMenuClose} onClick={handleUserMenuClose} PaperProps={{ sx: { bgcolor: '#1b1e22', color: '#fff', border: '1px solid #2b2f33', mt: 1, minWidth: 220 } }} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #2b2f33' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar src={userProfile.photo} sx={{ width: 40, height: 40, bgcolor: '#ff4b5c', fontSize: 16, fontWeight: 'bold' }}>
                {!userProfile.photo && `${userProfile.name[0]}${userProfile.surname[0]}`}
              </Avatar>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{userProfile.name} {userProfile.surname}</Typography>
                <Typography variant="caption" sx={{ color: '#8a8f98' }}>@{userProfile.username}</Typography>
                <Typography variant="caption" sx={{ color: '#8a8f98', display: 'block' }}>{userProfile.email}</Typography>
              </Box>
            </Box>
          </Box>
          <MenuItem onClick={() => setProfileDialogOpen(true)}><Person sx={{ mr: 2 }} />Perfil</MenuItem>
          <MenuItem onClick={() => setPasswordDialogOpen(true)}><Lock sx={{ mr: 2 }} />Alterar Senha</MenuItem>
          <MenuItem onClick={() => setDarkMode(!darkMode)}>{darkMode ? <LightMode sx={{ mr: 2 }} /> : <DarkMode sx={{ mr: 2 }} />}{darkMode ? 'Modo Claro' : 'Modo Escuro'}</MenuItem>
          <MenuItem onClick={() => setSettingsDialogOpen(true)}><Settings sx={{ mr: 2 }} />Configurações</MenuItem>
          <Divider sx={{ borderColor: '#2b2f33' }} />
          <MenuItem onClick={onLogout}><Logout sx={{ mr: 2 }} />Sair</MenuItem>
        </MenuComponent>

        {/* Content */}
        <Box sx={{ flexGrow: 1, p: { xs: '88px 24px 24px 24px', sm: '88px 32px 32px 32px' } }}>
          <SectionTitle variant="h4" sx={{ mb: 1 }}>Módulos do Sistema</SectionTitle>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.6)', mb: 3 }}>Seu cockpit para automação, análise e mapas.</Typography>

          {/* Quick stats */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' }, gap: 2, mb: 3 }}>
            {[{ label: 'Disponibilidade', value: '99.97%' }, { label: 'Alarmes', value: '12' }, { label: 'Tarefas', value: '3' }, { label: 'Relatórios', value: '8' }].map((s) => (
              <Stat key={s.label}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.7)' }}>{s.label}</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>{s.value}</Typography>
                </Box>
              </Stat>
            ))}
          </Box>

          {/* Tiles */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(auto-fit, minmax(260px, 1fr))', md: 'repeat(auto-fit, minmax(300px, 1fr))' }, gap: 3 }}>
            {modulesFiltered.map((module) => (
              <GlowCard key={module.id} g1={module.accent[0]} g2={module.accent[1]} onClick={() => handleModuleClick(module.id)}>
                <Glass elevation={0}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', mb: .5 }}>{module.title}</Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.8)' }}>{module.description}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      {module.icon}
                      <ChevronRight sx={{ color: 'rgba(255,255,255,.8)' }} />
                    </Box>
                  </CardContent>
                </Glass>
              </GlowCard>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onClose={() => setProfileDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1b1e22', color: '#fff' } }}>
        <DialogTitle sx={{ bgcolor: '#111315', color: '#fff', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar src={userProfile.photo} sx={{ width: 60, height: 60, bgcolor: '#ff4b5c', fontSize: 24, fontWeight: 'bold' }}>
              {!userProfile.photo && `${userProfile.name[0]}${userProfile.surname[0]}`}
            </Avatar>
            <IconButton sx={{ position: 'absolute', bottom: -8, right: -8, bgcolor: '#ff4b5c', color: '#fff', width: 28, height: 28, '&:hover': { bgcolor: '#e53e3e' } }} component="label">
              <PhotoCamera sx={{ fontSize: 16 }} />
              <input hidden accept="image/*" type="file" onChange={handlePhotoUpload} />
            </IconButton>
          </Box>
          <Box>
            <Typography variant="h6">{userProfile.name} {userProfile.surname}</Typography>
            <Button startIcon={<Edit />} size="small" sx={{ color: '#ff4b5c', p: 0, minWidth: 'auto' }}>Editar</Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField label="Nome de Usuário (Login)" value={userProfile.username} onChange={(e) => setUserProfile(prev => ({ ...prev, username: e.target.value }))} fullWidth sx={{ mb: 2, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} helperText="Este será seu nome de usuário para fazer login" FormHelperTextProps={{ sx: { color: '#ccc' } }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <TextField label="Nome" value={userProfile.name} onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))} fullWidth sx={{ '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
            <TextField label="Sobrenome" value={userProfile.surname} onChange={(e) => setUserProfile(prev => ({ ...prev, surname: e.target.value }))} fullWidth sx={{ '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <TextField label="Data de Nascimento" value={userProfile.birthDate} onChange={(e) => setUserProfile(prev => ({ ...prev, birthDate: e.target.value }))} fullWidth sx={{ '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
            <TextField label="Telefone" value={userProfile.phone} onChange={(e) => setUserProfile(prev => ({ ...prev, phone: e.target.value }))} fullWidth sx={{ '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
          </Box>
          <TextField label="CPF" value={userProfile.cpf} onChange={(e) => setUserProfile(prev => ({ ...prev, cpf: e.target.value }))} fullWidth sx={{ mb: 2, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
          <TextField label="E-mail" value={userProfile.email} onChange={(e) => setUserProfile(prev => ({ ...prev, email: e.target.value }))} fullWidth sx={{ '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#111315', p: 2 }}>
          <Button onClick={() => setProfileDialogOpen(false)} sx={{ color: '#ff4b5c' }}>Cancelar</Button>
          <Button onClick={handleProfileSave} variant="contained" disabled={profileLoading} sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}>{profileLoading ? 'Salvando…' : 'Salvar'}</Button>
        </DialogActions>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1b1e22', color: '#fff' } }}>
        <DialogTitle sx={{ bgcolor: '#111315', color: '#fff' }}>Alterar Senha</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <TextField label="Senha Atual" type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))} fullWidth sx={{ mb: 2, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
          <TextField label="Nova Senha" type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))} fullWidth sx={{ mb: 2, '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
          <TextField label="Confirmar Nova Senha" type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))} fullWidth sx={{ '& .MuiInputLabel-root': { color: '#fff' }, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#444' } } }} />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#111315', p: 2 }}>
          <Button onClick={() => setPasswordDialogOpen(false)} sx={{ color: '#ff4b5c' }}>Cancelar</Button>
          <Button onClick={handlePasswordChange} variant="contained" sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }} disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}>Alterar Senha</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: '#1b1e22', color: '#fff', minHeight: '60vh' } }}>
        <DialogTitle sx={{ bgcolor: '#111315', color: '#fff' }}>Configurações Globais</DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: '#ff4b5c' }}>Preferências do Sistema</Typography>
          <Paper sx={{ p: 2, bgcolor: '#111315', mb: 2 }}>
            <FormControlLabel control={<Switch checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#ff4b5c' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#ff4b5c' } }} />} label="Modo Escuro" sx={{ color: '#fff' }} />
          </Paper>
          <Typography variant="body2" sx={{ color: '#ccc', mt: 2 }}>Para configurações avançadas do sistema (FTTH, tráfego, Zabbix), acesse o módulo específico e clique em "Configurações" na barra superior.</Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#111315', p: 2 }}>
          <Button onClick={() => setSettingsDialogOpen(false)} sx={{ color: '#ff4b5c' }}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
