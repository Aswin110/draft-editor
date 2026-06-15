import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import {
  getCustomerDraftOrders,
  getRecentDraftOrders,
  updateCustomerDraftOrderQuantities,
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

interface UpdateQuantitiesBody {
  draftOrderId?: unknown;
  quantities?: unknown;
}

/**
 * Lets the logged-in customer change line item quantities on their own draft
 * order. Authenticated via the same customer-account session token as the
 * loader; ownership of the specific draft is re-verified server-side in
 * `updateCustomerDraftOrderQuantities`.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.customerAccount(
    request,
  );

  const customerId = sessionToken.sub;
  const shop = sessionToken.dest?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!customerId || !shop) {
    return cors(
      Response.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    );
  }

  let body: UpdateQuantitiesBody;
  try {
    body = (await request.json()) as UpdateQuantitiesBody;
  } catch {
    return cors(
      Response.json(
        { success: false, error: "Invalid request body" },
        { status: 400 },
      ),
    );
  }

  const draftOrderId = body.draftOrderId;
  if (typeof draftOrderId !== "string" || !draftOrderId) {
    return cors(
      Response.json(
        { success: false, error: "Missing draft order id" },
        { status: 400 },
      ),
    );
  }

  // Validate and sanitize the quantities map: line item gid -> positive integer.
  if (
    typeof body.quantities !== "object" ||
    body.quantities === null ||
    Array.isArray(body.quantities)
  ) {
    return cors(
      Response.json(
        { success: false, error: "Missing quantities" },
        { status: 400 },
      ),
    );
  }

  const quantities: Record<string, number> = {};
  for (const [lineItemId, value] of Object.entries(body.quantities)) {
    if (!Number.isInteger(value) || (value as number) < 1) {
      return cors(
        Response.json(
          { success: false, error: "Quantities must be whole numbers of 1 or more" },
          { status: 400 },
        ),
      );
    }
    quantities[lineItemId] = value as number;
  }

  if (Object.keys(quantities).length === 0) {
    return cors(
      Response.json(
        { success: false, error: "No quantities to update" },
        { status: 400 },
      ),
    );
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    const result = await updateCustomerDraftOrderQuantities(
      admin,
      customerId,
      draftOrderId,
      quantities,
    );
    return cors(
      Response.json(result, { status: result.success ? 200 : 400 }),
    );
  } catch (error) {
    console.error("customer-draft-orders action error:", error);
    return cors(
      Response.json(
        { success: false, error: "Unable to update draft order" },
        { status: 500 },
      ),
    );
  }
};
