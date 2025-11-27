const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password harus diisi' });
    }

    // Cari user
    const user = await prisma.user.findUnique({
      where: { username: username.trim() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Akun tidak aktif' });
    }

    // Verifikasi password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    // Return user data (tanpa password)
    res.json({
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal melakukan login', details: error.message });
  }
};

// GET /api/auth/me - Get current user
exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true }
    });

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data user', details: error.message });
  }
};

// PUT /api/auth/profile - Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama harus diisi' });
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim() },
      select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true }
    });

    res.json({ 
      message: 'Profile berhasil diperbarui',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal memperbarui profile', details: error.message });
  }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Password lama dan baru harus diisi' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }

    // Get user dengan password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Verifikasi password lama
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Password lama salah' });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password berhasil diubah' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengubah password', details: error.message });
  }
};

