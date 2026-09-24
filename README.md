# 🛒 Giftmart Supermarket Litein — Modern Point of Sale (POS) System

> **Designed & Engineered for Giftmart Supermarket (Litein Main Branch, Kericho County, Kenya).**  
> Built from the ground up by Senior DevOps Engineering to solve retail checkout bottlenecks, enable automated Safaricom M-PESA STK Push payment prompts, track inventory in real-time, manage customer loyalty, and deliver KRA eTIMS-compliant thermal receipts.

---

## 🌟 The Litein Problem & Solution

### The Observation at Giftmart Litein
Litein is a bustling commercial and agricultural highland town in Kericho County, where hundreds of tea farmers, teachers, hospital staff, and local families shop daily. 

At the old Giftmart checkout counter, **the legacy POS lacked M-PESA prompting**. When customers chose to pay via M-PESA:
1. The cashier had to shout out the Till Number (`5244101`) over the noise of the supermarket.
2. The customer had to fumble with their phone, navigate the Safaricom SIM Toolkit, manually key in the Till number and exact bill amount, and wait for the SMS.
3. The cashier had to physically inspect the customer's phone screen or wait for an SMS confirmation on the counter's phone, causing massive checkout queues and security risks.

### The New Engineered Solution
This modernized POS terminal solves that issue completely:
- **Instant M-PESA STK Push (Lipa na M-Pesa Online)**: When the cashier clicks "M-PESA STK Push", the system immediately dispatches an automated prompt directly to the customer's mobile phone screen:
  > *"Do you want to pay KES 1,450 to GIFT-MART SUPERMARKET LITEIN (Till 5244101)? Enter M-Pesa PIN:"*
- **Interactive Customer Handset Simulator**: An on-screen mobile handset mockup that simulates customer PIN authentication, wrong PIN, cancellation, or timeout in real-time, allowing cashier and supervisor training with zero risk.
- **Production Safaricom Daraja API Ready**: Seamlessly switch between sandbox/simulation and live Safaricom Daraja production credentials.
- **Alternative Checkout Methods**:
  - **M-PESA Manual Till/Paybill**: Instant validation of 10-character Safaricom transaction reference codes.
  - **Cash Drawer**: Banknote quick-tender buttons (KES 50, 100, 200, 500, 1,000, 2,000) with instant exact change calculation.
  - **Split Payment**: Seamlessly divide total between Cash and M-PESA prompt.
  - **Bank Card / PDQ Terminal**: Visa/Mastercard approval authorization code tracking.
  - **Customer Loyalty Points Redemption**: 1 Point = KES 1 redemption against cart total.

---

## 🚀 Key Functional Modules

### 1. ⚡ POS Checkout Terminal (Cashier Register)
- **Fast Product Search & Barcode Scanning**: Search by name or barcode with instant Enter-to-scan.
- **Local Litein Stock Catalog**: 50+ pre-seeded authentic Kenyan supermarket items across 10 categories (Brookside Milk, KCC Gold, Kericho Gold Tea, Ketepa, Jogoo & Pembe Maize Meal, Kabras Sugar, Fresh Fri Oil, Menengai Soap, Kenchic Poultry, etc.).
- **Live Cart Operations**: Quantity adjustment, item removal, 16% standard VAT breakdown (KRA Code A vs Code E Exempt).
- **Cart Suspension (Hold / Recall)**: Suspend sale if a customer forgot their wallet or stepped away, and recall with 1-click.
- **Hotkeys**:
  - `F1`: Switch to POS Register
  - `F2`: Focus Barcode Scanner
  - `F4`: Open Payment Modal
  - `F5`: DevOps Telemetry & Health

