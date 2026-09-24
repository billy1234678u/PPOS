const assert = require('assert');

async function runTests() {
  console.log('🧪 Starting Giftmart Supermarket POS System Test Suite...');
  const app = require('../server/index');
  const server = app.listen(3990, '0.0.0.0');

  try {
    const baseUrl = 'http://127.0.0.1:3990';

    // Test 1: Health Check
    console.log('Test 1: Edge Node System Health Check...');
    const healthRes = await fetch(`${baseUrl}/api/devops/health`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'HEALTHY');
    assert.strictEqual(healthData.database.status, 'CONNECTED');
    console.log('✅ System health verified. Engine:', healthData.database.engine);

    // Test 2: Products Retrieval
    console.log('Test 2: Inventory Catalog & Stock Retrieval...');
    const prodRes = await fetch(`${baseUrl}/api/products`);
    const prodData = await prodRes.json();
    assert.strictEqual(prodData.success, true);
    assert(prodData.count >= 40, `Expected at least 40 products, got ${prodData.count}`);
    console.log(`✅ Loaded ${prodData.count} products across ${prodData.categories.length} categories.`);

    // Test 3: Product Search (e.g. "Milk")
    console.log('Test 3: Barcode / Text Search...');
    const searchRes = await fetch(`${baseUrl}/api/products?search=Milk`);
    const searchData = await searchRes.json();
    assert(searchData.products.length > 0);
    console.log(`✅ Search for "Milk" found ${searchData.products.length} products.`);

    // Test 4: M-Pesa STK Push Dispatch
    console.log('Test 4: Lipa na M-Pesa STK Push Prompt Dispatch...');
    const stkRes = await fetch(`${baseUrl}/api/mpesa/stkpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0712345678',
        amount: 850.00,
        reference: 'TEST-ORDER-1'
      })
    });
    const stkData = await stkRes.json();
    assert.strictEqual(stkData.success, true);
    assert(stkData.data.checkoutRequestId.startsWith('ws_CO_'));
    assert.strictEqual(stkData.data.customerPhone, '254712345678');
    console.log(`✅ STK Push Prompt successfully sent to customer: ${stkData.data.customerPhone} (CheckoutRequestID: ${stkData.data.checkoutRequestId})`);

    // Test 5: Interactive M-Pesa PIN Simulator
    console.log('Test 5: M-Pesa PIN Authentication & Callback Simulator...');
    const simRes = await fetch(`${baseUrl}/api/mpesa/simulate-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkoutRequestId: stkData.data.checkoutRequestId,
        action: 'PIN_ENTERED',
        pin: '1234'
      })
    });
    const simData = await simRes.json();
    assert.strictEqual(simData.success, true);
    assert.strictEqual(simData.status, 'SUCCESS');
    assert(simData.mpesaReceipt.length >= 8);
    console.log(`✅ Customer authorized payment with PIN. M-PESA Confirmation Ref: ${simData.mpesaReceipt}`);

    // Test 6: Complete Sale & Inventory Stock Decrement
    console.log('Test 6: POS Checkout Transaction & KRA eTIMS Thermal Receipt...');
    const targetProduct = prodData.products[0];
    const initialStock = targetProduct.stock_quantity;

    const saleRes = await fetch(`${baseUrl}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: targetProduct.id, name: targetProduct.name, quantity: 2 }],
        payment_method: 'mpesa_stk',
        mpesa_reference: simData.mpesaReceipt,
        mpesa_phone: '254712345678',
        customer_id: 1,
        customer_name: 'John Kiprono'
      })
    });
    const saleData = await saleRes.json();
    assert.strictEqual(saleData.success, true);
    assert(saleData.receipt.receiptNumber.startsWith('GMT-'));
    assert(saleData.receipt.etims.signature.length >= 8);
    console.log(`✅ Checkout completed! Receipt #${saleData.receipt.receiptNumber}, KRA Signature: ${saleData.receipt.etims.signature}`);

    // Verify stock decrement
    const checkProdRes = await fetch(`${baseUrl}/api/products/${targetProduct.id}`);
    const checkProdData = await checkProdRes.json();
    assert.strictEqual(checkProdData.product.stock_quantity, initialStock - 2);
    console.log(`✅ Inventory verified: "${targetProduct.name}" stock reduced from ${initialStock} to ${checkProdData.product.stock_quantity}`);

    // Test 7: Cash Payment & Change Calculation
    console.log('Test 7: Cash Checkout Tender & Change Calculation...');
    const cashSaleRes = await fetch(`${baseUrl}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: targetProduct.id, name: targetProduct.name, quantity: 1 }],
        payment_method: 'cash',
        cash_tendered: 1000.00
      })
    });
    const cashSaleData = await cashSaleRes.json();
    assert.strictEqual(cashSaleData.success, true);
    assert.strictEqual(cashSaleData.receipt.payment_method, 'cash');
    assert(cashSaleData.receipt.change_given >= 0);
    console.log(`✅ Cash sale completed! Total: KES ${cashSaleData.receipt.total_amount}, Tendered: KES 1,000, Change: KES ${cashSaleData.receipt.change_given}`);

    console.log('\n========================================');
    console.log('🎉 ALL GIFTMART POS SYSTEM TESTS PASSED!');
    console.log('========================================\n');
    server.close(() => {
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Test failed:', err);
    server.close(() => {
      process.exit(1);
    });
  }
}

runTests();
