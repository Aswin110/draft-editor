-- CreateTable
CREATE TABLE "PropertyTemplate" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyTemplate_shop_idx" ON "PropertyTemplate"("shop");
