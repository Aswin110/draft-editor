-- CreateEnum
CREATE TYPE "TemplateTarget" AS ENUM ('LINE_ITEM_PROPERTY', 'CUSTOM_ATTRIBUTE');

-- AlterTable
ALTER TABLE "PropertyTemplate" ADD COLUMN "target" "TemplateTarget" NOT NULL DEFAULT 'LINE_ITEM_PROPERTY';

-- CreateIndex
CREATE INDEX "PropertyTemplate_shop_target_idx" ON "PropertyTemplate"("shop", "target");
