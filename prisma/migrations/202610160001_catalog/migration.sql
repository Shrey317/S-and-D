-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "commerce";

-- CreateEnum
CREATE TYPE "commerce"."ProductState" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "commerce"."SellingUnit" AS ENUM ('PACK', 'EACH', 'BUNCH', 'BAG');

-- CreateTable
CREATE TABLE "commerce"."Category" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce"."Product" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "state" "commerce"."ProductState" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce"."ProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "unit" "commerce"."SellingUnit" NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce"."InventoryBalance" (
    "variantId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("variantId")
);

-- CreateTable
CREATE TABLE "commerce"."ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "assetId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "format" VARCHAR(8) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" VARCHAR(240) NOT NULL,
    "provenance" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce"."DevelopmentMarker" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,

    CONSTRAINT "DevelopmentMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "commerce"."Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "commerce"."Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "commerce"."Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_state_idx" ON "commerce"."Product"("categoryId", "state");

-- CreateIndex
CREATE INDEX "Product_state_featured_idx" ON "commerce"."Product"("state", "featured");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "commerce"."ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_active_price_idx" ON "commerce"."ProductVariant"("productId", "active", "price");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_label_key" ON "commerce"."ProductVariant"("productId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_assetId_key" ON "commerce"."ProductImage"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_publicId_key" ON "commerce"."ProductImage"("publicId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "commerce"."ProductImage"("productId", "position");

-- AddForeignKey
ALTER TABLE "commerce"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "commerce"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "commerce"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."InventoryBalance" ADD CONSTRAINT "InventoryBalance_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "commerce"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "commerce"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
