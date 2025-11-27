const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const prisma = new PrismaClient();
const app = express();

// Middleware
// CORS configuration - support environment variable untuk production
// Default: allow all origins untuk development dan production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, atau Railway internal)
    if (!origin) return callback(null, true);
    
    // Allow all origins jika ALLOWED_ORIGINS tidak di-set atau set ke '*'
    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    if (!allowedOrigins || allowedOrigins === '*') {
      return callback(null, true);
    }
    
    // Jika ada specific origins, check
    const allowedList = allowedOrigins.split(',').map(o => o.trim());
    if (allowedList.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Tetap allow untuk fleksibilitas
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '25mb' })); // Izinkan server membaca JSON body besar
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// --- RUTE API ---
// Kita akan impor rute-rute kita di sini
const productRoutes = require('./routes/product.routes');
const customerRoutes = require('./routes/customer.routes');
const distributorRoutes = require('./routes/distributor.routes');
const poRoutes = require('./routes/po.routes');
const transactionRoutes = require('./routes/transaction.routes');
const reportRoutes = require('./routes/report.routes');
const returRoutes = require('./routes/retur.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const exportRoutes = require('./routes/export.routes');
const warehouseRoutes = require('./routes/warehouse.routes');
const storeRoutes = require('./routes/store.routes');

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/retur', returRoutes);
app.use('/api/users', userRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/store', storeRoutes);

// --- Endpoint Bootstrap (untuk memuat data awal FE) ---
app.get('/api/bootstrap', async (req, res) => {
  try {
    // Optimasi: Hanya load data yang benar-benar diperlukan untuk dropdown/search
    // Products dan POs tidak perlu di-load semua karena sudah ada pagination
    const [customers, distributors, warehouses] = await Promise.all([
      // Customers: hanya untuk dropdown di PageJualan (biasanya tidak terlalu banyak)
      prisma.customer.findMany({ 
        select: {
          id: true,
          name: true,
          type: true,
          debt: true,
        },
        orderBy: { name: 'asc' } 
      }),
      // Distributors: hanya untuk dropdown (biasanya tidak terlalu banyak)
      prisma.distributor.findMany({ 
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' } 
      }),
      // Warehouses: hanya yang aktif (biasanya tidak terlalu banyak)
      prisma.warehouse.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          isDefault: true,
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
      })
    ]);
    
    // Products: hanya load minimal data untuk dropdown/search (limit 100 untuk performa)
    // Untuk tabel, gunakan pagination API
    const products = await prisma.product.findMany({ 
      select: {
        id: true,
        sku: true,
        name: true,
        distributorId: true,
        units: {
          select: {
            id: true,
            name: true,
            conversion: true,
          }
        }
      },
      orderBy: { name: 'asc' },
      take: 100 // Limit untuk performa
    });
    
    // PendingPOs: hanya load minimal data (limit 10 untuk performa)
    // Untuk daftar lengkap, gunakan pagination API
    const pendingPOs = await prisma.purchaseOrder.findMany({
        where: { status: 'PENDING' },
        select: {
          id: true,
          createdAt: true,
          distributor: {
            select: {
              id: true,
              name: true,
            }
          },
          items: {
            select: {
              id: true,
              qty: true,
              unitName: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                }
              }
            },
            take: 5 // Limit items per PO untuk performa
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10 // Limit POs untuk performa
      });
    
    res.json({ customers, products, distributors, pendingPOs, warehouses });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Gagal memuat data awal', details: error.message });
  }
});


// Global Error Handler (Sederhana)
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Terjadi kesalahan!',
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});