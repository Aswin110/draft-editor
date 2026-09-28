import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

/**
 * "Create draft order" action on the abandoned checkout details page.
 *
 * Shopify resolves relative URLs against the app URL and attaches the session
 * token to `fetch`, so this only has to call the app's API route. The real work
 * (copying line items, choosing a shipping rate, creating the draft) lives in
 * app/models/abandoned-checkout.server.ts, shared with the in-app page.
 */
const ENDPOINT = "/api/abandoned-checkout-draft";

// Keep the modal short: show a handful of items and summarise the rest.
const PREVIEW_ITEMS = 5;

interface LineItem {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  image: string | null;
  originalUnitPrice: string;
}

interface Address {
  name: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
}

interface CheckoutPreview {
  id: string;
  name: string;
  completedAt: string | null;
  totalPrice: string;
  currencyCode: string;
  customer: { displayName: string; email: string | null } | null;
  discountCodes: string[];
  shippingAddress: Address | null;
  lineItems: LineItem[];
  lineItemsTruncated: boolean;
}

interface DraftOrderRef {
  id: string;
  name: string;
}

interface PreviewResponse {
  checkout?: CheckoutPreview;
  existingDraftOrder?: DraftOrderRef | null;
  error?: string;
}

interface ConvertResponse {
  success: boolean;
  draftOrder?: DraftOrderRef;
  existingDraftOrder?: DraftOrderRef;
  warnings?: string[];
  error?: string;
}

export default async () => {
  render(<Extension />, document.body);
};

const numericId = (gid: string) => gid.split("/").pop() ?? gid;

// Admin UI extensions link into the admin with the shopify:admin/ protocol.
const draftOrderUrl = (draft: DraftOrderRef) =>
  `shopify:admin/draft_orders/${numericId(draft.id)}`;

function formatMoney(amount: string, currencyCode: string): string {
  const value = Number(amount);
  return shopify.i18n.formatCurrency(Number.isFinite(value) ? value : 0, {
    currency: currencyCode,
  });
}

function Extension() {
  const { i18n, close, data } = shopify;
  const checkoutId = data.selected[0]?.id ?? null;

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<ConvertResponse | null>(null);

  // Load a summary of the checkout (and whether a draft already exists for it)
  // so the merchant can see what they're about to create.
  useEffect(() => {
    if (!checkoutId) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `${ENDPOINT}?id=${encodeURIComponent(checkoutId)}`,
        );
        const body = (await response.json()) as PreviewResponse;
        if (!response.ok || !body.checkout) {
          throw new Error(body.error || `HTTP ${response.status}`);
        }
        if (!cancelled) setPreview(body);
      } catch (error) {
        console.error("Failed to load abandoned checkout", error);
        if (!cancelled) setLoadFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkoutId]);

  async function createDraft(force: boolean) {
    if (!checkoutId) return;
    setCreating(true);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkoutId, force }),
      });

      // The server answers business failures (already exists, Shopify
      // rejected the draft) with JSON too, so read the body regardless of
      // status and fall back to a generic message only when it isn't JSON.
      let body: ConvertResponse;
      try {
        body = (await response.json()) as ConvertResponse;
      } catch {
        body = { success: false, error: i18n.translate("createError") };
      }
      if (!body.success && !body.error) {
        body.error = i18n.translate("createError");
      }
      setResult(body);
    } catch (error) {
      console.error("Failed to create draft order", error);
      setResult({ success: false, error: i18n.translate("createError") });
    } finally {
      setCreating(false);
    }
  }

  const checkout = preview?.checkout ?? null;
  // A draft may already exist for this checkout — found on load, or reported
  // back when the merchant tried to create one without forcing a duplicate.
  const existing =
    result?.existingDraftOrder ?? preview?.existingDraftOrder ?? null;
  const created = result?.success ? (result.draftOrder ?? null) : null;
  const loading = Boolean(checkoutId) && !checkout && !loadFailed;

  if (created) {
    const warnings = result?.warnings ?? [];
    return (
      <s-admin-action heading={i18n.translate("heading")}>
        <s-stack direction="block" gap="base">
          <s-banner
            tone="success"
            heading={i18n.translate("successHeading", { name: created.name })}
          >
            <s-paragraph>{i18n.translate("successBody")}</s-paragraph>
          </s-banner>
          {warnings.length > 0 && (
            <s-stack direction="block" gap="small-300">
              <s-text type="strong">{i18n.translate("checkList")}</s-text>
              <s-unordered-list>
                {warnings.map((warning, index) => (
                  <s-list-item key={index}>{warning}</s-list-item>
                ))}
              </s-unordered-list>
            </s-stack>
          )}
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          href={draftOrderUrl(created)}
        >
          {i18n.translate("openDraft")}
        </s-button>
        <s-button slot="secondary-actions" variant="secondary" onClick={close}>
          {i18n.translate("done")}
        </s-button>
      </s-admin-action>
    );
  }

  return (
    <s-admin-action heading={i18n.translate("heading")} loading={loading}>
      <s-stack direction="block" gap="base">
        {!checkoutId && (
          <s-banner tone="warning">{i18n.translate("noCheckout")}</s-banner>
        )}
        {loadFailed && (
          <s-banner tone="critical">{i18n.translate("loadError")}</s-banner>
        )}
        {result && !result.success && !result.existingDraftOrder && (
          <s-banner tone="critical">
            {result.error || i18n.translate("createError")}
          </s-banner>
        )}
        {checkout?.completedAt && (
          <s-banner tone="info">{i18n.translate("completedNotice")}</s-banner>
        )}
        {existing && (
          <s-banner tone="warning" heading={i18n.translate("existingHeading")}>
            <s-stack direction="block" gap="small-300">
              <s-paragraph>
                {i18n.translate("existingBody", { name: existing.name })}
              </s-paragraph>
              <s-button variant="secondary" href={draftOrderUrl(existing)}>
                {i18n.translate("openExisting", { name: existing.name })}
              </s-button>
            </s-stack>
          </s-banner>
        )}
        {checkout && <CheckoutSummary checkout={checkout} />}
        {checkout && (
          <s-paragraph color="subdued">
            {i18n.translate("shippingNote")}
          </s-paragraph>
        )}
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!checkout}
        loading={creating}
        onClick={() => createDraft(Boolean(existing))}
      >
        {i18n.translate(existing ? "createAnother" : "create")}
      </s-button>
      <s-button
        slot="secondary-actions"
        variant="secondary"
        disabled={creating}
        onClick={close}
      >
        {i18n.translate("cancel")}
      </s-button>
    </s-admin-action>
  );
}

