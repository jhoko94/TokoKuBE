const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/roles - Get all roles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await prisma.userRole.findMany({
      include: {
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: { code: 'asc' }
    });

    // Map hasil untuk include userCount
    const rolesWithCount = roles.map(role => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      userCount: role._count.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    }));

    res.json({ data: rolesWithCount });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data role', details: error.message });
  }
};

// GET /api/roles/:id - Get single role
exports.getRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await prisma.userRole.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role tidak ditemukan' });
    }

    const roleWithCount = {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      userCount: role._count.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };

    res.json({ role: roleWithCount });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data role', details: error.message });
  }
};

// POST /api/roles - Create new role
exports.createRole = async (req, res) => {
  try {
    const { code, name, description, isActive } = req.body;

    // Validasi
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Kode role harus diisi' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama role harus diisi' });
    }

    // Validasi code format (harus uppercase, alphanumeric, underscore)
    const codeRegex = /^[A-Z0-9_]+$/;
    if (!codeRegex.test(code.trim().toUpperCase())) {
      return res.status(400).json({ error: 'Kode role harus huruf besar, angka, atau underscore' });
    }

    // Cek apakah code sudah ada
    const existingRole = await prisma.userRole.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    if (existingRole) {
      return res.status(400).json({ error: 'Kode role sudah digunakan' });
    }

    const role = await prisma.userRole.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description || null,
        isActive: isActive !== undefined ? isActive : true
      },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    const roleWithCount = {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      userCount: role._count.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };

    res.status(201).json({ 
      message: 'Role berhasil dibuat',
      role: roleWithCount 
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Kode role sudah digunakan' });
    }
    res.status(500).json({ error: 'Gagal membuat role', details: error.message });
  }
};

// PUT /api/roles/:id - Update role
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, isActive } = req.body;

    // Validasi
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama role harus diisi' });
    }

    // Cek apakah role ada
    const existingRole = await prisma.userRole.findUnique({
      where: { id }
    });

    if (!existingRole) {
      return res.status(404).json({ error: 'Role tidak ditemukan' });
    }

    // Jika code diubah, validasi format
    if (code && code.trim() !== existingRole.code) {
      const codeRegex = /^[A-Z0-9_]+$/;
      if (!codeRegex.test(code.trim().toUpperCase())) {
        return res.status(400).json({ error: 'Kode role harus huruf besar, angka, atau underscore' });
      }

      // Cek apakah code baru sudah digunakan
      const codeExists = await prisma.userRole.findUnique({
        where: { code: code.trim().toUpperCase() }
      });

      if (codeExists) {
        return res.status(400).json({ error: 'Kode role sudah digunakan' });
      }
    }

    const role = await prisma.userRole.update({
      where: { id },
      data: {
        ...(code && code.trim() !== existingRole.code && { code: code.trim().toUpperCase() }),
        name: name.trim(),
        description: description !== undefined ? (description || null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    const roleWithCount = {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isActive: role.isActive,
      userCount: role._count.users,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };

    res.json({ 
      message: 'Role berhasil diupdate',
      role: roleWithCount 
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Kode role sudah digunakan' });
    }
    res.status(500).json({ error: 'Gagal update role', details: error.message });
  }
};

// DELETE /api/roles/:id - Delete role
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah role ada
    const role = await prisma.userRole.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role tidak ditemukan' });
    }

    // Cek apakah ada user yang menggunakan role ini
    if (role._count.users > 0) {
      return res.status(400).json({ 
        error: `Tidak dapat menghapus role karena masih ada ${role._count.users} user yang menggunakan role ini` 
      });
    }

    // Hapus role
    await prisma.userRole.delete({
      where: { id }
    });

    res.json({ message: 'Role berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus role', details: error.message });
  }
};


