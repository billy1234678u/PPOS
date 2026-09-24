const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all products with filtering, search, and low stock flags
router.get('/', (req, res) => {
  try {
    const { search, category, lowStock } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (lowStock === 'true') {
      query += ' AND stock_quantity <= reorder_level';
    }

    query += ' ORDER BY name ASC';

    const products = db.prepare(query).all(...params);

    // Get unique categories
    const categories = db.prepare('SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category ASC').all().map(c => c.category);

    res.json({
      success: true,
      count: products.length,
      categories,
      products
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single product by ID or barcode
router.get('/:idOrBarcode', (req, res) => {
  try {
    const param = req.params.idOrBarcode;
    let product;

    if (/^\d{8,}$/.test(param)) {
      // Treat as barcode
      product = db.prepare('SELECT * FROM products WHERE barcode = ? AND is_active = 1').get(param);
    }

    if (!product) {
      product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(param);
    }

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE new product
router.post('/', (req, res) => {
  try {
    const {
      barcode,
      name,
      category,
      cost_price,
      selling_price,
      stock_quantity = 0,
      reorder_level = 10,
      unit = 'pcs',
      vat_rate = 0.16,
      image_icon = 'package'
    } = req.body;

    if (!barcode || !name || !category || selling_price === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required product fields' });
    }

    // Check duplicate barcode
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
    if (existing) {
      return res.status(409).json({ success: false, error: `Product with barcode ${barcode} already exists` });
    }

    const insert = db.prepare(`
      INSERT INTO products (barcode, name, category, cost_price, selling_price, stock_quantity, reorder_level, unit, vat_rate, image_icon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      barcode.trim(),
      name.trim(),
      category.trim(),
      parseFloat(cost_price) || 0,
      parseFloat(selling_price) || 0,
      parseInt(stock_quantity) || 0,
      parseInt(reorder_level) || 10,
      unit,
      parseFloat(vat_rate) || 0.16,
      image_icon
    );

    // Log to inventory logs
    db.prepare(`
      INSERT INTO inventory_logs (product_id, change_type, quantity_change, previous_quantity, new_quantity, note, created_by)
      VALUES (?, 'restock', ?, 0, ?, 'Initial inventory addition', 'Store Manager')
    `).run(result.lastInsertRowid, parseInt(stock_quantity) || 0, parseInt(stock_quantity) || 0);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (event_type, description, details, performed_by)
      VALUES ('PRODUCT_CREATED', ?, ?, 'Store Manager')
    `).run(`Created product ${name} (${barcode})`, `Price: KES ${selling_price}, Initial Stock: ${stock_quantity}`);

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, product: newProduct });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE product
router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const {
      name,
      category,
      cost_price,
      selling_price,
      reorder_level,
      unit,
      vat_rate,
      barcode
    } = req.body;

    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    db.prepare(`
      UPDATE products
      SET name = COALESCE(?, name),
          category = COALESCE(?, category),
          cost_price = COALESCE(?, cost_price),
          selling_price = COALESCE(?, selling_price),
          reorder_level = COALESCE(?, reorder_level),
          unit = COALESCE(?, unit),
          vat_rate = COALESCE(?, vat_rate),
          barcode = COALESCE(?, barcode),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      category ? category.trim() : null,
      cost_price !== undefined ? parseFloat(cost_price) : null,
      selling_price !== undefined ? parseFloat(selling_price) : null,
      reorder_level !== undefined ? parseInt(reorder_level) : null,
      unit || null,
      vat_rate !== undefined ? parseFloat(vat_rate) : null,
      barcode ? barcode.trim() : null,
      id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ADJUST OR RESTOCK product quantity
router.post('/:id/stock', (req, res) => {
  try {
    const id = req.params.id;
    const { adjustment, change_type = 'restock', note = '', user = 'Inventory Clerk' } = req.body;

    const qty = parseInt(adjustment);
    if (isNaN(qty) || qty === 0) {
      return res.status(400).json({ success: false, error: 'Invalid adjustment quantity' });
    }

    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const newQty = current.stock_quantity + qty;
    if (newQty < 0) {
      return res.status(400).json({ success: false, error: `Insufficient stock. Current stock is ${current.stock_quantity}` });
    }

    db.prepare('UPDATE products SET stock_quantity = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(newQty, id);

    db.prepare(`
      INSERT INTO inventory_logs (product_id, change_type, quantity_change, previous_quantity, new_quantity, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, change_type, qty, current.stock_quantity, newQty, note || `Stock ${change_type} of ${qty} units`, user);

    res.json({
      success: true,
      product_id: id,
      previous_quantity: current.stock_quantity,
      new_quantity: newQty,
      change: qty
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Soft delete
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
    res.json({ success: true, message: 'Product archived successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
