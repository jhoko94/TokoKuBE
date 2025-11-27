const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed default admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: 'Administrator',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', admin.username);

  // Seed default kasir user
  const kasirPassword = await bcrypt.hash('kasir123', 10);
  const kasir = await prisma.user.upsert({
    where: { username: 'kasir' },
    update: {},
    create: {
      username: 'kasir',
      password: kasirPassword,
      name: 'Kasir',
      role: 'KASIR',
      isActive: true,
    },
  });

  console.log('✅ Kasir user created:', kasir.username);

  console.log('✨ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
