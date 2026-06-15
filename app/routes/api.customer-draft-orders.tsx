import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import {
  getCustomerDraftOrders,
  getDraftOrderVariantOptions,
  getRecentDraftOrders,
  updateCustomerDraftOrderLineItems,
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

  // When a `draftOrderId` is provided, return that order's per-line-item variant
  // options instead of the order list. The extension loads these on demand (per
  // order) so the list query stays within the query cost limit. Ownership is
  // re-verified inside getDraftOrderVariantOptions.
  const draftOrderId = new URL(request.url).searchParams.get("draftOrderId");
  if (draftOrderId) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      const variantsByLineItem = await getDraftOrderVariantOptions(
        admin,
        customerId,
        draftOrderId,
      );
      return cors(Response.json({ variantsByLineItem }));
    } catch (error) {
      console.error("customer-draft-orders variant options error:", error);
      return cors(
        Response.json(
          { variantsByLineItem: {}, error: "Unable to load variants" },
          { status: 500 },
        ),
      );
    }
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

interface UpdateBody {
  draftOrderId?: unknown;
  quantities?: unknown;
  variants?: unknown;
  properties?: unknown;
}

/**
 * Lets the logged-in customer change line item quantities and/or variants on
 * their own draft order. Authenticated via the same customer-account session
 * token as the loader; ownership of the specific draft is re-verified
 * server-side in `updateCustomerDraftOrderLineItems`.
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

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
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

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  // Validate and sanitize the quantities map: line item gid -> positive integer.
  const quantities: Record<string, number> = {};
  if (body.quantities !== undefined) {
    if (!isPlainObject(body.quantities)) {
      return cors(
        Response.json(
          { success: false, error: "Invalid quantities" },
          { status: 400 },
        ),
      );
    }
    for (const [lineItemId, value] of Object.entries(body.quantities)) {
      if (!Number.isInteger(value) || (value as number) < 1) {
        return cors(
          Response.json(
            {
              success: false,
              error: "Quantities must be whole numbers of 1 or more",
            },
            { status: 400 },
          ),
        );
      }
      quantities[lineItemId] = value as number;
    }
  }

  // Validate and sanitize the variants map: line item gid -> variant gid.
  const variants: Record<string, string> = {};
  if (body.variants !== undefined) {
    if (!isPlainObject(body.variants)) {
      return cors(
        Response.json(
          { success: false, error: "Invalid variants" },
          { status: 400 },
        ),
      );
    }
    for (const [lineItemId, value] of Object.entries(body.variants)) {
      if (typeof value !== "string" || !value) {
        return cors(
          Response.json(
            { success: false, error: "Invalid variant id" },
            { status: 400 },
          ),
        );
      }
      variants[lineItemId] = value;
    }
  }

  // Validate and sanitize the properties map: line item gid -> array of
  // { key, value } string pairs. The customer fills in line item properties
  // (e.g. an engraving name or number) on their own draft order.
  const properties: Record<string, { key: string; value: string }[]> = {};
  if (body.properties !== undefined) {
    if (!isPlainObject(body.properties)) {
      return cors(
        Response.json(
          { success: false, error: "Invalid properties" },
          { status: 400 },
        ),
      );
    }
    for (const [lineItemId, value] of Object.entries(body.properties)) {
      if (!Array.isArray(value)) {
        return cors(
          Response.json(
            { success: false, error: "Invalid properties" },
            { status: 400 },
          ),
        );
      }
      const attributes: { key: string; value: string }[] = [];
      for (const attr of value) {
        if (
          !isPlainObject(attr) ||
          typeof attr.key !== "string" ||
          typeof attr.value !== "string"
        ) {
          return cors(
            Response.json(
              { success: false, error: "Invalid properties" },
              { status: 400 },
            ),
          );
        }
        attributes.push({ key: attr.key, value: attr.value });
      }
      properties[lineItemId] = attributes;
    }
  }

  if (
    Object.keys(quantities).length === 0 &&
    Object.keys(variants).length === 0 &&
    Object.keys(properties).length === 0
  ) {
    return cors(
      Response.json(
        { success: false, error: "Nothing to update" },
        { status: 400 },
      ),
    );
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    const result = await updateCustomerDraftOrderLineItems(
      admin,
      customerId,
      draftOrderId,
      quantities,
      variants,
      properties,
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
