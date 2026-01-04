-- CreateTable: ProductDistributor (Junction table untuk Many-to-Many)
CREATE TABLE "ProductDistributor" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDistributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Barcode (terikat dengan ProductDistributor)
CREATE TABLE "Barcode" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productDistributorId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Barcode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ProductDistributor
CREATE UNIQUE INDEX "ProductDistributor_productId_distributorId_key" ON "ProductDistributor"("productId", "distributorId");
CREATE INDEX "ProductDistributor_productId_idx" ON "ProductDistributor"("productId");
CREATE INDEX "ProductDistributor_distributorId_idx" ON "ProductDistributor"("distributorId");

-- CreateIndex: Barcode
CREATE UNIQUE INDEX "Barcode_barcode_key" ON "Barcode"("barcode");
CREATE INDEX "Barcode_barcode_idx" ON "Barcode"("barcode");

-- AddForeignKey: ProductDistributor
ALTER TABLE "ProductDistributor" ADD CONSTRAINT "ProductDistributor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductDistributor" ADD CONSTRAINT "ProductDistributor_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Barcode
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_productDistributorId_fkey" FOREIGN KEY ("productDistributorId") REFERENCES "ProductDistributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data Migration: Migrasi Product.distributorId ke ProductDistributor
-- Untuk setiap Product, buat ProductDistributor dengan stock = Product.stock dan isDefault = true
INSERT INTO "ProductDistributor" ("id", "productId", "distributorId", "stock", "isDefault", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text as "id",
    "id" as "productId",
    "distributorId",
    "stock",
    true as "isDefault",
    "createdAt",
    "updatedAt"
FROM "Product"
WHERE "distributorId" IS NOT NULL;

-- Data Migration: Migrasi Unit.barcodes ke Barcode
-- Untuk setiap Unit dengan barcodes, buat Barcode terikat dengan ProductDistributor dari Product
-- Note: Menggunakan ProductDistributor pertama (isDefault = true) untuk setiap Product
INSERT INTO "Barcode" ("id", "barcode", "productDistributorId", "unitId", "createdAt")
SELECT DISTINCT ON (barcode_value)
    gen_random_uuid()::text as "id",
    barcode_value::text as "barcode",
    pd."id" as "productDistributorId",
    u."id" as "unitId",
    u."createdAt"
FROM "Unit" u
INNER JOIN "Product" p ON u."productId" = p."id"
INNER JOIN "ProductDistributor" pd ON p."id" = pd."productId" AND pd."isDefault" = true
CROSS JOIN LATERAL unnest(u."barcodes") AS barcode_value
WHERE array_length(u."barcodes", 1) > 0
  AND barcode_value IS NOT NULL
  AND barcode_value::text != '';

-- Drop Foreign Key: Product_distributorId_fkey
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_distributorId_fkey";

-- Drop Column: Product.distributorId
ALTER TABLE "Product" DROP COLUMN IF EXISTS "distributorId";

-- Drop Column: Unit.barcodes (array)
-- Note: PostgreSQL tidak support DROP COLUMN untuk array langsung, jadi kita perlu alter type dulu
ALTER TABLE "Unit" DROP COLUMN IF EXISTS "barcodes";

