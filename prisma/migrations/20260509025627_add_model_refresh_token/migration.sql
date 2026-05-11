/*
  Warnings:

  - Added the required column `token_id` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "token_id" UUID NOT NULL;
