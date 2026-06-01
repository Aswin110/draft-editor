import type { LoaderFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import {
  getCustomerDraftOrders,
  getRecentDraftOrders,
} from "../models/draft-order.server";

// Outside production (i.e. `shopify app dev`), the extension preview has no
// logged-in customer, so fall back to showing the store's most recent draft
// orders. Never enabled in production — that would leak orders across customers.
const PREVIEW_FALLBACK = process.env.NODE_ENV !== "production";

/**
 * Public endpoint called by the "customer-draft-orders" customer account UI
 * extension via direct network access. It verifies the extension's session
 * token (which proves the request came from Shopify and identifies the logged
 * in customer through the `sub` claim), then returns that customer's draft
 * orders so they can view them and pay through the secure invoice URL.
 *
 * Requires "Allow network access" to be enabled for the app in the Partner
 * Dashboard, plus `network_access = true` in the extension's toml.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Verifies the session token and handles CORS (including preflight). `cors`
  // must wrap every response so the web-worker (null origin) request succeeds.
  const { sessionToken, cors } = await authenticate.public.customerAccount(
    request,
  );

  // `sub` is only present when a customer is logged in and the app has
  // permission to read customers. Without it we have no one to look up.
  const customerId = sessionToken.sub;
  // `dest` may arrive with a protocol (e.g. https://shop.myshopify.com);
  // unauthenticated.admin expects the bare myshopify domain.
  const shop = sessionToken.dest?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // In preview there's no logged-in customer, but `dest` (the shop) is still
  // present, so we can show recent store draft orders as sample data.
  if (!customerId) {
    if (PREVIEW_FALLBACK && shop) {
      const { admin } = await unauthenticated.admin(shop);
      const draftOrders = await getRecentDraftOrders(admin, 2);
      return cors(Response.json({ draftOrders }));
    }
    return cors(Response.json({ draftOrders: [] }));
  }

  if (!shop) {
    return cors(Response.json({ draftOrders: [] }));
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    const draftOrders = await getCustomerDraftOrders(admin, customerId);
    return cors(Response.json({ draftOrders }));
  } catch (error) {
    console.error("customer-draft-orders loader error:", error);
    return cors(
      Response.json(
        { draftOrders: [], error: "Unable to load draft orders" },
        { status: 500 },
      ),
    );
  }
};
