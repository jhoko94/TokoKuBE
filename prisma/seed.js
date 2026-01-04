const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed UserRole lookup table
  console.log('📋 Seeding UserRole...');
  const adminRole = await prisma.userRole.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'Akses penuh ke semua fitur',
      isActive: true,
    },
  });

  const kasirRole = await prisma.userRole.upsert({
    where: { code: 'KASIR' },
    update: {},
    create: {
      code: 'KASIR',
      name: 'Kasir',
      description: 'Akses untuk transaksi penjualan',
      isActive: true,
    },
  });

  const managerRole = await prisma.userRole.upsert({
    where: { code: 'MANAGER' },
    update: {},
    create: {
      code: 'MANAGER',
      name: 'Manager',
      description: 'Akses untuk manajemen dan laporan',
      isActive: true,
    },
  });

  const testerRole = await prisma.userRole.upsert({
    where: { code: 'TESTER' },
    update: {},
    create: {
      code: 'TESTER',
      name: 'Tester',
      description: 'Role untuk testing dan pengujian fitur',
      isActive: true,
    },
  });

  console.log('✅ UserRole seeded');

  // Seed CustomerType lookup table
  console.log('📋 Seeding CustomerType...');
  const umumType = await prisma.customerType.upsert({
    where: { code: 'UMUM' },
    update: {},
    create: {
      code: 'UMUM',
      name: 'Pelanggan Umum',
      canBon: false,
      description: 'Pelanggan umum tidak bisa melakukan transaksi bon',
      isActive: true,
    },
  });

  const tetapType = await prisma.customerType.upsert({
    where: { code: 'TETAP' },
    update: {},
    create: {
      code: 'TETAP',
      name: 'Pelanggan Tetap',
      canBon: true,
      description: 'Pelanggan tetap bisa melakukan transaksi bon',
      isActive: true,
    },
  });

  const grosirType = await prisma.customerType.upsert({
    where: { code: 'GROSIR' },
    update: {},
    create: {
      code: 'GROSIR',
      name: 'Grosir',
      canBon: true,
      description: 'Pelanggan grosir bisa melakukan transaksi bon',
      isActive: true,
    },
  });

  console.log('✅ CustomerType seeded');

  // Seed TransactionType lookup table
  console.log('📋 Seeding TransactionType...');
  const lunasType = await prisma.transactionType.upsert({
    where: { code: 'LUNAS' },
    update: {},
    create: {
      code: 'LUNAS',
      name: 'Lunas',
      description: 'Transaksi pembayaran langsung',
      isActive: true,
    },
  });

  const bonType = await prisma.transactionType.upsert({
    where: { code: 'BON' },
    update: {},
    create: {
      code: 'BON',
      name: 'Bon',
      description: 'Transaksi dengan pembayaran tertunda',
      isActive: true,
    },
  });

  console.log('✅ TransactionType seeded');

  // Seed default admin user
  console.log('👤 Creating admin user...');
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      // Update password dan role jika user sudah ada (untuk memastikan password tetap admin123)
      password: adminPassword,
      roleId: adminRole.id,
      isActive: true,
    },
    create: {
      username: 'admin',
      password: adminPassword,
      name: 'Administrator',
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', admin.username);

  // Seed default kasir user
  console.log('👤 Creating kasir user...');
  const kasirPassword = await bcrypt.hash('kasir123', 10);
  const kasir = await prisma.user.upsert({
    where: { username: 'kasir' },
    update: {},
    create: {
      username: 'kasir',
      password: kasirPassword,
      name: 'Kasir',
      roleId: kasirRole.id,
      isActive: true,
    },
  });

  console.log('✅ Kasir user created:', kasir.username);

  // Seed default customer "Pelanggan Umum"
  console.log('👤 Creating default customer "Pelanggan Umum"...');
  let defaultCustomer = await prisma.customer.findFirst({
    where: { name: 'Pelanggan Umum' },
    include: { type: true }
  });

  if (defaultCustomer) {
    // Update jika sudah ada, pastikan type tetap UMUM
    if (defaultCustomer.typeId !== umumType.id) {
      defaultCustomer = await prisma.customer.update({
        where: { id: defaultCustomer.id },
        data: { typeId: umumType.id },
        include: { type: true }
      });
    }
    console.log('✅ Default customer "Pelanggan Umum" already exists:', defaultCustomer.name);
  } else {
    // Create jika belum ada
    defaultCustomer = await prisma.customer.create({
      data: {
        name: 'Pelanggan Umum',
        typeId: umumType.id,
        address: null,
        phone: null,
        email: null,
        debt: 0,
      },
      include: {
        type: true,
      }
    });
    console.log('✅ Default customer "Pelanggan Umum" created:', defaultCustomer.name);
  }

  // Seed Distributors (Suppliers)
  console.log('📦 Seeding Distributors...');
  const distributors = [
    // FMCG & Consumer Goods
    { name: 'PT Unilever Indonesia Tbk', address: 'Jl. Jend. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@unilever.co.id', contactPerson: 'Customer Service' },
    { name: 'PT Wings Surya', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@wingscorp.com', contactPerson: 'Sales Department' },
    { name: 'PT Indofood Sukses Makmur Tbk', address: 'Jl. Sudirman Kav. 76-78, Jakarta Pusat 12910', phone: '021-5795-8822', email: 'info@indofood.com', contactPerson: 'Procurement' },
    { name: 'PT Mayora Indah Tbk', address: 'Jl. Tomang Raya No. 21, Jakarta Barat 11440', phone: '021-560-3000', email: 'info@mayora.com', contactPerson: 'Sales Team' },
    { name: 'PT Orang Tua Group', address: 'Jl. Hayam Wuruk No. 8, Jakarta Pusat 10120', phone: '021-6230-8888', email: 'info@ot.co.id', contactPerson: 'Distribution' },
    { name: 'PT Procter & Gamble Indonesia', address: 'Jl. Jend. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@pg.com', contactPerson: 'Distribution' },
    { name: 'PT Johnson & Johnson Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@jnj.com', contactPerson: 'Sales' },
    { name: 'PT Reckitt Benckiser Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@reckitt.com', contactPerson: 'Procurement' },
    { name: 'PT Kao Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@kao.co.id', contactPerson: 'Distribution' },
    { name: "PT L'Oreal Indonesia", address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@loreal.co.id', contactPerson: 'Sales' },
    
    // Makanan & Minuman
    { name: 'PT Coca-Cola Amatil Indonesia', address: 'Jl. Jend. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@ccamatil.co.id', contactPerson: 'Distribution' },
    { name: 'PT Pepsi-Cola Indonesia', address: 'Jl. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@pepsi.co.id', contactPerson: 'Sales' },
    { name: 'PT Sinar Sosro', address: 'Jl. Raya Jakarta-Bogor KM 30, Cibinong 16911', phone: '021-875-0000', email: 'info@sosro.com', contactPerson: 'Distribution' },
    { name: 'PT Ultra Jaya Milk Industry', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@ultrajaya.co.id', contactPerson: 'Sales' },
    { name: 'PT Frisian Flag Indonesia', address: 'Jl. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@frisianflag.co.id', contactPerson: 'Distribution' },
    { name: 'PT Garudafood Putra Putri Jaya Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@garudafood.com', contactPerson: 'Distribution' },
    { name: 'PT Siantar Top Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@siantartop.com', contactPerson: 'Sales' },
    { name: 'PT Sekar Bumi Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@sekarbumi.co.id', contactPerson: 'Distribution' },
    { name: 'PT Tiga Pilar Sejahtera Food Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@tigapilar.co.id', contactPerson: 'Sales' },
    { name: 'PT Sari Roti', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@sariroti.com', contactPerson: 'Distribution' },
    { name: 'PT Nippon Indosari Corpindo Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@nipponindosari.com', contactPerson: 'Sales' },
    { name: 'PT Mondelez Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@mondelez.com', contactPerson: 'Distribution' },
    { name: 'PT Mars Symbioscience Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@mars.com', contactPerson: 'Sales' },
    { name: 'PT Nestle Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@nestle.co.id', contactPerson: 'Distribution' },
    
    // Kesehatan & Farmasi
    { name: 'PT Kalbe Farma Tbk', address: 'Jl. Letjen Suprapto No. 4, Jakarta Pusat 10510', phone: '021-4280-3888', email: 'info@kalbe.co.id', contactPerson: 'Distribution' },
    { name: 'PT Kimia Farma Tbk', address: 'Jl. Jend. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@kimiafarma.co.id', contactPerson: 'Sales' },
    { name: 'PT Tempo Scan Pacific Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@tempo.co.id', contactPerson: 'Procurement' },
    { name: 'PT Combiphar', address: 'Jl. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@combiphar.com', contactPerson: 'Distribution' },
    { name: 'PT Dexa Medica', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@dexamedica.com', contactPerson: 'Distribution' },
    { name: 'PT Darya Varia Laboratoria Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@daryavaria.com', contactPerson: 'Sales' },
    { name: 'PT Phapros Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@phapros.co.id', contactPerson: 'Distribution' },
    { name: 'PT Enseval Putera Megatrading Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@enseval.com', contactPerson: 'Sales' },
    { name: 'PT Anugrah Pharmindo Lestari', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@anugrahpharmindo.com', contactPerson: 'Distribution' },
    { name: 'PT Guardian Pharmatama', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@guardian.co.id', contactPerson: 'Sales' },
    { name: 'PT Century Healthcare Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@century.co.id', contactPerson: 'Distribution' },
    { name: 'PT Sari Husada Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@sarihusada.co.id', contactPerson: 'Distribution' },
    { name: 'PT Nutricia Indonesia Sejahtera', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@nutricia.co.id', contactPerson: 'Sales' },
    { name: 'PT Mead Johnson Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@meadjohnson.co.id', contactPerson: 'Distribution' },
    
    // Distributor Retail & Modern Trade
    { name: 'PT Sumber Alfaria Trijaya Tbk (Alfamart)', address: 'Jl. Jend. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@alfamart.co.id', contactPerson: 'Procurement' },
    { name: 'PT Indomarco Prismatama (Indomaret)', address: 'Jl. Jend. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@indomaret.co.id', contactPerson: 'Supply Chain' },
    { name: 'PT Trans Retail Indonesia (Carrefour)', address: 'Jl. Jend. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@transretail.co.id', contactPerson: 'Merchandising' },
    { name: 'PT Hero Supermarket Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@hero.co.id', contactPerson: 'Procurement' },
    { name: 'PT Lotte Shopping Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@lotte.co.id', contactPerson: 'Buying' },
    { name: 'PT Hypermart', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@hypermart.co.id', contactPerson: 'Procurement' },
    { name: 'PT Super Indo', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@superindo.co.id', contactPerson: 'Buying' },
    { name: 'PT Giant Hypermarket', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@giant.co.id', contactPerson: 'Procurement' },
    { name: 'PT Matahari Putra Prima Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@matahari.co.id', contactPerson: 'Procurement' },
    
    // Distributor Elektronik & IT
    { name: 'PT Erajaya Swasembada Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@erajaya.com', contactPerson: 'Procurement' },
    { name: 'PT Trikomsel Oke Tbk', address: 'Jl. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@trikomsel.com', contactPerson: 'Sales' },
    { name: 'PT Sinar Mas Digital Ventures', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@smasdigital.com', contactPerson: 'Distribution' },
    { name: 'PT Tiphone Mobile Indonesia Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@tiphone.co.id', contactPerson: 'Sales' },
    { name: 'PT Global Teleshop Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@globalteleshop.com', contactPerson: 'Distribution' },
    { name: 'PT Metrodata Electronics Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@metrodata.co.id', contactPerson: 'Sales' },
    { name: 'PT Multipolar Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@multipolar.co.id', contactPerson: 'Distribution' },
    
    // Distributor Bahan Bangunan & Hardware
    { name: 'PT Siam Cement Group Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@scg.co.id', contactPerson: 'Sales' },
    { name: 'PT Semen Indonesia Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@semenindonesia.com', contactPerson: 'Distribution' },
    { name: 'PT Holcim Indonesia Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@holcim.co.id', contactPerson: 'Sales' },
    { name: 'PT Wijaya Karya Beton Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@wika.co.id', contactPerson: 'Distribution' },
    { name: 'PT Keramika Indonesia Assosiasi', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@keramika.co.id', contactPerson: 'Sales' },
    
    // Distributor Otomotif & Sparepart
    { name: 'PT Astra Otoparts Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@astraotoparts.com', contactPerson: 'Distribution' },
    { name: 'PT Gajah Tunggal Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@gajahtunggal.co.id', contactPerson: 'Sales' },
    { name: 'PT Goodyear Indonesia Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@goodyear.co.id', contactPerson: 'Distribution' },
    { name: 'PT Bridgestone Tire Indonesia', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@bridgestone.co.id', contactPerson: 'Sales' },
    
    // Distributor Fashion & Textile
    { name: 'PT Pan Brothers Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@panbrothers.com', contactPerson: 'Distribution' },
    { name: 'PT Sri Rejeki Isman Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@sriman.co.id', contactPerson: 'Sales' },
    { name: 'PT Sepatu Bata Tbk', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@bata.co.id', contactPerson: 'Distribution' },
    { name: 'PT Eigerindo Multi Produk Industri', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@eiger.co.id', contactPerson: 'Sales' },
    
    // Distributor Lokal & Regional (Contoh - bisa disesuaikan)
    { name: 'CV Distributor Sejahtera', address: 'Jl. Raya Bogor KM 30, Cibinong 16911', phone: '021-875-0000', email: 'info@distributorsejahtera.com', contactPerson: 'Bapak Budi' },
    { name: 'PT Distributor Makmur Jaya', address: 'Jl. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@makmurjaya.co.id', contactPerson: 'Ibu Sari' },
    { name: 'UD Sumber Rezeki', address: 'Jl. Raya Jakarta-Bogor, Cibinong 16911', phone: '021-875-0000', email: 'sumberrezeki@gmail.com', contactPerson: 'Pak Ahmad' },
    { name: 'PT Distributor Nusantara', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@distributornusantara.co.id', contactPerson: 'Sales Team' },
    { name: 'CV Mitra Distribusi', address: 'Jl. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'mitradistribusi@gmail.com', contactPerson: 'Pak Joko' },
    { name: 'PT Distributor Prima Mandiri', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@primamandiri.co.id', contactPerson: 'Ibu Rina' },
    { name: 'CV Jaya Abadi Distributor', address: 'Jl. Raya Bogor, Jakarta 16911', phone: '021-875-0000', email: 'jayaabadi@gmail.com', contactPerson: 'Pak Agus' },
    { name: 'PT Distributor Sentosa', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@sentosa.co.id', contactPerson: 'Bapak Hadi' },
    { name: 'UD Makmur Sejahtera', address: 'Jl. Raya Jakarta-Bogor, Cibinong 16911', phone: '021-875-0000', email: 'makmursejahtera@gmail.com', contactPerson: 'Ibu Yuni' },
    { name: 'PT Distributor Bersama', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@bersama.co.id', contactPerson: 'Pak Dedi' },
    { name: 'CV Distributor Abadi', address: 'Jl. Raya Bogor KM 30, Cibinong 16911', phone: '021-875-0000', email: 'distributorabadi@gmail.com', contactPerson: 'Pak Rudi' },
    { name: 'PT Distributor Makmur Sentosa', address: 'Jl. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@makmursentosa.co.id', contactPerson: 'Ibu Linda' },
    { name: 'UD Sumber Makmur', address: 'Jl. Raya Jakarta-Bogor, Cibinong 16911', phone: '021-875-0000', email: 'sumbermakmur@gmail.com', contactPerson: 'Pak Andi' },
    { name: 'PT Distributor Jaya Abadi', address: 'Jl. Gatot Subroto Kav. 15, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'info@jayaabadi.co.id', contactPerson: 'Bapak Surya' },
    { name: 'CV Mitra Jaya Distributor', address: 'Jl. Gatot Subroto No. 50, Jakarta Selatan 12930', phone: '021-5299-6777', email: 'mitrajaya@gmail.com', contactPerson: 'Ibu Dewi' },
  ];

  let distributorCount = 0;
  for (const dist of distributors) {
    await prisma.distributor.upsert({
      where: { name: dist.name },
      update: {},
      create: {
        name: dist.name,
        address: dist.address || null,
        phone: dist.phone || null,
        email: dist.email || null,
        contactPerson: dist.contactPerson || null,
        debt: 0,
      },
    });
    distributorCount++;
  }

  console.log(`✅ ${distributorCount} Distributors seeded`);

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
