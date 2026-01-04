const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/menus - Get all menus dengan permission per role
exports.getAllMenus = async (req, res) => {
  try {
    const menus = await prisma.menu.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
      include: {
        permissions: {
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
              }
            }
          }
        }
      }
    });

    res.json({ menus });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data menu', details: error.message });
  }
};

// GET /api/menus/user - Get menus yang bisa diakses user saat ini
exports.getUserMenus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user || !user.role) {
      return res.status(403).json({ error: 'User tidak memiliki role' });
    }

    // Get menus yang diizinkan untuk role ini
    const permissions = await prisma.roleMenuPermission.findMany({
      where: {
        roleId: user.roleId,
        canAccess: true
      },
      include: {
        menu: true
      }
    });

    const menus = permissions
      .filter(p => p.menu.isActive)
      .map(p => p.menu)
      .sort((a, b) => {
        if (a.category !== b.category) {
          return (a.category || '').localeCompare(b.category || '');
        }
        return a.order - b.order;
      });

    res.json({ menus });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil menu user', details: error.message });
  }
};

// POST /api/menus - Create menu (ADMIN only)
exports.createMenu = async (req, res) => {
  try {
    const { code, name, path, icon, category, order } = req.body;

    if (!code || !name || !path) {
      return res.status(400).json({ error: 'Code, name, dan path harus diisi' });
    }

    const menu = await prisma.menu.create({
      data: {
        code: code.toUpperCase(),
        name,
        path,
        icon,
        category: category || null,
        order: order || 0,
      }
    });

    res.status(201).json({ message: 'Menu berhasil dibuat', menu });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Code menu sudah digunakan' });
    }
    res.status(500).json({ error: 'Gagal membuat menu', details: error.message });
  }
};

// PUT /api/menus/:id - Update menu
exports.updateMenu = async (req, res) => {
  try {
    const { name, path, icon, category, order, isActive } = req.body;

    const menu = await prisma.menu.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(path && { path }),
        ...(icon !== undefined && { icon }),
        ...(category !== undefined && { category }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    res.json({ message: 'Menu berhasil diupdate', menu });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Menu tidak ditemukan' });
    }
    res.status(500).json({ error: 'Gagal mengupdate menu', details: error.message });
  }
};

// POST /api/menus/:menuId/permissions - Set permission untuk role
exports.setMenuPermission = async (req, res) => {
  try {
    const { roleId, canAccess } = req.body;
    const { menuId } = req.params;

    if (!roleId) {
      return res.status(400).json({ error: 'Role ID harus diisi' });
    }

    const permission = await prisma.roleMenuPermission.upsert({
      where: {
        roleId_menuId: {
          roleId,
          menuId
        }
      },
      update: {
        canAccess: canAccess !== undefined ? canAccess : true
      },
      create: {
        roleId,
        menuId,
        canAccess: canAccess !== undefined ? canAccess : true
      }
    });

    res.json({ message: 'Permission berhasil diset', permission });
  } catch (error) {
    res.status(500).json({ error: 'Gagal set permission', details: error.message });
  }
};

// GET /api/menus/roles/:roleId - Get menus dengan permission untuk role tertentu
exports.getRoleMenus = async (req, res) => {
  try {
    const { roleId } = req.params;

    const allMenus = await prisma.menu.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }]
    });

    const permissions = await prisma.roleMenuPermission.findMany({
      where: { roleId }
    });

    const menuMap = new Map(permissions.map(p => [p.menuId, p.canAccess]));

    const menusWithPermission = allMenus.map(menu => ({
      ...menu,
      canAccess: menuMap.get(menu.id) ?? false // Default false jika belum ada permission
    }));

    res.json({ menus: menusWithPermission });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil menu role', details: error.message });
  }
};

