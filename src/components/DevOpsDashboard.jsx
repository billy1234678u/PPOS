import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Database,
  Radio,
  ShieldAlert,
  Cpu,
  Clock,
  Terminal,
  Settings,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Save,
  Check,
  RefreshCw,
  QrCode
} from 'lucide-react';

export default function DevOpsDashboard() {
  const [healthData, setHealthData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Fetch telemetry
  const fetchHealthAndSettings = async () => {
    try {
      const [hRes, sRes, lRes] = await Promise.all([
        fetch('/api/devops/health'),
        fetch('/api/devops/settings'),
        fetch('/api/devops/logs?limit=40')
      ]);

      const [hData, sData, lData] = await Promise.all([
        hRes.json(),
        sRes.json(),
        lRes.json()
      ]);

      setHealthData(hData);
      setSettings(sData.settings || {});
      setLogs(lData.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthAndSettings();
    const interval = setInterval(fetchHealthAndSettings, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSettingChange = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/devops/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        fetchHealthAndSettings();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/devops/backup';
  };

  const handleResetDemo = async () => {
    if (!confirm('Are you sure you want to reset and reseed the Giftmart Litein database? All custom transactions will revert to demo state.')) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/devops/reset-demo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResetSuccess(true);
        setTimeout(() => setResetSuccess(false), 3000);
        fetchHealthAndSettings();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>DevOps Edge Infrastructure & Observability</span>
          </div>
          <h2 className="text-xl font-black text-white">Giftmart Supermarket - Litein Edge Node</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Local resilient SQLite cluster, Safaricom Daraja STK Push engine, & KRA eTIMS fiscalizer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadBackup}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export DB Snapshot (JSON)</span>
          </button>

          <button
            onClick={handleResetDemo}
            disabled={isResetting}
            className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-xl border border-rose-800/60 flex items-center space-x-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isResetting ? 'Resetting...' : 'Reset Demo Stock'}</span>
          </button>
        </div>
      </div>

      {resetSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Database reset and reseeded with fresh Litein supermarket catalog!</span>
        </div>
      )}

      {/* Edge System Telemetry Row */}
      {healthData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Edge Node Status</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>{healthData.status}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              Uptime: {Math.floor(healthData.uptime_seconds / 60)} mins • v{healthData.version}
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>SQLite WAL Engine</span>
              <Database className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {healthData.database.query_latency_ms} ms
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Size: {healthData.database.db_size_kb} KB • {healthData.database.counts.products} SKUs
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Safaricom Daraja API</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white">
              {healthData.gateways.mpesa_daraja.mode === 'SANDBOX_SIMULATOR' ? 'SIMULATOR' : 'LIVE DARAJA'}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 font-mono">
              Till: {healthData.gateways.mpesa_daraja.shortcode} • 12ms latency
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>KRA eTIMS Fiscalizer</span>
              <QrCode className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-400">
              SYNCHRONIZED
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              CU: {healthData.gateways.kra_etims.cu_number.slice(-6)} • 0 queue
            </div>
          </div>
        </div>
      )}

      {/* Settings Form & Live Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Column */}
        {settings && (
          <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <Settings className="w-4 h-4 text-emerald-400" />
                <span>Store & M-Pesa Daraja Configuration</span>
              </div>
              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Saved!
                </span>
              )}
            </div>

            <form onSubmit={saveSettings} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Supermarket Name</label>
                  <input
                    type="text"
                    value={settings.store_name || ''}
                    onChange={(e) => handleSettingChange('store_name', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Branch Town</label>
                  <input
                    type="text"
                    value={settings.store_branch || ''}
                    onChange={(e) => handleSettingChange('store_branch', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">M-PESA Till / Shortcode</label>
                  <input
                    type="text"
                    value={settings.mpesa_shortcode || ''}
                    onChange={(e) => handleSettingChange('mpesa_shortcode', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">M-Pesa Type</label>
                  <select
                    value={settings.mpesa_type || 'till'}
                    onChange={(e) => handleSettingChange('mpesa_type', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="till">Buy Goods Till (5244101)</option>
                    <option value="paybill">Paybill Business Number</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">M-PESA Engine Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSettingChange('mpesa_simulation_mode', 'true')}
                      className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                        settings.mpesa_simulation_mode === 'true'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Interactive Phone Simulator
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSettingChange('mpesa_simulation_mode', 'false')}
                      className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                        settings.mpesa_simulation_mode === 'false'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Live Safaricom Daraja API
                    </button>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">KRA eTIMS PIN</label>
                  <input
                    type="text"
                    value={settings.kra_pin || ''}
                    onChange={(e) => handleSettingChange('kra_pin', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Daraja Online Passkey</label>
                  <input
                    type="password"
                    value={settings.mpesa_passkey || ''}
                    onChange={(e) => handleSettingChange('mpesa_passkey', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Audit Logs Stream Column */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Edge Audit Logs</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Live Stream</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] pr-1">
            {logs.length === 0 ? (
              <div className="text-slate-500 py-10 text-center">No audit logs recorded yet.</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl text-slate-300 space-y-1 hover:border-slate-700 transition-colors"
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="px-1.5 py-0.2 rounded font-bold bg-slate-800 text-emerald-400">
                      {log.event_type}
                    </span>
                    <span className="text-slate-500">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-white text-xs">{log.description}</div>

                  {log.details && (
                    <div className="text-[10px] text-slate-400 truncate">{log.details}</div>
                  )}

                  <div className="text-[9px] text-slate-500 flex justify-between">
                    <span>By: {log.performed_by}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
