/*
  Warnings:

  - Added the required column `branch_id` to the `check_ins` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `equipments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `group_classes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN     "branch_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "equipments" ADD COLUMN     "branch_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "group_classes" ADD COLUMN     "branch_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "branch_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "branch_id" INTEGER;

-- CreateTable
CREATE TABLE "gym_branches" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gym_branches_code_key" ON "gym_branches"("code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "gym_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "gym_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "gym_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_classes" ADD CONSTRAINT "group_classes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "gym_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "gym_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
