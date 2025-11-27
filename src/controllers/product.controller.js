const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/products
exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const unitSmall = req.query.unitSmall || '';
    const unitLarge = req.query.unitLarge || '';
    const distributorId = req.query.distributorId || '';
    const skip = (page - 1) * limit;

    // Build where clause for search (case-insensitive)
    // Prisma PostgreSQL supports mode: 'insensitive' for case-insensitive search
    const whereConditions = [];
    
    if (search) {
      whereConditions.push({
        OR: [
          { 
            name: { 
              contains: search,
              mode: 'insensitive' 
            } 
          },
          { 
            sku: { 
              contains: search,
              mode: 'insensitive' 
            } 
          },
        ]
      });
    }

    // Filter by distributor
    if (distributorId) {
      whereConditions.push({
        distributorId: distributorId
      });
    }

    // Filter by satuan kecil (unit with conversion = 1)
    if (unitSmall) {
      whereConditions.push({
        units: {
          some: {
            name: unitSmall,
            conversion: 1
          }
        }
      });
    }

    // Filter by satuan besar (unit with conversion > 1)
    if (unitLarge) {
      whereConditions.push({
        units: {
          some: {
            name: unitLarge,
            conversion: { gt: 1 }
          }
        }
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    // Get total count for pagination
    const total = await prisma.product.count({ where });

    // Get paginated products
    const products = await prisma.product.findMany({
      where,
      include: { 
        units: true,
        distributor: true // Include distributor data
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    res.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data produk', details: error.message });
  }
};

// POST /api/products (Master Barang - Buat Baru)
exports.createProduct = async (req, res) => {
  const { sku, name, distributorId, minStock, units, brand, category, notes } = req.body;
  
  // Validasi input
  if (!sku || !sku.trim()) {
    return res.status(400).json({ error: 'SKU harus diisi' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama produk harus diisi' });
  }
  if (!distributorId) {
    return res.status(400).json({ error: 'Distributor harus dipilih' });
  }
  if (!units || !Array.isArray(units) || units.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 satuan' });
  }
  if (minStock === undefined || minStock < 0) {
    return res.status(400).json({ error: 'Stok minimum harus >= 0' });
  }
  
  // Validasi units
  for (const unit of units) {
    if (!unit.name || !unit.name.trim()) {
      return res.status(400).json({ error: 'Nama satuan harus diisi' });
    }
    if (!unit.price || unit.price <= 0) {
      return res.status(400).json({ error: 'Harga satuan harus > 0' });
    }
    if (!unit.conversion || unit.conversion <= 0) {
      return res.status(400).json({ error: 'Konversi satuan harus > 0' });
    }
  }
  
  // Cek apakah distributor ada
  const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
  if (!distributor) {
    return res.status(400).json({ error: 'Distributor tidak ditemukan' });
  }
  
  try {
    const newProduct = await prisma.product.create({
      data: {
        sku: sku.trim(),
        name: name.trim(),
        distributorId,
        brand,
        category,
        notes,
        minStock: parseInt(minStock) || 0,
        stock: 0, // Barang baru stoknya 0
        units: {
          create: units.map(unit => ({
            name: unit.name.trim(),
            price: parseFloat(unit.price),
            conversion: parseInt(unit.conversion),
            barcodes: Array.isArray(unit.barcodes) ? unit.barcodes.filter(b => b && b.trim()) : [],
          })),
        },
      },
      include: { units: true },
    });
    res.status(201).json(newProduct);
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target.includes('sku')) {
      return res.status(400).json({ error: `SKU '${sku}' sudah ada.` });
    }
    res.status(500).json({ error: 'Gagal membuat produk', details: error.message });
  }
};

// PUT /api/products/:id (Master Barang - Update)
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { sku, name, distributorId, minStock, units, brand, category, notes } = req.body;
  
  // Validasi input (sama seperti create)
  if (!sku || !sku.trim()) {
    return res.status(400).json({ error: 'SKU harus diisi' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama produk harus diisi' });
  }
  if (!distributorId) {
    return res.status(400).json({ error: 'Distributor harus dipilih' });
  }
  if (!units || !Array.isArray(units) || units.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 satuan' });
  }
  if (minStock === undefined || minStock < 0) {
    return res.status(400).json({ error: 'Stok minimum harus >= 0' });
  }
  
  // Validasi units
  for (const unit of units) {
    if (!unit.name || !unit.name.trim()) {
      return res.status(400).json({ error: 'Nama satuan harus diisi' });
    }
    if (!unit.price || unit.price <= 0) {
      return res.status(400).json({ error: 'Harga satuan harus > 0' });
    }
    if (!unit.conversion || unit.conversion <= 0) {
      return res.status(400).json({ error: 'Konversi satuan harus > 0' });
    }
  }
  
  // Cek apakah produk ada
  const existingProduct = await prisma.product.findUnique({ where: { id } });
  if (!existingProduct) {
    return res.status(404).json({ error: 'Produk tidak ditemukan' });
  }
  
  // Cek apakah distributor ada
  const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
  if (!distributor) {
    return res.status(400).json({ error: 'Distributor tidak ditemukan' });
  }
  
  try {
    // 1. Hapus unit lama (Prisma tidak bisa update-or-delete nested, jadi kita hapus dulu)
    await prisma.unit.deleteMany({ where: { productId: id } });

    // 2. Update produk dan buat unit baru
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        sku: sku.trim(),
        name: name.trim(),
        distributorId,
        minStock: parseInt(minStock) || 0,
        brand,
        category,
        notes,
        units: {
          create: units.map(unit => ({
            name: unit.name.trim(),
            price: parseFloat(unit.price),
            conversion: parseInt(unit.conversion),
            barcodes: Array.isArray(unit.barcodes) ? unit.barcodes.filter(b => b && b.trim()) : [],
          })),
        },
      },
      include: { units: true },
    });
    res.json(updatedProduct);
  } catch (error) {
     if (error.code === 'P2002' && error.meta?.target.includes('sku')) {
      return res.status(400).json({ error: `SKU '${sku}' sudah ada.` });
    }
    res.status(500).json({ error: 'Gagal update produk', details: error.message });
  }
};

// DELETE /api/products/:id (Master Barang - Hapus)
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({ where: { id } });
    res.status(204).send(); // No Content
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus produk' });
  }
};

// PUT /api/products/bulk-update-distributor (Bulk Update Distributor)
exports.bulkUpdateDistributor = async (req, res) => {
  const { productIds, distributorId } = req.body;

  // Validasi input
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 produk yang dipilih' });
  }
  if (!distributorId) {
    return res.status(400).json({ error: 'Distributor harus dipilih' });
  }

  // Cek apakah distributor ada
  const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
  if (!distributor) {
    return res.status(400).json({ error: 'Distributor tidak ditemukan' });
  }

  try {
    // Update semua produk yang dipilih
    const result = await prisma.product.updateMany({
      where: {
        id: {
          in: productIds
        }
      },
      data: {
        distributorId: distributorId
      }
    });

    res.json({
      message: `Berhasil mengubah distributor untuk ${result.count} produk`,
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Error in bulkUpdateDistributor:', error);
    res.status(500).json({ error: 'Gagal mengubah distributor', details: error.message });
  }
};

// PUT /api/products/bulk-update-unit (Bulk Update Satuan Kecil/Besar)
exports.bulkUpdateUnit = async (req, res) => {
  const { productIds, unitType, unitName, price, conversion } = req.body;

  // Validasi input
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 produk yang dipilih' });
  }
  if (!unitType || (unitType !== 'small' && unitType !== 'large')) {
    return res.status(400).json({ error: 'Tipe satuan harus "small" atau "large"' });
  }
  if (!unitName || !unitName.trim()) {
    return res.status(400).json({ error: 'Nama satuan harus diisi' });
  }
  if (!price || price <= 0) {
    return res.status(400).json({ error: 'Harga satuan harus > 0' });
  }
  if (!conversion || conversion <= 0) {
    return res.status(400).json({ error: 'Konversi satuan harus > 0' });
  }

  // Validasi conversion sesuai unitType
  if (unitType === 'small' && conversion !== 1) {
    return res.status(400).json({ error: 'Satuan kecil harus memiliki conversion = 1' });
  }
  if (unitType === 'large' && conversion <= 1) {
    return res.status(400).json({ error: 'Satuan besar harus memiliki conversion > 1' });
  }

  try {
    let updatedCount = 0;
    let skippedCount = 0;

    // Loop melalui semua produk yang dipilih
    for (const productId of productIds) {
      // Ambil produk dengan units
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { units: true }
      });

      if (!product) {
        skippedCount++;
        continue;
      }

      // Cari unit yang sesuai dengan unitType
      let targetUnit = null;
      if (unitType === 'small') {
        // Cari unit dengan conversion = 1
        targetUnit = product.units.find(u => u.conversion === 1);
      } else {
        // Cari unit dengan conversion > 1 (ambil yang pertama)
        targetUnit = product.units.find(u => u.conversion > 1);
      }

      if (targetUnit) {
        // Update unit yang ada
        await prisma.unit.update({
          where: { id: targetUnit.id },
          data: {
            name: unitName.trim(),
            price: parseFloat(price),
            conversion: parseInt(conversion)
          }
        });
        updatedCount++;
      } else {
        // Jika unit tidak ada, buat unit baru
        await prisma.unit.create({
          data: {
            productId: productId,
            name: unitName.trim(),
            price: parseFloat(price),
            conversion: parseInt(conversion),
            barcodes: []
          }
        });
        updatedCount++;
      }
    }

    res.json({
      message: `Berhasil mengubah satuan ${unitType === 'small' ? 'kecil' : 'besar'} untuk ${updatedCount} produk`,
      updatedCount,
      skippedCount
    });
  } catch (error) {
    console.error('Error in bulkUpdateUnit:', error);
    res.status(500).json({ error: 'Gagal mengubah satuan', details: error.message });
  }
};

