const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate SKU dari nama produk
function generateSKU(name, index) {
  // Ambil 3 huruf pertama dari setiap kata, uppercase
  const words = name.split(' ').filter(w => w.length > 0);
  let sku = '';
  for (const word of words) {
    if (sku.length >= 9) break;
    // Ambil maksimal 3 karakter dari setiap kata, skip angka dan karakter khusus
    const cleanWord = word.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    if (cleanWord) {
      sku += cleanWord;
    }
  }
  
  // Jika kosong, gunakan 3 karakter pertama dari nama
  if (!sku) {
    sku = name.replace(/[^a-zA-Z]/g, '').substring(0, 9).toUpperCase();
  }
  
  // Tambahkan index untuk memastikan unik (max 6 digit)
  const suffix = (index + 1).toString().padStart(6, '0');
  return (sku + suffix).substring(0, 15);
}

// Extract brand dari nama produk (kata pertama atau kata tertentu)
function extractBrand(name) {
  // Beberapa brand yang bisa diidentifikasi
  const brandKeywords = {
    'ARIES': 'ARIES',
    'ATIRA': 'ATIRA',
    'SUKRO': 'SUKRO',
    'FRENCH FRIES': 'FRENCH FRIES',
    'CHITOP': 'CHITOP',
    'BILLION': 'BILLION',
    'BINTANG': 'BINTANG',
    'BISON': 'BISON',
    'BONNS': 'BONNS',
    'CHESE BITES': 'CHESE BITES',
    'CHOCOLION': 'CHOCOLION',
    'CHOKI CHOKI': 'CHOKI CHOKI',
    'CIKUR FUJIYAMA': 'CIKUR FUJIYAMA',
    'CUCU POP': 'CUCU POP',
    'DOMINOZ': 'DOMINOZ',
    'DOOR PRIZE': 'DOOR PRIZE',
    'GOLDEN ARIES': 'GOLDEN ARIES',
    'GOPEK': 'GOPEK',
    'GOPRIME': 'GOPRIME',
    'MARIMAS': 'MARIMAS',
    'MAXX': 'MAXX',
    'MENGGILA': 'MENGGILA',
    'OHAYO': 'OHAYO',
    'OLAI-LAI': 'OLAI-LAI',
    'POGO': 'POGO',
    'PRINCES': 'PRINCES',
    'ROTI AUKA': 'ROTI AUKA',
    'ROTI GULUNG AOKA': 'ROTI GULUNG AOKA',
    'SALSA': 'SALSA',
    'SHOUN SHEEP': 'SHOUN SHEEP',
    'SOTO': 'SOTO',
    'TIC TIC': 'TIC TIC',
    'TOP ONE': 'TOP ONE',
    'TREASURE': 'TREASURE',
    'TWIST': 'TWIST',
    'VIRAL': 'VIRAL',
    'WANG': 'WANG',
  };

  const upperName = name.toUpperCase();
  for (const [keyword, brand] of Object.entries(brandKeywords)) {
    if (upperName.includes(keyword)) {
      return brand;
    }
  }
  
  // Default: ambil kata pertama
  const firstWord = name.split(' ')[0];
  return firstWord.toUpperCase();
}

