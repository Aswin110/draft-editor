import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import {
  useI18n,
  useSessionToken,
} from "@shopify/ui-extensions/customer-account/preact";
import type {
  I18n,
  SessionToken,
} from "@shopify/ui-extensions/customer-account";

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
const DEV_APP_URL =
  " https://berlin-constraints-browse-unknown.trycloudflare.com";

const APP_URL =
  process.env.NODE_ENV === "production" ? PROD_APP_URL : DEV_APP_URL;
const ENDPOINT = `${APP_URL}/api/customer-draft-orders`;

interface VariantOption {
  id: string;
  title: string;
  price: string;
  availableForSale: boolean;
  image: string | null;
}

interface LineItemProperty {
  key: string;
  value: string;
}

interface DraftLineItem {
  id: string;
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  image: string | null;
  unitPrice: string;
  customAttributes: LineItemProperty[];
}

// Variant options for an order, keyed by line item id. Loaded on demand (per
// order) so the order list request stays within Shopify's query cost limit.
type VariantOptionsByLineItem = Record<string, VariantOption[]>;

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

  // Fetch (or re-fetch) the customer's draft orders. Re-fetching after a save
  // lets the displayed totals reflect the new quantities.
  const load = useCallback(async () => {
    try {
      const token = await sessionToken.get();
      const response = await fetch(ENDPOINT, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { draftOrders: DraftOrder[] };
      setDraftOrders(data.draftOrders ?? []);
      setError(false);
    } catch (e) {
      console.error("Failed to load draft orders", e);
      setError(true);
    }
  }, [sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

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
          <DraftOrderCard
            key={order.id}
            order={order}
            i18n={i18n}
            sessionToken={sessionToken}
            onSaved={load}
          />
        ))}
      </s-stack>
    </s-section>
  );
}

