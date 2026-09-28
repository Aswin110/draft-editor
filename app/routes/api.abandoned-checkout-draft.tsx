import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  convertAbandonedCheckoutToDraftOrder,
  findDraftOrderForCheckout,
  getAbandonedCheckout,
} from "../models/abandoned-checkout.server";

/**
 * Backend for the "Create draft order" admin action on abandoned checkout
 * pages (extensions/abandoned-checkout-draft).
 *
 * Admin UI extensions call this with `fetch`; Shopify attaches the session
 * token for us, and `authenticate.admin` verifies it. The extension runs on a
 * Shopify domain, so every response — including preflights and auth failures —
 * needs CORS headers or the browser hides it from the extension.
 *
 *   GET  ?id=<gid|numeric>          → checkout summary + any existing draft
 *   POST { id, force?: boolean }    → create the draft order
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "7200",
};

const withCors = (response: Response): Response => {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
};

/**
 * Runs `authenticate.admin`, but re-throws its failure responses (401, etc.)
 * with CORS headers so the extension sees the real status instead of a
 * network error.
 */
const authenticateExtension = async (request: Request) => {
  try {
    return await authenticate.admin(request);
  } catch (error) {
    if (error instanceof Response) throw withCors(error);
    throw error;
  }
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Browsers send a preflight (no Authorization header) before the real
  // request; answer it before authentication would reject it.
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  const { admin, cors } = await authenticateExtension(request);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return cors(json({ error: "Missing abandoned checkout id" }, 400));
  }

  try {
    const [checkout, existingDraftOrder] = await Promise.all([
      getAbandonedCheckout(admin, id),
      findDraftOrderForCheckout(admin, id),
    ]);

    if (!checkout) {
      return cors(json({ error: "Abandoned checkout not found" }, 404));
    }

    return cors(json({ checkout, existingDraftOrder }));
  } catch (error) {
    console.error("abandoned-checkout-draft loader error:", error);
    return cors(json({ error: "Unable to load this checkout" }, 500));
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, cors } = await authenticateExtension(request);

  let body: { id?: unknown; force?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; force?: unknown };
  } catch {
    return cors(
      json({ success: false, error: "Invalid request body", warnings: [] }, 400),
    );
  }

  if (typeof body.id !== "string" || body.id.trim() === "") {
    return cors(
      json(
        { success: false, error: "Missing abandoned checkout id", warnings: [] },
        400,
      ),
    );
  }

  try {
    const result = await convertAbandonedCheckoutToDraftOrder(admin, body.id, {
      force: body.force === true,
    });

    const status = result.success ? 200 : result.existingDraftOrder ? 409 : 400;
    return cors(json(result, status));
  } catch (error) {
    console.error("abandoned-checkout-draft action error:", error);
    return cors(
      json(
        { success: false, error: "Unable to create draft order", warnings: [] },
        500,
      ),
    );
  }
};