// POST /api/products/:id/add-stock (Cek Barang - Tambah Stok)
exports.addStock = async (req, res) => {
  const { id } = req.params;
  const { qty, unitName, note } = req.body;

  // Validasi input
  if (!qty || qty <= 0) {
    return res.status(400).json({ error: 'Jumlah harus > 0' });
  }
  if (!unitName || !unitName.trim()) {
    return res.status(400).json({ error: 'Satuan harus diisi' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { units: true },
    });
    
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });
    
    const unit = product.units.find(u => u.name === unitName.trim());
    if (!unit) return res.status(400).json({ error: 'Satuan tidak ditemukan' });

    const stockToAdd = parseInt(qty) * unit.conversion;
    const qtyBefore = product.stock;
    const qtyAfter = qtyBefore + stockToAdd;

    // Update stok dan simpan riwayat dalam satu transaksi
    const updatedProduct = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          stock: { increment: stockToAdd },
        },
      });

      // Simpan riwayat
      await tx.stockHistory.create({
        data: {
          productId: id,
          type: 'IN',
          qtyChange: stockToAdd,
          qtyBefore,
          qtyAfter,
          unitName,
          note: note || `Tambah stok manual: ${qty} ${unitName}`,
        },
      });

      return updated;
    });

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: 'Gagal menambah stok', details: error.message });
  }
};

