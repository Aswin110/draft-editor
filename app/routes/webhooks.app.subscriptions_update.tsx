import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { upsertPlan } from "../utils/billing.server";

/**
 * Webhook handler for APP_SUBSCRIPTIONS_UPDATE events.
 * Fires when a subscription is activated, cancelled, expired, or frozen.
 * This acts as a safety net to keep the local DB in sync with Shopify.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const subscription = payload.app_subscription;

  if (!subscription) {
    console.error("No app_subscription in webhook payload");
    return new Response();
  }

  // Map Shopify subscription status to our local status
  const shopifyStatus = subscription.status?.toUpperCase();
  let localStatus = "inactive";
  if (shopifyStatus === "ACTIVE") {
    localStatus = "active";
  } else if (shopifyStatus === "PENDING") {
    localStatus = "pending";
  } else if (shopifyStatus === "FROZEN") {
    localStatus = "frozen";
  } else if (shopifyStatus === "CANCELLED" || shopifyStatus === "EXPIRED") {
    localStatus = "cancelled";
  }

  const planName =
    localStatus === "active" || localStatus === "pending"
      ? subscription.name ?? null
      : null;

  const subscriptionId = subscription.admin_graphql_api_id ?? null;

  try {
    await upsertPlan({
      shopDomain: shop,
      planName,
      status: localStatus,
      shopifySubscriptionId: subscriptionId,
    });
    console.log(
      `Updated plan for ${shop}: status=${localStatus}, plan=${planName}`,
    );
  } catch (e) {
    console.error(`Failed to update plan for ${shop}:`, e);
  }

  return new Response();
};
