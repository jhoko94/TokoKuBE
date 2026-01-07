const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/barcodes - List semua barcode dengan filter & pagination
exports.getAllBarcodes = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      search = '', 
      productId = '', 
      distributorId = '', 
      unitId = '' 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    
    if (search) {
      where.OR = [
        { barcode: { contains: search, mode: 'insensitive' } },
        { 
          productDistributor: {
            product: {
              name: { contains: search, mode: 'insensitive' }
            }
          }
        }
      ];
    }

    if (productId) {
      where.productDistributor = {
        ...where.productDistributor,
        productId: productId
      };
    }

    if (distributorId) {
      where.productDistributor = {
        ...where.productDistributor,
        distributorId: distributorId
      };
    }

    if (unitId) {
      where.unitId = unitId;
    }

    // Get barcodes with relations
    const [barcodes, total] = await Promise.all([
      prisma.barcode.findMany({
        where,
        include: {
          productDistributor: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true
                }
              },
              distributor: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          unit: {
            select: {
              id: true,
              name: true,
              conversion: true,
              price: true
            }
          }
        },
        orderBy: [
          { productDistributor: { product: { name: 'asc' } } },
          { createdAt: 'desc' }
        ],
        skip,
        take
      }),
      prisma.barcode.count({ where })
    ]);

    // Format response
    const formattedBarcodes = barcodes.map(barcode => ({
      id: barcode.id,
      barcode: barcode.barcode,
      product: {
        id: barcode.productDistributor.product.id,
        sku: barcode.productDistributor.product.sku,
        name: barcode.productDistributor.product.name
      },
      distributor: {
        id: barcode.productDistributor.distributor.id,
        name: barcode.productDistributor.distributor.name
      },
      unit: {
        id: barcode.unit.id,
        name: barcode.unit.name,
        conversion: barcode.unit.conversion,
        price: barcode.unit.price
      },
      stock: barcode.productDistributor.stock,
      createdAt: barcode.createdAt
    }));

    res.json({
      data: formattedBarcodes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getAllBarcodes:', error);
    res.status(500).json({ 
      error: 'Gagal mengambil data barcode', 
      details: error.message 
    });
  }
};

// GET /api/barcodes/:id - Detail barcode
exports.getBarcodeById = async (req, res) => {
  try {
    const { id } = req.params;

    const barcode = await prisma.barcode.findUnique({
      where: { id },
      include: {
        productDistributor: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true
              }
            },
            distributor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        unit: {
          select: {
            id: true,
            name: true,
            conversion: true
          }
        }
      }
    });

    if (!barcode) {
      return res.status(404).json({ error: 'Barcode tidak ditemukan' });
    }

    res.json({
      id: barcode.id,
      barcode: barcode.barcode,
      product: {
        id: barcode.productDistributor.product.id,
        sku: barcode.productDistributor.product.sku,
        name: barcode.productDistributor.product.name
      },
      distributor: {
        id: barcode.productDistributor.distributor.id,
        name: barcode.productDistributor.distributor.name
      },
      unit: {
        id: barcode.unit.id,
        name: barcode.unit.name,
        conversion: barcode.unit.conversion,
        price: barcode.unit.price
      },
      stock: barcode.productDistributor.stock,
      createdAt: barcode.createdAt
    });
  } catch (error) {
    console.error('Error getBarcodeById:', error);
    res.status(500).json({ 
      error: 'Gagal mengambil data barcode', 
      details: error.message 
    });
  }
};

// POST /api/barcodes - Tambah barcode baru (bisa multiple sekaligus)
exports.createBarcode = async (req, res) => {
  try {
    const { barcodes } = req.body; // Array of { productId, distributorId, unitId, barcode }

    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json({ error: 'Data barcode harus berupa array dan tidak boleh kosong' });
    }

    const results = [];
    const errors = [];

    // Process dalam transaksi
    await prisma.$transaction(async (tx) => {
      for (const barcodeData of barcodes) {
        const { productId, distributorId, unitId, barcode } = barcodeData;

        // Validasi input
        if (!productId || !distributorId || !unitId || !barcode || !barcode.trim()) {
          errors.push({ 
            data: barcodeData, 
            error: 'Product ID, Distributor ID, Unit ID, dan Barcode harus diisi' 
          });
          continue;
        }

        // Validasi produk ada
        const product = await tx.product.findUnique({
          where: { id: productId },
          include: { units: true }
        });

        if (!product) {
          errors.push({ 
            data: barcodeData, 
            error: `Produk dengan ID ${productId} tidak ditemukan` 
          });
          continue;
        }

        // Validasi unit ada dan valid untuk produk ini
        const unit = product.units.find(u => u.id === unitId);
        if (!unit) {
          errors.push({ 
            data: barcodeData, 
            error: `Unit dengan ID ${unitId} tidak valid untuk produk ini` 
          });
          continue;
        }

        // Validasi distributor ada
        const distributor = await tx.distributor.findUnique({
          where: { id: distributorId }
        });

        if (!distributor) {
          errors.push({ 
            data: barcodeData, 
            error: `Distributor dengan ID ${distributorId} tidak ditemukan` 
          });
          continue;
        }

        // Cari atau buat ProductDistributor
        let productDistributor = await tx.productDistributor.findUnique({
          where: {
            productId_distributorId: {
              productId,
              distributorId
            }
          }
        });

        if (!productDistributor) {
          // Buat ProductDistributor baru
          productDistributor = await tx.productDistributor.create({
            data: {
              productId,
              distributorId,
              stock: 0,
              isDefault: false
            }
          });
        }

        // Cek apakah barcode sudah ada (unik di seluruh sistem)
        const existingBarcode = await tx.barcode.findUnique({
          where: { barcode: barcode.trim() }
        });

        if (existingBarcode) {
          errors.push({ 
            data: barcodeData, 
            error: `Barcode ${barcode.trim()} sudah digunakan` 
          });
          continue;
        }

        // Buat barcode baru
        try {
          const newBarcode = await tx.barcode.create({
            data: {
              barcode: barcode.trim(),
              productDistributorId: productDistributor.id,
              unitId: unitId
            },
            include: {
              productDistributor: {
                include: {
                  product: {
                    select: { id: true, sku: true, name: true }
                  },
                  distributor: {
                    select: { id: true, name: true }
                  }
                }
              },
              unit: {
                select: { id: true, name: true, conversion: true }
              }
            }
          });

          results.push({
            id: newBarcode.id,
            barcode: newBarcode.barcode,
            product: newBarcode.productDistributor.product,
            distributor: newBarcode.productDistributor.distributor,
            unit: newBarcode.unit,
            stock: newBarcode.productDistributor.stock
          });
        } catch (createError) {
          if (createError.code === 'P2002') {
            errors.push({ 
              data: barcodeData, 
              error: `Barcode ${barcode.trim()} sudah digunakan` 
            });
          } else {
            errors.push({ 
              data: barcodeData, 
              error: createError.message 
            });
          }
        }
      }
    });

    if (results.length === 0 && errors.length > 0) {
      return res.status(400).json({ 
        error: 'Gagal menambahkan barcode', 
        errors 
      });
    }

    res.status(201).json({
      message: `Berhasil menambahkan ${results.length} barcode`,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error createBarcode:', error);
    res.status(500).json({ 
      error: 'Gagal menambahkan barcode', 
      details: error.message 
    });
  }
};

// PUT /api/barcodes/:id - Update barcode
exports.updateBarcode = async (req, res) => {
  try {
    const { id } = req.params;
    const { barcode: newBarcode } = req.body;

    if (!newBarcode || !newBarcode.trim()) {
      return res.status(400).json({ error: 'Barcode harus diisi' });
    }

    // Cek barcode ada
    const existingBarcode = await prisma.barcode.findUnique({
      where: { id }
    });

    if (!existingBarcode) {
      return res.status(404).json({ error: 'Barcode tidak ditemukan' });
    }

    // Cek apakah barcode baru sudah digunakan (kecuali barcode yang sama)
    if (newBarcode.trim() !== existingBarcode.barcode) {
      const duplicateBarcode = await prisma.barcode.findUnique({
        where: { barcode: newBarcode.trim() }
      });

      if (duplicateBarcode) {
        return res.status(400).json({ error: 'Barcode sudah digunakan' });
      }
    }

    // Update barcode
    const updatedBarcode = await prisma.barcode.update({
      where: { id },
      data: { barcode: newBarcode.trim() },
      include: {
        productDistributor: {
          include: {
            product: {
              select: { id: true, sku: true, name: true }
            },
            distributor: {
              select: { id: true, name: true }
            }
          }
        },
        unit: {
          select: { id: true, name: true, conversion: true }
        }
      }
    });

    res.json({
      message: 'Barcode berhasil diupdate',
      data: {
        id: updatedBarcode.id,
        barcode: updatedBarcode.barcode,
        product: updatedBarcode.productDistributor.product,
        distributor: updatedBarcode.productDistributor.distributor,
        unit: updatedBarcode.unit,
        stock: updatedBarcode.productDistributor.stock
      }
    });
  } catch (error) {
    console.error('Error updateBarcode:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Barcode sudah digunakan' });
    }
    res.status(500).json({ 
      error: 'Gagal mengupdate barcode', 
      details: error.message 
    });
  }
};

