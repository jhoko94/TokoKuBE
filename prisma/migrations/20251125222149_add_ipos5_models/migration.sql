-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'KASIR', 'MANAGER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('LUNAS', 'BON');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockChangeType" ADD VALUE 'RETURN_SALE';
ALTER TYPE "StockChangeType" ADD VALUE 'RETURN_PURCHASE';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Distributor" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "debt" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'KASIR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "customerId" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "change" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturPenjualan" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "refundAmount" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturPenjualan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturPenjualanItem" (
    "id" TEXT NOT NULL,
    "returPenjualanId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "priceAtRetur" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "ReturPenjualanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturPembelian" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturPembelian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturPembelianItem" (
    "id" TEXT NOT NULL,
    "returPembelianId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "priceAtRetur" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "ReturPembelianItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_invoiceNumber_key" ON "Transaction"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Transaction_customerId_createdAt_idx" ON "Transaction"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_invoiceNumber_idx" ON "Transaction"("invoiceNumber");

-- CreateIndex
CREATE INDEX "ReturPenjualan_customerId_createdAt_idx" ON "ReturPenjualan"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturPembelian_distributorId_createdAt_idx" ON "ReturPembelian"("distributorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturPenjualan" ADD CONSTRAINT "ReturPenjualan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturPenjualanItem" ADD CONSTRAINT "ReturPenjualanItem_returPenjualanId_fkey" FOREIGN KEY ("returPenjualanId") REFERENCES "ReturPenjualan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturPenjualanItem" ADD CONSTRAINT "ReturPenjualanItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturPembelian" ADD CONSTRAINT "ReturPembelian_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturPembelianItem" ADD CONSTRAINT "ReturPembelianItem_returPembelianId_fkey" FOREIGN KEY ("returPembelianId") REFERENCES "ReturPembelian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturPembelianItem" ADD CONSTRAINT "ReturPembelianItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