function CheckoutSummary({ checkout }: { checkout: CheckoutPreview }) {
  const { i18n } = shopify;
  const shown = checkout.lineItems.slice(0, PREVIEW_ITEMS);
  const hidden = checkout.lineItems.length - shown.length;
  const totalQuantity = checkout.lineItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const address = checkout.shippingAddress;
  const place = address
    ? [address.city, address.province, address.country]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <s-section heading={i18n.translate("summaryHeading")}>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-300">
          <s-text type="strong">
            {i18n.translate("items", { count: totalQuantity })}
          </s-text>
          {shown.map((item) => (
            <s-stack
              key={item.id}
              direction="inline"
              gap="base"
              alignItems="center"
            >
              {item.image && (
                <s-thumbnail
                  src={item.image}
                  alt={item.title}
                  size="small"
                ></s-thumbnail>
              )}
              <s-stack direction="block" gap="none">
                <s-text>
                  {item.variantTitle
                    ? `${item.title} — ${item.variantTitle}`
                    : item.title}
                </s-text>
                <s-text color="subdued">
                  {`${item.quantity} × ${formatMoney(
                    item.originalUnitPrice,
                    checkout.currencyCode,
                  )}`}
                </s-text>
              </s-stack>
            </s-stack>
          ))}
          {hidden > 0 && (
            <s-text color="subdued">
              {i18n.translate("moreItems", { count: hidden })}
            </s-text>
          )}
          {checkout.lineItemsTruncated && (
            <s-text color="subdued">
              {i18n.translate("truncatedItems", {
                count: checkout.lineItems.length,
              })}
            </s-text>
          )}
        </s-stack>

        <s-divider></s-divider>

        <SummaryRow
          label={i18n.translate("customer")}
          value={
            checkout.customer
              ? [checkout.customer.displayName, checkout.customer.email]
                  .filter(Boolean)
                  .join(" · ")
              : i18n.translate("noCustomer")
          }
        />
        <SummaryRow
          label={i18n.translate("shippingAddress")}
          value={place || address?.name || i18n.translate("noShippingAddress")}
        />
        {checkout.discountCodes.length > 0 && (
          <SummaryRow
            label={i18n.translate("discountCodes")}
            value={checkout.discountCodes.join(", ")}
          />
        )}
        <SummaryRow
          label={i18n.translate("total")}
          value={formatMoney(checkout.totalPrice, checkout.currencyCode)}
        />
      </s-stack>
    </s-section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <s-stack direction="block" gap="none">
      <s-text color="subdued">{label}</s-text>
      <s-text>{value}</s-text>
    </s-stack>
  );
}
