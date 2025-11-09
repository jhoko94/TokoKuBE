const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/purchase-orders (filter by status)
exports.getPendingPOs = async (req, res) => {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      where: { status: 'PENDING' },
      include: {
        distributor: true,
        items: {
          include: {
            product: { include: { units: true } }, // Kirim data produk lengkap
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pos);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data PO' });
  }
};

// POST /api/purchase-orders (Buat PO)
exports.createPO = async (req, res) => {
  const { distributorId, items } = req.body;
  try {
    const newPO = await prisma.purchaseOrder.create({
      data: {
        distributorId,
        status: 'PENDING',
        items: {
          create: items.map(item => ({
            productId: item.productId,
            qty: item.qty,
            unitName: item.unitName,
          })),
        },
      },
      include: { distributor: true, items: { include: { product: true }} },
    });
    res.status(201).json(newPO);
  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat PO', details: error.message });
  }
};

// POST /api/purchase-orders/:id/receive (Terima PO)
exports.receivePO = async (req, res) => {
  const { id } = req.params;
  const { newBarcodeData } = req.body; // { [productId]: { [unitId]: 'barcode' } }
  
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: { include: { product: { include: { units: true } } } } },
    });

    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });

    const updates = [];

    // 1. Siapkan update stok dan barcode
    for (const item of po.items) {
      const product = item.product;
      const unit = product.units.find(u => u.name === item.unitName);
      if (!unit) continue;

      const stockToAdd = item.qty * unit.conversion;
      updates.push(
        prisma.product.update({
          where: { id: product.id },
          data: { stock: { increment: stockToAdd } },
        })
      );

      // Cek barcode baru
      if (newBarcodeData[product.id]) {
        for (const unit of product.units) {
          const newBarcode = newBarcodeData[product.id][unit.id];
          // Jika ada barcode baru DAN barcode itu belum ada di list
          if (newBarcode && !unit.barcodes.includes(newBarcode)) {
            updates.push(
              prisma.unit.update({
                where: { id: unit.id },
                data: { barcodes: { push: newBarcode } }, // Tambahkan ke array
              })
            );
          }
        }
      }
    }

    // 2. Update status PO jadi COMPLETED
    updates.push(
      prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'COMPLETED' },
      })
    );

    // Jalankan semua update dalam satu transaksi
    await prisma.$transaction(updates);
    res.status(200).json({ message: 'PO berhasil diterima' });

  } catch (error) {
    res.status(500).json({ error: 'Gagal menerima PO', details: error.message });
  }
};