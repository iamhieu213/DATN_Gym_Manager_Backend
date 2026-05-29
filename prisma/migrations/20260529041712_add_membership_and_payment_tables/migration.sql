/*
  Warnings:

  - The primary key for the `memberships` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `memberships` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `payments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `payments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `plans` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `plans` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `plan_id` on the `memberships` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `membership_id` on the `payments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `plan_id` on the `payments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_membership_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_plan_id_fkey";

-- AlterTable
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "plan_id",
ADD COLUMN     "plan_id" INTEGER NOT NULL,
ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "payments" DROP CONSTRAINT "payments_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "membership_id",
ADD COLUMN     "membership_id" INTEGER NOT NULL,
DROP COLUMN "plan_id",
ADD COLUMN     "plan_id" INTEGER NOT NULL,
ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "plans" DROP CONSTRAINT "plans_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "memberships_plan_id_idx" ON "memberships"("plan_id");

-- CreateIndex
CREATE INDEX "payments_membership_id_idx" ON "payments"("membership_id");

-- CreateIndex
CREATE INDEX "payments_plan_id_idx" ON "payments"("plan_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
