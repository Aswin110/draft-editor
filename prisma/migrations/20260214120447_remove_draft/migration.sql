/*
  Warnings:

  - You are about to drop the `DraftOrderUsage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DraftOrderUsage" DROP CONSTRAINT "DraftOrderUsage_shopId_fkey";

-- DropTable
DROP TABLE "DraftOrderUsage";
