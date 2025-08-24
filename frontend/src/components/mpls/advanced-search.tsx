import React, { useState, useEffect, useCallback } from 'react';
import { mplsService } from '../../services/mplsService';
import type { AdvancedSearchFilters, SearchResult } from '../../services/mplsService';
import IntelligentSearchComponent from './intelligent-search';
import './advanced-search.css';

interface AdvancedSearchProps {
  className?: string;
  onResultsChange?: (results: SearchResult[]) => void;
}

const AdvancedSearchComponent: React.FC<AdvancedSearchProps> = ({ 
  className = '', 
  onResultsChange 
}) => {
  const [filters, setFilters] = useState<AdvancedSearchFilters>({
    query: '',
    search_type: 'auto',
    equipment_name: '',
    location: '',
    date_from: '',
    date_to: '',
    has_vpws: false,
    has_customer_services: false,
    customer_name: '',
    interface_name: '',
    vlan_id: '',
    ip_address: '',
    limit: 50
  });
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'simple' | 'advanced'>('simple');
  const [showFilters, setShowFilters] = useState(false);

  const performAdvancedSearch = useCallback(async () => {
    if (!filters.query && !filters.equipment_name && !filters.location && !filters.customer_name) {
      setResults([]);
      onResultsChange?.([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const searchResults = await mplsService.advancedSearch(filters);
      setResults(searchResults);
      onResultsChange?.(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Advanced search failed');
      setResults([]);
      onResultsChange?.([]);
    } finally {
      setLoading(false);
    }
  }, [filters, onResultsChange]);

  const handleFilterChange = (key: keyof AdvancedSearchFilters, value: string | boolean | number) => {
    setFilters((prev: AdvancedSearchFilters) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performAdvancedSearch();
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      search_type: 'auto',
      equipment_name: '',
      location: '',
      date_from: '',
      date_to: '',
      has_vpws: false,
      has_customer_services: false,
      customer_name: '',
      interface_name: '',
      vlan_id: '',
      ip_address: '',
      limit: 50
    });
    setResults([]);
    onResultsChange?.([]);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.query) count++;
    if (filters.equipment_name) count++;
    if (filters.location) count++;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    if (filters.has_vpws) count++;
    if (filters.has_customer_services) count++;
    if (filters.customer_name) count++;
    if (filters.interface_name) count++;
    if (filters.vlan_id) count++;
    if (filters.ip_address) count++;
    return count;
  };

  const formatDate = (dateString: string) => {
    return mplsService.formatDate(dateString);
  };

  const exportResults = async () => {
    try {
      setLoading(true);
      await mplsService.exportReport('search', { filters });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`advanced-search ${className}`}>
      <div className="search-header">
        <h2>Sistema de Busca MPLS</h2>
        <div className="search-mode-toggle">
          <button
            className={`mode-button ${searchMode === 'simple' ? 'active' : ''}`}
            onClick={() => setSearchMode('simple')}
          >
            Busca Simples
          </button>
          <button
            className={`mode-button ${searchMode === 'advanced' ? 'active' : ''}`}
            onClick={() => setSearchMode('advanced')}
          >
            Busca Avançada
          </button>
        </div>
      </div>

      {searchMode === 'simple' ? (
        <IntelligentSearchComponent onResultsChange={onResultsChange} />
      ) : (
        <>
          <div className="advanced-search-form">
            <form onSubmit={handleSearch}>
              <div className="form-header">
                <h3>Filtros de Busca</h3>
                <div className="form-actions">
                  <button
                    type="button"
                    className="toggle-filters"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? 'Ocultar' : 'Mostrar'} Filtros ({getActiveFiltersCount()})
                  </button>
                  <button type="button" onClick={clearFilters} className="clear-button">
                    Limpar Tudo
                  </button>
                </div>
              </div>

              <div className="primary-search">
                <div className="search-input-group">
                  <input
                    type="text"
                    value={filters.query}
                    onChange={(e) => handleFilterChange('query', e.target.value)}
                    placeholder="Busca geral (IP, MAC, serial, texto...))"
                    className="primary-input"
                  />
                  <select
                    value={filters.search_type}
                    onChange={(e) => handleFilterChange('search_type', e.target.value)}
                    className="search-type-select"
                  >
                    <option value="auto">Auto</option>
                    <option value="full_text">Texto</option>
                    <option value="ip">IP</option>
                    <option value="mac">MAC</option>
                    <option value="vlan">VLAN</option>
                    <option value="interface">Interface</option>
                    <option value="serial">Serial</option>
                    <option value="vpn">VPN</option>
                  </select>
                </div>
              </div>

              {showFilters && (
                <div className="advanced-filters">
                  <div className="filters-grid">
                    <div className="filter-group">
                      <label>Equipamento</label>
                      <input
                        type="text"
                        value={filters.equipment_name}
                        onChange={(e) => handleFilterChange('equipment_name', e.target.value)}
                        placeholder="Nome do equipamento..."
                      />
                    </div>

                    <div className="filter-group">
                      <label>Localização</label>
                      <input
                        type="text"
                        value={filters.location}
                        onChange={(e) => handleFilterChange('location', e.target.value)}
                        placeholder="Localização do equipamento..."
                      />
                    </div>

                    <div className="filter-group">
                      <label>Cliente</label>
                      <input
                        type="text"
                        value={filters.customer_name}
                        onChange={(e) => handleFilterChange('customer_name', e.target.value)}
                        placeholder="Nome do cliente..."
                      />
                    </div>

                    <div className="filter-group">
                      <label>Interface</label>
                      <input
                        type="text"
                        value={filters.interface_name}
                        onChange={(e) => handleFilterChange('interface_name', e.target.value)}
                        placeholder="Nome da interface..."
                      />
                    </div>

                    <div className="filter-group">
                      <label>VLAN ID</label>
                      <input
                        type="text"
                        value={filters.vlan_id}
                        onChange={(e) => handleFilterChange('vlan_id', e.target.value)}
                        placeholder="ID da VLAN..."
                      />
                    </div>

                    <div className="filter-group">
                      <label>Endereço IP</label>
                      <input
                        type="text"
                        value={filters.ip_address}
                        onChange={(e) => handleFilterChange('ip_address', e.target.value)}
                        placeholder="IP Address..."
                      />
                    </div>

                    <div className="filter-group">
                      <label>Data Inicial</label>
                      <input
                        type="datetime-local"
                        value={filters.date_from}
                        onChange={(e) => handleFilterChange('date_from', e.target.value)}
                      />
                    </div>

                    <div className="filter-group">
                      <label>Data Final</label>
                      <input
                        type="datetime-local"
                        value={filters.date_to}
                        onChange={(e) => handleFilterChange('date_to', e.target.value)}
                      />
                    </div>

                    <div className="filter-group">
                      <label>Limite de Resultados</label>
                      <select
                        value={filters.limit}
                        onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                      >
                        <option value={25}>25 resultados</option>
                        <option value={50}>50 resultados</option>
                        <option value={100}>100 resultados</option>
                        <option value={200}>200 resultados</option>
                      </select>
                    </div>
                  </div>

                  <div className="checkbox-filters">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={filters.has_vpws}
                        onChange={(e) => handleFilterChange('has_vpws', e.target.checked)}
                      />
                      <span className="checkbox-text">Apenas com grupos VPWS</span>
                    </label>

                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={filters.has_customer_services}
                        onChange={(e) => handleFilterChange('has_customer_services', e.target.checked)}
                      />
                      <span className="checkbox-text">Apenas com serviços de cliente</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="search-actions">
                <button type="submit" disabled={loading} className="search-button">
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
                {results.length > 0 && (
                  <button type="button" onClick={exportResults} className="export-button">
                    Exportar Resultados
                  </button>
                )}
              </div>
            </form>
          </div>

          {error && (
            <div className="error-message">
              <strong>Erro:</strong> {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="search-results">
              <div className="results-header">
                <h3>Resultados da Busca Avançada ({results.length})</h3>
                <div className="results-summary">
                  {getActiveFiltersCount() > 0 && (
                    <span className="active-filters">
                      {getActiveFiltersCount()} filtros ativos
                    </span>
                  )}
                </div>
              </div>
              
              <div className="results-list">
                {results.map((result) => (
                  <div key={result.id} className="result-item">
                    <div className="result-main">
                      <div className="result-header">
                        <h4 className="equipment-name">{result.equipment_name}</h4>
                        <span className="backup-date">{formatDate(result.backup_date)}</span>
                      </div>
                      
                      <div className="result-details">
                        <div className="detail-row">
                          <strong>Localização:</strong> {result.equipment_location}
                        </div>
                        
                        {result.vpws_groups && result.vpws_groups.length > 0 && (
                          <div className="detail-row">
                            <strong>Grupos VPWS:</strong> {result.vpws_groups.length} grupos
                            <div className="vpws-details">
                              {result.vpws_groups.map((group: any) => (
                                <span key={group.id} className="vpws-tag">
                                  {group.name} ({group.vpns?.length || 0} VPNs)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {result.customer_services && result.customer_services.length > 0 && (
                          <div className="detail-row">
                            <strong>Serviços:</strong> {result.customer_services.length} serviços
                            <div className="services-details">
                              {result.customer_services.map((service: any) => (
                                <span key={service.id} className="service-tag">
                                  {service.customer_name} - {service.service_type}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {result.highlights && result.highlights.length > 0 && (
                      <div className="result-highlights">
                        <strong>Trechos encontrados:</strong>
                        <div className="highlights-list">
                          {result.highlights.map((highlight: any, index: number) => (
                            <div key={index} className="highlight-item">
                              <span className="line-number">Linha {highlight.line_number}:</span>
                              <pre dangerouslySetInnerHTML={{ __html: highlight.text }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdvancedSearchComponent;