-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "shippingCountry" TEXT,
  ADD COLUMN "shippingFirstName" TEXT,
  ADD COLUMN "shippingLastName" TEXT,
  ADD COLUMN "shippingAddress" TEXT,
  ADD COLUMN "shippingApartments" TEXT,
  ADD COLUMN "shippingCity" TEXT,
  ADD COLUMN "shippingState" TEXT,
  ADD COLUMN "shippingZip" TEXT,
  ADD COLUMN "shippingPhone" TEXT;