function DraftOrderCard({
  order,
  i18n,
  sessionToken,
  onSaved,
}: {
  order: DraftOrder;
  i18n: I18n;
  sessionToken: SessionToken;
  onSaved: () => Promise<void>;
}) {
  const canPay = Boolean(order.invoiceUrl) && order.status !== "COMPLETED";
  // Completed drafts are locked: the order has been placed, so quantities can
  // no longer change. The server enforces this too.
  const editable = order.status !== "COMPLETED";

  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.lineItems.map((item) => [item.id, item.quantity])),
  );
  const [variantSelections, setVariantSelections] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      order.lineItems
        .filter((item) => item.variantId)
        .map((item) => [item.id, item.variantId as string]),
    ),
  );
  const [properties, setProperties] = useState<
    Record<string, LineItemProperty[]>
  >(() =>
    Object.fromEntries(
      order.lineItems.map((item) => [
        item.id,
        item.customAttributes.map((attr) => ({ ...attr })),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Variant options are loaded on demand (when the customer expands the order)
  // so the order list request stays within Shopify's query cost limit.
  const [variantOptions, setVariantOptions] =
    useState<VariantOptionsByLineItem>({});
  const [expanded, setExpanded] = useState(false);

  // Re-sync local edits whenever the order data changes (e.g. after a
  // save-triggered reload), so the controls reflect the freshly saved values.
  useEffect(() => {
    setQuantities(
      Object.fromEntries(
        order.lineItems.map((item) => [item.id, item.quantity]),
      ),
    );
    setVariantSelections(
      Object.fromEntries(
        order.lineItems
          .filter((item) => item.variantId)
          .map((item) => [item.id, item.variantId as string]),
      ),
    );
    setProperties(
      Object.fromEntries(
        order.lineItems.map((item) => [
          item.id,
          item.customAttributes.map((attr) => ({ ...attr })),
        ]),
      ),
    );
  }, [order.lineItems]);

  // Fetch this order's variant options the first time it's expanded, and again
  // after a save (order.lineItems changes, which may re-key the line items).
  useEffect(() => {
    if (!expanded || !editable) return;
    let cancelled = false;

    async function loadVariants() {
      try {
        const token = await sessionToken.get();
        const response = await fetch(
          `${ENDPOINT}?draftOrderId=${encodeURIComponent(order.id)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as {
          variantsByLineItem?: VariantOptionsByLineItem;
        };
        if (!cancelled) setVariantOptions(data.variantsByLineItem ?? {});
      } catch (e) {
        console.error("Failed to load variant options", e);
      }
    }

    loadVariants();
    return () => {
      cancelled = true;
    };
  }, [expanded, editable, order.id, order.lineItems, sessionToken]);

  // Compare a line item's edited properties against its saved ones, ignoring
  // rows the customer left completely blank.
  const propertiesChanged = (item: DraftLineItem): boolean => {
    const edited = (properties[item.id] ?? [])
      .map((attr) => ({ key: attr.key.trim(), value: attr.value.trim() }))
      .filter((attr) => attr.key !== "");
    const original = item.customAttributes
      .map((attr) => ({ key: attr.key.trim(), value: attr.value.trim() }))
      .filter((attr) => attr.key !== "");
    return JSON.stringify(edited) !== JSON.stringify(original);
  };

  const dirty = order.lineItems.some(
    (item) =>
      quantities[item.id] !== item.quantity ||
      (variantSelections[item.id] ?? item.variantId) !== item.variantId ||
      propertiesChanged(item),
  );

  async function handleSave() {
    setSaving(true);
    setSaveError(false);
    try {
      // Only send the line items that actually changed.
      const changedQuantities: Record<string, number> = {};
      const changedVariants: Record<string, string> = {};
      const changedProperties: Record<string, LineItemProperty[]> = {};
      for (const item of order.lineItems) {
        if (quantities[item.id] !== item.quantity) {
          changedQuantities[item.id] = quantities[item.id];
        }
        const selectedVariant = variantSelections[item.id];
        if (selectedVariant && selectedVariant !== item.variantId) {
          changedVariants[item.id] = selectedVariant;
        }
        if (propertiesChanged(item)) {
          changedProperties[item.id] = (properties[item.id] ?? [])
            .map((attr) => ({ key: attr.key.trim(), value: attr.value.trim() }))
            .filter((attr) => attr.key !== "");
        }
      }

      const token = await sessionToken.get();
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draftOrderId: order.id,
          quantities: changedQuantities,
          variants: changedVariants,
          properties: changedProperties,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      // Reload from the server so prices and totals reflect the changes.
      await onSaved();
    } catch (e) {
      console.error("Failed to save draft order changes", e);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  function updateProperty(
    itemId: string,
    index: number,
    field: "key" | "value",
    value: string,
  ) {
    setProperties((current) => {
      const rows = (current[itemId] ?? []).map((attr) => ({ ...attr }));
      rows[index] = { ...rows[index], [field]: value };
      return { ...current, [itemId]: rows };
    });
  }

  function addProperty(itemId: string) {
    setProperties((current) => ({
      ...current,
      [itemId]: [...(current[itemId] ?? []), { key: "", value: "" }],
    }));
  }

  function removeProperty(itemId: string, index: number) {
    setProperties((current) => ({
      ...current,
      [itemId]: (current[itemId] ?? []).filter((_, i) => i !== index),
    }));
  }

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
          <s-details
            onToggle={(event: Event) => {
              const state = (event as unknown as { newState?: string })
                .newState;
              setExpanded(state === "open");
            }}
          >
            <s-summary>{i18n.translate("viewItems")}</s-summary>
            <s-stack direction="block" gap="base">
              {order.lineItems.map((item) => {
                const itemVariants = variantOptions[item.id] ?? [];
                // Reflect the currently selected variant's price live, before
                // saving, so the customer sees the effect of switching variant.
                const selectedVariantId =
                  variantSelections[item.id] ?? item.variantId;
                const selectedVariant = itemVariants.find(
                  (variant) => variant.id === selectedVariantId,
                );
                const displayUnitPrice = selectedVariant
                  ? selectedVariant.price
                  : item.unitPrice;
                // Reflect the selected variant's title and image too, falling
                // back to the line item's own values.
                const displayVariantTitle = selectedVariant
                  ? selectedVariant.title === "Default Title"
                    ? null
                    : selectedVariant.title
                  : item.variantTitle;
                const displayImage = selectedVariant?.image ?? item.image;

                return (
                  <s-stack key={item.id} direction="block" gap="small-300">
                    <s-stack direction="inline" gap="base" alignItems="center">
                      {displayImage && (
                        <s-product-thumbnail
                          src={displayImage}
                          alt={item.title}
                          size="small"
                        ></s-product-thumbnail>
                      )}
                      <s-stack direction="block" gap="none">
                        <s-text>
                          {displayVariantTitle
                            ? `${item.title} — ${displayVariantTitle}`
                            : item.title}
                        </s-text>
                        <s-text color="subdued">
                          {editable
                            ? formatMoney(
                                i18n,
                                displayUnitPrice,
                                order.currencyCode,
                              )
                            : `${i18n.translate("qty", {
                                count: item.quantity,
                              })} · ${formatMoney(
                                i18n,
                                item.unitPrice,
                                order.currencyCode,
                              )}`}
                        </s-text>
                      </s-stack>
                    </s-stack>

                    {editable && (
                      <s-stack direction="inline" gap="base" alignItems="end">
                        <s-number-field
                          label={i18n.translate("quantityLabel")}
                          controls="stepper"
                          min={1}
                          value={String(quantities[item.id] ?? item.quantity)}
                          disabled={saving}
                          onChange={(event: Event) => {
                            const target =
                              event.currentTarget as HTMLInputElement | null;
                            if (!target) return;
                            const raw = target.value;
                            const next = Number(raw);
                            if (
                              raw !== "" &&
                              Number.isFinite(next) &&
                              next >= 1
                            ) {
                              setQuantities((current) => ({
                                ...current,
                                [item.id]: Math.floor(next),
                              }));
                            }
                          }}
                        ></s-number-field>
                        {itemVariants.length > 1 && (
                          <s-box minInlineSize="200px">
                            <s-select
                              label={i18n.translate("variantLabel")}
                              value={selectedVariantId ?? undefined}
                              disabled={saving}
                              onChange={(event: Event) => {
                                const target =
                                  event.currentTarget as HTMLSelectElement | null;
                                if (!target) return;
                                const value = target.value;
                                setVariantSelections((current) => ({
                                  ...current,
                                  [item.id]: value,
                                }));
                              }}
                            >
                              {itemVariants.map((variant) => (
                                <s-option
                                  key={variant.id}
                                  value={variant.id}
                                  disabled={
                                    !variant.availableForSale &&
                                    variant.id !== item.variantId
                                  }
                                >
                                  {`${item.title} — ${variant.title}`}
                                </s-option>
                              ))}
                            </s-select>
                          </s-box>
                        )}
                      </s-stack>
                    )}

                    {editable ? (
                      <s-stack direction="block" gap="small-300">
                        {(properties[item.id] ?? []).map((attr, index) => (
                          <s-stack
                            key={index}
                            direction="inline"
                            gap="small-300"
                            alignItems="end"
                          >
                            <s-text-field
                              label={i18n.translate("propertyNameLabel")}
                              value={attr.key}
                              disabled={saving}
                              onInput={(event: Event) => {
                                const target =
                                  event.currentTarget as HTMLInputElement | null;
                                if (!target) return;
                                updateProperty(
                                  item.id,
                                  index,
                                  "key",
                                  target.value,
                                );
                              }}
                            ></s-text-field>
                            <s-text-field
                              label={i18n.translate("propertyValueLabel")}
                              value={attr.value}
                              disabled={saving}
                              onInput={(event: Event) => {
                                const target =
                                  event.currentTarget as HTMLInputElement | null;
                                if (!target) return;
                                updateProperty(
                                  item.id,
                                  index,
                                  "value",
                                  target.value,
                                );
                              }}
                            ></s-text-field>
                            <s-button
                              variant="secondary"
                              tone="critical"
                              disabled={saving}
                              accessibilityLabel={i18n.translate(
                                "removeProperty",
                              )}
                              onClick={() => removeProperty(item.id, index)}
                            >
                              {i18n.translate("removeProperty")}
                            </s-button>
                          </s-stack>
                        ))}
                        <s-stack direction="inline">
                          <s-button
                            variant="secondary"
                            disabled={saving}
                            onClick={() => addProperty(item.id)}
                          >
                            {i18n.translate("addProperty")}
                          </s-button>
                        </s-stack>
                      </s-stack>
                    ) : (
                      item.customAttributes.length > 0 && (
                        <s-stack direction="block" gap="none">
                          {item.customAttributes.map((attr, index) => (
                            <s-text key={index} color="subdued">
                              {attr.key}: {attr.value}
                            </s-text>
                          ))}
                        </s-stack>
                      )
                    )}
                  </s-stack>
                );
              })}
            </s-stack>
          </s-details>
        )}

        {editable && dirty && (
          <s-stack direction="block" gap="small-300">
            {saveError && (
              <s-text tone="critical">{i18n.translate("saveError")}</s-text>
            )}
            <s-stack direction="inline" gap="base">
              <s-button
                variant="secondary"
                onClick={handleSave}
                loading={saving}
              >
                {i18n.translate("save")}
              </s-button>
            </s-stack>
          </s-stack>
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
