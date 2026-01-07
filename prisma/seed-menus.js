const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding menus...');

  const menus = [
    // Master Data
    { code: 'MASTER_BARANG_LIST', name: 'Master Barang', path: '/barang-master', icon: 'ArchiveBoxIcon', category: 'MASTER_DATA', order: 1 },
    { code: 'MASTER_PELANGGAN', name: 'Master Pelanggan', path: '/master-pelanggan', icon: 'UserGroupIcon', category: 'MASTER_DATA', order: 2 },
    { code: 'MASTER_SUPPLIER', name: 'Master Supplier', path: '/master-supplier', icon: 'BuildingStorefrontIcon', category: 'MASTER_DATA', order: 3 },
    { code: 'KELOLA_BARCODE', name: 'Kelola Barcode', path: '/kelola-barcode', icon: 'QrCodeIcon', category: 'MASTER_DATA', order: 4 },
    
    // Transaksi
    { code: 'PENJUALAN', name: 'Penjualan', path: '/', icon: 'ShoppingCartIcon', category: 'TRANSAKSI', order: 1 },
    { code: 'HISTORY_PENJUALAN', name: 'History Penjualan', path: '/history-penjualan', icon: 'ClockIcon', category: 'TRANSAKSI', order: 2 },
    { code: 'RETUR_PENJUALAN', name: 'Retur Penjualan', path: '/retur-penjualan', icon: 'ArrowPathIcon', category: 'TRANSAKSI', order: 3 },
    { code: 'PESAN_BARANG', name: 'Pesan Barang (PO)', path: '/pesan-barang', icon: 'TruckIcon', category: 'TRANSAKSI', order: 4 },
    { code: 'CEK_PESANAN', name: 'Cek Pesanan', path: '/cek-pesanan', icon: 'ClipboardDocumentCheckIcon', category: 'TRANSAKSI', order: 5 },
    { code: 'RETUR_PEMBELIAN', name: 'Retur Pembelian', path: '/retur-pembelian', icon: 'ArrowPathIcon', category: 'TRANSAKSI', order: 6 },
    
    // Stok
    { code: 'CEK_BARANG', name: 'Cek Barang', path: '/barang', icon: 'ArchiveBoxIcon', category: 'STOK', order: 1 },
    { code: 'STOK_OPNAME', name: 'Stok Opname', path: '/opname', icon: 'CalculatorIcon', category: 'STOK', order: 2 },
    { code: 'KARTU_STOK', name: 'Kartu Stok', path: '/kartu-stok', icon: 'BookOpenIcon', category: 'STOK', order: 3 },
    
    // Piutang & Hutang
    { code: 'PIUTANG_PELANGGAN', name: 'Piutang Pelanggan', path: '/utang', icon: 'CreditCardIcon', category: 'PIUTANG_HUTANG', order: 1 },
    { code: 'HUTANG_SUPPLIER', name: 'Hutang Supplier', path: '/hutang-supplier', icon: 'BanknotesIcon', category: 'PIUTANG_HUTANG', order: 2 },
    
    // Laporan
    { code: 'LAPORAN', name: 'Laporan', path: '/laporan', icon: 'DocumentChartBarIcon', category: 'LAPORAN', order: 1 },
    
    // Bantuan
    { code: 'HELP', name: 'Panduan Penggunaan', path: '/help', icon: 'QuestionMarkCircleIcon', category: 'BANTUAN', order: 1 },
    
    // Akun
    { code: 'PROFILE', name: 'Profile', path: '/profile', icon: 'UserIcon', category: 'AKUN', order: 1 },
    
    // User Management (hanya untuk ADMIN)
    { code: 'USER_MANAGEMENT', name: 'Manajemen User', path: '/user-management', icon: 'UserGroupIcon', category: 'AKUN', order: 2 },
    { code: 'ROLE_MANAGEMENT', name: 'Manajemen Role', path: '/role-management', icon: 'UserCircleIcon', category: 'AKUN', order: 3 },
    { code: 'ROLE_MENU_MANAGEMENT', name: 'Manajemen Akses Menu', path: '/role-menu-management', icon: 'ShieldCheckIcon', category: 'AKUN', order: 4 },
  ];

  // Upsert semua menu yang ada di array
  for (const menuData of menus) {
    await prisma.menu.upsert({
      where: { code: menuData.code },
      update: menuData,
      create: menuData
    });
  }

  // Hapus menu yang tidak ada di array (termasuk MASTER_BARANG)
  const menuCodes = menus.map(m => m.code);
  const allMenusInDb = await prisma.menu.findMany();
  const menusToDelete = allMenusInDb.filter(m => !menuCodes.includes(m.code));
  
  if (menusToDelete.length > 0) {
    console.log(`🗑️  Menghapus ${menusToDelete.length} menu yang tidak ada di daftar...`);
    for (const menuToDelete of menusToDelete) {
      // Hapus permissions terlebih dahulu
      await prisma.roleMenuPermission.deleteMany({
        where: { menuId: menuToDelete.id }
      });
      // Hapus menu
      await prisma.menu.delete({
        where: { id: menuToDelete.id }
      });
      console.log(`   ✅ Menu "${menuToDelete.name}" (${menuToDelete.code}) dihapus`);
    }
  }

  console.log('✅ Menus created/updated');

  // Set default permissions: ADMIN dan MANAGER dapat akses semua, KASIR hanya transaksi dan stok dasar
  const adminRole = await prisma.userRole.findUnique({ where: { code: 'ADMIN' } });
  const managerRole = await prisma.userRole.findUnique({ where: { code: 'MANAGER' } });
  const kasirRole = await prisma.userRole.findUnique({ where: { code: 'KASIR' } });
  const testerRole = await prisma.userRole.findUnique({ where: { code: 'TESTER' } });

  if (!adminRole || !managerRole || !kasirRole) {
    console.log('⚠️  Roles tidak ditemukan. Pastikan seed user roles sudah dijalankan.');
    return;
  }

  // Log jika TESTER role tidak ditemukan (optional untuk testing)
  if (!testerRole) {
    console.log('⚠️  TESTER role tidak ditemukan. Permission untuk TESTER akan dilewati.');
  }

  const allMenus = await prisma.menu.findMany();
  
  // ADMIN: semua menu
  if (adminRole) {
    for (const menu of allMenus) {
      await prisma.roleMenuPermission.upsert({
        where: {
          roleId_menuId: {
            roleId: adminRole.id,
            menuId: menu.id
          }
        },
        update: { canAccess: true },
        create: {
          roleId: adminRole.id,
          menuId: menu.id,
          canAccess: true
        }
      });
    }
    console.log('✅ ADMIN permissions set');
  }

  // MANAGER: semua menu kecuali user management
  if (managerRole) {
    for (const menu of allMenus) {
      // Manager tidak bisa akses user management
      const canAccess = !['USER_MANAGEMENT', 'ROLE_MANAGEMENT', 'ROLE_MENU_MANAGEMENT'].includes(menu.code);
      await prisma.roleMenuPermission.upsert({
        where: {
          roleId_menuId: {
            roleId: managerRole.id,
            menuId: menu.id
          }
        },
        update: { canAccess },
        create: {
          roleId: managerRole.id,
          menuId: menu.id,
          canAccess
        }
      });
    }
    console.log('✅ MANAGER permissions set');
  }

  // KASIR: hanya menu tertentu
  if (kasirRole) {
    const kasirAllowedMenus = allMenus.filter(m => 
      ['PENJUALAN', 'HISTORY_PENJUALAN', 'RETUR_PENJUALAN', 'CEK_BARANG', 'KARTU_STOK', 'PIUTANG_PELANGGAN', 'HELP', 'PROFILE'].includes(m.code)
    );
    
    for (const menu of kasirAllowedMenus) {
      await prisma.roleMenuPermission.upsert({
        where: {
          roleId_menuId: {
            roleId: kasirRole.id,
            menuId: menu.id
          }
        },
        update: { canAccess: true },
        create: {
          roleId: kasirRole.id,
          menuId: menu.id,
          canAccess: true
        }
      });
    }
    console.log('✅ KASIR permissions set');
  }

  // TESTER: semua menu kecuali user management (sama seperti MANAGER untuk testing)
  if (testerRole) {
    let testerMenuCount = 0;
    for (const menu of allMenus) {
      // Tester tidak bisa akses user management
      const canAccess = !['USER_MANAGEMENT', 'ROLE_MANAGEMENT', 'ROLE_MENU_MANAGEMENT'].includes(menu.code);
      await prisma.roleMenuPermission.upsert({
        where: {
          roleId_menuId: {
            roleId: testerRole.id,
            menuId: menu.id
          }
        },
        update: { canAccess },
        create: {
          roleId: testerRole.id,
          menuId: menu.id,
          canAccess
        }
      });
      if (canAccess) testerMenuCount++;
    }
    console.log(`✅ TESTER permissions set (${testerMenuCount} menus accessible)`);
  } else {
    console.log('⚠️  TESTER role tidak ditemukan, permission tidak di-set');
  }

  console.log('✅ Menu permissions seeded');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

