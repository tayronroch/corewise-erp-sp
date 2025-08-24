// Pequenos ajustes de contraste, espaçamento e truncamentos mais seguros
import React, { useState, useEffect, useCallback } from 'react';
import { mplsService } from '../../services/mplsService';
import type { CustomerReportData } from '../../services/mplsService';

interface CustomerReportProps { className?: string; initialCustomer?: string; }

const CustomerReportComponent: React.FC<CustomerReportProps> = ({ className = '', initialCustomer = '' }) => {
  const [customerName, setCustomerName] = useState(initialCustomer);
  const [reportData, setReportData] = useState<CustomerReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadCustomerReport = useCallback(async (customer: string) => {
    if (!customer.trim()) { setReportData(null); return; }
    setLoading(true); setError(null);
    try {
      const data = await mplsService.getCustomerReport(customer);
      setReportData(data);
      if (data.groups.length > 0) setExpandedGroups(new Set([data.groups[0].location]));
    } catch (err:any) { setError(err.message || 'Failed to load customer report'); setReportData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (initialCustomer) loadCustomerReport(initialCustomer); }, [initialCustomer, loadCustomerReport]);

  const toggleGroup = (loc:string) => { const n=new Set(expandedGroups); n.has(loc)?n.delete(loc):n.add(loc); setExpandedGroups(n); };
  const formatBandwidth = (b?:string)=> (b? mplsService.formatBandwidth(b):'-');
  const formatDate = (d?:string)=> (d? mplsService.formatDate(d):'-');

  const filteredGroups = reportData?.groups.filter((g:any)=> !searchTerm || g.location.toLowerCase().includes(searchTerm.toLowerCase()) || g.equipments.some((eq:any)=> eq.name.toLowerCase().includes(searchTerm.toLowerCase()) || eq.interfaces.some((i:any)=> (i.name+i.description).toLowerCase().includes(searchTerm.toLowerCase())))) || [];

  const statusBadge = (s?:string) => {
    const v=(s||'').toLowerCase();
    if (v==='up') return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
    if (v==='down') return 'bg-rose-100 text-rose-800 ring-rose-200';
    if (v==='admin-down') return 'bg-amber-100 text-amber-800 ring-amber-200';
    return 'bg-slate-100 text-slate-800 ring-slate-200';
  };

  return (
    <div className={`max-w-7xl mx-auto ${className}`}>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold text-slate-900">Relatório de Cliente</h2>
        <p className="text-slate-600">Detalhes de equipamentos e interfaces por cliente</p>
      </div>

      <form onSubmit={(e)=>{e.preventDefault(); if(customerName.trim()) loadCustomerReport(customerName.trim());}} className="my-4">
        <div className="mx-auto max-w-xl bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex gap-2">
          <input type="text" value={customerName} onChange={(e)=>setCustomerName(e.target.value)} placeholder="Digite o nome do cliente (ex: MEGALINK)..." className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600" disabled={loading}/>
          <button type="submit" disabled={loading||!customerName.trim()} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{loading?'Carregando...':'Gerar Relatório'}</button>
        </div>
      </form>

      {error && <div className="bg-rose-50 text-rose-800 border border-rose-200 rounded-md p-4">Erro: {error}</div>}

      {reportData && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Cliente: {reportData.customer_name}</h3>
              <div className="flex items-center gap-2">
                <input type="text" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} placeholder="Filtrar equipamentos/interfaces..." className="border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"/>
                <button onClick={async()=>{ if(!customerName.trim()) return; setLoading(true); try{ await mplsService.exportCustomerReportExcel(customerName.trim()); } finally{ setLoading(false); } }} className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" disabled={loading}>Exportar Excel</button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"><span className="block text-2xl font-semibold">{reportData.total_locations}</span><span className="block text-slate-600">Localizações</span></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"><span className="block text-2xl font-semibold">{reportData.total_equipments}</span><span className="block text-slate-600">Equipamentos</span></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"><span className="block text-2xl font-semibold">{reportData.total_interfaces}</span><span className="block text-slate-600">Interfaces</span></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center"><span className="block text-2xl font-semibold">{reportData.total_services}</span><span className="block text-slate-600">Serviços</span></div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {filteredGroups.length===0 ? (
              <div className="text-center text-slate-600">Nenhum resultado encontrado para o filtro aplicado.</div>
            ) : (
              filteredGroups.map((group:any) => (
                <div key={group.location} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <button type="button" className="w-full flex items-center justify-between px-5 py-3 bg-slate-100 hover:bg-slate-200" onClick={()=>toggleGroup(group.location)}>
                    <h4 className="text-lg font-semibold flex items-center gap-2"><span className={`transform transition-transform ${expandedGroups.has(group.location)?'rotate-90':''}`}>▶</span>{group.location}</h4>
                    <div className="text-sm text-slate-600 flex items-center gap-3"><span>{group.equipments.length} equipamentos</span><span>{group.equipments.reduce((s:number,eq:any)=>s+eq.interfaces.length,0)} interfaces</span></div>
                  </button>

                  {expandedGroups.has(group.location) && (
                    <div className="px-5 py-4 space-y-4">
                      {group.equipments.map((equipment:any) => (
                        <div key={equipment.name} className="border border-slate-200 rounded-lg overflow-hidden">
                          <div className="px-4 py-3 flex items-center justify-between bg-slate-50">
                            <h5 className="font-semibold">{equipment.name}</h5>
                            <div className="text-sm text-slate-600 flex items-center gap-3"><span>Backup: {formatDate(equipment.last_backup)}</span><span>{equipment.interfaces.length} interfaces</span></div>
                          </div>

                          {equipment.interfaces.length>0 ? (
                            <div className="p-4 overflow-auto">
                              <div className="grid grid-cols-6 text-xs font-medium text-slate-600 border-b border-slate-200 pb-2">
                                <div>Interface</div><div>Descrição</div><div>Largura</div><div>VLAN</div><div>IP Address</div><div>Status</div>
                              </div>
                              <div className="divide-y divide-slate-200">
                                {equipment.interfaces.map((iface:any, i:number) => (
                                  <div key={i} className="grid grid-cols-6 text-sm py-2 items-center">
                                    <div className="truncate font-mono">{iface.name}</div>
                                    <div className="truncate">{iface.description || '-'}</div>
                                    <div>{formatBandwidth(iface.bandwidth)}</div>
                                    <div>{iface.vlan || '-'}</div>
                                    <div className="break-all">{iface.ip_address || '-'}</div>
                                    <div><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${statusBadge(iface.status)}`}>{iface.status}</span></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 text-slate-600">Nenhuma interface encontrada para este equipamento.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerReportComponent;