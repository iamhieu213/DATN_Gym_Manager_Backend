-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateTable
CREATE TABLE "equipments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "location" VARCHAR(255),
    "purchase_date" TIMESTAMP(3),
    "last_maintenance_date" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipments_code_key" ON "equipments"("code");

-- CreateIndex
CREATE INDEX "equipments_status_idx" ON "equipments"("status");
