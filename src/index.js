const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors()); // Izinkan semua origin (untuk development)
app.use(express.json()); // Izinkan server membaca JSON body

// --- RUTE API ---
// Kita akan impor rute-rute kita di sini
const productRoutes = require('./routes/product.routes');
const customerRoutes = require('./routes/customer.routes');
const poRoutes = require('./routes/po.routes');
const transactionRoutes = require('./routes/transaction.routes');
const reportRoutes = require('./routes/report.routes');

app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);

// --- Endpoint Bootstrap (untuk memuat data awal FE) ---
app.get('/api/bootstrap', async (req, res) => {
  try {
    const [customers, products, distributors, pendingPOs] = await Promise.all([
      prisma.customer.findMany({ orderBy: { name: 'asc' } }),
      prisma.product.findMany({ 
        include: { units: true }, 
        orderBy: { name: 'asc' } 
      }),
      prisma.distributor.findMany({ orderBy: { name: 'asc' } }),
      prisma.purchaseOrder.findMany({
        where: { status: 'PENDING' },
        include: { 
          distributor: true,
          items: { include: { product: { include: { units: true } } } } // Ambil data produk lengkap
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    res.json({ customers, products, distributors, pendingPOs });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memuat data awal', details: error.message });
  }
});


// Global Error Handler (Sederhana)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Terjadi kesalahan!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});