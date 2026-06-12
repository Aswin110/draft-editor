import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  useI18n,
  useSessionToken,
} from "@shopify/ui-extensions/customer-account/preact";
import type { I18n } from "@shopify/ui-extensions/customer-account";

/**
 * Base URL of the app backend that serves draft orders. UI extensions run in a
 * null-origin web worker, so this must be an absolute URL.
 *
 * The Shopify CLI replaces `process.env.NODE_ENV` with a string literal when it
 * bundles the extension: "production" on `shopify app deploy`, "development" on
 * `shopify app dev`. So deployed builds always hit Railway, and dev builds hit
 * the local server through the tunnel — which is where the dev-only sample-data
 * fallback lives. A deployed build can never accidentally ship the tunnel URL.
 *
 * DEV note: update DEV_APP_URL with the tunnel URL the CLI prints each time you
 * run `shopify app dev` (e.g. https://xxxx.trycloudflare.com), unless you use a
 * stable tunnel.
 */
// `process` is not a real global in the worker; the bundler substitutes
// `process.env.NODE_ENV` with a string literal at build time. Declare it so
// TypeScript is satisfied without pulling in all of @types/node.
declare const process: { env: { NODE_ENV?: string } };

const PROD_APP_URL = "https://draft-editor-production.up.railway.app";
const DEV_APP_URL = "https://REPLACE-WITH-CURRENT-TUNNEL.trycloudflare.com";

const APP_URL =
  process.env.NODE_ENV === "production" ? PROD_APP_URL : DEV_APP_URL;
const ENDPOINT = `${APP_URL}/api/customer-draft-orders`;

interface DraftLineItem {
  title: string;
  variantTitle: string | null;
  quantity: number;
  image: string | null;
  unitPrice: string;
}

interface DraftOrder {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  totalPrice: string;
  currencyCode: string;
  invoiceUrl: string | null;
  lineItems: DraftLineItem[];
}

export default async () => {
  render(<Extension />, document.body);
};

function formatMoney(i18n: I18n, amount: string, currencyCode: string): string {
  const value = Number(amount);
  return i18n.formatCurrency(Number.isFinite(value) ? value : 0, {
    currency: currencyCode,
  });
}

function statusTone(status: string): "auto" | "critical" | "neutral" {
  switch (status) {
    case "COMPLETED":
      return "auto";
    case "OPEN":
      return "critical";
    default:
      return "neutral";
  }
}

function Extension() {
  const i18n = useI18n();
  const sessionToken = useSessionToken();
  const [draftOrders, setDraftOrders] = useState<DraftOrder[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await sessionToken.get();
        const response = await fetch(ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { draftOrders: DraftOrder[] };
        if (!cancelled) setDraftOrders(data.draftOrders ?? []);
      } catch (e) {
        console.error("Failed to load draft orders", e);
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  // Loading state.
  if (draftOrders === null && !error) {
    return (
      <s-section heading={i18n.translate("heading")}>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-spinner accessibilityLabel={i18n.translate("heading")}></s-spinner>
        </s-stack>
      </s-section>
    );
  }

  if (error) {
    return (
      <s-section heading={i18n.translate("heading")}>
        <s-banner tone="critical">{i18n.translate("error")}</s-banner>
      </s-section>
    );
  }

  // Hide the section entirely when there are no draft orders to show.
  if (!draftOrders || draftOrders.length === 0) {
    return null;
  }

  return (
    <s-section heading={i18n.translate("heading")}>
      <s-paragraph color="subdued">{i18n.translate("description")}</s-paragraph>
      <s-stack direction="block" gap="base">
        {draftOrders.map((order) => (
          <DraftOrderCard key={order.id} order={order} i18n={i18n} />
        ))}
      </s-stack>
    </s-section>
  );
}

function DraftOrderCard({ order, i18n }: { order: DraftOrder; i18n: I18n }) {
  const canPay = Boolean(order.invoiceUrl) && order.status !== "COMPLETED";

  return (
    <s-box padding="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="large" alignItems="center">
          <s-text type="strong">{order.name}</s-text>
          <s-badge tone={statusTone(order.status)}>{order.status}</s-badge>
          <s-text type="strong">
            {formatMoney(i18n, order.totalPrice, order.currencyCode)}
          </s-text>
        </s-stack>

        <s-text color="subdued">
          <s-time dateTime={order.createdAt}>
            {new Date(order.createdAt).toLocaleDateString()}
          </s-time>
        </s-text>

        {order.lineItems.length > 0 && (
          <s-details>
            <s-summary>{i18n.translate("viewItems")}</s-summary>
            <s-stack direction="block" gap="small-300">
              {order.lineItems.map((item, index) => (
                <s-stack
                  key={index}
                  direction="inline"
                  gap="base"
                  alignItems="center"
                >
                  {item.image && (
                    <s-product-thumbnail
                      src={item.image}
                      alt={item.title}
                      size="small"
                    ></s-product-thumbnail>
                  )}
                  <s-stack direction="block" gap="none">
                    <s-text>
                      {item.variantTitle
                        ? `${item.title} — ${item.variantTitle}`
                        : item.title}
                    </s-text>
                    <s-text color="subdued">
                      {i18n.translate("qty", { count: item.quantity })} ·{" "}
                      {formatMoney(i18n, item.unitPrice, order.currencyCode)}
                    </s-text>
                  </s-stack>
                </s-stack>
              ))}
            </s-stack>
          </s-details>
        )}

        {canPay && (
          <s-stack direction="inline" gap="base">
            <s-button
              variant="primary"
              href={order.invoiceUrl as string}
              target="_blank"
            >
              {i18n.translate("makePayment")}
            </s-button>
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
