const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// Generate unique formatted receipt number
function generateReceiptNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `GMT-${yyyy}${mm}${dd}`;

  // Find max receipt number today
  const lastSale = db.prepare(`
    SELECT receipt_number FROM sales
    WHERE receipt_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(`${datePrefix}-%`);

  let nextSequence = 1;
  if (lastSale && lastSale.receipt_number) {
    const parts = lastSale.receipt_number.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${datePrefix}-${String(nextSequence).padStart(4, '0')}`;
}

// CHECKOUT / COMPLETE SALE
router.post('/', (req, res) => {
  try {
    const {
      items,
      payment_method, // 'mpesa_stk', 'mpesa_manual', 'cash', 'split', 'card'
      cashier_name = 'Chepngeno Mary',
      counter_number = 'Counter 01',
      customer_id = null,
      customer_name = null,
      customer_phone = null,
      discount_amount = 0,
      points_redeemed = 0,
      mpesa_reference = null,
      mpesa_phone = null,
      cash_tendered = 0,
      split_cash_amount = 0,
      split_mpesa_amount = 0,
      notes = ''
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Checkout cart is empty' });
    }

    if (!payment_method) {
      return res.status(400).json({ success: false, error: 'Payment method is required' });
    }

    // Verify stock and calculate totals
    let subtotal = 0;
    let vatableTotal = 0; // Taxable A
    let exemptTotal = 0;  // Exempt E
    const verifiedItems = [];

    // Begin SQLite Transaction
    const executeSale = db.transaction(() => {
      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.id || item.product_id);
        if (!product) {
          throw new Error(`Product "${item.name}" with ID ${item.id} not found in database`);
        }

        const qty = parseInt(item.quantity) || 1;
        if (qty <= 0) {
          throw new Error(`Invalid quantity ${qty} for product "${product.name}"`);
        }

        if (product.stock_quantity < qty) {
          throw new Error(`Insufficient stock for "${product.name}". Only ${product.stock_quantity} available in Litein store.`);
        }

        const unitPrice = parseFloat(product.selling_price);
        const itemTotal = unitPrice * qty;
        const vatRate = parseFloat(product.vat_rate) || 0;

        if (vatRate > 0) {
          vatableTotal += itemTotal;
        } else {
          exemptTotal += itemTotal;
        }

        subtotal += itemTotal;

        verifiedItems.push({
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          unit_price: unitPrice,
          cost_price: parseFloat(product.cost_price),
          quantity: qty,
          vat_rate: vatRate,
          total_price: itemTotal,
          current_stock: product.stock_quantity
        });
      }

      // Calculations with inclusive VAT (Standard in Kenya)
      const discount = Math.max(0, parseFloat(discount_amount) || 0);
      const pointsDiscount = Math.max(0, parseInt(points_redeemed) || 0); // 1 point = 1 KES
      const totalDiscount = discount + pointsDiscount;
      const finalTotal = Math.max(0, subtotal - totalDiscount);

      // VAT inclusive: Gross Vatable = vatableTotal * (finalTotal / subtotal)
      const adjustedVatable = subtotal > 0 ? (vatableTotal * (finalTotal / subtotal)) : 0;
      const netTaxableAmount = adjustedVatable / 1.16;
      const vatAmount = adjustedVatable - netTaxableAmount;

      // Calculate Cash & Change
      let changeGiven = 0;
      if (payment_method === 'cash') {
        const tendered = parseFloat(cash_tendered) || finalTotal;
        if (tendered < finalTotal) {
          throw new Error(`Cash tendered (KES ${tendered}) is less than total amount (KES ${finalTotal})`);
        }
        changeGiven = tendered - finalTotal;
      } else if (payment_method === 'split') {
        const splitCash = parseFloat(split_cash_amount) || 0;
        const splitMpesa = parseFloat(split_mpesa_amount) || 0;
        if (Math.abs((splitCash + splitMpesa) - finalTotal) > 1) {
          throw new Error(`Split amounts (Cash: KES ${splitCash} + M-Pesa: KES ${splitMpesa}) do not equal total KES ${finalTotal}`);
        }
      }

      // Customer Points Earning
      const pointsEarned = Math.floor(finalTotal / 100); // 1 pt per KES 100

      // Generate Receipt Number
      const receiptNumber = generateReceiptNumber();

      // Deduct Stock and Log Inventory
      for (const item of verifiedItems) {
        const newStock = item.current_stock - item.quantity;
        db.prepare('UPDATE products SET stock_quantity = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
          .run(newStock, item.product_id);

        db.prepare(`
          INSERT INTO inventory_logs (product_id, change_type, quantity_change, previous_quantity, new_quantity, note, created_by)
          VALUES (?, 'sale', ?, ?, ?, ?, ?)
        `).run(
          item.product_id,
          -item.quantity,
          item.current_stock,
          newStock,
          `Sale Receipt #${receiptNumber}`,
          cashier_name
        );
      }

      // Handle Customer Points & Spend Update
      if (customer_id) {
        const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
        if (cust) {
          const updatedPoints = Math.max(0, cust.loyalty_points - pointsDiscount + pointsEarned);
          const updatedSpent = cust.total_spent + finalTotal;
          const updatedVisits = cust.visits_count + 1;

          db.prepare(`
            UPDATE customers
            SET loyalty_points = ?, total_spent = ?, visits_count = ?
            WHERE id = ?
          `).run(updatedPoints, updatedSpent, updatedVisits, customer_id);
        }
      }

      // Insert Sale
      const insertSaleStmt = db.prepare(`
        INSERT INTO sales (
          receipt_number, cashier_name, counter_number, customer_id, customer_name, customer_phone,
          subtotal, discount_amount, vat_amount, total_amount, payment_method, payment_status,
          mpesa_reference, mpesa_phone, cash_tendered, change_given, split_cash_amount, split_mpesa_amount,
          points_earned, points_redeemed, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const saleResult = insertSaleStmt.run(
        receiptNumber,
        cashier_name,
        counter_number,
        customer_id || null,
        customer_name || null,
        customer_phone || null,
        subtotal,
        totalDiscount,
        vatAmount,
        finalTotal,
        payment_method,
        mpesa_reference || (payment_method.startsWith('mpesa') ? 'MPESA-TX' : null),
        mpesa_phone || null,
        parseFloat(cash_tendered) || 0,
        changeGiven,
        parseFloat(split_cash_amount) || 0,
        parseFloat(split_mpesa_amount) || 0,
        pointsEarned,
        pointsDiscount,
        notes
      );

      const saleId = saleResult.lastInsertRowid;

      // Insert Sale Items
      const insertItemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, barcode, product_name, unit_price, cost_price, quantity, vat_rate, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of verifiedItems) {
        insertItemStmt.run(
          saleId,
          item.product_id,
          item.barcode,
          item.product_name,
          item.unit_price,
          item.cost_price,
          item.quantity,
          item.vat_rate,
          item.total_price
        );
      }

      // If M-Pesa transaction reference matches pending STK transaction, update it
      if (mpesa_reference) {
        db.prepare(`
          UPDATE mpesa_transactions
          SET sale_id = ?
          WHERE mpesa_receipt_number = ?
        `).run(saleId, mpesa_reference);
      }

      // System Audit Log
      db.prepare(`
        INSERT INTO audit_logs (event_type, description, details, performed_by)
        VALUES ('SALE_COMPLETED', ?, ?, ?)
      `).run(
        `Completed checkout #${receiptNumber} for KES ${finalTotal} via ${payment_method}`,
        `Items: ${verifiedItems.length}, Cashier: ${cashier_name}, Customer: ${customer_name || 'Walk-in'}`,
        cashier_name
      );

      // Generate KRA eTIMS Fiscal Hash
      const etimsData = `KRA|P051839201Z|${receiptNumber}|${new Date().toISOString()}|${finalTotal.toFixed(2)}`;
      const etimsHash = crypto.createHash('sha256').update(etimsData).digest('hex').substring(0, 16).toUpperCase();

      return {
        saleId,
        receiptNumber,
        receiptDate: new Date().toISOString(),
        cashier_name,
        counter_number,
        customer_name,
        customer_phone,
        subtotal,
        discount_amount: totalDiscount,
        netTaxableAmount,
        vat_amount: vatAmount,
        exemptTotal,
        total_amount: finalTotal,
        payment_method,
        mpesa_reference,
        mpesa_phone,
        cash_tendered: parseFloat(cash_tendered) || 0,
        change_given: changeGiven,
        split_cash_amount: parseFloat(split_cash_amount) || 0,
        split_mpesa_amount: parseFloat(split_mpesa_amount) || 0,
        points_earned: pointsEarned,
        points_redeemed: pointsDiscount,
        items: verifiedItems,
        etims: {
          pin: 'P051839201Z',
          cuNumber: 'KRA-ETIMS-LTN-004812',
          signature: etimsHash,
          qrPayload: `https://itax.kra.go.ke/etims/verify?cu=KRA-ETIMS-LTN-004812&rcpt=${receiptNumber}&amt=${finalTotal.toFixed(2)}&sig=${etimsHash}`
        }
      };
    });

    const receipt = executeSale();
    res.status(201).json({ success: true, receipt });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET SALES HISTORY
router.get('/', (req, res) => {
  try {
    const { search, method, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (receipt_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR mpesa_reference LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (method && method !== 'all') {
      query += ' AND payment_method = ?';
      params.push(method);
    }

    if (startDate) {
      query += ' AND date(created_at) >= date(?)';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date(created_at) <= date(?)';
      params.push(endDate);
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const sales = db.prepare(query).all(...params);

    // Get item counts for each sale
    const enrichedSales = sales.map(s => {
      const itemsCount = db.prepare('SELECT count(*) as count, sum(quantity) as total_qty FROM sale_items WHERE sale_id = ?').get(s.id);
      return {
        ...s,
        item_count: itemsCount.count,
        total_quantity: itemsCount.total_qty || 0
      };
    });

    // Summary stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN payment_method LIKE '%mpesa%' THEN total_amount ELSE 0 END), 0) as mpesa_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_revenue
      FROM sales WHERE payment_status = 'COMPLETED'
    `).get();

    res.json({
      success: true,
      stats,
      sales: enrichedSales
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET SINGLE SALE DETAILS (Full Receipt with Items)
router.get('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? OR receipt_number = ?').get(id, id);

    if (!sale) {
      return res.status(404).json({ success: false, error: 'Sale receipt not found' });
    }

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);

    // KRA eTIMS Signature reconstruction
    const etimsData = `KRA|P051839201Z|${sale.receipt_number}|${sale.created_at}|${sale.total_amount.toFixed(2)}`;
    const etimsHash = crypto.createHash('sha256').update(etimsData).digest('hex').substring(0, 16).toUpperCase();

    res.json({
      success: true,
      receipt: {
        ...sale,
        items,
        etims: {
          pin: 'P051839201Z',
          cuNumber: 'KRA-ETIMS-LTN-004812',
          signature: etimsHash,
          qrPayload: `https://itax.kra.go.ke/etims/verify?cu=KRA-ETIMS-LTN-004812&rcpt=${sale.receipt_number}&amt=${sale.total_amount.toFixed(2)}&sig=${etimsHash}`
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// REFUND / RETURN TRANSACTION
router.post('/:id/refund', (req, res) => {
  try {
    const id = req.params.id;
    const { reason = 'Customer Return', cashier = 'Supervisor' } = req.body;

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (sale.payment_status === 'REFUNDED') {
      return res.status(400).json({ success: false, error: 'This transaction has already been refunded' });
    }

    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);

    const executeRefund = db.transaction(() => {
      // Restock items
      for (const item of items) {
        const prod = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(item.product_id);
        if (prod) {
          const newQty = prod.stock_quantity + item.quantity;
          db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newQty, item.product_id);

          db.prepare(`
            INSERT INTO inventory_logs (product_id, change_type, quantity_change, previous_quantity, new_quantity, note, created_by)
            VALUES (?, 'return', ?, ?, ?, ?, ?)
          `).run(item.product_id, item.quantity, prod.stock_quantity, newQty, `Refund for Receipt #${sale.receipt_number}`, cashier);
        }
      }

      // Revert loyalty points if customer was attached
      if (sale.customer_id) {
        const cust = db.prepare('SELECT loyalty_points, total_spent FROM customers WHERE id = ?').get(sale.customer_id);
        if (cust) {
          const newPoints = Math.max(0, cust.loyalty_points - sale.points_earned + sale.points_redeemed);
          const newSpent = Math.max(0, cust.total_spent - sale.total_amount);
          db.prepare('UPDATE customers SET loyalty_points = ?, total_spent = ? WHERE id = ?').run(newPoints, newSpent, sale.customer_id);
        }
      }

      // Mark sale as REFUNDED
      db.prepare('UPDATE sales SET payment_status = \'REFUNDED\', notes = notes || \' [REFUNDED: \' || ? || \']\' WHERE id = ?')
        .run(reason, id);

      // Audit Log
      db.prepare(`
        INSERT INTO audit_logs (event_type, description, details, performed_by)
        VALUES ('SALE_REFUNDED', ?, ?, ?)
      `).run(`Refunded Receipt #${sale.receipt_number} (KES ${sale.total_amount})`, `Reason: ${reason}`, cashier);
    });

    executeRefund();
    res.json({ success: true, message: `Receipt #${sale.receipt_number} refunded successfully. Stock restored.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET DAILY STATS & OVERVIEW
router.get('/stats/daily', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todayStats = db.prepare(`
      SELECT
        COUNT(*) as transactions_count,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_method LIKE '%mpesa%' THEN total_amount ELSE 0 END), 0) as mpesa_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'split' THEN total_amount ELSE 0 END), 0) as split_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
        COALESCE(AVG(total_amount), 0) as average_basket
      FROM sales
      WHERE date(created_at) = date(?) AND payment_status = 'COMPLETED'
    `).get(today);

    // Low stock count
    const lowStockCount = db.prepare('SELECT count(*) as count FROM products WHERE stock_quantity <= reorder_level AND is_active = 1').get().count;

    // Top selling products today
    const topProducts = db.prepare(`
      SELECT p.name, p.category, SUM(si.quantity) as total_sold, SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.payment_status = 'COMPLETED'
      GROUP BY si.product_id
      ORDER BY total_sold DESC
      LIMIT 5
    `).all();

    res.json({
      success: true,
      date: today,
      stats: todayStats,
      lowStockCount,
      topProducts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// HELD CARTS (SUSPEND & RECALL)
router.get('/held-carts', (req, res) => {
  try {
    const carts = db.prepare('SELECT * FROM held_carts ORDER BY id DESC').all();
    const formatted = carts.map(c => ({
      ...c,
      items: JSON.parse(c.items_json)
    }));
    res.json({ success: true, heldCarts: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/held-carts', (req, res) => {
  try {
    const { cart_title, customer_id, customer_name, customer_phone, items, subtotal } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot hold an empty cart' });
    }

    const insert = db.prepare(`
      INSERT INTO held_carts (cart_title, customer_id, customer_name, customer_phone, items_json, subtotal, item_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const title = cart_title || `Cart #${Date.now().toString().slice(-4)} (${customer_name || 'Walk-in'})`;
    const result = insert.run(
      title,
      customer_id || null,
      customer_name || null,
      customer_phone || null,
      JSON.stringify(items),
      parseFloat(subtotal) || 0,
      items.length
    );

    res.status(201).json({ success: true, heldCartId: result.lastInsertRowid, title });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/held-carts/:id', (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('DELETE FROM held_carts WHERE id = ?').run(id);
    res.json({ success: true, message: 'Held cart removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
