const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking TESTER role and permissions...\n');

  // Check if TESTER role exists
  const testerRole = await prisma.userRole.findUnique({
    where: { code: 'TESTER' }
  });

  if (!testerRole) {
    console.log('❌ TESTER role tidak ditemukan di database!');
    console.log('   Jalankan: node prisma/seed.js\n');
    return;
  }

  console.log('✅ TESTER role ditemukan:');
  console.log(`   ID: ${testerRole.id}`);
  console.log(`   Code: ${testerRole.code}`);
  console.log(`   Name: ${testerRole.name}\n`);

  // Check permissions
  const permissions = await prisma.roleMenuPermission.findMany({
    where: {
      roleId: testerRole.id,
      canAccess: true
    },
    include: {
      menu: true
    }
  });

  console.log(`📋 Permission TESTER: ${permissions.length} menu yang bisa diakses\n`);

  if (permissions.length === 0) {
    console.log('⚠️  TESTER tidak memiliki permission apapun!');
    console.log('   Jalankan: node prisma/seed-menus.js\n');
    return;
  }

  // Group by category
  const menusByCategory = {};
  permissions.forEach(p => {
    const category = p.menu.category || 'OTHER';
    if (!menusByCategory[category]) {
      menusByCategory[category] = [];
    }
    menusByCategory[category].push(p.menu);
  });

  console.log('📂 Menu yang bisa diakses TESTER:\n');
  Object.keys(menusByCategory).sort().forEach(category => {
    console.log(`   ${category}:`);
    menusByCategory[category].forEach(menu => {
      console.log(`     - ${menu.name} (${menu.code}) - ${menu.path}`);
    });
    console.log('');
  });

  // Check users with TESTER role
  const testerUsers = await prisma.user.findMany({
    where: {
      roleId: testerRole.id
    },
    select: {
      id: true,
      username: true,
      name: true,
      isActive: true
    }
  });

  console.log(`👥 Users dengan role TESTER: ${testerUsers.length}\n`);
  if (testerUsers.length > 0) {
    testerUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.name}) - ${user.isActive ? 'Aktif' : 'Nonaktif'}`);
    });
  } else {
    console.log('   Tidak ada user dengan role TESTER');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