// DELETE /api/barcodes/:id - Hapus barcode
exports.deleteBarcode = async (req, res) => {
  try {
    const { id } = req.params;

    const barcode = await prisma.barcode.findUnique({
      where: { id }
    });

    if (!barcode) {
      return res.status(404).json({ error: 'Barcode tidak ditemukan' });
    }

    await prisma.barcode.delete({
      where: { id }
    });

    res.json({ message: 'Barcode berhasil dihapus' });
  } catch (error) {
    console.error('Error deleteBarcode:', error);
    res.status(500).json({ 
      error: 'Gagal menghapus barcode', 
      details: error.message 
    });
  }
};

// DELETE /api/barcodes/bulk - Bulk delete barcode
exports.bulkDeleteBarcodes = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs harus berupa array dan tidak boleh kosong' });
    }

    const result = await prisma.barcode.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    res.json({ 
      message: `Berhasil menghapus ${result.count} barcode`,
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Error bulkDeleteBarcodes:', error);
    res.status(500).json({ 
      error: 'Gagal menghapus barcode', 
      details: error.message 
    });
  }
};

// POST /api/barcodes/generate - Generate barcode random (EAN-13)
exports.generateBarcode = async (req, res) => {
  try {
    const { count = 1 } = req.body; // Jumlah barcode yang ingin di-generate

    // Fungsi untuk generate random 12 digit
    const generateRandom12Digits = () => {
      return Math.floor(100000000000 + Math.random() * 900000000000).toString();
    };

    // Fungsi untuk hitung check digit EAN-13
    const calculateCheckDigit = (digits12) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(digits12[i]);
        sum += (i % 2 === 0) ? digit : digit * 3;
      }
      const remainder = sum % 10;
      return remainder === 0 ? 0 : 10 - remainder;
    };

    // Fungsi untuk generate barcode unik
    const generateUniqueBarcode = async () => {
      let attempts = 0;
      const maxAttempts = 100;

      while (attempts < maxAttempts) {
        const digits12 = generateRandom12Digits();
        const checkDigit = calculateCheckDigit(digits12);
        const barcode = digits12 + checkDigit;

        // Cek apakah barcode sudah ada
        const existing = await prisma.barcode.findUnique({
          where: { barcode }
        });

        if (!existing) {
          return barcode;
        }

        attempts++;
      }

      throw new Error('Gagal generate barcode unik setelah beberapa percobaan');
    };

    // Generate multiple barcode
    const generatedBarcodes = [];
    for (let i = 0; i < count; i++) {
      const barcode = await generateUniqueBarcode();
      generatedBarcodes.push(barcode);
    }

    res.json({
      message: `Berhasil generate ${generatedBarcodes.length} barcode`,
      barcodes: generatedBarcodes
    });
  } catch (error) {
    console.error('Error generateBarcode:', error);
    res.status(500).json({ 
      error: 'Gagal generate barcode', 
      details: error.message 
    });
  }
};

