import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  Receipt,
  Users,
  Activity,
  Store,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Clock,
  Wifi,
  Sparkles
} from 'lucide-react';
import POSRegister from './components/POSRegister';
import InventoryManager from './components/InventoryManager';
import TransactionsLog from './components/TransactionsLog';
import CustomerDirectory from './components/CustomerDirectory';
import DevOpsDashboard from './components/DevOpsDashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos', 'inventory', 'sales', 'customers', 'devops'
  const [dailyStats, setDailyStats] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Fetch daily sales stats for the header ticker
  const fetchHeaderStats = async () => {
    try {
      const res = await fetch('/api/sales/stats/daily');
      const data = await res.json();
      if (data.success) {
        setDailyStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHeaderStats();
    const interval = setInterval(fetchHeaderStats, 10000);
    const clockInterval = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  // Global hotkeys for tab navigation
  useEffect(() => {
    const handleKeyNav = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'F1') { e.preventDefault(); setActiveTab('pos'); }
      if (e.key === 'F2') { e.preventDefault(); setActiveTab('inventory'); }
      if (e.key === 'F3') { e.preventDefault(); setActiveTab('sales'); }
      if (e.key === 'F5') { e.preventDefault(); setActiveTab('devops'); }
    };
    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Brand & Store Location */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-950/60">
              <Store className="w-5 h-5 text-slate-950" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  <span>Giftmart Supermarket</span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Litein Main
                  </span>
                </h1>
                <div className="hidden sm:flex items-center space-x-1 text-[11px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Daraja STK Ready</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                <span>Opp. Litein Bus Park • Till: 5244101</span>
                <span>•</span>
                <span className="text-slate-300 font-medium">Cashier: Chepngeno Mary (Counter 01)</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Edge Ticker */}
          <div className="flex items-center space-x-3 self-end md:self-auto">
            {dailyStats && (
              <div className="hidden lg:flex items-center space-x-3 text-xs">
                <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center space-x-2">
                  <span className="text-slate-400 text-[11px]">Today's Sales:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    KES {Number(dailyStats.stats.total_sales).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  </span>
                </div>

                {dailyStats.lowStockCount > 0 && (
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="bg-amber-950/40 border border-amber-500/40 px-2.5 py-1.5 rounded-xl text-amber-300 text-xs font-semibold flex items-center space-x-1.5 hover:bg-amber-950/60 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>{dailyStats.lowStockCount} Low Stock</span>
                  </button>
                )}
              </div>
            )}

            <div className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 hidden sm:block">
              {currentTime}
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto scrollbar-none text-xs font-semibold">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'pos'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>POS Checkout Terminal (F1)</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventory & Stock (F2)</span>
            {dailyStats?.lowStockCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 ml-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'sales'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Sales & Receipts (F3)</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Loyalty</span>
          </button>

          <button
            onClick={() => setActiveTab('devops')}
            className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'devops'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>DevOps & Edge Telemetry (F5)</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4">
        {activeTab === 'pos' && <POSRegister onSaleComplete={fetchHeaderStats} />}
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'sales' && <TransactionsLog />}
        {activeTab === 'customers' && <CustomerDirectory />}
        {activeTab === 'devops' && <DevOpsDashboard />}
      </main>

      {/* Footer Status Bar */}
      <footer className="bg-slate-950 border-t border-slate-900 px-4 py-2 text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1">
          <div className="flex items-center space-x-2">
            <span>Giftmart Supermarket POS System v2.4</span>
            <span>•</span>
            <span>Engineered for Litein Retail Hub</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">M-PESA STK Push Active</span>
          </div>
          <div>
            KRA eTIMS PIN: <span className="font-mono text-slate-400">P051839201Z</span> • Till: <span className="font-mono text-emerald-400">5244101</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
