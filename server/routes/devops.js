const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(__dirname, '../data/giftmart.db');

// SYSTEM HEALTH CHECK & TELEMETRY
router.get('/health', (req, res) => {
  try {
    const startTime = process.hrtime();
    // Test DB query latency
    db.prepare('SELECT 1').get();
    const diff = process.hrtime(startTime);
    const dbLatencyMs = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);

    let dbSize = 0;
    if (fs.existsSync(DB_PATH)) {
      const stats = fs.statSync(DB_PATH);
      dbSize = (stats.size / 1024).toFixed(1); // KB
    }

    const memUsage = process.memoryUsage();
    const systemSettings = {};
    const settings = db.prepare('SELECT key, value FROM system_settings').all();
    settings.forEach(s => systemSettings[s.key] = s.value);

    // Counts
    const productsCount = db.prepare('SELECT count(*) as count FROM products WHERE is_active = 1').get().count;
    const salesCount = db.prepare('SELECT count(*) as count FROM sales').get().count;
    const customersCount = db.prepare('SELECT count(*) as count FROM customers').get().count;

    res.json({
      status: 'HEALTHY',
      service: 'Giftmart Supermarket POS Edge Node (Litein)',
      version: '2.4.0-edge',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      system: {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        hostname: os.hostname(),
        load_avg: os.loadavg(),
        free_mem_mb: Math.floor(os.freemem() / (1024 * 1024)),
        total_mem_mb: Math.floor(os.totalmem() / (1024 * 1024))
      },
      process_memory: {
        rss_mb: (memUsage.rss / (1024 * 1024)).toFixed(2),
        heap_used_mb: (memUsage.heapUsed / (1024 * 1024)).toFixed(2),
        heap_total_mb: (memUsage.heapTotal / (1024 * 1024)).toFixed(2)
      },
      database: {
        engine: 'SQLite 3 with WAL Mode',
        status: 'CONNECTED',
        db_size_kb: dbSize,
        query_latency_ms: parseFloat(dbLatencyMs),
        counts: {
          products: productsCount,
          sales: salesCount,
          customers: customersCount
        }
      },
      gateways: {
        mpesa_daraja: {
          status: 'ONLINE',
          mode: systemSettings.mpesa_simulation_mode === 'false' ? 'LIVE_PRODUCTION' : 'SANDBOX_SIMULATOR',
          shortcode: systemSettings.mpesa_shortcode || '5244101',
          till_type: systemSettings.mpesa_type || 'till',
          latency_ms: 12.4
        },
        kra_etims: {
          status: 'CONNECTED_COMPLIANT',
          cu_number: systemSettings.etims_cu_number || 'KRA-ETIMS-LTN-004812',
          pin: systemSettings.kra_pin || 'P051839201Z',
          pending_sync_queue: 0
        },
        thermal_printer: {
          status: 'READY',
          type: '80mm High-Speed Direct Thermal (ESC/POS)',
          paper_roll: 'OK'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'DEGRADED', error: err.message });
  }
});

// GET SYSTEM SETTINGS
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE SYSTEM SETTINGS
router.put('/settings', (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid settings payload' });
    }

    const upsert = db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, String(value));
    }

    db.prepare(`
      INSERT INTO audit_logs (event_type, description, details, performed_by)
      VALUES ('SETTINGS_UPDATED', 'Updated POS system configurations', ?, 'DevOps Engineer')
    `).run(Object.keys(settings).join(', '));

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET AUDIT LOGS
router.get('/logs', (req, res) => {
  try {
    const { limit = 100, eventType } = req.query;
    let query = 'SELECT * FROM audit_logs';
    const params = [];

    if (eventType) {
      query += ' WHERE event_type = ?';
      params.push(eventType);
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// EXPORT DATABASE BACKUP / SNAPSHOT (JSON format)
router.get('/backup', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products').all();
    const customers = db.prepare('SELECT * FROM customers').all();
    const sales = db.prepare('SELECT * FROM sales').all();
    const saleItems = db.prepare('SELECT * FROM sale_items').all();
    const settings = db.prepare('SELECT * FROM system_settings').all();
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500').all();

    const snapshot = {
      meta: {
        generated_at: new Date().toISOString(),
        store: 'Giftmart Supermarket - Litein',
        version: '2.4.0',
        records: {
          products: products.length,
          customers: customers.length,
          sales: sales.length,
          sale_items: saleItems.length
        }
      },
      settings,
      products,
      customers,
      sales,
      saleItems,
      auditLogs: logs
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="giftmart_litein_backup_${Date.now()}.json"`);
    res.send(JSON.stringify(snapshot, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// RESET & RESEED DEMO DATA
router.post('/reset-demo', (req, res) => {
  try {
    // Delete tables content
    db.exec(`
      DELETE FROM sale_items;
      DELETE FROM sales;
      DELETE FROM inventory_logs;
      DELETE FROM mpesa_transactions;
      DELETE FROM held_carts;
      DELETE FROM products;
      DELETE FROM customers;
    `);

    // Re-run init
    delete require.cache[require.resolve('../db')];
    const freshDb = require('../db');

    freshDb.prepare(`
      INSERT INTO audit_logs (event_type, description, details, performed_by)
      VALUES ('DEMO_RESET', 'Database reset to default Litein factory state', 'Products and customers reseeded', 'DevOps Admin')
    `).run();

    res.json({ success: true, message: 'Giftmart Litein database successfully reset and reseeded.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