// GET /api/products/suggestions (Pesan Barang - Saran PO)
exports.getPOSuggestions = async (req, res) => {
  const { distributorId, page = 1, limit = 25 } = req.query;
  if (!distributorId) {
    return res.status(400).json({ error: 'Distributor ID diperlukan' });
  }
  try {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Query untuk mendapatkan produk dengan stok <= minStock
    // Kita perlu menggunakan raw query atau filter manual karena Prisma tidak support
    // perbandingan langsung antara dua field
    const allProducts = await prisma.product.findMany({
      where: {
        distributorId: distributorId,
      },
      include: { units: true },
    });

    // Filter manual: stock <= minStock
    const filteredProducts = allProducts.filter(p => p.stock <= p.minStock);
    
    // Apply pagination
    const total = filteredProducts.length;
    const suggestions = filteredProducts.slice(skip, skip + limitNum);

    res.json({
      data: suggestions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (error) {
    console.error('Error in getPOSuggestions:', error);
    res.status(500).json({ error: 'Gagal mengambil saran PO', details: error.message });
  }
};

// GET /api/products/:id/stock-card (Cek Barang - Kartu Stok)
exports.getStockCard = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ 
      where: { id: req.params.id }, 
      include: { 
        units: true,
        stockHistory: {
          orderBy: { createdAt: 'desc' },
          take: 100, // Ambil 100 riwayat terakhir
        }
      } 
    });
    
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });

    const baseUnit = product.units.find(u => u.conversion === 1) || product.units[0];
    
    // Format entries dari stockHistory dengan informasi referensi
    const entries = await Promise.all(
      product.stockHistory.map(async (history) => {
        let referenceNumber = null;
        
        // Ambil nomor referensi jika ada
        if (history.referenceType && history.referenceId) {
          try {
            if (history.referenceType === 'PO') {
              // Ambil PO berdasarkan ID
              const po = await prisma.purchaseOrder.findUnique({
                where: { id: history.referenceId },
                select: { id: true }
              });
              if (po) {
                // Format PO number dari ID (ambil 8 karakter terakhir)
                referenceNumber = `PO-${po.id.slice(-8).toUpperCase()}`;
              }
            } else if (history.referenceType === 'TRANSACTION') {
              // Ambil transaction berdasarkan ID
              const transaction = await prisma.transaction.findUnique({
                where: { id: history.referenceId },
                select: { invoiceNumber: true }
              });
              if (transaction) {
                referenceNumber = transaction.invoiceNumber;
              }
            } else if (history.referenceType === 'RETUR_PENJUALAN') {
              // Ambil retur penjualan berdasarkan ID
              const retur = await prisma.returPenjualan.findUnique({
                where: { id: history.referenceId },
                select: { invoiceNumber: true }
              });
              if (retur) {
                referenceNumber = `RET-${retur.invoiceNumber}`;
              }
            }
          } catch (err) {
            console.error(`Error fetching reference for ${history.referenceType}:${history.referenceId}:`, err);
          }
        }
        
        return {
          type: history.type === 'IN' ? 'Masuk' : history.type === 'OUT' ? 'Keluar' : 'Penyesuaian',
          qtyChange: history.qtyChange,
          qtyBefore: history.qtyBefore,
          qtyAfter: history.qtyAfter,
          timestamp: history.createdAt.toISOString(),
          note: history.note || '',
          unitName: history.unitName,
          referenceType: history.referenceType,
          referenceId: history.referenceId,
          referenceNumber: referenceNumber,
        };
      })
    );

    res.json({
      productName: product.name,
      baseUnitName: baseUnit.name,
      finalStock: product.stock,
      entries,
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil kartu stok', details: error.message });
  }
};

