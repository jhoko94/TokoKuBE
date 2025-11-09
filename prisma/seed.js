const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // 1. Buat Distributor
  const indofood = await prisma.distributor.upsert({
    where: { name: 'PT. Indofood Sukses' },
    update: {},
    create: { name: 'PT. Indofood Sukses' },
  });
  const frisianFlag = await prisma.distributor.upsert({
    where: { name: 'PT. Frisian Flag' },
    update: {},
    create: { name: 'PT. Frisian Flag' },
  });
  const wings = await prisma.distributor.upsert({
    where: { name: 'PT. Wings Surya' },
    update: {},
    create: { name: 'PT. Wings Surya' },
  });

  // 2. Buat Pelanggan
  await prisma.customer.upsert({
    where: { id: 'c1' },
    update: {},
    create: { id: 'c1', name: 'Pelanggan Umum', type: 'UMUM', debt: 0 },
  });
  await prisma.customer.upsert({
    where: { id: 'c2' },
    update: {},
    create: { id: 'c2', name: 'Budi Santoso', type: 'TETAP', debt: 75000 },
  });
  await prisma.customer.upsert({
    where: { id: 'c3' },
    update: {},
    create: { id: 'c3', name: 'Warung Bu Ani', type: 'GROSIR', debt: 250000 },
  });
  await prisma.customer.upsert({
    where: { id: 'c4' },
    update: {},
    create: { id: 'c4', name: 'Siti Aminah', type: 'TETAP', debt: 0 },
  });

  // 3. Buat Produk (dengan satuan)
  await prisma.product.upsert({
    where: { sku: 'IDM-G-01' },
    update: {},
    create: {
      sku: 'IDM-G-01',
      name: 'Indomie Goreng',
      stock: 75,
      minStock: 20,
      distributorId: indofood.id,
      units: {
        create: [
          { name: 'Pcs', price: 3000, conversion: 1, barcodes: ['1111', '1112-BARU', '1113-LAMA'] },
          { name: 'Dus', price: 115000, conversion: 40, barcodes: ['2222'] },
        ],
      },
    },
  });

  await prisma.product.upsert({
    where: { sku: 'SKM-K-01' },
    update: {},
    create: {
      sku: 'SKM-K-01',
      name: 'Susu Kental Manis',
      stock: 40,
      minStock: 10,
      distributorId: frisianFlag.id,
      units: {
        create: [
          { name: 'Kaleng', price: 10000, conversion: 1, barcodes: ['3333'] },
          { name: 'Pack', price: 58000, conversion: 6, barcodes: ['4444'] },
        ],
      },
    },
  });
  
  await prisma.product.upsert({
    where: { sku: 'KPA-S-01' },
    update: {},
    create: {
      sku: 'KPA-S-01',
      name: 'Kopi Kapal Api',
      stock: 8,
      minStock: 10,
      distributorId: indofood.id,
      units: {
        create: [
          { name: 'Sachet', price: 1500, conversion: 1, barcodes: ['5555'] },
          { name: 'Renceng', price: 14000, conversion: 10, barcodes: ['6666'] },
        ],
      },
    },
  });
  
  // 4. Buat Produk dan PO Pending (Contoh dari script.js)
  const sabun = await prisma.product.upsert({
    where: { sku: 'WGS-SB-01' },
    update: {},
    create: {
      sku: 'WGS-SB-01',
      name: 'Sabun Colek Ekonomi',
      stock: 0,
      minStock: 10,
      distributorId: wings.id,
      units: {
        create: [
          { name: 'Bungkus', price: 2000, conversion: 1, barcodes: ['7777'] },
          { name: 'Karton', price: 38000, conversion: 20, barcodes: ['8888'] },
        ],
      },
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { id: 'po1' },
    update: {},
    create: {
      id: 'po1',
      distributorId: wings.id,
      status: 'PENDING',
      items: {
        create: [
          { productId: sabun.id, qty: 2, unitName: 'Karton' },
        ],
      },
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });