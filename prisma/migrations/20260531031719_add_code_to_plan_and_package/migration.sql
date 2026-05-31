/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `plans` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `pt_packages` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `pt_packages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "code" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "pt_packages" ADD COLUMN     "code" VARCHAR(50) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pt_packages_code_key" ON "pt_packages"("code");
