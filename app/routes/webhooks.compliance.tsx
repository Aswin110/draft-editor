import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} compliance webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // App does not store customer data beyond Shopify sessions.
      // No action needed.
      break;
    case "CUSTOMERS_REDACT":
      // App does not store customer data beyond Shopify sessions.
      // No action needed.
      break;
    case "SHOP_REDACT":
      // App does not store shop-specific data that needs manual redaction.
      // Session data is already deleted via the app/uninstalled webhook.
      break;
  }

  return new Response();
};
