import React, { useState, useEffect } from 'react';
import { mplsService } from '../../services/mplsService';
import './network-management.css';

interface NetworkManagementProps {
  className?: string;
}

interface BackupStatus {
  status: string;
  backup_date?: string;
  total_devices?: number;
  successful_backups?: number;
  backup_directory?: string;
  message?: string;
}

const NetworkManagement: React.FC<NetworkManagementProps> = ({ className }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isFixingJson, setIsFixingJson] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [fixResult, setFixResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Carrega status do backup ao montar componente
    loadBackupStatus();
  }, []);

  const loadBackupStatus = async () => {
    try {
      const status = await mplsService.getBackupStatus();
      setBackupStatus(status);
    } catch (err) {
      console.error('Erro ao carregar status do backup:', err);
    }
  };

  const handleScanNetwork = async () => {
    if (!username || !password) {
      setError('Usuário e senha são obrigatórios');
      return;
    }

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const result = await mplsService.scanNetwork(username, password);
      setScanResult(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao escanear rede');
    } finally {
      setIsScanning(false);
    }
  };

  const handleBackupDevices = async () => {
    if (!username || !password) {
      setError('Usuário e senha são obrigatórios');
      return;
    }

    setIsBackingUp(true);
    setError(null);

    try {
      const result = await mplsService.backupAllDevices(username, password);
      setBackupStatus({
        status: 'completed',
        message: result.message,
        total_devices: result.total_count,
        successful_backups: result.success_count
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer backup dos dispositivos');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFixJson = async () => {
    setIsFixingJson(true);
    setError(null);
    setFixResult(null);

    try {
      const result = await mplsService.fixMalformedJson();
      setFixResult(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao corrigir JSONs malformados');
    } finally {
      setIsFixingJson(false);
    }
  };

  return (
    <div className={`network-management ${className || ''}`}>
      <h2>Gerenciamento de Rede MPLS</h2>
      
      {/* Formulário de Credenciais */}
      <div className="credentials-form">
        <h3>Credenciais de Acesso</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="username">Usuário:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuário dos equipamentos"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha dos equipamentos"
            />
          </div>
        </div>
      </div>

      {/* Ações de Rede */}
      <div className="network-actions">
        <h3>Ações de Rede</h3>
        
        <div className="action-buttons">
          <button
            onClick={handleScanNetwork}
            disabled={isScanning || !username || !password}
            className="btn btn-primary"
          >
            {isScanning ? '🔍 Escaneando...' : '🔍 Escanear Rede'}
          </button>
          
          <button
            onClick={handleBackupDevices}
            disabled={isBackingUp || !username || !password}
            className="btn btn-success"
          >
            {isBackingUp ? '💾 Fazendo Backup...' : '💾 Backup dos Dispositivos'}
          </button>
          
          <button
            onClick={handleFixJson}
            disabled={isFixingJson}
            className="btn btn-warning"
          >
            {isFixingJson ? '🔧 Corrigindo...' : '🔧 Corrigir JSONs'}
          </button>
        </div>
      </div>

      {/* Status do Backup */}
      {backupStatus && (
        <div className="backup-status">
          <h3>Status do Backup</h3>
          <div className="status-info">
            <p><strong>Status:</strong> {backupStatus.status}</p>
            {backupStatus.backup_date && (
              <p><strong>Data:</strong> {backupStatus.backup_date}</p>
            )}
            {backupStatus.total_devices && (
              <p><strong>Total de Dispositivos:</strong> {backupStatus.total_devices}</p>
            )}
            {backupStatus.successful_backups && (
              <p><strong>Backups Bem-sucedidos:</strong> {backupStatus.successful_backups}</p>
            )}
            {backupStatus.message && (
              <p><strong>Mensagem:</strong> {backupStatus.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Resultado do Scan */}
      {scanResult && (
        <div className="scan-result">
          <h3>Resultado do Scan da Rede</h3>
          <div className="result-info">
            <p><strong>Hosts Encontrados:</strong> {scanResult.hosts_found}</p>
            {scanResult.hosts && scanResult.hosts.length > 0 && (
              <div className="hosts-list">
                <h4>Hosts Detectados:</h4>
                <ul>
                  {scanResult.hosts.map((host: any, index: number) => (
                    <li key={index}>
                      <strong>{host.name || 'Nome desconhecido'}</strong> - {host.ip}
                      {host.interfaces && host.interfaces.length > 0 && (
                        <span> ({host.interfaces.length} interfaces)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resultado da Correção de JSON */}
      {fixResult && (
        <div className="fix-result">
          <h3>Resultado da Correção de JSON</h3>
          <div className="result-info">
            <p><strong>Status:</strong> {fixResult.success ? '✅ Sucesso' : '❌ Falha'}</p>
            <p><strong>Mensagem:</strong> {fixResult.message}</p>
            {fixResult.output && (
              <div className="output-log">
                <h4>Log de Execução:</h4>
                <pre>{fixResult.output}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensagens de Erro */}
      {error && (
        <div className="error-message">
          <p className="error">❌ {error}</p>
        </div>
      )}
    </div>
  );
};

export default NetworkManagement;
