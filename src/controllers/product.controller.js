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

    // Filter by distributor (Many-to-Many melalui ProductDistributor)
    if (distributorId) {
      whereConditions.push({
        distributors: {
          some: {
            distributorId: distributorId
          }
        }
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
        units: {
          include: {
            barcodes: {
              include: {
                productDistributor: {
                  include: {
                    distributor: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        distributors: {
          include: {
            distributor: {
              select: {
                id: true,
                name: true
              }
            },
            barcodes: {
              include: {
                unit: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    // Tambahkan properti distributor (default) untuk setiap produk
    const productsWithDistributor = products.map(product => {
      // Cari distributor default (isDefault: true) atau ambil yang pertama
      const defaultDistributor = product.distributors?.find(d => d.isDefault) || product.distributors?.[0];
      
      return {
        ...product,
        distributor: defaultDistributor?.distributor || null
      };
    });

    res.json({
      data: productsWithDistributor,
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

// GET /api/products/search-by-name?name=NAMA_PRODUK&distributorId=DISTRIBUTOR_ID
// Mencari product dengan exact match nama + distributor (case-insensitive)
// Jika distributorId tidak diberikan, cari berdasarkan nama saja
exports.getProductByName = async (req, res) => {
  try {
    const { name, distributorId } = req.query;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama produk harus diisi' });
    }
    
    // Build where clause
    const whereClause = {
      name: {
        equals: name.trim().toUpperCase(),
        mode: 'insensitive'
      }
    };
    
    // Jika distributorId diberikan, cari produk yang memiliki distributor tersebut
    if (distributorId && distributorId.trim()) {
      whereClause.distributors = {
        some: {
          distributorId: distributorId.trim()
        }
      };
    }
    
    const product = await prisma.product.findFirst({
      where: whereClause,
      include: {
        units: true,
        distributors: {
          include: {
            distributor: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
    
    if (product) {
      // Tambahkan properti distributor (default)
      const defaultDistributor = product.distributors?.find(d => d.isDefault) || product.distributors?.[0];
      const productResponse = {
        ...product,
        distributor: defaultDistributor?.distributor || null
      };
      res.json(productResponse);
    } else {
      res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Gagal mencari produk', details: error.message });
  }
};

// POST /api/products (Master Barang - Buat Baru)
exports.createProduct = async (req, res) => {
  const { sku, name, distributorId, distributors, minStock, units, brand, category, notes } = req.body;
  
  // Validasi input
  if (!sku || !sku.trim()) {
    return res.status(400).json({ error: 'SKU harus diisi' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama produk harus diisi' });
  }
  
  // Handle backward compatibility: jika distributorId ada tapi distributors tidak, gunakan distributorId
  const distributorsList = distributors && Array.isArray(distributors) && distributors.length > 0
    ? distributors
    : (distributorId ? [{ distributorId, isDefault: true }] : []);
  
  if (distributorsList.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 distributor' });
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
  
  // Validasi semua distributor ada
  for (const dist of distributorsList) {
    const distributor = await prisma.distributor.findUnique({ where: { id: dist.distributorId } });
    if (!distributor) {
      return res.status(400).json({ error: `Distributor dengan ID ${dist.distributorId} tidak ditemukan` });
    }
  }
  
  // Pastikan minimal ada 1 supplier default
  const hasDefault = distributorsList.some(d => d.isDefault);
  if (!hasDefault && distributorsList.length > 0) {
    distributorsList[0].isDefault = true;
  }
  
  try {
    // Buat Product dan ProductDistributor dalam satu transaksi
    const newProduct = await prisma.$transaction(async (tx) => {
      // 1. Buat Product
      const product = await tx.product.create({
        data: {
          sku: sku.trim(),
          name: name.trim(),
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
              hasBarcode: unit.hasBarcode || false,
              // HAPUS: barcodes (sekarang melalui Barcode model)
            })),
          },
        },
        include: { units: true },
      });

      // 2. Buat ProductDistributor untuk setiap distributor (Many-to-Many)
      for (const dist of distributorsList) {
        const productDistributor = await tx.productDistributor.create({
          data: {
            productId: product.id,
            distributorId: dist.distributorId,
            stock: 0,
            isDefault: dist.isDefault || false,
          },
        });
        
        // 3. Buat Barcode untuk setiap kombinasi (distributor + unit)
        if (dist.barcodes && Array.isArray(dist.barcodes)) {
          for (const barcodeData of dist.barcodes) {
            const barcodeValue = typeof barcodeData === 'string' ? barcodeData : barcodeData.barcode;
            const requestedUnitId = typeof barcodeData === 'object' ? barcodeData.unitId : null;
            
            if (!barcodeValue || !barcodeValue.trim()) continue;
            
            // Cari unit yang sesuai
            let targetUnit = null;
            if (requestedUnitId) {
              // Jika ada unitId, cari berdasarkan id
              targetUnit = product.units.find(u => u.id === requestedUnitId);
            }
            
            // Jika tidak ditemukan atau tidak ada unitId, gunakan unit berdasarkan index atau conversion
            if (!targetUnit) {
              // Cari unit dengan conversion = 1 (satuan kecil) sebagai default
              targetUnit = product.units.find(u => u.conversion === 1) || product.units[0];
            }
            
            if (targetUnit) {
              // Cek apakah barcode sudah ada (unik di seluruh sistem)
              const existingBarcode = await tx.barcode.findUnique({
                where: { barcode: barcodeValue.trim() }
              });
              
              if (existingBarcode) {
                // Skip jika barcode sudah ada (bisa jadi dari distributor lain atau unit lain)
                // Atau bisa throw error jika ingin strict
                continue;
              }
              
              try {
                await tx.barcode.create({
                  data: {
                    barcode: barcodeValue.trim(),
                    productDistributorId: productDistributor.id,
                    unitId: targetUnit.id,
                  },
                });
              } catch (barcodeError) {
                // Skip jika ada error (misalnya duplikat)
                if (barcodeError.code !== 'P2002') {
                  throw barcodeError;
                }
              }
            }
          }
        }
      }

      return product;
    });
    
    // Fetch ulang produk dengan include distributors untuk menambahkan properti distributor
    const productWithDistributors = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: {
        units: true,
        distributors: {
          include: {
            distributor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    // Tambahkan properti distributor (default)
    const defaultDistributor = productWithDistributors.distributors?.find(d => d.isDefault) || productWithDistributors.distributors?.[0];
    const productResponse = {
      ...productWithDistributors,
      distributor: defaultDistributor?.distributor || null
    };
    
    res.status(201).json(productResponse);
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
  const { sku, name, distributorId, distributors, minStock, units, brand, category, notes } = req.body;
  
  // Validasi input (sama seperti create)
  if (!sku || !sku.trim()) {
    return res.status(400).json({ error: 'SKU harus diisi' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama produk harus diisi' });
  }
  
  // Handle backward compatibility: jika distributorId ada tapi distributors tidak, gunakan distributorId
  const distributorsList = distributors && Array.isArray(distributors) && distributors.length > 0
    ? distributors
    : (distributorId ? [{ distributorId, isDefault: true }] : []);
  
  if (distributorsList.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 distributor' });
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
  const existingProduct = await prisma.product.findUnique({ 
    where: { id },
    include: { distributors: true }
  });
  if (!existingProduct) {
    return res.status(404).json({ error: 'Produk tidak ditemukan' });
  }
  
  // Validasi semua distributor ada
  for (const dist of distributorsList) {
    const distributor = await prisma.distributor.findUnique({ where: { id: dist.distributorId } });
    if (!distributor) {
      return res.status(400).json({ error: `Distributor dengan ID ${dist.distributorId} tidak ditemukan` });
    }
  }
  
  // Pastikan minimal ada 1 supplier default
  const hasDefault = distributorsList.some(d => d.isDefault);
  if (!hasDefault && distributorsList.length > 0) {
    distributorsList[0].isDefault = true;
  }
  
  try {
    // Update dalam transaksi untuk handle ProductDistributor
    const updatedProduct = await prisma.$transaction(async (tx) => {
      // 1. Ambil unit yang sudah ada
      const existingUnits = await tx.unit.findMany({
        where: { productId: id }
      });

      // 2. Update produk (tanpa units dulu)
      const product = await tx.product.update({
        where: { id },
        data: {
          sku: sku.trim(),
          name: name.trim(),
          minStock: parseInt(minStock) || 0,
          brand,
          category,
          notes,
        },
        include: { units: true },
      });

      // 3. Merge units: update yang sudah ada, tambah yang baru
      for (const newUnit of units) {
        const unitName = newUnit.name.trim().toUpperCase();
        const existingUnit = existingUnits.find(u => u.name.toUpperCase() === unitName);
        
        if (existingUnit) {
          // Update unit yang sudah ada
          await tx.unit.update({
            where: { id: existingUnit.id },
            data: {
              price: parseFloat(newUnit.price),
              conversion: parseInt(newUnit.conversion),
              hasBarcode: newUnit.hasBarcode || false,
            },
          });
        } else {
          // Tambah unit baru
          await tx.unit.create({
            data: {
              productId: id,
              name: unitName,
              price: parseFloat(newUnit.price),
              conversion: parseInt(newUnit.conversion),
              hasBarcode: newUnit.hasBarcode || false,
            },
          });
        }
      }

      // 4. Fetch ulang product dengan units yang sudah diupdate
      const productWithUnits = await tx.product.findUnique({
        where: { id },
        include: { units: true },
      });

      // 5. Update ProductDistributor (Many-to-Many)
      // Hapus semua ProductDistributor yang tidak ada di distributorsList
      const existingDistributorIds = existingProduct.distributors.map(d => d.distributorId);
      const newDistributorIds = distributorsList.map(d => d.distributorId);
      const toRemove = existingDistributorIds.filter(id => !newDistributorIds.includes(id));
      
      // Hapus yang tidak ada lagi
      for (const distributorIdToRemove of toRemove) {
        await tx.productDistributor.deleteMany({
          where: {
            productId: id,
            distributorId: distributorIdToRemove
          }
        });
      }
      
      // Update atau buat ProductDistributor untuk setiap distributor di list
      for (const dist of distributorsList) {
        let productDistributor;
        const existing = await tx.productDistributor.findUnique({
          where: {
            productId_distributorId: {
              productId: id,
              distributorId: dist.distributorId
            }
          }
        });
        
        if (existing) {
          // Update jika sudah ada
          productDistributor = await tx.productDistributor.update({
            where: { id: existing.id },
            data: { isDefault: dist.isDefault || false }
          });
        } else {
          // Buat baru jika belum ada
          productDistributor = await tx.productDistributor.create({
            data: {
              productId: id,
              distributorId: dist.distributorId,
              stock: 0, // Stok baru default 0
              isDefault: dist.isDefault || false
            }
          });
        }
        
        // Update barcode untuk distributor ini
        if (dist.barcodes && Array.isArray(dist.barcodes)) {
          // Hapus barcode lama untuk kombinasi ini (jika ada)
          const existingBarcodes = await tx.barcode.findMany({
            where: {
              productDistributorId: productDistributor.id
            }
          });
          
          // Hapus yang tidak ada di list baru
          const newBarcodeValues = dist.barcodes.map(b => {
            const barcodeValue = typeof b === 'string' ? b : (b?.barcode || b);
            return barcodeValue.trim();
          });
          
          for (const existingBarcode of existingBarcodes) {
            if (!newBarcodeValues.includes(existingBarcode.barcode)) {
              await tx.barcode.delete({
                where: { id: existingBarcode.id }
              });
            }
          }
          
          // Tambah barcode baru (yang belum ada)
          for (const barcodeData of dist.barcodes) {
            const barcodeValue = typeof barcodeData === 'string' ? barcodeData : barcodeData.barcode;
            const unitId = typeof barcodeData === 'object' ? barcodeData.unitId : null;
            
            if (!barcodeValue || !barcodeValue.trim()) continue;
            
            // Cek apakah barcode sudah ada untuk kombinasi ini
            const barcodeExists = await tx.barcode.findFirst({
              where: {
                barcode: barcodeValue.trim(),
                productDistributorId: productDistributor.id
              }
            });
            
            if (!barcodeExists) {
              // Cari unit yang sesuai
              let targetUnit = null;
              if (unitId) {
                targetUnit = productWithUnits.units.find(u => u.id === unitId);
              }
              
              // Jika tidak ditemukan, gunakan unit dengan conversion = 1 (satuan kecil)
              if (!targetUnit) {
                targetUnit = productWithUnits.units.find(u => u.conversion === 1) || productWithUnits.units[0];
              }
              
              if (targetUnit) {
                // Cek apakah barcode sudah ada di sistem (unik constraint)
                const existingBarcode = await tx.barcode.findUnique({
                  where: { barcode: barcodeValue.trim() }
                });
                
                if (!existingBarcode) {
                  try {
                    await tx.barcode.create({
                      data: {
                        barcode: barcodeValue.trim(),
                        productDistributorId: productDistributor.id,
                        unitId: targetUnit.id,
                      },
                    });
                  } catch (barcodeError) {
                    // Skip jika ada error (misalnya duplikat)
                    if (barcodeError.code !== 'P2002') {
                      throw barcodeError;
                    }
                  }
                }
              }
            }
          }
        }
      }

      return productWithUnits;
    });
    
    // Fetch ulang produk dengan include distributors untuk menambahkan properti distributor
    const productWithDistributors = await prisma.product.findUnique({
      where: { id },
      include: {
        units: true,
        distributors: {
          include: {
            distributor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    // Tambahkan properti distributor (default)
    const defaultDistributor = productWithDistributors.distributors?.find(d => d.isDefault) || productWithDistributors.distributors?.[0];
    const productResponse = {
      ...productWithDistributors,
      distributor: defaultDistributor?.distributor || null
    };
    
    res.json(productResponse);
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

// DELETE /api/products/bulk - Bulk delete products
exports.bulkDeleteProducts = async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ID produk harus diisi' });
  }

  try {
    // Cek apakah semua produk ada
    const products = await prisma.product.findMany({
      where: {
        id: { in: ids }
      }
    });

    if (products.length === 0) {
      return res.status(404).json({ error: 'Tidak ada produk yang ditemukan' });
    }

    if (products.length !== ids.length) {
      return res.status(400).json({ error: 'Beberapa produk tidak ditemukan' });
    }

    // Hapus semua produk yang valid
    await prisma.product.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    res.json({ 
      message: `Berhasil menghapus ${products.length} produk`,
      deletedCount: products.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus produk', details: error.message });
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
    // Update ProductDistributor untuk semua produk yang dipilih
    let updatedCount = 0;
    
    for (const productId of productIds) {
      // Cari ProductDistributor default untuk produk ini
      const existingProductDistributor = await prisma.productDistributor.findFirst({
        where: { 
          productId: productId,
          isDefault: true 
        }
      });

      if (existingProductDistributor) {
        // Update distributor default jika berbeda
        if (existingProductDistributor.distributorId !== distributorId) {
          await prisma.productDistributor.update({
            where: { id: existingProductDistributor.id },
            data: { distributorId: distributorId }
          });
          updatedCount++;
        }
      } else {
        // Buat ProductDistributor jika belum ada
        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { stock: true }
        });
        
        if (product) {
          await prisma.productDistributor.create({
            data: {
              productId: productId,
              distributorId: distributorId,
              stock: product.stock,
              isDefault: true
            }
          });
          updatedCount++;
        }
      }
    }

    res.json({
      message: `Berhasil mengubah distributor untuk ${updatedCount} produk`,
      updatedCount: updatedCount
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

// PUT /api/products/bulk-update-minstock (Bulk Update Minimal Stok)
exports.bulkUpdateMinStock = async (req, res) => {
  const { productIds, minStock } = req.body;

  // Validasi input
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 produk yang dipilih' });
  }
  if (minStock === undefined || minStock === null || minStock < 0) {
    return res.status(400).json({ error: 'Stok minimum harus >= 0' });
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
        minStock: parseInt(minStock)
      }
    });

    res.json({
      message: `Berhasil mengubah minimal stok untuk ${result.count} produk`,
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Error in bulkUpdateMinStock:', error);
    res.status(500).json({ error: 'Gagal mengubah minimal stok', details: error.message });
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

// GET /api/products/by-barcode/:barcode (Scan Barcode)
exports.getProductByBarcode = async (req, res) => {
  const { barcode } = req.params;
  
  try {
    // Cari barcode dengan relasi ProductDistributor
    const barcodeRecord = await prisma.barcode.findUnique({
      where: { barcode },
      include: {
        productDistributor: {
          include: {
            product: {
              include: { 
                units: true 
              }
            },
            distributor: true
          }
        },
        unit: true
      }
    });

    if (!barcodeRecord) {
      return res.status(404).json({ error: 'Barcode tidak ditemukan' });
    }

    // Cek stok dari supplier yang terikat dengan barcode ini
    const productDistributor = barcodeRecord.productDistributor;
    if (productDistributor.stock <= 0) {
      return res.status(400).json({ 
        error: `Stok dari supplier ${productDistributor.distributor.name} tidak tersedia` 
      });
    }

    res.json({
      product: productDistributor.product,
      unit: barcodeRecord.unit,
      distributorId: productDistributor.distributorId, // Supplier yang terikat
      stockFromSupplier: productDistributor.stock // Stok dari supplier ini
    });
  } catch (error) {
    console.error('Error getProductByBarcode:', error);
    res.status(500).json({ 
      error: 'Gagal mencari produk berdasarkan barcode',
      details: error.message
    });
  }
};

// GET /api/products/suggestions (Pesan Barang - Saran PO)
exports.getPOSuggestions = async (req, res) => {
  const { distributorId, page = 1, limit = 25 } = req.query;
  
  if (!distributorId) {
    return res.status(400).json({ error: 'distributorId harus diisi' });
  }
  
  try {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 1. Cari ProductDistributor untuk distributor ini
    const productDistributors = await prisma.productDistributor.findMany({
      where: {
        distributorId
      },
      include: {
        product: {
          include: { units: true }
        },
        distributor: true
      }
    });

    // 2. Filter manual: stock <= product.minStock
    const filtered = productDistributors.filter(pd => pd.stock <= pd.product.minStock);

    // 3. Map ke format suggestions
    const suggestions = filtered.map(pd => ({
      ...pd.product,
      stockFromSupplier: pd.stock, // Stok dari supplier ini
      totalStock: pd.product.stock, // Stok total
      isDefaultSupplier: pd.isDefault,
      priority: pd.isDefault ? 'HIGH' : 'NORMAL'
    }));

    // 4. Apply pagination
    const total = suggestions.length;
    const paginatedSuggestions = suggestions.slice(skip, skip + limitNum);

    res.json({
      data: paginatedSuggestions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error getPOSuggestions:', error);
    res.status(500).json({ 
      error: 'Gagal mengambil saran PO',
      details: error.message
    });
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
