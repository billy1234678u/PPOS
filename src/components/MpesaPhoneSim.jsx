import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Wifi,
  Battery,
  Shield,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  Clock,
  Delete
} from 'lucide-react';

export default function MpesaPhoneSim({
  activePrompt,
  onSimulateAction,
  isLoading
}) {
  const [pin, setPin] = useState('');
  const [phoneState, setPhoneState] = useState('prompt'); // 'prompt', 'processing', 'success', 'failed'
  const [resultMessage, setResultMessage] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activePrompt) {
      setPin('');
      setPhoneState('prompt');
      setResultMessage('');
    }
  }, [activePrompt]);

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSendPin = async () => {
    if (pin.length < 4) return;
    setPhoneState('processing');

    try {
      const res = await onSimulateAction('PIN_ENTERED', pin);
      if (res && res.success) {
        setPhoneState('success');
        setResultMessage(res.mpesaReceipt || 'CONFIRMED');
      } else {
        setPhoneState('failed');
        setResultMessage('Payment declined by Safaricom');
      }
    } catch (err) {
      setPhoneState('failed');
      setResultMessage(err.message || 'Transaction error');
    }
  };

  const handleCancel = async () => {
    setPhoneState('processing');
    try {
      await onSimulateAction('CANCEL');
      setPhoneState('failed');
      setResultMessage('Request Cancelled by Customer');
    } catch (e) {
      setPhoneState('failed');
    }
  };

  const handleQuickFailure = async (type) => {
    setPhoneState('processing');
    try {
      await onSimulateAction(type);
      setPhoneState('failed');
      setResultMessage(type === 'INSUFFICIENT_FUNDS' ? 'Insufficient M-PESA Funds' : 'Transaction Timeout');
    } catch (e) {
      setPhoneState('failed');
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Phone Hardware Mockup */}
      <div className="w-[300px] h-[580px] bg-slate-950 rounded-[44px] p-3 shadow-2xl border-4 border-slate-700 relative flex flex-col justify-between overflow-hidden">
        {/* Dynamic Island / Speaker Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-black rounded-full mr-2 border border-slate-800" />
          <div className="w-8 h-1 bg-slate-800 rounded-full" />
        </div>

        {/* Screen Area */}
        <div className="w-full h-full bg-slate-900 rounded-[34px] flex flex-col overflow-hidden relative border border-slate-800 text-white">
          {/* Status Bar */}
          <div className="pt-2 px-5 pb-1 flex justify-between items-center text-[10px] text-slate-300 font-medium z-10">
            <span>{currentTime || '14:30'}</span>
            <span className="text-[9px] font-bold tracking-wider text-emerald-400">SAFARICOM 4G</span>
            <div className="flex items-center space-x-1.5">
              <Wifi className="w-3 h-3" />
              <Battery className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Background Wallpaper/Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
            <Smartphone className="w-48 h-48" />
          </div>

          {/* Screen Content */}
          <div className="flex-1 flex flex-col p-3 z-10 overflow-y-auto">
            {activePrompt ? (
              <>
                {/* Active Prompt View */}
                {phoneState === 'prompt' && (
                  <div className="my-auto flex flex-col">
                    {/* Safaricom SIM Toolkit / STK Push Box */}
                    <div className="bg-slate-800/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-xl text-center space-y-3 animate-in fade-in zoom-in duration-200">
                      <div className="flex items-center justify-center space-x-1.5 text-emerald-400">
                        <Shield className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">M-PESA SIM TOOLKIT</span>
                      </div>

                      <div className="text-xs text-slate-200 font-medium leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-700/60">
                        Do you want to pay <span className="font-bold text-emerald-400">KES {Number(activePrompt.amount).toLocaleString()}</span> to <br />
                        <span className="font-bold text-white">GIFTMART LITEIN</span><br />
                        <span className="text-[11px] text-slate-400">(Till {activePrompt.shortcode || '5244101'})</span>?
                      </div>

                      <div className="text-[11px] text-slate-300 font-medium">
                        Enter M-PESA PIN:
                      </div>

                      {/* PIN Dots */}
                      <div className="flex justify-center items-center space-x-3 py-1">
                        {[0, 1, 2, 3].map((idx) => (
                          <div
                            key={idx}
                            className={`w-4 h-4 rounded-full border-2 transition-all ${
                              pin.length > idx
                                ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/50'
                                : 'border-slate-600 bg-slate-900'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Modal Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={handleCancel}
                          className="py-2 px-3 bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-xl border border-rose-800/50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSendPin}
                          disabled={pin.length < 4}
                          className={`py-2 px-3 text-xs font-bold rounded-xl transition-all shadow-md ${
                            pin.length === 4
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          Send (OK)
                        </button>
                      </div>
                    </div>

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-1.5 mt-3 px-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <button
                          key={digit}
                          onClick={() => handleKeyPress(digit)}
                          className="h-10 bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold text-sm rounded-xl flex items-center justify-center transition-all border border-slate-700/50 shadow-sm"
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        onClick={handleDelete}
                        className="h-10 bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-400 font-semibold rounded-xl flex items-center justify-center transition-all border border-slate-700/50"
                      >
                        <Delete className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleKeyPress(0)}
                        className="h-10 bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold text-sm rounded-xl flex items-center justify-center transition-all border border-slate-700/50 shadow-sm"
                      >
                        0
                      </button>
                      <button
                        onClick={handleSendPin}
                        disabled={pin.length < 4}
                        className={`h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                          pin.length === 4
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}

                {/* Processing State */}
                {phoneState === 'processing' && (
                  <div className="my-auto flex flex-col items-center justify-center text-center p-4 space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <div>
                      <div className="text-sm font-bold text-white">Communicating with Safaricom</div>
                      <div className="text-xs text-slate-400 mt-1">Encrypting M-PESA PIN & authorizing payment...</div>
                    </div>
                  </div>
                )}

                {/* Success State */}
                {phoneState === 'success' && (
                  <div className="my-auto flex flex-col items-center justify-center text-center p-4 space-y-3">
                    <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/40">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="text-sm font-bold text-emerald-300">Payment Confirmed!</div>
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-left text-[11px] text-slate-300 leading-relaxed font-mono">
                      <span className="font-bold text-white">{resultMessage}</span> Confirmed. KES {Number(activePrompt.amount).toLocaleString()} paid to GIFT-MART SUPERMARKET LITEIN Till {activePrompt.shortcode || '5244101'} on {new Date().toLocaleDateString('en-GB')}. Thank you!
                    </div>
                  </div>
                )}

                {/* Failed State */}
                {phoneState === 'failed' && (
                  <div className="my-auto flex flex-col items-center justify-center text-center p-4 space-y-3">
                    <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center border border-rose-500/40">
                      <XCircle className="w-8 h-8" />
                    </div>
                    <div className="text-sm font-bold text-rose-300">Transaction Not Completed</div>
                    <div className="text-xs text-slate-400">{resultMessage}</div>
                  </div>
                )}
              </>
            ) : (
              /* Idle Phone Screen */
              <div className="my-auto flex flex-col items-center justify-center text-center p-6 space-y-3 text-slate-400">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center border border-slate-700 text-emerald-400">
                  <Smartphone className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-300">Customer Phone Ready</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    When cashier clicks "Send M-Pesa Prompt", the interactive Safaricom STK prompt will appear here.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Android / iOS Home Indicator */}
          <div className="pb-2 flex justify-center">
            <div className="w-24 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>
      </div>

      {/* Simulator DevOps Testing Controls */}
      {activePrompt && phoneState === 'prompt' && (
        <div className="mt-3 flex flex-wrap gap-1.5 justify-center max-w-[320px]">
          <button
            onClick={() => {
              setPin('1234');
              setTimeout(() => {
                onSimulateAction('PIN_ENTERED', '1234')
                  .then(res => {
                    setPhoneState('success');
                    setResultMessage(res.mpesaReceipt);
                  });
              }, 150);
            }}
            className="text-[10px] bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 px-2 py-1 rounded-lg font-medium transition-colors"
          >
            ⚡ Auto Enter PIN 1234
          </button>
          <button
            onClick={() => handleQuickFailure('INSUFFICIENT_FUNDS')}
            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg font-medium transition-colors"
          >
            Test Insufficient Funds
          </button>
          <button
            onClick={() => handleQuickFailure('TIMEOUT')}
            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg font-medium transition-colors"
          >
            Test Timeout
          </button>
        </div>
      )}
    </div>
  );
}
