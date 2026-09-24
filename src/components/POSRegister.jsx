import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  UserPlus,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Tag,
  ArrowRight,
  Package,
  Milk,
  Coffee,
  Egg,
  Shield,
  Heart,
  Droplet,
  Utensils,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';

export default function POSRegister({ onSaleComplete }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Cart state
  const [cart, setCart] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [pointsRedeemed, setPointsRedeemed] = useState(0);

  // Customer state
  const [customer, setCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Modals & Panels
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [heldCarts, setHeldCarts] = useState([]);
  const [showHeldCartsModal, setShowHeldCartsModal] = useState(false);

  // Cashier Session
  const cashierName = 'Chepngeno Mary';
  const counterNumber = 'Counter 01';

  const barcodeInputRef = useRef(null);

  // Fetch products
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      let url = '/api/products';
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
        if (data.categories) setCategories(['All', ...data.categories]);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch held carts
  const fetchHeldCarts = async () => {
    try {
      const res = await fetch('/api/sales/held-carts');
      const data = await res.json();
      if (data.success) {
        setHeldCarts(data.heldCarts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchHeldCarts();
  }, []);

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F4 to Checkout
      if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault();
        setShowPaymentModal(true);
      }
      // F2 to focus barcode search
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  // Handle direct barcode search / scan
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check exact match by barcode or first matching product
    const exactBarcode = products.find(p => p.barcode === searchQuery.trim());
    const candidate = exactBarcode || products[0];

    if (candidate) {
      addToCart(candidate);
      setSearchQuery('');
    }
  };

  // Add product to cart
  const addToCart = (product) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          alert(`Cannot add more "${product.name}". Max stock in store is ${product.stock_quantity}.`);
          return prevCart;
        }
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        if (product.stock_quantity < 1) {
          alert(`"${product.name}" is currently OUT OF STOCK.`);
          return prevCart;
        }
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  // Update item quantity
  const updateQuantity = (productId, delta) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty > item.stock_quantity) {
            alert(`Stock limit reached (${item.stock_quantity} available)`);
            return item;
          }
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  // Remove item
  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Are you sure you want to clear the current cart?')) {
      setCart([]);
      setDiscountAmount(0);
      setPointsRedeemed(0);
      setCustomer(null);
    }
  };

  // Customer search
  const handleCustomerSearch = async (query) => {
    setCustomerSearch(query);
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }
    setIsSearchingCustomer(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setCustomerResults(data.customers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // Select customer
  const selectCustomer = (cust) => {
    setCustomer(cust);
    setCustomerResults([]);
    setCustomerSearch('');
  };

  // Create new customer
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) return;
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustName, phone: newCustPhone })
      });
      const data = await res.json();
      if (data.success) {
        setCustomer(data.customer);
        setShowAddCustomerModal(false);
        setNewCustName('');
        setNewCustPhone('');
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Hold current cart
  const handleHoldCart = async () => {
    if (cart.length === 0) return;
    try {
      const res = await fetch('/api/sales/held-carts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart_title: `Cart (${customer ? customer.name : 'Walk-in'} - ${new Date().toLocaleTimeString()})`,
          customer_id: customer?.id,
          customer_name: customer?.name,
          customer_phone: customer?.phone,
          items: cart,
          subtotal: calculateSubtotal()
        })
      });
      const data = await res.json();
      if (data.success) {
        setCart([]);
        setCustomer(null);
        setDiscountAmount(0);
        setPointsRedeemed(0);
        fetchHeldCarts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Restore held cart
  const handleRestoreCart = async (held) => {
    setCart(held.items);
    if (held.customer_id) {
      setCustomer({
        id: held.customer_id,
        name: held.customer_name,
        phone: held.customer_phone
      });
    }
    // Delete from held carts
    await fetch(`/api/sales/held-carts/${held.id}`, { method: 'DELETE' });
    fetchHeldCarts();
    setShowHeldCartsModal(false);
  };

  // Totals calculation
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  };

  const subtotal = calculateSubtotal();
  const totalDiscount = Math.min(subtotal, (parseFloat(discountAmount) || 0) + (parseInt(pointsRedeemed) || 0));
  const finalTotal = Math.max(0, subtotal - totalDiscount);
  const potentialPoints = Math.floor(finalTotal / 100);

  // Successful payment callback
  const handlePaymentSuccess = (receipt) => {
    setShowPaymentModal(false);
    setCurrentReceipt(receipt);
    setCart([]);
    setDiscountAmount(0);
    setPointsRedeemed(0);
    setCustomer(null);
    fetchProducts(); // Refresh stock counts
    if (onSaleComplete) onSaleComplete();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-100px)]">
      {/* LEFT SECTION: PRODUCT CATALOG & BARCODE SEARCH (7 cols) */}
      <div className="lg:col-span-7 flex flex-col h-full bg-slate-900/60 rounded-3xl border border-slate-800 p-4 overflow-hidden">
        {/* Top Search Bar & Controls */}
        <div className="space-y-3 pb-3 border-b border-slate-800">
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Barcode className="w-5 h-5 text-emerald-400" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or search product (e.g. 616110000101, Milk, Maize, Tea...)"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm flex items-center space-x-2 shadow-lg shadow-emerald-950/40 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </form>

          {/* Category Chips Scrollbar */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-900/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pt-3 pr-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
              <span>Loading Litein inventory catalog...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Package className="w-12 h-12 stroke-1 mb-2 text-slate-600" />
              <p className="text-sm">No products found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((product) => {
                const inCart = cart.find(i => i.id === product.id);
                const isOutOfStock = product.stock_quantity <= 0;
                const isLowStock = product.stock_quantity <= product.reorder_level && !isOutOfStock;

                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={isOutOfStock}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all group relative ${
                      isOutOfStock
                        ? 'bg-slate-950/40 border-slate-800/50 opacity-50 cursor-not-allowed'
                        : inCart
                        ? 'bg-emerald-950/20 border-emerald-500/70 shadow-lg shadow-emerald-950/30'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                  >
                    {/* Top barcode & badge */}
                    <div className="flex justify-between items-start gap-1 w-full mb-1">
                      <span className="text-[10px] font-mono text-slate-500 truncate">
                        {product.barcode.slice(-6)}
                      </span>
                      {isOutOfStock ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Out
                        </span>
                      ) : isLowStock ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {product.stock_quantity} left
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {product.stock_quantity} {product.unit}
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <div className="font-semibold text-xs text-white line-clamp-2 my-1 group-hover:text-emerald-300 transition-colors">
                      {product.name}
                    </div>

                    {/* Price and Cart Counter */}
                    <div className="flex justify-between items-end mt-2 pt-1 border-t border-slate-800/60 w-full">
                      <div className="font-bold text-sm text-emerald-400 font-mono">
                        KES {Number(product.selling_price).toFixed(0)}
                      </div>

                      {inCart && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
                          {inCart.quantity}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: ACTIVE CART & CHECKOUT TERMINAL (5 cols) */}
      <div className="lg:col-span-5 flex flex-col h-full bg-slate-900/90 rounded-3xl border border-slate-800 p-4 overflow-hidden shadow-2xl">
        {/* Cart Header with Customer Lookup */}
        <div className="pb-3 border-b border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-base text-white">Current Register Cart</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              {heldCarts.length > 0 && (
                <button
                  onClick={() => setShowHeldCartsModal(true)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-medium flex items-center space-x-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Held ({heldCarts.length})</span>
                </button>
              )}

              <button
                onClick={handleHoldCart}
                disabled={cart.length === 0}
                title="Hold Sale"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl transition-colors"
              >
                <Pause className="w-4 h-4" />
              </button>

              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                title="Clear Cart"
                className="p-1.5 bg-slate-800 hover:bg-rose-900/60 disabled:opacity-40 text-slate-400 hover:text-rose-300 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Customer Attachment Bar */}
          {customer ? (
            <div className="flex items-center justify-between p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{customer.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded-md">
                      {customer.loyalty_points} pts
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">{customer.phone}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {customer.loyalty_points > 0 && pointsRedeemed === 0 && (
                  <button
                    onClick={() => setPointsRedeemed(Math.min(customer.loyalty_points, Math.floor(subtotal)))}
                    className="text-[10px] px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors"
                  >
                    Redeem Points
                  </button>
                )}
                {pointsRedeemed > 0 && (
                  <button
                    onClick={() => setPointsRedeemed(0)}
                    className="text-[10px] text-rose-400 hover:underline"
                  >
                    Cancel Redeem
                  </button>
                )}
                <button
                  onClick={() => {
                    setCustomer(null);
                    setPointsRedeemed(0);
                  }}
                  className="p-1 text-slate-500 hover:text-rose-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    placeholder="Attach Customer Phone (e.g. 0712345678)"
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center space-x-1"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>New</span>
                </button>
              </div>

              {/* Customer Dropdown Results */}
              {customerResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto">
                  {customerResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 flex justify-between items-center text-xs border-b border-slate-800 last:border-0"
                    >
                      <div>
                        <div className="font-semibold text-white">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.phone}</div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400">{c.loyalty_points} pts</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
              <ShoppingCart className="w-12 h-12 stroke-1 text-slate-600" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-400">Cart is empty</p>
                <p className="text-xs text-slate-600 mt-0.5">Scan an item or select from the left to start sale</p>
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between text-xs"
              >
                <div className="flex-1 pr-2">
                  <div className="font-bold text-white text-xs line-clamp-1">{item.name}</div>
                  <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                    KES {Number(item.selling_price).toFixed(0)} × {item.quantity} = <span className="font-bold text-emerald-400">KES {(item.selling_price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-bold font-mono text-white text-sm">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="w-7 h-7 ml-1 bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financial Breakdown & Total */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Gross Subtotal:</span>
              <span className="font-mono text-white">KES {subtotal.toFixed(2)}</span>
            </div>

            {pointsRedeemed > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Loyalty Points Discount:</span>
                <span className="font-mono">- KES {pointsRedeemed.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Includes 16% VAT (KRA Compliant):</span>
              <span className="font-mono">KES {((finalTotal * 0.16) / 1.16).toFixed(2)}</span>
            </div>
          </div>

          {/* Grand Total Box */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Amount Due</div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                KES {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            {customer && potentialPoints > 0 && (
              <div className="text-right text-[11px] text-emerald-400 font-medium">
                Customer earns +{potentialPoints} pts
              </div>
            )}
          </div>

          {/* Big Checkout Trigger Button */}
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={cart.length === 0}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-base rounded-2xl shadow-xl shadow-emerald-950/60 flex items-center justify-center space-x-3 transition-all hover:scale-[1.01]"
          >
            <Sparkles className="w-5 h-5 text-emerald-200" />
            <span>PROCEED TO PAYMENT (F4)</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PAYMENT MODAL (STK Push & Multi-Method) */}
      {showPaymentModal && (
        <PaymentModal
          cartTotal={finalTotal}
          subtotal={subtotal}
          discount={discountAmount}
          pointsRedeemed={pointsRedeemed}
          customer={customer}
          cartItems={cart}
          cashierName={cashierName}
          onClose={() => setShowPaymentModal(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* REAL-TIME THERMAL RECEIPT MODAL */}
      {currentReceipt && (
        <ReceiptModal
          receipt={currentReceipt}
          onClose={() => setCurrentReceipt(null)}
          onNewSale={() => {
            setCurrentReceipt(null);
            barcodeInputRef.current?.focus();
          }}
        />
      )}

      {/* ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-white">Register Giftmart Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Kiprono Cheruiyot"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number (Safaricom)</label>
                <input
                  type="tel"
                  required
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="e.g. 0712345678"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono"
                />
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
                🎁 New customer will automatically receive 10 welcome loyalty points!
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm"
                >
                  Save & Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECALL HELD CARTS MODAL */}
      {showHeldCartsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-white">Suspended / Held Transactions</h3>
              <button onClick={() => setShowHeldCartsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {heldCarts.map(h => (
                <div
                  key={h.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex justify-between items-center"
                >
                  <div>
                    <div className="font-bold text-white text-sm">{h.cart_title}</div>
                    <div className="text-xs text-slate-400">
                      {h.item_count} items • KES {Number(h.subtotal).toLocaleString()} • {h.created_at}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestoreCart(h)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