### 2. 🧾 Real-Time Thermal Receipt Generation & Printing
- Authentic **80mm Supermarket Thermal Receipt**:
  - Header: Giftmart Supermarket - Litein Main Branch, Opp. Litein Bus Park, KRA PIN `P051839201Z`, Till `5244101`.
  - Itemized items with unit price, quantity, line totals, and VAT classification (`[A]` for 16% VAT, `[E]` for Exempt).
  - KRA eTIMS Tax Analysis breakdown (Net Taxable Base & VAT 16% amount).
  - Payment details: M-PESA Confirmation Reference (`SI...`), customer phone, cash tendered, and change given.
  - Live Scannable **KRA eTIMS QR Code** and cryptographic signature hash.
- **Multi-Format Export**:
  - Direct 80mm ESC/POS Thermal Print dialog (`window.print`).
  - Downloadable PDF Receipt (`Giftmart_Receipt_GMT-...pdf`).
  - Simulated SMS / WhatsApp digital receipt dispatch to customer handset.

### 3. 📦 Real-Time Inventory Control
- Live stock quantity tracking with auto-decrement on sale.
- Visual status badges: Optimal (green), Low Stock Warning (amber, `≤ reorder_level`), and Out of Stock (red).
- Quick **Restock / Stock Adjustment** modal with supplier delivery audit note.
- **Inventory Valuation Metrics**: Total SKUs, Total Units on Shelf, Retail Valuation (KES), Cost Valuation (KES), and Unrealized Margin.
- Export entire catalog to CSV.

### 4. 👥 Customer Transactions & Loyalty Rewards
- Customer database with Phone, Name, Loyalty Points balance, Total Spent, and Visit Count.
- Earning rule: **1 Loyalty Point for every KES 100 spent**.
- Quick customer creation from checkout or Customer Directory tab.
- Transaction history drill-down with reprint and refund/return capabilities.

### 5. 🛠️ DevOps, Observability & Architecture
- **SQLite WAL Mode Engine**: Fast embedded database with zero external server dependencies, sub-millisecond query latency.
- **Edge Telemetry**: Node.js memory footprint, uptime, query latency, active connection status.
- **Safaricom Daraja Gateway Manager**: Toggle between interactive simulator and live production Daraja endpoints.
- **KRA eTIMS Fiscalizer Sync Engine**: Active heartbeat check and queue depth monitoring.
- **Audit Logs Stream**: Real-time event log for logins, STK prompts, checkouts, and stock adjustments.
- **Operational Resiliency**: 1-click JSON database snapshot backup export & demo database reset.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Lucide Icons, Canvas Confetti |
| **Receipt Engine** | jsPDF, QRCode Generator, Thermal Print `@media print` CSS |
| **Backend API** | Node.js v22, Express 5 REST API |
| **Database** | SQLite 3 (`better-sqlite3`) with Write-Ahead Logging (WAL) |
| **Integrations** | Safaricom Daraja STK Push Gateway, KRA eTIMS Simulator |
| **DevOps** | Multi-stage Dockerfile, Docker Compose, automated test suite |

---

## 🏃 Running the Application

### 1. Build & Start (Production Port 3000)
```bash
# Build the React frontend
npm run build

# Start the unified POS Server (binds to 0.0.0.0:3000)
npm start
```

### 2. Development Mode
```bash
# Runs Express on 3001 and Vite on 3000 with hot reloading
npm run dev
```

### 3. Running Automated Test Suite
```bash
npm test
```
The test suite validates:
- System edge health & SQLite WAL status
- Product catalog querying and barcode search
- M-PESA STK Push prompt dispatch
- Simulated customer PIN authentication & callback webhook
- Sale checkout, inventory deduction, and KRA eTIMS hash generation
- Cash change calculation

### 4. Docker Deployment (Litein Store Edge Server)
```bash
docker-compose up -d --build
```

---

## 📍 Store Information
- **Store**: Giftmart Supermarket (Litein Main Branch)
- **Town**: Litein, Kericho County, Kenya
- **Address**: Opposite Litein Bus Park, Litein-Kericho Highway
- **Till Number**: `5244101`
- **KRA PIN**: `P051839201Z`
- **Control Unit (eTIMS)**: `KRA-ETIMS-LTN-004812`
