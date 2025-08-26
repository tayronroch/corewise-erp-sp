// MplsSearchSystem — versão limpa e sem duplicidades de LAG/LOCAL/REMOTA
import React, { useEffect, useMemo, useState } from 'react';
import { mplsService, type SearchResult } from '../../services/mplsService';

interface SearchFilters { query: string; equipment: string; service_type: string; }

const MplsSearchSystem: React.FC = () => {
  const [filters, setFilters] = useState<SearchFilters>({ query: '', equipment: '', service_type: '' });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // paginação por grupo (equipamento)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sugestões de busca
  useEffect(() => {
    const run = async () => {
      if (filters.query.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const s = await mplsService.getSearchSuggestions(filters.query.trim());
        setSuggestions((s || []).map((x: any) => x.term));
        setShowSuggestions(true);
      } catch {
        /* silencioso */
      }
    };
    run();
  }, [filters.query]);

  const handleSearch = async () => {
    if (!filters.query.trim() && !filters.equipment.trim()) return;
    setIsLoading(true);
    setCurrentPage(1);
    try {
      let data: SearchResult[] = [];
      if (filters.equipment.trim()) {
        data = await mplsService.intelligentSearch('', 'auto', filters.equipment.trim());
      } else {
        data = await mplsService.intelligentSearch(filters.query.trim());
      }
      // remover duplicatas por (vpn_id + equipment_name)
      const unique = data.filter((item, idx, self) => idx === self.findIndex(t => t.vpn_id === item.vpn_id && t.equipment_name === item.equipment_name));
      setResults(unique);
    } catch {
      /* silencioso */
    } finally {
      setIsLoading(false);
    }
  };

  // Agrupar por equipamento
  const grouped = useMemo(() => {
    const g: Record<string, SearchResult[]> = {};
    for (const r of results) {
      const k = (r as any).equipment_name || 'Sem equipamento';
      if (!g[k]) g[k] = [];
      g[k].push(r);
    }
    return g;
  }, [results]);

  const equipments = useMemo(() => Object.keys(grouped), [grouped]);
  const totalPages = Math.max(1, Math.ceil(equipments.length / pageSize));
  const paginatedEquipments = useMemo(
    () => equipments.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize),
    [equipments, currentPage, pageSize]
  );

  const formatDate = (v?: string) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  // Helpers visuais
  const Chip: React.FC<{ children: React.ReactNode; tone?: 'blue' | 'slate' | 'green' | 'purple' | 'indigo' | 'amber' }> = ({ children, tone = 'slate' }) => (
    <span className={[
      'px-2 py-0.5 rounded text-xs ring-1 ring-inset',
      tone === 'blue' && 'bg-blue-100 text-blue-800 ring-blue-200',
      tone === 'slate' && 'bg-slate-200 text-slate-700 ring-slate-300',
      tone === 'green' && 'bg-green-100 text-green-800 ring-green-200',
      tone === 'purple' && 'bg-purple-100 text-purple-800 ring-purple-200',
      tone === 'indigo' && 'bg-indigo-100 text-indigo-800 ring-indigo-200',
      tone === 'amber' && 'bg-amber-100 text-amber-800 ring-amber-200',
    ].filter(Boolean).join(' ')}>{children}</span>
  );

  // Bloco consolidado de interface (LOCAL/REMOTA) com anti-duplicação
  const InterfaceBlock: React.FC<{ label: 'LOCAL' | 'REMOTA'; itf?: any; fallbackLag?: string; result?: any }> = ({ label, itf, fallbackLag, result }) => {
    if (!itf) return null;

    const rawName: string | undefined = itf?.name;
    const computedLag: string | undefined = itf?.details?.lag_id || (fallbackLag && fallbackLag.startsWith('lag-') ? fallbackLag : undefined);
    const lagId = computedLag && computedLag.trim() !== '' ? computedLag : undefined;

    const capacity = itf?.capacity && itf.capacity !== 'N/A' ? itf.capacity : undefined;

    // Membros das LAGs - usando tanto array antigo quanto novo formato
    const membersArr: string[] = Array.isArray(itf?.details?.lag_members) ? itf.details.lag_members : [];
    const members = Array.from(new Set(membersArr.filter(m => m && m !== rawName)));

    // Informações detalhadas dos membros físicos (nova implementação)
    const physicalMembers = itf?.details?.physicalMembers;
    const membersSummary = itf?.details?.membersSummary;

    const showName = !!rawName && rawName !== lagId; // não repetir lag-14 como nome

    const tone = label === 'LOCAL' ? 'blue' : 'purple';

    // Cliente identificado na interface remota
    const customerName = label === 'REMOTA' ? result?.neighbor_customer_name : null;
    const interfaceDescription = label === 'REMOTA' ? result?.neighbor_interface_description : itf?.description;

    return (
      <div className={`text-xs ${label === 'LOCAL' ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-purple-600 bg-purple-50 border-purple-200'} px-2 py-1 rounded border`}>
        <div className="flex flex-wrap items-center gap-1">
          <i className="fas fa-ethernet" />
          <span className="font-medium">{label}:</span>
          {lagId && <span className="ml-1"><Chip tone="purple">{lagId}</Chip></span>}
          {capacity && <span className="ml-1"><Chip tone={tone as any}>{capacity}</Chip></span>}
          {showName && (
            <span className="ml-1 inline-flex items-center gap-1 text-slate-700">
              <i className="fas fa-link" /> {rawName}
            </span>
          )}
          {customerName && customerName !== 'N/A' && (
            <span className="ml-1"><Chip tone="green">{customerName}</Chip></span>
          )}
        </div>

        {/* Exibir membros das LAGs com detalhes */}
        {physicalMembers && physicalMembers.length > 0 && (
          <div className="mt-1 text-xs text-slate-600 border-t border-slate-300 pt-1">
            <span className="font-medium">Membros Físicos:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {physicalMembers.map((member: any, idx: number) => (
                <div key={idx} className="bg-white border border-slate-200 rounded px-1 py-0.5">
                  <span className="font-mono text-xs">{member.interface}</span>
                  <span className="text-slate-500"> ({member.speed})</span>
                  {member.customer && member.customer !== 'N/A' && (
                    <span className="ml-1 text-green-600">→ {member.customer}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback para membros simples (formato antigo) */}
        {!physicalMembers && members.length > 0 && (
          <div className="mt-1 text-xs text-slate-600 border-t border-slate-300 pt-1">
            <span className="font-medium">Membros:</span> {members.join(', ')}
          </div>
        )}

        {/* Descrição da interface remota */}
        {interfaceDescription && interfaceDescription !== 'Interface remota' && (
          <div className="mt-1 text-xs text-slate-500 border-t border-slate-300 pt-1">
            <span className="font-medium">Descrição:</span> {interfaceDescription}
          </div>
        )}

        {/* Nota adicional do sistema */}
        {itf?.details?.note && (
          <div className="mt-1 text-xs text-slate-500 border-t border-slate-300 pt-1">
            <span className="font-medium">Detalhes:</span> {itf.details.note}
          </div>
        )}

      </div>
    );
  };

  // Render
  return (
    <div className="max-w-7xl mx-auto p-1 md:p-0">
      <div className="text-center space-y-1 mb-2">
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center justify-center gap-2"><i className="fas fa-search text-slate-500" />Busca MPLS</h2>
        <p className="text-slate-600">Encontre clientes e equipamentos na sua rede MPLS</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-5">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="query" className="text-sm font-medium text-slate-800">Busca Geral</label>
                <div className="relative">
                  <input id="query" value={filters.query} onChange={(e) => setFilters(p => ({ ...p, query: e.target.value }))} placeholder="Ex: VELOCINET, 3502" className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow">
                      {suggestions.map((s, i) => (
                        <button key={i} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { setFilters(prev => ({ ...prev, query: s })); setShowSuggestions(false); handleSearch(); }}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                <small className="text-slate-500">Busca por cliente, VPN ID, interface ou encapsulamento</small>
              </div>
              <div className="space-y-1">
                <label htmlFor="equipment" className="text-sm font-medium text-slate-800">Equipamento</label>
                <input id="equipment" value={filters.equipment} onChange={(e) => setFilters(p => ({ ...p, equipment: e.target.value }))} placeholder="Ex: PI-TERESINA-PICARRA-PE02" className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="service_type" className="text-sm font-medium text-slate-800">Tipo de Serviço</label>
              <select id="service_type" value={filters.service_type} onChange={(e) => setFilters(p => ({ ...p, service_type: e.target.value }))} className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                <option value="">Todos</option>
                {['data', 'voice', 'video', 'internet', 'vpn', 'metro', 'backbone'].map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 justify-between">
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" disabled={isLoading}><i className="fas fa-search" />{isLoading ? 'Buscando...' : 'Buscar'}</button>
              <div className="flex items-center gap-2">
                <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300" onClick={() => { setFilters({ query: '', equipment: '', service_type: '' }); setResults([]); setCurrentPage(1); }}> <i className="fas fa-times" />Limpar Filtros</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">Resultados da Busca</h4>
            <span className="text-sm text-slate-600">
              {equipments.length} equipamentos • {results.length} serviços {totalPages > 1 && (<span className="ml-2 text-blue-600">• Página {currentPage} de {totalPages}</span>)}
            </span>
          </div>

          {/* Controles de paginação */}
          {totalPages > 1 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Mostrar:</span>
                <select value={pageSize} onChange={(e) => { const ps = Number(e.target.value); setPageSize(ps); setCurrentPage(1); }} className="border border-slate-300 rounded-md px-2 py-1 text-sm">
                  <option value={5}>5 por página</option>
                  <option value={10}>10 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={50}>50 por página</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 hover:bg-slate-50"><i className="fas fa-angle-double-left"></i></button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 hover:bg-slate-50"><i className="fas fa-angle-left"></i></button>
                <span className="text-sm text-slate-600">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 hover:bg-slate-50"><i className="fas fa-angle-right"></i></button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 hover:bg-slate-50"><i className="fas fa-angle-double-right"></i></button>
              </div>
            </div>
          )}

          {/* Lista por equipamento */}
          <div className="space-y-4">
            {paginatedEquipments.map((equipmentKey) => {
              const services = grouped[equipmentKey];
              const first = services[0] as any;
              return (
                <div key={equipmentKey} className="border border-slate-200 rounded-xl shadow-sm bg-white">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h5 className="font-semibold">{equipmentKey}</h5>
                      <div className="text-slate-500 text-sm flex items-center gap-2">
                        <i className="fas fa-map-marker-alt" /> {first?.equipment_location || 'Sem localização'}
                        <span className="mx-2">•</span>
                        <i className="fas fa-network-wired" /> {first?.loopback_ip || 'N/A'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Clientes: {Array.from(new Set(services.flatMap((s: any) => s.customers || []))).join(', ') || 'N/A'}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">{services.length} serviço{services.length !== 1 ? 's' : ''}</div>
                  </div>

                  <div className="p-4 space-y-3">
                    {services.map((result: any, idx: number) => {
                      const enc = result?.encapsulation || '';
                      const encType = enc?.toLowerCase().includes('qinq') ? 'qinq' : 'vlan';
                      const encValue = (enc || '').replace(/^qinq:\s*/i, '').replace(/^vlan:\s*/i, '');
                      const di = result?.destination_info || {};

                      return (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                          {/* Cabeçalho da VPN com Cliente */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <i className="fas fa-sitemap text-slate-500"></i>
                              <span className="font-semibold text-slate-700">VPN {result?.vpn_id || 'N/A'}</span>
                              <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md border border-blue-200 font-medium">
                                {(result?.customers && result.customers.length > 0) ? result.customers.join(', ') : 'Cliente não identificado'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <i className="fas fa-layer-group"></i>
                              <Chip tone="blue">{encType.toUpperCase()}</Chip>
                              <Chip tone="slate">{encValue || '-'}</Chip>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Coluna Esquerda - Status e Destino */}
                            <div className="space-y-2">
                              {/* Status do equipamento */}
                              {!di.isInDatabase && (
                                <div className="text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 text-xs inline-flex items-center gap-1">
                                  <i className="fas fa-exclamation-triangle" /> Equipamento não capturado na base
                                </div>
                              )}
                              {di.isInDatabase && (
                                <div className="text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200 text-xs inline-flex items-center gap-1">
                                  <i className="fas fa-check-circle" /> Equipamento na base
                                </div>
                              )}
                              
                              {/* Informações de destino */}
                              {di.hostname && di.hostname !== 'N/A' && (
                                <div className="text-slate-600 text-sm">
                                  <span className="font-medium">Destino:</span> {di.hostname}
                                </div>
                              )}
                              {di.neighborIp && di.neighborIp !== 'N/A' && (
                                <div className="text-slate-600 text-sm">
                                  <span className="font-medium">IP:</span> {di.neighborIp}
                                </div>
                              )}
                              
                              {/* Data de backup */}
                              {result?.backup_date && (
                                <div className="text-slate-500 text-xs">
                                  <i className="fas fa-clock mr-1"></i>
                                  {formatDate(result.backup_date)}
                                </div>
                              )}
                            </div>

                            {/* Coluna Direita - Interfaces */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-slate-600 border-b border-slate-300 pb-1">
                                Interfaces
                              </div>
                              <InterfaceBlock label="LOCAL" itf={di.localInterface} fallbackLag={result?.access_interface} result={result} />
                              <InterfaceBlock label="REMOTA" itf={di.remoteInterface} result={result} />
                              {!di.localInterface && !di.remoteInterface && (
                                <>
                                  <InterfaceBlock label="LOCAL" itf={di.sideAInterface} fallbackLag={result?.access_interface} result={result} />
                                  <InterfaceBlock label="REMOTA" itf={di.sideBInterface} result={result} />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!filters.query && results.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4 text-slate-700">
          <i className="fas fa-lightbulb mr-2 text-amber-500"></i>
          <strong>Dicas de Busca:</strong>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Digite o nome do cliente (ex: VELOCINET, DIGITALNET, ULTRANET)</li>
            <li>Busque por VPN ID numérica (ex: 3502, 3651, 634)</li>
            <li>Procure por Nome do Host (ex: MA-BREJO-PE01)</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default MplsSearchSystem;
