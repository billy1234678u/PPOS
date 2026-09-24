const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'giftmart.db');
const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 10,
      unit TEXT NOT NULL DEFAULT 'pcs',
      vat_rate REAL NOT NULL DEFAULT 0.16,
      image_icon TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      address TEXT DEFAULT 'Litein',
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      visits_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      cashier_name TEXT NOT NULL,
      counter_number TEXT NOT NULL DEFAULT 'Counter 01',
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT,
      customer_phone TEXT,
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      vat_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL, -- mpesa_stk, mpesa_manual, cash, split, card
      payment_status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, REFUNDED, PENDING
      mpesa_reference TEXT,
      mpesa_phone TEXT,
      cash_tendered REAL DEFAULT 0,
      change_given REAL DEFAULT 0,
      split_cash_amount REAL DEFAULT 0,
      split_mpesa_amount REAL DEFAULT 0,
      points_earned INTEGER NOT NULL DEFAULT 0,
      points_redeemed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      barcode TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      vat_rate REAL NOT NULL DEFAULT 0.16,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mpesa_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkout_request_id TEXT UNIQUE NOT NULL,
      merchant_request_id TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      amount REAL NOT NULL,
      mpesa_receipt_number TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED, CANCELLED, TIMEOUT
      result_code INTEGER,
      result_desc TEXT,
      sale_id INTEGER REFERENCES sales(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      change_type TEXT NOT NULL, -- sale, restock, adjustment, return
      quantity_change INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      note TEXT,
      created_by TEXT NOT NULL DEFAULT 'System Cashier',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS held_carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_title TEXT NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      item_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      details TEXT,
      performed_by TEXT NOT NULL DEFAULT 'System',
      ip_address TEXT DEFAULT '127.0.0.1',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Initialize Default System Settings
  const settingsCount = db.prepare('SELECT count(*) as cnt FROM system_settings').get().cnt;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)');
    insertSetting.run('store_name', 'Giftmart Supermarket');
    insertSetting.run('store_branch', 'Litein Main Branch');
    insertSetting.run('store_address', 'Opposite Litein Bus Park, Litein-Kericho Highway');
    insertSetting.run('store_town', 'Litein, Kericho County, Kenya');
    insertSetting.run('store_phone', '+254 722 984 311');
    insertSetting.run('store_email', 'litein@giftmart.co.ke');
    insertSetting.run('kra_pin', 'P051839201Z');
    insertSetting.run('etims_cu_number', 'KRA-ETIMS-LTN-004812');
    insertSetting.run('mpesa_shortcode', '5244101'); // Buy Goods Till
    insertSetting.run('mpesa_type', 'till'); // till or paybill
    insertSetting.run('mpesa_passkey', 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919');
    insertSetting.run('mpesa_consumer_key', 'GIFT_LITEIN_DARAJA_KEY_PROD_84');
    insertSetting.run('mpesa_consumer_secret', 'GIFT_LITEIN_DARAJA_SECRET_SEC_92');
    insertSetting.run('mpesa_callback_url', 'https://pos.giftmart-litein.co.ke/api/mpesa/callback');
    insertSetting.run('mpesa_simulation_mode', 'true'); // Auto simulator for local demo
    insertSetting.run('currency', 'KES');
    insertSetting.run('vat_percentage', '16');
  }

  // Seed Products if table is empty
  const productsCount = db.prepare('SELECT count(*) as cnt FROM products').get().cnt;
  if (productsCount === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const insertProduct = db.prepare(`
    INSERT INTO products (barcode, name, category, cost_price, selling_price, stock_quantity, reorder_level, unit, vat_rate, image_icon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialProducts = [
    // Dairy & Bakery
    ['616110000101', 'Brookside Fresh Whole Milk 500ml', 'Dairy & Eggs', 52.00, 65.00, 84, 20, 'pouch', 0.16, 'milk'],
    ['616110000102', 'KCC Gold Crown Long Life Milk 500ml', 'Dairy & Eggs', 58.00, 72.00, 65, 15, 'tetra', 0.16, 'milk'],
    ['616110000103', 'Ilara Traditional Mursik Milk 500ml', 'Dairy & Eggs', 55.00, 70.00, 32, 10, 'bottle', 0.16, 'bottle'],
    ['616110000104', 'Dairyland Strawberry Yoghurt 500ml', 'Dairy & Eggs', 85.00, 110.00, 24, 8, 'cup', 0.16, 'cup'],
    ['616110000105', 'Farm Fresh Kienyeji Eggs (Tray 30s)', 'Dairy & Eggs', 410.00, 520.00, 18, 5, 'tray', 0.00, 'egg'],
    ['616110000106', 'Supa Loaf Premium White Bread 400g', 'Bakery', 54.00, 65.00, 40, 15, 'loaf', 0.00, 'bread'],
    ['616110000107', 'Festive Sweet Sliced Bread 400g', 'Bakery', 53.00, 65.00, 36, 12, 'loaf', 0.00, 'bread'],
    ['616110000108', 'Broadways Wholemeal Brown Bread 400g', 'Bakery', 56.00, 70.00, 28, 10, 'loaf', 0.00, 'bread'],

    // Cereals, Flour & Grains
    ['616110000201', 'Pembe Fortified Maize Meal 2kg', 'Flour & Grains', 165.00, 195.00, 95, 25, 'packet', 0.00, 'wheat'],
    ['616110000202', 'Jogoo Extra Maize Meal 2kg', 'Flour & Grains', 170.00, 205.00, 80, 20, 'packet', 0.00, 'wheat'],
    ['616110000203', 'Soko Maize Meal 2kg', 'Flour & Grains', 160.00, 190.00, 45, 15, 'packet', 0.00, 'wheat'],
    ['616110000204', 'Exe All Purpose Wheat Flour 2kg', 'Flour & Grains', 180.00, 215.00, 60, 15, 'packet', 0.00, 'wheat'],
    ['616110000205', 'Daawat Traditional Basmati Rice 2kg', 'Flour & Grains', 390.00, 480.00, 35, 10, 'packet', 0.00, 'rice'],
    ['616110000206', 'Pearl Pishori Pure Rice 2kg', 'Flour & Grains', 410.00, 510.00, 22, 10, 'packet', 0.00, 'rice'],

    // Litein Tea & Hot Beverages
    ['616110000301', 'Kericho Gold Pure Kenya Tea 100 Bags', 'Tea & Coffee', 240.00, 310.00, 52, 12, 'box', 0.16, 'coffee'],
    ['616110000302', 'Ketepa Chai Pride Premium Loose Tea 250g', 'Tea & Coffee', 130.00, 165.00, 68, 15, 'packet', 0.16, 'coffee'],
    ['616110000303', 'Fahari Ya Kenya Rich Blend Tea 500g', 'Tea & Coffee', 210.00, 260.00, 40, 10, 'packet', 0.16, 'coffee'],
    ['616110000304', 'Kericho Gold Green Tea & Mint 25 Bags', 'Tea & Coffee', 145.00, 195.00, 25, 8, 'box', 0.16, 'coffee'],
    ['616110000305', 'Nescafe Classic Instant Coffee Jar 50g', 'Tea & Coffee', 230.00, 290.00, 19, 6, 'jar', 0.16, 'coffee'],
    ['616110000306', 'Cadbury Rich Hot Drinking Chocolate 200g', 'Tea & Coffee', 190.00, 245.00, 16, 5, 'tin', 0.16, 'coffee'],

    // Cooking Oil, Sugar & Spices
    ['616110000401', 'Kabras Pure Cane White Sugar 1kg', 'Cooking & Baking', 140.00, 165.00, 110, 25, 'packet', 0.16, 'sugar'],
    ['616110000402', 'Kabras Pure Cane White Sugar 2kg', 'Cooking & Baking', 275.00, 320.00, 85, 20, 'packet', 0.16, 'sugar'],
    ['616110000403', 'Rina Pure Vegetable Cooking Oil 2L', 'Cooking & Baking', 460.00, 545.00, 42, 10, 'jerrican', 0.16, 'oil'],
    ['616110000404', 'Fresh Fri Cooking Oil with Ginger 1L', 'Cooking & Baking', 240.00, 295.00, 50, 12, 'bottle', 0.16, 'oil'],
    ['616110000405', 'Elianto Pure Corn Oil 1L', 'Cooking & Baking', 290.00, 360.00, 24, 8, 'bottle', 0.16, 'oil'],
    ['616110000406', 'Kensalt Iodized Table Salt 1kg', 'Cooking & Baking', 32.00, 45.00, 150, 30, 'packet', 0.16, 'salt'],
    ['616110000407', 'Royco Mchuzi Mix Beef Flavor 200g', 'Cooking & Baking', 95.00, 125.00, 75, 15, 'packet', 0.16, 'sparkles'],
    ['616110000408', 'Royco Beef Seasoning Cubes 40s', 'Cooking & Baking', 120.00, 155.00, 60, 15, 'box', 0.16, 'sparkles'],

    // Soft Drinks & Beverages
    ['616110000501', 'Coca-Cola Original Taste 500ml Pet', 'Beverages', 50.00, 70.00, 96, 24, 'bottle', 0.16, 'wine'],
    ['616110000502', 'Fanta Passion Fruit Drink 500ml Pet', 'Beverages', 50.00, 70.00, 72, 20, 'bottle', 0.16, 'wine'],
    ['616110000503', 'Sprite Lemon Lime 500ml Pet', 'Beverages', 50.00, 70.00, 55, 18, 'bottle', 0.16, 'wine'],
    ['616110000504', 'Highlands Natural Mineral Water 1L', 'Beverages', 35.00, 50.00, 80, 20, 'bottle', 0.16, 'droplet'],
    ['616110000505', 'Del Monte Red Grape Juice 1L', 'Beverages', 185.00, 240.00, 30, 8, 'tetra', 0.16, 'wine'],
    ['616110000506', 'Minute Maid Pulpy Orange 400ml', 'Beverages', 60.00, 80.00, 45, 12, 'bottle', 0.16, 'wine'],

    // Household & Laundry
    ['616110000601', 'Menengai White Bar Soap 800g', 'Household & Cleaning', 140.00, 175.00, 70, 15, 'bar', 0.16, 'shield'],
    ['616110000602', 'Omo Hand Washing Powder 1kg', 'Household & Cleaning', 255.00, 310.00, 48, 12, 'packet', 0.16, 'box'],
    ['616110000603', 'Sunlight Lemon Dishwashing Liquid 750ml', 'Household & Cleaning', 195.00, 245.00, 32, 10, 'bottle', 0.16, 'droplet'],
    ['616110000604', 'Harpic Power Plus Toilet Cleaner 500ml', 'Household & Cleaning', 180.00, 230.00, 26, 8, 'bottle', 0.16, 'shield'],
    ['616110000605', 'Toss Sensitive Detergent Powder 1kg', 'Household & Cleaning', 220.00, 275.00, 35, 10, 'packet', 0.16, 'box'],
    ['616110000606', 'Vim Scouring Powder Lemon 500g', 'Household & Cleaning', 90.00, 115.00, 40, 10, 'can', 0.16, 'box'],

    // Personal Care & Toiletries
    ['616110000701', 'Geisha Aloe Vera & Honey Soap 225g', 'Personal Care', 80.00, 105.00, 90, 20, 'bar', 0.16, 'sparkles'],
    ['616110000702', 'Dettol Original Antibacterial Soap 175g', 'Personal Care', 115.00, 150.00, 54, 15, 'bar', 0.16, 'shield'],
    ['616110000703', 'Colgate Triple Action Toothpaste 140g', 'Personal Care', 140.00, 180.00, 60, 15, 'tube', 0.16, 'smile'],
    ['616110000704', 'Nice & Lovely Cocoa Butter Lotion 400ml', 'Personal Care', 210.00, 270.00, 30, 8, 'bottle', 0.16, 'heart'],
    ['616110000705', 'Always Ultra Thin Sanitary Pads 8s', 'Personal Care', 95.00, 125.00, 85, 20, 'pack', 0.16, 'shield'],
    ['616110000706', 'Vaseline Blue Seal Pure Petroleum Jelly 250g', 'Personal Care', 170.00, 220.00, 38, 10, 'jar', 0.16, 'heart'],

    // Butchery & Fresh Produce
    ['616110000801', 'Kenchic Prime Whole Chicken Frozen 1.2kg', 'Fresh & Butchery', 540.00, 660.00, 16, 5, 'pcs', 0.00, 'utensils'],
    ['616110000802', 'Farmers Choice Pork Sausages 500g', 'Fresh & Butchery', 320.00, 400.00, 22, 6, 'pack', 0.16, 'utensils'],
    ['616110000803', 'Litein Farm Sweet Bananas (bunch 6s)', 'Fresh & Butchery', 40.00, 60.00, 50, 15, 'bunch', 0.00, 'apple'],
    ['616110000804', 'Kericho Highland Irish Potatoes 2kg', 'Fresh & Butchery', 120.00, 160.00, 25, 8, 'bag', 0.00, 'package'],
    ['616110000805', 'Fresh Tomatoes Packed 1kg', 'Fresh & Butchery', 90.00, 130.00, 28, 8, 'pack', 0.00, 'package'],

    // Snacks & Confectionery
    ['616110000901', 'Urban Bites Salt & Vinegar Potato Crisps 120g', 'Snacks', 110.00, 145.00, 42, 10, 'bag', 0.16, 'cookie'],
    ['616110000902', 'Cadbury Dairy Milk Chocolate Bar 50g', 'Snacks', 75.00, 100.00, 50, 12, 'bar', 0.16, 'gift'],
    ['616110000903', 'Britania Bourbon Chocolate Biscuits 200g', 'Snacks', 65.00, 85.00, 65, 15, 'packet', 0.16, 'cookie']
  ];

  for (const p of initialProducts) {
    insertProduct.run(p);
  }

  // Seed Customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, email, address, loyalty_points, total_spent, visits_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const initialCustomers = [
    ['John Kiprono', '0712345678', 'jkiprono@gmail.com', 'Litein Town, Near Stage', 185, 18500.00, 14],
    ['Faith Chepkoech', '0723456789', 'chepkoechf@yahoo.com', 'Kapkatet Mission', 340, 34200.00, 22],
    ['Evans Mutai', '0701987654', 'evans.mutai@teafactory.co.ke', 'Chelal Tea Estate', 95, 9600.00, 8],
    ['Mercy Cherotich', '0798112233', 'cherotich.m@gmail.com', 'Bureti High School Road', 520, 52400.00, 36],
    ['Dennis Koech', '0745678901', 'denniskoech@sacco.co.ke', 'Litein Teachers Plaza', 210, 21500.00, 16],
    ['Sharon Bett', '0789001122', 'sharonbett@outlook.com', 'Kaplong Junction', 130, 13100.00, 11]
  ];

  for (const c of initialCustomers) {
    insertCustomer.run(c);
  }

  // Seed Sample Recent Sales for realistic initial metrics
  const insertSale = db.prepare(`
    INSERT INTO sales (
      receipt_number, cashier_name, counter_number, customer_id, customer_name, customer_phone,
      subtotal, discount_amount, vat_amount, total_amount, payment_method, payment_status,
      mpesa_reference, mpesa_phone, cash_tendered, change_given, points_earned, points_redeemed, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  const insertSaleItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, barcode, product_name, unit_price, cost_price, quantity, vat_rate, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Sale 1: M-Pesa STK Push
  const sale1 = insertSale.run(
    'GMT-20260924-0021', 'Chepngeno Mary', 'Counter 01', 1, 'John Kiprono', '0712345678',
    1095.00, 0, 114.48, 1095.00, 'mpesa_stk', 'COMPLETED',
    'SI82KF92LQ', '254712345678', 0, 0, 10, 0, 'Instant STK prompt paid via Daraja', '-3 hours'
  );
  insertSaleItem.run(sale1.lastInsertRowid, 1, '616110000101', 'Brookside Fresh Whole Milk 500ml', 65.00, 52.00, 2, 0.16, 130.00);
  insertSaleItem.run(sale1.lastInsertRowid, 9, '616110000201', 'Pembe Fortified Maize Meal 2kg', 195.00, 165.00, 2, 0.00, 390.00);
  insertSaleItem.run(sale1.lastInsertRowid, 15, '616110000301', 'Kericho Gold Pure Kenya Tea 100 Bags', 310.00, 240.00, 1, 0.16, 310.00);
  insertSaleItem.run(sale1.lastInsertRowid, 24, '616110000404', 'Fresh Fri Cooking Oil with Ginger 1L', 295.00, 240.00, 1, 0.16, 295.00);

  // Sale 2: Cash payment
  const sale2 = insertSale.run(
    'GMT-20260924-0022', 'Chepngeno Mary', 'Counter 01', 2, 'Faith Chepkoech', '0723456789',
    640.00, 0, 53.79, 640.00, 'cash', 'COMPLETED',
    null, null, 1000.00, 360.00, 6, 0, 'Cash checkout with KES 1000 note', '-2 hours'
  );
  insertSaleItem.run(sale2.lastInsertRowid, 6, '616110000106', 'Supa Loaf Premium White Bread 400g', 65.00, 54.00, 1, 0.00, 65.00);
  insertSaleItem.run(sale2.lastInsertRowid, 22, '616110000402', 'Kabras Pure Cane White Sugar 2kg', 320.00, 275.00, 1, 0.16, 320.00);
  insertSaleItem.run(sale2.lastInsertRowid, 2, '616110000102', 'KCC Gold Crown Long Life Milk 500ml', 72.00, 58.00, 2, 0.16, 144.00);
  insertSaleItem.run(sale2.lastInsertRowid, 26, '616110000406', 'Kensalt Iodized Table Salt 1kg', 45.00, 32.00, 1, 0.16, 45.00);

  // Sale 3: Split payment (M-Pesa + Cash)
  const sale3 = insertSale.run(
    'GMT-20260924-0023', 'Kiprotich Brian', 'Counter 02', 3, 'Evans Mutai', '0701987654',
    1745.00, 0, 172.41, 1745.00, 'split', 'COMPLETED',
    'SI83ML10PK', '254701987654', 1000.00, 0, 17, 0, 'Split: KES 1000 Cash + KES 745 M-Pesa STK', '-45 minutes'
  );
  insertSaleItem.run(sale3.lastInsertRowid, 23, '616110000403', 'Rina Pure Vegetable Cooking Oil 2L', 545.00, 460.00, 1, 0.16, 545.00);
  insertSaleItem.run(sale3.lastInsertRowid, 10, '616110000202', 'Jogoo Extra Maize Meal 2kg', 205.00, 170.00, 2, 0.00, 410.00);
  insertSaleItem.run(sale3.lastInsertRowid, 5, '616110000105', 'Farm Fresh Kienyeji Eggs (Tray 30s)', 520.00, 410.00, 1, 0.00, 520.00);
  insertSaleItem.run(sale3.lastInsertRowid, 33, '616110000602', 'Omo Hand Washing Powder 1kg', 310.00, 255.00, 1, 0.16, 310.00);

  // Add initial audit logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (event_type, description, details, performed_by)
    VALUES (?, ?, ?, ?)
  `);
  insertAudit.run('SYSTEM_INIT', 'Giftmart Supermarket POS edge node deployed for Litein store', 'Initial migration and schema version 1.0 verified', 'DevOps Automator');
  insertAudit.run('CASHIER_LOGIN', 'Mary Chepngeno opened register on Counter 01', 'Opening float: KES 5,000.00', 'Mary Chepngeno');
  insertAudit.run('DARAJA_CONNECTED', 'Safaricom M-Pesa Daraja STK Push Gateway health verified', 'Till Shortcode 5244101 ready for push prompts', 'M-Pesa Webhook Engine');
}

initDb();

module.exports = db;
