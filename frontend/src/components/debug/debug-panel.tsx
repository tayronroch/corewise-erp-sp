import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { localDatabase } from '../../services/database';

interface DatabaseStats {
  totalMaps: number;
  totalItems: number;
  totalConnections: number;
  lastUpdated: string;
  version: string;
  databaseSize: number;
}

interface DebugPanelProps {
  onClose?: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ onClose }) => {
  const [stats, setStats] = React.useState<DatabaseStats | null>(null);

  React.useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    const statistics = localDatabase.getStatistics();
    setStats(statistics);
  };

  const handleExportDatabase = () => {
    const data = localDatabase.exportDatabase();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `corewise-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportDatabase = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const jsonData = event.target?.result as string;
          const success = localDatabase.importDatabase(jsonData);
          
          if (success) {
            alert('Banco de dados importado com sucesso!');
            loadStats();
          } else {
            alert('Erro ao importar banco de dados');
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  };

  const handleClearDatabase = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o banco de dados? Esta ação não pode ser desfeita.')) {
      const success = localDatabase.clearDatabase();
      
      if (success) {
        alert('Banco de dados limpo com sucesso!');
        loadStats();
      } else {
        alert('Erro ao limpar banco de dados');
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card sx={{ 
      position: 'fixed', 
      top: 20, 
      right: 20, 
      width: 400, 
      zIndex: 2000,
      bgcolor: 'background.paper',
      boxShadow: 3 
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <InfoIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Debug Panel - Banco Local
          </Typography>
          {onClose && (
            <Button onClick={onClose} size="small">
              ×
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {stats && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total de Mapas
                </Typography>
                <Typography variant="h6">
                  {stats.totalMaps}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total de Itens
                </Typography>
                <Typography variant="h6">
                  {stats.totalItems}
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total de Conexões
                </Typography>
                <Typography variant="h6">
                  {stats.totalConnections}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Tamanho do BD
                </Typography>
                <Typography variant="h6">
                  {formatBytes(stats.databaseSize)}
                </Typography>
              </Box>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                Última Atualização
              </Typography>
              <Typography variant="body2">
                {new Date(stats.lastUpdated).toLocaleString('pt-BR')}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                Versão
              </Typography>
              <Typography variant="body2">
                {stats.version}
              </Typography>
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            startIcon={<ExportIcon />}
            onClick={handleExportDatabase}
            variant="outlined"
            size="small"
            fullWidth
          >
            Exportar Banco
          </Button>
          
          <Button
            startIcon={<ImportIcon />}
            onClick={handleImportDatabase}
            variant="outlined"
            size="small"
            fullWidth
          >
            Importar Banco
          </Button>
          
          <Button
            startIcon={<ClearIcon />}
            onClick={handleClearDatabase}
            variant="outlined"
            color="error"
            size="small"
            fullWidth
          >
            Limpar Banco
          </Button>
          
          <Button
            startIcon={<StorageIcon />}
            onClick={loadStats}
            variant="outlined"
            size="small"
            fullWidth
          >
            Atualizar Estatísticas
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default DebugPanel; 
