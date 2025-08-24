import React, { useState, useEffect, useCallback } from 'react';
import { mplsService } from '../../services/mplsService';
import type { SearchResult, SearchSuggestion } from '../../services/mplsService';

interface SearchHighlight { text: string; line_number: number; }
interface IntelligentSearchProps { onResultsChange?: (r: SearchResult[]) => void; className?: string; }

const IntelligentSearchComponent: React.FC<IntelligentSearchProps> = ({ onResultsChange, className = '' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'auto'|'full_text'|'ip'|'mac'|'vlan'|'interface'|'serial'|'vpn'>('auto');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const detectSearchType = (q: string) => mplsService.detectSearchType(q);

  const loadSuggestions = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      const suggestionData = await mplsService.getSearchSuggestions(q);
      setSuggestions(suggestionData); setShowSuggestions(true);
    } catch {}
  }, []);

  const performSearch = useCallback(async (q: string, type: string = 'auto') => {
    if (!q.trim()) { setResults([]); onResultsChange?.([]); return; }
    setLoading(true); setError(null);
    try {
      const data = await mplsService.intelligentSearch(q, type);
      setResults(data); onResultsChange?.(data); setShowSuggestions(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed'); setResults([]); onResultsChange?.([]);
    } finally { setLoading(false); }
  }, [onResultsChange]);

  useEffect(() => { const t = setTimeout(()=>{ if(query) loadSuggestions(query); }, 300); return ()=>clearTimeout(t); }, [query, loadSuggestions]);

  const formatDate = (d?: string) => mplsService.formatDate(d || '');

  return (
    <div className={`max-w-6xl mx-auto ${className}`}>
      <div className="mb-4 text-center space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">Busca Inteligente MPLS</h2>
        <p className="text-slate-600">Digite IPs, MACs, VPN IDs, VLANs, interfaces, seriais ou texto livre</p>
      </div>

      <form onSubmit={(e)=>{e.preventDefault(); performSearch(query, searchType);}} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Ex: 192.168.1.1, GigabitEthernet0/1, VPN123, Serial ABC123..."
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              disabled={loading}
            />
            {query && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5">
                Tipo: <strong>{detectSearchType(query)}</strong>
              </div>
            )}
            {showSuggestions && suggestions.length>0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow">
                {suggestions.map((s, i) => (
                  <button key={i} type="button" onClick={()=>{setQuery(s.term); performSearch(s.term, s.type);}}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between">
                    <span className="font-medium text-slate-800">{s.term}</span>
                    <span className="text-xs text-slate-500">{s.type} • {s.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <select value={searchType} onChange={(e)=>setSearchType(e.target.value as any)}
              className="border border-slate-300 rounded-md px-3 py-2 text-slate-900">
              <option value="auto">Detecção Automática</option>
              <option value="full_text">Busca Textual</option>
              <option value="ip">Endereço IP</option>
              <option value="mac">Endereço MAC</option>
              <option value="vlan">VLAN</option>
              <option value="interface">Interface</option>
              <option value="serial">Número de Série</option>
              <option value="vpn">VPN ID</option>
            </select>
            <button type="submit" disabled={loading || !query.trim()} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{loading?'Buscando...':'Buscar'}</button>
          </div>
        </div>
      </form>

      {error && <div className="mt-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-md p-3">Erro: {error}</div>}

      {results.length>0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Resultados da Busca ({results.length})</h3>
          </div>

          {results.map((r) => (
            <button key={r.id} onClick={()=>setSelectedResult(r)}
              className="w-full text-left bg-white border border-slate-200 rounded-xl shadow-sm p-4 hover:bg-slate-50">
              <div className="flex flex-wrap gap-6">
                <div className="min-w-[220px]">
                  {r.customers?.[0] && <span className="inline-block text-xs font-semibold uppercase tracking-wide bg-amber-500 text-white px-2.5 py-1 rounded-full">{r.customers[0]}</span>}
                  <h6 className="mt-2 text-slate-900 font-semibold">{r.equipment_name}</h6>
                  <div className="mt-1 space-y-1 text-sm text-slate-700">
                    <div>📍 {r.equipment_location || 'N/A'}</div>
                    <div>🖧 {r.loopback_ip || 'N/A'}</div>
                    {r.vpn_id && (
                      <div>🗺️ VPN {r.vpn_id} → {r.neighbor_ip}{r.neighbor_hostname && (<span className="text-emerald-700"> ({r.neighbor_hostname})</span>)}</div>
                    )}
                    {r.group_name && <div>🎯 Destino: {r.group_name}</div>}
                    {r.access_interface && <div>🔌 Interface: <span className="font-mono">{r.access_interface}</span></div>}
                    {r.encapsulation && (
                      <div>
                        <span className="inline-flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-white">{r.encapsulation.includes('qinq') ? 'Qinq' : 'VLAN'}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-800">{r.encapsulation.replace('qinq:','')}</span>
                        </span>
                      </div>
                    )}
                    {r.description && <div>💬 {r.description}</div>}
                  </div>
                </div>
                <div className="ml-auto text-right text-sm text-slate-700">
                  <span className="inline-block px-2 py-0.5 rounded text-xs bg-cyan-600 text-white">VPN</span>
                  {r.vpn_id && <div className="mt-2">PW: vlan ({r.vpn_id})</div>}
                  {r.backup_date && <div className="mt-4">🕒 Último backup: {formatDate(r.backup_date)}</div>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedResult && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold">Detalhes da Configuração</h3>
            <button onClick={()=>setSelectedResult(null)} className="text-slate-600 hover:text-slate-900">×</button>
          </div>
          <div className="p-4 grid md:grid-cols-2 gap-4">
            <div className="space-y-1 text-sm">
              <h4 className="font-semibold text-slate-900">{selectedResult.equipment_name}</h4>
              <p><strong>Local:</strong> {selectedResult.equipment_location}</p>
              <p><strong>Backup:</strong> {formatDate(selectedResult.backup_date)}</p>
            </div>
            <div className="md:col-span-2">
              <h5 className="font-medium mb-2">Configuração Completa</h5>
              <pre className="text-sm bg-slate-900 text-slate-50 p-3 rounded-md overflow-auto max-h-[50vh]">{selectedResult.raw_config}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentSearchComponent;