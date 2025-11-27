const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Handle Prisma disconnect on process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// GET /api/store/name - Get store name only (public, no auth required)
exports.getStoreName = async (req, res) => {
  try {
    // Cek apakah store sudah ada, jika belum buat default
    let store = await prisma.store.findFirst();
    
    if (!store) {
      // Buat store default jika belum ada
      store = await prisma.store.create({
        data: {
          name: 'Toko Saya',
          address: '',
          phone: '',
          email: '',
          website: '',
          npwp: '',
          owner: '',
          description: '',
          logo: '',
        }
      });
    }

    // Hanya return nama toko
    res.json({ name: store.name });
  } catch (error) {
    console.error("Error fetching store name:", error);
    res.status(500).json({ error: 'Gagal mengambil nama toko', details: error.message });
  }
};

// GET /api/store - Get store information
exports.getStore = async (req, res) => {
  try {
    // Cek apakah store sudah ada, jika belum buat default
    let store = await prisma.store.findFirst();
    
    if (!store) {
      // Buat store default jika belum ada
      store = await prisma.store.create({
        data: {
          name: 'Toko Saya',
          address: '',
          phone: '',
          email: '',
          website: '',
          npwp: '',
          owner: '',
          description: '',
          logo: '',
        }
      });
    }

    res.json(store);
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({ error: 'Gagal mengambil data toko', details: error.message });
  }
};

// PUT /api/store - Update store information
exports.updateStore = async (req, res) => {
  try {
    const { name, address, phone, email, website, npwp, owner, description, logo } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama toko harus diisi' });
    }

    // Cek apakah store sudah ada
    let store = await prisma.store.findFirst();
    
    if (!store) {
      // Buat store baru jika belum ada
      store = await prisma.store.create({
        data: {
          name: name.trim(),
          address: address?.trim() || '',
          phone: phone?.trim() || '',
          email: email?.trim() || '',
          website: website?.trim() || '',
          npwp: npwp?.trim() || '',
          owner: owner?.trim() || '',
          description: description?.trim() || '',
          logo: logo?.trim() || '',
        }
      });
    } else {
      // Update store yang sudah ada
      store = await prisma.store.update({
        where: { id: store.id },
        data: {
          name: name.trim(),
          address: address?.trim() || '',
          phone: phone?.trim() || '',
          email: email?.trim() || '',
          website: website?.trim() || '',
          npwp: npwp?.trim() || '',
          owner: owner?.trim() || '',
          description: description?.trim() || '',
          logo: logo?.trim() || '',
        }
      });
    }

    res.json({ 
      message: 'Informasi toko berhasil diperbarui',
      store 
    });
  } catch (error) {
    console.error("Error updating store:", error);
    res.status(500).json({ error: 'Gagal memperbarui informasi toko', details: error.message });
  }
};

