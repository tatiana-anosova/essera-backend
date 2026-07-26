-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'CUSTOMER');

-- AlterTable
ALTER TABLE "public"."profiles" ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'CUSTOMER';
