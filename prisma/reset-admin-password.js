const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Resetting admin password...\n');

  // Cari user admin
  const admin = await prisma.user.findUnique({
    where: { username: 'admin' },
    include: { role: true }
  });

  if (!admin) {
    console.log('❌ User admin tidak ditemukan!');
    console.log('   Jalankan: node prisma/seed.js untuk membuat user admin\n');
    return;
  }

  console.log('✅ User admin ditemukan:');
  console.log(`   Username: ${admin.username}`);
  console.log(`   Name: ${admin.name}`);
  console.log(`   Role: ${admin.role?.name || 'N/A'}`);
  console.log(`   Status: ${admin.isActive ? 'Aktif' : 'Nonaktif'}\n`);

  // Hash password baru
  const newPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hashedPassword }
  });

  console.log('✅ Password admin berhasil di-reset!');
  console.log(`   Username: admin`);
  console.log(`   Password: admin123\n`);
  console.log('⚠️  Silakan login dengan kredensial di atas.\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

