const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// GET /api/retur-penjualan - Get all retur penjualan dengan pagination
exports.getAllReturPenjualan = async (req, res) => {
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

    const total = await prisma.returPenjualan.count({ where });

    const returList = await prisma.returPenjualan.findMany({
      where,
      include: {
        customer: true,
        approvedBy: {
          select: { id: true, name: true, username: true }
        },
        items: {
          include: {
            product: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    res.json({
      data: returList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data retur penjualan', details: error.message });
  }
};

// POST /api/retur-penjualan - Create retur penjualan
exports.createReturPenjualan = async (req, res) => {
  const { invoiceNumber, customerId, items, note, adminPassword } = req.body;
  const userRole = req.user?.role;
  const isKasir = userRole === 'KASIR';

  // Validasi input
  if (!invoiceNumber || !invoiceNumber.trim()) {
    return res.status(400).json({ error: 'Nomor invoice harus diisi' });
  }
  if (!customerId) {
    return res.status(400).json({ error: 'Pelanggan harus dipilih' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 item yang diretur' });
  }

  // Validasi customer
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
  }

  // Validasi invoice dan transaksi
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNumber: invoiceNumber.trim() },
    include: {
      items: true,
      customer: true,
    }
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaksi dengan nomor invoice tersebut tidak ditemukan' });
  }

  if (transaction.customerId !== customerId) {
    return res.status(400).json({ error: 'Pelanggan tidak sesuai dengan transaksi' });
  }

  // Ambil semua retur sebelumnya untuk invoice ini
  const previousReturs = await prisma.returPenjualan.findMany({
    where: { invoiceNumber: invoiceNumber.trim() },
    include: { items: true }
  });

  // Hitung total retur per item dari retur sebelumnya
  const returQtyMap = new Map();
  for (const prevRetur of previousReturs) {
    for (const prevItem of prevRetur.items) {
      const key = `${prevItem.productId}_${prevItem.unitName}`;
      const currentQty = returQtyMap.get(key) || 0;
      returQtyMap.set(key, currentQty + prevItem.qty);
    }
  }

  // Validasi items
  for (const item of items) {
    if (!item.productId || !item.qty || item.qty <= 0) {
      return res.status(400).json({ error: 'Data item tidak lengkap atau jumlah tidak valid' });
    }
    if (!item.conversion) {
      return res.status(400).json({ error: 'Conversion unit harus diisi' });
    }
    
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) {
      return res.status(404).json({ error: `Produk dengan ID ${item.productId} tidak ditemukan` });
    }

    // Cek apakah item ada di transaksi asli
    const txItem = transaction.items.find(
      ti => ti.productId === item.productId && ti.unitName === item.unitName
    );
    if (!txItem) {
      return res.status(400).json({ 
        error: `Item ${item.productName} dengan satuan ${item.unitName} tidak ditemukan di transaksi ini` 
      });
    }

    // Cek total retur tidak melebihi qty di transaksi
    const key = `${item.productId}_${item.unitName}`;
    const previousReturQty = returQtyMap.get(key) || 0;
    const totalReturQty = previousReturQty + item.qty;
    
    if (totalReturQty > txItem.qty) {
      return res.status(400).json({ 
        error: `Jumlah retur untuk ${item.productName} (${item.unitName}) melebihi jumlah yang dibeli. ` +
                `Dibeli: ${txItem.qty}, Sudah diretur: ${previousReturQty}, Mencoba retur: ${item.qty}` 
      });
    }
  }

  // Validasi password admin jika user adalah KASIR
  let validatedAdminUser = null;
  if (isKasir) {
    if (!adminPassword || !adminPassword.trim()) {
      return res.status(400).json({ error: 'Password admin harus diisi untuk melakukan retur penjualan' });
    }

    // Cari semua user dengan role ADMIN atau MANAGER untuk validasi password
    const adminRole = await prisma.userRole.findUnique({ where: { code: 'ADMIN' } });
    const managerRole = await prisma.userRole.findUnique({ where: { code: 'MANAGER' } });
    
    const adminUsers = await prisma.user.findMany({
      where: {
        roleId: { in: [adminRole?.id, managerRole?.id].filter(Boolean) },
        isActive: true
      }
    });

    if (adminUsers.length === 0) {
      return res.status(400).json({ error: 'Tidak ada admin yang aktif untuk validasi' });
    }

    // Cek password untuk setiap admin/manager
    let passwordValid = false;
    for (const adminUser of adminUsers) {
      const isValidPassword = await bcrypt.compare(adminPassword.trim(), adminUser.password);
      if (isValidPassword) {
        passwordValid = true;
        validatedAdminUser = adminUser; // Simpan admin yang passwordnya cocok
        break;
      }
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Password admin salah' });
    }
  }

  try {
    // Hitung total retur
    const total = items.reduce((acc, item) => acc + (item.priceAtRetur * item.qty), 0);

    // Proses retur dengan transaction
    const result = await prisma.$transaction(async (tx) => {
      // Cek role user yang membuat retur
      const userRoleCode = userRole?.toUpperCase();
      const isAdminOrManager = userRoleCode === 'ADMIN' || userRoleCode === 'MANAGER';
      
      // Buat retur penjualan dengan status
      // Jika dibuat oleh ADMIN/MANAGER atau KASIR dengan password benar, langsung APPROVED
      const returPenjualan = await tx.returPenjualan.create({
        data: {
          invoiceNumber: invoiceNumber.trim(),
          customerId,
          total,
          refundAmount: total, // Untuk sekarang, refund = total
          status: 'APPROVED', // Langsung APPROVED karena sudah divalidasi password
          approvedById: isKasir ? validatedAdminUser.id : req.user.id,
          approvedAt: new Date(),
          note: note || null,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              productName: item.productName,
              unitName: item.unitName,
              qty: item.qty,
              priceAtRetur: item.priceAtRetur,
              subtotal: item.priceAtRetur * item.qty,
            }))
          }
        },
        include: {
          items: true,
          customer: true,
          approvedBy: {
            select: { id: true, name: true, username: true }
          }
        }
      });

      // Update stok untuk setiap item (tambah stok karena barang kembali)
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        const stockToAdd = item.qty * item.conversion;
        const qtyBefore = product.stock;
        const qtyAfter = qtyBefore + stockToAdd;

        // Update stok
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: stockToAdd } },
        });

        // Simpan riwayat stok
        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            type: 'RETURN_SALE',
            qtyChange: stockToAdd,
            qtyBefore,
            qtyAfter,
            unitName: item.unitName,
            note: `Retur penjualan - ${item.productName} - Invoice: ${invoiceNumber}`,
            referenceType: 'RETUR_PENJUALAN',
            referenceId: returPenjualan.id,
          },
        });
      }

      // Kurangi utang pelanggan jika ada utang
      const currentCustomer = await tx.customer.findUnique({ where: { id: customerId } });
      if (currentCustomer && currentCustomer.debt && Number(currentCustomer.debt) > 0) {
        const newDebt = Math.max(0, Number(currentCustomer.debt) - Number(total));
        await tx.customer.update({
          where: { id: customerId },
          data: { debt: newDebt },
        });
      }

      return returPenjualan;
    });

    res.status(201).json({
      message: 'Retur penjualan berhasil',
      retur: result,
    });

  } catch (error) {
    res.status(500).json({ error: 'Gagal memproses retur penjualan', details: error.message });
  }
};

// GET /api/retur-pembelian - Get all retur pembelian dengan pagination
exports.getAllReturPembelian = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { distributor: { name: { contains: search, mode: 'insensitive' } } },
      ]
    } : {};

    const total = await prisma.returPembelian.count({ where });

    const returList = await prisma.returPembelian.findMany({
      where,
      include: {
        distributor: true,
        items: {
          include: {
            product: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    res.json({
      data: returList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data retur pembelian', details: error.message });
  }
};

// POST /api/retur-pembelian - Create retur pembelian
exports.createReturPembelian = async (req, res) => {
  const { poNumber, distributorId, items, note } = req.body;

  // Validasi input
  if (!poNumber || !poNumber.trim()) {
    return res.status(400).json({ error: 'Nomor PO harus diisi' });
  }
  if (!distributorId) {
    return res.status(400).json({ error: 'Supplier harus dipilih' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 item yang diretur' });
  }

  // Validasi distributor
  const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
  if (!distributor) {
    return res.status(404).json({ error: 'Supplier tidak ditemukan' });
  }

  // Validasi PO - cari PO berdasarkan ID (format PO-XXXX atau langsung ID)
  let poId = poNumber.trim();
  if (poId.startsWith('PO-')) {
    // Jika format PO-XXXX, cari PO dengan ID yang berakhiran XXXX
    const suffix = poId.slice(3).toUpperCase();
    const allPOs = await prisma.purchaseOrder.findMany({
      where: { distributorId },
      select: { id: true }
    });
    const foundPO = allPOs.find(po => po.id.slice(-8).toUpperCase() === suffix);
    if (foundPO) {
      poId = foundPO.id;
    }
  }

  const originalPO = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      distributor: true,
      items: {
        include: {
          product: { include: { units: true } }
        }
      }
    }
  });

  if (!originalPO) {
    return res.status(404).json({ error: 'PO tidak ditemukan' });
  }

  if (originalPO.status !== 'COMPLETED') {
    return res.status(400).json({ error: 'PO harus sudah diterima (COMPLETED) sebelum bisa diretur' });
  }

  if (originalPO.distributorId !== distributorId) {
    return res.status(400).json({ error: 'PO tidak sesuai dengan supplier yang dipilih' });
  }

  // Ambil semua retur sebelumnya untuk PO ini
  const previousReturs = await prisma.returPembelian.findMany({
    where: { poNumber: poNumber.trim() },
    include: { items: true }
  });

  // Validasi items
  for (const item of items) {
    if (!item.productId || !item.qty || item.qty <= 0) {
      return res.status(400).json({ error: 'Data item tidak lengkap atau jumlah tidak valid' });
    }
    
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) {
      return res.status(404).json({ error: `Produk dengan ID ${item.productId} tidak ditemukan` });
    }
    
    // Cek stok cukup untuk diretur
    const stockNeeded = item.qty * item.conversion;
    if (product.stock < stockNeeded) {
      return res.status(400).json({ error: `Stok ${product.name} tidak cukup untuk diretur. Stok tersedia: ${Math.floor(product.stock / item.conversion)} ${item.unitName}` });
    }

    // Validasi terhadap PO asli
    const originalPOItem = originalPO.items.find(
      (poItem) => poItem.productId === item.productId && poItem.unitName === item.unitName
    );

    if (!originalPOItem) {
      return res.status(400).json({ error: `Produk ${item.productName} (${item.unitName}) tidak ditemukan di PO asli.` });
    }

    // Hitung total qty yang sudah diretur sebelumnya untuk item ini
    const totalPreviousReturQty = previousReturs.reduce((acc, prevRetur) => {
      const prevReturItem = prevRetur.items.find(
        (ri) => ri.productId === item.productId && ri.unitName === item.unitName
      );
      return acc + (prevReturItem ? prevReturItem.qty : 0);
    }, 0);

    // Cek apakah total retur (sebelumnya + baru) melebihi qty di PO asli
    if ((totalPreviousReturQty + item.qty) > originalPOItem.qty) {
      return res.status(400).json({
        error: `Jumlah retur untuk ${item.productName} (${item.unitName}) melebihi jumlah yang dibeli. Dibeli: ${originalPOItem.qty}, Sudah diretur: ${totalPreviousReturQty}.`
      });
    }
  }

  try {
    // Hitung total retur
    const total = items.reduce((acc, item) => acc + (item.priceAtRetur * item.qty), 0);

    // Proses retur dengan transaction
    const result = await prisma.$transaction(async (tx) => {
      // Buat retur pembelian
      const returPembelian = await tx.returPembelian.create({
        data: {
          poNumber: poNumber.trim(),
          distributorId,
          total,
          note: note || null,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              productName: item.productName,
              unitName: item.unitName,
              qty: item.qty,
              priceAtRetur: item.priceAtRetur,
              subtotal: item.priceAtRetur * item.qty,
            }))
          }
        },
        include: {
          items: true,
          distributor: true,
        }
      });

      // Update stok untuk setiap item (kurangi stok karena barang dikembalikan)
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        const stockToReduce = item.qty * item.conversion;
        const qtyBefore = product.stock;
        const qtyAfter = qtyBefore - stockToReduce;

        // Update stok
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: stockToReduce } },
        });

        // Simpan riwayat stok
        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            type: 'RETURN_PURCHASE',
            qtyChange: -stockToReduce,
            qtyBefore,
            qtyAfter,
            unitName: item.unitName,
            note: `Retur pembelian - ${item.productName} - PO: ${poNumber}`,
            referenceType: 'RETUR_PEMBELIAN',
            referenceId: returPembelian.id,
          },
        });
      }

      // Tambah hutang supplier (karena uang dikembalikan ke kita, hutang supplier bertambah)
      await tx.distributor.update({
        where: { id: distributorId },
        data: { debt: { increment: total } },
      });

      return returPembelian;
    });

    res.status(201).json({
      message: 'Retur pembelian berhasil',
      retur: result,
    });

  } catch (error) {
    res.status(500).json({ error: 'Gagal memproses retur pembelian', details: error.message });
  }
};

