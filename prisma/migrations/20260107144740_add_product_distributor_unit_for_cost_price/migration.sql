-- CreateTable
CREATE TABLE "ProductDistributorUnit" (
    "id" TEXT NOT NULL,
    "productDistributorId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "costPrice" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDistributorUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductDistributorUnit_productDistributorId_unitId_key" ON "ProductDistributorUnit"("productDistributorId", "unitId");

-- CreateIndex
CREATE INDEX "ProductDistributorUnit_productDistributorId_idx" ON "ProductDistributorUnit"("productDistributorId");

-- CreateIndex
CREATE INDEX "ProductDistributorUnit_unitId_idx" ON "ProductDistributorUnit"("unitId");

-- AddForeignKey
ALTER TABLE "ProductDistributorUnit" ADD CONSTRAINT "ProductDistributorUnit_productDistributorId_fkey" FOREIGN KEY ("productDistributorId") REFERENCES "ProductDistributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDistributorUnit" ADD CONSTRAINT "ProductDistributorUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
-- Hapus kolom costPrice dari ProductDistributor karena sekarang disimpan di ProductDistributorUnit
ALTER TABLE "ProductDistributor" DROP COLUMN "costPrice";

