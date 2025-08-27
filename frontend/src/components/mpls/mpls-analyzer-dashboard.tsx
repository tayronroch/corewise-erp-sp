/**
 * MPLS Analyzer Dashboard — versão alto contraste
 */
import React, { useState } from 'react';
import MplsSearchSystem from './mpls-search-system';
// import CustomerReportComponent from './customer-report';

interface MplsAnalyzerDashboardProps {
  onBack?: () => void;
}

const TabButton: React.FC<{active:boolean; onClick:()=>void; children:React.ReactNode}> = ({active,onClick,children}) => (
  <button
    onClick={onClick}
    className={[
      'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
      active
        ? 'bg-blue-200 text-blue-900 border-2 border-blue-400 shadow-md'
        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
    ].join(' ')}
  >
    {children}
  </button>
);

const MplsAnalyzerDashboard: React.FC<MplsAnalyzerDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'reports'>('search');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MPLS Analyzer</h1>
            <p className="text-slate-600">Modulo de análise, busca e relatórios de Clientes</p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <span>←</span> Voltar
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <TabButton active={activeTab==='search'} onClick={()=>setActiveTab('search')}>🚀 Busca Inteligente (Otimizada)</TabButton>
          <TabButton active={activeTab==='reports'} onClick={()=>setActiveTab('reports')}>Relatórios de Cliente</TabButton>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          {activeTab === 'search' && <MplsSearchSystem />}
          {activeTab === 'reports' && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Relatórios de Cliente</h2>
                <p className="text-slate-600">Módulo de relatório temporariamente indisponível.</p>
              </div>
              <div className="rounded-md border border-slate-200 p-4 text-slate-700 bg-slate-50">
                Esta seção foi desativada. Consulte a busca inteligente ou reative o módulo de relatório.
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default MplsAnalyzerDashboard;