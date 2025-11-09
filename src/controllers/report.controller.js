const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/reports (Dummy)
exports.getReports = async (req, res) => {
  // Mirip dengan prototipe, data ini dummy/agregasi
  try {
    const totalDebt = await prisma.customer.aggregate({ _sum: { debt: true } });
    const lowStockItems = await prisma.product.findMany({
      where: { stock: { lte: prisma.product.fields.minStock } },
    });
    
    res.json({
        totalSales: 1250000, // Dummy
        totalDebt: totalDebt._sum.debt || 0,
        topSelling: [ { name: 'Indomie Goreng', qty: 120 } ], // Dummy
        lowStockItems: lowStockItems,
        opnameHistory: [ { product: { name: 'Kopi Kapal Api' }, qtyChange: -2, timestamp: new Date().toISOString(), note: 'Selisih hitung' } ] // Dummy
    });
  } catch (error) {
     res.status(500).json({ error: 'Gagal mengambil laporan' });
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