const express = require('express');
const router = express.Router();
const db = require('../db');

// List customers with search
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM customers';
    const params = [];

    if (search) {
      query += ' WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY visits_count DESC, total_spent DESC';

    const customers = db.prepare(query).all(...params);
    res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quick lookup by phone for cashier checkout
router.get('/lookup', (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone query required' });
    }

    let cleanPhone = phone.trim().replace(/[\s\-]/g, '');
    let searchVariant = cleanPhone;
    if (cleanPhone.startsWith('+254')) searchVariant = cleanPhone.replace('+254', '0');
    else if (cleanPhone.startsWith('254')) searchVariant = cleanPhone.replace('254', '0');

    const customer = db.prepare(`
      SELECT * FROM customers
      WHERE phone = ? OR phone = ? OR phone LIKE ?
      LIMIT 1
    `).get(cleanPhone, searchVariant, `%${searchVariant.slice(-8)}%`);

    if (!customer) {
      return res.json({ success: true, found: false, customer: null });
    }

    res.json({ success: true, found: true, customer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Register new customer
router.post('/', (req, res) => {
  try {
    const { name, phone, email, address = 'Litein' } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Customer name and phone number are required' });
    }

    let cleanPhone = phone.trim().replace(/[\s\-\+]/g, '');
    if (cleanPhone.startsWith('254')) cleanPhone = '0' + cleanPhone.substring(3);

    const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(cleanPhone);
    if (existing) {
      return res.status(409).json({ success: false, error: `Customer with phone ${cleanPhone} already registered` });
    }

    const insert = db.prepare(`
      INSERT INTO customers (name, phone, email, address, loyalty_points, total_spent, visits_count)
      VALUES (?, ?, ?, ?, 10, 0, 0)
    `);

    // Give 10 bonus welcome loyalty points!
    const result = insert.run(name.trim(), cleanPhone, email ? email.trim() : null, address.trim());
    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (event_type, description, details, performed_by)
      VALUES ('CUSTOMER_REGISTERED', ?, ?, 'Cashier Terminal')
    `).run(`Registered customer ${name} (${cleanPhone})`, '10 welcome points awarded');

    res.status(201).json({ success: true, customer: newCustomer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get customer details with purchase history
router.get('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const purchases = db.prepare(`
      SELECT id, receipt_number, total_amount, payment_method, points_earned, created_at
      FROM sales
      WHERE customer_id = ?
      ORDER BY id DESC
      LIMIT 20
    `).all(id);

    res.json({ success: true, customer, purchases });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
