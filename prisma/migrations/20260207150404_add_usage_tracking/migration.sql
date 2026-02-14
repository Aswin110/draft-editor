-- CreateTable
CREATE TABLE "DraftOrderUsage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "draftOrderGid" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftOrderUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftOrderUsage_shopId_editedAt_idx" ON "DraftOrderUsage"("shopId", "editedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DraftOrderUsage_shopId_draftOrderGid_key" ON "DraftOrderUsage"("shopId", "draftOrderGid");

-- AddForeignKey
ALTER TABLE "DraftOrderUsage" ADD CONSTRAINT "DraftOrderUsage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
