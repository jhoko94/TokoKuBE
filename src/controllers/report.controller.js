const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/reports
exports.getReports = async (req, res) => {
  try {
    const { period = 'today' } = req.query; // today, week, month, all
    
    // Hitung periode
    let dateFilter = {};
    const now = new Date();
    if (period === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { gte: startOfDay } };
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { gte: startOfWeek } };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { gte: startOfMonth } };
    }

    // Total penjualan dari transaksi
    const salesData = await prisma.transaction.aggregate({
      where: {
        ...dateFilter,
        type: 'LUNAS',
      },
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
    });

    // Total utang pelanggan
    const totalDebt = await prisma.customer.aggregate({ 
      _sum: { debt: true } 
    });

    // Total hutang supplier
    const totalSupplierDebt = await prisma.distributor.aggregate({
      _sum: { debt: true }
    });

    // Produk terlaris (dari transaction items)
    const topSellingRaw = await prisma.transactionItem.groupBy({
      by: ['productId'],
      where: {
        transaction: {
          ...dateFilter,
        }
      },
      _sum: {
        qty: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          qty: 'desc',
        },
      },
      take: 5,
    });

    // Ambil detail produk untuk top selling
    const topSelling = await Promise.all(
      topSellingRaw.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        return {
          name: product?.name || 'Unknown',
          qty: item._sum.qty || 0,
          transactions: item._count.id || 0,
        };
      })
    );

    // Stok menipis dengan pagination (menggunakan raw query karena Prisma tidak support field comparison langsung)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    // Hitung total low stock items
    const lowStockCount = await prisma.$queryRaw`
      SELECT COUNT(*)::integer as count
      FROM "Product"
      WHERE stock <= "minStock"
    `;
    const totalLowStock = lowStockCount[0]?.count || 0;

    // Ambil low stock items dengan pagination
    // Parse limit dan skip sebagai integer untuk keamanan
    const safeLimit = parseInt(limit) || 25;
    const safeSkip = parseInt(skip) || 0;
    const lowStockItems = await prisma.$queryRawUnsafe(`
      SELECT id, name, stock, "minStock"
      FROM "Product"
      WHERE stock <= "minStock"
      ORDER BY stock ASC
      LIMIT ${safeLimit}
      OFFSET ${safeSkip}
    `);

    // Riwayat opname terakhir (dari stock history)
    const opnameHistory = await prisma.stockHistory.findMany({
      where: {
        type: 'ADJUSTMENT',
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Format opname history
    const formattedOpnameHistory = opnameHistory.map(entry => ({
      product: {
        name: entry.product.name,
      },
      qtyChange: entry.qtyChange,
      timestamp: entry.createdAt.toISOString(),
      note: entry.note || 'Stok opname',
    }));

    // Laporan penjualan harian (menggunakan raw query untuk group by date)
    let dateCondition = '';
    if (period === 'today') {
      dateCondition = `AND DATE("createdAt") = CURRENT_DATE`;
    } else if (period === 'week') {
      dateCondition = `AND "createdAt" >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateCondition = `AND DATE_TRUNC('month', "createdAt") = DATE_TRUNC('month', CURRENT_DATE)`;
    }
    
    const dailySalesRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        DATE("createdAt") as date,
        SUM(total)::decimal as total,
        COUNT(id)::integer as count
      FROM "Transaction"
      WHERE type = 'LUNAS' ${dateCondition}
      GROUP BY DATE("createdAt")
      ORDER BY date DESC
    `);
    
    const dailySales = dailySalesRaw.map(d => ({
      date: d.date.toISOString().split('T')[0],
      total: Number(d.total || 0),
      count: Number(d.count || 0),
    }));

    res.json({
      totalSales: Number(salesData._sum.total || 0),
      totalTransactions: salesData._count.id || 0,
      totalDebt: Number(totalDebt._sum.debt || 0),
      totalSupplierDebt: Number(totalSupplierDebt._sum.debt || 0),
      topSelling: topSelling,
      lowStockItems: lowStockItems,
      lowStockPagination: {
        page,
        limit,
        total: totalLowStock,
        totalPages: Math.ceil(totalLowStock / limit),
      },
      opnameHistory: formattedOpnameHistory,
      dailySales: dailySales,
      period: period,
    });
  } catch (error) {
    console.error("Error generating reports:", error);
    res.status(500).json({ error: 'Gagal mengambil laporan', details: error.message });
  }
};

// POST /api/reports/opname (Stok Opname)
exports.processStockOpname = async (req, res) => {
  const { adjustments } = req.body; // [{ productId, physicalStock }]

  try {
    const updates = adjustments.map(adj => {
      return prisma.product.update({
        where: { id: adj.productId },
        data: { stock: adj.physicalStock },
      });
    });

    await prisma.$transaction(updates);
    res.status(200).json({ message: 'Stok opname berhasil' });

  } catch (error) {
     res.status(500).json({ error: 'Gagal memproses stok opname' });
  }
};