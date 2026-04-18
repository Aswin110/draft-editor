import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Clear plan state so a reinstall starts fresh (no stale "active" subscription
  // blocking new charge requests).
  try {
    await db.plan.updateMany({
      where: { shopDomain: shop },
      data: {
        status: "cancelled",
        name: null,
        shopifySubscriptionId: null,
      },
    });
  } catch (e) {
    console.error("Failed to clear plan on uninstall:", e);
  }

  return new Response();
};
