-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" VARCHAR(255),
ADD COLUMN     "avatar_url" VARCHAR(255),
ADD COLUMN     "citizen_id" VARCHAR(50),
ADD COLUMN     "emergency_contact" VARCHAR(255),
ADD COLUMN     "gender" "Gender";

-- CreateIndex
CREATE UNIQUE INDEX "users_citizen_id_key" ON "users"("citizen_id");
