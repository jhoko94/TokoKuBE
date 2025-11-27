const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// GET /api/users - Get all users dengan pagination
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    } : {};

    const total = await prisma.user.count({ where });

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data user', details: error.message });
  }
};

// GET /api/users/:id - Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data user', details: error.message });
  }
};

// POST /api/users - Create user (hanya ADMIN)
exports.createUser = async (req, res) => {
  try {
    const { username, password, name, role } = req.body;

    // Validasi
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username harus diisi' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama harus diisi' });
    }
    if (!role || !['ADMIN', 'KASIR', 'MANAGER'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' });
    }

    // Cek username sudah ada
    const existingUser = await prisma.user.findUnique({
      where: { username: username.trim() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        name: name.trim(),
        role: role,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      }
    });

    res.status(201).json({
      message: 'User berhasil dibuat',
      user
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat user', details: error.message });
  }
};

// PUT /api/users/:id - Update user
exports.updateUser = async (req, res) => {
  try {
    const { name, role, isActive } = req.body;

    // Validasi
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Nama tidak boleh kosong' });
    }
    if (role !== undefined && !['ADMIN', 'KASIR', 'MANAGER'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' });
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      }
    });

    res.json({
      message: 'User berhasil diupdate',
      user
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.status(500).json({ error: 'Gagal mengupdate user', details: error.message });
  }
};

// DELETE /api/users/:id - Delete user
exports.deleteUser = async (req, res) => {
  try {
    // Jangan izinkan delete diri sendiri
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' });
    }

    await prisma.user.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'User berhasil dihapus' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.status(500).json({ error: 'Gagal menghapus user', details: error.message });
  }
};

// POST /api/users/:id/reset-password - Reset password (hanya ADMIN)
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password berhasil direset' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    res.status(500).json({ error: 'Gagal reset password', details: error.message });
  }
};

