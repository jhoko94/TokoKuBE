const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/warehouses - Get all warehouses
exports.getAllWarehouses = async (req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { stockItems: true }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ],
    });

    res.json({ data: warehouses });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data gudang', details: error.message });
  }
};

// GET /api/warehouses/:id - Get single warehouse
exports.getWarehouse = async (req, res) => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: req.params.id },
      include: {
        stockItems: {
          include: {
            product: {
              include: {
                units: true,
                distributor: true,
              }
            }
          }
        }
      }
    });

    if (!warehouse) {
      return res.status(404).json({ error: 'Gudang tidak ditemukan' });
    }

    res.json({ warehouse });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data gudang', details: error.message });
  }
};

// POST /api/warehouses - Create warehouse
exports.createWarehouse = async (req, res) => {
  try {
    const { name, address, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama gudang harus diisi' });
    }

    // Jika set sebagai default, unset yang lain
    if (isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        isDefault: isDefault || false,
      }
    });

    res.status(201).json({
      message: 'Gudang berhasil dibuat',
      warehouse
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Nama gudang sudah digunakan' });
    }
    res.status(500).json({ error: 'Gagal membuat gudang', details: error.message });
  }
};

// PUT /api/warehouses/:id - Update warehouse
exports.updateWarehouse = async (req, res) => {
  try {
    const { name, address, isDefault, isActive } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Nama gudang tidak boleh kosong' });
    }

    // Jika set sebagai default, unset yang lain
    if (isDefault) {
      await prisma.warehouse.updateMany({
        where: {
          isDefault: true,
          id: { not: req.params.id }
        },
        data: { isDefault: false }
      });
    }

    const warehouse = await prisma.warehouse.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    res.json({
      message: 'Gudang berhasil diupdate',
      warehouse
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Gudang tidak ditemukan' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Nama gudang sudah digunakan' });
    }
    res.status(500).json({ error: 'Gagal mengupdate gudang', details: error.message });
  }
};

// DELETE /api/warehouses/:id - Delete warehouse (soft delete)
exports.deleteWarehouse = async (req, res) => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { stockItems: true }
        }
      }
    });

    if (!warehouse) {
      return res.status(404).json({ error: 'Gudang tidak ditemukan' });
    }

    if (warehouse.isDefault) {
      return res.status(400).json({ error: 'Tidak dapat menghapus gudang default' });
    }

    if (warehouse._count.stockItems > 0) {
      // Soft delete
      await prisma.warehouse.update({
        where: { id: req.params.id },
        data: { isActive: false }
      });
    } else {
      // Hard delete jika tidak ada stok
      await prisma.warehouse.delete({
        where: { id: req.params.id }
      });
    }

    res.json({ message: 'Gudang berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus gudang', details: error.message });
  }
};

// POST /api/warehouses/transfer - Transfer stock between warehouses
exports.transferStock = async (req, res) => {
  try {
    const { productId, fromWarehouseId, toWarehouseId, qty, unitName, note } = req.body;

    // Validasi
    if (!productId || !fromWarehouseId || !toWarehouseId || !qty || qty <= 0) {
      return res.status(400).json({ error: 'Data transfer tidak lengkap atau tidak valid' });
    }

    if (fromWarehouseId === toWarehouseId) {
      return res.status(400).json({ error: 'Gudang asal dan tujuan tidak boleh sama' });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { units: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    const unit = product.units.find(u => u.name === unitName);
    if (!unit) {
      return res.status(400).json({ error: 'Satuan tidak ditemukan' });
    }

    const stockToTransfer = qty * unit.conversion;

    // Proses transfer dengan transaction
    await prisma.$transaction(async (tx) => {
      // Cek stok di gudang asal
      const fromStockItem = await tx.stockItem.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: fromWarehouseId,
            productId: productId
          }
        }
      });

      const fromStock = fromStockItem?.stock || 0;
      if (fromStock < stockToTransfer) {
        throw new Error(`Stok tidak cukup. Stok tersedia: ${Math.floor(fromStock / unit.conversion)} ${unitName}`);
      }

      // Kurangi stok dari gudang asal
      await tx.stockItem.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: fromWarehouseId,
            productId: productId
          }
        },
        update: {
          stock: { decrement: stockToTransfer }
        },
        create: {
          warehouseId: fromWarehouseId,
          productId: productId,
          stock: -stockToTransfer // Tidak seharusnya terjadi, tapi untuk safety
        }
      });

      // Tambah stok ke gudang tujuan
      await tx.stockItem.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: toWarehouseId,
            productId: productId
          }
        },
        update: {
          stock: { increment: stockToTransfer }
        },
        create: {
          warehouseId: toWarehouseId,
          productId: productId,
          stock: stockToTransfer
        }
      });

      // Update stok total produk (untuk backward compatibility)
      await tx.product.update({
        where: { id: productId },
        data: {
          stock: {
            // Stok total tetap sama karena hanya pindah gudang
          }
        }
      });

      // Simpan riwayat stok
      const fromWarehouse = await tx.warehouse.findUnique({ where: { id: fromWarehouseId } });
      const toWarehouse = await tx.warehouse.findUnique({ where: { id: toWarehouseId } });

      // Riwayat untuk gudang asal (OUT)
      await tx.stockHistory.create({
        data: {
          productId,
          warehouseId: fromWarehouseId,
          type: 'TRANSFER_OUT',
          qtyChange: -stockToTransfer,
          qtyBefore: fromStock,
          qtyAfter: fromStock - stockToTransfer,
          unitName,
          note: `Transfer ke ${toWarehouse.name}${note ? ` - ${note}` : ''}`,
          referenceType: 'TRANSFER',
        }
      });

      // Riwayat untuk gudang tujuan (IN)
      const toStockItem = await tx.stockItem.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: toWarehouseId,
            productId: productId
          }
        }
      });
      const toStockBefore = toStockItem?.stock || 0;

      await tx.stockHistory.create({
        data: {
          productId,
          warehouseId: toWarehouseId,
          type: 'TRANSFER_IN',
          qtyChange: stockToTransfer,
          qtyBefore: toStockBefore,
          qtyAfter: toStockBefore + stockToTransfer,
          unitName,
          note: `Transfer dari ${fromWarehouse.name}${note ? ` - ${note}` : ''}`,
          referenceType: 'TRANSFER',
        }
      });
    });

    res.json({ message: 'Transfer stok berhasil' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal transfer stok', details: error.message });
  }
};