// Helper untuk mengambil / membuat distributor dengan cache
const distributorCache = new Map();
async function getDistributorIdByName(name) {
  if (!name) {
    if (!distributorCache.has('__default__')) {
      let defaultDistributor = await prisma.distributor.findFirst();
      if (!defaultDistributor) {
        defaultDistributor = await prisma.distributor.create({
          data: { name: 'Default Distributor' },
        });
      }
      distributorCache.set('__default__', defaultDistributor.id);
    }
    return distributorCache.get('__default__');
  }

  if (distributorCache.has(name)) {
    return distributorCache.get(name);
  }

  let distributor = await prisma.distributor.findFirst({
    where: { name },
  });
  if (!distributor) {
    distributor = await prisma.distributor.create({
      data: { name },
    });
  }
  distributorCache.set(name, distributor.id);
  return distributor.id;
}

// POST /api/products/import - Import produk dari template IPOS
exports.importProducts = async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Data import kosong' });
  }

  const successes = [];
  const failures = [];
  const CHUNK_SIZE = 200; // proses per batch agar tidak membebani memori

  try {
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);

      const promises = chunk.map(async (raw) => {
        try {
          const sku = raw.sku?.trim();
          const name = raw.name?.trim();
          if (!sku || !name) {
            failures.push({ sku, reason: 'SKU atau Nama kosong' });
            return;
          }

          const unitName = raw.unitName?.trim() || 'PCS';
          const distributorName = raw.supplierName?.trim();
          const minStock = Number(raw.minStock) || 0;
          const initialStock = Number(raw.initialStock) || 0;
          const price = Number(raw.price) || 0;
          const barcodes = raw.barcode
            ? [raw.barcode.trim()]
            : Array.isArray(raw.barcodes)
              ? raw.barcodes.filter(Boolean).map((b) => b.trim())
              : [];

          const distributorId = await getDistributorIdByName(distributorName);

          const product = await prisma.product.create({
            data: {
              sku,
              name,
              distributorId,
              minStock,
              stock: initialStock,
              brand: raw.brand?.trim() || null,
              category: raw.category?.trim() || null,
              notes: raw.notes?.trim() || null,
              units: {
                create: [
                  {
                    name: unitName,
                    price,
                    conversion: 1,
                    barcodes,
                  },
                ],
              },
            },
            include: { units: true },
          });

          if (initialStock > 0) {
            await prisma.stockHistory.create({
              data: {
                productId: product.id,
                type: 'ADJUSTMENT',
                qtyChange: initialStock,
                qtyBefore: 0,
                qtyAfter: initialStock,
                unitName,
                note: 'Stok awal import',
              },
            });
          }

          successes.push({ sku, id: product.id });
        } catch (err) {
          failures.push({
            sku: raw.sku,
            reason: err.meta?.cause || err.message || 'Gagal import produk',
          });
        }
      });

      await Promise.all(promises);
    }

    res.json({
      imported: successes.length,
      failed: failures.length,
      successes,
      failures,
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengimport produk', details: error.message });
  }
};