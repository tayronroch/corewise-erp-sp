import React, { useState, useEffect, useCallback } from 'react';
import { mplsService } from '../../services/mplsService';
import type { CustomerReportData, CustomerReportGroup } from '../../services/mplsService';
import './customer-report.css';

interface CustomerReportProps {
  className?: string;
  initialCustomer?: string;
}

const CustomerReportComponent: React.FC<CustomerReportProps> = ({ 
  className = '', 
  initialCustomer = '' 
}) => {
  const [customerName, setCustomerName] = useState(initialCustomer);
  const [reportData, setReportData] = useState<CustomerReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadCustomerReport = useCallback(async (customer: string) => {
    if (!customer.trim()) {
      setReportData(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const data = await mplsService.getCustomerReport(customer);
      setReportData(data);
      // Auto-expand first group
      if (data.groups.length > 0) {
        setExpandedGroups(new Set([data.groups[0].location]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer report');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerName.trim()) {
      loadCustomerReport(customerName.trim());
    }
  };

  const toggleGroupExpanded = (location: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(location)) {
      newExpanded.delete(location);
    } else {
      newExpanded.add(location);
    }
    setExpandedGroups(newExpanded);
  };

  const exportToExcel = async () => {
    if (!customerName.trim()) return;
    
    try {
      setLoading(true);
      await mplsService.exportCustomerReportExcel(customerName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = reportData?.groups.filter((group: any) =>
    !searchTerm || 
    group.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.equipments.some((eq: any) => 
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.interfaces.some((iface: any) => 
        iface.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        iface.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  ) || [];

  const formatBandwidth = (bandwidth: string) => {
    return mplsService.formatBandwidth(bandwidth);
  };

  const formatDate = (dateString: string) => {
    return mplsService.formatDate(dateString);
  };

  const getInterfaceStatusClass = (status: string) => {
    return mplsService.getInterfaceStatusClass(status);
  };

  useEffect(() => {
    if (initialCustomer) {
      loadCustomerReport(initialCustomer);
    }
  }, [initialCustomer, loadCustomerReport]);

  return (
    <div className={`customer-report ${className}`}>
      <div className="report-header">
        <h2>Relatório de Cliente</h2>
        <p className="report-description">
          Visualize detalhes completos de equipamentos e interfaces por cliente
        </p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-group">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Digite o nome do cliente..."
            className="customer-input"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !customerName.trim()} className="search-button">
            {loading ? 'Carregando...' : 'Gerar Relatório'}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {reportData && (
        <>
          <div className="report-summary">
            <div className="summary-header">
              <h3>Cliente: {reportData.customer_name}</h3>
              <div className="summary-actions">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar equipamentos/interfaces..."
                  className="filter-input"
                />
                <button onClick={exportToExcel} className="export-button" disabled={loading}>
                  Exportar Excel
                </button>
              </div>
            </div>
            
            <div className="summary-stats">
              <div className="stat-card">
                <span className="stat-number">{reportData.total_locations}</span>
                <span className="stat-label">Localizações</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{reportData.total_equipments}</span>
                <span className="stat-label">Equipamentos</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{reportData.total_interfaces}</span>
                <span className="stat-label">Interfaces</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{reportData.total_services}</span>
                <span className="stat-label">Serviços</span>
              </div>
            </div>
          </div>

          <div className="report-content">
            {filteredGroups.length === 0 ? (
              <div className="no-results">
                <p>Nenhum resultado encontrado para o filtro aplicado.</p>
              </div>
            ) : (
              filteredGroups.map((group: any) => (
                <div key={group.location} className="location-group">
                  <div 
                    className="group-header"
                    onClick={() => toggleGroupExpanded(group.location)}
                  >
                    <h4 className="location-name">
                      <span className={`expand-icon ${expandedGroups.has(group.location) ? 'expanded' : ''}`}>
                        ▶
                      </span>
                      {group.location}
                    </h4>
                    <div className="group-summary">
                      <span className="equipment-count">{group.equipments.length} equipamentos</span>
                      <span className="interface-count">
                        {group.equipments.reduce((sum: number, eq: any) => sum + eq.interfaces.length, 0)} interfaces
                      </span>
                    </div>
                  </div>

                  {expandedGroups.has(group.location) && (
                    <div className="group-content">
                      {group.equipments.map((equipment: any) => (
                        <div key={equipment.name} className="equipment-card">
                          <div className="equipment-header">
                            <h5 className="equipment-name">{equipment.name}</h5>
                            <div className="equipment-info">
                              <span className="backup-date">
                                Backup: {formatDate(equipment.last_backup)}
                              </span>
                              <span className="interface-count">
                                {equipment.interfaces.length} interfaces
                              </span>
                            </div>
                          </div>

                          {equipment.interfaces.length > 0 && (
                            <div className="interfaces-table">
                              <div className="table-header">
                                <div className="col-interface">Interface</div>
                                <div className="col-description">Descrição</div>
                                <div className="col-bandwidth">Largura</div>
                                <div className="col-vlan">VLAN</div>
                                <div className="col-ip">IP Address</div>
                                <div className="col-status">Status</div>
                              </div>
                              
                              <div className="table-body">
                                {equipment.interfaces.map((iface: any, index: number) => (
                                  <div key={index} className="table-row">
                                    <div className="col-interface">
                                      <span className="interface-name">{iface.name}</span>
                                    </div>
                                    <div className="col-description">
                                      <span className="interface-description">
                                        {iface.description || '-'}
                                      </span>
                                    </div>
                                    <div className="col-bandwidth">
                                      {iface.bandwidth ? formatBandwidth(iface.bandwidth) : '-'}
                                    </div>
                                    <div className="col-vlan">
                                      {iface.vlan || '-'}
                                    </div>
                                    <div className="col-ip">
                                      {iface.ip_address || '-'}
                                    </div>
                                    <div className="col-status">
                                      <span className={`interface-status ${getInterfaceStatusClass(iface.status)}`}>
                                        {iface.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {equipment.interfaces.length === 0 && (
                            <div className="no-interfaces">
                              <p>Nenhuma interface encontrada para este equipamento.</p>
                            </div>
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