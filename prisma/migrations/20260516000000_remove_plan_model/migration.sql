-- Drop the Plan model entirely. The app is now free, so no billing/subscription state is tracked.

-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT IF EXISTS "Plan_shopDomain_fkey";

-- DropTable
DROP TABLE "Plan";
