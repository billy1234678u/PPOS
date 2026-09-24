import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Smartphone,
  Banknote,
  CreditCard,
  Layers,
  CheckCircle2,
  AlertTriangle,
  X,
  Phone,
  ArrowRight,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
  Clock,
  ChevronRight
} from 'lucide-react';
import MpesaPhoneSim from './MpesaPhoneSim';

export default function PaymentModal({
  cartTotal,
  subtotal,
  discount,
  pointsRedeemed,
  customer,
  cartItems,
  cashierName = 'Chepngeno Mary',
  onClose,
  onPaymentSuccess
}) {
  const [selectedMethod, setSelectedMethod] = useState('mpesa_stk'); // 'mpesa_stk', 'mpesa_manual', 'cash', 'split', 'card'
  
  // M-Pesa STK Push state
  const [phone, setPhone] = useState(customer?.phone || '0712345678');
  const [isSubmittingStk, setIsSubmittingStk] = useState(false);
  const [stkData, setStkData] = useState(null);
  const [stkStatus, setStkStatus] = useState(null); // 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'
  const [stkReceipt, setStkReceipt] = useState(null);
  const [countdown, setCountdown] = useState(60);
  const [errorMessage, setErrorMessage] = useState('');

  // M-Pesa Manual Code state
  const [manualCode, setManualCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [manualVerified, setManualVerified] = useState(false);

  // Cash state
  const [cashTendered, setCashTendered] = useState(cartTotal);
  const changeDue = Math.max(0, (parseFloat(cashTendered) || 0) - cartTotal);

  // Split state
  const [splitCash, setSplitCash] = useState(Math.floor(cartTotal / 2));
  const splitMpesa = Math.max(0, cartTotal - (parseFloat(splitCash) || 0));

  // Card state
  const [cardAuthCode, setCardAuthCode] = useState('');

  const pollingRef = useRef(null);
  const timerRef = useRef(null);

  // Quick test numbers in Litein
  const demoPhones = [
    { name: 'John Kiprono', phone: '0712345678' },
    { name: 'Faith Chepkoech', phone: '0723456789' },
    { name: 'Evans Mutai', phone: '0701987654' },
    { name: 'Mercy Cherotich', phone: '0798112233' }
  ];

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle M-Pesa STK Push initiation
  const handleInitiateStk = async () => {
    setErrorMessage('');
    setIsSubmittingStk(true);
    setStkStatus('PENDING');
    setCountdown(60);

    try {
      const res = await fetch('/api/mpesa/stkpush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          amount: selectedMethod === 'split' ? splitMpesa : cartTotal,
          reference: `GIFT-${Date.now().toString().slice(-4)}`,
          cashier: cashierName
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send M-Pesa prompt');
      }

      setStkData(data.data);

      // Start countdown
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start status polling
      startPolling(data.data.checkoutRequestId);
    } catch (err) {
      setErrorMessage(err.message);
      setStkStatus(null);
    } finally {
      setIsSubmittingStk(false);
    }
  };

  // Status Poller
  const startPolling = (checkoutRequestId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mpesa/query/${checkoutRequestId}`);
        const data = await res.json();

        if (data.success) {
          if (data.status === 'SUCCESS') {
            clearInterval(pollingRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            setStkStatus('SUCCESS');
            setStkReceipt(data.mpesaReceipt);
            celebrateAndComplete(data.mpesaReceipt, phone, 'mpesa_stk');
          } else if (data.status === 'FAILED' || data.status === 'CANCELLED' || data.status === 'TIMEOUT') {
            clearInterval(pollingRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            setStkStatus(data.status);
            setErrorMessage(data.resultDesc || `Payment ${data.status.toLowerCase()}`);
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1500);
  };

  // Simulate customer action on phone
  const handleSimulateAction = async (action, pin) => {
    if (!stkData?.checkoutRequestId) return;
    try {
      const res = await fetch('/api/mpesa/simulate-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutRequestId: stkData.checkoutRequestId,
          action,
          pin
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Celebrate with confetti & trigger sale completion
  const celebrateAndComplete = async (mpesaRef, senderPhone, method) => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      // Complete sale in backend
      const payload = {
        items: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity
        })),
        payment_method: method || selectedMethod,
        cashier_name: cashierName,
        customer_id: customer?.id || null,
        customer_name: customer?.name || null,
        customer_phone: customer?.phone || (method.startsWith('mpesa') ? senderPhone : null),
        discount_amount: discount || 0,
        points_redeemed: pointsRedeemed || 0,
        mpesa_reference: mpesaRef || null,
        mpesa_phone: senderPhone || null,
        cash_tendered: method === 'cash' ? parseFloat(cashTendered) : 0,
        split_cash_amount: method === 'split' ? parseFloat(splitCash) : 0,
        split_mpesa_amount: method === 'split' ? parseFloat(splitMpesa) : 0
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to complete checkout');
      }

      setTimeout(() => {
        onPaymentSuccess(data.receipt);
      }, 800);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // Verify Manual M-PESA Code
  const handleVerifyManualCode = async () => {
    setErrorMessage('');
    setIsVerifyingCode(true);
    try {
      const res = await fetch('/api/mpesa/c2b-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: manualCode, amount: cartTotal })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      setManualVerified(true);
      await celebrateAndComplete(data.code, null, 'mpesa_manual');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Cash Checkout
  const handleCashCheckout = async () => {
    if (parseFloat(cashTendered) < cartTotal) {
      setErrorMessage(`Amount tendered (KES ${cashTendered}) is less than total KES ${cartTotal}`);
      return;
    }
    await celebrateAndComplete(null, null, 'cash');
  };

  // Split Checkout
  const handleSplitCheckout = async () => {
    const cashVal = parseFloat(splitCash) || 0;
    const mpesaVal = parseFloat(splitMpesa) || 0;
    if (Math.abs(cashVal + mpesaVal - cartTotal) > 0.01) {
      setErrorMessage(`Split sum does not match KES ${cartTotal}`);
      return;
    }
    // If M-Pesa portion exists, trigger STK or complete
    if (mpesaVal > 0 && !stkReceipt) {
      handleInitiateStk();
    } else {
      await celebrateAndComplete(stkReceipt || 'SPLIT-OK', phone, 'split');
    }
  };

  // Card Checkout
  const handleCardCheckout = async () => {
    await celebrateAndComplete(cardAuthCode || `AUTH-${Date.now().toString().slice(-6)}`, null, 'card');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative bg-slate-900 border border-slate-700 rounded-3xl max-w-5xl w-full p-6 shadow-2xl my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                GIFT-MART LITEIN CHECKOUT
              </span>
              <span className="text-xs text-slate-400">Till 5244101</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">Select Payment Method</h2>
          </div>

          <div className="text-right flex items-center space-x-4">
            <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-medium">Payable Amount</div>
              <div className="text-2xl font-black text-emerald-400">
                KES {cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-950/80 border border-rose-600/50 rounded-2xl text-rose-300 text-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Payment Methods Selection Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 my-5">
          <button
            onClick={() => setSelectedMethod('mpesa_stk')}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
              selectedMethod === 'mpesa_stk'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/30'
                : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs">M-PESA STK Push</span>
            <span className="text-[10px] text-emerald-400 font-medium">Prompt Phone</span>
          </button>

          <button
            onClick={() => setSelectedMethod('mpesa_manual')}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
              selectedMethod === 'mpesa_manual'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/30'
                : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-1.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs">M-PESA Manual</span>
            <span className="text-[10px] text-slate-400">Verify Code</span>
          </button>

          <button
            onClick={() => setSelectedMethod('cash')}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
              selectedMethod === 'cash'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/30'
                : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1.5">
              <Banknote className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs">Cash Tender</span>
            <span className="text-[10px] text-slate-400">Change Calc</span>
          </button>

          <button
            onClick={() => setSelectedMethod('split')}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
              selectedMethod === 'split'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/30'
                : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-1.5">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs">Split Payment</span>
            <span className="text-[10px] text-slate-400">Cash + M-Pesa</span>
          </button>

          <button
            onClick={() => setSelectedMethod('card')}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
              selectedMethod === 'card'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-500/30'
                : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-1.5">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="font-bold text-xs">Card / PDQ</span>
            <span className="text-[10px] text-slate-400">Debit / Credit</span>
          </button>
        </div>

        {/* Method Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
          {/* Main Left Action Section */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            {/* 1. M-PESA STK PUSH TAB */}
            {selectedMethod === 'mpesa_stk' && (
              <div className="space-y-5">
                <div className="bg-emerald-950/40 border border-emerald-600/40 rounded-2xl p-4">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>LIPA NA M-PESA ONLINE (STK PUSH PROMPT)</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Giftmart Litein will send an immediate pop-up notification directly to the customer's phone asking for their 4-digit M-Pesa PIN.
                  </p>
                </div>

                {/* Phone Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Customer Safaricom Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-5 h-5" />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0712345678 or 254712345678"
                      className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Quick Select Preset Phones */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 self-center mr-1">Frequent:</span>
                    {demoPhones.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPhone(p.phone)}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                          phone === p.phone
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {p.name.split(' ')[0]} ({p.phone.slice(-4)})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Indicator / Prompt Sent view */}
                {stkStatus === 'PENDING' && (
                  <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-3">
                    <div className="flex items-center justify-center space-x-2 text-emerald-400">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span className="font-bold text-sm">Prompt Sent to {phone}!</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Waiting for customer to enter PIN on handset (Expires in {countdown}s)
                    </p>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-1000"
                        style={{ width: `${(countdown / 60) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {stkStatus === 'SUCCESS' && (
                  <div className="bg-emerald-950/70 border border-emerald-500 rounded-2xl p-4 text-center space-y-2">
                    <div className="flex items-center justify-center space-x-2 text-emerald-300 font-bold text-base">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      <span>Payment Verified: Ref #{stkReceipt}</span>
                    </div>
                    <p className="text-xs text-emerald-200">
                      Customer authorized transaction. Generating thermal receipt...
                    </p>
                  </div>
                )}

                {/* STK Push Trigger Button */}
                <div>
                  <button
                    onClick={handleInitiateStk}
                    disabled={isSubmittingStk || (stkStatus === 'PENDING' && countdown > 0)}
                    className={`w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center space-x-3 shadow-xl transition-all ${
                      isSubmittingStk || (stkStatus === 'PENDING' && countdown > 0)
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 hover:scale-[1.01]'
                    }`}
                  >
                    {isSubmittingStk ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Sending Prompt to Phone...</span>
                      </>
                    ) : stkStatus === 'PENDING' ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Awaiting Customer PIN ({countdown}s)...</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-6 h-6" />
                        <span>SEND M-PESA PROMPT (KES {cartTotal.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-slate-400 mt-2">
                    Customer will receive full bill amount of KES {cartTotal.toLocaleString()} on Safaricom SIM Toolkit
                  </p>
                </div>
              </div>
            )}

            {/* 2. M-PESA MANUAL C2B / TILL TAB */}
            {selectedMethod === 'mpesa_manual' && (
              <div className="space-y-4">
                <div className="bg-sky-950/40 border border-sky-600/40 rounded-2xl p-4">
                  <div className="flex items-center space-x-2 text-sky-400 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    <span>LIPA NA M-PESA (BUY GOODS TILL 5244101)</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Enter the 10-character M-PESA confirmation code from the customer's SMS receipt (e.g. SI84KD92LQ).
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    M-PESA Confirmation Reference
                  </label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SI82KD91LA"
                    maxLength={12}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-lg tracking-widest focus:outline-none focus:border-sky-500 uppercase"
                  />
                  <div className="flex gap-2">
                    {['SI92K892LA', 'TK7182MN30', 'RL9802AA71'].map(c => (
                      <button
                        key={c}
                        onClick={() => setManualCode(c)}
                        className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700"
                      >
                        Sample: {c}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleVerifyManualCode}
                  disabled={isVerifyingCode || !manualCode || manualCode.length < 6}
                  className="w-full py-3.5 px-6 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-2xl shadow-lg shadow-sky-950/50 transition-all flex items-center justify-center space-x-2"
                >
                  {isVerifyingCode ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  <span>Verify Code & Complete Checkout</span>
                </button>
              </div>
            )}

            {/* 3. CASH TAB */}
            {selectedMethod === 'cash' && (
              <div className="space-y-4">
                <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-4">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                    <Banknote className="w-4 h-4" />
                    <span>CASH PAYMENT & INSTANT CHANGE CALCULATOR</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Enter amount received from customer or tap common Kenyan currency banknotes.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Cash Tendered (KES)
                  </label>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-2xl font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quick Banknote Buttons */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: 'Exact', val: cartTotal },
                    { label: '50', val: 50 },
                    { label: '100', val: 100 },
                    { label: '200', val: 200 },
                    { label: '500', val: 500 },
                    { label: '1,000', val: 1000 },
                    { label: '2,000', val: 2000 }
                  ].map((b, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashTendered(b.val)}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-600 active:text-white rounded-xl text-xs font-bold text-slate-200 border border-slate-700 transition-colors"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* Change Due Box */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  changeDue >= 0
                    ? 'bg-slate-900/90 border-slate-800 text-white'
                    : 'bg-rose-950/40 border-rose-600 text-rose-300'
                }`}>
                  <div>
                    <div className="text-xs text-slate-400 font-medium uppercase">Change Due to Customer</div>
                    <div className="text-3xl font-black text-emerald-400">
                      KES {changeDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  {changeDue > 0 && (
                    <div className="text-xs text-right text-slate-400">
                      Return notes/coins to customer
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCashCheckout}
                  disabled={cashTendered < cartTotal}
                  className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirm Cash Sale & Open Register</span>
                </button>
              </div>
            )}

            {/* 4. SPLIT PAYMENT TAB */}
            {selectedMethod === 'split' && (
              <div className="space-y-4">
                <div className="bg-purple-950/40 border border-purple-600/40 rounded-2xl p-4">
                  <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                    <Layers className="w-4 h-4" />
                    <span>SPLIT CHECKOUT (CASH + M-PESA)</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Divide total between cash tender and M-Pesa prompt.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Cash Portion (KES)</label>
                    <input
                      type="number"
                      value={splitCash}
                      onChange={(e) => setSplitCash(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">M-Pesa Portion (KES)</label>
                    <div className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-emerald-400 font-mono text-lg font-bold">
                      KES {splitMpesa.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">Customer Phone for M-Pesa Portion</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <button
                  onClick={handleSplitCheckout}
                  className="w-full py-3.5 px-6 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <Smartphone className="w-5 h-5" />
                  <span>Send M-Pesa Prompt for KES {splitMpesa.toLocaleString()}</span>
                </button>
              </div>
            )}

            {/* 5. CARD / PDQ TAB */}
            {selectedMethod === 'card' && (
              <div className="space-y-4">
                <div className="bg-indigo-950/40 border border-indigo-600/40 rounded-2xl p-4">
                  <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
                    <CreditCard className="w-4 h-4" />
                    <span>PDQ CARD TERMINAL (VISA / MASTERCARD)</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Swipe or tap customer card on bank PDQ machine and record authorization approval code.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">Bank Authorization / Slip Code</label>
                  <input
                    type="text"
                    value={cardAuthCode}
                    onChange={(e) => setCardAuthCode(e.target.value)}
                    placeholder="e.g. AUTH-739201"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <button
                  onClick={handleCardCheckout}
                  className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirm Card Approval & Print</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Phone Simulator */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-6">
            <div className="text-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1">
                <Smartphone className="w-3.5 h-3.5" /> Customer Mobile Handset (Litein)
              </span>
              <span className="text-[11px] text-slate-400">Live preview of customer's screen during STK prompt</span>
            </div>

            <MpesaPhoneSim
              activePrompt={stkData}
              onSimulateAction={handleSimulateAction}
              isLoading={isSubmittingStk}
            />
          </div>
        </div>

        {/* Modal Footer Info */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap justify-between items-center text-xs text-slate-400">
          <div>
            Cashier: <span className="font-semibold text-slate-200">{cashierName}</span> • Terminal: Counter 01 Litein
          </div>
          <div>
            eTIMS Fiscalizer: <span className="text-emerald-400 font-semibold">Active & Synced</span>
          </div>
        </div>
      </div>
    </div>
  );
}
