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
const menuRoutes = require('./routes/menu.routes');
const roleRoutes = require('./routes/role.routes');

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
app.use('/api/menus', menuRoutes);
app.use('/api/roles', roleRoutes);

// --- Endpoint Bootstrap (untuk memuat data awal FE) ---
app.get('/api/bootstrap', async (req, res) => {
  try {
    // Pastikan "Pelanggan Umum" selalu ada
    const customerController = require('./controllers/customer.controller');
    await customerController.ensureDefaultCustomer();

    // Optimasi: Hanya load data yang benar-benar diperlukan untuk dropdown/search
    // Products dan POs tidak perlu di-load semua karena sudah ada pagination
    const [customers, distributors, warehouses] = await Promise.all([
      // Customers: hanya untuk dropdown di PageJualan (biasanya tidak terlalu banyak)
      // Pastikan "Pelanggan Umum" di posisi pertama
      prisma.customer.findMany({ 
        select: {
          id: true,
          name: true,
          type: true,
          debt: true,
        },
        orderBy: [
          { name: 'asc' } // Sort by name, tapi kita akan sort manual untuk pastikan "Pelanggan Umum" pertama
        ] 
      }),
      // Distributors: hanya untuk dropdown (biasanya tidak terlalu banyak)
      // Include count produk untuk ditampilkan di Master Supplier
      prisma.distributor.findMany({ 
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          contactPerson: true,
          debt: true,
          _count: {
            select: {
              products: true // Relasi melalui ProductDistributor
            }
          }
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
        // HAPUS: distributorId (tidak ada lagi, sekarang Many-to-Many)
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
    
    // Sort customers: "Pelanggan Umum" selalu di posisi pertama
    const sortedCustomers = [...customers].sort((a, b) => {
      if (a.name === 'Pelanggan Umum') return -1;
      if (b.name === 'Pelanggan Umum') return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Map distributors untuk include productCount
    const distributorsWithCount = distributors.map(dist => ({
      id: dist.id,
      name: dist.name,
      address: dist.address,
      phone: dist.phone,
      email: dist.email,
      contactPerson: dist.contactPerson,
      debt: dist.debt,
      productCount: dist._count.products
    }));
    
    res.json({ customers: sortedCustomers, products, distributors: distributorsWithCount, pendingPOs, warehouses });
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