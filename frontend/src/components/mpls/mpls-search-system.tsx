// Ajustes leves: títulos mais escuros e cartões com shadow sutil
import React, { useState, useEffect } from 'react';
import { mplsService, type SearchResult } from '../../services/mplsService';

interface SearchFilters { query:string; equipment:string; location:string; service_type:string; }

const MplsSearchSystem: React.FC = () => {
  const [filters, setFilters] = useState<SearchFilters>({ query: '', equipment: '', location: '', service_type: '' });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [groupedByEquipment, setGroupedByEquipment] = useState<Record<string, SearchResult[]>>({});
  const [expandedEquipments, setExpandedEquipments] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(()=>{ if(filters.query.length>=2){ loadSuggestions(); } else { setSuggestions([]); setShowSuggestions(false);} }, [filters.query]);

  const loadSuggestions = async () => { try { const s = await mplsService.getSearchSuggestions(filters.query); setSuggestions(s.map(x=>x.term)); setShowSuggestions(true);} catch{} };

  const handleSearch = async () => {
    if (!filters.query.trim()) return;
    setIsLoading(true);
    setCurrentPage(1); // Reset para primeira página
    try {
      console.log('🔍 Buscando por:', filters.query);
      const data = await mplsService.intelligentSearch(filters.query);
      console.log('📊 Dados recebidos:', data);
      
      // Remover duplicatas baseado em vpn_id + equipment_name
      const uniqueData = data.filter((item, index, self) => 
        index === self.findIndex(t => 
          t.vpn_id === item.vpn_id && t.equipment_name === item.equipment_name
        )
      );
      console.log('🔄 Dados únicos após filtro:', uniqueData);
      
      setResults(uniqueData);
      setTotalResults(uniqueData.length);
      setTotalPages(Math.ceil(uniqueData.length / pageSize));
      
      // Agrupar por equipamento
      const groups: Record<string, SearchResult[]> = {};
      for (const r of uniqueData) { 
        const k = r.equipment_name || 'Sem equipamento'; 
        if (!groups[k]) groups[k] = []; 
        groups[k].push(r);
      }
      console.log('🏗️ Grupos criados:', groups);
      setGroupedByEquipment(groups);
      
      const init: Record<string, boolean> = {}; 
      Object.keys(groups).forEach(k => init[k] = false); 
      setExpandedEquipments(init);
    } catch (error) {
      console.error('❌ Erro na busca:', error);
    } finally { 
      setIsLoading(false); 
    }
  };

  // Função para obter resultados paginados
  const getPaginatedResults = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Converter grupos para array e aplicar paginação
    const equipmentArray = Object.entries(groupedByEquipment);
    const paginatedEquipment = equipmentArray.slice(startIndex, endIndex);
    
    return Object.fromEntries(paginatedEquipment);
  };

  // Função para mudar de página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll para o topo dos resultados
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Função para mudar tamanho da página
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    setTotalPages(Math.ceil(totalResults / newPageSize));
  };

  const formatDate = (v?:string) => v? new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';

  // Obter resultados da página atual
  const currentPageResults = getPaginatedResults();
  const hasResults = Object.keys(currentPageResults).length > 0;

  return (
    <div className="max-w-7xl mx-auto p-1 md:p-0">
      <div className="text-center space-y-1 mb-2">
        <h2 className="text-2xl font-semibold text-slate-900 flex items-center justify-center gap-2"><i className="fas fa-search text-slate-500"/>Busca MPLS</h2>
        <p className="text-slate-600">Encontre clientes e equipamentos na sua rede MPLS</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-5">
          <form onSubmit={(e)=>{e.preventDefault(); handleSearch();}} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="query" className="text-sm font-medium text-slate-800">Busca Geral</label>
                <div className="relative">
                  <input id="query" value={filters.query} onChange={(e)=>setFilters(p=>({...p, query:e.target.value}))} placeholder="Ex: VELOCINET, 3502, lag-11" className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
                  {showSuggestions && suggestions.length>0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow">
                      {suggestions.map((s,i)=> (
                        <button key={i} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={()=>{setFilters(prev=>({...prev, query:s})); setShowSuggestions(false); handleSearch();}}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                <small className="text-slate-500">Busca por cliente, VPN ID, interface ou encapsulamento</small>
              </div>
              <div className="space-y-1">
                <label htmlFor="equipment" className="text-sm font-medium text-slate-800">Equipamento</label>
                <input id="equipment" value={filters.equipment} onChange={(e)=>setFilters(p=>({...p, equipment:e.target.value}))} placeholder="Ex: PI-TERESINA" className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="location" className="text-sm font-medium text-slate-800">Localização</label>
                <input id="location" value={filters.location} onChange={(e)=>setFilters(p=>({...p, location:e.target.value}))} placeholder="Ex: PI-TERESINA" className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" />
              </div>
              <div className="space-y-1">
                <label htmlFor="service_type" className="text-sm font-medium text-slate-800">Tipo de Serviço</label>
                <select id="service_type" value={filters.service_type} onChange={(e)=>setFilters(p=>({...p, service_type:e.target.value}))} className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
                  <option value="">Todos</option>
                  {['data','voice','video','internet','vpn','metro','backbone'].map(o=> <option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 justify-between">
              <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" disabled={isLoading}><i className="fas fa-search"/>{isLoading?'Buscando...':'Buscar'}</button>
              <div className="flex items-center gap-2">
                <a href="/customer-report" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 text-white hover:bg-cyan-700"><i className="fas fa-user"/>Relatório de Cliente</a>
                <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300" onClick={()=>{ setFilters({query:'',equipment:'',location:'',service_type:''}); setResults([]); setGroupedByEquipment({}); setCurrentPage(1); setTotalPages(1); setTotalResults(0);}}> <i className="fas fa-times"/>Limpar Filtros</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {results.length>0 && (
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">Resultados da Busca</h4>
            <span className="text-sm text-slate-600">
              {Object.keys(groupedByEquipment).length} equipamentos • {results.length} serviços
              {totalPages > 1 && (
                <span className="ml-2 text-blue-600">
                  • Página {currentPage} de {totalPages}
                </span>
              )}
            </span>
          </div>

          {/* Controles de paginação */}
          {totalPages > 1 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Mostrar:</span>
                <select 
                  value={pageSize} 
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border border-slate-300 rounded-md px-2 py-1 text-sm"
                >
                  <option value={5}>5 por página</option>
                  <option value={10}>10 por página</option>
                  <option value={20}>20 por página</option>
                  <option value={50}>50 por página</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <i className="fas fa-angle-double-left"></i>
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <i className="fas fa-angle-left"></i>
                </button>
                
                <span className="text-sm text-slate-600">
                  Página {currentPage} de {totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <i className="fas fa-angle-right"></i>
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <i className="fas fa-angle-double-right"></i>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {Object.entries(currentPageResults).map(([equipment, services]) => {
              const first = services[0];
              return (
                <div key={equipment} className="border border-slate-200 rounded-xl shadow-sm bg-white">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h5 className="font-semibold">{first.customers?.[0] || 'Cliente'}</h5>
                      <h6 className="text-slate-700">{equipment}</h6>
                      <div className="text-slate-500 text-sm flex items-center gap-2"><i className="fas fa-map-marker-alt"/> {first.equipment_location || 'Sem localização'} <span className="mx-2">•</span> <i className="fas fa-network-wired"/> {first.loopback_ip || 'N/A'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-slate-500">{services.length} serviço{services.length!==1?'s':''}</div>
                      <button type="button" className="px-3 py-1 rounded-md text-sm bg-slate-100 hover:bg-slate-200 text-slate-700" onClick={()=> setExpandedEquipments(prev=>({...prev, [equipment]: !prev[equipment]}))}>
                        {expandedEquipments[equipment] ? 'Recolher' : 'Expandir'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Cabeçalho de colunas */}
                    <div className="hidden md:grid md:grid-cols-6 text-xs font-medium text-slate-500 border-b border-slate-200 pb-2">
                      <div className="md:col-span-2">VPN / Destino</div>
                      <div className="md:col-span-2">Interface / Velocidade</div>
                      <div>Encapsulamento</div>
                      <div className="text-right">Backup</div>
                    </div>

                    {(expandedEquipments[equipment] ? services : services.slice(0, 10)).map((result, idx) => {
                      const enc = result.encapsulation || '';
                      const encType = enc.includes('qinq') ? 'qinq' : 'vlan';
                      const encValue = enc.replace(/^qinq:\s*/i, '').replace(/^vlan:\s*/i, '');
                      const interfaceSpeed = result.access_interface?.includes('hundred-gigabit') ? '100G' : 
                                           result.access_interface?.includes('twenty-five-g') ? '25G' : 
                                           result.access_interface?.includes('ten-gigabit') ? '10G' : '';
                      return (
                        <div key={idx} className={`py-3 grid grid-cols-1 md:grid-cols-6 gap-3 items-start text-sm ${idx % 2 === 0 ? 'bg-slate-50' : ''} md:bg-transparent md:hover:bg-slate-50 rounded-md px-2 md:px-0`}>
                          <div className="md:col-span-2 flex items-center gap-2 text-slate-700">
                            <i className="fas fa-sitemap text-slate-400"></i>
                            <span className="font-medium">VPN {result.vpn_id || 'N/A'}</span>
                            <div className="flex flex-col">
                              <span className="text-slate-600">→ {result.neighbor_ip}</span>
                              {result.neighbor_hostname && (
                                <span className="text-emerald-600 text-xs">({result.neighbor_hostname})</span>
                              )}
                            </div>
                          </div>
                          <div className="md:col-span-2 flex items-center gap-2 text-slate-700">
                            <i className="fas fa-ethernet text-slate-400"></i>
                            <div className="flex flex-col">
                              <span className="font-mono text-xs">{result.access_interface || '-'}</span>
                              {interfaceSpeed && (
                                <span className="text-slate-500 text-xs">({interfaceSpeed})</span>
                              )}
                            </div>
                          </div>
                          <div className="md:col-span-1 flex items-center gap-2 text-slate-700">
                            <i className="fas fa-layer-group text-slate-400"></i>
                            <span className="inline-flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 uppercase ring-1 ring-inset ring-blue-200">{encType}</span>
                              <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-700">{encValue || '-'}</span>
                            </span>
                          </div>
                          <div className="md:col-span-1 text-right text-slate-500">
                            {result.backup_date && <span className="text-xs">{formatDate(result.backup_date)}</span>}
                          </div>
                        </div>
                      );
                    })}

                    {!expandedEquipments[equipment] && services.length>10 && (
                      <div className="pt-3 text-center">
                        <button type="button" className="px-4 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm" onClick={()=> setExpandedEquipments(prev=>({...prev, [equipment]: true}))}>Ver todos os {services.length} serviços</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação inferior */}
          {totalPages > 1 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <i className="fas fa-angle-double-left"></i>
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <i className="fas fa-angle-left"></i>
              </button>
              
              {/* Números das páginas */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 rounded-md text-sm border ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <i className="fas fa-angle-right"></i>
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-md text-sm border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <i className="fas fa-angle-double-right"></i>
              </button>
            </div>
          )}
        </div>
      )}

      {!filters.query && results.length===0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-4 text-slate-700">
          <i className="fas fa-lightbulb mr-2 text-amber-500"></i>
          <strong>Dicas de Busca:</strong>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Digite o nome do cliente (ex: VELOCINET, DIGITALNET, ULTRANET)</li>
            <li>Busque por VPN ID numérica (ex: 3502, 3651, 634)</li>
            <li>Procure por interface (ex: lag-11, ten-gigabit-ethernet-1/1/4)</li>
            <li>Busque por tipo de encapsulamento (ex: qinq, vlan)</li>
            <li>Use filtros de equipamento para refinar a busca</li>
            <li>Busque por localização (ex: PI-TERESINA, MA-TIMON)</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default MplsSearchSystem;