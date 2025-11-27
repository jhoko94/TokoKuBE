-- CreateEnum
CREATE TYPE "StockChangeType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "StockHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockChangeType" NOT NULL,
    "qtyChange" INTEGER NOT NULL,
    "qtyBefore" INTEGER NOT NULL,
    "qtyAfter" INTEGER NOT NULL,
    "unitName" TEXT,
    "note" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockHistory_productId_createdAt_idx" ON "StockHistory"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockHistory" ADD CONSTRAINT "StockHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
