import React, { useState, useEffect } from 'react';
import { mplsService } from '../../services/mplsService';
import './mpls-search-system.css';

interface SearchResult {
  id: number;
  customer_name: string;
  equipment_name: string;
  location: string;
  equipment_ip: string;
  vpn_id: number;
  neighbor_ip: string;
  neighbor_equipment: string;
  vpws_group_name: string;
  access_interface: string;
  access_interface_details: {
    type: string;
    speed: string;
    lag_members: string[];
  };
  opposite_interface_details: {
    name: string;
    type: string;
    speed: string;
    lag_members: string[];
  };
  encapsulation: string;
  encapsulation_type: string;
  vpn_description: string;
  service_type: string;
  pw_type: string;
  pw_id: number;
  last_backup: string;
}

interface SearchFilters {
  query: string;
  equipment: string;
  location: string;
  service_type: string;
}

const MplsSearchSystem: React.FC = () => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    equipment: '',
    location: '',
    service_type: ''
  });
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const serviceTypeOptions = [
    'data', 'voice', 'video', 'internet', 'vpn', 'metro', 'backbone'
  ];

  useEffect(() => {
    if (filters.query.length >= 2) {
      loadSuggestions();
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [filters.query]);

  const loadSuggestions = async () => {
    try {
      const suggestions = await mplsService.getSearchSuggestions(filters.query);
      setSuggestions(suggestions.map(s => s.term));
      setShowSuggestions(true);
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
    }
  };

  const handleSearch = async (page: number = 1) => {
    if (!filters.query.trim()) return;
    
    setIsLoading(true);
    setCurrentPage(page);
    
    try {
      const searchResults = await mplsService.intelligentSearch(filters.query);
      setResults(searchResults);
      setTotalResults((searchResults as any).total || searchResults.length);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Erro na busca:', error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (field: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSuggestionClick = (suggestion: string) => {
    setFilters(prev => ({ ...prev, query: suggestion }));
    setShowSuggestions(false);
    handleSearch();
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      equipment: '',
      location: '',
      service_type: ''
    });
    setResults([]);
    setTotalResults(0);
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Data não disponível';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <div className="mpls-search-system">
      <div className="search-header">
        <h2><i className="fas fa-search me-2"></i>Busca MPLS</h2>
        <p className="text-muted">Encontre clientes e equipamentos na sua rede MPLS</p>
      </div>

      {/* Formulário de Busca */}
      <div className="search-form-card">
        <div className="card-body">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
            <div className="row">
              <div className="col-md-6">
                <div className="form-group">
                  <label htmlFor="query">Busca Geral</label>
                  <div className="input-with-suggestions">
                    <input
                      type="text"
                      className="form-control"
                      id="query"
                      value={filters.query}
                      onChange={(e) => handleFilterChange('query', e.target.value)}
                      placeholder="Ex: VELOCINET, 3502, lag-11"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {suggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            className="suggestion-item"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <small className="form-text text-muted">
                    Busca por cliente, VPN ID, interface ou encapsulamento
                  </small>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-group">
                  <label htmlFor="equipment">Equipamento</label>
                  <input
                    type="text"
                    className="form-control"
                    id="equipment"
                    value={filters.equipment}
                    onChange={(e) => handleFilterChange('equipment', e.target.value)}
                    placeholder="Ex: PI-TERESINA"
                  />
                </div>
              </div>
            </div>
            
            <div className="row">
              <div className="col-md-6">
                <div className="form-group">
                  <label htmlFor="location">Localização</label>
                  <input
                    type="text"
                    className="form-control"
                    id="location"
                    value={filters.location}
                    onChange={(e) => handleFilterChange('location', e.target.value)}
                    placeholder="Ex: PI-TERESINA"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-group">
                  <label htmlFor="service_type">Tipo de Serviço</label>
                  <select
                    className="form-control"
                    id="service_type"
                    value={filters.service_type}
                    onChange={(e) => handleFilterChange('service_type', e.target.value)}
                  >
                    <option value="">Todos</option>
                    {serviceTypeOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                <i className="fas fa-search me-2"></i>
                {isLoading ? 'Buscando...' : 'Buscar'}
              </button>
              <div className="action-buttons">
                <a href="/customer-report" className="btn btn-info me-2">
                  <i className="fas fa-user me-2"></i>Relatório de Cliente
                </a>
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  <i className="fas fa-times me-2"></i>Limpar Filtros
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Resultados da Busca */}
      {results.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <h4>Resultados da Busca</h4>
            <span className="results-count">{totalResults} resultado{totalResults !== 1 ? 's' : ''}</span>
          </div>
          
          {results.map((result, index) => (
            <div key={index} className="result-card">
              <div className="result-header">
                <h5 className="customer-name">{result.customer_name || 'Cliente não identificado'}</h5>
                <h6 className="equipment-name">{result.equipment_name}</h6>
                <span className="backup-date">{formatDate(result.last_backup)}</span>
              </div>
              
              <div className="result-content">
                <div className="result-details">
                  <div className="detail-row">
                    <i className="fas fa-map-marker-alt"></i>
                    <span className="label">Localização:</span>
                    <span className="value">{result.location || 'Não especificada'}</span>
                  </div>
                  
                  <div className="detail-row">
                    <i className="fas fa-network-wired"></i>
                    <span className="label">IP:</span>
                    <span className="value">{result.equipment_ip}</span>
                  </div>
                  
                  <div className="detail-row">
                    <i className="fas fa-sitemap"></i>
                    <span className="label">VPN {result.vpn_id || 'N/A'}:</span>
                    <span className="value">
                      → {result.neighbor_ip}
                      {result.neighbor_equipment && (
                        <span className="neighbor-equipment">({result.neighbor_equipment})</span>
                      )}
                    </span>
                  </div>
                  
                  {result.vpws_group_name && (
                    <div className="detail-row">
                      <i className="fas fa-users"></i>
                      <span className="label">Destino:</span>
                      <span className="value">{result.vpws_group_name}</span>
                    </div>
                  )}
                  
                  {result.access_interface && (
                    <div className="detail-row">
                      <i className="fas fa-ethernet"></i>
                      <span className="label">Interface:</span>
                      <span className="value">{result.access_interface}</span>
                      {result.access_interface_details && (
                        <span className="interface-details">
                          ({result.access_interface_details.type || ''}
                          {result.access_interface_details.speed && ` - ${result.access_interface_details.speed}`})
                        </span>
                      )}
                    </div>
                  )}
                  
                  {result.opposite_interface_details && (
                    <div className="detail-row">
                      <i className="fas fa-exchange-alt"></i>
                      <span className="label">Interface Oposta:</span>
                      <span className="value">{result.opposite_interface_details.name}</span>
                      <span className="interface-details">
                        ({result.opposite_interface_details.type || ''}
                        {result.opposite_interface_details.speed && ` - ${result.opposite_interface_details.speed}`})
                      </span>
                    </div>
                  )}
                  
                  {result.encapsulation && (
                    <div className="detail-row">
                      <i className="fas fa-layer-group"></i>
                      <span className="label">Encapsulamento:</span>
                      <span className="encapsulation-badge">
                        {result.encapsulation_type || 'untagged'}
                      </span>
                      <span className="value">{result.encapsulation}</span>
                    </div>
                  )}
                  
                  {result.vpn_description && (
                    <div className="detail-row">
                      <i className="fas fa-comment"></i>
                      <span className="label">Descrição:</span>
                      <span className="value">{result.vpn_description}</span>
                    </div>
                  )}
                </div>
                
                <div className="result-sidebar">
                  <span className="service-type-badge">{result.service_type || 'VPN'}</span>
                  {result.pw_type && (
                    <div className="pw-info">
                      <small>PW: {result.pw_type} ({result.pw_id})</small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instruções quando não há busca */}
      {!filters.query && results.length === 0 && (
        <div className="search-tips">
          <div className="alert alert-light">
            <i className="fas fa-lightbulb me-2"></i>
            <strong>Dicas de Busca:</strong>
            <ul>
              <li>Digite o nome do cliente (ex: VELOCINET, DIGITALNET, ULTRANET)</li>
              <li>Busque por VPN ID numérica (ex: 3502, 3651, 634)</li>
              <li>Procure por interface (ex: lag-11, ten-gigabit-ethernet-1/1/4)</li>
              <li>Busque por tipo de encapsulamento (ex: qinq, vlan)</li>
              <li>Use filtros de equipamento para refinar a busca</li>
              <li>Busque por localização (ex: PI-TERESINA, MA-TIMON)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default MplsSearchSystem;
