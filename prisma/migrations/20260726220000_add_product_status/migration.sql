-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "status" "public"."ProductStatus" NOT NULL DEFAULT 'DRAFT';

-- Products that existed before the lifecycle was introduced were visible on the storefront.
UPDATE "public"."Product" SET "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "public"."Product"("status");
