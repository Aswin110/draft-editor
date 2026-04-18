import db from "../db.server";

/**
 * Test store detection:
 * 1. Non-production environment → always test
 * 2. Shopify API partnerDevelopment flag → dev/partner stores use test billing
 */
export const isTestStore = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { graphql: (...args: any[]) => Promise<any> },
): Promise<boolean> => {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  try {
    const response = await admin.graphql(
      `{ shop { plan { partnerDevelopment } } }`,
    );
    const { data } = await response.json();
    return data?.shop?.plan?.partnerDevelopment === true;
  } catch (e) {
    console.error("Failed to check store type:", e);
    return false;
  }
};

/**
 * Upsert the local Plan record in the database.
 * Called after subscription create/activate and by the webhook handler.
 */
export const upsertPlan = async ({
  shopDomain,
  planName,
  status,
  shopifySubscriptionId,
}: {
  shopDomain: string;
  planName: string | null;
  status: string;
  shopifySubscriptionId?: string | null;
}) => {
  const shop = await db.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    console.error(`Shop not found for domain: ${shopDomain}`);
    return null;
  }

  return db.plan.upsert({
    where: { shopDomain },
    update: {
      name: planName,
      status,
      shopifySubscriptionId: shopifySubscriptionId ?? undefined,
      updatedAt: new Date(),
    },
    create: {
      shopDomain,
      name: planName,
      status,
      shopifySubscriptionId: shopifySubscriptionId ?? undefined,
    },
  });
};

/**
 * Get the locally stored plan for a shop.
 */
export const getStoredPlan = async (shopDomain: string) => {
  const shop = await db.shop.findUnique({
    where: { shopDomain },
    include: { plan: true },
  });
  return shop?.plan ?? null;
};

/**
 * Fast subscription check from local DB.
 * Use this in routes that don't need to mutate billing state — the webhook
 * and the plans page keep this in sync with Shopify.
 */
export const getSubscriptionFromDb = async (shopDomain: string) => {
  const plan = await getStoredPlan(shopDomain);
  const hasActiveSubscription = plan?.status === "active";
  return {
    hasActiveSubscription,
    currentPlan: hasActiveSubscription ? plan?.name ?? null : null,
  };
};

/**
 * Check subscription status using Shopify billing API and sync to DB.
 * Returns the billing result and syncs the local DB if out of date.
 */
export const checkAndSyncBilling = async ({
  billing,
  shopDomain,
  plans,
  isTest,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  billing: { check: (opts: any) => Promise<any> };
  shopDomain: string;
  plans: string[];
  isTest: boolean;
}) => {
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans,
    isTest,
  });

  const currentPlan =
    appSubscriptions.length > 0 ? appSubscriptions[0].name : null;
  const subscriptionId =
    appSubscriptions.length > 0 ? appSubscriptions[0].id : null;

  // Sync to local DB
  const newStatus = hasActivePayment ? "active" : "inactive";
  try {
    await upsertPlan({
      shopDomain,
      planName: currentPlan,
      status: newStatus,
      shopifySubscriptionId: subscriptionId,
    });
  } catch (e) {
    console.error("Failed to sync plan to DB:", e);
  }

  return { hasActivePayment, appSubscriptions, currentPlan };
};
