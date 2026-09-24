const express = require('express');
const cors = require('cors');
const path = require('path');
const productsRouter = require('./routes/products');
const salesRouter = require('./routes/sales');
const mpesaRouter = require('./routes/mpesa');
const customersRouter = require('./routes/customers');
const devopsRouter = require('./routes/devops');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging for observability
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api') && !req.path.includes('/health')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/mpesa', mpesaRouter);
app.use('/api/customers', customersRouter);
app.use('/api/devops', devopsRouter);

// Root health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Giftmart Supermarket POS Edge Server (Litein)',
    version: '2.4.0',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend production build if available
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Giftmart POS API Server running. Frontend build not found on this port.');
});

// Bind server to 0.0.0.0
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🛒 GIFTMART SUPERMARKET POS (LITEIN BRANCH) BACKEND`);
    console.log(`⚡ Express Server listening on http://0.0.0.0:${PORT}`);
    console.log(`📡 M-Pesa STK Push Gateway & KRA eTIMS Engine Active`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
