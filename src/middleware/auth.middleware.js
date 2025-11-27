const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware untuk verifikasi JWT token
exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token tidak ditemukan' });
    }

    const token = authHeader.substring(7); // Hapus "Bearer "
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    
    // Cek user masih aktif
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, name: true, role: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User tidak aktif atau tidak ditemukan' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token tidak valid' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token telah kadaluarsa' });
    }
    return res.status(500).json({ error: 'Gagal memverifikasi token', details: error.message });
  }
};

// Middleware untuk cek role (authorization)
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User tidak terautentikasi' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak. Role tidak cukup' });
    }

    next();
  };
};

