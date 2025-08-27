import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Fade,
  IconButton,
  Divider,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Settings as ConfigIcon,
  Speed as SpeedIcon,
  Business as BusinessIcon,
  Router as RouterIcon,
  AccountTree as VpnIcon,
  Cable as InterfaceIcon,
} from '@mui/icons-material';
import { customerSearchManager, type OptimizedCustomerResult } from '../../services/customerSearchManager';

interface OptimizedCustomerSearchProps {
  onResultSelect?: (result: OptimizedCustomerResult) => void;
  onViewDetails?: (customerId: number) => void;
  onViewConfigurations?: (customerId: number) => void;
  fallbackSearch?: (query: string) => Promise<void>;
}

export default function OptimizedCustomerSearch({ 
  onResultSelect,
  onViewDetails,
  onViewConfigurations,
  fallbackSearch 
}: OptimizedCustomerSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<OptimizedCustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalFound, setTotalFound] = useState(0);

  // Debounce da busca
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setResults([]);
        setTotalFound(0);
        setSearchTime(null);
        return;
      }

      setIsSearching(true);
      setError(null);
      const startTime = Date.now();

      try {
        console.log('🔍 Iniciando busca otimizada...');
        const response = await customerSearchManager.searchCustomers(query, 50);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        setResults(response.results);
        setTotalFound(response.total_found);
        setSearchTime(duration);
        
        console.log(`✅ Busca concluída em ${duration}ms`);

      } catch (err: any) {
        console.error('❌ Erro na busca otimizada:', err);
        
        if (err.message === 'FALLBACK_NEEDED' && fallbackSearch) {
          console.log('🔄 Tentando busca com fallback...');
          setError('Sistema otimizado indisponível. Usando busca tradicional...');
          try {
            await fallbackSearch(query);
          } catch (fallbackError) {
            setError('Erro na busca. Tente novamente.');
          }
        } else if (err.name !== 'AbortError') {
          setError('Erro na busca. Verifique sua conexão.');
        }
        
        setResults([]);
        setTotalFound(0);
        setSearchTime(null);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [fallbackSearch]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    
    // Cleanup: cancelar busca em andamento
    return () => {
      customerSearchManager.cancelCurrentSearch();
    };
  }, [searchQuery, debouncedSearch]);

  const handleViewDetails = async (customerId: number) => {
    if (onViewDetails) {
      onViewDetails(customerId);
    }
  };

  const handleViewConfigurations = async (customerId: number) => {
    if (onViewConfigurations) {
      onViewConfigurations(customerId);
    }
  };

  const formatOccurrences = (count: number) => {
    return count === 1 ? '1 ocorrência' : `${count} ocorrências`;
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1200, margin: '0 auto' }}>
      {/* Campo de busca */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SpeedIcon sx={{ color: 'primary.main' }} />
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Digite o nome do cliente (mín. 2 caracteres) - Busca ultra-rápida!"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: isSearching ? (
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                ) : (
                  <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#f8f9fa',
                  '&.Mui-focused': {
                    backgroundColor: '#fff',
                  },
                },
              }}
            />
            {searchTime !== null && (
              <Chip 
                label={`${searchTime}ms`} 
                color="success" 
                size="small"
                icon={<SpeedIcon />}
              />
            )}
          </Box>

          {/* Estatísticas da busca */}
          {(totalFound > 0 || searchQuery.length >= 2) && !isSearching && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {totalFound > 0 ? `${totalFound} cliente(s) encontrado(s)` : 'Nenhum resultado'}
              </Typography>
              {searchTime && searchTime < 200 && (
                <Chip 
                  label="Ultra-rápido!" 
                  color="success" 
                  size="small" 
                  variant="outlined"
                />
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Mensagem de erro */}
      {error && (
        <Fade in={true}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        </Fade>
      )}

      {/* Resultados da busca */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {results.map((result, index) => (
          <Fade in={true} timeout={300 + (index * 100)} key={result.id}>
            <Card 
              sx={{ 
                cursor: onResultSelect ? 'pointer' : 'default',
                '&:hover': onResultSelect ? {
                  boxShadow: 3,
                  transform: 'translateY(-2px)',
                } : {},
                transition: 'all 0.2s ease-in-out',
              }}
              onClick={() => onResultSelect && onResultSelect(result)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {/* Info principal */}
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <BusinessIcon color="primary" />
                      <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                        {result.name}
                      </Typography>
                      <Chip 
                        label={formatOccurrences(result.total_occurrences)}
                        color="primary" 
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>

                    {/* Estatísticas detalhadas */}
                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <RouterIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {result.equipment_count} equipamento(s)
                        </Typography>
                      </Box>

                      {result.vpn_count > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <VpnIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {result.vpn_count} VPN(s)
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <InterfaceIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {result.interface_count} interface(s)
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Equipamentos */}
                    {result.equipments.length > 0 && (
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Equipamentos:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {result.equipments.slice(0, 3).map((equipment, idx) => (
                            <Chip 
                              key={idx}
                              label={equipment}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          ))}
                          {result.equipments.length > 3 && (
                            <Chip 
                              label={`+${result.equipments.length - 3} mais`}
                              size="small"
                              color="secondary"
                              sx={{ fontSize: '0.75rem' }}
                            />
                          )}
                        </Box>
                      </Box>
                    )}
                  </Box>

                  {/* Botões de ação */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(result.id);
                      }}
                      sx={{ 
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'primary.dark' }
                      }}
                    >
                      <ViewIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewConfigurations(result.id);
                      }}
                      sx={{ 
                        bgcolor: 'secondary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'secondary.dark' }
                      }}
                    >
                      <ConfigIcon />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Fade>
        ))}
      </Box>

      {/* Estado vazio */}
      {!isSearching && searchQuery.length >= 2 && results.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <BusinessIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Nenhum cliente encontrado
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Tente usar termos diferentes ou verificar a ortografia
          </Typography>
        </Box>
      )}

      {/* Dica de uso */}
      {searchQuery.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <SpeedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" color="primary.main" gutterBottom>
            Busca Ultra-Rápida de Clientes
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Sistema otimizado - resultados em menos de 200ms!
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Digite pelo menos 2 caracteres para começar
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// Função debounce
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}