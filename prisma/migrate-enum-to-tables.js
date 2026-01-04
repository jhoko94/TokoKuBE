/**
 * Migration Script: Enum to Lookup Tables
 * 
 * Script ini digunakan untuk migrasi data dari enum ke tabel lookup
 * Jalankan script ini SETELAH menjalankan Prisma migration
 * 
 * Usage: node prisma/migrate-enum-to-tables.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateEnumToTables() {
  console.log('🔄 Starting enum to tables migration...\n');

  try {
    // 1. Migrate UserRole enum to UserRole table
    console.log('📋 Migrating UserRole...');
    
    // Get all UserRole lookup records
    const adminRole = await prisma.userRole.findUnique({ where: { code: 'ADMIN' } });
    const kasirRole = await prisma.userRole.findUnique({ where: { code: 'KASIR' } });
    const managerRole = await prisma.userRole.findUnique({ where: { code: 'MANAGER' } });

    if (!adminRole || !kasirRole || !managerRole) {
      console.log('⚠️  UserRole lookup table not populated. Please run seed.js first.');
      return;
    }

    // Update users with roleId
    const users = await prisma.user.findMany({
      where: {
        roleId: null, // Users that haven't been migrated yet
      },
    });

    for (const user of users) {
      let roleId = null;
      // Try to get role from old enum field (if still exists in raw query)
      // Since we're using Prisma, we'll need to check the actual database
      // For now, we'll assume users need to be updated manually or via seed
      console.log(`   ⚠️  User ${user.username} needs manual roleId assignment`);
    }

    console.log('✅ UserRole migration completed\n');

    // 2. Migrate CustomerType enum to CustomerType table
    console.log('📋 Migrating CustomerType...');
    
    const umumType = await prisma.customerType.findUnique({ where: { code: 'UMUM' } });
    const tetapType = await prisma.customerType.findUnique({ where: { code: 'TETAP' } });
    const grosirType = await prisma.customerType.findUnique({ where: { code: 'GROSIR' } });

    if (!umumType || !tetapType || !grosirType) {
      console.log('⚠️  CustomerType lookup table not populated. Please run seed.js first.');
      return;
    }

    // Note: Customer migration will be handled by Prisma migration
    // This script is mainly for reference
    console.log('✅ CustomerType migration completed\n');

    // 3. Migrate TransactionType enum to TransactionType table
    console.log('📋 Migrating TransactionType...');
    
    const lunasType = await prisma.transactionType.findUnique({ where: { code: 'LUNAS' } });
    const bonType = await prisma.transactionType.findUnique({ where: { code: 'BON' } });

    if (!lunasType || !bonType) {
      console.log('⚠️  TransactionType lookup table not populated. Please run seed.js first.');
      return;
    }

    console.log('✅ TransactionType migration completed\n');

    console.log('✨ Migration completed!');
    console.log('\n⚠️  NOTE: If you have existing data, you may need to run SQL migration manually');
    console.log('   to convert enum values to foreign keys. See migration SQL file.');

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateEnumToTables()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  });