async function main() {
  console.log('🌱 Seeding products and supplier from invoice data...');

  // 1. Seed Distributor ANYAR PUTRA
  console.log('📦 Seeding Distributor ANYAR PUTRA...');
  const distributor = await prisma.distributor.upsert({
    where: { name: 'ANYAR PUTRA' },
    update: {},
    create: {
      name: 'ANYAR PUTRA',
      address: 'PASAR SUBUH A 25-26',
      phone: '(0265) 777691/772255',
      email: null,
      contactPerson: 'Atim',
      debt: 0,
    },
  });
  console.log('✅ Distributor ANYAR PUTRA created/updated');

  // 2. Daftar produk unik dari invoice (menghapus duplikat)
  const products = [
    'ARIES 40',
    'ATIRA EC 2000 ISI 40',
    'BAL SUKRO ORI 2000 50% ISI (2X10)',
    'BARU FRENCH FRIES EC 2000 ISI(40)',
    'BESAR CHITOP EC 2000 ISI(40)',
    'BIG ARIES 40',
    'BILLION 40',
    'BINTANG EC 2000(40)',
    'BISON KWACI',
    'BONNS BITES EC 2000 40',
    'BRAND TOP 40',
    'CHESE BITES 40',
    'CHOCOLION 40',
    'CHOKI CHOKI ISI 9X20PCS',
    'CIKUR FUJIYAMA ISI 50',
    'CUCU POP LOLY 10X20',
    'DOMINOZ TWIST EC 1000 ISI(40)',
    'DOOR PRIZE 40',
    'ES CINCAU 24',
    'GOLDEN ARIES 40',
    'GOPEK EC 1000 ISI (60)',
    'GOPRIME 40 EC 2000',
    'HA HA MIE 10X10',
    'JELLY CHINA PAK 12 X 60',
    'JELLY GUM ISI 6X24 PCS',
    'KEDELAI BANDUNG ISI 50',
    'KEPANG DORAEMAON 36X20 PCS',
    'KRUPUK GESIT ISI 5X20 PCS',
    'LE VONTEA ISI 24',
    'MANGGA HOT BALL ISI 16X16',
    'MARIE REGAL ISI 12X10',
    'MARIMAS RS ANGGUR 120 PCS',
    'MARIMAS RS JAMBU 120 PCS',
    'MARIMAS RS JERUK PERAS 120 PCS',
    'MARIMAS RS JERUK SEGAR 120 PCS',
    'MARIMAS RS MANGGA 120 PCS',
    'MARIMAS RS MELON 120 PCS',
    'MARIMAS RS STRAWBERY 120 PCS',
    'MAXX JACKPOT 40',
    'MENGGILA 4X10PCS',
    'MINI MARSMALLOW ISI 36X20 PCS',
    'MORRIS ISI 100',
    'OHAYO BIG 40',
    'OLAI-LAI 120',
    'PERMEN MINTZ 24',
    'PIDI JELLY SEMANGKA ISI 24X30 PCS',
    'PILLOW EC 1000 ISI 4X20PCS',
    'PILUS GARUDA ISI 6X20',
    'PINO ISI 18X4PCS',
    'POGO ISI 50',
    'POPEYE SNACK 40',
    'PRINCES BABY 40',
    'RELAXA 24',
    'RIRI METALIZING ISI 5X10 EC 500',
    'ROLL KERTAS YOUKA ISI 36X20 PCS',
    'ROTI AUKA EC 2000 (60)',
    'ROTI GULUNG AOKA 60 EC 2000(60GR)',
    'SALSA 80',
    'SEREAL CAMELO 48',
    'SHoun SHEEP BIRU ISI 100',
    'SMILLING 12 X 40',
    'SNACKIT MARSMALLOW ISI 10X10',
    'SOTO JUMBO',
    'SOTOKU 40/',
    'STICK SHOUN SHEEP ISI 100',
    'SUKRO PANDA 4X10 PCS',
    'SUSU ULTRA COKLAT 40',
    'TEH KOTAK 24',
    'TIC TIC HIJAU/MRH BAWANG CLK 2000',
    'TOP ONE 6X10',
    'TREASURE BOOM 40',
    'TWIST PRIME 40',
    'VIRAL 40',
    'WANG CHIP 100',
    'BERRY SWEET ISI 24X30 PCS',
    'BIG BABOL 16X45PCS',
    'CHOYO CUP ISI 12X20 EC 500',
    'COKLAT NATNAT 18X20PCS',
  ];

  console.log(`📦 Seeding ${products.length} products...`);

  let productCount = 0;
  let unitCount = 0;
  let productDistributorCount = 0;

  for (let index = 0; index < products.length; index++) {
    const productName = products[index];
    try {
      // Generate SKU yang unik menggunakan index
      let sku = generateSKU(productName, index);
      
      // Pastikan SKU benar-benar unik dengan mengecek database
      let attempts = 0;
      while (attempts < 10) {
        const existing = await prisma.product.findUnique({
          where: { sku },
        });
        if (!existing) break;
        // Jika sudah ada, tambahkan suffix random
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        sku = generateSKU(productName, index) + random;
        sku = sku.substring(0, 15);
        attempts++;
      }

      // Extract brand
      const brand = extractBrand(productName);

      // Create or update product
      const product = await prisma.product.upsert({
        where: { sku },
        update: {
          name: productName,
          brand: brand,
        },
        create: {
          sku: sku,
          name: productName,
          brand: brand,
          category: null,
          notes: null,
          stock: 0,
          minStock: 10,
        },
      });

      productCount++;

      // Buat relasi dengan distributor ANYAR PUTRA
      await prisma.productDistributor.upsert({
        where: {
          productId_distributorId: {
            productId: product.id,
            distributorId: distributor.id,
          },
        },
        update: {},
        create: {
          productId: product.id,
          distributorId: distributor.id,
          stock: 0,
          isDefault: true, // Set sebagai supplier utama
        },
      });
      productDistributorCount++;

      // Buat unit default (PCS) untuk setiap produk
      // Harga default 0, bisa diupdate nanti
      await prisma.unit.upsert({
        where: {
          productId_name: {
            productId: product.id,
            name: 'PCS',
          },
        },
        update: {},
        create: {
          productId: product.id,
          name: 'PCS',
          price: 0,
          conversion: 1, // 1 PCS = 1 unit terkecil
        },
      });
      unitCount++;

      // Tambahkan unit CTN jika produk biasanya dijual per CTN
      // (bisa diidentifikasi dari nama produk yang mengandung "CTN" atau angka besar)
      if (productName.toUpperCase().includes('CTN') || 
          productName.match(/\d{2,}/)) { // Jika ada angka 2 digit atau lebih (kemungkinan isi per CTN)
        // Coba ekstrak angka untuk conversion (misal "ISI 40" berarti 40 pcs per CTN)
        const isiMatch = productName.match(/ISI\s*(\d+)/i);
        const conversion = isiMatch ? parseInt(isiMatch[1]) : 40; // Default 40 jika tidak ditemukan

        await prisma.unit.upsert({
          where: {
            productId_name: {
              productId: product.id,
              name: 'CTN',
            },
          },
          update: {},
          create: {
            productId: product.id,
            name: 'CTN',
            price: 0,
            conversion: conversion,
          },
        });
        unitCount++;
      }

    } catch (error) {
      console.error(`❌ Error creating product "${productName}":`, error.message);
    }
  }

  console.log(`✅ ${productCount} Products created/updated`);
  console.log(`✅ ${unitCount} Units created/updated`);
  console.log(`✅ ${productDistributorCount} Product-Distributor relations created/updated`);
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

