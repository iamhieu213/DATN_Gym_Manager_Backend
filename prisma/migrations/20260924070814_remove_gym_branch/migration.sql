/*
  Warnings:

  - You are about to drop the column `branch_id` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `branch_id` on the `equipments` table. All the data in the column will be lost.
  - You are about to drop the column `branch_id` on the `group_classes` table. All the data in the column will be lost.
  - You are about to drop the column `branch_id` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `branch_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `gym_branches` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "check_ins" DROP CONSTRAINT "check_ins_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "equipments" DROP CONSTRAINT "equipments_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "group_classes" DROP CONSTRAINT "group_classes_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_branch_id_fkey";

-- AlterTable
ALTER TABLE "check_ins" DROP COLUMN "branch_id";

-- AlterTable
ALTER TABLE "equipments" DROP COLUMN "branch_id";

-- AlterTable
ALTER TABLE "group_classes" DROP COLUMN "branch_id";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "branch_id";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "branch_id";

-- DropTable
DROP TABLE "gym_branches";
