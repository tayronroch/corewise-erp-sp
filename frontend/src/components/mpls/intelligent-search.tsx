import React, { useState, useEffect, useCallback } from 'react';
import { mplsService } from '../../services/mplsService';
import type { SearchResult, SearchSuggestion } from '../../services/mplsService';
import './intelligent-search.css';

interface SearchHighlight {
  text: string;
  line_number: number;
}

interface IntelligentSearchProps {
  onResultsChange?: (results: SearchResult[]) => void;
  className?: string;
}

const IntelligentSearchComponent: React.FC<IntelligentSearchProps> = ({ 
  onResultsChange, 
  className = '' 
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'auto' | 'full_text' | 'ip' | 'mac' | 'vlan' | 'interface' | 'serial' | 'vpn'>('auto');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const detectSearchType = (searchQuery: string): string => {
    return mplsService.detectSearchType(searchQuery);
  };

  const loadSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const suggestionData = await mplsService.getSearchSuggestions(searchQuery);
      setSuggestions(suggestionData);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Error loading suggestions:', err);
    }
  }, []);

  const performSearch = useCallback(async (searchQuery: string, type: string = 'auto') => {
    if (!searchQuery.trim()) {
      setResults([]);
      onResultsChange?.([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const searchResults = await mplsService.intelligentSearch(searchQuery, type);
      setResults(searchResults);
      onResultsChange?.(searchResults);
      setShowSuggestions(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      onResultsChange?.([]);
    } finally {
      setLoading(false);
    }
  }, [onResultsChange]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) {
        loadSuggestions(query);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, loadSuggestions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, searchType);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.term);
    performSearch(suggestion.term, suggestion.type);
  };

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result);
  };

  const formatDate = (dateString: string) => {
    return mplsService.formatDate(dateString);
  };

  const renderSearchHighlights = (highlights: SearchHighlight[]) => {
    return highlights.map((highlight, index) => (
      <div key={index} className="search-highlight">
        <span className="line-number">Line {highlight.line_number}:</span>
        <pre dangerouslySetInnerHTML={{ __html: highlight.text }} />
      </div>
    ));
  };

  return (
    <div className={`intelligent-search ${className}`}>
      <div className="search-header">
        <h2>Busca Inteligente MPLS</h2>
        <p className="search-description">
          Digite IPs, MACs, VPN IDs, VLANs, interfaces, seriais ou texto livre
        </p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-container">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: 192.168.1.1, GigabitEthernet0/1, VPN123, Serial ABC123..."
            className="search-input"
            disabled={loading}
          />
          
          {query && (
            <div className="search-type-indicator">
              Tipo detectado: <strong>{detectSearchType(query)}</strong>
            </div>
          )}
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <span className="suggestion-term">{suggestion.term}</span>
                  <span className="suggestion-type">{suggestion.type}</span>
                  <span className="suggestion-count">{suggestion.count} resultados</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="search-controls">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as any)}
            className="search-type-select"
            disabled={loading}
          >
            <option value="auto">Detecção Automática</option>
            <option value="full_text">Busca Textual</option>
            <option value="ip">Endereço IP</option>
            <option value="mac">Endereço MAC</option>
            <option value="vlan">VLAN</option>
            <option value="interface">Interface</option>
            <option value="serial">Número de Série</option>
            <option value="vpn">VPN ID</option>
          </select>
          
          <button type="submit" disabled={loading || !query.trim()} className="search-button">
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <h3>Resultados da Busca ({results.length})</h3>
          </div>
          
          <div className="results-grid">
            {results.map((result) => (
              <div
                key={result.id}
                className={`card result-card ${selectedResult?.id === result.id ? 'selected' : ''}`}
                onClick={() => handleResultClick(result)}
              >
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-8">
                      <h5 className="card-title">
                        {result.customers && result.customers.length > 0 && (
                          <span className="customer-highlight">{result.customers[0]}</span>
                        )}
                      </h5>
                      <h6 className="text-muted">{result.equipment_name}</h6>
                      <p className="card-text">
                        <i className="fas fa-map-marker-alt me-2"></i>{result.equipment_location || 'N/A'}
                        <br/>
                        <i className="fas fa-network-wired me-2"></i>{result.loopback_ip || 'N/A'}
                        <br/>
                        {result.vpn_id && result.neighbor_ip && (
                          <>
                            <i className="fas fa-sitemap me-2"></i>VPN {result.vpn_id} → {result.neighbor_ip}
                            {result.neighbor_hostname && (
                              <span className="text-success"> ({result.neighbor_hostname})</span>
                            )}
                            <br/>
                          </>
                        )}
                        {result.group_name && (
                          <>
                            <i className="fas fa-users me-2"></i><strong>Destino:</strong> {result.group_name}
                            <br/>
                          </>
                        )}
                        {result.access_interface && (
                          <>
                            <i className="fas fa-ethernet me-2"></i><strong>Interface:</strong> {result.access_interface}
                            {result.access_interface.includes('ten-gigabit') && (
                              <span className="text-muted"> (physical - 10G)</span>
                            )}
                            <br/>
                          </>
                        )}
                        {result.encapsulation && (
                          <>
                            <i className="fas fa-layer-group me-2"></i><strong>Encapsulamento:</strong> 
                            <span className="badge bg-secondary me-2">
                              {result.encapsulation.includes('qinq') ? 'Qinq' : 'VLAN'}
                            </span>
                            {result.encapsulation.replace('qinq:', '')}
                            <br/>
                          </>
                        )}
                        {result.description && (
                          <>
                            <i className="fas fa-comment me-2"></i><strong>Descrição:</strong> {result.description}
                            <br/>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="col-md-4 text-end">
                      <span className="badge bg-info equipment-badge">VPN</span>
                      {result.vpn_id && (
                        <>
                          <br/>
                          <small className="text-muted">PW: vlan ({result.vpn_id})</small>
                        </>
                      )}
                      <br/><br/>
                      {result.backup_date && (
                        <small className="text-muted">
                          <i className="fas fa-clock me-1"></i>
                          Último backup: {formatDate(result.backup_date)}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedResult && (
        <div className="selected-result-details">
          <div className="details-header">
            <h3>Detalhes da Configuração</h3>
            <button 
              onClick={() => setSelectedResult(null)}
              className="close-details"
            >
              ×
            </button>
          </div>
          
          <div className="configuration-content">
            <div className="config-info">
              <h4>{selectedResult.equipment_name}</h4>
              <p><strong>Local:</strong> {selectedResult.equipment_location}</p>
              <p><strong>Backup:</strong> {formatDate(selectedResult.backup_date)}</p>
            </div>
            
            <div className="raw-config">
              <h5>Configuração Completa:</h5>
              <pre className="config-text">
                {selectedResult.raw_config}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentSearchComponent;