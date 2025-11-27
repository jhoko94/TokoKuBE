const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper untuk generate invoice number
const generateInvoiceNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}${day}-${random}`;
};

// POST /api/transactions
exports.processTransaction = async (req, res) => {
  const { type, customerId, cart, subtotal, discount, total, paid, change, note } = req.body;

  // Validasi input
  if (!type || !['LUNAS', 'BON'].includes(type)) {
    return res.status(400).json({ error: 'Tipe transaksi harus LUNAS atau BON' });
  }
  if (!customerId) {
    return res.status(400).json({ error: 'Pelanggan harus dipilih' });
  }
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Keranjang tidak boleh kosong' });
  }

  // Validasi customer
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
  }

  // Validasi BON hanya untuk customer non-UMUM
  if (type === 'BON' && customer.type === 'UMUM') {
    return res.status(400).json({ error: 'Pelanggan UMUM tidak bisa melakukan transaksi BON' });
  }

  try {
    // 1. Validasi Stok
    for (const item of cart) {
      if (!item.id || !item.qty || !item.conversion) {
        return res.status(400).json({ error: 'Data item tidak lengkap' });
      }
      if (item.qty <= 0) {
        return res.status(400).json({ error: 'Jumlah item harus > 0' });
      }
      
      const product = await prisma.product.findUnique({ where: { id: item.id } });
      if (!product) {
        return res.status(404).json({ error: `Produk dengan ID ${item.id} tidak ditemukan` });
      }
      
      const stockNeeded = item.qty * item.conversion;
      if (product.stock < stockNeeded) {
        return res.status(400).json({ error: `Stok ${product.name} tidak cukup. Stok tersedia: ${Math.floor(product.stock / item.conversion)} ${item.unitName || 'unit'}` });
      }
    }

    // 2. Hitung total jika tidak dikirim
    const calculatedSubtotal = subtotal || cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const calculatedDiscount = discount || 0;
    const calculatedTotal = total || (calculatedSubtotal - calculatedDiscount);
    const calculatedPaid = paid || 0;
    const calculatedChange = change || (calculatedPaid - calculatedTotal);

    // 3. Proses Transaksi (Database Transaction dengan riwayat stok dan simpan ke tabel Transaction)
    const result = await prisma.$transaction(async (tx) => {
      // Generate invoice number
      let invoiceNumber = generateInvoiceNumber();
      // Pastikan invoice number unik
      let exists = await tx.transaction.findUnique({ where: { invoiceNumber } });
      while (exists) {
        invoiceNumber = generateInvoiceNumber();
        exists = await tx.transaction.findUnique({ where: { invoiceNumber } });
      }

      // Simpan transaksi
      const transaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          type,
          customerId,
          subtotal: calculatedSubtotal,
          discount: calculatedDiscount,
          total: calculatedTotal,
          paid: calculatedPaid,
          change: calculatedChange,
          note: note || null,
          items: {
            create: cart.map(item => ({
              productId: item.id,
              productName: item.name,
              unitName: item.unitName,
              qty: item.qty,
              price: item.price,
              discount: item.discount || 0,
              subtotal: (item.price * item.qty) - (item.discount || 0),
            }))
          }
        },
        include: {
          items: true,
          customer: true,
        }
      });

      // Update stok dan simpan riwayat untuk setiap item
      for (const item of cart) {
        const product = await tx.product.findUnique({ where: { id: item.id } });
        if (!product) continue;

        const stockToReduce = item.qty * item.conversion;
        const qtyBefore = product.stock;
        const qtyAfter = qtyBefore - stockToReduce;

        // Update stok
        await tx.product.update({
          where: { id: item.id },
          data: { stock: { decrement: stockToReduce } },
        });

        // Simpan riwayat stok
        await tx.stockHistory.create({
          data: {
            productId: item.id,
            type: 'OUT',
            qtyChange: -stockToReduce,
            qtyBefore,
            qtyAfter,
            unitName: item.unitName,
            note: `Penjualan ${type} - ${item.name} - ${invoiceNumber}`,
            referenceType: 'TRANSACTION',
            referenceId: transaction.id,
          },
        });
      }

      // 4. Jika BON, update utang pelanggan
      if (type === 'BON') {
        await tx.customer.update({
          where: { id: customerId },
          data: { debt: { increment: calculatedTotal } },
        });
      }

      return transaction;
    });

    // Ambil customer terbaru untuk sinkronisasi data (setelah transaction commit)
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, type: true, debt: true }
    });

    res.status(200).json({ 
      message: 'Transaksi berhasil',
      transaction: result,
      invoiceNumber: result.invoiceNumber,
      customer: updatedCustomer // Kirim customer terbaru untuk sinkronisasi
    });

  } catch (error) {
    res.status(500).json({ error: 'Gagal memproses transaksi', details: error.message });
  }
};

// GET /api/transactions - Get all transactions dengan pagination
exports.getAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ]
    } : {};

    const total = await prisma.transaction.count({ where });

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                units: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    res.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data transaksi', details: error.message });
  }
};

// GET /api/transactions/:invoiceNumber - Get transaction by invoice number
exports.getTransactionByInvoice = async (req, res) => {
  try {
    const { invoiceNumber } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { invoiceNumber },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data transaksi', details: error.message });
  }
};