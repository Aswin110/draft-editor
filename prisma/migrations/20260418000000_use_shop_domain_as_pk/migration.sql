-- Promote Shop.shopDomain to primary key; Plan FK now references shopDomain instead of a surrogate cuid.

-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_shopId_fkey";

-- DropIndex (old unique on Plan.shopId)
DROP INDEX "Plan_shopId_key";

-- Plan: replace shopId column with shopDomain
ALTER TABLE "Plan" DROP COLUMN "shopId";
ALTER TABLE "Plan" ADD COLUMN "shopDomain" TEXT NOT NULL;
CREATE UNIQUE INDEX "Plan_shopDomain_key" ON "Plan"("shopDomain");

-- Shop: drop old id PK, promote shopDomain to PK
ALTER TABLE "Shop" DROP CONSTRAINT "Shop_pkey";
DROP INDEX "Shop_shopDomain_key";
ALTER TABLE "Shop" DROP COLUMN "id";
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_pkey" PRIMARY KEY ("shopDomain");

-- Re-add FK
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "Shop"("shopDomain") ON DELETE CASCADE ON UPDATE CASCADE;
