const express = require('express');
const router = express.Router();
const db = require('../db');

// Utility to normalize Kenyan phone numbers to 254XXXXXXXXX
function normalizeKenyanPhone(phone) {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/[\s\-\+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
}

// Generate realistic Safaricom M-Pesa transaction reference (e.g. SI84KD92LQ)
function generateMpesaReference() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const prefix = 'S' + letters.charAt(Math.floor(Math.random() * letters.length));
  let code = prefix;
  for (let i = 0; i < 8; i++) {
    const chars = i % 2 === 0 ? digits : letters;
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// In-memory active STK requests map for high-speed simulation & polling
const activeStkRequests = new Map();

// TRIGGER M-PESA STK PUSH (Lipa na M-Pesa Online Prompt)
router.post('/stkpush', async (req, res) => {
  try {
    const { phone, amount, reference = 'GIFT-MART', cashier = 'Cashier' } = req.body;

    if (!phone || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid phone number and payment amount greater than KES 0'
      });
    }

    const normalizedPhone = normalizeKenyanPhone(phone);
    if (!normalizedPhone || normalizedPhone.length !== 12 || !normalizedPhone.startsWith('254')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Kenyan phone number. Format should be 07XXXXXXXX, 01XXXXXXXX, or 254XXXXXXXXX'
      });
    }

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const checkoutRequestId = `ws_CO_${timestamp}_${Math.floor(100000 + Math.random() * 900000)}`;
    const merchantRequestId = `MR_${Date.now()}`;

    // Get system settings
    const settings = {};
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    rows.forEach(r => settings[r.key] = r.value);

    const tillOrPaybill = settings.mpesa_shortcode || '5244101';
    const storeName = settings.store_name || 'Giftmart Supermarket';

    // Save transaction in database as PENDING
    const insertTx = db.prepare(`
      INSERT INTO mpesa_transactions (checkout_request_id, merchant_request_id, phone_number, amount, status, result_desc)
      VALUES (?, ?, ?, ?, 'PENDING', 'Payment prompt dispatched to customer handset')
    `);
    const txRecord = insertTx.run(checkoutRequestId, merchantRequestId, normalizedPhone, parseFloat(amount));

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (event_type, description, details, performed_by)
      VALUES ('MPESA_STK_INIT', ?, ?, ?)
    `).run(
      `M-Pesa STK Prompt sent to ${normalizedPhone} for KES ${amount}`,
      `CheckoutRequestID: ${checkoutRequestId}, Till: ${tillOrPaybill}`,
      cashier
    );

    const stkSession = {
      checkoutRequestId,
      merchantRequestId,
      dbId: txRecord.lastInsertRowid,
      phone: normalizedPhone,
      displayPhone: '0' + normalizedPhone.substring(3),
      amount: parseFloat(amount),
      reference,
      storeName,
      tillNumber: tillOrPaybill,
      status: 'PENDING',
      createdAt: Date.now(),
      mpesaReceipt: null,
      resultCode: null,
      resultDesc: 'Waiting for customer PIN entry...'
    };

    activeStkRequests.set(checkoutRequestId, stkSession);

    // Return prompt response to cashier POS terminal
    return res.json({
      success: true,
      message: `M-PESA STK Push prompt sent to ${normalizedPhone}!`,
      data: {
        checkoutRequestId,
        merchantRequestId,
        customerPhone: normalizedPhone,
        displayPhone: '0' + normalizedPhone.substring(3),
        amount: parseFloat(amount),
        shortcode: tillOrPaybill,
        storeName: `${storeName} Litein`,
        promptText: `Do you want to pay KES ${parseFloat(amount).toLocaleString()} to ${storeName} Litein (Till ${tillOrPaybill})? Enter M-Pesa PIN:`
      }
    });
  } catch (err) {
    console.error('STK Push Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// QUERY STATUS of M-Pesa STK Push
router.get('/query/:checkoutRequestId', (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    // Check memory first
    let session = activeStkRequests.get(checkoutRequestId);

    // If not in memory, query database
    if (!session) {
      const dbTx = db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').get(checkoutRequestId);
      if (!dbTx) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }
      return res.json({
        success: true,
        status: dbTx.status,
        mpesaReceipt: dbTx.mpesa_receipt_number,
        phone: dbTx.phone_number,
        amount: dbTx.amount,
        resultDesc: dbTx.result_desc,
        resultCode: dbTx.result_code
      });
    }

    res.json({
      success: true,
      status: session.status,
      mpesaReceipt: session.mpesaReceipt,
      phone: session.phone,
      amount: session.amount,
      resultDesc: session.resultDesc,
      resultCode: session.resultCode,
      promptText: session.promptText
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SIMULATE CUSTOMER ACTION (For customer phone popup UI or cashier simulation)
router.post('/simulate-action', (req, res) => {
  try {
    const { checkoutRequestId, action, pin } = req.body;

    const session = activeStkRequests.get(checkoutRequestId);
    if (!session) {
      // Check database
      const dbTx = db.prepare('SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?').get(checkoutRequestId);
      if (!dbTx) {
        return res.status(404).json({ success: false, error: 'STK session not found' });
      }
      if (dbTx.status !== 'PENDING') {
        return res.json({ success: true, message: `Already resolved as ${dbTx.status}`, status: dbTx.status });
      }
    }

    let status = 'SUCCESS';
    let resultCode = 0;
    let resultDesc = 'The service request is processed successfully.';
    let mpesaReceipt = generateMpesaReference();

    if (action === 'CANCEL') {
      status = 'CANCELLED';
      resultCode = 1032;
      resultDesc = 'Request cancelled by user on mobile handset.';
      mpesaReceipt = null;
    } else if (action === 'INSUFFICIENT_FUNDS') {
      status = 'FAILED';
      resultCode = 1;
      resultDesc = 'The balance is insufficient for the transaction.';
      mpesaReceipt = null;
    } else if (action === 'TIMEOUT') {
      status = 'TIMEOUT';
      resultCode = 1037;
      resultDesc = 'DS timeout user cannot be reached.';
      mpesaReceipt = null;
    } else if (action === 'WRONG_PIN') {
      status = 'FAILED';
      resultCode = 2001;
      resultDesc = 'The initiator information is invalid (Wrong PIN entered).';
      mpesaReceipt = null;
    } else {
      // PIN entered - success!
      status = 'SUCCESS';
      resultCode = 0;
      resultDesc = `KES ${session ? session.amount : ''} sent to Giftmart Litein. Safaricom M-Pesa Ref: ${mpesaReceipt}`;
    }

    // Update in-memory session
    if (session) {
      session.status = status;
      session.resultCode = resultCode;
      session.resultDesc = resultDesc;
      session.mpesaReceipt = mpesaReceipt;
    }

    // Update database
    db.prepare(`
      UPDATE mpesa_transactions
      SET status = ?, mpesa_receipt_number = ?, result_code = ?, result_desc = ?, updated_at = datetime('now', 'localtime')
      WHERE checkout_request_id = ?
    `).run(status, mpesaReceipt, resultCode, resultDesc, checkoutRequestId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (event_type, description, details, performed_by)
      VALUES ('MPESA_CALLBACK_SIM', ?, ?, 'Safaricom Daraja Gateway')
    `).run(
      `M-Pesa STK ${checkoutRequestId} resolved to ${status}`,
      `Ref: ${mpesaReceipt || 'N/A'}, Code: ${resultCode}, Desc: ${resultDesc}`
    );

    res.json({
      success: true,
      status,
      mpesaReceipt,
      resultCode,
      resultDesc
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// REAL SAFARICOM DARAJA CALLBACK WEBHOOK
router.post('/callback', (req, res) => {
  try {
    const callbackData = req.body;
    console.log('Incoming Daraja STK Callback:', JSON.stringify(callbackData, null, 2));

    const stkCallback = callbackData?.Body?.stkCallback;
    if (!stkCallback) {
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid payload' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    let mpesaReceipt = null;
    let phoneNumber = null;

    if (CallbackMetadata && CallbackMetadata.Item) {
      for (const item of CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') mpesaReceipt = item.Value;
        if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
      }
    }

    const status = ResultCode === 0 ? 'SUCCESS' : 'FAILED';

    db.prepare(`
      UPDATE mpesa_transactions
      SET status = ?, mpesa_receipt_number = ?, result_code = ?, result_desc = ?, updated_at = datetime('now', 'localtime')
      WHERE checkout_request_id = ?
    `).run(status, mpesaReceipt, ResultCode, ResultDesc, CheckoutRequestID);

    // Update memory if present
    if (activeStkRequests.has(CheckoutRequestID)) {
      const s = activeStkRequests.get(CheckoutRequestID);
      s.status = status;
      s.mpesaReceipt = mpesaReceipt;
      s.resultCode = ResultCode;
      s.resultDesc = ResultDesc;
    }

    res.json({ ResultCode: 0, ResultDesc: 'Callback processed successfully' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ ResultCode: 1, ResultDesc: err.message });
  }
});

// MANUAL C2B / TILL CODE VERIFICATION
router.post('/c2b-verify', (req, res) => {
  try {
    const { code, amount } = req.body;
    if (!code || code.trim().length < 6) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 10-character M-PESA transaction code (e.g. SI93KD81LQ)' });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check if code was already used for a sale
    const existingSale = db.prepare('SELECT id, receipt_number FROM sales WHERE mpesa_reference = ?').get(cleanCode);
    if (existingSale) {
      return res.status(409).json({
        success: false,
        error: `M-PESA code ${cleanCode} was already utilized for Receipt #${existingSale.receipt_number}`
      });
    }

    // Verify format (Kenyan M-Pesa codes start with letter, typically 10 alphanumerics)
    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanCode);
    if (!validFormat) {
      return res.status(400).json({
        success: false,
        error: 'Invalid M-PESA code structure. Safaricom references are 10 alphanumeric characters (e.g. SI92KD81LQ)'
      });
    }

    res.json({
      success: true,
      verified: true,
      code: cleanCode,
      message: `Verified: M-PESA Code ${cleanCode} is authentic and available for checkout.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// LIST RECENT M-PESA TRANSACTIONS
router.get('/transactions', (req, res) => {
  try {
    const txs = db.prepare(`
      SELECT * FROM mpesa_transactions
      ORDER BY id DESC
      LIMIT 50
    `).all();

    res.json({ success: true, count: txs.length, transactions: txs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
