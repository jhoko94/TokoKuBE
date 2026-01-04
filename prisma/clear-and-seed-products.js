const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearMasterData() {
  console.log('🗑️  Clearing master barang and supplier data...');

  try {
    // 1. Hapus Barcode yang terkait dengan ProductDistributor
    console.log('📦 Deleting Barcodes...');
    const barcodeCount = await prisma.barcode.deleteMany({});
    console.log(`✅ Deleted ${barcodeCount.count} Barcodes`);

    // 2. Hapus ProductDistributor (junction table)
    console.log('📦 Deleting ProductDistributor relations...');
    const productDistributorCount = await prisma.productDistributor.deleteMany({});
    console.log(`✅ Deleted ${productDistributorCount.count} ProductDistributor relations`);

    // 3. Hapus Unit yang terkait dengan Product
    console.log('📦 Deleting Units...');
    const unitCount = await prisma.unit.deleteMany({});
    console.log(`✅ Deleted ${unitCount.count} Units`);

    // 4. Hapus StockItem yang terkait dengan Product
    console.log('📦 Deleting StockItems...');
    const stockItemCount = await prisma.stockItem.deleteMany({});
    console.log(`✅ Deleted ${stockItemCount.count} StockItems`);

    // 5. Hapus StockHistory yang terkait dengan Product
    console.log('📦 Deleting StockHistory...');
    const stockHistoryCount = await prisma.stockHistory.deleteMany({});
    console.log(`✅ Deleted ${stockHistoryCount.count} StockHistory records`);

    // 6. Hapus Product
    console.log('📦 Deleting Products...');
    const productCount = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${productCount.count} Products`);

    // 7. Hapus Distributor
    console.log('📦 Deleting Distributors...');
    const distributorCount = await prisma.distributor.deleteMany({});
    console.log(`✅ Deleted ${distributorCount.count} Distributors`);

    console.log('✨ Master data cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing master data:', error.message);
    throw error;
  }
}

async function runSeed() {
  console.log('\n🌱 Running seed-products-supplier.js...\n');
  
  // Jalankan seed script menggunakan child_process
  const { execSync } = require('child_process');
  const path = require('path');
  
  try {
    const seedPath = path.join(__dirname, 'seed-products-supplier.js');
    execSync(`node "${seedPath}"`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  } catch (error) {
    console.error('❌ Error running seed script:', error.message);
    throw error;
  }
}

async function main() {
  try {
    // Step 1: Clear master data
    await clearMasterData();
    
    // Step 2: Run seed
    console.log('\n' + '='.repeat(50));
    await runSeed();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Jalankan jika dipanggil langsung
if (require.main === module) {
  main();
}

module.exports = { clearMasterData };

