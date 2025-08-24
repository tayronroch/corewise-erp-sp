import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Visibility as ViewIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  AccountCircle,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { userService } from '../../services/userService';
import type { User, CreateUserData, UserStats } from '../../services/userService';
import { CircularProgress, Snackbar, Alert } from '@mui/material';

interface UserManagementProps {
  onBack: () => void;
}

const roleConfig = {
  admin: {
    label: 'Administrador',
    color: '#f44336',
    icon: <AdminIcon />,
    description: 'Acesso total ao sistema',
  },
  editor: {
    label: 'Editor',
    color: '#ff9800',
    icon: <EditIcon />,
    description: 'Pode visualizar e editar',
  },
  viewer: {
    label: 'Visualizador',
    color: '#4caf50',
    icon: <ViewIcon />,
    description: 'Apenas visualização',
  },
};

export default function UserManagement({ onBack }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Estados para notificações
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  
  const [newUser, setNewUser] = useState<CreateUserData>({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'viewer',
    password: '',
    confirm_password: '',
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  
  // Carregar dados iniciais
  useEffect(() => {
    loadUsers();
    loadStats();
  }, [searchTerm, roleFilter]);
  
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };
  
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers({
        search: searchTerm || undefined,
        role: roleFilter || undefined,
      });
      setUsers(response.results || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      showNotification('Erro ao carregar usuários', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const loadStats = async () => {
    try {
      const statsData = await userService.getUserStats();
      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleCreateUser = useCallback(async () => {
    try {
      if (newUser.password !== newUser.confirm_password) {
        showNotification('As senhas não coincidem!', 'error');
        return;
      }
      
      await userService.createUser(newUser);
      showNotification('Usuário criado com sucesso!', 'success');
      
      setCreateUserOpen(false);
      setNewUser({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: 'viewer',
        password: '',
        confirm_password: '',
      });
      
      // Recarregar dados
      loadUsers();
      loadStats();
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      const message = error.response?.data?.message || 'Erro ao criar usuário';
      showNotification(message, 'error');
    }
  }, [newUser]);

  const handleEditUser = useCallback(async () => {
    if (!selectedUser) return;
    
    try {
      await userService.updateUser(selectedUser.id, {
        email: selectedUser.email,
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        is_active: selectedUser.is_active,
        phone: selectedUser.profile?.phone,
        role: selectedUser.profile?.role,
      });
      
      showNotification('Usuário atualizado com sucesso!', 'success');
      setEditUserOpen(false);
      setSelectedUser(null);
      
      // Recarregar dados
      loadUsers();
      loadStats();
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      const message = error.response?.data?.message || 'Erro ao atualizar usuário';
      showNotification(message, 'error');
    }
  }, [selectedUser]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const confirmMessage = `Tem certeza que deseja excluir o usuário "${user.username}"?\n\nEsta ação não pode ser desfeita.`;
    
    if (window.confirm(confirmMessage)) {
      try {
        await userService.deleteUser(userId);
        showNotification('Usuário excluído com sucesso!', 'success');
        
        // Recarregar dados
        loadUsers();
        loadStats();
      } catch (error: any) {
        console.error('Erro ao excluir usuário:', error);
        const message = error.response?.data?.message || 'Erro ao excluir usuário';
        showNotification(message, 'error');
      }
    }
  }, [users]);

  const handleToggleUserStatus = useCallback(async (userId: string) => {
    try {
      const response = await userService.toggleUserStatus(userId);
      showNotification(response.message || 'Status atualizado!', 'success');
      
      // Recarregar dados
      loadUsers();
      loadStats();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      const message = error.response?.data?.message || 'Erro ao alterar status do usuário';
      showNotification(message, 'error');
    }
  }, []);
  
  const handleResetPassword = useCallback(async (userId: string, newPassword: string) => {
    try {
      await userService.resetPassword(userId, newPassword);
      showNotification('Senha resetada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao resetar senha:', error);
      const message = error.response?.data?.message || 'Erro ao resetar senha';
      showNotification(message, 'error');
    }
  }, []);

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setUserMenuAnchor(event.currentTarget);
    setSelectedUser(user);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
    setSelectedUser(null);
  };

  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatLastLogin = (date?: string) => {
    if (!date) return 'Nunca';
    
    const dateObj = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    
    return dateObj.toLocaleDateString('pt-BR');
  };

  return (
    <Box sx={{ 
      p: 3, 
      minHeight: '100vh', 
      bgcolor: '#0f1419',
      color: '#fff',
    }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        flexWrap: 'wrap',
        gap: 2,
      }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
            Gerenciamento de Usuários
          </Typography>
          <Typography variant="body2" sx={{ color: '#ccc' }}>
            Gerencie usuários e suas permissões no sistema
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={onBack}
            sx={{ borderColor: '#555', color: '#fff' }}
          >
            Voltar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateUserOpen(true)}
            sx={{ 
              bgcolor: '#ff4b5c', 
              '&:hover': { bgcolor: '#e53e3e' },
            }}
          >
            Novo Usuário
          </Button>
        </Box>
      </Box>
      
      {/* Filtros de Busca */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="Buscar usuários..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            '& .MuiInputLabel-root': { color: '#ccc' },
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': { borderColor: '#555' },
            },
            minWidth: 250
          }}
        />
        
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel sx={{ color: '#ccc' }}>Filtrar por Role</InputLabel>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{
              color: '#fff',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
            }}
            label="Filtrar por Role"
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="admin">Administrador</MenuItem>
            <MenuItem value="editor">Editor</MenuItem>
            <MenuItem value="viewer">Visualizador</MenuItem>
          </Select>
        </FormControl>
        
        <Button
          variant="outlined"
          onClick={() => {
            setSearchTerm('');
            setRoleFilter('');
          }}
          sx={{ borderColor: '#555', color: '#fff' }}
        >
          Limpar Filtros
        </Button>
      </Box>

      {/* Estatísticas */}
      <Box sx={{ 
        display: 'flex', 
        gap: 3, 
        mb: 4, 
        flexWrap: 'wrap',
        '& > *': { 
          flex: '1 1 250px',
          minWidth: '200px'
        }
      }}>
        <Card sx={{ bgcolor: '#1a1a1a', color: '#fff' }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
              {stats?.total_users || 0}
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc' }}>
              Total de Usuários
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ bgcolor: '#1a1a1a', color: '#fff' }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
              {stats?.active_users || 0}
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc' }}>
              Usuários Ativos
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ bgcolor: '#1a1a1a', color: '#fff' }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
              {stats?.admins || 0}
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc' }}>
              Administradores
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ bgcolor: '#1a1a1a', color: '#fff' }}>
          <CardContent>
            <Typography variant="h4" sx={{ color: '#9c27b0', fontWeight: 'bold' }}>
              {stats?.recent_logins || 0}
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc' }}>
              Logados Hoje
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabela de Usuários */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          bgcolor: '#1a1a1a',
          '& .MuiTableCell-root': {
            borderColor: '#333',
          },
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#2a2a2a' }}>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Usuário</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Contato</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Permissão</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Último Login</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Criado em</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={40} />
                  <Typography sx={{ mt: 2, color: '#ccc' }}>Carregando usuários...</Typography>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography sx={{ color: '#ccc' }}>Nenhum usuário encontrado</Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} sx={{ 
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  bgcolor: user.is_active ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}>
                <TableCell sx={{ color: '#fff' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      src={user.profile?.avatar}
                      sx={{
                        bgcolor: '#ff4b5c',
                        width: 40,
                        height: 40,
                      }}
                    >
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {user.first_name} {user.last_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#ccc' }}>
                        @{user.username}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                
                <TableCell sx={{ color: '#fff' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 16, color: '#ccc' }} />
                      <Typography variant="body2">{user.email}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PhoneIcon sx={{ fontSize: 16, color: '#ccc' }} />
                      <Typography variant="body2">{user.profile?.phone || 'N/A'}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                
                <TableCell>
                  <Chip
                    icon={roleConfig[user.profile?.role || 'viewer'].icon}
                    label={roleConfig[user.profile?.role || 'viewer'].label}
                    sx={{
                      bgcolor: roleConfig[user.profile?.role || 'viewer'].color,
                      color: '#fff',
                      fontWeight: 'bold',
                    }}
                  />
                </TableCell>
                
                <TableCell>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={user.is_active}
                        onChange={() => handleToggleUserStatus(user.id)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { 
                            color: '#4caf50' 
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { 
                            bgcolor: '#4caf50' 
                          },
                        }}
                      />
                    }
                    label={user.is_active ? 'Ativo' : 'Inativo'}
                    sx={{ 
                      color: user.is_active ? '#4caf50' : '#f44336',
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                </TableCell>
                
                <TableCell sx={{ color: '#fff' }}>
                  <Typography variant="body2">
                    {formatLastLogin(user.last_login)}
                  </Typography>
                </TableCell>
                
                <TableCell sx={{ color: '#fff' }}>
                  <Typography variant="body2">
                    {formatDate(user.profile?.created_at)}
                  </Typography>
                </TableCell>
                
                <TableCell>
                  <IconButton
                    onClick={(e) => handleUserMenuClick(e, user)}
                    sx={{ color: '#fff' }}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Menu de Ações do Usuário */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        PaperProps={{
          sx: {
            bgcolor: '#2a2a2a',
            color: '#fff',
            border: '1px solid #444',
          },
        }}
      >
        <MenuItem onClick={() => {
          setEditUserOpen(true);
          handleUserMenuClose();
        }}>
          <ListItemIcon sx={{ color: '#4caf50' }}>
            <EditIcon />
          </ListItemIcon>
          <ListItemText>Editar Usuário</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          const newPassword = prompt('Digite a nova senha:');
          if (newPassword && selectedUser) {
            handleResetPassword(selectedUser.id, newPassword);
          }
          handleUserMenuClose();
        }}>
          <ListItemIcon sx={{ color: '#ff9800' }}>
            <LockIcon />
          </ListItemIcon>
          <ListItemText>Resetar Senha</ListItemText>
        </MenuItem>
        
        <Divider sx={{ borderColor: '#444' }} />
        
        <MenuItem onClick={() => {
          if (selectedUser) {
            handleDeleteUser(selectedUser.id);
          }
          handleUserMenuClose();
        }}>
          <ListItemIcon sx={{ color: '#f44336' }}>
            <DeleteIcon />
          </ListItemIcon>
          <ListItemText>Excluir Usuário</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialog de Criar Usuário */}
      <Dialog
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#2a2a2a',
            color: '#fff',
          },
        }}
      >
        <DialogTitle sx={{ bgcolor: '#1a1a1a', color: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonIcon sx={{ color: '#ff4b5c' }} />
            Criar Novo Usuário
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nome de Usuário"
              value={newUser.username}
              onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
              fullWidth
              required
              sx={{
                '& .MuiInputLabel-root': { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#555' },
                },
              }}
            />
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Nome"
                value={newUser.first_name}
                onChange={(e) => setNewUser(prev => ({ ...prev, first_name: e.target.value }))}
                required
                sx={{
                  flex: '1 1 200px',
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: '#555' },
                  },
                }}
              />
              
              <TextField
                label="Sobrenome"
                value={newUser.last_name}
                onChange={(e) => setNewUser(prev => ({ ...prev, last_name: e.target.value }))}
                sx={{
                  flex: '1 1 200px',
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: '#555' },
                  },
                }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="E-mail"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                sx={{
                  flex: '1 1 200px',
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: '#555' },
                  },
                }}
              />
              
              <TextField
                label="Telefone"
                value={newUser.phone}
                onChange={(e) => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                sx={{
                  flex: '1 1 200px',
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: '#555' },
                  },
                }}
              />
            </Box>
            
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#fff' }}>Nível de Permissão</InputLabel>
              <Select
                value={newUser.role}
                onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as 'admin' | 'editor' | 'viewer' }))}
                sx={{ 
                  color: '#fff', 
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                }}
                label="Nível de Permissão"
              >
                {Object.entries(roleConfig).map(([role, config]) => (
                  <MenuItem key={role} value={role}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ color: config.color }}>{config.icon}</Box>
                      <Box>
                        <Typography variant="body1">{config.label}</Typography>
                        <Typography variant="caption" sx={{ color: '#ccc' }}>
                          {config.description}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Senha"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                sx={{
                  flex: '1 1 200px',
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: '#555' },
                  },
                }}
              />
              
              <TextField
                label="Confirmar Senha"
                type="password"
                value={newUser.confirm_password}
                onChange={(e) => setNewUser(prev => ({ ...prev, confirm_password: e.target.value }))}
                sx={{
                  flex: '1 1 200px',
                  '& .MuiInputLabel-root': { color: '#fff' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: '#555' },
                  },
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ bgcolor: '#1a1a1a', p: 2 }}>
          <Button onClick={() => setCreateUserOpen(false)} sx={{ color: '#ff4b5c' }}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreateUser}
            variant="contained"
            sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
            disabled={!newUser.username || !newUser.first_name || !newUser.last_name || !newUser.email || !newUser.password || !newUser.confirm_password}
          >
            Criar Usuário
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Editar Usuário */}
      <Dialog
        open={editUserOpen}
        onClose={() => setEditUserOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#2a2a2a',
            color: '#fff',
          },
        }}
      >
        <DialogTitle sx={{ bgcolor: '#1a1a1a', color: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EditIcon sx={{ color: '#ff4b5c' }} />
            Editar Usuário
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedUser && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Nome"
                  value={selectedUser.first_name}
                  onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, first_name: e.target.value }) : null)}
                  sx={{
                    flex: '1 1 200px',
                    '& .MuiInputLabel-root': { color: '#fff' },
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#555' },
                    },
                  }}
                />
                
                <TextField
                  label="Sobrenome"
                  value={selectedUser.last_name}
                  onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, last_name: e.target.value }) : null)}
                  sx={{
                    flex: '1 1 200px',
                    '& .MuiInputLabel-root': { color: '#fff' },
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#555' },
                    },
                  }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="E-mail"
                  type="email"
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                  sx={{
                    flex: '1 1 200px',
                    '& .MuiInputLabel-root': { color: '#fff' },
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#555' },
                    },
                  }}
                />
                
                <TextField
                  label="Telefone"
                  value={selectedUser.profile?.phone || ''}
                  onChange={(e) => setSelectedUser(prev => prev ? ({
                    ...prev,
                    profile: {
                      ...prev.profile!,
                      phone: e.target.value
                    }
                  }) : null)}
                  sx={{
                    flex: '1 1 200px',
                    '& .MuiInputLabel-root': { color: '#fff' },
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      '& fieldset': { borderColor: '#555' },
                    },
                  }}
                />
              </Box>
              
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#fff' }}>Nível de Permissão</InputLabel>
                <Select
                  value={selectedUser.profile?.role || 'viewer'}
                  onChange={(e) => setSelectedUser(prev => prev ? ({
                    ...prev,
                    profile: {
                      ...prev.profile!,
                      role: e.target.value as 'admin' | 'editor' | 'viewer'
                    }
                  }) : null)}
                  sx={{ 
                    color: '#fff', 
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                  }}
                  label="Nível de Permissão"
                >
                  {Object.entries(roleConfig).map(([role, config]) => (
                    <MenuItem key={role} value={role}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ color: config.color }}>{config.icon}</Box>
                        <Box>
                          <Typography variant="body1">{config.label}</Typography>
                          <Typography variant="caption" sx={{ color: '#ccc' }}>
                            {config.description}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ bgcolor: '#1a1a1a', p: 2 }}>
          <Button onClick={() => setEditUserOpen(false)} sx={{ color: '#ff4b5c' }}>
            Cancelar
          </Button>
          <Button 
            onClick={handleEditUser}
            variant="contained"
            sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
          >
            Salvar Alterações
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar para notificações */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
