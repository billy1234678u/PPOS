import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Download,
  Edit2,
  Boxes,
  RefreshCw,
  X,
  PlusCircle,
  MinusCircle
} from 'lucide-react';

export default function InventoryManager() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockAdjustment, setStockAdjustment] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [stockChangeType, setStockChangeType] = useState('restock');

  // Form state for new/edit product
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    category: 'Dairy & Eggs',
    cost_price: '',
    selling_price: '',
    stock_quantity: '',
    reorder_level: '10',
    unit: 'pcs',
    vat_rate: '0.16'
  });

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category && category !== 'All') params.append('category', category);
      if (lowStockOnly) params.append('lowStock', 'true');

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
        if (data.categories) setCategories(['All', ...data.categories]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, category, lowStockOnly]);

  // Inventory valuation calculations
  const totalUnits = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const totalRetailVal = products.reduce((sum, p) => sum + (p.stock_quantity * p.selling_price), 0);
  const totalCostVal = products.reduce((sum, p) => sum + (p.stock_quantity * p.cost_price), 0);
  const potentialProfit = totalRetailVal - totalCostVal;
  const lowStockCount = products.filter(p => p.stock_quantity <= p.reorder_level).length;

  // Open restock modal
  const openRestockModal = (product) => {
    setSelectedProduct(product);
    setStockAdjustment('24');
    setStockNote('Supplier delivery received at Litein loading bay');
    setStockChangeType('restock');
    setShowStockModal(true);
  };

  // Submit stock adjustment
  const handleStockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !stockAdjustment) return;

    try {
      const adj = parseInt(stockAdjustment);
      const payloadAdj = stockChangeType === 'reduction' ? -Math.abs(adj) : Math.abs(adj);

      const res = await fetch(`/api/products/${selectedProduct.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment: payloadAdj,
          change_type: stockChangeType,
          note: stockNote,
          user: 'Store Manager'
        })
      });

      const data = await res.json();
      if (data.success) {
        setShowStockModal(false);
        fetchProducts();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle Add Product submit
  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setFormData({
          barcode: '',
          name: '',
          category: 'Dairy & Eggs',
          cost_price: '',
          selling_price: '',
          stock_quantity: '',
          reorder_level: '10',
          unit: 'pcs',
          vat_rate: '0.16'
        });
        fetchProducts();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['ID', 'Barcode', 'Product Name', 'Category', 'Cost Price (KES)', 'Selling Price (KES)', 'Stock Qty', 'Reorder Level', 'Unit', 'VAT Rate'];
    const rows = products.map(p => [
      p.id,
      p.barcode,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.cost_price,
      p.selling_price,
      p.stock_quantity,
      p.reorder_level,
      p.unit,
      p.vat_rate
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Giftmart_Litein_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Valuation Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total SKUs</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{products.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Catalogued products</div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Units in Store</span>
            <Boxes className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalUnits.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">On Litein supermarket shelves</div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Retail Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            KES {totalRetailVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Expected sales value</div>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Cost Valuation</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            KES {totalCostVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Margin: +KES {potentialProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>

        <div className={`p-4 rounded-2xl border ${
          lowStockCount > 0
            ? 'bg-amber-950/30 border-amber-500/40'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-amber-300 text-xs mb-1">
            <span>Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{lowStockCount}</div>
          <div className="text-[11px] text-amber-400/80 mt-0.5">Items needing reorder</div>
        </div>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-4 bg-slate-900/80 border border-slate-800 rounded-3xl">
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product name or barcode..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Low Stock Toggle */}
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1.5 ${
              lowStockOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock Only ({lowStockCount})</span>
          </button>
        </div>

        {/* Right buttons */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Product & Barcode</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5 text-right">Cost Price</th>
                <th className="px-4 py-3.5 text-right">Selling Price</th>
                <th className="px-4 py-3.5 text-right">Margin %</th>
                <th className="px-4 py-3.5 text-center">Stock Level</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading inventory table...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No products matched current filters
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isOutOfStock = p.stock_quantity <= 0;
                  const isLow = p.stock_quantity <= p.reorder_level && !isOutOfStock;
                  const marginPct = p.selling_price > 0 ? (((p.selling_price - p.cost_price) / p.selling_price) * 100).toFixed(1) : 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white text-sm">{p.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{p.barcode}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-800 text-slate-300">
                          {p.category}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        KES {Number(p.cost_price).toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        KES {Number(p.selling_price).toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          marginPct > 20 ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300 bg-slate-800'
                        }`}>
                          +{marginPct}%
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="font-bold font-mono text-sm text-white">
                          {p.stock_quantity}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">{p.unit}</span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Low Stock (≤{p.reorder_level})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Optimal
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openRestockModal(p)}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold transition-colors"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESTOCK / ADJUSTMENT MODAL */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-lg text-white">Adjust Stock Level</h3>
                <p className="text-xs text-emerald-400 font-semibold">{selectedProduct.name}</p>
              </div>
              <button onClick={() => setShowStockModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockSubmit} className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between text-xs">
                <span className="text-slate-400">Current Stock:</span>
                <span className="font-bold text-white font-mono">{selectedProduct.stock_quantity} {selectedProduct.unit}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStockChangeType('restock')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 border ${
                      stockChangeType === 'restock'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Restock / Add (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockChangeType('reduction')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 border ${
                      stockChangeType === 'reduction'
                        ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>Damaged / Writeoff (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity ({selectedProduct.unit})</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockAdjustment}
                  onChange={(e) => setStockAdjustment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Delivery / Audit Note</label>
                <textarea
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  placeholder="e.g. Received delivery from Litein depot"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs h-18"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg"
                >
                  Save Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-white">Add Product to Giftmart Catalog</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Barcode / SKU</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="e.g. 616110000999"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, barcode: `616${Math.floor(100000000 + Math.random() * 900000000)}` })}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl whitespace-nowrap"
                    >
                      Gen Code
                    </button>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Product Description</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Kericho Gold Earl Grey 50 Bags"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  >
                    {categories.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="General Supermarket">General Supermarket</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Packaging Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g. packet, bottle, pcs"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Cost Price (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="e.g. 150.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Selling Price (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    placeholder="e.g. 195.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    placeholder="e.g. 48"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Reorder Level Warning</label>
                  <input
                    type="number"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Tax Classification</label>
                  <select
                    value={formData.vat_rate}
                    onChange={(e) => setFormData({ ...formData, vat_rate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="0.16">Code A: Standard VAT 16% (Manufactured goods, beverages, soap)</option>
                    <option value="0.00">Code E: KRA VAT Exempt 0% (Flour, bread, fresh milk, unrefined produce)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg"
                >
                  Save Product to Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
