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
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    // Log untuk debugging (hanya di development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth] Verifying token with secret:', jwtSecret ? 'SET' : 'NOT SET');
    }
    
    const decoded = jwt.verify(token, jwtSecret);
    
    // Cek user masih aktif
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        username: true, 
        name: true, 
        roleId: true,
        role: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        isActive: true 
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'User tidak aktif' });
    }

    // Handle case dimana user mungkin belum punya roleId (data lama)
    if (!user.roleId || !user.role) {
      // Jika user tidak punya role, set default ke KASIR
      const defaultRole = await prisma.userRole.findUnique({
        where: { code: 'KASIR' }
      });
      
      if (defaultRole) {
        try {
          // Update user dengan default role
          await prisma.user.update({
            where: { id: user.id },
            data: { roleId: defaultRole.id }
          });
          
          // Reload user dengan role
          const updatedUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              username: true,
              name: true,
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              isActive: true
            }
          });
          
          // Set role code untuk backward compatibility
          req.user = {
            ...updatedUser,
            role: updatedUser.role?.code || 'KASIR',
          };
        } catch (updateError) {
          console.error('Error updating user role:', updateError);
          // Fallback: set role ke KASIR meskipun update gagal
          req.user = {
            ...user,
            role: 'KASIR',
          };
        }
      } else {
        console.error('Default role KASIR not found in database');
        return res.status(500).json({ error: 'Role default tidak ditemukan. Silakan jalankan seed database.' });
      }
    } else {
      // Set role code untuk backward compatibility
      req.user = {
        ...user,
        role: user.role?.code || null, // Keep role as code for backward compatibility
      };
    }
    next();
  } catch (error) {
    // Log error untuk debugging
    console.error('Auth middleware error:', {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
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

    // req.user.role is now the role code (string) for backward compatibility
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak. Role tidak cukup' });
    }

    next();
  };
};