// PUT /api/retur/penjualan/:id/approve - Approve retur penjualan (Hanya ADMIN dan MANAGER)
exports.approveReturPenjualan = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const retur = await prisma.returPenjualan.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                units: true
              }
            }
          }
        },
        customer: true
      }
    });

    if (!retur) {
      return res.status(404).json({ error: 'Retur penjualan tidak ditemukan' });
    }

    if (retur.status.toUpperCase() !== 'PENDING') {
      return res.status(400).json({ error: `Retur penjualan sudah ${retur.status.toUpperCase() === 'APPROVED' ? 'disetujui' : 'ditolak'}` });
    }

    // Proses approval dalam transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update status retur
      const updatedRetur = await tx.returPenjualan.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  units: true
                }
              }
            }
          },
          customer: true,
          approvedBy: {
            select: { id: true, name: true, username: true }
          }
        }
      });

      // Update stok untuk setiap item (tambah stok karena barang kembali)
      for (const item of retur.items) {
        const product = item.product;
        if (!product) continue;

        // Cari unit untuk mendapatkan conversion
        const unit = product.units?.find(u => u.name === item.unitName);
        if (!unit) continue;

        const stockToAdd = item.qty * unit.conversion;
        const qtyBefore = product.stock;
        const qtyAfter = qtyBefore + stockToAdd;

        // Update stok
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: stockToAdd } },
        });

        // Simpan riwayat stok
        await tx.stockHistory.create({
          data: {
            productId: product.id,
            type: 'RETURN_SALE',
            qtyChange: stockToAdd,
            qtyBefore,
            qtyAfter,
            unitName: item.unitName,
            note: `Retur penjualan (Disetujui) - ${item.productName} - Invoice: ${retur.invoiceNumber}`,
            referenceType: 'RETUR_PENJUALAN',
            referenceId: id,
          },
        });
      }

      // Kurangi utang pelanggan jika ada utang
      const currentCustomer = await tx.customer.findUnique({ where: { id: retur.customerId } });
      if (currentCustomer && currentCustomer.debt && Number(currentCustomer.debt) > 0) {
        const newDebt = Math.max(0, Number(currentCustomer.debt) - Number(retur.total));
        await tx.customer.update({
          where: { id: retur.customerId },
          data: { debt: newDebt },
        });
      }

      return updatedRetur;
    });

    res.json({
      message: 'Retur penjualan berhasil disetujui',
      retur: result,
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyetujui retur penjualan', details: error.message });
  }
};

// PUT /api/retur/penjualan/:id/reject - Reject retur penjualan (Hanya ADMIN dan MANAGER)
exports.rejectReturPenjualan = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  try {
    const retur = await prisma.returPenjualan.findUnique({
      where: { id },
    });

    if (!retur) {
      return res.status(404).json({ error: 'Retur penjualan tidak ditemukan' });
    }

    if (retur.status.toUpperCase() !== 'PENDING') {
      return res.status(400).json({ error: `Retur penjualan sudah ${retur.status.toUpperCase() === 'APPROVED' ? 'disetujui' : 'ditolak'}` });
    }

    const updatedRetur = await prisma.returPenjualan.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: userId,
        approvedAt: new Date(),
        rejectedReason: reason || 'Ditolak oleh admin',
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: true,
        approvedBy: {
          select: { id: true, name: true, username: true }
        }
      }
    });

    res.json({
      message: 'Retur penjualan ditolak',
      retur: updatedRetur,
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menolak retur penjualan', details: error.message });
  }
};

