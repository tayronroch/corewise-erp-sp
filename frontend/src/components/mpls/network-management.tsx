// Uniformização visual com fundo neutro e cards brancos
import React, { useState, useEffect } from 'react';
import { mplsService } from '../../services/mplsService';

interface NetworkManagementProps { className?: string; }
interface BackupStatus { status:string; backup_date?:string; total_devices?:number; successful_backups?:number; backup_directory?:string; message?:string; }

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

  useEffect(()=>{ loadBackupStatus(); }, []);
  const loadBackupStatus = async () => { try { const s = await mplsService.getBackupStatus(); setBackupStatus(s);} catch{} };

  const needCreds = () => (!username || !password);

  const withGuard = async (fn:()=>Promise<void>) => { if(needCreds()){ setError('Usuário e senha são obrigatórios'); return; } setError(null); await fn(); };

  return (
    <div className={`max-w-4xl mx-auto ${className||''}`}>
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">Gerenciamento de Rede MPLS</h2>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4">
        <h3 className="font-semibold mb-3">Credenciais de Acesso</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="user" className="block text-sm font-medium text-slate-700">Usuário</label>
            <input id="user" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Usuário dos equipamentos" className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"/>
          </div>
          <div>
            <label htmlFor="pass" className="block text-sm font-medium text-slate-700">Senha</label>
            <input id="pass" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Senha dos equipamentos" className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"/>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4">
        <h3 className="font-semibold mb-3">Ações de Rede</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>withGuard(async()=>{ setIsScanning(true); try{ const r=await mplsService.scanNetwork(username,password); setScanResult(r);} finally{ setIsScanning(false);} })} disabled={isScanning||needCreds()} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{isScanning?'🔍 Escaneando...':'🔍 Escanear Rede'}</button>
          <button onClick={()=>withGuard(async()=>{ setIsBackingUp(true); try{ const r=await mplsService.backupAllDevices(username,password); setBackupStatus({ status:'completed', message:r.message, total_devices:r.total_count, successful_backups:r.success_count }); } finally{ setIsBackingUp(false);} })} disabled={isBackingUp||needCreds()} className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">{isBackingUp?'💾 Fazendo Backup...':'💾 Backup dos Dispositivos'}</button>
          <button onClick={async()=>{ setIsFixingJson(true); setError(null); setFixResult(null); try{ const r=await mplsService.fixMalformedJson(); setFixResult(r);} finally{ setIsFixingJson(false);} }} disabled={isFixingJson} className="px-4 py-2 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">{isFixingJson?'🔧 Corrigindo...':'🔧 Corrigir JSONs'}</button>
        </div>
      </div>

      {backupStatus && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4">
          <h3 className="font-semibold mb-2">Status do Backup</h3>
          <div className="text-sm text-slate-700 space-y-1">
            <p><strong>Status:</strong> {backupStatus.status}</p>
            {backupStatus.backup_date && <p><strong>Data:</strong> {backupStatus.backup_date}</p>}
            {backupStatus.total_devices && <p><strong>Total de Dispositivos:</strong> {backupStatus.total_devices}</p>}
            {backupStatus.successful_backups && <p><strong>Backups Bem-sucedidos:</strong> {backupStatus.successful_backups}</p>}
            {backupStatus.message && <p><strong>Mensagem:</strong> {backupStatus.message}</p>}
          </div>
        </div>
      )}

      {scanResult && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4">
          <h3 className="font-semibold mb-2">Resultado do Scan da Rede</h3>
          <p className="text-sm"><strong>Hosts Encontrados:</strong> {scanResult.hosts_found}</p>
          {scanResult.hosts?.length>0 && (
            <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {scanResult.hosts.map((h:any,i:number)=> (
                <li key={i} className="rounded-md border border-slate-200 p-2"> <strong>{h.name||'Nome desconhecido'}</strong> — {h.ip} {h.interfaces?.length? <span>({h.interfaces.length} interfaces)</span>:null} </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {fixResult && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4">
          <h3 className="font-semibold mb-2">Resultado da Correção de JSON</h3>
          <p className="text-sm"><strong>Status:</strong> {fixResult.success ? '✅ Sucesso' : '❌ Falha'}</p>
          <p className="text-sm"><strong>Mensagem:</strong> {fixResult.message}</p>
          {fixResult.output && (<pre className="mt-2 text-sm bg-slate-900 text-slate-50 p-3 rounded-md overflow-auto max-h-[40vh]">{fixResult.output}</pre>)}
        </div>
      )}

      {error && (<div className="bg-rose-50 text-rose-800 border border-rose-200 rounded-md p-3">❌ {error}</div>)}
    </div>
  );
};

export default NetworkManagement;