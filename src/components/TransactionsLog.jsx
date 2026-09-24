import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Printer,
  RotateCcw,
  CheckCircle2,
  Clock,
  Smartphone,
  Banknote,
  Layers,
  CreditCard,
  AlertCircle,
  Eye,
  X
} from 'lucide-react';
import ReceiptModal from './ReceiptModal';

export default function TransactionsLog() {
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Selected receipt for reprinting/viewing
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Refund modal state
  const [refundSale, setRefundSale] = useState(null);
  const [refundReason, setRefundReason] = useState('Customer Return');
  const [isRefunding, setIsRefunding] = useState(false);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (method && method !== 'all') params.append('method', method);

      const res = await fetch(`/api/sales?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSales(data.sales);
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [search, method]);

  // View receipt detail
  const handleViewReceipt = async (saleId) => {
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      const data = await res.json();
      if (data.success) {
        setActiveReceipt(data.receipt);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Submit refund
  const handleRefund = async (e) => {
    e.preventDefault();
    if (!refundSale) return;
    setIsRefunding(true);

    try {
      const res = await fetch(`/api/sales/${refundSale.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: refundReason, cashier: 'Supervisor' })
      });
      const data = await res.json();
      if (data.success) {
        setRefundSale(null);
        fetchSales();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsRefunding(false);
    }
  };

  const getMethodBadge = (m, ref) => {
    switch (m) {
      case 'mpesa_stk':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Smartphone className="w-3 h-3" />
            <span>M-PESA STK</span>
          </span>
        );
      case 'mpesa_manual':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Smartphone className="w-3 h-3" />
            <span>M-PESA Till</span>
          </span>
        );
      case 'cash':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Banknote className="w-3 h-3" />
            <span>Cash</span>
          </span>
        );
      case 'split':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Layers className="w-3 h-3" />
            <span>Split Pay</span>
          </span>
        );
      case 'card':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <CreditCard className="w-3 h-3" />
            <span>Card</span>
          </span>
        );
      default:
        return <span className="text-slate-400">{m}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Overview Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Total Completed Sales</div>
            <div className="text-2xl font-black text-white">{stats.total_transactions}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Transactions processed</div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="text-xs text-slate-400 mb-1">Total Sales Revenue</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              KES {Number(stats.total_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">All tenders combined</div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="text-xs text-emerald-400 mb-1 flex items-center gap-1 font-semibold">
              <Smartphone className="w-3.5 h-3.5" /> M-PESA Sales Volume
            </div>
            <div className="text-2xl font-black text-white font-mono">
              KES {Number(stats.mpesa_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Instant STK & C2B collections</div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="text-xs text-amber-400 mb-1 flex items-center gap-1 font-semibold">
              <Banknote className="w-3.5 h-3.5" /> Cash Drawer Tender
            </div>
            <div className="text-2xl font-black text-white font-mono">
              KES {Number(stats.cash_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Physical notes in register</div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 bg-slate-900/80 border border-slate-800 rounded-3xl">
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipt #, customer name, phone, or M-Pesa ref..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Payment Methods</option>
            <option value="mpesa_stk">M-PESA STK Push</option>
            <option value="mpesa_manual">M-PESA Manual Till</option>
            <option value="cash">Cash Tender</option>
            <option value="split">Split Payment</option>
            <option value="card">Bank Card / PDQ</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Receipt #</th>
                <th className="px-4 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Payment Method</th>
                <th className="px-4 py-3.5">M-PESA Ref</th>
                <th className="px-4 py-3.5 text-right">Items</th>
                <th className="px-4 py-3.5 text-right">Total (KES)</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading transaction records...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      {sale.receipt_number}
                    </td>

                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(sale.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    <td className="px-4 py-3">
                      {sale.customer_name ? (
                        <div>
                          <div className="font-semibold text-white">{sale.customer_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{sale.customer_phone}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Walk-in Customer</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {getMethodBadge(sale.payment_method, sale.mpesa_reference)}
                    </td>

                    <td className="px-4 py-3 font-mono text-[11px] font-bold text-emerald-400">
                      {sale.mpesa_reference || '—'}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {sale.item_count || '—'}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-white text-sm">
                      KES {Number(sale.total_amount).toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {sale.payment_status === 'COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Paid
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Refunded
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => handleViewReceipt(sale.id)}
                        title="View / Print Thermal Receipt"
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 border border-slate-700 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Receipt</span>
                      </button>

                      {sale.payment_status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setRefundSale(sale);
                            setRefundReason('Customer Return');
                          }}
                          title="Process Return / Refund"
                          className="px-2 py-1 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-lg text-xs transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW & REPRINT RECEIPT MODAL */}
      {activeReceipt && (
        <ReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {/* REFUND MODAL */}
      {refundSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-white">Process Return & Restock</h3>
              <button onClick={() => setRefundSale(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRefund} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt #:</span>
                  <span className="font-bold text-white font-mono">{refundSale.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Refund Amount:</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    KES {Number(refundSale.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Reason for Return</label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                >
                  <option value="Customer Return (Unopened)">Customer Return (Unopened)</option>
                  <option value="Defective / Damaged Packaging">Defective / Damaged Packaging</option>
                  <option value="Wrong Item Purchased">Wrong Item Purchased</option>
                  <option value="Cashier Billing Error">Cashier Billing Error</option>
                </select>
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 leading-relaxed">
                ⚠️ Processing this refund will automatically return all {refundSale.item_count || 'all'} items back to Giftmart Litein inventory stock and reverse customer loyalty points.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundSale(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRefunding}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg"
                >
                  {isRefunding ? 'Processing...' : 'Confirm Refund & Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
