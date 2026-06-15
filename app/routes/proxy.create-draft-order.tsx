import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  createDraftOrder,
  type CreateDraftOrderLineInput,
} from "../models/draft-order.server";

interface CartItemPayload {
  variantId?: unknown;
  quantity?: unknown;
  properties?: unknown;
}

/**
 * App Proxy endpoint for the storefront cart "Create draft order" button.
 *
 * Reached from the theme app extension at /apps/<subpath>/create-draft-order.
 * `authenticate.public.appProxy` verifies the request was genuinely proxied by
 * Shopify (HMAC) before we touch the Admin API — the browser can never create a
 * draft order directly.
 *
 * Requires a logged-in customer: Shopify appends a signed `logged_in_customer_id`
 * to proxied requests, which we attach to the draft so it carries the customer's
 * details. Guests are rejected (the storefront sends them to log in first).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.public.appProxy(request);

  // No offline session for this shop (app not installed / token missing).
  if (!admin) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const loggedInCustomerId = new URL(request.url).searchParams.get(
    "logged_in_customer_id",
  );
  if (!loggedInCustomerId) {
    return Response.json(
      { success: false, error: "login_required" },
      { status: 401 },
    );
  }
  const customerId = `gid://shopify/Customer/${loggedInCustomerId}`;

  let body: { items?: unknown };
  try {
    body = (await request.json()) as { items?: unknown };
  } catch {
    return Response.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json(
      { success: false, error: "Your cart is empty" },
      { status: 400 },
    );
  }

  const lineItems: CreateDraftOrderLineInput[] = [];
  for (const raw of body.items as CartItemPayload[]) {
    const variantId = Number(raw.variantId);
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(variantId) || variantId <= 0) {
      return Response.json(
        { success: false, error: "Invalid product in cart" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return Response.json(
        { success: false, error: "Invalid quantity in cart" },
        { status: 400 },
      );
    }

    const customAttributes: { key: string; value: string }[] = [];
    if (Array.isArray(raw.properties)) {
      for (const attr of raw.properties) {
        if (
          attr &&
          typeof attr === "object" &&
          typeof (attr as { key?: unknown }).key === "string" &&
          typeof (attr as { value?: unknown }).value === "string"
        ) {
          const key = (attr as { key: string }).key.trim();
          if (key !== "") {
            customAttributes.push({
              key,
              value: (attr as { value: string }).value,
            });
          }
        }
      }
    }

    lineItems.push({
      variantId: `gid://shopify/ProductVariant/${variantId}`,
      quantity,
      customAttributes,
    });
  }

  try {
    const result = await createDraftOrder(admin, customerId, lineItems);
    return Response.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("create-draft-order proxy error:", error);
    return Response.json(
      { success: false, error: "Unable to create draft order" },
      { status: 500 },
    );
  }
};
