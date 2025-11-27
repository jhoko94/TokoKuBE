# Toko POS System - Backend API

Backend API untuk sistem Point of Sale (POS) yang dirancang untuk mengelola toko dengan fitur lengkap untuk penjualan, manajemen stok, pembelian, retur, dan laporan.

## 🚀 Teknologi

- **Node.js** v22
- **Express.js** v5.1.0 - Web framework
- **Prisma ORM** v6.19.0 - Database toolkit
- **PostgreSQL** - Database
- **JWT** - Authentication & Authorization
- **Bcrypt.js** - Password hashing
- **Nodemailer** - Email service
- **ExcelJS** - Excel file processing

## 📋 Fitur Utama

### 1. Authentication & Authorization
- Login dengan JWT token
- Role-based access control (ADMIN, MANAGER, KASIR)
- Password hashing dengan bcrypt
- Protected routes dengan middleware

### 2. Master Data
- **Master Barang**: CRUD produk dengan multi-unit, barcode, distributor
- **Master Pelanggan**: CRUD pelanggan dengan piutang tracking
- **Master Supplier**: CRUD supplier/distributor
- Bulk update untuk distributor dan satuan
- Import produk dari Excel

### 3. Transaksi
- **Penjualan**: 
  - Multi-payment (LUNAS, BON, Bayar Sebagian)
  - Barcode scanning
  - Cart management
  - Print receipt (PDF)
- **History Penjualan**: Lihat semua transaksi dengan detail
- **Retur Penjualan**: 
  - Retur sebagian (tidak harus semua item)
  - Validasi terhadap transaksi asli
  - Password admin untuk KASIR
  - Auto update stok dan piutang

### 4. Pembelian
- **Purchase Order (PO)**: Buat PO dengan saran stok menipis
- **Cek Pesanan**: Terima PO dan update stok
- **Retur Pembelian**: Retur barang ke supplier
- Download PO sebagai PDF

### 5. Manajemen Stok
- **Cek Barang**: Lihat stok semua barang
- **Stok Opname**: Penghitungan fisik stok
- **Kartu Stok**: Riwayat perubahan stok per barang
- **Tambah Stok Manual**: (Hanya ADMIN/MANAGER)
- **Transfer Stok**: (Hanya ADMIN/MANAGER)

### 6. Piutang & Hutang
- **Piutang Pelanggan**: Tracking dan pembayaran hutang pelanggan
- **Hutang Supplier**: Tracking dan pembayaran hutang supplier (Hanya ADMIN/MANAGER)
- Export data ke Excel

### 7. Laporan
- Statistik keuangan (penjualan, piutang, hutang)
- Grafik penjualan harian
- Barang terlaris
- Stok menipis dengan pagination
- Riwayat opname
- (Hanya ADMIN/MANAGER)

### 8. Komunikasi
- **Email**: Kirim email ke pelanggan (single & bulk)
- **WhatsApp**: Kirim pesan WhatsApp (single & bulk)
- Daily quota tracking (400 emails/hari)
- Batch processing dengan retry mechanism
- Multiple provider support (Twilio, Meta, Custom API, WhatsApp Cloud API)

### 9. User Management
- Profile management
- Change password
- Store profile management (Hanya ADMIN/MANAGER)

## 🔐 Role-Based Access Control

### ADMIN & MANAGER
- Akses penuh ke semua fitur
- Master Data (CRUD)
- Pembelian & PO
- Stok Opname
- Tambah/Transfer Stok
- Laporan
- Hutang Supplier
- Edit Store Profile

### KASIR
- Penjualan
- History Penjualan
- Retur Penjualan (dengan password admin)
- Cek Barang (hanya lihat)
- Kartu Stok
- Piutang Pelanggan
- Tidak bisa: Tambah stok, Stok Opname, Master Data, Pembelian, Laporan, Hutang Supplier

## 📦 Instalasi

### Prerequisites
- Node.js v22 atau lebih tinggi
- PostgreSQL database
- npm atau yarn

### Langkah Instalasi

1. **Clone repository dan masuk ke folder backend**
```bash
cd proyek-toko-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
Buat file `.env` di root folder dengan isi:
```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
# Contoh:
# DATABASE_URL="postgresql://postgres:admin123@localhost:5432/tokodb?schema=public"

# Server
PORT=3001

# JWT Secret
JWT_SECRET="your-secret-key-change-in-production"

# Email Configuration (Opsional, untuk fitur email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@tokoku.com

# WhatsApp Configuration (Opsional, untuk fitur WhatsApp)
WHATSAPP_PROVIDER=twilio  # twilio, meta, custom, cloud-api
WHATSAPP_ACCOUNT_SID=your-account-sid
WHATSAPP_AUTH_TOKEN=your-auth-token
WHATSAPP_FROM=whatsapp:+1234567890
```

4. **Setup database**
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (opsional, untuk data awal)
npm run db:seed
```

5. **Jalankan server**
```bash
# Development mode (dengan nodemon)
npm run dev

# Production mode
npm start
```

