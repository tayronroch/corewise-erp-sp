/**
 * MPLS Analyzer Dashboard - CoreWise
 * Tela principal do analisador MPLS com busca e relatórios
 */

import React, { useState } from 'react';
import IntelligentSearchComponent from './intelligent-search';
import CustomerReportComponent from './customer-report';
import AdvancedSearchComponent from './advanced-search';
import './mpls-analyzer-dashboard.css';

interface MplsAnalyzerDashboardProps {
  onBack?: () => void;
}

const MplsAnalyzerDashboard: React.FC<MplsAnalyzerDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'reports' | 'advanced'>('search');

  return (
    <div className="mpls-analyzer-dashboard">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="dashboard-title">
                <span className="title-icon">🔍</span>
                MPLS Analyzer
              </h1>
              <p className="dashboard-description">
                Sistema de análise, busca e relatórios de equipamentos MPLS
              </p>
            </div>
            {onBack && (
              <div className="header-right">
                <button onClick={onBack} className="back-button">
                  ← Voltar ao Sistema
                </button>
              </div>
            )}
          </div>
        </div>
        

        {/* Navigation Tabs */}
        <div className="navigation-tabs">
          <div className="tabs-container">
            <button
              onClick={() => setActiveTab('search')}
              className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
            >
              <span className="tab-icon">🔍</span>
              Busca Inteligente
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`tab-button ${activeTab === 'advanced' ? 'active' : ''}`}
            >
              <span className="tab-icon">⚙️</span>
              Busca Avançada
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
            >
              <span className="tab-icon">📊</span>
              Relatórios de Cliente
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'search' && (
            <div className="content-panel">
              <div className="panel-header">
                <h2>Busca Inteligente</h2>
                <p>Digite IPs, MACs, VPN IDs, VLANs, interfaces, números de série ou texto livre</p>
              </div>
              <IntelligentSearchComponent />
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="content-panel">
              <div className="panel-header">
                <h2>Busca Avançada</h2>
                <p>Sistema completo de busca com filtros e opções avançadas</p>
              </div>
              <AdvancedSearchComponent />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="content-panel">
              <div className="panel-header">
                <h2>Relatórios de Cliente</h2>
                <p>Visualize equipamentos, interfaces e serviços agrupados por cliente</p>
              </div>
              <CustomerReportComponent />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MplsAnalyzerDashboard;