const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { units: true },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data produk' });
  }
};

// POST /api/products (Master Barang - Buat Baru)
exports.createProduct = async (req, res) => {
  const { sku, name, distributorId, minStock, units } = req.body;
  try {
    const newProduct = await prisma.product.create({
      data: {
        sku,
        name,
        distributorId,
        minStock,
        stock: 0, // Barang baru stoknya 0
        units: {
          create: units.map(unit => ({
            name: unit.name,
            price: unit.price,
            conversion: unit.conversion,
            barcodes: unit.barcodes,
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
  const { sku, name, distributorId, minStock, units } = req.body;
  
  try {
    // 1. Hapus unit lama (Prisma tidak bisa update-or-delete nested, jadi kita hapus dulu)
    await prisma.unit.deleteMany({ where: { productId: id } });

    // 2. Update produk dan buat unit baru
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        sku,
        name,
        distributorId,
        minStock,
        units: {
          create: units.map(unit => ({
            name: unit.name,
            price: unit.price,
            conversion: unit.conversion,
            barcodes: unit.barcodes,
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

// POST /api/products/:id/add-stock (Cek Barang - Tambah Stok)
exports.addStock = async (req, res) => {
  const { id } = req.params;
  const { qty, unitName } = req.body;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { units: true },
    });
    
    const unit = product.units.find(u => u.name === unitName);
    if (!unit) return res.status(400).json({ error: 'Satuan tidak ditemukan' });

    const stockToAdd = parseInt(qty) * unit.conversion;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        stock: {
          increment: stockToAdd,
        },
      },
    });
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: 'Gagal menambah stok' });
  }
};

// GET /api/products/suggestions (Pesan Barang - Saran PO)
exports.getPOSuggestions = async (req, res) => {
  const { distributorId } = req.query;
  if (!distributorId) {
    return res.status(400).json({ error: 'Distributor ID diperlukan' });
  }
  try {
    const suggestions = await prisma.product.findMany({
      where: {
        distributorId: distributorId,
        stock: {
          lte: prisma.product.fields.minStock, // Dimana stock <= minStock
        },
      },
      include: { units: true },
    });
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil saran PO' });
  }
};

// GET /api/products/:id/stock-card (Cek Barang - Kartu Stok DUMMY)
exports.getStockCard = async (req, res) => {
  // Logika kartu stok nyata sangat kompleks (melibatkan tabel riwayat)
  // Kita kembalikan data dummy seperti di prototipe
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { units: true } });
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });

  res.json({
      productName: product.name,
      baseUnitName: (product.units.find(u => u.conversion === 1) || product.units[0]).name,
      finalStock: product.stock,
      entries: [
          { type: 'Penjualan', qtyChange: -2, timestamp: new Date().toISOString(), note: 'Transaksi #123 (BON)' },
          { type: 'Penerimaan PO', qtyChange: +40, timestamp: new Date().toISOString(), note: 'PO #PO-001' },
      ]
  });
};