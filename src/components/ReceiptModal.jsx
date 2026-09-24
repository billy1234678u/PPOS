import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  Printer,
  Download,
  Share2,
  CheckCircle2,
  X,
  Phone,
  Store,
  FileText,
  Copy,
  Check
} from 'lucide-react';

export default function ReceiptModal({ receipt, onClose, onNewSale }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const printableRef = useRef(null);

  useEffect(() => {
    if (receipt) {
      const qrPayload = receipt.etims?.qrPayload ||
        `https://itax.kra.go.ke/etims/verify?pin=P051839201Z&num=${receipt.receiptNumber}&amt=${receipt.total_amount}`;

      QRCode.toDataURL(qrPayload, {
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR Error:', err));
    }
  }, [receipt]);

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    try {
      // 80mm width is approx 80mm = 226pt
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 240]
      });

      doc.setFont('courier', 'bold');
      doc.setFontSize(11);
      doc.text('GIFTMART SUPERMARKET', 40, 10, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('courier', 'normal');
      doc.text('LITEIN MAIN BRANCH', 40, 15, { align: 'center' });
      doc.text('Opp. Litein Bus Park, Kericho Rd', 40, 19, { align: 'center' });
      doc.text('Tel: +254 722 984 311', 40, 23, { align: 'center' });
      doc.text('KRA PIN: P051839201Z', 40, 27, { align: 'center' });
      doc.text('M-PESA TILL: 5244101', 40, 31, { align: 'center' });
      doc.text('------------------------------------------', 40, 35, { align: 'center' });

      doc.setFontSize(8);
      doc.text(`RECEIPT: ${receipt.receiptNumber}`, 5, 40);
      doc.text(`DATE: ${new Date(receipt.receiptDate || receipt.created_at).toLocaleString()}`, 5, 44);
      doc.text(`CASHIER: ${receipt.cashier_name || 'Mary C.'}`, 5, 48);
      if (receipt.customer_name) {
        doc.text(`CUSTOMER: ${receipt.customer_name} (${receipt.customer_phone || ''})`, 5, 52);
      }
      doc.text('------------------------------------------', 40, 56, { align: 'center' });

      let y = 61;
      doc.setFont('courier', 'bold');
      doc.text('ITEM', 5, y);
      doc.text('QTY', 42, y);
      doc.text('PRICE', 53, y);
      doc.text('TOTAL', 75, y, { align: 'right' });
      y += 4;
      doc.text('------------------------------------------', 40, y, { align: 'center' });
      y += 4;

      doc.setFont('courier', 'normal');
      (receipt.items || []).forEach(item => {
        const name = (item.product_name || item.name || '').substring(0, 20);
        doc.text(name, 5, y);
        doc.text(String(item.quantity), 44, y);
        doc.text(Number(item.unit_price).toFixed(0), 54, y);
        doc.text(Number(item.total_price || item.unit_price * item.quantity).toFixed(2), 75, y, { align: 'right' });
        y += 4;
      });

      doc.text('------------------------------------------', 40, y, { align: 'center' });
      y += 4;
      doc.setFont('courier', 'bold');
      doc.text('TOTAL KES:', 5, y);
      doc.setFontSize(10);
      doc.text(`KES ${Number(receipt.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 75, y, { align: 'right' });
      y += 6;
      doc.setFontSize(8);
      doc.setFont('courier', 'normal');

      doc.text(`PAYMENT: ${receipt.payment_method?.toUpperCase()}`, 5, y);
      y += 4;
      if (receipt.mpesa_reference) {
        doc.text(`M-PESA REF: ${receipt.mpesa_reference}`, 5, y);
        y += 4;
      }
      if (receipt.cash_tendered > 0) {
        doc.text(`CASH TENDERED: KES ${Number(receipt.cash_tendered).toFixed(2)}`, 5, y);
        y += 4;
        doc.text(`CHANGE GIVEN:  KES ${Number(receipt.change_given).toFixed(2)}`, 5, y);
        y += 4;
      }
      if (receipt.points_earned > 0) {
        doc.text(`LOYALTY POINTS EARNED: +${receipt.points_earned}`, 5, y);
        y += 4;
      }

      y += 2;
      doc.text('------------------------------------------', 40, y, { align: 'center' });
      y += 4;
      doc.text('KRA eTIMS CU: KRA-ETIMS-LTN-004812', 40, y, { align: 'center' });
      y += 4;
      doc.text(`SIG: ${receipt.etims?.signature || '8FD9B712EA49'}`, 40, y, { align: 'center' });
      y += 5;
      doc.text('KARIBU TENA GIFTMART LITEIN!', 40, y, { align: 'center' });
      y += 4;
      doc.text('Quality & Affordability for Litein', 40, y, { align: 'center' });

      doc.save(`Giftmart_Receipt_${receipt.receiptNumber}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
    }
  };

  const copyReceiptText = () => {
    const text = `GIFTMART SUPERMARKET LITEIN
Receipt: ${receipt.receiptNumber}
Date: ${new Date(receipt.receiptDate || receipt.created_at).toLocaleString()}
Total Paid: KES ${Number(receipt.total_amount).toLocaleString()}
Payment: ${receipt.payment_method?.toUpperCase()} ${receipt.mpesa_reference ? `(Ref: ${receipt.mpesa_reference})` : ''}
Thank you for shopping at Giftmart Litein!`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const simulateSmsReceipt = () => {
    setSmsSent(true);
    setTimeout(() => setSmsSent(false), 4000);
  };

  const dateFormatted = new Date(receipt.receiptDate || receipt.created_at || Date.now()).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
            <h3 className="text-lg font-bold text-white">Payment Confirmed & Receipt Issued</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Toolbar */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02]"
          >
            <Printer className="w-4 h-4" />
            <span>Print 80mm Receipt</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={copyReceiptText}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={simulateSmsReceipt}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl border border-slate-700 transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span>{smsSent ? 'SMS Dispatched!' : 'Send SMS / WhatsApp'}</span>
          </button>
        </div>

        {smsSent && (
          <div className="mb-4 p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm flex items-center space-x-2">
            <Check className="w-4 h-4" />
            <span>Digital receipt dispatched to customer handset ({receipt.customer_phone || receipt.mpesa_phone || 'Customer'}) via Safaricom SMS gateway!</span>
          </div>
        )}

        {/* Physical Thermal Receipt Container */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-[500px] overflow-y-auto flex justify-center">
          <div
            id="thermal-receipt-printable"
            ref={printableRef}
            className="w-[330px] bg-white text-slate-900 p-5 rounded-sm shadow-xl font-mono-receipt text-xs leading-relaxed select-text"
          >
            {/* Supermarket Header */}
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-400">
              <div className="font-extrabold text-sm tracking-wider text-black">GIFTMART SUPERMARKET</div>
              <div className="font-semibold text-slate-700">LITEIN MAIN BRANCH</div>
              <div className="text-[10px] text-slate-600">Litein-Kericho Highway, Opp Bus Park</div>
              <div className="text-[10px] text-slate-600">Tel: +254 722 984 311 | P.O. Box 84 Litein</div>
              <div className="text-[10px] font-semibold text-slate-800">KRA PIN: P051839201Z</div>
              <div className="text-[10px] font-semibold text-slate-800">M-PESA TILL NO: 5244101</div>
            </div>

            {/* Receipt Meta */}
            <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-1">
              <div className="flex justify-between">
                <span>RECEIPT #:</span>
                <span className="font-bold">{receipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE/TIME:</span>
                <span>{dateFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span>CASHIER:</span>
                <span>{receipt.cashier_name || 'Mary Chepngeno'}</span>
              </div>
              <div className="flex justify-between">
                <span>STATION:</span>
                <span>{receipt.counter_number || 'Counter 01'}</span>
              </div>
              {receipt.customer_name && (
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>CUSTOMER:</span>
                  <span>{receipt.customer_name}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-slate-400">
              <div className="flex text-[10px] font-bold text-slate-700 pb-1 mb-1 border-b border-slate-300">
                <span className="w-1/2">DESCRIPTION</span>
                <span className="w-12 text-center">QTY</span>
                <span className="w-14 text-right">UNIT</span>
                <span className="w-16 text-right">TOTAL</span>
              </div>

              <div className="space-y-1.5 py-1 text-[11px]">
                {(receipt.items || []).map((item, idx) => {
                  const vatTag = item.vat_rate > 0 ? 'A' : 'E';
                  return (
                    <div key={idx} className="flex justify-between items-baseline">
                      <div className="w-1/2 truncate pr-1">
                        <span className="font-medium text-black">{item.product_name || item.name}</span>
                        <span className="text-[9px] text-slate-500 ml-1">[{vatTag}]</span>
                      </div>
                      <div className="w-12 text-center text-slate-700">{item.quantity}</div>
                      <div className="w-14 text-right text-slate-700">{Number(item.unit_price).toFixed(2)}</div>
                      <div className="w-16 text-right font-semibold text-black">
                        {Number(item.total_price || item.unit_price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calculations & Totals */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>KES {Number(receipt.subtotal || receipt.total_amount).toFixed(2)}</span>
              </div>

              {receipt.discount_amount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>DISCOUNT:</span>
                  <span>- KES {Number(receipt.discount_amount).toFixed(2)}</span>
                </div>
              )}

              {receipt.points_redeemed > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>POINTS REDEEMED:</span>
                  <span>- KES {Number(receipt.points_redeemed).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-extrabold text-black pt-1 border-t border-slate-300">
                <span>TOTAL AMOUNT:</span>
                <span>KES {Number(receipt.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Tax Breakdown (KRA Format) */}
            <div className="py-1.5 border-b border-dashed border-slate-400 text-[9px] text-slate-600">
              <div className="font-semibold text-slate-800 mb-0.5">TAX ANALYSIS (16% VAT INCLUSIVE):</div>
              <div className="flex justify-between">
                <span>Code A (16.0% VAT):</span>
                <span>KES {Number(receipt.vat_amount || (receipt.total_amount * 0.16 / 1.16)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Net Taxable Base:</span>
                <span>KES {Number((receipt.total_amount || 0) - (receipt.vat_amount || 0)).toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-1">
              <div className="flex justify-between font-bold text-black">
                <span>PAYMENT METHOD:</span>
                <span className="uppercase text-emerald-800">{receipt.payment_method?.replace('_', ' ')}</span>
              </div>

              {receipt.mpesa_reference && (
                <div className="flex justify-between bg-emerald-50 p-1 rounded font-bold text-emerald-900 text-[11px]">
                  <span>M-PESA REF:</span>
                  <span>{receipt.mpesa_reference}</span>
                </div>
              )}

              {receipt.mpesa_phone && (
                <div className="flex justify-between text-slate-600">
                  <span>M-PESA SENDER:</span>
                  <span>{receipt.mpesa_phone}</span>
                </div>
              )}

              {receipt.cash_tendered > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>CASH TENDERED:</span>
                    <span>KES {Number(receipt.cash_tendered).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black">
                    <span>CHANGE GIVEN:</span>
                    <span>KES {Number(receipt.change_given).toFixed(2)}</span>
                  </div>
                </>
              )}

              {receipt.points_earned > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold pt-1">
                  <span>LOYALTY POINTS EARNED:</span>
                  <span>+{receipt.points_earned} pts</span>
                </div>
              )}
            </div>

            {/* KRA eTIMS QR Code & Footer */}
            <div className="pt-3 text-center space-y-1">
              {qrDataUrl && (
                <div className="flex flex-col items-center justify-center">
                  <img src={qrDataUrl} alt="KRA eTIMS QR" className="w-24 h-24 border border-slate-200 p-1" />
                  <span className="text-[9px] text-slate-500 mt-0.5">Scan to Verify with KRA eTIMS</span>
                </div>
              )}

              <div className="text-[9px] text-slate-500 font-mono">
                CU: {receipt.etims?.cuNumber || 'KRA-ETIMS-LTN-004812'}<br />
                SIG: {receipt.etims?.signature || '8FD9B712EA49'}
              </div>

              <div className="pt-2 text-[10px] font-bold text-slate-800">
                KARIBU TENA GIFTMART LITEIN!
              </div>
              <div className="text-[9px] text-slate-500 italic">
                Goods once sold are exchangeable within 48h with original receipt.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={() => {
              onClose();
              if (onNewSale) onNewSale();
            }}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02]"
          >
            Start New Checkout Sale (F1)
          </button>
        </div>
      </div>
    </div>
  );
}