Server akan berjalan di `http://localhost:3001`

## 📁 Struktur Project

```
proyek-toko-api/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Seed data
├── src/
│   ├── controllers/       # Business logic
│   │   ├── auth.controller.js
│   │   ├── customer.controller.js
│   │   ├── product.controller.js
│   │   ├── transaction.controller.js
│   │   ├── po.controller.js
│   │   ├── retur.controller.js
│   │   ├── report.controller.js
│   │   └── store.controller.js
│   ├── middleware/        # Middleware
│   │   └── auth.middleware.js
│   ├── routes/            # API routes
│   │   ├── auth.routes.js
│   │   ├── customer.routes.js
│   │   ├── product.routes.js
│   │   ├── transaction.routes.js
│   │   ├── po.routes.js
│   │   ├── retur.routes.js
│   │   ├── report.routes.js
│   │   └── store.routes.js
│   └── index.js           # Entry point
├── .env                   # Environment variables
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/change-password` - Ubah password
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Products
- `GET /api/products` - Get all products (with pagination & search)
- `POST /api/products` - Create product (ADMIN/MANAGER)
- `PUT /api/products/:id` - Update product (ADMIN/MANAGER)
- `DELETE /api/products/:id` - Delete product (ADMIN/MANAGER)
- `POST /api/products/:id/add-stock` - Add stock (ADMIN/MANAGER)
- `GET /api/products/:id/stock-card` - Get stock card
- `GET /api/products/suggestions` - Get PO suggestions (ADMIN/MANAGER)
- `PUT /api/products/bulk-update-distributor` - Bulk update distributor (ADMIN/MANAGER)
- `PUT /api/products/bulk-update-unit` - Bulk update unit (ADMIN/MANAGER)
- `POST /api/products/import` - Import products from Excel (ADMIN/MANAGER)

### Transactions
- `GET /api/transactions` - Get all transactions (with pagination & search)
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/:invoiceNumber` - Get transaction by invoice

### Purchase Orders
- `GET /api/purchase-orders` - Get all POs (ADMIN/MANAGER)
- `POST /api/purchase-orders` - Create PO (ADMIN/MANAGER)
- `POST /api/purchase-orders/:id/receive` - Receive PO (ADMIN/MANAGER)

### Returns
- `GET /api/retur/penjualan` - Get all sales returns
- `POST /api/retur/penjualan` - Create sales return
- `GET /api/retur/pembelian` - Get all purchase returns (ADMIN/MANAGER)
- `POST /api/retur/pembelian` - Create purchase return (ADMIN/MANAGER)

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer (ADMIN/MANAGER)
- `PUT /api/customers/:id` - Update customer (ADMIN/MANAGER)
- `DELETE /api/customers/:id` - Delete customer (ADMIN/MANAGER)
- `GET /api/customers/debt` - Get customers with debt
- `POST /api/customers/:id/pay-debt` - Pay customer debt
- `POST /api/customers/:id/send-email` - Send email (ADMIN/MANAGER)
- `POST /api/customers/:id/send-whatsapp` - Send WhatsApp (ADMIN/MANAGER)
- `POST /api/customers/bulk-send-email` - Bulk send email (ADMIN/MANAGER)
- `POST /api/customers/bulk-send-whatsapp` - Bulk send WhatsApp (ADMIN/MANAGER)

### Reports
- `GET /api/reports` - Get reports (ADMIN/MANAGER)
- `POST /api/reports/opname` - Process stock opname (ADMIN/MANAGER)

### Store
- `GET /api/store` - Get store info
- `PUT /api/store` - Update store info (ADMIN/MANAGER)
- `GET /api/store/name` - Get store name (public)

### Bootstrap
- `GET /api/bootstrap` - Get initial data (products, customers, suppliers, user)

## 🔒 Security

- Password hashing dengan bcrypt (10 rounds)
- JWT token authentication
- Role-based access control
- Input validation
- SQL injection protection (Prisma ORM)
- CORS configuration

## 📝 Database Schema

Database menggunakan PostgreSQL dengan Prisma ORM. Schema utama:
- `User` - User accounts dengan roles
- `Product` - Produk dengan multi-unit
- `Unit` - Satuan produk dengan conversion
- `Customer` - Pelanggan dengan piutang
- `Distributor` - Supplier/distributor
- `Transaction` - Transaksi penjualan
- `TransactionItem` - Item dalam transaksi
- `PurchaseOrder` - Purchase Order
- `PurchaseOrderItem` - Item dalam PO
- `StockHistory` - Riwayat perubahan stok
- `ReturPenjualan` - Retur penjualan
- `ReturPembelian` - Retur pembelian
- `Store` - Informasi toko
- `EmailQuota` - Tracking email quota harian

## 🛠️ Development

### Scripts
```bash
npm run dev          # Run development server dengan nodemon
npm start            # Run production server
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database
```

### Environment Variables
Lihat bagian Instalasi untuk daftar lengkap environment variables.

## 📄 License

ISC

## 👥 Support

Untuk bantuan lebih lanjut, hubungi administrator sistem.
