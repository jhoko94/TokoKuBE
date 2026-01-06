const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Menghapus menu "Kelola Master Barang"...');

  try {
    // Cari menu dengan code 'MASTER_BARANG'
    const menu = await prisma.menu.findUnique({
      where: { code: 'MASTER_BARANG' },
      include: {
        permissions: true
      }
    });

    if (!menu) {
      console.log('⚠️  Menu "Kelola Master Barang" tidak ditemukan di database.');
      return;
    }

    console.log(`📋 Menu ditemukan: ${menu.name} (${menu.code})`);
    console.log(`📊 Menghapus ${menu.permissions.length} permission yang terkait...`);

    // Hapus semua permission yang terkait dengan menu ini
    await prisma.roleMenuPermission.deleteMany({
      where: { menuId: menu.id }
    });

    console.log('✅ Permissions berhasil dihapus');

    // Hapus menu itu sendiri
    await prisma.menu.delete({
      where: { id: menu.id }
    });

    console.log('✅ Menu "Kelola Master Barang" berhasil dihapus dari database');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

