/**
 * MPLS Analyzer Dashboard — versão alto contraste
 */
import React, { useState } from 'react';
import MplsSearchSystem from './mpls-search-system';
import CustomerReportComponent from './customer-report';

interface MplsAnalyzerDashboardProps {
  onBack?: () => void;
}

const TabButton: React.FC<{active:boolean; onClick:()=>void; children:React.ReactNode}> = ({active,onClick,children}) => (
  <button
    onClick={onClick}
    className={[
      'px-4 py-2 text-sm font-medium rounded-md transition',
      active
        ? 'bg-slate-900 text-white shadow'
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
            <p className="text-slate-600">Sistema de análise, busca e relatórios de equipamentos MPLS</p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <span>←</span> Voltar ao Sistema
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <TabButton active={activeTab==='search'} onClick={()=>setActiveTab('search')}>🔎 Busca Inteligente</TabButton>
          <TabButton active={activeTab==='reports'} onClick={()=>setActiveTab('reports')}>📊 Relatórios de Cliente</TabButton>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          {activeTab === 'search' && <MplsSearchSystem />}
          {activeTab === 'reports' && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Relatórios de Cliente</h2>
                <p className="text-slate-600">Visualize equipamentos, interfaces e serviços agrupados por cliente</p>
              </div>
              <CustomerReportComponent />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default MplsAnalyzerDashboard;