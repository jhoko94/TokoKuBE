const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/distributors - Get all distributors dengan pagination
exports.getAllDistributors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const where = search ? {
      name: { contains: search, mode: 'insensitive' }
    } : {};

    const total = await prisma.distributor.count({ where });

    const distributors = await prisma.distributor.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    // Map hasil untuk include productCount
    const distributorsWithCount = distributors.map(dist => ({
      ...dist,
      productCount: dist._count.products
    }));

    res.json({
      data: distributorsWithCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data supplier', details: error.message });
  }
};

// GET /api/distributors/:id - Get single distributor
exports.getDistributor = async (req, res) => {
  try {
    const { id } = req.params;
    const distributor = await prisma.distributor.findUnique({
      where: { id },
      include: {
        products: {
          take: 10,
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        }
      }
    });

    if (!distributor) {
      return res.status(404).json({ error: 'Supplier tidak ditemukan' });
    }

    res.json(distributor);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data supplier', details: error.message });
  }
};

// POST /api/distributors - Create new distributor
exports.createDistributor = async (req, res) => {
  const { name, address, phone, email, contactPerson } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama supplier harus diisi' });
  }

  try {
    const distributor = await prisma.distributor.create({
      data: {
        name: name.trim(),
        address: address || null,
        phone: phone || null,
        email: email || null,
        contactPerson: contactPerson || null,
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    // Map hasil untuk include productCount
    const distributorWithCount = {
      ...distributor,
      productCount: distributor._count.products
    };

    res.status(201).json(distributorWithCount);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Supplier dengan nama tersebut sudah ada' });
    }
    res.status(500).json({ error: 'Gagal membuat supplier', details: error.message });
  }
};

// PUT /api/distributors/:id - Update distributor
exports.updateDistributor = async (req, res) => {
  const { id } = req.params;
  const { name, address, phone, email, contactPerson } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama supplier harus diisi' });
  }

  try {
    const distributor = await prisma.distributor.update({
      where: { id },
      data: {
        name: name.trim(),
        address: address || null,
        phone: phone || null,
        email: email || null,
        contactPerson: contactPerson || null,
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    // Map hasil untuk include productCount
    const distributorWithCount = {
      ...distributor,
      productCount: distributor._count.products
    };

    res.json(distributorWithCount);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier tidak ditemukan' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Supplier dengan nama tersebut sudah ada' });
    }
    res.status(500).json({ error: 'Gagal mengupdate supplier', details: error.message });
  }
};

// DELETE /api/distributors/:id - Delete distributor
exports.deleteDistributor = async (req, res) => {
  const { id } = req.params;

  try {
    // Cek apakah distributor punya produk atau PO
    const distributor = await prisma.distributor.findUnique({
      where: { id },
      include: {
        products: true,
        purchaseOrders: true,
      }
    });

    if (!distributor) {
      return res.status(404).json({ error: 'Supplier tidak ditemukan' });
    }

    if (distributor.products.length > 0) {
      return res.status(400).json({ error: 'Tidak bisa menghapus supplier yang sudah memiliki produk' });
    }

    if (distributor.purchaseOrders.length > 0) {
      return res.status(400).json({ error: 'Tidak bisa menghapus supplier yang sudah memiliki purchase order' });
    }

    await prisma.distributor.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus supplier', details: error.message });
  }
};

// GET /api/distributors/debt - Get distributors with debt
exports.getDistributorsWithDebt = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const where = {
      debt: { gt: 0 },
      ...(search && {
        name: { contains: search, mode: 'insensitive' }
      })
    };

    const total = await prisma.distributor.count({ where });

    const distributors = await prisma.distributor.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    res.json({
      data: distributors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data hutang supplier', details: error.message });
  }
};

// POST /api/distributors/:id/pay-debt - Pay supplier debt
exports.payDebt = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Jumlah bayar tidak valid' });
  }

  try {
    const distributor = await prisma.distributor.findUnique({ where: { id } });
    if (!distributor) {
      return res.status(404).json({ error: 'Supplier tidak ditemukan' });
    }

    if (amount > Number(distributor.debt)) {
      return res.status(400).json({ error: 'Jumlah bayar melebihi hutang' });
    }

    const updatedDistributor = await prisma.distributor.update({
      where: { id },
      data: {
        debt: {
          decrement: amount,
        },
      },
    });
    res.json(updatedDistributor);
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan pembayaran', details: error.message });
  }
};

// DELETE /api/distributors/bulk - Bulk delete distributors
exports.bulkDeleteDistributors = async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ID supplier harus diisi' });
  }

  try {
    // Cek semua distributor yang akan dihapus
    const distributors = await prisma.distributor.findMany({
      where: {
        id: { in: ids }
      },
      include: {
        products: true,
        purchaseOrders: true,
      }
    });

    if (distributors.length === 0) {
      return res.status(404).json({ error: 'Tidak ada supplier yang ditemukan' });
    }

    // Cek apakah ada distributor yang punya produk atau PO
    const distributorsWithProducts = distributors.filter(d => d.products.length > 0);
    const distributorsWithPO = distributors.filter(d => d.purchaseOrders.length > 0);

    if (distributorsWithProducts.length > 0) {
      const names = distributorsWithProducts.map(d => d.name).join(', ');
      return res.status(400).json({ 
        error: `Tidak bisa menghapus supplier yang sudah memiliki produk: ${names}` 
      });
    }

    if (distributorsWithPO.length > 0) {
      const names = distributorsWithPO.map(d => d.name).join(', ');
      return res.status(400).json({ 
        error: `Tidak bisa menghapus supplier yang sudah memiliki purchase order: ${names}` 
      });
    }

    // Hapus semua distributor yang valid
    await prisma.distributor.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    res.json({ 
      message: `Berhasil menghapus ${distributors.length} supplier`,
      deletedCount: distributors.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus supplier', details: error.message });
  }
};

