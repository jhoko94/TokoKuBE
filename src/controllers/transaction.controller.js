const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/transactions
exports.processTransaction = async (req, res) => {
  const { type, customerId, cart } = req.body; // type = 'LUNAS' or 'BON'

  try {
    // 1. Validasi Stok
    for (const item of cart) {
      const product = await prisma.product.findUnique({ where: { id: item.id } });
      const stockNeeded = item.qty * item.conversion;
      if (product.stock < stockNeeded) {
        return res.status(400).json({ error: `Stok ${product.name} tidak cukup.` });
      }
    }

    // 2. Proses Transaksi (Database Transaction)
    const transactionUpdates = cart.map(item => {
      const stockToReduce = item.qty * item.conversion;
      return prisma.product.update({
        where: { id: item.id },
        data: { stock: { decrement: stockToReduce } },
      });
    });

    // 3. Jika BON, update utang pelanggan
    if (type === 'BON') {
      const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
      transactionUpdates.push(
        prisma.customer.update({
          where: { id: customerId },
          data: { debt: { increment: total } },
        })
      );
    }
    
    // Jalankan semua update sekaligus
    await prisma.$transaction(transactionUpdates);

    res.status(200).json({ message: 'Transaksi berhasil' });

  } catch (error) {
    res.status(500).json({ error: 'Gagal memproses transaksi', details: error.message });
  }
};