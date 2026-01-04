const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/purchase-orders (filter by status)
exports.getPendingPOs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'PENDING'; // Default PENDING, bisa COMPLETED
    const distributorId = req.query.distributorId || '';

    const where = { 
      status: status.toUpperCase() // Ensure uppercase
    };
    if (distributorId) {
      where.distributorId = distributorId;
    }

    // Get total count
    const total = await prisma.purchaseOrder.count({ where });

    // Get paginated POs
    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        distributor: true,
        items: {
          include: {
            product: { include: { units: true } }, // Kirim data produk lengkap
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    res.json({
      data: pos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data PO', details: error.message });
  }
};

// POST /api/purchase-orders (Buat PO)
exports.createPO = async (req, res) => {
  const { distributorId, items } = req.body;
  
  // Validasi input
  if (!distributorId) {
    return res.status(400).json({ error: 'Distributor harus dipilih' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 item' });
  }
  
  // Validasi distributor
  const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
  if (!distributor) {
    return res.status(404).json({ error: 'Distributor tidak ditemukan' });
  }
  
  // Validasi items
  for (const item of items) {
    if (!item.productId) {
      return res.status(400).json({ error: 'Product ID harus diisi' });
    }
    if (!item.qty || item.qty <= 0) {
      return res.status(400).json({ error: 'Jumlah item harus > 0' });
    }
    if (!item.unitName || !item.unitName.trim()) {
      return res.status(400).json({ error: 'Satuan harus diisi' });
    }
    
    // Cek apakah produk ada
    const product = await prisma.product.findUnique({ 
      where: { id: item.productId },
      include: { units: true }
    });
    if (!product) {
      return res.status(404).json({ error: `Produk dengan ID ${item.productId} tidak ditemukan` });
    }
    
    // Cek apakah unit valid untuk produk ini
    const unit = product.units.find(u => u.name === item.unitName.trim());
    if (!unit) {
      return res.status(400).json({ error: `Satuan '${item.unitName}' tidak valid untuk produk ${product.name}` });
    }
  }
  
  try {
    const newPO = await prisma.purchaseOrder.create({
      data: {
        distributorId,
        status: 'PENDING', // String, not enum
        items: {
          create: items.map(item => ({
            productId: item.productId,
            qty: parseInt(item.qty),
            unitName: item.unitName.trim(),
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
  const { newBarcodeData = {} } = req.body; // { [productId]: { [unitId]: 'barcode' } } - default ke object kosong
  
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { 
        distributor: true,
        items: { include: { product: { include: { units: true } } } } 
      },
    });

    if (!po) return res.status(404).json({ error: 'PO tidak ditemukan' });

    // 1. Proses dalam transaksi database
    await prisma.$transaction(async (tx) => {
      // Update stok, barcode, dan simpan riwayat
      for (const item of po.items) {
        const product = item.product;
        if (!product) {
          console.warn(`Product tidak ditemukan untuk item ${item.id}`);
          continue;
        }
        
        if (!product.units || product.units.length === 0) {
          console.warn(`Product ${product.id} tidak memiliki units`);
          continue;
        }
        
        const unit = product.units.find(u => u.name === item.unitName);
        if (!unit) {
          console.warn(`Unit ${item.unitName} tidak ditemukan untuk product ${product.id}`);
          continue;
        }

        const stockToAdd = item.qty * unit.conversion;
        const qtyBefore = product.stock;
        const qtyAfter = qtyBefore + stockToAdd;

        // 1. Cari atau buat ProductDistributor untuk supplier PO ini
        let productDistributor = await tx.productDistributor.findUnique({
          where: {
            productId_distributorId: {
              productId: product.id,
              distributorId: po.distributorId
            }
          }
        });

        if (!productDistributor) {
          // Buat ProductDistributor baru jika belum ada
          productDistributor = await tx.productDistributor.create({
            data: {
              productId: product.id,
              distributorId: po.distributorId,
              stock: 0,
              isDefault: false
            }
          });
        }

        // 2. Update stok per supplier
        await tx.productDistributor.update({
          where: { id: productDistributor.id },
          data: { stock: { increment: stockToAdd } }
        });

        // 3. Sync stok total di Product
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: stockToAdd } },
        });

        // 4. Simpan riwayat stok
        await tx.stockHistory.create({
          data: {
            productId: product.id,
            type: 'IN',
            qtyChange: stockToAdd,
            qtyBefore,
            qtyAfter,
            unitName: item.unitName,
            note: `Penerimaan PO - ${po.distributor?.name || 'N/A'}`,
            referenceType: 'PO',
            referenceId: id,
          },
        });

        // 5. Simpan barcode baru (jika ada) - TERIKAT DENGAN SUPPLIER
        if (newBarcodeData && typeof newBarcodeData === 'object' && newBarcodeData[product.id]) {
          const productBarcodes = newBarcodeData[product.id];
          if (productBarcodes && typeof productBarcodes === 'object') {
            const newBarcode = productBarcodes[unit.id];
            // Jika ada barcode baru DAN barcode itu belum ada di list DAN tidak kosong
            if (newBarcode && typeof newBarcode === 'string' && newBarcode.trim()) {
              // Cek apakah barcode sudah ada
              const existingBarcode = await tx.barcode.findUnique({
                where: { barcode: newBarcode.trim() }
              });

              if (!existingBarcode) {
                // Simpan barcode TERIKAT DENGAN ProductDistributor ini
                await tx.barcode.create({
                  data: {
                    barcode: newBarcode.trim(),
                    productDistributorId: productDistributor.id,
                    unitId: unit.id
                  }
                });
              }
            }
          }
        }
      }

      // 2. Update status PO jadi COMPLETED
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'COMPLETED' }, // String, not enum
      });
    });
    res.status(200).json({ message: 'PO berhasil diterima' });

  } catch (error) {
    console.error('Error receivePO:', error);
    console.error('PO ID:', id);
    console.error('newBarcodeData:', newBarcodeData);
    res.status(500).json({ 
      error: 'Gagal menerima PO', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};